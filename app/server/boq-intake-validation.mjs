import { createHash } from 'node:crypto';
import { D, decimal, money, sum } from './money.mjs';
import { calculateEstimate, estimateRatio } from './estimates-calculation.mjs';
import { BOQ_COLUMNS, normaliseHeading } from '../shared/boq-intake.mjs';
export const intakeDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normal = v => String(v || '').normalize('NFKC').trim().toLowerCase();
const numeric = (v, label, optional = false) => {
  if (optional && v === '') return '0';
  return decimal(v, label).toString();
};
export function validateIntake(db, estimate, files, configs) {
  const issues = [],
    imported = [],
    fileResults = [],
    products = db.prepare('SELECT id,company_id,code,name,uom,version,active FROM products WHERE company_id=?').all(estimate.company_id),
    costs = db.prepare('SELECT * FROM cost_codes WHERE company_id=?').all(estimate.company_id),
    units = db.prepare('SELECT * FROM catalogue_units').all();
  const codes = new Set(estimate.lines.map(l => l.code));
  const issue = (file, sheet, row, cell, message) => issues.push({
    file_id: file?.id || null,
    filename: file?.filename || 'Batch',
    sheet,
    row,
    cell,
    message
  });
  for (const file of files) {
    const cfg = configs.find(c => c.file_id === file.id),
      parsed = JSON.parse(file.parsed),
      sheet = parsed.sheets.find(s => s.name === cfg?.sheet),
      startIssues = issues.length,
      startRows = imported.length;
    if (!cfg || !sheet) {
      issue(file, '', null, '', 'Choose a worksheet and mapping for this file.');
      continue;
    }
    const header = sheet.rows.find(r => r.number === cfg.header),
      mapping = cfg.mapping || {},
      assigned = new Set();
    if (!Number.isInteger(cfg.header) || cfg.header < 1 || cfg.header > 20 || !header) issue(file, sheet.name, cfg.header, '', 'Choose a populated header row in the first 20 rows.');
    if (sheet.hidden) issue(file, sheet.name, null, '', 'The selected sheet is hidden. Unhide and review it in the source file.');
    if (sheet.merged) issue(file, sheet.name, null, '', 'Merged cells require an unmerged, reviewed intake sheet.');
    for (const [key, col] of Object.entries(mapping)) {
      if (!Object.hasOwn(BOQ_COLUMNS, key) || !Number.isInteger(col) || col < 0 || col >= 60 || !header?.cells.some(c => c.column === col && c.value.trim())) issue(file, sheet.name, cfg.header, '', `Invalid ${key} column mapping.`);
      if (assigned.has(col)) issue(file, sheet.name, cfg.header, '', 'One column cannot map to two fields.');
      assigned.add(col);
    }
    for (const key of ['code', 'description', 'quantity', 'unit']) if (!Object.hasOwn(mapping, key)) issue(file, sheet.name, cfg.header, '', `Map the ${key} column.`);
    for (const cell of header?.cells || []) {
      if (cell.formula || cell.error || cell.hidden || header.hidden) issue(file, sheet.name, header.number, cell.address, 'Header contains a formula, error or hidden cell.');
      if (!assigned.has(cell.column)) issue(file, sheet.name, header.number, cell.address, `Unmapped column “${cell.value}”. Map it or remove it in a reviewed source copy.`);
      if (header.cells.filter(c => normaliseHeading(c.value) === normaliseHeading(cell.value)).length > 1) issue(file, sheet.name, header.number, cell.address, 'Duplicate column headings are ambiguous.');
    }
    let expected = null;
    try {
      expected = money(numeric(cfg.expected_total, 'Expected direct total'));
      if (new D(cfg.expected_total).cmp(expected) !== 0) throw new Error('Expected total needs at most two decimals.');
    } catch (e) {
      issue(file, sheet.name, null, '', e.message);
    }
    let direct = '0.00';
    const quantities = {};
    for (const row of sheet.rows.filter(r => r.number > cfg.header)) {
      const rowStart = issues.length,
        values = {};
      for (const [key, col] of Object.entries(mapping)) values[key] = row.cells.find(c => c.column === col)?.value.trim() || '';
      const problem = (key, message) => issue(file, sheet.name, row.number, row.cells.find(c => c.column === mapping[key])?.address || '', message);
      if (row.hidden) problem('code', 'Hidden rows must be made visible and reviewed.');
      for (const cell of row.cells) {
        if (cell.formula || /^[=+@]/.test(cell.value.trim())) issue(file, sheet.name, row.number, cell.address, 'Formula cells are quarantined even when a cached value exists. Supply reviewed values.');
        if (cell.error) issue(file, sheet.name, row.number, cell.address, 'Cell contains an error or unsupported value type.');
        if (cell.hidden) issue(file, sheet.name, row.number, cell.address, 'Hidden column contains data.');
        if (!assigned.has(cell.column)) issue(file, sheet.name, row.number, cell.address, 'Populated cell has no column mapping.');
      }
      const code = (values.code || '').toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(code)) problem('code', 'Use a unique BOQ code, up to 30 letters/numbers/full stops/hyphens/underscores.');
      if (codes.has(code)) problem('code', 'BOQ code already exists in the estimate or this batch.');
      codes.add(code);
      if (!values.description || values.description.length > 160) problem('description', 'Description is required, up to 160 characters.');
      if (values.parent || values.group && !['no', 'false', '0', 'لا'].includes(normal(values.group))) problem('parent', 'Parent groups/value caps are not yet verified for intake. Preserve these rows for the controlled parent-cap workflow.');
      if (values.share && !/^0(?:\.0+)?$/.test(values.share)) problem('share', 'Parent shares must use the verified parent-cap workflow.');
      const unitName = normal(values.unit).replace('m²', 'm2').replace('m³', 'm3');
      const matches = units.filter(u => [u.id, u.name, ...(u.id === 'unit' ? ['units'] : [])].some(v => normal(v) === unitName));
      const unit = matches.length === 1 ? matches[0].id : null;
      if (!unit) problem('unit', `Unknown or ambiguous unit “${values.unit || ''}”. Use a catalogue unit.`);
      const productMatches = values.product ? products.filter(p => normal(p.code) === normal(values.product)) : products.filter(p => p.id === cfg.default_product);
      const product = productMatches.length === 1 && productMatches[0].active ? productMatches[0] : null;
      if (!product) problem('product', 'Choose an active company product reference or an explicit default.');else if (unit && product.uom !== unit) problem('unit', `Product ${product.code} uses ${product.uom}; no unit conversion is inferred.`);
      const costMatches = values.cost_code ? costs.filter(c => normal(c.code) === normal(values.cost_code)) : costs.filter(c => c.id === cfg.default_cost_code),
        cost = costMatches.length === 1 ? costMatches[0] : null;
      if (!cost) problem('cost_code', 'Choose a cost code in this company or an explicit default.');
      let quantity, rate;
      try {
        quantity = numeric(values.quantity, 'Quantity per building');
      } catch (e) {
        problem('quantity', e.message);
      }
      try {
        rate = numeric(values.direct_rate || '', 'Direct unit cost', !Object.hasOwn(mapping, 'direct_rate'));
      } catch (e) {
        problem('direct_rate', e.message);
      }
      let amount = null;
      if (quantity !== undefined && rate !== undefined) {
        amount = estimateRatio([quantity, String(estimate.buildings), rate]);
        direct = money(sum([direct, amount]));
        if (unit) quantities[unit] = new D(quantities[unit] || '0').plus(new D(quantity).times(estimate.buildings)).toString();
      }
      if (issues.length === rowStart) imported.push({
        file_id: file.id,
        filename: file.filename,
        source_sheet: sheet.name,
        source_row: row.number,
        source_cells: row.cells,
        cost_snapshot: cost,
        line: {
          key: 'BI-' + intakeDigest([file.id, sheet.name, row.number]).slice(0, 24),
          code,
          description: values.description,
          kind: 'item',
          parent_key: null,
          cost_code_id: cost.id,
          unit,
          quantity,
          mode: 'direct',
          direct_rate: rate,
          item_markup: '0',
          secondary_unit: null,
          conversion: '0',
          product_id: product.id,
          product_snapshot: JSON.stringify(product)
        },
        direct: amount
      });
    }
    if (!sheet.rows.some(r => r.number > cfg.header)) issue(file, sheet.name, null, '', 'This selection has no BOQ rows.');
    if (expected !== null && new D(expected).cmp(direct) !== 0) issue(file, sheet.name, null, '', `Expected ${expected} ${estimate.currency}; calculated ${direct}. Difference ${new D(direct).minus(expected).toFixed(2)}.`);
    fileResults.push({
      id: file.id,
      filename: file.filename,
      sheet: sheet.name,
      header: cfg.header,
      expected,
      direct,
      difference: expected === null ? null : new D(direct).minus(expected).toFixed(2),
      quantities,
      rows: sheet.rows.filter(r => r.number > cfg.header).length,
      accepted_rows: imported.length - startRows,
      issue_count: issues.length - startIssues,
      excluded_sheets: parsed.sheets.filter(s => s !== sheet).map(s => s.name),
      preamble_rows: sheet.rows.filter(r => r.number < cfg.header).length
    });
  }
  if (estimate.lines.length + imported.length > 200) issue(null, '', null, '', 'Combined estimate exceeds 200 BOQ rows. Split the estimate scope deliberately before importing.');
  if (!imported.length) issue(null, '', null, '', 'No valid items are available to append.');
  let calculation = null;
  if (!issues.length) try {
    calculation = calculateEstimate(estimate, [...estimate.lines, ...imported.map(r => r.line)].map((l, position) => ({
      ...l,
      position
    })), estimate.resources, estimate.overrides);
    for (const key of ['budget', 'selling', 'company_budget', 'company_selling']) if (new D(calculation.totals[key]).gt('999999999999.99')) throw new Error('Resulting estimate exceeds supported amounts.');
  } catch (e) {
    issue(null, '', null, '', e.message);
  }
  return {
    files: fileResults,
    issues,
    rows: imported,
    calculation,
    currency: estimate.currency,
    buildings: estimate.buildings,
    estimate_version: estimate.version,
    existing_rows: estimate.lines.length,
    findings: [issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'} block the entire intake. Nothing has been added to the estimate.` : `${imported.length} items in ${files.length} file${files.length === 1 ? '' : 's'} reconcile. Independent intake review is required before adding them.`, `Quantities are per building × ${estimate.buildings}. Direct totals exclude indirect costs and markups; all rates are ${estimate.currency}.`, `The estimate currently has ${estimate.lines.length} rows. This intake appends items and retains existing assemblies and building exceptions.`]
  };
}
