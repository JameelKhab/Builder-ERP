import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Plus } from '@phosphor-icons/react';
import { api, amount, numberText } from './api.js';
import { ErrorBox } from './components.jsx';
import { certificatesReportCsv, certificateDetailCsv } from './certificates-export.js';
import './estimates.css';
import './commercial.css';
import './certificates.css';
const today = () => new Date().toISOString().slice(0, 10);
const field = (name, child) => <label className='field'>{name}{child}</label>;
const saveCsv = (name, contents) => {
  const url = URL.createObjectURL(new Blob([contents], {
      type: 'text/csv;charset=utf-8'
    })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Findings({
  items
}) {
  return <div className='certificate-findings'><h3>What this tells you</h3><ul>{items.map((f, i) => <li key={i}>{f}</li>)}</ul></div>;
}
function History({
  rows
}) {
  return <details className='record-section'><summary>Review history · {rows.length} events</summary>{rows.map(h => <div className='certificate-history' key={h.id}><strong>{h.action}</strong><span>{h.actor} · {h.at.slice(0, 16).replace('T', ' ')}</span><p>{h.reason}</p></div>)}</details>;
}
function Measures({
  lines,
  currency,
  edit,
  onChange
}) {
  return <div className='table-scroll'><table className='certificate-table'><thead><tr><th>Work item</th><th>Contract</th><th>Previous</th><th>Cumulative installed</th>{!edit && <><th>This period</th><th>Remaining</th><th>Current gross</th></>}</tr></thead><tbody>{lines.map(l => <tr key={l.line_key}><td><strong>{l.code}</strong><span>{l.description}</span><small>{l.work_package}{l.location ? ' · ' + l.location : ''}</small></td><td>{numberText(l.quantity)} {l.unit}</td><td>{numberText(l.previous_quantity || '0')}</td><td>{edit ? <input aria-label={`Cumulative installed · ${l.code}`} required inputMode='decimal' value={l.cumulative_quantity} onChange={e => onChange(l.line_key, e.target.value)} /> : numberText(l.cumulative_quantity)}</td>{!edit && <><td>{numberText(l.current_quantity)}</td><td>{numberText(l.remaining_quantity)}</td><td>{amount(l.current_amount, currency)}</td></>}</tr>)}</tbody></table></div>;
}
function Actions({
  items,
  busy,
  onAction
}) {
  const [reason, setReason] = useState('');
  if (!items.length) return null;
  return <form className='record-section' onSubmit={e => e.preventDefault()}>{field('Reason for this decision', <textarea required value={reason} onChange={e => setReason(e.target.value)} rows={2} />)}<div className='inline-actions'>{items.map(([action, label]) => <button key={action} disabled={busy || !reason.trim()} className={action === 'return' || action === 'cancel' ? 'secondary' : 'primary'} onClick={() => onAction(action, reason)}>{label}</button>)}</div></form>;
}
function PolicyForm({
  contract,
  record,
  accounts,
  busy,
  onSave,
  onCancel
}) {
  const [f, set] = useState(record ? {
    ...record,
    reason: ''
  } : {
    contract_id: contract.id,
    receivable_account: '',
    retention_account: '',
    revenue_account: '',
    tax_account: '',
    tax_percent: '0',
    tax_basis: 'gross',
    basis: '',
    reason: ''
  });
  const update = (k, v) => set(x => ({
    ...x,
    [k]: v
  }));
  const account = (key, type, purpose) => <select required={key !== 'tax_account' || f.tax_percent !== '0'} value={f[key] || ''} onChange={e => update(key, e.target.value)}><option value=''>Choose account</option>{accounts.filter(a => a.type === type && a.purpose === purpose).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>;
  return <form className='offer-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h2>Finance policy</h2><p>{contract.title} · {amount(contract.original_value, contract.currency)}</p><section className='record-section'><h3>1. Where amounts belong</h3><div className='estimate-fields'>{field('Client receivable', account('receivable_account', 'asset', 'receivable'))}{field('Retention receivable', account('retention_account', 'asset', 'receivable'))}{field('Measured revenue', account('revenue_account', 'income', 'general'))}</div><p className='muted'>The chart is managed in Accounting. Retention has its own receivable account.</p></section><section className='record-section'><h3>2. Explicit tax treatment</h3><div className='estimate-fields'>{field('Exclusive tax %', <input required inputMode='decimal' value={f.tax_percent} onChange={e => update('tax_percent', e.target.value)} />)}{field('Tax basis', <select value={f.tax_basis} onChange={e => update('tax_basis', e.target.value)}><option value='gross'>Measured gross</option><option value='net'>After retention and recovery</option></select>)}{field('Output tax account', account('tax_account', 'liability', 'tax'))}</div>{field('Basis for these accounts and tax treatment', <textarea required value={f.basis} onChange={e => update('basis', e.target.value)} rows={3} />)}</section><section className='record-section'><h3>3. Agreed deductions</h3><p>Retention {contract.terms.retention_percent}% up to {amount(contract.terms.retention_cap, contract.currency)}. Advance allowance {amount(contract.terms.advance_ceiling, contract.currency)}; recovery {contract.terms.recovery_percent}% only against a recorded eligible balance.</p><p className='muted'>These terms come from the accepted offer. This policy does not change the agreed contract.</p>{field('Reason', <textarea required value={f.reason} onChange={e => update('reason', e.target.value)} rows={2} />)}<div className='inline-actions'><button className='primary' disabled={busy}>Save policy draft</button><button type='button' className='secondary' onClick={onCancel}>Cancel editing</button></div></section></form>;
}
function MeasurementForm({
  contract,
  record,
  busy,
  onSave,
  onCancel
}) {
  const prior = contract.previous_lines || [],
    foreign = contract.currency !== contract.company_currency;
  const [f, set] = useState(record ? {
    ...record,
    reason: '',
    filename: '',
    base64: '',
    lines: record.snapshot.lines
  } : {
    contract_id: contract.id,
    title: `${contract.project} · measured work`,
    period_from: contract.previous ? new Date(Date.parse(contract.previous.period_to) + 86400000).toISOString().slice(0, 10) : today(),
    period_to: today(),
    rate: '1',
    rate_date: today(),
    rate_source: '',
    basis: '',
    reason: '',
    filename: '',
    base64: '',
    lines: contract.lines.map(l => ({
      ...l,
      previous_quantity: prior.find(p => p.line_key === l.line_key)?.cumulative_quantity || '0',
      cumulative_quantity: prior.find(p => p.line_key === l.line_key)?.cumulative_quantity || '0'
    }))
  });
  const [fileError, setFileError] = useState(''),
    [reading, setReading] = useState(false),
    fileToken = useRef(0);
  const update = (k, v) => set(x => ({
    ...x,
    [k]: v
  }));
  const read = async e => {
    const file = e.target.files[0],
      token = ++fileToken.current;
    setFileError('');
    update('base64', '');
    update('filename', '');
    if (!file) {
      setReading(false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError('Choose an evidence file up to 2 MiB.');
      return;
    }
    setReading(true);
    try {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      if (token === fileToken.current) set(x => ({
        ...x,
        filename: file.name,
        base64: String(data).split(',')[1]
      }));
    } catch {
      if (token === fileToken.current) setFileError('The file could not be read. Select it again.');
    } finally {
      if (token === fileToken.current) setReading(false);
    }
  };
  return <form className='offer-form' onSubmit={e => {
    e.preventDefault();
    onSave({
      ...f,
      ...(!foreign ? {
        rate: '1',
        rate_date: f.period_to,
        rate_source: 'Same-currency measurement'
      } : {}),
      lines: f.lines.map(l => ({
        line_key: l.line_key,
        cumulative_quantity: l.cumulative_quantity
      }))
    });
  }}><h2>{record ? 'Revise measurement' : 'Measure completed work'}</h2><p>{contract.title} · {contract.currency}</p><section className='record-section'><h3>1. Period and installed quantities</h3>{field('Certificate title', <input required value={f.title} onChange={e => update('title', e.target.value)} />)}<div className='estimate-fields'>{field('Period from', <input required type='date' value={f.period_from} onChange={e => update('period_from', e.target.value)} />)}{field('Period through', <input required type='date' value={f.period_to} onChange={e => update('period_to', e.target.value)} />)}</div><p className='muted'>Enter the total installed to date for every item. Previous certified work is deducted automatically.</p><Measures lines={f.lines} currency={contract.currency} edit onChange={(key, value) => set(x => ({
        ...x,
        lines: x.lines.map(l => l.line_key === key ? {
          ...l,
          cumulative_quantity: value
        } : l)
      }))} /></section><section className='record-section'><h3>2. Measurement evidence</h3>{field('Basis and checks', <textarea required rows={3} value={f.basis} onChange={e => update('basis', e.target.value)} />)}{field(record?.evidence_id ? 'Add replacement evidence (original stays in history)' : 'Original measurement file', <input type='file' accept='.pdf,.png,.jpg,.jpeg,.txt' onChange={read} />)}{f.filename && <p>{f.filename}</p>}{reading && <p role='status'>Reading file…</p>}{fileError && <p role='alert'>{fileError}</p>}<p className='muted'>PDF, PNG, JPG or TXT, up to 2 MiB. Evidence is required before submission.</p></section><section className='record-section'><h3>3. Review basis</h3>{foreign ? <div className='estimate-fields'>{field('FX to company currency', <input required inputMode='decimal' value={f.rate} onChange={e => update('rate', e.target.value)} />)}{field('Rate date', <input required type='date' value={f.rate_date} onChange={e => update('rate_date', e.target.value)} />)}{field('Rate source', <input required value={f.rate_source} onChange={e => update('rate_source', e.target.value)} />)}</div> : <p className='muted'>Contract and company currency are both {contract.currency}. No exchange-rate entry is needed.</p>}{field('Reason', <textarea required value={f.reason} onChange={e => update('reason', e.target.value)} rows={2} />)}<div className='inline-actions'><button className='primary' disabled={busy || reading || !!fileError}>Save measurement</button><button type='button' className='secondary' onClick={onCancel}>Cancel editing</button></div></section></form>;
}
function InvoiceForm({
  companyCurrency,
  certificate,
  record,
  busy,
  onSave,
  onCancel
}) {
  const foreign = (record?.currency || certificate.currency) !== companyCurrency;
  const [f, set] = useState(record ? {
    ...record,
    reason: ''
  } : {
    certificate_id: certificate.id,
    title: certificate.title,
    invoice_date: today(),
    accounting_date: today(),
    due_date: new Date(Date.now() + certificate.contract.terms.payment_days * 86400000).toISOString().slice(0, 10),
    rate: certificate.rate,
    rate_date: today(),
    rate_source: '',
    basis: '',
    reason: ''
  });
  const update = (k, v) => set(x => ({
    ...x,
    [k]: v
  }));
  return <form className='offer-form' onSubmit={e => {
    e.preventDefault();
    onSave({
      ...f,
      ...(!foreign ? {
        rate: '1',
        rate_date: f.accounting_date,
        rate_source: 'Same-currency invoice'
      } : {})
    });
  }}><h2>{record ? 'Revise invoice accounting' : 'Prepare the client invoice'}</h2><p>{record?.advance_id ? 'Approved advance principal and tax stay fixed.' : 'Certified quantities and deductions stay fixed.'} This step records invoice dates and accounting FX.</p><section className='record-section'>{field('Invoice title', <input required value={f.title} onChange={e => update('title', e.target.value)} />)}<div className='estimate-fields'>{[['invoice_date', 'Invoice date'], ['accounting_date', 'Accounting date'], ['due_date', 'Due date'], ...(foreign ? [['rate_date', 'Rate date']] : [])].map(([key, label]) => <React.Fragment key={key}>{field(label, <input required type='date' value={f[key]} onChange={e => update(key, e.target.value)} />)}</React.Fragment>)}{foreign && <>{field('FX to company currency', <input required inputMode='decimal' value={f.rate} onChange={e => update('rate', e.target.value)} />)}{field('Rate source', <input required value={f.rate_source} onChange={e => update('rate_source', e.target.value)} />)}</>}</div>{field('Accounting basis', <textarea required value={f.basis} onChange={e => update('basis', e.target.value)} rows={3} />)}{field('Reason', <textarea required value={f.reason} onChange={e => update('reason', e.target.value)} rows={2} />)}<div className='inline-actions'><button className='primary' disabled={busy}>Save invoice draft</button><button type='button' className='secondary' onClick={onCancel}>Cancel editing</button></div></section></form>;
}
export default function Certificates({
  company,
  project,
  preview = false,
  onOpen,
  onChanged,
  initialRecord
}) {
  const [options, setOptions] = useState(null),
    [report, setReport] = useState(null),
    [record, setRecord] = useState(null),
    [kind, setKind] = useState('list'),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [filters, setFilters] = useState({
      project: project?.id || '',
      state: 'all',
      from: '',
      to: ''
    });
  const generation = useRef(0),
    navigation = useRef(0);
  const load = async () => {
    const n = ++generation.current;
    setLoading(true);
    setReport(null);
    try {
      const q = new URLSearchParams({
        company: company.id,
        ...filters
      });
      const [o, r] = await Promise.all([api('/certificates/options?' + q), api('/certificates/report?' + q)]);
      if (n === generation.current) {
        setOptions(o);
        setReport(r);
        setError('');
      }
    } catch (e) {
      if (n === generation.current) setError(e.message);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [company.id, filters.project, filters.state, filters.from, filters.to]);
  const open = async id => {
    const n = ++navigation.current;
    setBusy(true);
    setError('');
    setForm(null);
    try {
      const k = id.startsWith('CTR-') ? 'contract' : id.startsWith('CIN-') ? 'invoice' : 'certificate',
        path = k === 'contract' ? 'contracts' : k === 'invoice' ? 'invoices' : 'measurements',
        r = await api(`/certificates/${path}/${id}`);
      if (n === navigation.current) {
        setRecord(r);
        setKind(k);
      }
    } catch (e) {
      if (n === navigation.current) setError(e.message);
    } finally {
      if (n === navigation.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (initialRecord) open(initialRecord);
    return () => {
      navigation.current++;
    };
  }, [initialRecord]);
  const change = async (fn, next) => {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      setRecord(r);
      if (next) setKind(next);
      setForm(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    navigation.current++;
    setRecord(null);
    setKind('list');
    setForm(null);
    setError('');
  };
  const policyAction = (p, a, reason) => change(() => api(`/certificates/policies/${p.id}/decision`, {
    version: p.version,
    action: a,
    reason
  }), 'contract');
  const noWrites = preview || busy;
  let body;
  if (form?.type === 'policy') body = <PolicyForm key={form.record?.id || 'new'} contract={record} record={form.record} accounts={options?.accounts || []} busy={noWrites} onSave={f => change(() => api('/certificates/policies' + (form.record ? '/' + form.record.id : ''), f, form.record ? 'PUT' : 'POST'), 'contract')} onCancel={() => setForm(null)} />;else if (form?.type === 'measurement') body = <MeasurementForm contract={kind === 'contract' ? record : record.contract} record={form.record} busy={noWrites} onSave={f => change(() => api('/certificates/measurements' + (form.record ? '/' + form.record.id : ''), f, form.record ? 'PUT' : 'POST'), 'certificate')} onCancel={() => setForm(null)} />;else if (form?.type === 'invoice') body = <InvoiceForm companyCurrency={company.currency} certificate={kind === 'certificate' ? record : null} record={form.record} busy={noWrites} onSave={f => change(() => api('/certificates/invoices' + (form.record ? '/' + form.record.id : ''), f, form.record ? 'PUT' : 'POST'), 'invoice')} onCancel={() => setForm(null)} />;else if (kind === 'contract' && record) {
    const pending = record.policies.find(p => ['draft', 'submitted', 'returned'].includes(p.state)),
      current = record.policies.find(p => p.state === 'active');
    body = <><div className='section-head'><div><p className='eyebrow'>CLIENT CONTRACT · {record.id}</p><h2>{record.title}</h2><p>{record.project} · {amount(record.original_value, record.currency)}</p></div>{record.can_open_offer && <button className='secondary' onClick={() => onOpen(record.offer_id)}>Accepted offer</button>}</div><div className='certificate-findings'><h3>{record.readiness}</h3><p>Retention {record.terms.retention_percent}% · ceiling {amount(record.terms.retention_cap, record.currency)}. Payment terms: {record.terms.payment_days} days from invoice.</p><p>Recorded advance principal: {amount(record.paid_advance_principal || '0.00', record.currency)}. The contract allowance does not establish cash received.</p></div><div className='inline-actions'>{!preview && record.can_measure && current && !record.certificates.some(r => !['approved', 'cancelled'].includes(r.state)) && <button className='primary' disabled={busy} onClick={() => setForm({
          type: 'measurement'
        })}><Plus />Measure work</button>}{!preview && record.can_configure && !pending && <button className='secondary' disabled={busy} onClick={() => setForm({
          type: 'policy'
        })}>{current ? 'Propose a revised finance policy' : 'Configure finance'}</button>}</div>{pending && <section className='record-section'><h3>Finance policy · revision {pending.revision} · {pending.state}</h3><p>{pending.basis}</p>{!preview && pending.can_edit && <button className='secondary' onClick={() => setForm({
          type: 'policy',
          record: pending
        })}>Edit policy</button>}{!preview && <Actions busy={busy} items={[...(pending.can_submit ? [['submit', 'Submit policy']] : []), ...(pending.can_review ? [['approve', 'Activate finance policy'], ['return', 'Return for correction']] : []), ...(pending.can_cancel ? [['cancel', 'Cancel pending policy']] : [])]} onAction={(a, r) => policyAction(pending, a, r)} />}</section>}<h3>Measurements</h3>{record.certificates.length ? record.certificates.map(r => <button className='certificate-row' key={r.id} onClick={() => open(r.id)}><span><strong>{r.title}</strong><small>{r.period_from} – {r.period_to} · {r.state_label}</small></span><span>{amount(r.gross, r.currency)}<small>{r.next_action}</small></span><ArrowRight /></button>) : <p>No measurements yet. Activate finance, then measure completed work.</p>}<details className='record-section'><summary>Original BOQ · {record.lines.length} items</summary><Measures lines={record.lines.map(l => ({
          ...l,
          cumulative_quantity: '0',
          current_quantity: '0',
          remaining_quantity: l.quantity,
          current_amount: '0.00'
        }))} currency={record.currency} /></details>{record.policies.map(p => <details className='record-section' key={p.id}><summary>Finance policy {p.revision} · {p.state}</summary><p>{p.basis}</p><p>Exclusive tax {p.tax_percent}% on {p.tax_basis === 'gross' ? 'measured gross' : 'net after deductions'}.</p>{Object.entries(p.snapshot.accounts).filter(([, a]) => a).map(([name, a]) => <p key={name}>{name}: {a.code} · {a.name}</p>)}<History rows={p.history} /></details>)}</>;
  } else if (kind === 'certificate' && record) {
    const r = record,
      s = r.snapshot;
    body = <><div className='section-head'><div><p className='eyebrow'>{r.state_label.toUpperCase()} · {r.id}</p><h2>{r.title}</h2><p>{r.period_from} – {r.period_to} · Review cycle {r.cycle}</p></div><button className='secondary' onClick={() => open(r.contract_id)}>Client contract</button></div><div className='offer-overview'><div><small>New measured gross</small><strong>{amount(s.gross, r.currency)}</strong></div><div><small>Retention held</small><strong>{amount(s.retention, r.currency)}</strong></div><div><small>Next action</small><strong>{r.next_action}</strong></div></div><Findings items={r.findings} /><div className='inline-actions'>{!preview && r.can_edit && <button className='primary' disabled={busy} onClick={() => setForm({
          type: 'measurement',
          record: r
        })}>Revise measurement</button>}{!preview && r.can_invoice && <button className='primary' disabled={busy} onClick={() => setForm({
          type: 'invoice'
        })}>Prepare client invoice</button>}{r.invoice?.can_open && <button className='primary' onClick={() => open(r.invoice.id)}>Open invoice · {r.invoice.state}</button>}<button className='secondary' onClick={() => saveCsv(r.id + '.csv', certificateDetailCsv(r))}><Download />Export measurement</button></div><section className='record-section'><h3>Measured work</h3><Measures lines={s.lines} currency={r.currency} /><p>{r.basis}</p></section><section className='record-section'><h3>Measurement evidence</h3>{r.evidence.length ? r.evidence.map(e => <div className='certificate-evidence' key={e.id}><a href={`/api/certificates/evidence/${e.id}`} download>{e.filename}</a><span>{e.id === r.evidence_id ? 'Current evidence' : 'Earlier evidence'} · {e.size} bytes</span><details><summary>File fingerprint</summary><code>{e.sha256}</code></details></div>) : <p>Attach evidence before submitting.</p>}</section>{!preview && <Actions busy={busy} items={[...(r.can_submit ? [['submit', 'Submit for technical review']] : []), ...(r.can_review ? [['accept', r.state === 'finance' ? 'Approve certificate' : 'Accept this review'], ['return', 'Return for correction']] : []), ...(r.can_cancel ? [['cancel', 'Cancel unapproved measurement']] : [])]} onAction={(action, reason) => change(() => api(`/certificates/measurements/${r.id}/decision`, {
        version: r.version,
        action,
        reason
      }), 'certificate')} />}<details className='record-section'><summary>Deductions, tax and approval currency</summary><p>Previous gross {amount(s.previous_gross, r.currency)} + current {amount(s.gross, r.currency)} = cumulative {amount(s.cumulative_gross, r.currency)}.</p><p>Retention to date {amount(s.cumulative_retention, r.currency)}. Recovery {amount(s.recovery, r.currency)}. Tax {s.finance_policy.tax_percent}% on {s.finance_policy.tax_basis}: {amount(s.tax, r.currency)}.</p><p>Rate {r.rate} · {r.rate_date} · {r.rate_source}. Company approval amount {amount(s.company_authority, company.currency)}.</p></details><History rows={r.history} /></>;
  } else if (kind === 'invoice' && record) {
    const r = record;
    body = <><div className='section-head'><div><p className='eyebrow'>CLIENT INVOICE · {r.state.toUpperCase()} · {r.id}</p><h2>{r.title}</h2><p>Invoice {r.invoice_date} · Due {r.due_date}</p></div>{r.certificate_id && <button className='secondary' onClick={() => open(r.certificate_id)}>Certified measurement</button>}{r.advance_id && <span>Approved advance · {r.advance_id}</span>}</div><div className='offer-overview'><div><small>Client receivable</small><strong>{amount(r.total, r.currency)}</strong></div><div><small>{r.advance_id ? 'Advance principal' : r.currency === company.currency ? 'Retention held' : 'Company carrying value'}</small><strong>{amount(r.advance_id ? r.snapshot.advance.principal : r.currency === company.currency ? r.company_retention : r.company_total, r.advance_id ? r.currency : company.currency)}</strong></div><div><small>Accounting state</small><strong>{r.state === 'posted' ? 'Posted; receipt separate' : r.state === 'submitted' ? 'Independent AR review' : r.state === 'returned' ? 'Correction required' : 'Draft invoice'}</strong></div></div><Findings items={r.findings} />{!preview && r.can_edit && <button className='primary' onClick={() => setForm({
        type: 'invoice',
        record: r
      })}>Edit invoice accounting</button>}{r.settlement && <p>Settled {amount(r.settlement.settled,r.currency)} · Open {amount(r.settlement.open,r.currency)}. Bank clearance remains on the receipt.</p>}{!preview && r.can_prepare_receipt && <button className='primary' onClick={()=>onOpen('RCN:'+r.id)}>Prepare customer receipt</button>}{r.journal_id && r.can_open_journal && <button className='secondary' onClick={() => onOpen(r.journal_id)}>Open posted journal</button>}{!preview && <Actions busy={busy} items={[...(r.can_submit ? [['submit', 'Submit invoice for posting']] : []), ...(r.can_review ? [['post', 'Post client invoice'], ['return', 'Return for correction']] : [])]} onAction={(action, reason) => change(() => api(`/certificates/invoices/${r.id}/decision`, {
        version: r.version,
        action,
        reason
      }), 'invoice')} />}<details className='record-section'><summary>Accounting lines and rate evidence</summary><p>{r.basis}</p><p>Accounting date {r.accounting_date} · Rate {r.rate} on {r.rate_date} · {r.rate_source}</p><div className='table-scroll'><table className='certificate-table'><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Company debit</th><th>Company credit</th><th>FX rounding</th></tr></thead><tbody>{r.journal.map((l, i) => <tr key={i}><td>{l.account_code} · {l.account_name}<small>{l.description}</small></td><td>{l.debit}</td><td>{l.credit}</td><td>{l.base_debit}</td><td>{l.base_credit}</td><td>{l.rounding_adjustment}</td></tr>)}</tbody></table></div></details><History rows={r.history} /></>;
  } else body = <><div className='section-head'><div><p className='eyebrow'>CLIENT WORK & BILLING</p><h2>Client certificates</h2><p className='muted'>Measure work once. Follow its review, invoice and accounting status here.</p></div><button className='secondary' disabled={!report || loading} onClick={() => saveCsv('builder-client-certificates.csv', certificatesReportCsv(report))}><Download />Export findings</button></div><div className='certificate-filters'>{!project && field('Project', <select value={filters.project} onChange={e => setFilters(x => ({
        ...x,
        project: e.target.value
      }))}><option value=''>All authorised projects</option>{options?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}{field('Measurement status', <select value={filters.state} onChange={e => setFilters(x => ({
        ...x,
        state: e.target.value
      }))}>{['all', 'draft', 'technical', 'commercial', 'finance', 'returned', 'approved', 'cancelled'].map(s => <option key={s} value={s}>{s === 'all' ? 'All measurement states' : s}</option>)}</select>)}{field('From', <input type='date' value={filters.from} onChange={e => setFilters(x => ({
        ...x,
        from: e.target.value
      }))} />)}{field('Through', <input type='date' value={filters.to} onChange={e => setFilters(x => ({
        ...x,
        to: e.target.value
      }))} />)}</div>{loading && <p role='status'>Loading current findings…</p>}{report && <><Findings items={report.findings} /><section className='record-section'><h3>Contracts · start or continue work</h3>{options?.contracts.length ? options.contracts.map(c => <button className='certificate-row' key={c.id} onClick={() => open(c.id)}><span><strong>{c.title}</strong><small>{c.project} · {c.finance_ready ? 'Finance policy recorded' : 'Finance setup required'}</small></span><span>{amount(c.original_value, c.currency)}</span><ArrowRight /></button>) : <p>No awarded client contracts in this scope.</p>}</section><section className='record-section'><h3>Measurements · {report.rows.length}</h3>{report.rows.length ? report.rows.map(r => <button className='certificate-row' key={r.id} onClick={() => open(r.id)}><span><strong>{r.title}</strong><small>{r.period_from} – {r.period_to} · {r.state_label}</small></span><span>{amount(r.gross, r.currency)}<small>{r.next_action}</small></span><ArrowRight /></button>) : <p>No measurements match these filters.</p>}</section>{options?.can_ar && <section className='record-section'><h3>Client invoices · {report.invoices.length}</h3><p className='muted'>Filtered by accounting date. Posted charges are separate from customer receipts.</p>{report.invoices.map(r => <button className='certificate-row' key={r.id} onClick={() => open(r.id)}><span><strong>{r.title}</strong><small>{r.id} · {r.state} · Due {r.due_date}</small></span><span>{amount(r.total, r.currency)}</span><ArrowRight /></button>)}</section>}</>}</>;
  return <div className='certificates-page'>{(kind !== 'list' || form) && <button className='text-button' onClick={back}><ArrowLeft />All client certificates</button>}{preview && <p className='preview-notice'>Read-only access preview</p>}{error && <ErrorBox message={error} />}{busy && !form && <p role='status'>Loading…</p>}{body}</div>;
}
