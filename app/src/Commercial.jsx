import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Plus, CheckCircle } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { ErrorBox } from './components.jsx';
import { commercialReportCsv, commercialDetailCsv } from './commercial-export.js';
import './estimates.css';
import './commercial.css';
const field = (label, node) => <label className='field' key={label}>{label}{node}</label>;
const download = (filename, value) => {
  const url = URL.createObjectURL(new Blob([value], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const date = () => new Date().toISOString().slice(0, 10);
function OfferForm({
  record,
  options,
  busy,
  onSave,
  onCancel,
  revision = false,
  initialEstimate
}) {
  const [f, set] = useState(() => record ? {
    ...record,
    reason: '',
    estimate_id: record.estimate_id
  } : {
    estimate_id: initialEstimate || '',
    title: '',
    offered_on: date(),
    valid_until: '',
    payment_days: 30,
    retention_percent: '0',
    retention_cap: '0',
    advance_ceiling: '0',
    recovery_percent: '0',
    terms: '',
    basis: '',
    exclusions: '',
    reason: ''
  });
  const update = (k, v) => set(x => ({
    ...x,
    [k]: v
  }));
  const choose = id => {
    const e = options.estimates.find(e => e.id === id);
    set(x => ({
      ...x,
      estimate_id: id,
      title: e?.title || '',
      basis: e?.basis || '',
      exclusions: e?.exclusions || ''
    }));
  };
  useEffect(() => {
    if (initialEstimate && !record) choose(initialEstimate);
  }, []);
  const num = k => <input required inputMode='decimal' value={f[k]} onChange={e => update(k, e.target.value)} />;
  return <form className='offer-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><div className='section-head'><div><p className='eyebrow'>{revision ? 'NEW OFFER REVISION' : record ? 'EDIT DRAFT' : 'PREPARE AN OFFER'}</p><h2>Scope first. Clear terms next.</h2><p className='muted'>Selling values come from the approved estimate. This draft stays local.</p></div></div>
 <section className='record-section'><h3>1. Approved scope</h3>{(!record || revision) && field('Approved estimate', <select required value={f.estimate_id} onChange={e => choose(e.target.value)}><option value=''>Choose a reviewed study</option>{options.estimates.filter(e => !record || e.study_id === record.study_id).map(e => <option key={e.id} value={e.id}>{e.title} · revision {e.revision}</option>)}</select>)}{record && !revision && <p>Source {record.estimate_id} · {amount(record.net_amount, record.currency)} before tax</p>}{field('Offer title', <input required value={f.title} onChange={e => update('title', e.target.value)} />)}{field('Included scope', <textarea required rows={3} value={f.basis} onChange={e => update('basis', e.target.value)} />)}{field('Exclusions', <textarea rows={2} value={f.exclusions} onChange={e => update('exclusions', e.target.value)} />)}</section>
 <section className='record-section'><h3>2. Dates & payment</h3><div className='estimate-fields'>{field('Offer date', <input required type='date' value={f.offered_on} onChange={e => update('offered_on', e.target.value)} />)}{field('Valid through', <input required type='date' value={f.valid_until} min={f.offered_on} onChange={e => update('valid_until', e.target.value)} />)}{field('Payment days from invoice', <input required type='number' min='0' max='365' value={f.payment_days} onChange={e => update('payment_days', Number(e.target.value))} />)}</div>{field('Commercial terms', <textarea required rows={3} placeholder='Measurement basis, payment conditions and agreed responsibilities…' value={f.terms} onChange={e => update('terms', e.target.value)} />)}</section>
 <section className='record-section'><h3>3. Retention & advance</h3><p className='muted'>Enter agreed ceilings in the offer currency. Use zero when none applies. These fields do not record cash.</p><div className='estimate-fields'>{field('Retention %', num('retention_percent'))}{field('Retention cap', num('retention_cap'))}{field('Advance ceiling', num('advance_ceiling'))}{field('Advance recovery %', num('recovery_percent'))}</div></section>
 <section className='record-section'>{field('Reason for this draft', <textarea required rows={2} value={f.reason} onChange={e => update('reason', e.target.value)} />)}<div className='inline-actions'><button className='primary' disabled={busy}>{busy ? 'Saving…' : revision ? 'Save revised offer' : 'Save offer draft'}</button><button type='button' className='secondary' onClick={onCancel}>Cancel editing</button></div></section></form>;
}
function AcceptanceForm({
  offer,
  options,
  busy,
  onSave,
  onCancel
}) {
  const [f, set] = useState({
      project_id: offer.project_id || '',
      accepted_on: date(),
      reference: '',
      signatory: '',
      description: '',
      reason: '',
      mapping: []
    }),
    [allocation, setAllocation] = useState(null),
    [error, setError] = useState(''),
    [file, setFile] = useState(null);
  const change = (k, v) => set(x => ({
    ...x,
    [k]: v
  }));
  useEffect(() => {
    let live = true;
    setError('');
    setAllocation(null);
    if (f.project_id) api(`/commercial/offers/${offer.id}/allocations?project=${encodeURIComponent(f.project_id)}`).then(a => {
      if (!live) return;
      setAllocation(a);
      change('mapping', offer.lines.map(l => ({
        line_key: l.line_key,
        work_package_id: a.suggested.find(m => m.line_key === l.line_key)?.work_package_id || '',
        location_id: ''
      })));
    }).catch(e => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [f.project_id]);
  const patch = (key, k, v) => change('mapping', f.mapping.map(m => m.line_key === key ? {
    ...m,
    [k]: v
  } : m));
  const submit = async e => {
    e.preventDefault();
    setError('');
    try {
      if (!file || file.size > 2 * 1024 * 1024 || !file.size) throw new Error('Choose one evidence file, up to 2 MiB.');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Unable to read this file.'));
        reader.readAsDataURL(file);
      });
      await onSave({
        ...f,
        filename: file.name,
        base64,
        offer_id: offer.id,
        version: offer.version
      });
    } catch (e) {
      setError(e.message);
    }
  };
  return <form className='record-section acceptance-form' onSubmit={submit}><h3>Record client acceptance</h3><p>Retain evidence of acceptance of <strong>this offer revision</strong>. Another authorised person verifies it before the original contract is created.</p><ErrorBox message={error} /><div className='estimate-fields'>{field('Client acceptance reference', <input required value={f.reference} onChange={e => change('reference', e.target.value)} />)}{field('Client accepted on', <input required type='date' min={offer.approved_on > offer.offered_on ? offer.approved_on : offer.offered_on} max={date() < offer.valid_until ? date() : offer.valid_until} value={f.accepted_on} onChange={e => change('accepted_on', e.target.value)} />)}{field('Client signatory', <input required value={f.signatory} onChange={e => change('signatory', e.target.value)} />)}</div>{field('Evidence file · PDF, image or text · up to 2 MiB', <input required type='file' accept='.pdf,.png,.jpg,.jpeg,.txt' onChange={e => setFile(e.target.files[0] || null)} />)}{field('What the evidence confirms', <textarea required rows={2} value={f.description} onChange={e => change('description', e.target.value)} />)}
 <h4>Project allocation</h4>{field('Contract project', <select required value={f.project_id} disabled={!!offer.project_id} onChange={e => change('project_id', e.target.value)}><option value=''>Choose a project</option>{options.projects.filter(p => p.can_write).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}<p className='muted'>Use the same work breakdown as the project budget. Project setup from the estimate can create this structure first.</p>{allocation && offer.lines.map(l => {
      const m = f.mapping.find(m => m.line_key === l.line_key) || {};
      return <fieldset className='offer-allocation' key={l.line_key}><legend>{l.code} · {l.description}</legend><div className='estimate-fields'>{field('Project work item', <select required value={m.work_package_id || ''} onChange={e => patch(l.line_key, 'work_package_id', e.target.value)}><option value=''>Choose matching work item</option>{allocation.work_items.filter(w => w.cost_code_id === l.cost_code_id).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select>)}{field('Location', <select value={m.location_id || ''} onChange={e => patch(l.line_key, 'location_id', e.target.value)}><option value=''>Project-wide</option>{allocation.locations.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select>)}</div></fieldset>;
    })}{field('Recording reason', <textarea required rows={2} value={f.reason} onChange={e => change('reason', e.target.value)} />)}<div className='inline-actions'><button className='primary' disabled={busy || !allocation}>Submit evidence for verification</button><button type='button' className='secondary' onClick={onCancel}>Cancel</button></div></form>;
}
export default function Commercial({
  company,
  project,
  preview = false,
  initialRecord = null,
  initialEstimate = null,
  onChanged,
  onOpen
}) {
  const [scope, setScope] = useState(project?.id || ''),
    [state, setState] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [options, setOptions] = useState(null),
    [report, setReport] = useState(null),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(false),
    [revision, setRevision] = useState(false),
    [recording, setRecording] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const top = useRef(null);
  const query = new URLSearchParams({
    company: company.id,
    ...(scope ? {
      project: scope
    } : {}),
    state,
    ...(from ? {
      from
    } : {}),
    ...(to ? {
      to
    } : {})
  }).toString();
  const load = () => Promise.all([api('/commercial/options?' + query), api('/commercial/report?' + query)]).then(([o, r]) => {
    setOptions(o);
    setReport(r);
  });
  useEffect(() => {
    let live = true;
    setReport(null);
    Promise.all([api('/commercial/options?' + query), api('/commercial/report?' + query)]).then(([o, r]) => {
      if (live) {
        setOptions(o);
        setReport(r);
        setError('');
      }
    }).catch(e => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [query]);
  const open = async id => {
    setError('');
    setEditing(false);
    setRecording(false);
    setReason('');
    try {
      let r;
      if (id.startsWith('CTR-')) {
        const c = await api('/commercial/contracts/' + id);
        r = await api('/commercial/offers/' + c.offer_id);
      } else r = await api('/commercial/offers/' + id);
      setSelected(r);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (initialRecord) open(initialRecord);else if (initialEstimate) {
      setEditing(true);
      setSelected(null);
    }
  }, [initialRecord, initialEstimate]);
  useEffect(() => {
    top.current?.scrollIntoView({
      block: 'start'
    });
  }, [selected?.id, editing]);
  const perform = async (fn, message) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const r = await fn();
      setSelected(r);
      setEditing(false);
      setRevision(false);
      setRecording(false);
      setReason('');
      setConfirmed(false);
      setSaved(message);
      await load();
      await onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const decision = action => perform(() => api(`/commercial/offers/${selected.id}/decision`, {
    action,
    version: selected.version,
    reason
  }), action === 'approve' ? 'Offer approved internally. Client acceptance is a separate step.' : 'Offer updated.');
  if (!options) return <><ErrorBox message={error} /><p role='status'>Loading quotations & awards…</p></>;
  return <div className='commercial-workspace' ref={top}><ErrorBox message={error} />{saved && <p className='success' role='status'><CheckCircle />{saved}</p>}{editing ? <OfferForm key={(selected?.id || 'new') + revision} record={selected} options={options} busy={busy} revision={revision} initialEstimate={initialEstimate} onCancel={() => {
      setEditing(false);
      setRevision(false);
    }} onSave={f => perform(() => api('/commercial/offers' + (selected ? '/' + selected.id + (revision ? '/revision' : '') : ''), f, selected && !revision ? 'PUT' : 'POST'), 'Offer draft saved for independent review.')} /> : selected ? <>
 <button className='back' onClick={() => {
        setSelected(null);
        setSaved('');
        setError('');
      }}><ArrowLeft />All quotations & awards</button><div className='section-head'><div><p className='eyebrow'>{selected.id} · REVISION {selected.revision}</p><h2>{selected.title}</h2><p className='muted'>{selected.customer.name} · {selected.state_label}</p></div><button className='secondary' onClick={() => download('Builder-ERP-' + selected.id + '.csv', commercialDetailCsv(selected))}><Download />Export record</button></div>
 <div className='offer-overview'><div><span>Offer before tax</span><strong>{amount(selected.net_amount, selected.currency)}</strong><small>{selected.company_currency !== selected.currency ? `${amount(selected.company_amount, selected.company_currency)} at saved rate` : 'Original approved scope'}</small></div><div><span>Valid through</span><strong>{selected.valid_until}</strong><small>Offered {selected.offered_on}</small></div><div><span>Next step</span><strong>{selected.contract ? 'Finance setup' : selected.acceptances.some(a => a.state === 'submitted') ? 'Verify acceptance' : selected.state === 'approved' ? 'Client acceptance' : selected.state === 'submitted' ? 'Commercial review' : selected.state_label}</strong><small>{selected.contract ? 'Original contract preserved' : 'Independent review required'}</small></div></div>
 <section className='estimate-findings'><h3>Record findings</h3>{selected.findings.map(f => <p key={f}>{f}</p>)}</section>
 {!preview && <div className='inline-actions'>{selected.can_edit && <button className='primary' onClick={() => {
          setRevision(false);
          setEditing(true);
        }}>Edit offer</button>}{selected.can_record && <button className='primary' onClick={() => setRecording(!recording)}>Record client acceptance</button>}{selected.can_revise && <button className='secondary' onClick={() => {
          setRevision(true);
          setEditing(true);
        }}>Prepare revised offer</button>}{onOpen && selected.can_open_estimate && <button className='secondary' onClick={() => onOpen(selected.estimate_id)}>Source estimate</button>}</div>}
 {!preview && (selected.can_edit || selected.can_review || selected.can_withdraw) && <section className='record-section'><h3>{selected.can_review ? 'Review commercial terms' : 'Offer decision'}</h3>{field('Decision reason', <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />)}<div className='inline-actions'>{selected.can_edit && <button className='primary' disabled={busy || !reason.trim()} onClick={() => decision('submit')}>Submit for commercial review</button>}{selected.can_review && <><button className='primary' disabled={busy || !reason.trim()} onClick={() => decision('approve')}>Approve offer</button><button className='secondary' disabled={busy || !reason.trim()} onClick={() => decision('return')}>Request changes</button></>}{(selected.can_edit || selected.can_withdraw) && <button className='secondary' disabled={busy || !reason.trim()} onClick={() => decision('withdraw')}>{selected.state === 'submitted' ? 'Withdraw for editing' : 'Withdraw offer'}</button>}</div></section>}
 {recording && !preview && <AcceptanceForm key={selected.id + selected.version} offer={selected} options={options} busy={busy} onCancel={() => setRecording(false)} onSave={f => perform(() => api('/commercial/acceptances', f), 'Acceptance evidence saved. Independent verification is still required.')} />}
 {selected.acceptances.map(a => <section className='record-section' key={a.id}><div className='section-head'><div><p className='eyebrow'>CLIENT ACCEPTANCE · {a.state}</p><h3>{a.reference}</h3><p>{a.signatory} · Accepted {a.accepted_on} · Recorded by {a.recorder}</p></div><a className='secondary' href={'/api/commercial/evidence/' + a.id} download>Download evidence</a></div><p>{a.description}</p>{a.late_recorded && <p className='notice'>Recorded after expiry. Verify that the evidence proves acceptance within the valid offer period.</p>}<details><summary>File identity & work allocations</summary><p className='offer-hash'>{a.filename} · SHA256 {a.sha256}</p>{a.mapping.map(m => <p key={m.line_key}>{selected.lines.find(l => l.line_key === m.line_key)?.code} → {m.work_snapshot.code} · {m.work_snapshot.name} · {m.location_snapshot?.name || 'Project-wide'}</p>)}</details>{!preview && (a.can_verify || a.can_cancel) && <>{field('Acceptance review reason', <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />)}{a.can_verify && <label className='offer-confirm'><input type='checkbox' checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />The evidence supports this exact offer revision, acceptance date and project allocation.</label>}<div className='inline-actions'>{a.can_verify && <><button className='primary' disabled={busy || !confirmed || !reason.trim()} onClick={() => perform(() => api(`/commercial/acceptances/${a.id}/decision`, {
                action: 'verify',
                version: a.version,
                reason,
                confirmed
              }), 'Award verified. Original contract created; finance setup remains separate.')}>Verify & create original contract</button><button className='secondary' disabled={busy || !reason.trim()} onClick={() => perform(() => api(`/commercial/acceptances/${a.id}/decision`, {
                action: 'return',
                version: a.version,
                reason
              }), 'Evidence returned. Record a corrected submission with its own history.')}>Return evidence</button></>}{a.can_cancel && <button className='secondary' disabled={busy || !reason.trim()} onClick={() => perform(() => api(`/commercial/acceptances/${a.id}/decision`, {
              action: 'cancel',
              version: a.version,
              reason
            }), 'Pending acceptance cancelled; evidence retained.')}>Cancel pending acceptance</button>}</div></>}</section>)}
 {selected.contract && <section className='contract-summary'><p className='eyebrow'>{selected.contract.id} · ORIGINAL CONTRACT</p><h3>Scope locked. Finance setup required.</h3><p>{amount(selected.contract.original_value, selected.contract.currency)} before tax · {selected.contract.lines.length} allocated BOQ items.</p><p>Original scope and accepted terms are retained. Measured certificates, tax/control accounts, retention balances and advance settlement require the next finance workflow.</p></section>}
 <section className='record-section'><h3>Offer work items</h3><p className='muted'>Line amounts reconcile exactly to the estimate. Unit rates are displayed for reference; rounded rates do not replace the line amounts.</p><div className='table-wrap'><table className='data-table'><thead><tr><th>Work item</th><th>Quantity</th><th>Unit rate</th><th>Before tax</th></tr></thead><tbody>{selected.lines.map(l => <tr key={l.line_key}><td><strong>{l.code}</strong><br />{l.description}</td><td>{l.quantity} {l.unit}</td><td>{l.unit_price}</td><td>{amount(l.amount, selected.currency)}</td></tr>)}</tbody></table></div></section>
 <details className='record-section'><summary>Scope, terms & currency evidence</summary><h4>Included scope</h4><p className='offer-prose'>{selected.basis}</p><h4>Exclusions</h4><p className='offer-prose'>{selected.exclusions || 'None recorded.'}</p><h4>Commercial terms</h4><p className='offer-prose'>{selected.terms}</p><p>Payment: {selected.payment_days} days from invoice date. Retention: {selected.retention_percent}%, cap {amount(selected.retention_cap, selected.currency)}. Advance ceiling: {amount(selected.advance_ceiling, selected.currency)}; recovery {selected.recovery_percent}%.</p><p>{selected.currency} 1 = {selected.company_currency} {selected.rate} · {selected.rate_date} · {selected.rate_source}</p><p>{selected.legal_company.legal_name || selected.legal_company.name} · {selected.legal_company.registration || 'Registration not recorded'}</p></details>
 <details className='record-section'><summary>Revisions & decision history</summary><div className='inline-actions'>{selected.revisions.map(r => <button className='secondary' key={r.id} onClick={() => open(r.id)}>Revision {r.revision} · {r.state}</button>)}</div>{selected.history.map(h => <div className='estimate-history' key={h.id}><strong>{h.action} · {h.actor}</strong><p>{h.reason}</p><small>{h.at}</small></div>)}</details>
 </> : <><div className='section-head'><div><p className='eyebrow'>COMMERCIAL WORK</p><h2>Quotations & awards</h2><p className='muted'>Approved scope → clear offer → evidenced acceptance → original contract.</p></div><div className='inline-actions'><button className='secondary' disabled={!report} onClick={() => report && download('Builder-ERP-Offers-and-Awards.csv', commercialReportCsv(report))}><Download />Export findings</button>{!preview && options.can_create && <button className='primary' onClick={() => {
            setSelected(null);
            setRevision(false);
            setEditing(true);
            setSaved('');
          }}><Plus />Prepare offer</button>}</div></div>
 <div className='offer-filters'>{!project && field('Report project', <select value={scope} onChange={e => setScope(e.target.value)}><option value=''>All authorised company records</option>{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}{field('Offer state', <select value={state} onChange={e => setState(e.target.value)}>{['all', 'draft', 'submitted', 'returned', 'approved', 'awarded', 'withdrawn'].map(s => <option key={s} value={s}>{{
              all: 'All states',
              draft: 'Draft offers',
              submitted: 'Commercial review',
              returned: 'Changes requested',
              approved: 'Approved offers',
              awarded: 'Awarded contracts',
              withdrawn: 'Withdrawn'
            }[s]}</option>)}</select>)}{field('Offer date from', <input type='date' value={from} onChange={e => setFrom(e.target.value)} />)}{field('Offer date to', <input type='date' value={to} onChange={e => setTo(e.target.value)} />)}</div>
 {report && <section className='estimate-findings'><h3>Report findings</h3>{report.findings.map(f => <p key={f}>{f}</p>)}<small>As of {report.as_of} · {company.name} · Tax excluded · Saved exchange rates</small></section>}
 {!report && !error && <p role='status'>Updating report findings…</p>}<div className='offer-register'>{(report?.rows || []).map(r => <button key={r.id} className='offer-card' onClick={() => open(r.id)}><span><small>{r.id} · REV {r.revision}</small><strong>{r.title}</strong><span>{r.customer}</span></span><span><strong>{amount(r.net_amount, r.currency)}</strong><span>{r.state_label}</span><small>Valid through {r.valid_until}</small></span><ArrowRight size={20} /></button>)}</div>{report && !report.rows.length && <p className='notice'>No offers match this scope. Prepare one from a current approved estimate.</p>}</>}</div>;
}
