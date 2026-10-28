import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, ArrowRight, Buildings, MapPin, TreeStructure, CheckCircle } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
import './foundations.css';
const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  children,
  required = true,
  ...rest
}) => <label className="field">{label}{children ? <select value={value || ''} onChange={e => onChange(e.target.value)} required={required} {...rest}>{children}</select> : type === 'textarea' ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} required={required} {...rest} /> : <input value={value ?? ''} onChange={e => onChange(e.target.value)} onInput={type === 'date' ? e => onChange(e.target.value) : undefined} type={type} required={required} {...rest} />}</label>;
const Options = ({
  rows,
  prompt = 'Choose…'
}) => <><option value="">{prompt}</option>{rows.map(r => <option value={r.id} key={r.id}>{r.code ? r.code + ' · ' : ''}{r.name}</option>)}</>;
const labels = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  returned: 'Returned',
  approved: 'Approved',
  cancelled: 'Cancelled'
};
const History = ({
  rows = []
}) => <details className="foundation-history"><summary>History & evidence · {rows.length} events</summary>{rows.map(e => <div key={e.id}><strong>{e.action} · {e.actor}</strong><small>{new Date(e.at).toLocaleString()} · version {e.version}</small><p>{e.reason}</p><details><summary>Recorded values</summary><pre>{JSON.stringify({
          before: e.before_json ? JSON.parse(e.before_json) : null,
          after: JSON.parse(e.after_json)
        }, null, 2)}</pre></details></div>)}</details>;
