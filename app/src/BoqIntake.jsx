import { useEffect, useRef, useState } from 'react';
import { UploadSimple, CheckCircle, ArrowRight, Download } from '@phosphor-icons/react';
import { BOQ_COLUMNS } from '../shared/boq-intake.mjs';
import './boq-intake.css';
import { boqCsv as csv, boqIntakeCsv as issueExport } from './boq-intake-export.js';
const field = (label, node) => <label className='field' key={label}><span>{label}</span>{node}</label>;
const amount = (n, c) => `${c} ${Number(n).toLocaleString('en', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;
const letter = n => {
  let s = '';
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
};
const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const readFile = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error('Could not read ' + file.name));
  r.onload = () => resolve({
    filename: file.name,
    base64: String(r.result).split(',')[1]
  });
  r.readAsDataURL(file);
});
export default function BoqIntake({
  estimate,
  api,
  preview,
  onApplied
}) {
  const [list, setList] = useState([]),
    [options, setOptions] = useState(null),
    [batch, setBatch] = useState(null),
    [configs, setConfigs] = useState([]),
    [upload, setUpload] = useState(false),
    [files, setFiles] = useState([]),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [oldCheck, setOldCheck] = useState(null);
  const detailTop = useRef(null);
  useEffect(() => {
    if (batch) detailTop.current?.scrollIntoView({
      block: 'start'
    });
  }, [batch?.id, batch?.current_check_id]);
  const query = `company=${encodeURIComponent(estimate.company_id)}&project=${encodeURIComponent(estimate.project_id || '')}`;
  const reload = async () => {
    const [o, l] = await Promise.all([api('/boq-intakes/options/' + estimate.id), api('/boq-intakes?' + query)]);
    setOptions(o);
    setList(l.filter(b => b.estimate_id === estimate.id));
  };
  useEffect(() => {
    let live = true;
    Promise.all([api('/boq-intakes/options/' + estimate.id), api('/boq-intakes?' + query)]).then(([o, l]) => {
      if (live) {
        setOptions(o);
        setList(l.filter(b => b.estimate_id === estimate.id));
      }
    }).catch(e => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [estimate.id]);
  const select = b => {
    setBatch(b);
    setConfigs(b.configs);
    setReason('');
    setConfirmed(false);
    setOldCheck(null);
    setUpload(false);
  };
  const work = async (fn, applied = false) => {
    setBusy(true);
    setError('');
    try {
      select(await fn());
      await reload();
      if (applied) await onApplied();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setConfig = (id, k, v) => setConfigs(configs.map(c => c.file_id === id ? {
    ...c,
    [k]: v
  } : c));
  const open = id => work(() => api('/boq-intakes/' + id));
  const sample = invalid => {
    const p = options.products[0],
      cc = options.cost_codes[0];
    if (!p || !cc) return;
    download(`Builder-ERP-BOQ-${invalid ? 'unit-error' : 'example'}.csv`, csv([['Code', 'Description', 'Quantity', 'Unit cost', 'Unit', 'Cost code', 'Product'], ['IMPORT-01', 'Fictional work item — replace before use', '2', '12.50', invalid ? 'unknown-unit' : p.uom, cc.code, p.code], ['IMPORT-02', 'Second fictional item', '3', '10', p.uom, cc.code, p.code]]));
  };
  const changed = batch?.result && JSON.stringify(configs) !== JSON.stringify(batch.configs);
  return <section className='record-section boq-intake'><div className='section-head'><div><h3>BOQ workbook intake</h3><p className='muted'>Upload → Check → Independent review → Add to draft</p></div>{!preview && estimate.can_edit && <button className='secondary' onClick={() => {
        setUpload(!upload);
        setBatch(null);
        setError('');
        setReason('');
      }}><UploadSimple />Upload BOQ</button>}</div>
  <p>Keep workbook rows separate until every file reconciles. Quantities are <strong>per building × {estimate.buildings}</strong>; rates are in <strong>{estimate.currency}</strong>.</p>
  {error && <p className='error' role='alert'>{error}</p>}
  {options && <details className='boq-help'><summary>File format & examples</summary><p>Use XLSX or UTF-8 comma-separated CSV. Up to 5 files, 2 MiB each and 6 MiB combined. Each file selects one sheet; headings must be within its first 20 rows. The resulting estimate supports 200 BOQ rows.</p><p>Required columns: Code, Description, Quantity, Unit. Add Unit cost, Cost code and Product reference. Product and cost code can use explicit defaults. A missing Unit cost column means zero cost. Blank rate cells in an existing column require correction.</p><p>Formula cells, unknown columns, parent caps/shares, merged or hidden data need a reviewed source copy. Assemblies and building exceptions already in the estimate are retained. Use a new estimate revision before changing approved work.</p><div className='inline-actions'><button className='secondary' onClick={() => sample(false)}>Download working example</button><button className='secondary' onClick={() => sample(true)}>Download unit-error example</button></div><p className='muted'>Both examples contain two fictional items. Expected direct total: {amount(String(55 * estimate.buildings), estimate.currency)}. Change their codes if already present. Check the product and unit before use.</p></details>}
  {upload && !preview && <form className='boq-upload' onSubmit={e => {
      e.preventDefault();
      work(async () => api('/boq-intakes/upload', {
        estimate_id: estimate.id,
        estimate_version: estimate.version,
        files: await Promise.all(files.map(readFile)),
        reason
      }));
    }}>
    {field('BOQ files', <input type='file' accept='.xlsx,.csv' multiple required onChange={e => {
        const f = [...e.target.files];
        if (f.length > 5 || f.some(x => x.size > 2 * 1024 * 1024) || f.reduce((n, x) => n + x.size, 0) > 6 * 1024 * 1024) {
          setError('Choose up to five files within the size limits.');
          setFiles([]);
          e.target.value = '';
        } else {
          setFiles(f);
          setError('');
        }
      }} />)}
    {field('Upload note', <textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder='Source revision and scope of these files' />)}<button className='primary' disabled={busy || !files.length || !reason.trim()}><UploadSimple />{busy ? 'Reading files…' : 'Upload for checking'}</button>
  </form>}
  {!!list.length && <div className='boq-batches'>{list.map(b => <button className={'boq-batch ' + (batch?.id === b.id ? 'selected' : '')} key={b.id} onClick={() => open(b.id)}><strong>{b.file_names.join(' · ')}</strong><span>{b.state_label} · {b.file_count} file(s){b.issue_count ? ` · ${b.issue_count} issues` : ''}{b.stale ? ' · Estimate changed' : ''}</span><ArrowRight /></button>)}</div>}
  {!list.length && !upload && <p className='muted'>No intake yet. Upload a workbook or try an example.</p>}
  {batch && options && <div className='boq-detail' ref={detailTop}><div className='section-head'><div><p className='eyebrow'>{batch.id} · {batch.state_label}</p><h4>{batch.state === 'committed' ? 'Rows added to the draft' : batch.result?.issues.length ? 'Correct the source or mapping' : batch.state === 'reviewed' ? 'Ready to add reviewed rows' : 'Check the selected files'}</h4></div><button className='text-button' onClick={() => setBatch(null)}>Close intake</button></div>
    {batch.stale && <p className='error'>The estimate changed after this check. Run a fresh check and obtain review again.</p>}
    {batch.result && <div className='estimate-findings'><h4>Saved check findings</h4>{batch.result.findings.map(f => <p key={f}>{f}</p>)}{batch.state === 'committed' && <p><CheckCircle />Added once to estimate version {batch.committed_version}. Later edits remain in estimate history.</p>}<button className='secondary' onClick={() => download(`Builder-ERP-${batch.id}-findings.csv`, issueExport(batch))}><Download />Export findings & issues</button></div>}
    {batch.files.map(f => {
        const c = configs.find(c => c.file_id === f.id),
          s = f.sheets.find(s => s.name === c.sheet),
          header = s?.headings.find(r => r.number === c.header),
          editable = batch.can_check && !preview;
        return <details key={f.id} className='boq-file' open={!batch.result}><summary>{f.filename} · {c.sheet} · Header row {c.header}</summary><div className='inline-actions'><a className='text-button' href={'/api/boq-files/' + f.id} download>Download original</a><small>{Math.ceil(f.size / 1024)} KiB · SHA-256 {f.sha256}</small></div><fieldset disabled={!editable || busy} className='boq-map'><div className='form-grid'>{field('Worksheet', <select value={c.sheet} onChange={e => {
                setConfigs(configs.map(x => x.file_id === f.id ? {
                  ...x,
                  sheet: e.target.value,
                  header: 1,
                  mapping: {}
                } : x));
              }}>{f.sheets.map(s => <option key={s.name} value={s.name}>{s.name} · {s.rows} populated rows{s.hidden ? ' · hidden' : ''}</option>)}</select>)}{field('Header row', <input type='number' min='1' max='20' value={c.header} onChange={e => setConfig(f.id, 'header', Number(e.target.value))} />)}{field(`Expected direct total · ${estimate.currency}`, <input inputMode='decimal' value={c.expected_total} onChange={e => setConfig(f.id, 'expected_total', e.target.value)} placeholder='Enter the checked total, including 0' />)}</div><p className='muted'>Compare the file’s own reviewed total with quantity × {estimate.buildings} buildings × unit cost. No indirect costs or selling markups.</p><details><summary>Review column mapping · {Object.keys(c.mapping).length} matched</summary><div className='boq-column-grid'>{Object.entries(BOQ_COLUMNS).map(([key, labels]) => field(labels[0], <select key={key} value={c.mapping[key] ?? ''} onChange={e => {
                  const mapping = {
                    ...c.mapping
                  };
                  if (e.target.value === '') delete mapping[key];else mapping[key] = Number(e.target.value);
                  setConfig(f.id, 'mapping', mapping);
                }}><option value=''>Not mapped</option>{header?.cells.map(cell => <option key={cell.column} value={cell.column}>{letter(cell.column)} · {cell.value}</option>)}</select>))}</div></details><details><summary>Defaults when a reference is blank</summary><div className='form-grid'>{field('Default product', <select value={c.default_product} onChange={e => setConfig(f.id, 'default_product', e.target.value)}><option value=''>Use the workbook reference</option>{options.products.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name} · {p.uom}</option>)}</select>)}{field('Default cost code', <select value={c.default_cost_code} onChange={e => setConfig(f.id, 'default_cost_code', e.target.value)}><option value=''>Use the workbook reference</option>{options.cost_codes.map(cc => <option key={cc.id} value={cc.id}>{cc.code} · {cc.name}</option>)}</select>)}</div></details></fieldset></details>;
      })}
    {changed && <p role='status' className='muted'>Mapping changed. Run the check again to replace the preview and clear any previous review.</p>}
    {batch.result && <>{!!batch.result.issues.length && <div className='table-wrap'><table className='data-table boq-issues'><caption>Rows and files to correct · Nothing is partially imported</caption><thead><tr><th>Source</th><th>Correction needed</th></tr></thead><tbody>{batch.result.issues.map((i, n) => <tr key={n}><td>{i.filename}<small>{i.sheet} {i.row ? `· row ${i.row}` : ''} {i.cell && `· ${i.cell}`}</small></td><td>{i.message}</td></tr>)}</tbody></table></div>}<div className='table-wrap'><table className='data-table'><caption>File reconciliation · {batch.result.currency}</caption><thead><tr><th>File / sheet</th><th>Rows</th><th>Expected direct</th><th>Calculated direct</th><th>Difference</th><th>Selection</th></tr></thead><tbody>{batch.result.files.map(f => <tr key={f.id}><td>{f.filename}<small>{f.sheet}</small></td><td>{f.rows} · {f.issue_count} issues</td><td>{f.expected ?? 'Missing'}</td><td>{f.direct}</td><td>{f.difference ?? 'Unchecked'}</td><td>{f.preamble_rows} preamble rows; other sheets: {f.excluded_sheets.join(', ') || 'none'}<small>{Object.entries(f.quantities).map(([unit, q]) => `${q} ${unit}`).join(' · ')}</small></td></tr>)}</tbody></table></div>

    {!!batch.result.rows.length && <details><summary>Valid candidate items · {batch.result.rows.length}</summary><div className='table-wrap'><table className='data-table'><thead><tr><th>Source</th><th>Work item</th><th>Quantity per building</th><th>Direct unit cost</th><th>Total direct</th></tr></thead><tbody>{batch.result.rows.map(r => <tr key={r.line.key}><td>{r.filename}<small>{r.source_sheet} · row {r.source_row}</small></td><td>{r.line.code} · {r.line.description}<small>{JSON.parse(r.line.product_snapshot).code} · {r.cost_snapshot.code}</small></td><td>{r.line.quantity} {r.line.unit}</td><td>{r.line.direct_rate}</td><td>{r.direct}</td></tr>)}</tbody></table></div></details>}
    {batch.result.calculation && <div className='boq-impact'><h4>Resulting estimate after adding these rows</h4><p>Estimated cost <strong>{amount(batch.result.calculation.totals.budget, batch.result.currency)}</strong> · Selling <strong>{amount(batch.result.calculation.totals.selling, batch.result.currency)}</strong></p><p className='muted'>The fixed indirect pool is redistributed across all items by direct cost. No budget is released and no estimate approval is implied.</p></div>}</>}
    {!preview && (batch.can_check || batch.can_cancel || batch.can_review || batch.can_return || batch.can_commit) && <div className='boq-next'>{field('Reason for this action', <textarea rows={2} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder='What was checked or needs correcting?' />)}{batch.can_review && <label className='boq-confirm'><input type='checkbox' checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reconciled each selected file, its columns, excluded sheets/preamble and expected direct total.</label>}<div className='inline-actions'>{batch.can_check && <><button className='primary' disabled={busy || !reason.trim()} onClick={() => work(() => api(`/boq-intakes/${batch.id}/check`, {
              version: batch.version,
              configs,
              reason
            }))}>Check all files</button></>}{batch.can_cancel && <button className='text-button' disabled={busy || !reason.trim()} onClick={() => work(() => api(`/boq-intakes/${batch.id}/decision`, {
            version: batch.version,
            action: 'cancel',
            reason
          }))}>Cancel intake</button>}{batch.can_review && <button className='primary' disabled={busy || !confirmed || !reason.trim()} onClick={() => work(() => api(`/boq-intakes/${batch.id}/decision`, {
            version: batch.version,
            action: 'review',
            confirmed,
            reason
          }))}>Approve intake for draft</button>}{batch.can_return && <button className='secondary' disabled={busy || !reason.trim()} onClick={() => work(() => api(`/boq-intakes/${batch.id}/decision`, {
            version: batch.version,
            action: 'return',
            reason
          }))}>Request corrections</button>}{batch.can_commit && <button className='primary' disabled={busy || changed || !reason.trim()} onClick={() => work(() => api(`/boq-intakes/${batch.id}/commit`, {
            version: batch.version,
            reason
          }), true)}>Add all reviewed rows to draft</button>}</div></div>}
    {batch.state === 'checked' && !batch.result.issues.length && !batch.can_review && <p className='muted'>Next: another tender reviewer checks the intake. Estimate approval remains a separate step.</p>}
    <details><summary>Intake history · {batch.history.length}</summary>{batch.history.map(h => <div className='estimate-history' key={h.id}><strong>{h.action} · {h.actor}</strong><p>{h.reason}</p><small>{new Date(h.at).toLocaleString()}</small>{h.check_id && <button className='text-button' onClick={async () => {
            try {
              setOldCheck(await api(`/boq-intakes/${batch.id}/checks/${h.check_id}`));
            } catch (e) {
              setError(e.message);
            }
          }}>View saved check</button>}</div>)}{oldCheck && <div className='estimate-findings'><h4>Saved check · Estimate version {oldCheck.estimate_version}</h4>{oldCheck.result.findings.map(f => <p key={f}>{f}</p>)}{oldCheck.result.issues.map((i, n) => <p key={n}>{i.filename} · {i.sheet} · {i.row} · {i.message}</p>)}<button className='text-button' onClick={() => setOldCheck(null)}>Close saved check</button></div>}</details>
  </div>}
  </section>;
}
