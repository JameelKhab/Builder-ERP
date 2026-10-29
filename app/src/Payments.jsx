import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Wallet, Plus, Download } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
import { paymentsCsv } from './payments-export.js';
import './ledger.css';
import './payables.css';
import './payments.css';
const field = (label, content) => <label className='field'>{label}{content}</label>;
function PaymentForm({
  record,
  options,
  onSave,
  busy
}) {
  const [f, set] = useState(record ? {
    ...record,
    allocations: record.allocations.map(a => ({
      bill_id: a.bill_id,
      amount: a.amount
    }))
  } : {
    company_id: options.company.id,
    bank_id: '',
    kind: 'payment',
    title: '',
    accounting_date: options.today,
    bank_amount: '',
    bank_rate: '1',
    rate_date: options.today,
    rate_source: '',
    explanation: '',
    allocations: [{
      bill_id: '',
      amount: ''
    }]
  });
  const change = (k, v) => set({
      ...f,
      [k]: v
    }),
    bank = options.banks.find(b => b.id === f.bank_id),
    first = options.balances.find(b => b.id === f.allocations[0]?.bill_id),
    choices = options.balances.filter(b => (f.kind === 'payment' ? Number(b.open) > 0 : Number(b.open) < 0) && (!first || b.vendor_id === first.vendor_id && b.currency === first.currency));
  const line = (i, k, v) => set({
    ...f,
    allocations: f.allocations.map((a, n) => n === i ? {
      ...a,
      [k]: v
    } : a)
  });
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(Object.fromEntries(['company_id', 'bank_id', 'kind', 'title', 'accounting_date', 'bank_amount', 'bank_rate', 'rate_date', 'rate_source', 'explanation', 'allocations', 'version'].map(k => [k, f[k]])));
  }}><div className='ledger-field-grid'>
 {field('Purpose', <input required value={f.title} onChange={e => change('title', e.target.value)} maxLength={160} />)}
 {field('Direction', <select disabled={!!record} value={f.kind} onChange={e => set({
        ...f,
        kind: e.target.value,
        allocations: [{
          bill_id: '',
          amount: ''
        }]
      })}><option value='payment'>Pay supplier</option><option value='refund'>Receive supplier refund</option></select>)}
 {field('Company bank', <select required disabled={!!record} value={f.bank_id} onChange={e => change('bank_id', e.target.value)}><option value=''>Choose accounting bank</option>{options.banks.filter(b => b.active || b.id === f.bank_id).map(b => <option key={b.id} value={b.id}>{b.name} · {b.currency}</option>)}</select>)}
 {field('Accounting date', <input required type='date' max={options.today} value={f.accounting_date} onInput={e => change('accounting_date', e.target.value)} />)}
 </div><div><h3>{f.kind === 'payment' ? 'Bills to settle' : 'Supplier credits to refund'}</h3><p>Choose one supplier and currency. Company authority is required for a payment across projects.</p></div>
 {f.allocations.map((a, i) => <section className='payable-line-form' key={i}><div className='ledger-field-grid'>{field(`Bill ${i + 1}`, <select required value={a.bill_id} onChange={e => line(i, 'bill_id', e.target.value)}><option value=''>Choose bill balance</option>{(i === 0 && !record ? options.balances.filter(b => f.kind === 'payment' ? Number(b.open) > 0 : Number(b.open) < 0) : choices).map(b => <option key={b.id} value={b.id}>{b.reference} · {b.vendor} · {b.project} · {amount(b.open, b.currency)} open{Number(b.reserved) > 0 ? ` · ${b.reserved} reserved` : ''}</option>)}</select>)}{field(`Allocation ${i + 1} · ${first?.currency || 'bill currency'}`, <input required inputMode='decimal' value={a.amount} onChange={e => line(i, 'amount', e.target.value)} />)}</div>{f.allocations.length > 1 && <button type='button' className='text-button' onClick={() => change('allocations', f.allocations.filter((_, n) => n !== i))}>Remove allocation {i + 1}</button>}</section>)}
 <button className='text-button' type='button' disabled={f.allocations.length >= 30 || !first} onClick={() => change('allocations', [...f.allocations, {
      bill_id: '',
      amount: ''
    }])}><Plus />Add another bill</button>
 <section className='ledger-rate'><h3>Bank amount & conversion</h3><p>The bank amount is separate from the original bill carrying value. This form records no bank transfer.</p><div className='ledger-field-grid'>{field(`Bank amount · ${bank?.currency || 'bank currency'}`, <input required inputMode='decimal' value={f.bank_amount} onChange={e => change('bank_amount', e.target.value)} />)}{field(`1 ${bank?.currency || 'bank currency'} in ${options.company.currency}`, <input required inputMode='decimal' value={f.bank_rate} onChange={e => change('bank_rate', e.target.value)} />)}{field('Rate date', <input required type='date' max={f.accounting_date} value={f.rate_date} onInput={e => change('rate_date', e.target.value)} />)}{field('Rate / conversion source', <input required value={f.rate_source} onChange={e => change('rate_source', e.target.value)} />)}</div></section>
 {field('Payment purpose and supporting evidence', <textarea required value={f.explanation} onChange={e => change('explanation', e.target.value)} />)}<button className='primary' disabled={busy}>Save draft for review</button></form>;
}
function BankForm({
  options,
  onSave,
  busy
}) {
  const [f, set] = useState({
    company_id: options.company.id,
    name: '',
    currency: options.company.currency,
    account_id: '',
    gain_account_id: '',
    loss_account_id: '',
    active: true,
    reason: ''
  });
  const change = (k, v) => set({
    ...f,
    [k]: v
  });
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h3>Add accounting bank</h3><p>Use a clear alias. No bank credentials or executable payment instructions are stored here.</p><div className='ledger-field-grid'>{field('Bank alias', <input required value={f.name} onChange={e => change('name', e.target.value)} />)}{field('Bank currency', <select value={f.currency} onChange={e => change('currency', e.target.value)}>{['AED', 'USD', 'EUR'].map(c => <option key={c}>{c}</option>)}</select>)}{[['account_id', 'Bank asset account', a => a.purpose === 'bank' && a.type === 'asset'], ['gain_account_id', 'Exchange gain account', a => a.purpose === 'general' && a.type === 'income'], ['loss_account_id', 'Exchange loss account', a => a.purpose === 'general' && a.type === 'expense']].map(([k, label, filter]) => <React.Fragment key={k}>{field(label, <select required value={f[k]} onChange={e => change(k, e.target.value)}><option value=''>Choose account</option>{options.accounts.filter(a => a.active && filter(a)).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>)}</React.Fragment>)}</div>{field('Configuration reason', <textarea required value={f.reason} onChange={e => change('reason', e.target.value)} />)}<button className='primary' disabled={busy}>Register accounting bank</button></form>;
}
function StatementForm({
  options,
  onSave,
  busy
}) {
  const [f, set] = useState({
    bank_id: '',
    reference: '',
    start_date: options.today,
    end_date: options.today,
    opening: '',
    closing: '',
    reason: '',
    rows: [{
      date: options.today,
      direction: 'out',
      amount: '',
      reference: ''
    }]
  });
  const change = (k, v) => set({
    ...f,
    [k]: v
  });
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h3>Record statement evidence</h3><p>Enter a complete dated statement section. It becomes immutable; matching is a separate step.</p><div className='ledger-field-grid'>{field('Company bank', <select required value={f.bank_id} onChange={e => change('bank_id', e.target.value)}><option value=''>Choose bank</option>{options.banks.map(b => <option key={b.id} value={b.id}>{b.name} · {b.currency}</option>)}</select>)}{field('Statement reference', <input required value={f.reference} onChange={e => change('reference', e.target.value)} />)}{['start_date', 'end_date'].map(k => <React.Fragment key={k}>{field(k === 'start_date' ? 'From date' : 'Through date', <input required type='date' max={options.today} value={f[k]} onInput={e => change(k, e.target.value)} />)}</React.Fragment>)}{['opening', 'closing'].map(k => <React.Fragment key={k}>{field(k === 'opening' ? 'Opening balance' : 'Closing balance', <input required inputMode='decimal' value={f[k]} onChange={e => change(k, e.target.value)} />)}</React.Fragment>)}</div>
 {f.rows.map((r, i) => <section className='payable-line-form' key={i}><strong>Statement row {i + 1}</strong><div className='ledger-field-grid'>{['date', 'direction', 'amount', 'reference'].map(k => {
          const update = v => change('rows', f.rows.map((x, n) => n === i ? {
            ...x,
            [k]: v
          } : x));
          return <React.Fragment key={k}>{field(`${k} · row ${i + 1}`, k === 'direction' ? <select value={r[k]} onChange={e => update(e.target.value)}><option value='out'>Money out</option><option value='in'>Money in</option></select> : <input required type={k === 'date' ? 'date' : 'text'} value={r[k]} onInput={e => update(e.target.value)} />)}</React.Fragment>;
        })}</div>{f.rows.length > 1 && <button type='button' className='text-button' onClick={() => change('rows', f.rows.filter((_, n) => n !== i))}>Remove row {i + 1}</button>}</section>)}<button type='button' className='text-button' onClick={() => change('rows', [...f.rows, {
      date: options.today,
      direction: 'out',
      amount: '',
      reference: ''
    }])}>Add statement row</button>{field('Evidence / source', <textarea required value={f.reason} onChange={e => change('reason', e.target.value)} />)}<button className='primary' disabled={busy}>Save statement evidence</button></form>;
}
function MatchRow({
  row,
  payments,
  onMatch,
  onOpen,
  busy,
  preview
}) {
  const [ids, setIds] = useState([]),
    [reason, setReason] = useState('');
  const active = row.matches.filter(m => m.active);
  return <details className='record-section'><summary>{row.date} · {row.direction === 'out' ? 'Out' : 'In'} {row.amount} · {row.reference} · {active.length ? 'Matched' : 'Needs match'}</summary>{active.map(m => <p key={m.source_type+'-'+m.id}><button className='text-button' onClick={()=>onOpen(m.payment_id||m.receipt_id)}>{m.title}</button> · {m.bank_reference}</p>)}{!active.length && payments.map(p => <label className='ledger-check' key={p.id}><input type='checkbox' disabled={preview} checked={ids.includes(p.id)} onChange={e => setIds(e.target.checked ? [...ids, p.id] : ids.filter(x => x !== p.id))} />{p.title} · {amount(p.bank_amount, p.bank_currency)}</label>)}{!preview && <>{field('Reconciliation reason', <textarea value={reason} onChange={e => setReason(e.target.value)} />)}<button className='primary' disabled={busy || !reason.trim() || !active.length && !ids.length} onClick={() => onMatch({
        version: row.version,
        action: active.length ? 'unmatch' : 'match',
        payment_ids: ids.filter(id=>id.startsWith('PAY-')),
        receipt_ids: ids.filter(id=>id.startsWith('CRC-')),
        reason
      })}>{active.length ? 'Remove current match' : 'Match exact bank amount'}</button></>}<details><summary>Match history</summary>{row.matches.map(m => <p key={m.source_type+'-'+m.id}>{m.payment_id||m.receipt_id} · {m.active ? 'Active' : 'Removed'} · {m.at}</p>)}</details></details>;
}
export default function Payments({
  company,
  project,
  preview,
  onOpen,
  initialRecord,
  initialView,
  onChanged
}) {
  const [listProject, setListProject] = useState(project?.id || ''),
    [listState, setListState] = useState('all');
  const [options, setOptions] = useState(null),
    [rows, setRows] = useState([]),
    [customerRows,setCustomerRows]=useState([]),
    [tab, setTab] = useState(initialView||'payments'),
    [record, setRecord] = useState(null),
    [form, setForm] = useState(false),
    [report, setReport] = useState(null),
    [statements, setStatements] = useState([]),
    [newStatement, setNewStatement] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [ref, setRef] = useState(''),
    [evidence, setEvidence] = useState(''),
    [cutoff, setCutoff] = useState(''),
    [reportProject, setReportProject] = useState(project?.id || ''),
    [reverseDate, setReverseDate] = useState('');
  const query = `company=${company.id}${project ? '&project=' + project.id : ''}`;
  const load = async () => {
    const [o, r] = await Promise.all([api('/payments/options?' + query), api('/payments/documents?' + query)]);
    setOptions(o);
    setRows(r);
    if(o.can_bank_read) setCustomerRows(await api('/customer-receipts/documents?company='+company.id));
    setCutoff(x => x || o.today);
    setReverseDate(x => x || o.today);
  };
  const open = async id => {
    setRecord(await api('/payments/documents/' + id));
    setForm(false);
    setReason('');
    setRef('');
    setEvidence('');
  };
  const act = async fn => {
    setError('');
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let live = true;
    Promise.all([api('/payments/options?' + query), api('/payments/documents?' + query), initialRecord ? api('/payments/documents/' + initialRecord) : null]).then(([o, r, d]) => {
      if (live) {
        setOptions(o);
        setRows(r);
        setRecord(d);
        setCutoff(o.today);
        setReverseDate(o.today);
        if(initialView==='bank'&&o.can_bank_read) Promise.all([api('/payments/statements?company='+company.id),api('/customer-receipts/documents?company='+company.id)]).then(([statements,receipts])=>{if(live){setStatements(statements);setCustomerRows(receipts);}}).catch(e=>{if(live)setError(e.message);});
      }
    }).catch(e => {
      if (live) setError(e.message);
    });
    return () => {
      live = false;
    };
  }, [query, initialRecord, initialView]);
  const go = t => act(async () => {
    setTab(t);
    setRecord(null);
    setForm(false);
    if (t === 'findings') setReport(await api('/payments/report?company=' + company.id + '&to=' + cutoff + (reportProject ? '&project=' + reportProject : '')));
    if (t === 'bank') {setStatements(await api('/payments/statements?company=' + company.id));setCustomerRows(await api('/customer-receipts/documents?company='+company.id));}
  });
  const decide = action => act(async () => {
    setRecord(await api(`/payments/documents/${record.id}/decision`, {
      version: record.version,
      action,
      reason,
      bank_reference: ref,
      evidence
    }));
    setReason('');
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([paymentsCsv(report)], {
        type: 'text/csv;charset=utf-8'
      })),
      a = document.createElement('a');
    a.href = url;
    a.download = `Builder-ERP-Payments-${company.id}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!options) return <><ErrorBox message={error} /><p role='status'>Loading payments…</p></>;
  const shownRows = rows.filter(r => (!listProject || r.project_id === listProject) && (listState === 'all' || listState === 'needs-match' ? listState === 'all' || r.state === 'recorded' && !r.clearance : r.state === listState));
  const actions = record ? record.state === 'draft' || record.state === 'returned' ? record.can_write ? ['submit', 'cancel'] : [] : record.state === 'submitted' ? [...(record.can_review ? ['approve'] : []), ...(record.can_return ? ['return'] : []), ...(record.can_write ? ['withdraw'] : [])] : record.state === 'approved' ? [...(record.can_record ? ['record'] : []), ...(record.can_return ? ['return'] : []), ...(record.can_write ? ['withdraw'] : [])] : [] : [];
  return <div className='ledger payments'><div className='section-heading'><div><h2><Wallet />{tab==='bank'?'Bank statements':'Payments & cash flow'}</h2><p className='muted'>{project?.name || company.name} · {tab==='bank'?'Customer receipts and supplier settlement':'Supplier payments and refunds'}</p></div>{options.can_write && !preview && !record && !form && tab === 'payments' && <button className='primary' onClick={() => setForm(true)}><Plus />New payment</button>}</div><p className='scope-note'>{tab==='bank'?'Match recorded transactions to actual bank evidence. Each row retains its sources and reconciliation history.':'Prepare → Approve → Record transaction → Match bank. Approved plans are separate from cash. Builder ERP does not send money.'}</p><nav className='ledger-nav' aria-label='Payment views'>{[['payments', 'Payments'], ['findings', 'Cash findings'], ...(options.can_bank_read ? [['bank', 'Bank statements']] : []), ...(options.can_manage ? [['setup', 'Bank setup']] : [])].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => go(k)}>{l}</button>)}</nav><ErrorBox message={error} />
 {form ? <><button className='back' onClick={() => setForm(false)}><ArrowLeft />Back to {record ? 'payment' : 'payments'}</button><h3>{record ? 'Revise payment' : 'Prepare payment'}</h3><PaymentForm key={record?.id || 'new'} record={record} options={options} busy={busy} onSave={body => act(async () => {
        const r = await api('/payments/documents' + (record ? '/' + record.id : ''), body, record ? 'PUT' : 'POST');
        await open(r.id);
      })} /></> : record ? <><button className='back' onClick={() => setRecord(null)}><ArrowLeft />All payments</button><div className='ledger-record-heading'><div><span className='eyebrow'>{record.id} · {record.state_label}</span><h3>{record.title}</h3><p>{record.vendor} · {record.accounting_date}</p></div><div className='ledger-total'><strong>{amount(record.total, record.currency)}</strong><span>Bank {record.direction === 'out' ? 'out' : 'in'} · {amount(record.bank_amount, record.bank.currency)}</span>{record.bank.currency !== company.currency && <small>{amount(record.company_total, company.currency)} functional</small>}</div></div><section className='ledger-source'><h3>{record.state === 'recorded' ? record.reversed_by ? 'Reversed with a separate record' : record.clearance ? 'Matched to bank evidence' : 'Recorded · awaiting bank match' : record.state === 'approved' ? 'Approval complete · record the evidenced transaction' : record.state === 'submitted' ? 'Next: independent payment review' : 'Next: complete and submit for review'}</h3><p>{record.explanation}</p>{record.bank_reference && <p>Bank reference: <strong>{record.bank_reference}</strong> · {record.evidence}</p>}{record.clearance && <p>Statement {record.clearance.statement} · {record.clearance.date}</p>}{record.reversed_by && <button className='text-button' onClick={() => act(() => open(record.reversed_by))}>Open reversal</button>}{record.reversal_of && <button className='text-button' onClick={() => act(() => open(record.reversal_of))}>Open original payment</button>}{record.can_open_ledger && record.journal_id && <button className='text-button' onClick={() => onOpen(record.journal_id)}>Open posted journal<ArrowRight /></button>}</section>
 <h3>Bill allocations</h3><div className='ledger-table-wrap'><table className='ledger-table'><thead><tr><th>Bill / project</th><th>Allocation</th><th>Carrying value</th><th>Bank value</th></tr></thead><tbody>{record.allocations.map(a => <tr key={a.bill_id}><td data-label='Bill'>{record.can_open_bill ? <button className='text-button' onClick={() => onOpen(a.bill_id)}>{a.reference}</button> : a.reference}<small>{options.projects.find(p => p.id === a.project_id)?.name}</small></td><td data-label='Allocation'>{amount(a.amount, record.currency)}</td><td data-label='Carrying value'>{amount(a.base_amount, company.currency)}</td><td data-label='Bank value'>{amount(a.bank_base, company.currency)}</td></tr>)}</tbody></table></div>
 {!preview && record.can_write && !record.reversal_of && ['draft', 'returned'].includes(record.state) && <button className='secondary' onClick={() => setForm(true)}>Edit draft</button>}
 {!preview && actions.length > 0 && <section className='ledger-decision'><h3>Next action</h3>{field('Decision reason', <textarea value={reason} onChange={e => setReason(e.target.value)} />)}{actions.includes('record') && <div className='ledger-field-grid'>{field('Actual bank reference', <input value={ref} onChange={e => setRef(e.target.value)} />)}{field('Transaction evidence', <textarea value={evidence} onChange={e => setEvidence(e.target.value)} />)}</div>}<div className='payment-actions'>{actions.map(a => <button key={a} className={['submit', 'approve', 'record'].includes(a) ? 'primary' : 'secondary'} disabled={busy || !reason.trim() || a === 'record' && (!ref.trim() || !evidence.trim())} onClick={() => decide(a)}>{{
              submit: 'Submit for approval',
              approve: 'Approve amount',
              record: 'Record offline transaction',
              return: 'Request changes',
              withdraw: 'Withdraw for revision',
              cancel: 'Cancel draft'
            }[a]}</button>)}</div></section>}
 {!preview && record.state === 'recorded' && record.can_reverse && !record.reversal_of && !record.reversed_by && !record.clearance && <details className='record-section'><summary>Correct with a full reversal</summary><p>Use only with evidence of a correction or returned transaction. Independent approval is required again.</p>{field('Reversal accounting date', <input type='date' min={record.accounting_date} max={options.today} value={reverseDate} onInput={e => setReverseDate(e.target.value)} />)}{field('Reversal reason and evidence', <textarea value={reason} onChange={e => setReason(e.target.value)} />)}<button className='secondary' disabled={busy || !reason.trim()} onClick={() => act(async () => {
          const r = await api(`/payments/documents/${record.id}/reversal`, {
            version: record.version,
            accounting_date: reverseDate,
            reason
          });
          await open(r.id);
        })}>Prepare reversal</button></details>}
 <details className='record-section'><summary>Conversion & recorded history</summary><p>{record.rate_date} · {record.rate_source} · 1 {record.bank.currency} = {record.bank_rate} {company.currency}</p><p>Prepared by {record.author}. Approval and recording are separate decisions.</p>{record.history.map(h => <div className='history-item' key={h.id}><strong>{h.action} · {h.actor}</strong><p>{h.reason}</p><small>{h.at}</small></div>)}</details></> : tab === 'payments' ? <><div className='ledger-field-grid payment-register-filters'>{!project && field('Payment project', <select value={listProject} onChange={e => setListProject(e.target.value)}><option value=''>All authorised projects</option>{options.projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select>)}{field('Payment status', <select value={listState} onChange={e => setListState(e.target.value)}>{[['all', 'All payments'], ['draft', 'Drafts'], ['submitted', 'Needs approval'], ['approved', 'Approved · not recorded'], ['needs-match', 'Recorded · needs bank match'], ['recorded', 'All recorded'], ['returned', 'Changes requested'], ['cancelled', 'Cancelled']].map(([k, l]) => <option value={k} key={k}>{l}</option>)}</select>)}</div><p className='muted'>{shownRows.length} payments in this view</p><div className='ledger-register'>{shownRows.length ? shownRows.map(r => <button className='ledger-row' key={r.id} onClick={() => act(() => open(r.id))}><span><strong>{r.title}</strong><small>{r.vendor} · {r.project_id ? options.projects.find(p => p.id === r.project_id)?.name : 'Multiple projects'} · {r.accounting_date}</small><small>{r.state === 'recorded' ? r.reversed_by ? 'Reversed' : r.clearance ? 'Bank matched' : 'Recorded · awaiting bank match' : r.state_label}</small></span><span><strong>{amount(r.total, r.currency)}</strong><small>{r.kind === 'refund' ? 'Supplier refund' : r.reversal_of ? 'Reversal' : 'Supplier payment'}</small></span><ArrowRight /></button>) : <Empty>No supplier payments in this scope. Check the selected filters or start with a posted supplier bill.</Empty>}</div></> : tab === 'findings' ? <><form className='ledger-field-grid' onSubmit={e => {
        e.preventDefault();
        act(async () => setReport(await api(`/payments/report?company=${company.id}&to=${cutoff}${reportProject ? '&project=' + reportProject : ''}`)));
      }}>{!project && field('Report project', <select value={reportProject} onChange={e => setReportProject(e.target.value)}><option value=''>Authorised company projects</option>{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}{field('Accounting through', <input type='date' required max={options.today} value={cutoff} onInput={e => setCutoff(e.target.value)} />)}<button className='secondary' disabled={busy}>Apply scope</button></form>{report && <><section className='ledger-findings'><div className='section-heading'><h3>What the records show</h3><button className='text-button' onClick={download}><Download />Export findings & rows</button></div><p className='muted'>{report.project_id ? options.projects.find(p => p.id === report.project_id)?.name : 'Authorised company projects'} · through {report.to} · {company.currency}</p>{report.findings.map(f => <p key={f}>{f}</p>)}</section><div className='payment-metrics'>{[['out', 'Recorded out'], ['incoming', 'Recorded in'], ['uncleared', 'Net awaiting bank match']].map(([k, l]) => <div key={k}><span>{l}</span><strong>{amount(report.totals[k], company.currency)}</strong></div>)}</div><h3>Recorded movements</h3><div className='ledger-table-wrap'><table className='ledger-table'><thead><tr><th>Payment / bill</th>{!report.project_id&&<th>Project</th>}<th>Direction</th><th>Bank amount</th><th>Bank evidence</th></tr></thead><tbody>{report.rows.map((r, i) => <tr key={i}><td data-label='Payment / bill'>{r.can_open ? <button className='text-button' onClick={() => act(() => open(r.payment_id))}>{r.title}</button> : r.title}<small>{r.bill_reference} · {r.date}</small></td>{!report.project_id&&<td data-label='Project'>{r.project}</td>}<td data-label='Direction'>{r.direction === 'out' ? 'Out' : 'In'}</td><td data-label='Bank amount'>{amount(r.bank_amount, r.bank_currency)}{r.bank_currency !== company.currency && <small>{amount(r.bank_base, company.currency)}</small>}</td><td data-label='Bank evidence'>{r.clearance ? `${r.clearance.statement} · ${r.clearance.date}` : 'Awaiting match'}</td></tr>)}</tbody></table></div><details className='record-section'><summary>Approved plans · excluded from cash ({report.planned.length})</summary>{report.planned.map(p => <p key={p.id}>{p.title} · {amount(p.bank_amount, p.bank_currency)}</p>)}</details><details className='record-section'><summary>Report basis & limits</summary>{report.limitations.map(l => <p key={l}>{l}</p>)}</details></>}</> : tab === 'bank' ? <>{newStatement ? <><button className='back' onClick={() => setNewStatement(false)}><ArrowLeft />Back to statements</button><StatementForm options={options} busy={busy} onSave={body => act(async () => {
          await api('/payments/statements', body);
          setStatements(await api('/payments/statements?company=' + company.id));
          setNewStatement(false);
        })} /></> : <><div className='section-heading'><h3>Statement evidence</h3>{!preview && options.can_reconcile && <button className='secondary' onClick={() => setNewStatement(true)}>Add statement</button>}</div>{!statements.length && <Empty>No bank statement evidence yet.</Empty>}{statements.map(s => <section key={s.id}><h3>{s.reference} · {s.bank}</h3><p>{s.voided && 'Voided · '}{s.start_date}–{s.end_date} · Opening {amount(s.opening, s.currency)} → closing {amount(s.closing, s.currency)}</p>{s.rows.map(r => <MatchRow key={r.id + '-' + r.version} row={r} onOpen={onOpen} payments={[...rows,...customerRows].filter(p => p.state === 'recorded' && !p.clearance && p.bank_id === s.bank_id && p.direction === r.direction)} busy={busy} preview={preview || !options.can_reconcile || !!s.voided} onMatch={body => act(async () => {
            await api('/payments/statement-rows/' + r.id + '/decision', body);
            setStatements(await api('/payments/statements?company=' + company.id));
          })} />)}{s.voided ? <p>Voided with retained evidence: {s.voided.reason}</p> : !preview && options.can_reconcile && s.can_void && <details className='record-section'><summary>Correct this statement</summary><p>Remove all active matches first. A different reconciler must void the original; enter the replacement with a new reference.</p>{field('Statement correction reason', <textarea value={reason} onChange={e => setReason(e.target.value)} />)}<button className='secondary' disabled={busy || !reason.trim()} onClick={() => act(async () => {
              await api('/payments/statements/' + s.id + '/void', {
                reason
              });
              setStatements(await api('/payments/statements?company=' + company.id));
              setReason('');
            })}>Void statement, retain history</button></details>}</section>)}</>}</> : <><h3>Company bank accounts</h3>{options.banks.map(b => <div className='ledger-setup-row' key={b.id}><div><strong>{b.name}</strong><p>{b.currency} · {b.active ? 'Available' : 'Archived'} · Revision {b.version}</p></div>{!preview && <button className='secondary' onClick={() => act(() => api('/payments/banks/' + b.id, {
          version: b.version,
          name: b.name,
          active: !b.active,
          reason: b.active ? 'Archive accounting bank for future preparation' : 'Restore accounting bank availability'
        }, 'PUT'))}>{b.active ? 'Archive' : 'Restore'}</button>}</div>)}{!preview && <BankForm options={options} busy={busy} onSave={body => act(() => api('/payments/banks', body))} />}</>}
 <p className='ledger-note'>Supplier settlement and shared bank evidence. Customer receipts have their own destination; retention releases, bank integrations and full cash forecasting remain in development.</p></div>;
}