export function Organisation({
  preview = false,
  onChanged
}) {
  const [data, setData] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const load = () => api('/organisation').then(setData);
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);
  const change = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/organisation/companies' + (form.id ? '/' + form.id : ''), form, form.id ? 'PUT' : 'POST');
      setMessage(form.id ? 'Company details updated.' : 'Company created. Assign business access separately in Users & access before using its records.');
      setForm(null);
      await load();
      await onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <><ErrorBox message={error} /><p>Loading companies…</p></>;
  return <div className="foundations"><ErrorBox message={error} />{message && <p className="success" role="status">{message}</p>}{form ? <><button className="back" onClick={() => setForm(null)}><ArrowLeft size={18} />All companies</button><h2>{form.id ? 'Company details' : 'Create a legal company'}</h2><p className="muted">Keep each legal entity and its functional currency distinct.</p><form onSubmit={save}><fieldset disabled={busy || preview}><div className="foundation-form"><Field label="Display name" value={form.name} onChange={v => change('name', v)} /><Field label="Legal name" value={form.legal_name} onChange={v => change('legal_name', v)} /><Field label="Functional currency" value={form.currency} onChange={v => change('currency', v)} disabled={!!form.id}>{data.currencies.map(c => <option key={c}>{c}</option>)}</Field><Field label="Country code" value={form.country_code} onChange={v => change('country_code', v)} required={false} maxLength={2} placeholder="AE" /><Field label="Registration reference" value={form.registration} onChange={v => change('registration', v)} required={false} /></div><p className="notice">Functional currency is fixed after creation. New companies do not grant anyone business access automatically.</p><Field label="Reason" type="textarea" value={form.reason} onChange={v => change('reason', v)} /><button className="primary" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save company' : 'Create company'}</button></fieldset></form></> : <><div className="section-head"><div><p className="eyebrow">ORGANISATION</p><h2>Companies</h2><p className="muted">Legal identities and functional currencies. Business access is assigned separately.</p></div>{!preview && <button className="primary" onClick={() => {
          setMessage('');
          setForm({
            currency: 'AED',
            reason: ''
          });
        }}><Plus size={18} />New company</button>}</div><div className="foundation-cards">{data.companies.map(c => <button className="foundation-card" key={c.id} onClick={() => setForm({
          ...c,
          reason: ''
        })}><Buildings size={24} /><h3>{c.name}</h3><p>{c.legal_name}</p><span>{c.currency} · {c.country_code || 'Country not set'}</span><strong>Company details <ArrowRight size={16} /></strong></button>)}</div><History rows={data.history} /></>}</div>;
}
export function Foundations({
  company,
  project,
  preview = false,
  initial = 'setup',
  initialRecord,
  onChanged
}) {
  const [data, setData] = useState(null),
    [selected, setSelected] = useState(project?.id || ''),
    [view, setView] = useState(initial === 'budget' ? 'budgets' : 'details'),
    [form, setForm] = useState(null),
    [budget, setBudget] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [history, setHistory] = useState(null);
  const load = async () => {
    const d = await api(`/foundations?company=${company.id}${project ? '&project=' + project.id : ''}`);
    setData(d);
    setSelected(s => s && d.projects.some(p => p.id === s) ? s : d.projects[0]?.id || '');
    return d;
  };
  useEffect(() => {
    load().then(async () => {
      if (initialRecord) {
        const d = await api('/budgets/' + initialRecord);
        setBudget(d);
        setSelected(d.project_id);
      }
    }).catch(e => setError(e.message));
  }, [company.id, project?.id, initialRecord]);
  const p = data?.projects.find(x => x.id === selected),
    locs = data?.locations.filter(l => l.project_id === selected) || [],
    works = data?.packages.filter(w => w.project_id === selected) || [],
    docs = data?.budgets.filter(d => d.project_id === selected) || [];
  const change = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  const start = (type, row = {}) => {
    setError('');
    setMessage('');
    setForm({
      type,
      project_id: selected,
      company_id: company.id,
      reason: '',
      ...row
    });
    setBudget(null);
  };
  const changed = async () => {
    await load();
    await onChanged?.();
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const routes = {
          project: 'projects',
          location: 'locations',
          work: 'work-packages',
          costcode: 'cost-codes',
          budget: 'budgets'
        },
        path = '/' + routes[form.type] + (form.id ? '/' + form.id : '');
      const result = await api(path, form, form.id ? 'PUT' : 'POST');
      const type = form.type;
      setForm(null);
      setMessage(type === 'budget' ? 'Draft saved. Review the figures before submitting for independent approval.' : 'Saved. The change and its reason are recorded.');
      await changed();
      if (type === 'project') setSelected(result.id);
      if (type === 'budget') setBudget(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openBudget(d) {
    setError('');
    setReason('');
    try {
      setBudget(await api('/budgets/' + d.id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function decide(action) {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/budgets/${budget.id}/decision`, {
        version: budget.version,
        action,
        reason
      });
      setBudget(r);
      setReason('');
      setMessage(action === 'approve' ? 'Approved. Budget facts and released capacity are now updated.' : `Budget ${action === 'submit' ? 'submitted' : action === 'return' ? 'returned' : 'cancelled'}.`);
      await changed();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const newBudget = () => start('budget', {
    kind: p.budget_status === 'unapproved' ? 'baseline' : 'revision',
    title: p.budget_status === 'unapproved' ? 'Original project budget' : 'Budget revision',
    basis: '',
    lines: works.filter(w => w.kind === 'item').map(w => ({
      work_package_id: w.id,
      proposed_budget: w.position?.revised_budget ?? '0.00',
      proposed_release: w.position?.released_capacity ?? '0.00',
      note: ''
    }))
  });
  const editBudget = () => start('budget', {
    ...budget,
    lines: budget.lines.map(l => ({
      work_package_id: l.work_package_id,
      proposed_budget: l.proposed_budget,
      proposed_release: l.proposed_release,
      note: l.note
    }))
  });
  const heading = <div className="section-head"><div><p className="eyebrow">{company.name} · {company.currency}</p><h2>{initial === 'budget' ? 'Budget control' : 'Project setup'}</h2><p className="muted">{initial === 'budget' ? 'Original baseline, approved changes and buying capacity.' : 'Give every record a clear company, project, location and work item.'}</p></div>{!project && data?.can_create_project && !preview && <button className="primary" onClick={() => start('project', {
      phase: 'Setup',
      planned_start: new Date().toISOString().slice(0, 10),
      provenance: 'Direct award — enter the reference'
    })}><Plus size={18} />New project</button>}</div>;
  if (!data) return <><ErrorBox message={error} /><p>Loading project foundations…</p></>;
  return <div className="foundations"><ErrorBox message={error} />{message && <p className="success" role="status"><CheckCircle size={18} />{message}</p>}{form ? <><button className="back" onClick={() => setForm(null)}><ArrowLeft size={18} />Back to {form.type === 'budget' ? 'budgets' : 'project setup'}</button><h2>{form.type === 'budget' ? form.title : form.id ? 'Edit ' + {
          project: 'project',
          location: 'location',
          work: 'work item / group'
        }[form.type] : 'New ' + {
          project: 'project',
          location: 'location',
          work: 'work item / group',
          costcode: 'cost code'
        }[form.type]}</h2><form onSubmit={save}><fieldset disabled={busy || preview}>
 {form.type === 'project' && <><div className="foundation-form"><Field label="Project name" value={form.name} onChange={v => change('name', v)} /><Field label="Project code" value={form.code} onChange={v => change('code', v)} /><Field label="Site location" value={form.location} onChange={v => change('location', v)} /><Field label="Project manager" value={form.manager_id} onChange={v => change('manager_id', v)}><Options rows={data.managers} /></Field><Field label="Customer / award reference" value={form.customer_reference} onChange={v => change('customer_reference', v)} required={false} /><Field label="Planned start" value={form.planned_start} type="date" onChange={v => change('planned_start', v)} /><Field label="Planned end" value={form.planned_end} type="date" onChange={v => change('planned_end', v)} />{form.id && <Field label="Phase" value={form.phase} onChange={v => change('phase', v)}>{['Setup', 'Mobilisation', 'Delivery'].map(v => <option key={v}>{v}</option>)}</Field>}</div>{!form.id && <Field label="Award / setup basis" value={form.provenance} onChange={v => change('provenance', v)} />}<Field label="Project description" type="textarea" value={form.description} onChange={v => change('description', v)} required={false} /></>}
 {['location', 'work', 'costcode'].includes(form.type) && <><div className="foundation-form"><Field label="Code" value={form.code} onChange={v => change('code', v)} /><Field label="Name" value={form.name} onChange={v => change('name', v)} />{form.type !== 'costcode' && <><Field label={form.type === 'location' ? 'Parent location' : 'Parent group'} value={form.parent_id} onChange={v => change('parent_id', v)} required={false}><Options prompt="Top level" rows={(form.type === 'location' ? locs : works.filter(w => w.kind === 'group')).filter(w => w.id !== form.id)} /></Field><Field label="Type" value={form.kind} onChange={v => change('kind', v)} disabled={form.type === 'work' && !!form.id}><option value="">Choose type</option>{(form.type === 'location' ? ['site', 'building', 'floor', 'unit', 'zone', 'system'] : ['group', 'item']).map(v => <option key={v}>{v}</option>)}</Field></>}{form.type === 'work' && <Field label="Cost code" value={form.cost_code_id} onChange={v => change('cost_code_id', v)}><Options rows={data.cost_codes} /></Field>}</div>{form.type === 'work' && <p className="notice">Groups total their children. Items receive budgets and purchase requests. A new item is released only after its budget is approved.</p>}</>}
 {form.type === 'budget' && <><Field label="Budget title" value={form.title} onChange={v => change('title', v)} /><Field label="Basis of the proposal" type="textarea" value={form.basis} onChange={v => change('basis', v)} placeholder="Explain the scope, estimate or instruction supporting these amounts." /><p className="notice">{form.kind === 'baseline' ? 'The first approved baseline fixes the original budget for every item.' : 'Original budgets stay fixed. This proposal sets new revised targets.'}<small>Released capacity covers new buying. Existing opening commitments remain separate. All figures are in {company.currency}.</small></p><div className="budget-edit-lines">{form.lines.map((l, i) => {
                const w = works.find(w => w.id === l.work_package_id);
                return <section key={l.work_package_id}><div><h3>{w?.code} · {w?.name}</h3><p className="muted">Current budget {amount(w?.position?.revised_budget ?? null, company.currency)} · current release {amount(w?.position?.released_capacity ?? null, company.currency)}</p></div><div className="foundation-form">{[['proposed_budget', 'Proposed revised budget'], ['proposed_release', 'Proposed released capacity'], ['note', 'Line basis']].map(([k, label]) => <Field key={k} label={`${label} · ${w?.code}`} value={l[k]} onChange={v => setForm(f => ({
                      ...f,
                      lines: f.lines.map((r, n) => n === i ? {
                        ...r,
                        [k]: v
                      } : r)
                    }))} inputMode={k === 'note' ? undefined : 'decimal'} required={k !== 'note'} />)}</div>{form.kind === 'revision' && form.lines.length > 1 && <button type="button" className="text-button" onClick={() => setForm(f => ({
                    ...f,
                    lines: f.lines.filter((_, n) => n !== i)
                  }))}>Leave this item unchanged</button>}</section>;
              })}</div></>}
 {form.type !== 'budget' && <Field label="Reason for the change" type="textarea" value={form.reason} onChange={v => change('reason', v)} />}<div className="inline-actions spaced"><button className="primary" disabled={busy || form.type === 'budget' && !form.lines.length}>{busy ? 'Saving…' : form.type === 'budget' ? 'Save draft for review' : 'Save'}</button><button type="button" className="secondary" onClick={() => setForm(null)}>Cancel</button></div></fieldset></form></> : budget ? <><button className="back" onClick={() => setBudget(null)}><ArrowLeft size={18} />All budgets</button><div className="section-head"><div><p className="eyebrow">{budget.id} · VERSION {budget.version} · {labels[budget.state]}</p><h2>{budget.title}</h2><p className="muted">{budget.kind === 'baseline' ? 'Original baseline' : 'Revision'} · {budget.author} · {budget.currency}</p></div>{budget.can_edit && !preview && <button className="secondary" onClick={editBudget}>Edit / refresh draft</button>}</div><p className="foundation-basis">{budget.basis}</p><div className="foundation-next"><strong>Next step</strong><p>{budget.state === 'draft' ? 'Review the proposed amounts, then submit for independent approval.' : budget.state === 'submitted' ? 'A reviewer with separate budget authority must decide. The author cannot approve this proposal.' : budget.state === 'returned' ? 'Edit and save a refreshed draft. Current balances and project budget version will be checked again.' : budget.state === 'approved' ? `Approved by ${budget.approver}. Changes are retained as immutable budget facts.` : 'This proposal is cancelled. It did not change the budget.'}</p></div><div className="foundation-table"><table><thead><tr><th>Work item</th><th>Original</th><th>Before this proposal</th><th>{budget.state === 'approved' ? 'Approved revised' : 'Proposed revised'}</th><th>Released capacity</th></tr></thead><tbody>{budget.lines.map(l => <tr key={l.id}><td data-label="Work item"><strong>{l.code}</strong><small>{l.name}</small>{l.note && <small>{l.note}</small>}</td><td data-label="Original">{amount(l.snapshot.original_budget, budget.currency)}</td><td data-label="Before this proposal">{amount(l.snapshot.revised_budget, budget.currency)}</td><td data-label={budget.state === 'approved' ? 'Approved revised' : 'Proposed revised'}>{amount(l.proposed_budget, budget.currency)}</td><td data-label="Released capacity">{amount(l.snapshot.released_capacity, budget.currency)} → {amount(l.proposed_release, budget.currency)}</td></tr>)}</tbody></table></div><p className="muted">Approval amount: {amount(budget.approval_amount, budget.currency)} · Your budget authority: {amount(budget.approval_limit, budget.currency)}. Offsetting increases and reductions do not cancel out for authority checks.</p>{!preview && (budget.can_edit || budget.can_review || budget.can_cancel) && <fieldset disabled={busy}><Field label="Decision reason" value={reason} onChange={setReason} type="textarea" /><div className="inline-actions">{budget.can_edit && budget.state === 'draft' && <button className="primary" disabled={!reason.trim()} onClick={() => decide('submit')}>Submit for independent review</button>}{budget.can_review && <><button className="primary" disabled={!reason.trim()} onClick={() => decide('approve')}>Approve budget</button><button className="secondary" disabled={!reason.trim()} onClick={() => decide('return')}>Return with reason</button></>}{budget.can_cancel && <button className="text-button" disabled={!reason.trim()} onClick={() => decide('cancel')}>Cancel proposal</button>}</div></fieldset>}<History rows={budget.history} /></> : <>{heading}{!project && <Field label="Project" value={selected} onChange={v => {
        setSelected(v);
        setHistory(null);
      }}><Options rows={data.projects} prompt="Select a project" /></Field>}{p ? <><div className="foundation-context"><strong>{p.code} · {p.name}</strong><span>{p.location} · {p.phase} · {p.budget_status === 'unapproved' ? 'Original budget needed' : p.budget_status === 'opening' ? 'Illustrative opening budget' : 'Approved baseline'} · budget revision {p.budget_revision}</span></div>{initial !== 'budget' && <div className="foundation-nav" aria-label="Project setup sections">{[['details', 'Project details'], ['locations', 'Locations'], ['work', 'Work packages'], ...(p.can_budget ? [['budgets', 'Budgets']] : [])].map(([v, label]) => <button key={v} className={view === v ? 'active' : ''} onClick={() => {
            setView(v);
            setHistory(null);
          }}>{label}</button>)}</div>}
 {view === 'details' && <><div className="foundation-details"><div><span>Accountable manager</span><strong>{p.manager_name || 'Not set'}</strong></div><div><span>Customer / award reference</span><strong>{p.customer_reference || 'Not set'}</strong></div><div><span>Planned dates</span><strong>{p.planned_start || 'Not set'} → {p.planned_end || 'Not set'}</strong></div><div><span>Setup basis</span><strong>{p.provenance}</strong></div></div>{p.description && <p>{p.description}</p>}{p.can_manage && !preview && <button className="secondary" onClick={() => start('project', p)}>Edit project details</button>}<div className="foundation-steps"><button onClick={() => setView('locations')}><MapPin size={22} /><strong>{locs.length} locations</strong><span>Site, building, floor, unit or system</span><ArrowRight size={18} /></button><button onClick={() => setView('work')}><TreeStructure size={22} /><strong>{works.filter(w => w.kind === 'item').length} work items</strong><span>Structure the scope once; use it throughout delivery</span><ArrowRight size={18} /></button>{p.can_budget && <button onClick={() => setView('budgets')}><CheckCircle size={22} /><strong>{docs.length} budget proposals</strong><span>Baseline, revisions and release for buying</span><ArrowRight size={18} /></button>}</div>{p.can_manage && <><button className="text-button" onClick={async () => {
              try {
                setHistory(await api(`/projects/${p.id}/history`));
              } catch (e) {
                setError(e.message);
              }
            }}>View setup history</button>{history && <History rows={history} />}</>}</>}
 {view === 'locations' && <><div className="section-head"><div><h3>Locations</h3><p className="muted">Stable locations link site work, deliveries, defects and records.</p></div>{p.can_locations && !preview && <button className="secondary" onClick={() => start('location', {
              kind: 'zone'
            })}><Plus size={17} />Add location</button>}</div><div className="foundation-list">{locs.map(l => <div key={l.id}><div className="hierarchy-item" style={{
                paddingLeft: Math.min(l.depth || 0, 4) * 16
              }}><strong>{l.code} · {l.name}</strong><small>{l.kind} · {locs.find(x => x.id === l.parent_id)?.name || 'Top level'}</small></div>{p.can_locations && !preview && <button className="text-button" onClick={() => start('location', l)}>Edit</button>}</div>)}</div></>}
 {view === 'work' && <><div className="section-head"><div><h3>Work packages</h3><p className="muted">Groups total their items. Only items can receive budgets and purchases.</p></div>{p.can_wbs && !preview && <button className="secondary" onClick={() => start('work', {
              kind: 'item',
              cost_code_id: data.cost_codes[0]?.id
            })}><Plus size={17} />Add work item / group</button>}</div><div className="foundation-table"><table><thead><tr><th>Work package</th><th>Structure</th><th>Release</th>{p.can_budget && <><th>Revised budget</th><th>Available for new buying</th></>}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{works.map(w => <tr key={w.id}><td data-label="Work package" style={{
                    paddingLeft: 13 + Math.min(w.depth || 0, 4) * 16
                  }}><strong>{w.code} · {w.name}</strong><small>{w.cost_code} · {w.cost_code_name}</small></td><td data-label="Structure">{w.kind} · {works.find(x => x.id === w.parent_id)?.name || 'Top level'}</td><td data-label="Release">{w.kind === 'group' ? 'Child rollup' : w.release_state === 'released' ? 'Released' : 'Needs budget approval'}</td>{p.can_budget && <><td data-label="Revised budget">{amount(w.position.revised_budget, company.currency)}</td><td data-label="Available for new buying">{amount(w.position.available, company.currency)}</td></>}<td>{p.can_wbs && !preview && <button className="text-button" onClick={() => start('work', w)}>Edit</button>}</td></tr>)}</tbody></table></div>{!works.length && <Empty>Add a work item, then prepare its original budget.</Empty>}{p.can_wbs && data.can_create_cost_code && !preview && <button className="text-button" onClick={() => start('costcode')}>Add company cost code</button>}</>}
 {view === 'budgets' && p.can_budget && <><div className="section-head"><div><h3>Budget proposals</h3><p className="muted">{docs.filter(d => d.state === 'submitted').length} awaiting independent review · {docs.filter(d => d.state === 'approved').length} approved</p></div>{p.can_prepare_budget && !preview && <button className="primary" disabled={!works.some(w => w.kind === 'item')} onClick={newBudget}><Plus size={18} />{p.budget_status === 'unapproved' ? 'Prepare original budget' : 'Propose revision'}</button>}</div><p className="notice">Original budget, revised budget and available buying capacity are different controls. A proposal changes nothing until independently approved.</p><div className="foundation-list">{docs.map(d => <button className="budget-row" key={d.id} onClick={() => openBudget(d)}><span><strong>{d.title}</strong><small>{d.id} · {d.author} · {d.lines.length} work items</small></span><span>{labels[d.state]}<small>{amount(d.approval_amount, company.currency)} approval amount</small></span><ArrowRight size={18} /></button>)}</div>{!docs.length && <Empty>{p.budget_status === 'opening' ? 'Existing values are illustrative opening balances. No local budget proposal has been recorded.' : 'Start with an original budget covering every work item.'}</Empty>}</>}
 </> : <Empty>No projects in this scope. A company-wide project manager can create one.</Empty>}</>}</div>;
}
