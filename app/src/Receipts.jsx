import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Plus } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { D } from '../server/decimal.mjs';
import { ErrorBox, Empty } from './components.jsx';
import { receiptsCsv } from './receipts-export.js';
import './commercial.css';
import './certificates.css';
import './receipts.css';
const field = (label, child) => <label className='field'>{label}{child}</label>;
const total = rows => {
  try {
    return rows.reduce((s, r) => s.plus(r.amount || '0'), new D(0)).toFixed(2);
  } catch {
    return '';
  }
};
const next = r => r.reversed_by ? 'Reversed · original retained' : r.clearance ? 'Bank matched' : {
  draft: 'Preparer to finish and submit',
  returned: 'Preparer to correct and resubmit',
  submitted: 'Finance reviewer to approve',
  approved: 'Treasury to record actual receipt',
  recorded: 'Reconciler to match bank evidence',
  cancelled: 'Cancelled · history retained'
}[r.state];
async function evidence(file) {
  if (!file || file.size > 2 * 1024 * 1024 || !file.size) throw new Error('Choose a non-empty evidence file up to 2 MiB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name,
      base64: String(reader.result).split(',')[1]
    });
    reader.onerror = () => reject(new Error('Cannot read the selected file.'));
    reader.readAsDataURL(file);
  });
}
function ReceiptForm({
  record,
  options,
  initialInvoice,
  busy,
  onSave,
  onCancel
}) {
  const initial = options.balances.find(i => i.id === initialInvoice);
  const [f, set] = useState(record ? {
    ...record,
    allocations: record.allocations.map(a => ({
      invoice_id: a.invoice_id,
      amount: a.amount
    }))
  } : {
    company_id: options.company.id,
    bank_id: '',
    title: initial ? `Receipt · ${initial.title}` : '',
    accounting_date: options.today,
    allocations: [{
      invoice_id: initial?.id || '',
      amount: initial?.open || ''
    }],
    bank_amount: '',
    bank_rate: '1',
    rate_date: options.today,
    rate_source: '',
    explanation: ''
  });
  const change = (k, v) => set(x => ({
      ...x,
      [k]: v
    })),
    first = options.balances.find(i => i.id === f.allocations[0]?.invoice_id),
    bank = options.banks.find(b => b.id === f.bank_id),
    same = bank && first && bank.currency === first.currency,
    baseBank = bank?.currency === options.company.currency,
    allocated = total(f.allocations);
  const update = (index, k, v) => set(x => ({
    ...x,
    allocations: x.allocations.map((a, i) => i === index ? {
      ...a,
      [k]: v
    } : a)
  }));
  return <form className='offer-form' onSubmit={e => {
    e.preventDefault();
    onSave({
      ...f,
      bank_amount: same ? allocated : f.bank_amount,
      bank_rate: baseBank ? '1' : f.bank_rate,
      rate_date: baseBank ? f.accounting_date : f.rate_date,
      rate_source: baseBank ? 'Same-currency company bank; actual transaction evidence retained' : f.rate_source
    });
  }}><h2>{record ? 'Revise receipt' : 'Prepare customer receipt'}</h2><div className='offer-fields'>{field('Receipt purpose', <input required maxLength={160} value={f.title} onChange={e => change('title', e.target.value)} />)}{field('Company bank', <select required disabled={!!record} value={f.bank_id} onChange={e => change('bank_id', e.target.value)}><option value=''>Choose bank</option>{options.banks.filter(b => b.active || b.id === f.bank_id).map(b => <option key={b.id} value={b.id}>{b.name} · {b.currency}</option>)}</select>)}{field('Accounting date', <input type='date' required max={options.today} value={f.accounting_date} onInput={e => change('accounting_date', e.target.value)} />)}</div>
    <h3>Invoices this receipt settles</h3><p className='muted'>Choose one customer and currency. Each allocation keeps its project.</p>{f.allocations.map((a, i) => {
      const choices = options.balances.filter(b => !f.allocations.some((other, n) => n !== i && other.invoice_id === b.id) && (new D(b.open).gt(0) || b.id === a.invoice_id) && (!first || i === 0 && !record || b.customer_id === first.customer_id && b.currency === first.currency));
      return <div className='receipt-allocation' key={i}>{field(`Invoice ${i + 1}`, <select required value={a.invoice_id} onChange={e => update(i, 'invoice_id', e.target.value)}><option value=''>Choose posted invoice</option>{choices.map(b => <option key={b.id} value={b.id}>{b.title} · {b.project} · {amount(b.open, b.currency)} open</option>)}</select>)}{field(`Allocate ${i + 1} · ${first?.currency || 'invoice currency'}`, <input required inputMode='decimal' value={a.amount} onChange={e => update(i, 'amount', e.target.value)} />)}{f.allocations.length > 1 && <button className='text-button' type='button' onClick={() => change('allocations', f.allocations.filter((_, n) => n !== i))}>Remove allocation {i + 1}</button>}</div>;
    })}<button className='text-button' type='button' disabled={!first || f.allocations.length >= 30} onClick={() => change('allocations', [...f.allocations, {
      invoice_id: '',
      amount: ''
    }])}><Plus />Add another invoice</button>
    {first && allocated && <p className='receipt-total'>Allocated: <strong>{amount(allocated, first.currency)}</strong>{same ? ' · same amount at the bank' : ''}</p>}
    {!same && field(`Actual bank amount · ${bank?.currency || 'bank currency'}`, <input required inputMode='decimal' value={f.bank_amount} onChange={e => change('bank_amount', e.target.value)} />)}
    {bank && !baseBank && <details open className='record-section'><summary>Bank conversion evidence</summary><div className='offer-fields'>{field(`1 ${bank.currency} in ${options.company.currency}`, <input required inputMode='decimal' value={f.bank_rate} onChange={e => change('bank_rate', e.target.value)} />)}{field('Rate date', <input required type='date' max={f.accounting_date} value={f.rate_date} onInput={e => change('rate_date', e.target.value)} />)}{field('Rate source', <input required value={f.rate_source} onChange={e => change('rate_source', e.target.value)} />)}</div></details>}
    {field('Allocation basis and supporting explanation', <textarea required value={f.explanation} onChange={e => change('explanation', e.target.value)} />)}<p className='muted'>Saving and approval create no cash. The actual transaction is recorded separately with original evidence.</p><div className='inline-actions'><button className='primary' disabled={busy}>Save draft</button><button className='secondary' type='button' onClick={onCancel}>Cancel editing</button></div></form>;
}
function ReceiptActions({
  record: r,
  busy,
  onDecision,
  onReverse,
  today
}) {
  const [reason, setReason] = useState(''),
    [reference, setReference] = useState(''),
    [file, setFile] = useState(null),
    [date, setDate] = useState(today);
  const actions = [...(r.can_write && r.state === 'draft' ? [['submit', 'Submit for review']] : []), ...(r.can_write && ['submitted', 'approved'].includes(r.state) ? [['withdraw', 'Withdraw for revision']] : []), ...(r.can_write && ['draft', 'returned'].includes(r.state) ? [['cancel', 'Cancel receipt']] : []), ...(r.can_review && r.state === 'submitted' ? [['approve', 'Approve receipt']] : []), ...(r.can_return && ['submitted', 'approved'].includes(r.state) ? [['return', 'Return for correction']] : []), ...(r.can_record && r.state === 'approved' ? [['record', 'Record actual receipt']] : [])];
  const mayReverse = r.state === 'recorded' && r.can_reverse && !r.reversal_of && !r.reversed_by && !r.clearance;
  if (!actions.length && !mayReverse) return null;
  return <section className='record-section'>{field('Reason for this decision', <textarea value={reason} onChange={e => setReason(e.target.value)} />)}{actions.some(([a]) => a === 'record') && <div className='offer-fields'>{field('Actual bank reference', <input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} />)}{field('Original remittance evidence · up to 2 MiB', <input type='file' accept='.pdf,.png,.jpg,.jpeg,.txt' onChange={e => setFile(e.target.files[0] || null)} />)}</div>}<div className='inline-actions'>{actions.map(([a, label]) => <button key={a} className={['submit', 'approve', 'record'].includes(a) ? 'primary' : 'secondary'} disabled={busy || !reason.trim() || a === 'record' && (!reference.trim() || !file)} onClick={() => onDecision(a, {
        reason,
        bank_reference: reference,
        file
      })}>{label}</button>)}</div>{mayReverse && <details className='record-section'><summary>Correct a recorded receipt</summary><p>The original stays unchanged. A full reversal needs independent approval and evidence; no refund is sent.</p>{field('Correction accounting date', <input type='date' max={today} min={r.accounting_date} value={date} onInput={e => setDate(e.target.value)} />)}<button className='secondary' disabled={busy || !reason.trim() || !date} onClick={() => onReverse({
        accounting_date: date,
        reason
      })}>Prepare linked reversal</button></details>}</section>;
}
export default function Receipts({
  company,
  project,
  preview,
  onOpen,
  initialRecord,
  initialInvoice,
  onChanged
}) {
  const [options, setOptions] = useState(null),
    [rows, setRows] = useState([]),
    [report, setReport] = useState(null),
    [record, setRecord] = useState(null),
    [editing, setEditing] = useState(!!initialInvoice),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [scope, setScope] = useState(project?.id || ''),
    [cutoff, setCutoff] = useState(new Date().toISOString().slice(0, 10)),
    [state, setState] = useState('all');
  const query = `company=${company.id}${scope ? '&project=' + scope : ''}`;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setReport(null);
    Promise.all([api('/customer-receipts/options?' + query), api('/customer-receipts/documents?' + query), api('/customer-receipts/report?' + query + '&to=' + cutoff)]).then(([o, r, p]) => {
      if (live) {
        setOptions(o);
        setRows(r);
        setReport(p);
      }
    }).catch(e => {
      if (live) setError(e.message);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [query, cutoff, refresh]);
  useEffect(() => {
    let live = true;
    if (initialRecord) api('/customer-receipts/documents/' + initialRecord).then(r => {
      if (live) setRecord(r);
    }).catch(e => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [initialRecord]);
  const act = async fn => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setRefresh(v => v + 1);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const open = id => act(async () => {
    setRecord(await api('/customer-receipts/documents/' + id));
    setEditing(false);
  });
  const exportReport = () => {
    const u = URL.createObjectURL(new Blob([receiptsCsv(report)], {
        type: 'text/csv;charset=utf-8'
      })),
      a = document.createElement('a');
    a.href = u;
    a.download = 'builder-customer-receipts.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const back = () => {
    setRecord(null);
    setEditing(false);
    setError('');
  };
  return <div className='receipts certificates-page'><ErrorBox message={error} />{(record || editing) && <button className='back' onClick={back}><ArrowLeft />All customer receipts</button>}{editing && options ? <ReceiptForm key={record?.id || initialInvoice || 'new'} record={record} options={options} initialInvoice={initialInvoice} busy={busy} onCancel={() => setEditing(false)} onSave={body => act(async () => {
      setRecord(await api('/customer-receipts/documents' + (record ? '/' + record.id : ''), body, record ? 'PUT' : 'POST'));
      setEditing(false);
    })} /> : record ? <>
    <div className='section-head'><div><p className='eyebrow'>{record.state_label} · {record.id}</p><h2>{record.title}</h2><p>{record.customer} · {record.accounting_date}</p></div>{options?.can_bank_read && record.state === 'recorded' && <button className='secondary' onClick={() => onOpen('BANK-STATEMENTS')}>Open bank evidence</button>}{record.journal_id && record.can_open_ledger && <button className='secondary' onClick={() => onOpen(record.journal_id)}>Open posted journal</button>}</div>
    <div className='offer-overview'><div><small>Allocated to invoices</small><strong>{amount(record.total, record.currency)}</strong></div><div><small>{record.currency === record.bank.currency ? 'Invoices covered' : record.reversal_of ? 'Reversing bank amount' : 'Bank receipt'}</small><strong>{record.currency === record.bank.currency ? record.allocations.length : amount(record.bank_amount, record.bank.currency)}</strong></div><div><small>Next action</small><strong>{next(record)}</strong></div></div>
    <div className='certificate-findings'><h3>What this tells you</h3><p>{record.state === 'recorded' ? `${amount(record.company_total, company.currency)} recorded in the ledger. ${record.clearance ? 'Bank evidence matched on ' + record.clearance.date + '.' : 'Bank clearance awaits independent matching.'}` : 'This plan has not created accounting or received cash.'}</p><p>{record.reversal_of ? 'This corrects an earlier receipt; both remain in history.' : 'Receipt allocation reduces receivables and does not recognise revenue again.'}</p></div>
    {!preview && record.can_write && ['draft', 'returned'].includes(record.state) && !record.reversal_of && <button className='secondary' onClick={() => setEditing(true)}>Edit receipt</button>}
    <h3>Invoice allocations</h3><div className='table-scroll'><table className='certificate-table'><thead><tr><th>Invoice</th><th>Project</th><th>Allocated</th>{record.currency !== company.currency && <th>Company carrying amount</th>}</tr></thead><tbody>{record.allocations.map(a => <tr key={a.invoice_id}><td>{record.can_open_invoice ? <button className='text-button' onClick={() => onOpen(a.invoice_id)}>{a.reference}</button> : a.reference}<small>{a.invoice_id}</small></td><td>{options?.projects.find(p => p.id === a.project_id)?.name || a.project_id}</td><td>{amount(a.amount, record.currency)}</td>{record.currency !== company.currency && <td>{amount(a.base_amount, company.currency)}</td>}</tr>)}</tbody></table></div>
    {!preview && <ReceiptActions key={record.id + '-' + record.version} record={record} busy={busy} today={options?.today || cutoff} onDecision={(action, input) => act(async () => {
        setRecord(await api(`/customer-receipts/documents/${record.id}/decision`, {
          ...input,
          version: record.version,
          action,
          ...(action === 'record' ? {
            file: await evidence(input.file)
          } : {
            file: undefined
          })
        }));
      })} onReverse={input => act(async () => setRecord(await api(`/customer-receipts/documents/${record.id}/reversal`, {
        ...input,
        version: record.version
      })))} />}
    <details className='record-section'><summary>Evidence and conversion</summary><p>{record.explanation}</p><p>{record.bank.name} · 1 {record.bank.currency} = {record.bank_rate} {company.currency} · {record.rate_date} · {record.rate_source}</p>{record.evidence && <><a className='text-button' href={`/api/customer-receipts/evidence/${record.evidence.id}`}>Download {record.evidence.filename}</a><p className='receipt-hash'>SHA256 {record.evidence.sha256}</p></>}{record.reversal_of && <button className='text-button' onClick={() => open(record.reversal_of)}>Open original receipt</button>}{record.reversed_by && <button className='text-button' onClick={() => open(record.reversed_by)}>Open correcting reversal</button>}</details>
    <details className='record-section'><summary>History · {record.history.length} events</summary>{record.history.map(h => <div className='certificate-history' key={h.id}><strong>{h.action}</strong><span>{h.actor} · {h.at.slice(0, 16).replace('T', ' ')}</span><p>{h.reason}</p></div>)}</details>
  </> : <><div className='section-head'><div><p className='eyebrow'>CUSTOMER MONEY</p><h2>Customer receipts</h2><p>Follow a remittance from invoice allocation to bank evidence.</p></div><div className='inline-actions'>{options?.can_bank_read && <button className='secondary' onClick={() => onOpen('BANK-STATEMENTS')}>Bank evidence</button>}{options?.can_write && !preview && <button className='primary' onClick={() => setEditing(true)}><Plus />New receipt</button>}<button className='secondary' disabled={!report || loading} onClick={exportReport}><Download />Export findings</button></div></div>
    <div className='certificate-filters'>{!project && field('Receipt project', <select value={scope} onChange={e => setScope(e.target.value)}><option value=''>All authorised projects</option>{options?.projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select>)}{field('Accounting through', <input type='date' value={cutoff} max={options?.today} onInput={e => setCutoff(e.target.value)} />)}</div>
    {loading && <p role='status'>Loading receipt findings…</p>}{report && <><div className='certificate-findings'><h3>What this tells you</h3><ul>{report.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></div><div className='offer-overview'><div><small>Net recorded receipts</small><strong>{amount(report.totals.net, company.currency)}</strong></div><div><small>Awaiting bank match</small><strong>{amount(report.totals.uncleared, company.currency)}</strong></div><div><small>Open receivables</small><strong>{amount(report.reconciliation.source_open, company.currency)}</strong></div></div></>}
    <div className='section-heading'><h3>Receipts and next actions</h3>{field('Receipt status', <select value={state} onChange={e => setState(e.target.value)}><option value='all'>All current states</option>{['draft', 'submitted', 'approved', 'recorded', 'returned', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select>)}</div><p className='muted'>Current workflow states; recorded cash and open items above use the accounting cutoff.</p>
    <div className='certificate-register'>{rows.filter(r => state === 'all' || r.state === state).map(r => {
          const Tag = r.can_open ? 'button' : 'div';
          return <Tag className='certificate-row' key={r.id} onClick={r.can_open ? () => open(r.id) : undefined}><span><strong>{r.title}</strong><small>{r.customer} · {r.accounting_date}</small><small>{r.scope_partial ? 'Allocation in this scope · ' : ''}{next(r)}</small></span><strong>{amount(r.total, r.currency)}</strong>{r.can_open && <ArrowRight />}</Tag>;
        })}</div>{!rows.length && !loading && <Empty>No customer receipts in this scope. Start with a posted client invoice.</Empty>}
    {report && <><details className='record-section'><summary>Open invoices · {report.open_items.filter(i => new D(i.open).gt(0)).length}</summary>{report.open_items.filter(i => new D(i.open).gt(0)).map(i => <div className='receipt-open-item' key={i.id}><strong>{i.title}</strong><span>{i.project} · Due {i.due_date} · {amount(i.open, i.currency)} open</span>{options?.can_write && !preview && <button className='text-button' onClick={() => onOpen('RCN:' + i.id)}>Prepare receipt</button>}</div>)}</details><details className='record-section'><summary>Recorded allocations and report basis</summary><div className='table-scroll'><table className='certificate-table'><thead><tr><th>Receipt / invoice</th><th>Project</th><th>Direction</th><th>Bank amount</th><th>Bank evidence</th></tr></thead><tbody>{report.rows.map((r, i) => <tr key={i}><td>{r.can_open ? <button className='text-button' onClick={() => open(r.receipt_id)}>{r.title}</button> : r.title}<small>{r.invoice_title}</small></td><td>{r.project}</td><td>{r.direction}</td><td>{amount(r.bank_amount, r.bank_currency)}</td><td>{r.clearance?.statement || 'Awaiting match'}</td></tr>)}</tbody></table></div>{report.limitations.map(l => <p key={l}>{l}</p>)}</details></>}
  </>}</div>;
}
