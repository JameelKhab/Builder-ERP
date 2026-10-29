import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Download, Receipt } from '@phosphor-icons/react';
import { api, amount, numberText } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
import { payablesCsv } from './payables-export.js';
import './ledger.css';
import './payables.css';
const labelDate = v => new Date(v + 'T12:00:00Z').toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
const blankLine = () => ({
  receipt_id: '',
  quantity: '',
  unit_price: '',
  price_basis: '1',
  account_id: '',
  tax_id: '',
  variance_reason: ''
});
function BillForm({
  record,
  creditOf,
  options,
  sources,
  onSave,
  busy
}) {
  const initial = record ? {
    ...record,
    lines: record.lines.map(l => ({
      ...l,
      account_id: l.cost_account.account_id
    }))
  } : creditOf ? {
    kind: 'credit',
    original_id: creditOf.id,
    order_id: creditOf.order_id,
    title: `Return credit · ${creditOf.reference}`,
    reference: '',
    document_date: options.today,
    accounting_date: options.today,
    due_date: options.today,
    rate: creditOf.rate,
    rate_date: creditOf.rate_date,
    rate_source: creditOf.rate_source,
    explanation: '',
    lines: creditOf.lines.filter(l => Number(creditOf.receipt_position.find(p => p.id === l.receipt_id)?.credit_needed) > 0).map(l => ({
      original_line_id: l.id,
      receipt_id: l.receipt_id,
      product: l.product,
      uom: l.uom,
      quantity: ''
    }))
  } : {
    kind: 'bill',
    order_id: '',
    title: '',
    reference: '',
    document_date: options.today,
    accounting_date: options.today,
    due_date: '',
    rate: '1',
    rate_date: options.today,
    rate_source: 'Functional currency',
    explanation: '',
    lines: [blankLine()]
  };
  const [f, set] = useState(initial),
    field = (k, v) => set({
      ...f,
      [k]: v
    }),
    line = (i, k, v) => set({
      ...f,
      lines: f.lines.map((l, n) => n === i ? {
        ...l,
        [k]: v
      } : l)
    });
  const order = sources.find(o => o.id === f.order_id),
    credit = f.kind === 'credit';
  const chooseOrder = id => {
    const o = sources.find(x => x.id === id),
      due = o?.payment_days == null ? '' : new Date(Date.parse(options.today) + o.payment_days * 86400000).toISOString().slice(0, 10);
    set({
      ...f,
      order_id: id,
      due_date: due,
      rate: o?.currency === options.company.currency ? '1' : '',
      rate_source: o?.currency === options.company.currency ? 'Functional currency' : '',
      lines: [blankLine()]
    });
  };
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    const body = Object.fromEntries(['kind', 'order_id', 'original_id', 'title', 'reference', 'document_date', 'accounting_date', 'due_date', 'rate', 'rate_date', 'rate_source', 'explanation'].map(k => [k, f[k]]));
    if (record) body.version = record.version;
    body.lines = f.lines.map(l => credit ? {
      original_line_id: l.original_line_id,
      quantity: l.quantity
    } : Object.fromEntries(['receipt_id', 'quantity', 'unit_price', 'price_basis', 'account_id', 'tax_id', 'variance_reason'].map(k => [k, l[k]])));
    onSave(body);
  }}><div className='ledger-field-grid'><label className='field'>Supplier order<select required disabled={!!record || credit} value={f.order_id} onChange={e => chooseOrder(e.target.value)}><option value=''>Choose an accepted order</option>{sources.map(o => <option key={o.id} value={o.id}>{options.projects.find(p => p.id === o.project_id)?.name} · {o.vendor} · {o.currency} · {o.id}</option>)}</select></label><label className='field'>Document title<input required maxLength={160} value={f.title} onChange={e => field('title', e.target.value)} /></label><label className='field'>Supplier {credit ? 'credit' : 'bill'} reference<input required maxLength={120} value={f.reference} onChange={e => field('reference', e.target.value)} /></label><label className='field'>Supplier document date<input required type='date' max={options.today} value={f.document_date} onInput={e => field('document_date', e.target.value)} /></label><label className='field'>Accounting date<input required type='date' max={options.today} min={f.document_date} value={f.accounting_date} onInput={e => field('accounting_date', e.target.value)} /></label>{!credit && <label className='field'>Due date<input required type='date' min={f.document_date} value={f.due_date} onInput={e => field('due_date', e.target.value)} /><small>Check against the supplier bill. Known order terms suggest a date.</small></label>}</div>
  {order && <div className='payable-source-note'><strong>{order.vendor}</strong><span>{options.projects.find(p => p.id === order.project_id)?.name} · {order.currency} · {order.address || 'Address not recorded'}</span></div>}
  {!credit && order?.currency !== options.company.currency && order && <section className='ledger-rate'><h3>Accounting conversion</h3><p>1 {order.currency} = the rate below in {options.company.currency}. The order keeps its original conversion.</p><div className='ledger-field-grid'><label className='field'>Exchange rate<input required inputMode='decimal' value={f.rate} onChange={e => field('rate', e.target.value)} /></label><label className='field'>Rate date<input required type='date' max={f.accounting_date} value={f.rate_date} onInput={e => field('rate_date', e.target.value)} /></label><label className='field'>Rate source<input required value={f.rate_source} onChange={e => field('rate_source', e.target.value)} /></label></div></section>}
  <h3>{credit ? 'Returned quantities to credit' : 'Match accepted receipts'}</h3>{credit && <p>Original prices, tax and accounting conversion are retained. A credit needs a recorded return and remaining billed quantity.</p>}
  {f.lines.map((l, i) => <section className='payable-line-form' key={i}><div className='section-heading'><strong>Line {i + 1}{credit ? ` · ${l.product}` : ''}</strong>{f.lines.length > 1 && <button type='button' className='text-button' onClick={() => field('lines', f.lines.filter((_, n) => n !== i))}>Remove line {i + 1}</button>}</div><div className='ledger-field-grid'>{!credit && <label className='field payable-full'>Accepted receipt<select required value={l.receipt_id} onChange={e => {
            const s = order?.receipts.find(r => r.id === e.target.value);
            set({
              ...f,
              lines: f.lines.map((x, n) => n === i ? {
                ...x,
                receipt_id: e.target.value,
                unit_price: s?.pack?.quoted_price || s?.unit_price || '',
                price_basis: s?.pack?.base_quantity || '1'
              } : x)
            });
          }}><option value=''>Choose a receipt</option>{order?.receipts.map(r => <option value={r.id} key={r.id}>{r.product} · {r.delivery_reference} · {r.available} {r.uom} unbilled</option>)}</select></label>}<label className='field'>{credit ? 'Credit quantity' : 'Invoice quantity'}<input required inputMode='decimal' value={l.quantity} onChange={e => line(i, 'quantity', e.target.value)} /><small>{credit ? l.uom : order?.receipts.find(r => r.id === l.receipt_id)?.uom} · base unit</small></label>{!credit && <><label className='field'>Invoice price · {order?.currency || 'order currency'}<input required inputMode='decimal' value={l.unit_price} onChange={e => line(i, 'unit_price', e.target.value)} /></label><label className='field'>Price per base quantity<input required inputMode='decimal' value={l.price_basis} onChange={e => line(i, 'price_basis', e.target.value)} /><small>For 100 units costing 500, enter price 500 and quantity 100.</small></label><label className='field'>Accounting classification<select required value={l.account_id} onChange={e => line(i, 'account_id', e.target.value)}><option value=''>Choose expense or asset</option>{options.accounts.filter(a => a.active && a.purpose === 'general' && ['expense', 'asset'].includes(a.type)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label className='field'>Tax treatment<select required value={l.tax_id} onChange={e => line(i, 'tax_id', e.target.value)}><option value=''>Choose effective tax code</option>{options.taxes.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select></label><label className='field payable-full'>Explanation if invoice price differs from order<input maxLength={500} value={l.variance_reason} onChange={e => line(i, 'variance_reason', e.target.value)} /></label></>}</div></section>)}
  {!credit && <button type='button' className='secondary' disabled={!order || f.lines.length >= 20} onClick={() => field('lines', [...f.lines, blankLine()])}><Plus />Add receipt line</button>}
  {credit && !f.lines.length && <p role='status'>No billed return quantity is currently available. Record the physical return before preparing a quantity credit.</p>}
  <label className='field'>Supporting explanation<textarea required maxLength={2000} value={f.explanation} onChange={e => field('explanation', e.target.value)} /></label><p className='muted'>Save a draft, check its calculated amounts, then submit it for independent review.</p><button className='primary' disabled={busy || !f.lines.length}>{busy ? 'Saving…' : 'Save draft'}</button></form>;
}
function TaxForm({
  existing,
  options,
  onSave,
  busy
}) {
  const [f, set] = useState(existing ? {
    ...existing,
    active: !!existing.active,
    reason: ''
  } : {
    company_id: options.company.id,
    code: '',
    name: '',
    rate: '0',
    recoverable: '0',
    account_id: '',
    effective_from: options.today,
    effective_until: '',
    active: true,
    reason: ''
  });
  const field = (k, v) => set({
    ...f,
    [k]: v
  });
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><div className='ledger-field-grid'><label className='field'>Tax code<input required disabled={!!existing} value={f.code} onChange={e => field('code', e.target.value)} /></label><label className='field'>Tax name and purpose<input required value={f.name} onChange={e => field('name', e.target.value)} /></label><label className='field'>Exclusive tax percentage<input required disabled={!!existing} inputMode='decimal' value={f.rate} onChange={e => field('rate', e.target.value)} /></label><label className='field'>Recoverable percentage<input required disabled={!!existing} inputMode='decimal' value={f.recoverable} onChange={e => field('recoverable', e.target.value)} /></label><label className='field'>Recoverable tax account<select disabled={!!existing} value={f.account_id || ''} onChange={e => field('account_id', e.target.value)}><option value=''>None · no recovery</option>{options.accounts.filter(a => a.active && a.purpose === 'tax' && a.type === 'asset').map(a => <option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}</select></label><label className='field'>Effective from<input required disabled={!!existing} type='date' value={f.effective_from} onInput={e => field('effective_from', e.target.value)} /></label><label className='field'>Effective until · optional<input disabled={!!existing} type='date' value={f.effective_until || ''} onInput={e => field('effective_until', e.target.value)} /></label><label className='field'>Availability<select value={String(f.active)} onChange={e => field('active', e.target.value === 'true')}><option value='true'>Active</option><option value='false'>Archived</option></select></label></div><label className='field'>Configuration reason<textarea required value={f.reason} onChange={e => field('reason', e.target.value)} /></label><p className='muted'>Rates and effective dates are fixed after creation. Create a new code for a changed policy. This calculation supports exclusive tax only.</p><button className='primary' disabled={busy}>Save tax code</button></form>;
}
export default function Payables({
  company,
  project,
  preview,
  initialRecord,
  onChanged,
  onOpen
}) {
  const [options, setOptions] = useState(null),
    [rows, setRows] = useState([]),
    [sources, setSources] = useState([]),
    [record, setRecord] = useState(null),
    [mode, setMode] = useState('register'),
    [creditOf, setCreditOf] = useState(null),
    [tax, setTax] = useState(null),
    [report, setReport] = useState(null),
    [reportProject, setReportProject] = useState(project?.id || ''),
    [to, setTo] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [control, setControl] = useState('');
  const query = `company=${company.id}${project ? '&project=' + project.id : ''}`;
  async function load() {
    const [o, rs, ss] = await Promise.all([api('/payables/options?' + query), api('/payables/documents?' + query), api('/payables/sources?' + query)]);
    setOptions(o);
    setRows(rs);
    setSources(ss);
    setControl(o.settings?.account_id || '');
    return o;
  }
  async function act(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id) {
    const r = await api('/payables/documents/' + id);
    setRecord(r);
    setMode('detail');
    setReason('');
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await load();
        if (!alive) return;
        setTo(o.today);
        if (initialRecord) await open(initialRecord);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query, initialRecord]);
  const back = () => {
    setMode('register');
    setRecord(null);
    setCreditOf(null);
    setError('');
    setReason('');
  };
  const decision = action => act(async () => {
    setRecord(await api(`/payables/documents/${record.id}/decision`, {
      version: record.version,
      action,
      reason
    }));
    setReason('');
    await load();
    onChanged?.();
  });
  const save = f => act(async () => {
    const r = await api('/payables/documents' + (record && mode === 'edit' ? '/' + record.id : ''), f, record && mode === 'edit' ? 'PUT' : 'POST');
    await load();
    setRecord(r);
    setMode('detail');
    setCreditOf(null);
    onChanged?.();
  });
  const getReport = () => act(async () => {
    setReport(await api(`/payables/report?company=${company.id}&project=${reportProject}&to=${to || options.today}`));
    setMode('report');
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([payablesCsv(report)], {
      type: 'text/csv;charset=utf-8'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Builder-ERP-Supplier-Payables-${company.id}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!options) return <section><ErrorBox message={error} /><p>{error ? 'Supplier bills could not be loaded.' : 'Loading supplier bills…'}</p></section>;
  return <section className='ledger-page payable-page'><header className='ledger-header'><div><span className='eyebrow'>SUPPLIER ACCOUNTING · {project?.name || company.name}</span><h1>Supplier bills</h1><p>Match accepted work, review the liability, follow the correction.</p></div>{mode === 'register' && options.can_write && !preview && <button className='primary' onClick={() => {
        setRecord(null);
        setCreditOf(null);
        setMode('new');
      }}><Plus />New bill</button>}</header>
  <ErrorBox message={error} />{preview && <p className='guard-note'>Access preview · read only</p>}
  {['register', 'report', 'settings'].includes(mode) ? <nav className='ledger-nav' aria-label='Supplier accounting views'><button className={mode === 'register' ? 'active' : ''} onClick={back}>Bills & credits</button><button className={mode === 'report' ? 'active' : ''} onClick={getReport}>Findings & balances</button>{options.can_manage && <button className={mode === 'settings' ? 'active' : ''} onClick={() => {
        setMode('settings');
        setReason('');
      }}>AP & tax setup</button>}</nav> : <button className='text-button' onClick={back}><ArrowLeft />Back to bills & credits</button>}
  {mode === 'register' && <><div className='payable-brief'><Receipt size={24} /><div><strong>{rows.filter(r => r.state === 'submitted').length} awaiting independent review</strong><p>Posted bills and return credits update the linked ledger. Cash settlement follows a separate workflow.</p></div></div>{rows.length ? <div className='payable-register'>{rows.map(r => <button key={r.id} className='payable-row' onClick={() => act(() => open(r.id))}><div><span className='eyebrow'>{r.kind === 'credit' ? 'RETURN CREDIT' : 'SUPPLIER BILL'} · {r.reference}</span><strong>{r.title}</strong><span>{r.vendor} · {r.project}</span></div><div><span className={'status ' + r.state}>{r.state_label}</span><strong>{amount(r.total, r.currency)}</strong><small>{r.kind === 'bill' ? 'Due ' + labelDate(r.due_date) : 'Correction to original bill'}</small></div><ArrowRight /></button>)}</div> : <Empty>No supplier bills in this scope. Accepted receipts are the starting point for a material bill.</Empty>}<p className='muted footnote'>Material receipt bills and quantity return credits work locally. Subcontract certificates, retention, settlements and other finance flows are still being built.</p></>}
  {['new', 'edit', 'credit'].includes(mode) && <BillForm key={mode + (record?.id || '')} record={mode === 'edit' ? record : null} creditOf={creditOf} options={options} sources={sources} onSave={save} busy={busy} />}
  {mode === 'detail' && record && <><div className='payable-record-heading'><span className={'status ' + record.state}>{record.state_label}</span><h2>{record.title}</h2><p>{record.reference} · {record.source.order.vendor} · {record.project}</p><div className='payable-actions'>{record.can_open_order && onOpen && <button className='text-button' onClick={() => onOpen(record.order_id)}>Supplier order {record.order_id}<ArrowRight /></button>}{record.can_open_ledger && record.journal_id && onOpen && <button className='text-button' onClick={() => onOpen(record.journal_id)}>Journal {record.journal_number}<ArrowRight /></button>}{record.original_id && <button className='text-button' onClick={() => act(() => open(record.original_id))}>Original bill<ArrowRight /></button>}</div></div><div className='payable-metrics'><div><small>{record.kind === 'credit' ? 'Supplier credit' : 'Bill total'}</small><strong>{amount(record.total, record.currency)}</strong></div>{record.currency !== record.company_currency && <div><small>Functional amount</small><strong>{amount(record.company_total, record.company_currency)}</strong></div>}<div><small>Accounting date</small><strong>{labelDate(record.accounting_date)}</strong></div><div><small>{record.kind === 'bill' ? 'Due date' : 'Prepared by'}</small><strong>{record.kind === 'bill' ? labelDate(record.due_date) : record.author}</strong></div></div>
  <section className='record-section'><h3>Matched receipts</h3>{record.lines.map(l => <div className='payable-matched' key={l.id}><div><strong>{l.product}</strong><p>{l.quantity} {l.uom} · {l.delivery_reference}</p><small>{l.work_package} · {l.location}</small></div><div><strong>{amount(l.gross, record.currency)}</strong><p>Net {numberText(l.net)} · Tax {numberText(l.tax)}</p><small>{l.tax_snapshot.code} · Recoverable {numberText(l.recoverable)}</small></div><details className='payable-full'><summary>Source, price and accounting details</summary><p>Receipt {l.receipt_id} · Order line {l.order_line_id}</p><p>Price {l.unit_price} per {l.price_basis} {l.uom}. Original bill matching: order net {l.expected_net}; variance {l.variance}{l.variance_reason ? ' · ' + l.variance_reason : ''}.</p><p>{l.cost_account.account_code} · {l.cost_account.account_name}. Functional cost {l.base_cost}, recoverable tax {l.base_recoverable} {record.company_currency}.</p></details></div>)}</section>
  <section className='record-section'><h3>{record.state === 'submitted' ? 'Independent review' : record.state === 'posted' ? 'Posted and traceable' : 'Next action'}</h3><p>{record.state === 'posted' ? `Posted by ${record.poster}. The original is retained; a supplier return credit records a quantity correction.` : record.state === 'submitted' ? `Prepared by ${record.author}. The reviewer checks receipt quantities, classification, tax and conversion before posting.` : 'Save and inspect the draft, then submit it to an independent AP reviewer.'}</p><p>{record.explanation}</p>{!preview && <><div className='payable-actions'>{record.can_write && ['draft', 'returned'].includes(record.state) && <button className='secondary' onClick={() => setMode('edit')}>Revise draft</button>}{record.can_credit && <button className='secondary' onClick={() => {
              setCreditOf(record);
              setMode('credit');
            }}>Prepare return credit</button>}</div>{(record.can_write && ['draft', 'returned', 'submitted'].includes(record.state) || record.state === 'submitted' && record.can_return) && <><label className='field'>Decision reason<textarea value={reason} onChange={e => setReason(e.target.value)} /></label><div className='payable-actions'>{record.can_write && ['draft', 'returned'].includes(record.state) && <><button className='primary' disabled={busy || !reason.trim()} onClick={() => decision('submit')}>Submit for review</button><button className='text-button' disabled={busy || !reason.trim()} onClick={() => decision('cancel')}>Cancel draft</button></>}{record.can_write && record.state === 'submitted' && <button className='secondary' disabled={busy || !reason.trim()} onClick={() => decision('withdraw')}>Withdraw for correction</button>}{record.state === 'submitted' && record.can_return && <><button className='primary' disabled={busy || !reason.trim() || !record.can_review} onClick={() => decision('post')}>Post {record.kind === 'bill' ? 'bill' : 'credit'}</button><button className='secondary' disabled={busy || !reason.trim()} onClick={() => decision('return')}>Return for correction</button><small>Separate AP limit: {amount(record.posting_limit, record.company_currency)}</small></>}</div></>}</>}</section>
  {record.balance && <section className='record-section'><h3>Supplier balance · {amount(record.balance.open, record.currency)}</h3><p>Original less posted credits and recorded settlements. Bank clearance is separate.</p>{record.balance.settlements.map(a=><div key={a.id}>{a.can_open ? <button className='text-button' onClick={()=>onOpen(a.payment_id)}>{a.payment_id} · {amount(a.amount,record.currency)} · {a.effect>0?'Settled':'Reopened / refunded'}<ArrowRight/></button>:<p>{a.accounting_date} · {amount(a.amount,record.currency)} · {a.effect>0?'Settled':'Reopened / refunded'}</p>}</div>)}</section>}
  {record.credits.length > 0 && <section className='record-section'><h3>Linked return credits</h3>{record.credits.map(c => <button key={c.id} className='budget-work-link' onClick={() => act(() => open(c.id))}><strong>{c.reference}</strong><span>{c.state} · {amount(c.total, record.currency)}</span><ArrowRight /></button>)}</section>}
  <details className='record-section'><summary>Accounting, conversion & evidence history</summary><p>Supplier date {record.document_date}. Rate {record.rate}, dated {record.rate_date} · {record.rate_source}. Prepared by {record.author}.</p><div className='table-wrap' tabIndex={0} role='region' aria-label='Accounting table · scroll to compare all columns'><table><thead><tr><th>Account</th><th>Debit · {record.currency}</th><th>Credit · {record.currency}</th>{record.currency !== record.company_currency && <><th>Debit · {record.company_currency}</th><th>Credit · {record.company_currency}</th></>}</tr></thead><tbody>{record.journal.map((l, i) => <tr key={i}><td>{l.account_code} · {l.account_name}<small className='block'>{l.description}{l.rounding_adjustment !== '0.00' ? ` · FX allocation ${l.rounding_adjustment}` : ''}</small></td><td>{l.debit}</td><td>{l.credit}</td>{record.currency !== record.company_currency && <><td>{l.base_debit}</td><td>{l.base_credit}</td></>}</tr>)}</tbody></table></div>{record.history.map(e => <div className='history-item' key={e.id}><strong>{e.action} · {e.actor}</strong><p>{e.reason}</p><small>{e.at}</small></div>)}</details></>}
  {mode === 'report' && report && <><form className='payable-report-filters' onSubmit={e => {
        e.preventDefault();
        getReport();
      }}><label className='field'>Report project<select disabled={!!project} value={reportProject} onChange={e => setReportProject(e.target.value)}><option value=''>All authorised projects</option>{options.projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className='field'>Accounting through<input type='date' required max={options.today} value={to} onInput={e => setTo(e.target.value)} /></label><button className='secondary' disabled={busy}>Update report</button><button type='button' className='text-button' onClick={download}><Download />Export findings & rows</button></form><section className='payable-findings'><span className='eyebrow'>FINDINGS · {report.project_id ? options.projects.find(p => p.id === report.project_id)?.name : 'Authorised company projects'} · THROUGH {report.to}</span><h2>{amount(report.totals.open, company.currency)} net supplier balance</h2><ul>{report.findings.map(f => <li key={f}>{f}</li>)}</ul><div className='payable-actions'>{report.currencies.map(c => <span className='status' key={c.currency}>{amount(c.open, c.currency)} open</span>)}</div></section><div className='payable-metrics'><div><small>Original bills</small><strong>{amount(report.totals.original, company.currency)}</strong></div><div><small>Return credits</small><strong>{amount(report.totals.credited, company.currency)}</strong></div><div><small>Past due</small><strong>{amount(report.totals.overdue, company.currency)}</strong></div><div><small>AP control difference</small><strong>{amount(report.totals.difference, company.currency)}</strong></div></div><h3>Bill balances</h3>{report.rows.length ? <div className='table-wrap' tabIndex={0} role='region' aria-label='Accounting table · scroll to compare all columns'><table><thead><tr><th>Supplier bill</th><th>Project / due</th><th>Original</th><th>Credited</th><th>Settled</th><th>Open</th>{report.rows.some(r => r.currency !== company.currency) && <th>Open · {company.currency}</th>}</tr></thead><tbody>{report.rows.map(r => <tr key={r.id}><td><button className='table-link' onClick={() => act(() => open(r.id))}>{r.reference}</button><small className='block'>{r.vendor}</small></td><td>{r.project}<small className='block'>{r.due_date}{r.overdue ? ' · Past due' : ''}</small></td><td>{amount(r.original, r.currency)}</td><td>{amount(r.credited, r.currency)}</td><td>{amount(r.settled, r.currency)}</td><td>{amount(r.open, r.currency)}</td>{report.rows.some(row => row.currency !== company.currency) && <td>{numberText(r.base_open)}</td>}</tr>)}</tbody></table></div> : <p>No posted bills through this accounting date.</p>}
  <details className='record-section'><summary>{report.exceptions.length} receipt exceptions · unbilled or return credit needed</summary><div className='table-wrap' tabIndex={0} role='region' aria-label='Accounting table · scroll to compare all columns'><table><thead><tr><th>Receipt / product</th><th>Net accepted</th><th>Net billed</th><th>Unbilled</th><th>Credit needed</th></tr></thead><tbody>{report.exceptions.map(r => <tr key={r.id}><td>{r.delivery_reference}<small className='block'>{r.product} · {r.id}</small></td><td>{r.net_accepted} {r.uom}</td><td>{r.net_billed}</td><td>{r.available}</td><td>{r.credit_needed}</td></tr>)}</tbody></table></div></details><details className='record-section'><summary>Report basis and current scope</summary>{report.limitations.map(l => <p key={l}>{l}</p>)}</details></>}
  {mode === 'settings' && <><h2>Company payable control</h2><p>Set the liability account for new bills. Existing posted documents retain their original accounts.</p><form className='ledger-form' onSubmit={e => {
        e.preventDefault();
        act(async () => {
          await api('/payables/settings/' + company.id, {
            version: options.settings?.version,
            account_id: control,
            reason
          }, 'PUT');
          await load();
          setReason('');
        });
      }}><label className='field'>AP control account<select required value={control} onChange={e => setControl(e.target.value)}><option value=''>Choose payable liability account</option>{options.accounts.filter(a => a.active && a.purpose === 'payable' && a.type === 'liability').map(a => <option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}</select></label><label className='field'>Configuration reason<textarea required value={reason} onChange={e => setReason(e.target.value)} /></label><button className='primary' disabled={busy || preview}>Save AP control</button></form><div className='section-heading'><h2>Tax treatments</h2>{!preview && <button className='secondary' onClick={() => {
          setTax(null);
          setMode('tax');
        }}><Plus />New tax code</button>}</div><p>Define an explicit treatment, including zero tax. No tax jurisdiction is assumed.</p>{options.taxes.map(t => <button key={t.id} className='budget-work-link' disabled={preview} onClick={() => {
        setTax(t);
        setMode('tax');
      }}><strong>{t.code} · {t.name}</strong><span>{t.rate}% · {t.recoverable}% recoverable · {t.active ? 'Active' : 'Archived'}</span><ArrowRight /></button>)}<details className='record-section'><summary>Configuration history</summary>{options.configuration_history.map(e => <p key={e.id}><strong>{e.action} · {e.actor}</strong><br />{e.reason} · {e.at}</p>)}</details></>}
  {mode === 'tax' && <TaxForm key={tax?.id || 'new'} existing={tax} options={options} busy={busy} onSave={f => act(async () => {
      await api('/payables/taxes' + (tax ? '/' + tax.id : ''), f, tax ? 'PUT' : 'POST');
      await load();
      setMode('settings');
    })} />}
  </section>;
}
