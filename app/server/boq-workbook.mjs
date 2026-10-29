import { inflateRawSync, crc32 } from 'node:zlib';
import { posix } from 'node:path';
import sax from '../vendor/sax/sax.cjs';
import { requireThat } from './money.mjs';
export const WORKBOOK_LIMITS = {
  bytes: 2 * 1024 * 1024,
  expanded: 16 * 1024 * 1024,
  entries: 256,
  sheets: 20,
  rows: 1200,
  columns: 60,
  cells: 30000
};
const check = (ok, message) => requireThat(ok, message);
const decode = bytes => {
  try {
    return new TextDecoder('utf-8', {
      fatal: true
    }).decode(bytes);
  } catch {
    throw Object.assign(new Error('Use a UTF-8 CSV or XLSX workbook.'), {
      status: 400
    });
  }
};
export const columnName = n => {
  let s = '';
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
};
const columnIndex = name => [...name].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// A bounded OOXML ZIP reader. No files are extracted, no paths executed, and ZIP64/encryption are rejected.
export function workbookZip(bytes) {
  check(Buffer.isBuffer(bytes) && bytes.length >= 22 && bytes.length <= WORKBOOK_LIMITS.bytes, 'Workbook must be non-empty and at most 2 MiB.');
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) {
    eocd = i;
    break;
  }
  check(eocd >= 0, 'This file is not a supported XLSX ZIP archive.');
  const count = bytes.readUInt16LE(eocd + 10),
    size = bytes.readUInt32LE(eocd + 12),
    offset = bytes.readUInt32LE(eocd + 16);
  check(bytes.readUInt32LE(eocd + 4) === 0 && bytes.readUInt16LE(eocd + 8) === count && count > 0 && count <= WORKBOOK_LIMITS.entries && offset + size === eocd, 'Split, ZIP64 or oversized workbooks are unsupported.');
  const entries = new Map();
  let at = offset,
    expanded = 0;
  const spans = [];
  for (let i = 0; i < count; i++) {
    check(at + 46 <= eocd && bytes.readUInt32LE(at) === 0x02014b50, 'Invalid workbook directory.');
    const flags = bytes.readUInt16LE(at + 8),
      method = bytes.readUInt16LE(at + 10),
      crc = bytes.readUInt32LE(at + 16),
      packed = bytes.readUInt32LE(at + 20),
      length = bytes.readUInt32LE(at + 24),
      n = bytes.readUInt16LE(at + 28),
      extra = bytes.readUInt16LE(at + 30),
      comment = bytes.readUInt16LE(at + 32),
      start = bytes.readUInt32LE(at + 42);
    check(at + 46 + n + extra + comment <= eocd && !(flags & 1) && [0, 8].includes(method) && bytes.readUInt16LE(at + 34) === 0, 'Encrypted or unsupported workbook compression.');
    const name = decode(bytes.subarray(at + 46, at + 46 + n));
    check(name && !name.includes('\\') && !name.includes('\0') && !name.startsWith('/') && !name.split('/').includes('..') && !entries.has(name), 'Unsafe or duplicate workbook entry.');
    expanded += length;
    check(length <= WORKBOOK_LIMITS.expanded && expanded <= WORKBOOK_LIMITS.expanded, 'Workbook expands beyond 16 MiB.');
    check(start + 30 <= offset && bytes.readUInt32LE(start) === 0x04034b50, 'Invalid workbook local entry.');
    const localNameLength = bytes.readUInt16LE(start + 26),
      localExtra = bytes.readUInt16LE(start + 28),
      dataStart = start + 30 + localNameLength + localExtra;
    check(dataStart + packed <= offset && decode(bytes.subarray(start + 30, start + 30 + localNameLength)) === name && bytes.readUInt16LE(start + 8) === method && bytes.readUInt16LE(start + 6) === flags, 'Workbook directory/local entry mismatch.');
    check(spans.every(([a, b]) => dataStart + packed <= a || start >= b), 'Overlapping workbook entries.');
    spans.push([start, dataStart + packed]);
    let data;
    try {
      data = method === 0 ? bytes.subarray(dataStart, dataStart + packed) : inflateRawSync(bytes.subarray(dataStart, dataStart + packed), {
        maxOutputLength: Math.max(1, length)
      });
    } catch {
      check(false, 'Workbook compression is damaged or exceeds its declared size.');
    }
    check(data.length === length && crc32(data) === crc, 'Workbook entry checksum/size mismatch.');
    entries.set(name, data);
    at += 46 + n + extra + comment;
  }
  check(at === eocd, 'Unexpected workbook directory data.');
  check(![...entries.keys()].some(n => /vbaProject|externalLinks|embeddings|activeX/i.test(n)), 'Macros, embedded objects and external workbook links are unsupported. Export a reviewed values-only workbook.');
  return entries;
}
function xml(bytes, label) {
  check(bytes, `Workbook is missing ${label}.`);
  const text = decode(bytes);
  check(!/<!DOCTYPE|<!ENTITY/i.test(text), 'XML document types/entities are not permitted.');
  const p = sax.parser(true, {
      xmlns: true,
      strictEntities: true
    }),
    stack = [];
  let root,
    nodes = 0;
  p.onopentag = tag => {
    check(++nodes <= 150000 && stack.length < 40, 'Workbook XML is too complex.');
    const attrs = Object.fromEntries(Object.values(tag.attributes).map(a => [a.name, a.value]));
    const node = {
      name: tag.local,
      attrs,
      children: [],
      text: ''
    };
    if (stack.length) stack.at(-1).children.push(node);else {
      check(!root, 'Multiple XML roots.');
      root = node;
    }
    stack.push(node);
  };
  p.ontext = p.oncdata = s => {
    if (stack.length) {
      stack.at(-1).text += s;
      check(stack.at(-1).text.length <= 65536, 'Workbook cell/text is too long.');
    }
  };
  p.onclosetag = () => stack.pop();
  try {
    p.write(text).close();
  } catch (e) {
    if (e.status) throw e;
    check(false, `Malformed ${label}.`);
  }
  check(root && !stack.length, `Incomplete ${label}.`);
  return root;
}
const children = (n, name) => n?.children.filter(c => c.name === name) || [];
const child = (n, name) => children(n, name)[0];
const texts = n => n ? n.text + n.children.map(texts).join('') : '';
const richText = n => children(n, 't').map(texts).join('') + children(n, 'r').map(r => texts(child(r, 't'))).join('');
function xlsx(bytes) {
  const entries = workbookZip(bytes),
    book = xml(entries.get('xl/workbook.xml'), 'workbook'),
    rel = xml(entries.get('xl/_rels/workbook.xml.rels'), 'workbook relationships');
  check(book.name === 'workbook', 'Unsupported workbook document.');
  const targets = new Map();
  for (const r of children(rel, 'Relationship')) {
    check(r.attrs.TargetMode !== 'External', 'External workbook relationships are unsupported.');
    check(!targets.has(r.attrs.Id), 'Duplicate workbook relationship.');
    const target = r.attrs.Target || '',
      path = target.startsWith('/') ? target.slice(1) : posix.normalize('xl/' + target);
    check(path.startsWith('xl/') && !/[?#\\]/.test(path), 'Unsafe workbook relationship.');
    targets.set(r.attrs.Id, {
      path,
      type: r.attrs.Type
    });
  }
  const strings = entries.has('xl/sharedStrings.xml') ? children(xml(entries.get('xl/sharedStrings.xml'), 'shared strings'), 'si').map(richText) : [];
  const styles = entries.has('xl/styles.xml') ? xml(entries.get('xl/styles.xml'), 'styles') : null;
  const formats = new Map(children(child(styles, 'numFmts'), 'numFmt').map(n => [Number(n.attrs.numFmtId), n.attrs.formatCode]));
  const unsafeNumericStyles = children(child(styles, 'cellXfs'), 'xf').map(n => {
    const id = Number(n.attrs.numFmtId || 0),
      format = (formats.get(id) || '').replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
    return id === 9 || id === 10 || id >= 14 && id <= 22 || id >= 27 && id <= 36 || id >= 45 && id <= 47 || id >= 50 && id <= 58 || /[ymdhs%]/i.test(format);
  });
  const sheets = children(child(book, 'sheets'), 'sheet');
  check(sheets.length && sheets.length <= WORKBOOK_LIMITS.sheets, 'Use 1 to 20 worksheets.');
  const names = new Set();
  let cellCount = 0,
    cellCharacters = 0;
  return {
    format: 'xlsx',
    sheets: sheets.map(s => {
      check(!names.has(s.attrs.name), 'Duplicate worksheet name.');
      names.add(s.attrs.name);
      const relationship = targets.get(s.attrs['r:id']);
      check(relationship && /\/worksheet$/.test(relationship.type), 'Only worksheets are supported.');
      const root = xml(entries.get(relationship.path), 'worksheet'),
        rows = [],
        hiddenColumns = [];
      for (const c of children(child(root, 'cols'), 'col')) if (['1', 'true'].includes(c.attrs.hidden)) hiddenColumns.push([Number(c.attrs.min) - 1, Number(c.attrs.max) - 1]);
      for (const r of children(child(root, 'sheetData'), 'row')) {
        const number = Number(r.attrs.r);
        check(Number.isSafeInteger(number) && number >= 1 && number <= WORKBOOK_LIMITS.rows && !rows.some(x => x.number === number), 'Rows must be unique and within 1–1,200.');
        const cells = [];
        for (const c of children(r, 'c')) {
          const m = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(c.attrs.r || '');
          check(m && Number(m[2]) === number, 'Invalid worksheet cell reference.');
          const col = columnIndex(m[1]);
          check(col < WORKBOOK_LIMITS.columns && !cells.some(x => x.column === col) && ++cellCount <= WORKBOOK_LIMITS.cells, 'Workbook exceeds 60 columns/30,000 cells or has duplicate cells.');
          const raw = texts(child(c, 'v')),
            type = c.attrs.t || 'n';
          let value = raw;
          if (type === 's') {
            check(/^\d+$/.test(raw) && Number(raw) < strings.length, 'Invalid shared-string reference.');
            value = strings[Number(raw)];
          } else if (type === 'inlineStr') value = richText(child(c, 'is'));
          const formula = Boolean(child(c, 'f'));
          const error = Boolean(!['n', 's', 'inlineStr', 'str', 'b'].includes(type) || type === 'n' && unsafeNumericStyles[Number(c.attrs.s || 0)]);
          check(value.length <= 3000, 'Cell text exceeds 3,000 characters.');
          cellCharacters += value.length;
          check(cellCharacters <= 4 * 1024 * 1024, 'Expanded cell text exceeds 4 MiB.');
          if (value !== '' || formula || error) cells.push({
            column: col,
            address: c.attrs.r,
            value,
            formula,
            error,
            hidden: hiddenColumns.some(([a, b]) => col >= a && col <= b)
          });
        }
        if (cells.length) rows.push({
          number,
          hidden: ['1', 'true'].includes(r.attrs.hidden),
          cells
        });
      }
      return {
        name: s.attrs.name,
        hidden: Boolean(s.attrs.state && s.attrs.state !== 'visible'),
        merged: Boolean(child(root, 'mergeCells')),
        rows
      };
    })
  };
}
function csv(bytes) {
  const text = decode(bytes).replace(/^\uFEFF/, '');
  check(!text.includes('\0'), 'CSV contains binary data.');
  const rows = [];
  let values = [],
    field = '',
    quoted = false,
    afterQuote = false,
    number = 1;
  const pushField = () => {
    check(field.length <= 3000 && values.length < 60, 'CSV exceeds cell/column limits.');
    values.push(field);
    field = '';
    afterQuote = false;
  };
  const pushRow = () => {
    pushField();
    check(number <= 1200, 'Use at most 1,200 CSV rows.');
    const cells = values.map((value, column) => ({
      column,
      address: columnName(column) + number,
      value,
      formula: /^[=+@\t\r]/.test(value),
      error: /^#(REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|NULL!|SPILL!|CALC!)/.test(value),
      hidden: false
    })).filter(c => c.value !== '');
    if (cells.length) rows.push({
      number,
      hidden: false,
      cells
    });
    values = [];
    number++;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += c;
    } else if (c === ',') pushField();else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (c === '"') {
      check(field === '' && !afterQuote, 'Invalid CSV quoting.');
      quoted = true;
    } else {
      check(!afterQuote, 'Unexpected content after a CSV quote.');
      field += c;
    }
    check(field.length <= 3000, 'CSV cell exceeds 3,000 characters.');
  }
  check(!quoted, 'CSV has an unclosed quote.');
  if (field || values.length || afterQuote) pushRow();
  check(rows.reduce((n, r) => n + r.cells.length, 0) <= 30000, 'CSV exceeds 30,000 cells.');
  return {
    format: 'csv',
    sheets: [{
      name: 'CSV',
      hidden: false,
      merged: false,
      rows
    }]
  };
}
export function readBoqWorkbook(filename, bytes) {
  check(typeof filename === 'string' && filename.length <= 180 && !/[\\/\x00-\x1f]/.test(filename), 'Use a plain filename of at most 180 characters.');
  check(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= WORKBOOK_LIMITS.bytes, 'Each file must be non-empty and at most 2 MiB.');
  check(/\.(xlsx|csv)$/i.test(filename), 'Upload XLSX or UTF-8 comma-separated CSV.');
  return /\.xlsx$/i.test(filename) ? xlsx(bytes) : csv(bytes);
}
