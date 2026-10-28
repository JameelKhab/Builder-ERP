import { costReportCsv } from './report-export.js';
import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, CaretRight, Info, CheckCircle, FileText, ArrowLeft, Download, Question, ArrowsClockwise } from '@phosphor-icons/react';
import { api, amount, compact, stateLabel, dueLabel } from './api.js';
export function Modal({
  title,
  children,
  onClose,
  wide = false
}) {
  const ref = useRef(null);
  const returnFocus = useRef(document.activeElement);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);
  return <dialog ref={ref} className={wide ? 'modal wide' : 'modal'} onCancel={e => {
    e.preventDefault();
    onClose();
  }} onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }} aria-labelledby="dialog-title">
<header className="dialog-heading">
<h2 id="dialog-title">{title}</h2>
<button className="icon-button" onClick={onClose} aria-label="Close dialog">
<X size={23} />
</button>
</header>{children}</dialog>;
}
export function ErrorBox({
  message,
  retry
}) {
  return message ? <div className="error" role="alert">
<Info size={20} />
<span>{message}</span>{retry && <button onClick={retry}>Try again</button>}</div> : null;
}
export function Empty({
  children
}) {
  return <div className="empty">
<Info size={22} />
<p>{children}</p>
</div>;
}
export function Status({
  value
}) {
  return <span className={['submitted', 'Verification due', 'At risk', 'Below target', 'Service due'].includes(value) ? 'status attention' : value === 'approved' ? 'status good' : 'status'}>{stateLabel[value] || value}</span>;
}
export function RecordTable({
  rows,
  onOpen
}) {
  if (!rows.length) return <Empty>No records in this category for the selected company and project.</Empty>;
  return <div className="table-scroll">
<table className="work-table">
<thead>
<tr>
<th>Work</th>
<th>Location</th>
<th>Owner</th>
<th>Due</th>
<th>Status</th>
</tr>
</thead>
<tbody>{rows.map(row => <tr key={row.id}>
<td>
<button className="row-link" onClick={() => onOpen(row.id)}>{row.title}<small>{row.id}</small>
</button>
</td>
<td data-label="Location">{row.location}</td>
<td data-label="Owner">{row.owner}</td>
<td data-label="Due" className={dueLabel(row.due) === 'Today' ? 'urgent' : ''}>{dueLabel(row.due)}</td>
<td data-label="Status">
<Status value={row.status} />
</td>
</tr>)}</tbody>
</table>
</div>;
}
export function RecordDetail({
  record,
  company,
  project
}) {
  return <>
<p className="eyebrow">{company} · {project || 'Company record'}</p>
<div className="record-context">
<span>{record.id}</span>
<Status value={record.status} />
<span>{record.location}</span>
</div>
<div className="next-action">
<Info size={21} />
<div>
<strong>Next: {record.next_action}</strong>
<small>{record.owner} · {record.due ? `Due ${dueLabel(record.due)}` : 'No due date set'}</small>
</div>
</div>
<dl className="detail-list">{Object.entries(record.details).map(([key, value]) => <div key={key}>
<dt>{key}</dt>
<dd>{value}</dd>
</div>)}</dl>
<p className="muted footnote">Sample register · read only in this increment.</p>
</>;
}
export function RequestDetail({
  request: initial,
  onChanged,
  onEdit,
  company,
  project
}) {
  const [r, setR] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [returning, setReturning] = useState(false),
    [reason, setReason] = useState(''),
    [success, setSuccess] = useState('');
  async function decide(action) {
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/requests/${r.id}/decision`, {
        action,
        version: r.version,
        note: reason
      });
      setR(updated);
      setReturning(false);
      setSuccess(action === 'approve' ? 'Approved for sourcing. No order or payment has been created.' : action === 'submit' ? 'Submitted for independent review.' : 'Returned with your reason.');
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    try {
      setR(await api(`/requests/${r.id}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  return <>
<p className="eyebrow">{company} · {project} · Buying</p>
<div className="record-context">
<span>{r.id} · Revision {r.version}</span>
<Status value={r.status} />
</div>
<ErrorBox message={error} retry={reload} />{success && <div className="success" role="status">
<CheckCircle size={20} />{success}</div>}<div className="next-action">
<Info size={22} />
<div>
<strong>Next: {r.status === 'approved' ? 'Procurement prepares sourcing / order review' : r.status === 'submitted' ? 'Independent review' : r.status === 'returned' ? 'Requester revises and resubmits' : 'Complete and submit this request'}</strong>
<small>{r.owner} · Needed on site {dueLabel(r.due)}</small>
</div>
</div>
    <section className="record-section">
<h3>Purchase & location</h3>
<dl className="facts">
<div>
<dt>Requested by</dt>
<dd>{r.requester}</dd>
</div>
<div>
<dt>Location</dt>
<dd>{r.location}</dd>
</div>
<div>
<dt>Cost item</dt>
<dd>{r.item.name}</dd>
</div>
<div>
<dt>Vendor</dt>
<dd>{r.vendor_name || 'Not selected — provisional estimate'}</dd>
</div>
</dl>
<div className="table-scroll">
<table>
<thead>
<tr>
<th>Item</th>
<th>Quantity</th>
<th>Unit price</th>
<th>Amount</th>
</tr>
</thead>
<tbody>
<tr>
<td>{r.title}</td>
<td>{r.quantity} {r.unit}</td>
<td>{amount(r.unit_price, r.currency)}</td>
<td>{amount(r.amount, r.currency)}</td>
</tr>
</tbody>
</table>
</div>
</section>
    <section className="record-section">
<h3>Currency & budget</h3>
<div className="metrics two">
<div>
<span>Vendor amount</span>
<strong>{amount(r.amount, r.currency)}</strong>
</div>
<div>
<span>Company estimate</span>
<strong>{amount(r.company_amount, r.company_currency)}</strong>
</div>
</div>
<p className="muted">1 {r.currency} = {r.rate} {r.company_currency} · {r.rate_date} · {r.rate_source}{r.quote ? ` · ${r.quote}` : ''}</p>
<div className="notice">{amount(r.available, r.company_currency)} sourcing allowance before this request. {amount(r.after_request, r.company_currency)} remaining {r.status === 'approved' ? 'after approval' : 'if approved'}.<small>This is a request allocation, separate from issued commitments, incurred cost and cash.</small>
</div>
</section>
    <section className="record-section">
<h3>Approval & record history</h3>
<ol className="history">{r.history.map(e => <li key={e.id}>
<span>{e.actor} <strong>{e.action}</strong> revision {e.version}</span>
<small>{new Date(e.at).toLocaleString('en-GB', {
              timeZone: 'Asia/Dubai'
            })} · Dubai time</small>
<p>{e.note}</p>
</li>)}</ol>
</section>
    {returning && <label className="field">Reason for returning<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} autoFocus required placeholder="Explain what the requester needs to change." />
</label>}
    <div className="dialog-actions">{r.can_edit && <>
<button className="secondary" onClick={() => onEdit(r)} disabled={busy}>Edit request</button>
<button className="primary" onClick={() => decide('submit')} disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
</>}{r.can_review && <>{returning ? <>
<button className="secondary" onClick={() => setReturning(false)} disabled={busy}>Cancel</button>
<button className="primary" disabled={busy || !reason.trim()} onClick={() => decide('return')}>{busy ? 'Returning…' : 'Return with reason'}</button>
</> : <>
<button className="secondary" onClick={() => setReturning(true)} disabled={busy}>Return for changes</button>
<button className="primary" onClick={() => decide('approve')} disabled={busy}>{busy ? 'Approving…' : 'Approve sourcing'}</button>
</>}</>}{r.status === 'submitted' && !r.can_review && <p className="muted">An authorised colleague must review this request. Requesters cannot approve their own work.</p>}</div>
  </>;
}
export function RequestForm({
  company,
  project,
  vendors,
  items,
  existing,
  onSaved
}) {
  const [form, setForm] = useState(existing ? {
    title: existing.title,
    location: existing.location,
    due: existing.due,
    unit: existing.unit,
    quantity: existing.quantity,
    unit_price: existing.unit_price,
    vendor_id: existing.vendor_id || '',
    item_id: existing.item_id
  } : {
    title: '',
    location: '',
    due: '2026-11-02',
    unit: 'tonnes',
    quantity: '1',
    unit_price: '',
    vendor_id: '',
    item_id: items[0]?.id || ''
  });
  const [preview, setPreview] = useState(null),
    [previewError, setPreviewError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const payload = {
    ...form,
    company_id: company.id,
    project_id: project.id
  };
  const change = (key, value) => setForm(f => ({
    ...f,
    [key]: value,
    ...(key === 'vendor_id' ? {
      unit_price: ''
    } : {})
  }));
  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (!form.quantity || !form.vendor_id && !form.unit_price) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => api('/requests/preview', {
      ...form,
      company_id: company.id,
      project_id: project.id
    }, 'POST', controller.signal).then(setPreview).catch(e => {
      if (e.name !== 'AbortError') setPreviewError(e.message);
    }), 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [form.quantity, form.vendor_id, form.unit_price, form.item_id, company.id, project.id]);
  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = existing ? await api(`/requests/${existing.id}`, {
        ...payload,
        version: existing.version
      }, 'PUT') : await api('/requests', payload);
      onSaved(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={save}>
<p className="eyebrow">{company.name} · {project.name}</p>
<p className="muted">Start with the site need. A vendor is optional; selecting a quote sets its currency and price.</p>
<ErrorBox message={error} />
<h3>What is needed?</h3>
<div className="form-grid">
<label className="field full">Description<input value={form.title} onChange={e => change('title', e.target.value)} required maxLength={160} placeholder="e.g. Reinforcement steel, B500B" autoFocus />
</label>
<label className="field">Location<input value={form.location} onChange={e => change('location', e.target.value)} required maxLength={160} placeholder="e.g. Level 13" />
</label>
<label className="field">Needed by<input type="date" value={form.due} onChange={e => change('due', e.target.value)} required />
</label>
<label className="field full">Cost item<select value={form.item_id} onChange={e => change('item_id', e.target.value)} required>
<option value="" disabled>Select a cost item</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
</label>
<label className="field">Quantity<input type="text" inputMode="decimal" value={form.quantity} onChange={e => change('quantity', e.target.value)} required />
</label>
<label className="field">Unit<input value={form.unit} onChange={e => change('unit', e.target.value)} required maxLength={30} />
</label>
</div>
<h3>Vendor & estimate</h3>
<div className="form-grid">
<label className="field full">Vendor quotation<select value={form.vendor_id} onChange={e => change('vendor_id', e.target.value)}>
<option value="">No vendor yet · Estimate in {company.currency}</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name} · {v.quote} · {v.currency}</option>)}</select>
</label>{!form.vendor_id && <label className="field">Estimated unit price · {company.currency}<input inputMode="decimal" value={form.unit_price} onChange={e => change('unit_price', e.target.value)} required />
</label>}</div>
<ErrorBox message={previewError} />{preview && <div className="notice">
<strong>{amount(preview.amount, preview.currency)}</strong> vendor estimate · <strong>{amount(preview.companyAmount, company.currency)}</strong> company estimate<small>1 {preview.currency} = {preview.rate} {company.currency} · {preview.rate_date} · {preview.quote || 'Provisional estimate'}</small>
<small>Changing the vendor reprices the request. It does not relabel the old amount.</small>
</div>}<div className="dialog-actions">
<button className="primary" disabled={busy || !preview}>{busy ? 'Saving…' : existing ? 'Save revised draft' : 'Save draft'}<ArrowRight size={18} />
</button>
</div>
</form>;
}
export function CostReport({
  company,
  projects,
  initialProject,
  onSource,
  onExplain
}) {
  const [project, setProject] = useState(initialProject || ''),
    [report, setReport] = useState(null),
    [error, setError] = useState(''),
    [page, setPage] = useState(0),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError('');
    setPage(0);
    api(`/reports/cost?company=${company.id}&project=${project}`, undefined, 'GET', controller.signal).then(setReport).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => controller.abort();
  }, [company.id, project, reload]);
  function download() {
    const blob = new Blob([costReportCsv(report)], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `JAKH-cost-${company.id}-${project || 'company'}-${report.snapshot}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
<div className="section-head">
<div>
<h2>Cost report</h2>
<p className="muted">One definition. Project or company scope.</p>
</div>
<button className="secondary" disabled={!report} onClick={download}>
<Download size={18} />Export report</button>
</div>
<div className="report-controls">
<label className="field">Report scope<select value={project} onChange={e => setProject(e.target.value)}>
<option value="">Company · All authorised activity</option>{projects.filter(p => p.company_id === company.id).map(p => <option key={p.id} value={p.id}>Project · {p.name}</option>)}</select>
</label>
<p className="muted">{company.currency} · Excluding tax · Snapshot 28 Oct 2026</p>
</div>
<ErrorBox message={error} retry={() => setReload(n => n + 1)} />{!report && !error && <p role="status">Calculating findings…</p>}{report && <>
<section className="report-findings">
<div className="section-head">
<h3>What this report shows</h3>
<button className="text-button" onClick={() => onExplain(report)}>Explain findings<CaretRight size={18} />
</button>
</div>{report.findings.map(f => <div className="finding" key={f.id}>
<Info size={19} />
<div>
<p className={f.severity === 'warning' ? 'urgent' : ''}>{f.text}</p>{f.sourceIds.length > 0 && <button className="source-link" onClick={() => onSource(report.rows.filter(r => f.sourceIds.includes(r.id)), report)}>View {f.sourceIds.length} supporting cost item{f.sourceIds.length === 1 ? '' : 's'}</button>}</div>
</div>)}<small>{report.meta.population} cost items · {report.meta.restricted ? 'Permission-limited population' : 'Full selected scope'} · All matching items are included in the findings.</small>
</section>
<div className="metrics report-metrics">{[['revised_budget', 'Revised budget'], ['committed', 'Commitments'], ['incurred', 'Incurred cost'], ['cash', 'Cash paid'], ['forecast', 'Forecast final cost']].map(([key, label]) => <div key={key}>
<span>{label}</span>
<strong>{compact(report.totals[key], company.currency)}</strong>
</div>)}</div>
<div className="table-scroll">
<table className="cost-table">
<thead>
<tr>
<th>Cost item</th>
<th>Revised budget</th>
<th>Commitments</th>
<th>Incurred cost</th>
<th>Cash paid</th>
<th>Forecast</th>
</tr>
</thead>
<tbody>{report.rows.slice(page * 4, page * 4 + 4).map(r => <tr key={r.id}>
<td>
<button className="row-link" onClick={() => onSource([r], report)}>{r.name}<small>{r.id} · {r.location}</small>
</button>
</td>{['revised_budget', 'committed', 'incurred', 'cash', 'forecast'].map(key => <td className="numeric" key={key}>{r[key] === null ? 'Not available' : Number(r[key]).toLocaleString('en-GB')}</td>)}</tr>)}</tbody>
</table>
</div>
<div className="pagination">
<span>{report.rows.length ? `${page * 4 + 1}–${Math.min(page * 4 + 4, report.rows.length)} of ${report.rows.length} items` : 'No matching items'}</span>
<div>
<button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
<ArrowLeft size={18} />
</button>
<button aria-label="Next page" disabled={(page + 1) * 4 >= report.rows.length} onClick={() => setPage(p => p + 1)}>
<ArrowRight size={18} />
</button>
</div>
</div>
<details className="report-basis">
<summary>Report basis & data limitations</summary>
<p>{report.meta.basis}. As of {report.meta.asOf}. Snapshot {report.snapshot}; {report.meta.definition}; {report.meta.rules}.</p>{report.limitations.map(s => <p key={s}>{s}</p>)}<p>Company scope includes authorised non-project overheads. Different legal companies and currencies are not added together.</p>
</details>
</>}</>;
}
