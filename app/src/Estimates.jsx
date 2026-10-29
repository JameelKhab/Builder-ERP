import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Download, CheckCircle } from '@phosphor-icons/react';
import { api } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
import { calculateEstimate } from '../server/estimates-calculation.mjs';
import { estimateRegisterCsv, estimateDetailCsv } from './estimates-export.js';
import './ledger.css';
import './estimates.css';
const cash = (v, c) => `${c} ${Number(v || 0).toLocaleString('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;
const field = (label, node) => <label className='field' key={label}>{label}{node}</label>;
const download = (name, value) => {
  const url = URL.createObjectURL(new Blob([value], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const line = o => ({
  key: crypto.randomUUID(),
  code: '',
  description: '',
  kind: 'item',
  parent_key: null,
  cost_code_id: o.cost_codes[0]?.id || '',
  unit: 'm3',
  quantity: '1',
  mode: 'direct',
  direct_rate: '0',
  item_markup: '0',
  secondary_unit: null,
  conversion: '0'
});
const fresh = (o, p) => ({
  company_id: o.company.id,
  project_id: p || null,
  customer_id: '',
  title: '',
  tender_reference: '',
  due: o.today,
  currency: o.company.currency,
  rate: '1',
  rate_date: o.today,
  rate_source: 'Functional currency · rate 1',
  buildings: 1,
  indirect_pool: '0',
  overhead: '0',
  profit: '0',
  header_markup: '0',
  basis: '',
  exclusions: '',
  lines: [line(o)],
  resources: [],
  overrides: [],
  reason: ''
});
function Totals({
  calculation,
  currency
}) {
  return <div className='estimate-totals'>{[['Estimated cost', 'budget'], ['Selling before tax', 'selling'], ['Estimated margin', 'margin']].map(([label, key]) => <div key={key}><span>{label}</span><strong>{cash(calculation.totals[key], currency)}</strong>{key === 'budget' && <small>Includes {cash(calculation.totals.indirect, currency)} indirect</small>}{key === 'margin' && <small>{calculation.totals.margin_percent ?? '—'}% of selling</small>}</div>)}</div>;
}
function EstimateForm({
  record,
  options,
  project,
  onSave,
  onCancel,
  busy
}) {
  const [f, setF] = useState(() => record ? {
      ...record,
      reason: ''
    } : fresh(options, project)),
    [active, setActive] = useState(record?.lines[0]?.key || f.lines[0]?.key || null);
  const change = (key, value) => setF(f => ({
    ...f,
    [key]: value
  }));
  const patchLine = (key, patch) => setF(f => ({
    ...f,
    lines: f.lines.map(l => l.key === key ? {
      ...l,
      ...patch
    } : l)
  }));
  const patchResource = (key, patch) => setF(f => ({
    ...f,
    resources: f.resources.map(r => r.key === key ? {
      ...r,
      ...patch
    } : r)
  }));
  const selected = f.lines.find(l => l.key === active);
  let calc;
  try {
    calc = calculateEstimate(f, f.lines, f.resources, f.overrides);
  } catch {}
  const units = (value, change, empty = false) => <select value={value || ''} onChange={e => change(e.target.value)}>{empty && <option value=''>No secondary unit</option>}{options.units.map(u => <option key={u.id} value={u.id}>{u.name} · {u.id}</option>)}</select>;
  const numeric = (value, change, required = true) => <input required={required} inputMode='decimal' value={value} onChange={e => change(e.target.value)} />;
  const currencies = (value, change, disabled = false) => <select disabled={disabled} value={value} onChange={e => change(e.target.value)}>{options.currencies.map(c => <option key={c}>{c}</option>)}</select>;
  return <form className='estimate-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><div className='section-head'><div><p className='eyebrow'>{record ? 'REVISE DRAFT' : 'NEW ESTIMATE'}</p><h2>{record ? record.title : 'Build a clear, reviewable estimate'}</h2><p className='muted'>Start with the work items. Open one item to price its resources or adjust building quantities.</p></div></div>
 <section className='record-section'><h3>1. Tender & pricing basis</h3><div className='estimate-fields'>
 {field('Estimate title', <input required maxLength={160} value={f.title} onChange={e => change('title', e.target.value)} />)}
 {field('Customer', <select required value={f.customer_id} onChange={e => change('customer_id', e.target.value)}><option value=''>Choose company customer</option>{options.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
 {field('Tender reference', <input required value={f.tender_reference} onChange={e => change('tender_reference', e.target.value)} />)}
 {field('Tender deadline', <input required type='date' value={f.due} onChange={e => change('due', e.target.value)} />)}
 {field('Project scope', <select disabled={!!record || !!project} value={f.project_id || ''} onChange={e => change('project_id', e.target.value || null)}>{options.can_create_company && <option value=''>Pre-project · company study</option>}{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
 {field('Repeated buildings', <input required type='number' min='1' max='1000' step='1' value={f.buildings} onChange={e => change('buildings', Number(e.target.value))} />)}
 {field('Estimate currency', currencies(f.currency, v => change('currency', v), !!record))}
 {field(`1 ${f.currency} in ${options.company.currency}`, numeric(f.rate, v => change('rate', v)))}
 {field('Exchange-rate date', <input required type='date' max={options.today} value={f.rate_date} onChange={e => change('rate_date', e.target.value)} />)}
 {field('Exchange-rate source', <input required value={f.rate_source} onChange={e => change('rate_source', e.target.value)} />)}
 </div>{!options.customers.length && <p className='notice'>Add an active customer in Contacts & catalogue before saving an estimate.</p>}
 <div className='estimate-fields'>{field(`Indirect cost pool · ${f.currency}`, numeric(f.indirect_pool, v => change('indirect_pool', v)))}{field('Overhead %', numeric(f.overhead, v => change('overhead', v)))}{field('Profit %', numeric(f.profit, v => change('profit', v)))}{field('Header markup %', numeric(f.header_markup, v => change('header_markup', v)))}</div>
 {field('Basis & assumptions', <textarea required rows={3} value={f.basis} onChange={e => change('basis', e.target.value)} />)}
 <details><summary>Exclusions and pricing explanation</summary>{field('Exclusions', <textarea rows={2} value={f.exclusions} onChange={e => change('exclusions', e.target.value)} />)}<p className='muted'>Direct cost + proportional indirect → overhead → profit → item markup → header markup. Selling values exclude tax. All rates are explicit snapshots.</p></details></section>
 <section className='record-section'><div className='section-head'><div><h3>2. Work breakdown & quantities</h3><p className='muted'>Summary groups organise work without adding their totals twice.</p></div><button type='button' className='secondary' onClick={() => {
          const l = line(options);
          change('lines', [...f.lines, l]);
          setActive(l.key);
        }}><Plus />Add item</button></div>
 <div className='table-wrap'><table className='data-table'><thead><tr><th>Code / work</th><th>Type</th><th>Per building</th><th>Cost</th><th /></tr></thead><tbody>{f.lines.map(l => <tr key={l.key}><td><strong>{l.code || 'New item'}</strong><small>{l.description || 'Add description'}</small></td><td>{l.kind === 'group' ? 'Summary' : l.mode === 'assembly' ? 'Assembly' : 'Unit rate'}</td><td>{l.kind === 'item' ? `${l.quantity} ${l.unit}` : '—'}</td><td>{calc ? cash(calc.rows.find(r => r.key === l.key)?.budget, f.currency) : '—'}</td><td><button type='button' className='text-button' aria-expanded={active === l.key} onClick={() => setActive(active === l.key ? null : l.key)}>Edit {l.code || 'item'}</button></td></tr>)}</tbody></table></div>
 {selected && <div className='estimate-line-editor'><div className='section-head'><h3>{selected.code || 'New work item'}</h3><button type='button' className='text-button' onClick={() => setActive(null)}>Done with item</button></div><div className='estimate-fields'>
 {field('BOQ code', <input required value={selected.code} onChange={e => patchLine(selected.key, {
            code: e.target.value
          })} />)}
 {field('Description', <input required value={selected.description} onChange={e => patchLine(selected.key, {
            description: e.target.value
          })} />)}
 {field('Row type', <select value={selected.kind} onChange={e => {
            const group = e.target.value === 'group';
            patchLine(selected.key, {
              kind: e.target.value,
              ...(group ? {
                mode: 'direct',
                quantity: '0',
                direct_rate: '0',
                item_markup: '0',
                unit: 'lump'
              } : {})
            });
            if (group) setF(f => ({
              ...f,
              resources: f.resources.filter(r => r.line_key !== selected.key),
              overrides: f.overrides.filter(v => v.line_key !== selected.key)
            }));
          }}><option value='item'>Priced work item</option><option value='group'>Summary group</option></select>)}
 {field('Parent group', <select value={selected.parent_key || ''} onChange={e => patchLine(selected.key, {
            parent_key: e.target.value || null
          })}><option value=''>Top level</option>{f.lines.filter(l => l.kind === 'group' && l.key !== selected.key).map(l => <option key={l.key} value={l.key}>{l.code} · {l.description}</option>)}</select>)}
 {field('Cost code', <select required value={selected.cost_code_id} onChange={e => patchLine(selected.key, {
            cost_code_id: e.target.value
          })}>{options.cost_codes.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select>)}
 {selected.kind === 'item' && <>{field('Primary unit', units(selected.unit, v => patchLine(selected.key, {
              unit: v
            })))}{field('Default quantity per building', numeric(selected.quantity, v => patchLine(selected.key, {
              quantity: v
            })))}{field('Item markup %', numeric(selected.item_markup, v => patchLine(selected.key, {
              item_markup: v
            })))}
 {field('Cost build-up', <select value={selected.mode} onChange={e => {
              patchLine(selected.key, {
                mode: e.target.value,
                direct_rate: '0'
              });
              setF(f => ({
                ...f,
                resources: f.resources.filter(r => r.line_key !== selected.key)
              }));
            }}><option value='direct'>Direct cost per primary unit</option><option value='assembly'>Resource assembly</option></select>)}
 {selected.mode === 'direct' && field(`Direct unit cost · ${f.currency}`, numeric(selected.direct_rate, v => patchLine(selected.key, {
              direct_rate: v
            })))}
 </>}
 </div>{selected.kind === 'item' && <>
 {selected.mode === 'assembly' && <div><h4>Resources per {selected.unit}</h4><p className='muted'>Consumption is per primary unit. Price basis states how many resource units the quoted rate buys.</p>{f.resources.filter(r => r.line_key === selected.key).map(r => <fieldset className='estimate-resource' key={r.key}><legend>{r.description || 'Resource component'}</legend><div className='estimate-fields'>
 {field('Resource description', <input required value={r.description} onChange={e => patchResource(r.key, {
                  description: e.target.value
                })} />)}
 {field('Resource type', <select value={r.kind} onChange={e => patchResource(r.key, {
                  kind: e.target.value
                })}>{['material', 'labour', 'plant', 'subcontract', 'other'].map(k => <option key={k}>{k}</option>)}</select>)}
 {field('Resource unit', units(r.unit, v => patchResource(r.key, {
                  unit: v
                })))}
 {field('Consumption per primary unit', numeric(r.consumption, v => patchResource(r.key, {
                  consumption: v
                })))}
 {field('Quoted rate', numeric(r.unit_rate, v => patchResource(r.key, {
                  unit_rate: v
                })))}
 {field('Price basis · resource units', numeric(r.price_basis, v => patchResource(r.key, {
                  price_basis: v
                })))}
 {field('Quote currency', currencies(r.currency, v => patchResource(r.key, {
                  currency: v
                })))}
 {field(`1 ${r.currency} in ${f.currency}`, numeric(r.rate, v => patchResource(r.key, {
                  rate: v
                })))}
 {field('Rate evidence date', <input required type='date' max={options.today} value={r.rate_date} onChange={e => patchResource(r.key, {
                  rate_date: e.target.value
                })} />)}
 {field('Rate evidence source', <input required value={r.rate_source} onChange={e => patchResource(r.key, {
                  rate_source: e.target.value
                })} />)}
 </div><button type='button' className='text-button' onClick={() => change('resources', f.resources.filter(x => x.key !== r.key))}>Remove component from draft</button></fieldset>)}
 <button type='button' className='secondary' onClick={() => change('resources', [...f.resources, {
              key: crypto.randomUUID(),
              line_key: selected.key,
              kind: 'material',
              description: '',
              unit: 'unit',
              consumption: '1',
              unit_rate: '0',
              price_basis: '1',
              currency: f.currency,
              rate: '1',
              rate_date: options.today,
              rate_source: 'Same currency · rate 1'
            }])}><Plus />Add resource</button></div>}
 <details className='estimate-variants'><summary>Building exceptions · {f.overrides.filter(v => v.line_key === selected.key).length}</summary><p>Each exception replaces the default quantity for one building. Use zero for an omitted item.</p>{f.overrides.map((v, i) => v.line_key === selected.key && <div className='estimate-override' key={i}>{field('Building number', <input required type='number' min='1' max={f.buildings} value={v.building} onChange={e => change('overrides', f.overrides.map((x, j) => j === i ? {
                ...x,
                building: Number(e.target.value)
              } : x))} />)}{field('Replacement quantity', numeric(v.quantity, n => change('overrides', f.overrides.map((x, j) => j === i ? {
                ...x,
                quantity: n
              } : x))))}{field('Exception reason', <input required value={v.reason} onChange={e => change('overrides', f.overrides.map((x, j) => j === i ? {
                ...x,
                reason: e.target.value
              } : x))} />)}<button type='button' className='text-button' onClick={() => change('overrides', f.overrides.filter((_, j) => i !== j))}>Remove exception</button></div>)}<button type='button' className='secondary' onClick={() => change('overrides', [...f.overrides, {
              line_key: selected.key,
              building: f.buildings,
              quantity: selected.quantity,
              reason: ''
            }])}>Add building exception</button></details>
 <details><summary>Secondary quantity · optional</summary><div className='estimate-fields'>{field('Secondary unit', units(selected.secondary_unit, v => patchLine(selected.key, {
                secondary_unit: v || null
              }), true))}{selected.secondary_unit && field('Secondary units per primary unit', numeric(selected.conversion, v => patchLine(selected.key, {
                conversion: v
              })))}</div><p className='muted'>A quantity explanation only. Resource consumption already includes the required cost conversion.</p></details>
 </>}
 <button type='button' className='text-button' disabled={f.lines.some(l => l.parent_key === selected.key)} onClick={() => {
          setF(f => ({
            ...f,
            lines: f.lines.filter(l => l.key !== selected.key),
            resources: f.resources.filter(r => r.line_key !== selected.key),
            overrides: f.overrides.filter(v => v.line_key !== selected.key)
          }));
          setActive(null);
        }}>Remove this draft row{f.lines.some(l => l.parent_key === selected.key) ? ' · move children first' : ''}</button></div>}
 </section>
 <section className='record-section'><h3>3. Review & save</h3>{calc ? <Totals calculation={calc} currency={f.currency} /> : <p className='muted'>Complete valid numeric values to preview totals.</p>}{field('Reason for this draft / revision', <textarea required minLength={3} rows={2} value={f.reason} onChange={e => change('reason', e.target.value)} />)}<p className='muted'>Saving keeps this estimate in draft. Independent approval is a separate step.</p><div className='inline-actions'><button disabled={busy} className='primary'>{busy ? 'Saving…' : 'Save estimate draft'}</button><button type='button' className='secondary' onClick={onCancel}>Cancel editing</button></div></section>
 </form>;
}
function HandoverForm({
  record,
  options,
  onSubmit,
  onCancel,
  busy
}) {
  const [project, setProject] = useState({
      code: '',
      name: record.title,
      location: '',
      manager_id: options.managers[0]?.id || '',
      planned_start: options.today,
      planned_end: '2027-12-31',
      description: ''
    }),
    [reason, setReason] = useState('');
  return <form className='record-section' onSubmit={e => {
    e.preventDefault();
    onSubmit({
      version: record.version,
      project,
      reason
    });
  }}><h3>Create project setup from this estimate</h3><p>Copies the approved work breakdown and building locations. The baseline uses estimated cost and starts in draft with <strong>zero released spending capacity</strong>.</p>{!record.project_id ? <div className='estimate-fields'>{[['Project code', 'code'], ['Project name', 'name'], ['Site location', 'location']].map(([label, key]) => field(label, <input required value={project[key]} onChange={e => setProject({
        ...project,
        [key]: e.target.value
      })} />))}{field('Project manager', <select required value={project.manager_id} onChange={e => setProject({
        ...project,
        manager_id: e.target.value
      })}><option value=''>Choose manager</option>{options.managers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>)}{[['Planned start', 'planned_start'], ['Planned completion', 'planned_end']].map(([label, key]) => field(label, <input required type='date' value={project[key]} onChange={e => setProject({
        ...project,
        [key]: e.target.value
      })} />))}</div> : <p>The attached project must be empty and have no approved baseline.</p>}{field('Handover basis', <textarea required value={reason} onChange={e => setReason(e.target.value)} />)}<p className='muted'>Client acceptance, sales quotation and contract terms are separate. This action does not sign a contract or approve a budget.</p><div className='inline-actions'><button disabled={busy} className='primary'>Create project & draft baseline</button><button type='button' className='secondary' onClick={onCancel}>Cancel</button></div></form>;
}
export default function Estimates({
  company,
  preview = false,
  initialRecord,
  onChanged,
  onOpen
}) {
  const [options, setOptions] = useState(null),
    [report, setReport] = useState(null),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(false),
    [project, setProject] = useState(''),
    [state, setState] = useState('all'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [showHandover, setShowHandover] = useState(false),
    [comparison, setComparison] = useState(null),
    [saved, setSaved] = useState('');
  const workspaceTop = useRef(null);
  useEffect(() => {
    if (selected || editing) workspaceTop.current?.scrollIntoView({
      block: 'start'
    });
  }, [selected?.id, selected?.version, editing]);
  const query = `company=${encodeURIComponent(company.id)}&project=${encodeURIComponent(project)}`;
  const load = () => Promise.all([api('/estimates/options?' + query), api('/estimates/report?' + query + '&state=' + state)]).then(([o, r]) => {
    setOptions(o);
    setReport(r);
  });
  useEffect(() => {
    let live = true;
    Promise.all([api('/estimates/options?' + query), api('/estimates/report?' + query + '&state=' + state)]).then(([o, r]) => {
      if (live) {
        setOptions(o);
        setReport(r);
      }
    }).catch(e => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [company.id, project, state]);
  const open = async id => {
    setError('');
    setComparison(null);
    setReason('');
    setShowHandover(false);
    setEditing(false);
    try {
      setSelected(await api('/estimates/documents/' + id));
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (initialRecord) open(initialRecord);
  }, [initialRecord]);
  const perform = async (fn, message) => {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      setSelected(r);
      setEditing(false);
      setShowHandover(false);
      setReason('');
      setSaved(message);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const decide = action => perform(() => api(`/estimates/documents/${selected.id}/decision`, {
    action,
    version: selected.version,
    reason
  }), action === 'approve' ? 'Estimate approved and locked. Budget release remains separate.' : 'Estimate decision recorded.');
  if (!options || !report) return <><ErrorBox message={error} /><p role='status'>Loading estimates…</p></>;
  const back = () => {
    setSelected(null);
    setEditing(false);
    setComparison(null);
    setSaved('');
    setError('');
  };
  return <div className='estimate-workspace' ref={workspaceTop}><ErrorBox message={error} />{saved && <p className='success' role='status'><CheckCircle />{saved}</p>}{editing ? <><button className='back' onClick={() => setEditing(false)}><ArrowLeft />Back to estimate</button><EstimateForm key={selected?.id || 'new'} record={selected} options={options} project={project} busy={busy} onCancel={() => setEditing(false)} onSave={f => perform(() => api('/estimates/documents' + (selected ? '/' + selected.id : ''), f, selected ? 'PUT' : 'POST'), 'Draft saved. Check the calculated amounts before submitting.')} /></> : selected ? <>
 <button className='back' onClick={back}><ArrowLeft />All estimates</button><div className='section-head'><div><p className='eyebrow'>{selected.id} · REVISION {selected.revision} · {selected.state_label}</p><h2>{selected.title}</h2><p className='muted'>{selected.customer.name} · {selected.tender_reference} · Due {selected.due}</p></div><button className='secondary' onClick={() => download(`Builder-ERP-${selected.id}-r${selected.revision}.csv`, estimateDetailCsv(selected))}><Download />Export study</button></div>
 <Totals calculation={selected.calculation} currency={selected.currency} />
 <section className='estimate-findings'><h3>Study findings</h3>{selected.calculation.findings.map(f => <p key={f}>{f}</p>)}<small>Prepared by {selected.author}{selected.approver ? ` · Approved by ${selected.approver}` : ''}. {selected.currency} 1 = {selected.company_currency} {selected.rate} · {selected.rate_date}.</small></section>
 <div className='inline-actions'>{!preview && selected.can_edit && <button className='primary' onClick={() => {
          setEditing(true);
          setSaved('');
        }}>Edit estimate</button>}{!preview && selected.can_handover && <button className='primary' onClick={() => setShowHandover(!showHandover)}>Create project setup</button>}</div>
 {selected.handover_blocker && <p className='muted'>{selected.handover_blocker}</p>}{showHandover && <HandoverForm record={selected} options={options} busy={busy} onCancel={() => setShowHandover(false)} onSubmit={v => perform(() => api(`/estimates/documents/${selected.id}/handover`, v), 'Project setup and draft baseline created. Released capacity remains zero.')} />}
 {selected.handover && <section className='record-section'><h3>Project handover recorded</h3><p>{selected.handover.project_id} · Draft baseline {selected.handover.budget_id}. Independent budget approval and spending release are still required.</p>{selected.handover.can_open_budget && <button className='secondary' onClick={() => onOpen?.(selected.handover.budget_id)}>Open baseline</button>}<p className='muted'>No client acceptance or contract was inferred from this estimate.</p></section>}
 <section className='record-section'><h3>Work breakdown</h3><p className='muted'>Open an item for its resource calculations, building exceptions and quantity basis.</p><div className='table-wrap'><table className='data-table'><thead><tr><th>Work item</th><th>Quantity</th><th>Direct cost</th><th>Indirect</th><th>Estimated cost</th><th>Selling</th></tr></thead><tbody>{selected.calculation.rows.map(l => <tr key={l.key} className={l.kind === 'group' ? 'estimate-group' : ''}><td>{l.kind === 'group' ? <strong>{l.code} · {l.description}</strong> : <details><summary>{l.code} · {l.description}</summary><div className='estimate-line-detail'><p>Default {l.quantity} {l.unit} × {selected.buildings} buildings; final quantity {l.total_quantity} {l.unit}.</p>{l.secondary_unit && <p>Secondary quantity {l.secondary_quantity} {l.secondary_unit} · factor {l.conversion}.</p>}<p>Item markup {l.item_markup}%; selling rate {l.selling_rate} {selected.currency}/{l.unit}.</p>{l.mode === 'direct' ? <p>Direct unit cost {l.direct_rate} {selected.currency}.</p> : l.resources.map(r => <div className='estimate-component' key={r.key}><strong>{r.description} · {r.kind}</strong><p>{r.consumption} {r.unit} per {l.unit} × {l.total_quantity} {l.unit}; quoted {r.unit_rate} {r.currency} per {r.price_basis} {r.unit}.</p><p>FX {r.rate} to {selected.currency} · {r.rate_date} · {r.rate_source}. Extended cost {cash(r.amount, selected.currency)}.</p></div>)}{l.overrides.map(v => <p key={v.building}>Building {v.building}: {v.quantity} {l.unit} replaces {l.quantity}. {v.reason}</p>)}</div></details>}</td><td>{l.kind === 'item' ? `${l.total_quantity} ${l.unit}` : 'Summary'}</td><td>{cash(l.direct, selected.currency)}</td><td>{cash(l.indirect, selected.currency)}</td><td>{cash(l.budget, selected.currency)}</td><td>{cash(l.selling, selected.currency)}</td></tr>)}</tbody></table></div></section>
 <details className='record-section'><summary>Pricing basis, assumptions & exclusions</summary><p>{selected.basis}</p><p>{selected.exclusions || 'No exclusions recorded.'}</p><p>Direct + proportional indirect → {selected.overhead}% overhead → {selected.profit}% profit → item markup → {selected.header_markup}% header markup. Values exclude tax.</p><p>Company currency estimated cost {cash(selected.calculation.totals.company_budget, selected.company_currency)}. FX source: {selected.rate_source}.</p><p className='muted'>Parent-cap/share allocation and workbook intake remain separate implementation requirements.</p></details>
 {!preview && (selected.can_edit || selected.can_review || selected.can_withdraw || selected.can_revise) && <section className='record-section'><h3>Next step</h3>{field('Decision / revision reason', <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />)}<div className='inline-actions'>{selected.can_edit && <><button className='primary' disabled={busy || !reason.trim()} onClick={() => decide('submit')}>Submit for independent review</button><button className='secondary' disabled={busy || !reason.trim()} onClick={() => decide('cancel')}>Cancel draft</button></>}{selected.can_review && <><button className='primary' disabled={busy || !reason.trim()} onClick={() => decide('approve')}>Approve & lock study</button><button className='secondary' disabled={busy || !reason.trim()} onClick={() => decide('return')}>Request changes</button></>}{selected.can_withdraw && <button className='secondary' disabled={busy || !reason.trim()} onClick={() => decide('withdraw')}>Withdraw for editing</button>}{selected.can_revise && <button className='primary' disabled={busy || !reason.trim()} onClick={() => perform(() => api(`/estimates/documents/${selected.id}/revision`, {
            version: selected.version,
            reason
          }), 'New revision created. The earlier approval remains unchanged.')}>Create new revision</button>}</div></section>}
 <details className='record-section'><summary>Revisions & comparison · {selected.revisions.length}</summary><div className='estimate-revisions'>{selected.revisions.map(r => <div key={r.id}><button className='text-button' onClick={() => open(r.id)}>Revision {r.revision} · {r.state}</button>{r.id !== selected.id && <button className='secondary' onClick={async () => {
              try {
                setComparison(await api(`/estimates/documents/${selected.id}/compare?from=${r.id}`));
              } catch (e) {
                setError(e.message);
              }
            }}>Compare with current view</button>}</div>)}</div>{comparison && <div><h4>Revision {comparison.from} → {comparison.to}</h4>{comparison.findings.map(f => <p key={f}>{f}</p>)}<p>Estimated cost change {cash(comparison.budget_delta, comparison.currency)}; selling change {cash(comparison.selling_delta, comparison.currency)}.</p><div className='table-wrap'><table className='data-table'><thead><tr><th>Item</th><th>Change</th><th>Quantity before → after</th><th>Cost change</th><th>Selling change</th></tr></thead><tbody>{comparison.rows.map(r => <tr key={r.key}><td>{r.code} · {r.description}</td><td>{r.change}<small>{r.cause}</small></td><td>{r.old_quantity} → {r.quantity}</td><td>{cash(r.budget_delta, comparison.currency)}</td><td>{cash(r.selling_delta, comparison.currency)}</td></tr>)}</tbody></table></div></div>}</details>
 <details className='record-section'><summary>Decision history · {selected.history.length}</summary>{selected.history.map(e => <div className='estimate-history' key={e.id}><strong>{e.action} · {e.actor}</strong><p>{e.reason}</p><small>{new Date(e.at).toLocaleString()}</small></div>)}</details>
 </> : <>
 <div className='section-head'><div><p className='eyebrow'>TENDERS</p><h2>Estimates & BOQ</h2><p className='muted'>Price the work. Review the assumptions. Keep every approved revision.</p></div>{!preview && options.can_create && <button className='primary' onClick={() => {
          setSelected(null);
          setEditing(true);
          setSaved('');
        }}><Plus />New estimate</button>}</div>
 <div className='estimate-filters'>{field('Scope', <select value={project} onChange={e => setProject(e.target.value)}><option value=''>Authorised company scope</option>{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}{field('Study status', <select value={state} onChange={e => setState(e.target.value)}>{[['all', 'All statuses'], ['draft', 'Draft'], ['submitted', 'Needs approval'], ['returned', 'Changes requested'], ['approved', 'Approved'], ['cancelled', 'Cancelled']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>)}<button className='secondary' onClick={() => download('Builder-ERP-estimate-register.csv', estimateRegisterCsv(report))}><Download />Export findings</button></div>
 <section className='estimate-findings'><h3>Register findings</h3>{report.findings.map(f => <p key={f}>{f}</p>)}</section>
 {report.rows.length ? <div className='estimate-register'>{report.rows.map(r => <button className='estimate-card' key={r.id} onClick={() => open(r.id)}><div><span className={'estimate-state ' + r.state}>{r.state_label} · Revision {r.revision}</span><h3>{r.title}</h3><p>{r.customer} · {r.project || 'Pre-project study'}</p><small>{r.tender_reference} · Due {r.due}</small></div><div className='estimate-card-value'><span>Estimated cost</span><strong>{cash(r.totals.budget, r.currency)}</strong><small>Selling {cash(r.totals.selling, r.currency)}</small></div><ArrowRight size={22} /></button>)}</div> : <Empty>No estimates match this authorised scope and status.</Empty>}
 <p className='footnote muted'>Latest revision of each study. Opportunities, workbook intake, parent-cap allocation and sales quotations remain separate requirements; earlier examples are retained below.</p>
 </>}</div>;
}
