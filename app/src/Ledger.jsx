import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Download, ArrowRight, Scales } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { Empty, ErrorBox } from './components.jsx';
import { ledgerCsv } from './ledger-export.js';
import { D } from '../server/decimal.mjs';
import './ledger.css';
const dateLabel = v => v ? new Date(v + 'T12:00:00Z').toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
}) : 'Not set';
const blankLine = () => ({
  account_id: '',
  description: '',
  debit: '0',
  credit: '0'
});
function JournalForm({
  record,
  options,
  project,
  onSave,
  busy
}) {
  const [f, set] = useState(record ? {
    ...record,
    reason: ''
  } : {
    company_id: options.company.id,
    project_id: project?.id || (options.can_company_write ? '' : options.projects[0]?.id || ''),
    title: '',
    accounting_date: options.today,
    currency: options.company.currency,
    rate: '1',
    rate_date: options.today,
    rate_source: 'Functional currency',
    source_reference: '',
    explanation: '',
    lines: [blankLine(), blankLine()]
  });
  const field = (k, v) => set({
    ...f,
    [k]: v
  });
  const line = (i, k, v) => set({
    ...f,
    lines: f.lines.map((l, n) => n === i ? {
      ...l,
      [k]: v
    } : l)
  });
  const total = k => {
    try {
      return f.lines.reduce((t, l) => t.plus(l[k] || '0'), new D(0)).toFixed(2);
    } catch {
      return 'Check amounts';
    }
  };
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><div className='ledger-field-grid'>
 <label className='field'>Journal title<input required maxLength={160} value={f.title} onChange={e => field('title', e.target.value)} /></label>
 <label className='field'>Project<select value={f.project_id || ''} disabled={!!record || !!project} onChange={e => field('project_id', e.target.value)}>{options.can_company_write && <option value=''>Company · unallocated</option>}{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label className='field'>Accounting date<input required type='date' value={f.accounting_date} max={options.today} onInput={e => set({
          ...f,
          accounting_date: e.target.value,
          ...(f.currency === options.company.currency ? {
            rate_date: e.target.value
          } : {})
        })} /></label>
 <label className='field'>Transaction currency<select value={f.currency} onChange={e => set({
          ...f,
          currency: e.target.value,
          rate: e.target.value === options.company.currency ? '1' : '',
          rate_source: e.target.value === options.company.currency ? 'Functional currency' : ''
        })}>{options.currencies.map(c => <option key={c}>{c}</option>)}</select></label></div>
 {f.currency !== options.company.currency && <section className='ledger-rate'><h3>Accounting conversion</h3><p>1 {f.currency} = the rate below in {options.company.currency}. Use the accounting source for this entry.</p><div className='ledger-field-grid'><label className='field'>Exchange rate<input required inputMode='decimal' value={f.rate} onChange={e => field('rate', e.target.value)} /></label><label className='field'>Rate date<input required type='date' value={f.rate_date} max={f.accounting_date} onInput={e => field('rate_date', e.target.value)} /></label><label className='field'>Rate source<input required value={f.rate_source} onChange={e => field('rate_source', e.target.value)} /></label></div></section>}
 <div className='section-heading'><h3>Journal lines</h3><span>{f.currency} · Debit {total('debit')} / Credit {total('credit')}</span></div>
 {f.lines.map((l, i) => <div className='ledger-line-editor' key={i}><strong>Line {i + 1}</strong><label className='field'>Account<select required value={l.account_id} onChange={e => line(i, 'account_id', e.target.value)}><option value=''>Choose account</option>{options.accounts.filter(a => a.active && a.purpose === 'general').map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label className='field'>Description<input required maxLength={300} value={l.description} onChange={e => line(i, 'description', e.target.value)} /></label><label className='field'>Debit<input inputMode='decimal' required value={l.debit} onChange={e => line(i, 'debit', e.target.value)} /></label><label className='field'>Credit<input inputMode='decimal' required value={l.credit} onChange={e => line(i, 'credit', e.target.value)} /></label>{f.lines.length > 2 && <button type='button' className='text-button' onClick={() => field('lines', f.lines.filter((_, n) => n !== i))}>Remove line {i + 1}</button>}</div>)}
 <button type='button' className='secondary' disabled={f.lines.length >= 50} onClick={() => field('lines', [...f.lines, blankLine()])}><Plus />Add line</button>
 <label className='field'>Supporting source reference<input required maxLength={300} value={f.source_reference} onChange={e => field('source_reference', e.target.value)} /></label><label className='field'>Why this entry is needed<textarea required maxLength={2000} value={f.explanation} onChange={e => field('explanation', e.target.value)} /></label>
 {record && <label className='field'>Revision reason<textarea required value={f.reason} onChange={e => field('reason', e.target.value)} /></label>}
 <p className='muted'>Saving creates a draft. Another authorised person must review and post it. Bank, tax and control accounts require their own workflows.</p><button className='primary' disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></form>;
}
function SetupForm({
  kind,
  existing,
  company,
  onSave,
  busy
}) {
  const [f, set] = useState(existing ? {
    ...existing,
    active: !!existing.active,
    reason: ''
  } : kind === 'account' ? {
    company_id: company.id,
    code: '',
    name: '',
    type: 'expense',
    purpose: 'general',
    active: true,
    reason: ''
  } : {
    company_id: company.id,
    name: '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const change = (k, v) => set({
    ...f,
    [k]: v
  });
  return <form className='ledger-form' onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h3>{existing ? 'Revise account' : kind === 'account' ? 'New account' : 'New accounting period'}</h3><div className='ledger-field-grid'><label className='field'>Name<input required value={f.name} onChange={e => change('name', e.target.value)} /></label>{kind === 'account' ? <><label className='field'>Account code<input required disabled={!!existing} value={f.code} onChange={e => change('code', e.target.value)} /></label><label className='field'>Account type<select value={f.type} disabled={!!existing} onChange={e => change('type', e.target.value)}>{['asset', 'liability', 'equity', 'income', 'expense'].map(s => <option key={s}>{s}</option>)}</select></label><label className='field'>Account purpose<select value={f.purpose} disabled={!!existing} onChange={e => change('purpose', e.target.value)}>{['general', 'bank', 'payable', 'receivable', 'tax', 'stock'].map(s => <option key={s}>{s}</option>)}</select></label><label className='ledger-check'><input type='checkbox' checked={f.active} onChange={e => change('active', e.target.checked)} />Available for new entries</label></> : <><label className='field'>Period start<input required type='date' value={f.start_date} onInput={e => change('start_date', e.target.value)} /></label><label className='field'>Period end<input required type='date' value={f.end_date} onInput={e => change('end_date', e.target.value)} /></label></>}</div><label className='field'>Reason<textarea required value={f.reason} onChange={e => change('reason', e.target.value)} /></label><button className='primary' disabled={busy}>Save {kind}</button></form>;
}
function Lines({
  rows,
  currency,
  open
}) {
  const foreign = rows.some(l => l.currency !== currency);
  return <div className='ledger-table-wrap'><table className='ledger-table'><thead><tr>{open && <th>Journal / date</th>}<th>Account & description</th>{foreign && <><th>Transaction debit</th><th>Transaction credit</th></>}<th>{currency} debit</th><th>{currency} credit</th></tr></thead><tbody>{rows.map((l, i) => <tr key={l.id || i}>{open && <td data-label='Journal / date'><button className='text-button' onClick={() => open(l.entry_id)}>{l.number}</button><small>{dateLabel(l.accounting_date)}</small></td>}<td data-label='Account & description'><strong>{l.account_code} · {l.account_name}</strong><small>{l.description}</small>{l.rounding_adjustment !== '0.00' && <small>Conversion rounding: {l.rounding_adjustment} {currency}</small>}</td>{foreign && <><td data-label='Transaction debit'>{l.currency} {l.debit}</td><td data-label='Transaction credit'>{l.currency} {l.credit}</td></>}<td data-label={currency + ' debit'}>{l.base_debit}</td><td data-label={currency + ' credit'}>{l.base_credit}</td></tr>)}</tbody></table></div>;
}
export function Ledger({
  company,
  project,
  preview = false,
  initialRecord,
  onChanged = () => {}
}) {
  const [options, setOptions] = useState(null),
    [entries, setEntries] = useState([]),
    [record, setRecord] = useState(null),
    [screen, setScreen] = useState('journals'),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [decision, setDecision] = useState(null),
    [reason, setReason] = useState(''),
    [reversalDate, setReversalDate] = useState(''),
    [report, setReport] = useState(null),
    [filters, setFilters] = useState({
      project: project?.id || '',
      from: new Date().toISOString().slice(0, 4) + '-01-01',
      to: new Date().toISOString().slice(0, 10),
      account: ''
    }),
    [state, setState] = useState('all'),
    [reportRevision, setReportRevision] = useState(0);
  const query = `company=${encodeURIComponent(company.id)}${project ? '&project=' + encodeURIComponent(project.id) : ''}`;
  async function refresh() {
    const [o, rs] = await Promise.all([api('/ledger/options?' + query), api('/ledger/entries?' + query)]);
    setOptions(o);
    setEntries(rs);
  }
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([api('/ledger/options?' + query), api('/ledger/entries?' + query), initialRecord ? api('/ledger/entries/' + initialRecord) : null]).then(([o, rs, r]) => {
      if (active) {
        setOptions(o);
        setEntries(rs);
        setRecord(r);
      }
    }).catch(e => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [query, initialRecord]);
  async function task(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
      setReportRevision(n => n + 1);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id) {
    setError('');
    try {
      setRecord(await api('/ledger/entries/' + id));
      setForm(null);
      setDecision(null);
      setReason('');
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (screen !== 'reports') return;
    const controller = new AbortController();
    setError('');
    setReport(null);
    setBusy(true);
    const params = new URLSearchParams({
      company: company.id,
      ...filters
    });
    api('/ledger/report?' + params, undefined, 'GET', controller.signal).then(r => {
      if (!controller.signal.aborted) setReport(r);
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [screen, filters.project, filters.from, filters.to, filters.account, reportRevision]);
  const startDecision = (action, period = null) => {
    setDecision({
      action,
      period
    });
    setReason('');
    setReversalDate(options.today);
  };
  const doDecision = () => task(async () => {
    if (decision.period) {
      await api(`/ledger/periods/${decision.period.id}/decision`, {
        version: decision.period.version,
        action: decision.action,
        reason
      });
    } else {
      setRecord(await api(`/ledger/entries/${record.id}/${decision.action === 'reverse' ? 'reversal' : 'decision'}`, {
        version: record.version,
        action: decision.action,
        accounting_date: reversalDate,
        reason
      }));
    }
    setDecision(null);
    setReason('');
  });
  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([ledgerCsv(report)], {
      type: 'text/csv;charset=utf-8'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Builder-ERP-Ledger-${company.id}-${report.scope.project?.id || 'company'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <div className='ledger'><ErrorBox message={error} />{!options && !error && <p role='status'>Loading accounting…</p>}{options && <>
 <div className='section-heading'><div><p className='eyebrow'>{company.name} · {project?.name || 'Authorised company scope'}</p><h2><Scales size={24} /> General ledger</h2><p className='muted'>Prepare, independently review, then post. Follow every balance to its journal.</p></div>{!record && !form && screen === 'journals' && options.can_write && !preview && <button className='primary' onClick={() => setForm({
          kind: 'journal'
        })}><Plus />New journal</button>}</div>
 {preview && <p className='scope-note'>Access preview · read only</p>}
 {!record && !form && !decision && <nav className='ledger-nav' aria-label='Accounting views'>{[['journals', 'Journals'], ['reports', 'Ledger & trial balance'], ...(options.can_manage ? [['setup', 'Accounts & periods']] : [])].map(([id, title]) => <button key={id} className={screen === id ? 'active' : ''} onClick={() => {
          setScreen(id);
          setReport(null);
          setError('');
        }}>{title}</button>)}</nav>}
 {form && <><button className='back' onClick={() => {
          setForm(null);
          setError('');
        }}><ArrowLeft />Back</button>{form.kind === 'journal' ? <JournalForm key={record?.id || 'new'} record={record} options={options} project={project} busy={busy} onSave={f => task(async () => {
          setRecord(await api('/ledger/entries' + (record ? '/' + record.id : ''), f, record ? 'PUT' : 'POST'));
          setForm(null);
        })} /> : <SetupForm kind={form.kind} existing={form.existing} company={company} busy={busy} onSave={f => task(async () => {
          await api('/ledger/' + (form.kind === 'account' ? 'accounts' : 'periods') + (form.existing ? '/' + form.existing.id : ''), f, form.existing ? 'PUT' : 'POST');
          setForm(null);
        })} />}</>}
 {decision && <form className='ledger-decision' onSubmit={e => {
        e.preventDefault();
        doDecision();
      }}><h3>{{
            post: 'Review and post',
            submit: 'Send for independent review',
            return: 'Return for correction',
            withdraw: 'Withdraw submission',
            cancel: 'Cancel draft',
            reverse: 'Prepare a full reversal',
            close: 'Close accounting period',
            reopen: 'Independently reopen period'
          }[decision.action]}</h3><p>{decision.period ? `${decision.period.name}: ${dateLabel(decision.period.start_date)} to ${dateLabel(decision.period.end_date)}.` : decision.action === 'post' ? `${amount(record.company_total, company.currency)} on each side. Posted lines and source snapshots will be permanent.` : decision.action === 'reverse' ? 'The original remains posted. The new reversal needs its own independent review.' : 'Your reason stays with this journal and its history.'}</p>{decision.action === 'reverse' && <label className='field'>Reversal accounting date<input required type='date' min={record.accounting_date} max={options.today} value={reversalDate} onInput={e => setReversalDate(e.target.value)} /></label>}<label className='field'>Decision reason<textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className='inline-actions'><button className='primary' disabled={busy}>Confirm {decision.action}</button><button type='button' className='secondary' onClick={() => setDecision(null)}>Back</button></div></form>}
 {record && !form && <section className='ledger-detail'><button className='back' onClick={() => {
          setRecord(null);
          setDecision(null);
          setError('');
        }}><ArrowLeft />Journal register</button><div className='ledger-record-heading'><div><p className='eyebrow'>{record.number || record.id} · {record.state_label}</p><h3>{record.title}</h3><p>{record.project} · {dateLabel(record.accounting_date)} · Prepared by {record.author}</p></div><div className='ledger-total'><span>Equal debit & credit</span><strong>{amount(record.company_total, company.currency)}</strong>{record.currency !== company.currency && <small>{amount(record.total, record.currency)}</small>}</div></div>
 {!decision && !preview && <div className='inline-actions'>{record.can_write && ['draft', 'returned'].includes(record.state) && <><button className='primary' onClick={() => startDecision('submit')}>Send for review<ArrowRight /></button>{!record.reversal_of && <button className='secondary' onClick={() => setForm({
              kind: 'journal'
            })}>Revise draft</button>}<button className='text-button' onClick={() => startDecision('cancel')}>Cancel draft</button></>}{record.can_write && record.state === 'submitted' && <button className='secondary' onClick={() => startDecision('withdraw')}>Withdraw submission</button>}{record.state === 'submitted' && record.can_review && <button className='primary' onClick={() => startDecision('post')}>Review & post</button>}{record.state === 'submitted' && record.can_return && <button className='secondary' onClick={() => startDecision('return')}>Return for correction</button>}{record.can_reverse && <button className='secondary' onClick={() => startDecision('reverse')}>Prepare reversal</button>}</div>}
 {record.state === 'submitted' && !record.can_review && <p className='scope-note'>Awaiting an independent reviewer with journal authority of at least {amount(record.company_total, company.currency)}.</p>}
 {record.reversal && <button className='text-button' onClick={() => open(record.reversal.id)}>Open reversal · {record.reversal.number || record.reversal.id} · {record.reversal.state}</button>}{record.reversal_of && <button className='text-button' onClick={() => open(record.reversal_of)}>Open original journal</button>}
 <Lines rows={record.lines.map(l => ({
          ...l,
          currency: record.currency
        }))} currency={company.currency} />
 <section className='ledger-source'><h3>Source & accounting basis</h3><p><strong>{record.source_reference}</strong></p><p>{record.explanation}</p><p>{record.currency !== company.currency ? <>1 {record.currency} = {record.rate} {company.currency} · </> : null}{dateLabel(record.rate_date)} · {record.rate_source}</p>{record.posted_by && <p>Posted by {record.poster} · {new Date(record.posted_at).toLocaleString('en-GB')}</p>}</section>
 <details className='record-section'><summary>Review history · {record.history.length} events</summary>{record.history.map(h => <article key={h.id}><strong>{h.action} · {h.actor}</strong><p>{h.reason}</p><small>{new Date(h.at).toLocaleString('en-GB')} · Version {h.snapshot.version}</small><details><summary>Saved version</summary><pre>{JSON.stringify({
                  ...h.snapshot,
                  lines_json: undefined,
                  lines: JSON.parse(h.snapshot.lines_json)
                }, null, 2)}</pre></details></article>)}</details></section>}
 {!record && !form && !decision && screen === 'journals' && <><label className='field ledger-filter'>Journal stage<select value={state} onChange={e => setState(e.target.value)}>{['all', 'draft', 'submitted', 'returned', 'posted', 'cancelled'].map(s => <option key={s} value={s}>{s === 'all' ? 'All stages' : s === 'submitted' ? 'Independent review' : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label><div className='ledger-register'>{entries.filter(r => state === 'all' || r.state === state).map(r => <button className='ledger-row' key={r.id} onClick={() => open(r.id)}><span><small>{r.number || r.id} · {dateLabel(r.accounting_date)}</small><strong>{r.title}</strong><small>{r.project}</small></span><span><strong>{amount(r.company_total, company.currency)}</strong><small>{r.state_label}{r.reversal_of ? ' · Reversal' : ''}</small></span><ArrowRight /></button>)}</div>{!entries.length && <Empty>No general journals yet. An accounting controller sets up accounts and an open period before the first draft.</Empty>}<p className='ledger-note'>This ledger is separate from illustrative cost openings. Supplier bills, tax, bank payments and reconciliation remain in the wider ERP build.</p></>}
 {!record && !form && !decision && screen === 'reports' && <><div className='ledger-field-grid'><label className='field'>Report project<select disabled={!!project} value={filters.project} onChange={e => setFilters({
              ...filters,
              project: e.target.value
            })}><option value=''>All authorised projects & company records</option>{options.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className='field'>From<input type='date' value={filters.from} onInput={e => setFilters({
              ...filters,
              from: e.target.value
            })} /></label><label className='field'>Through<input type='date' value={filters.to} onInput={e => setFilters({
              ...filters,
              to: e.target.value
            })} /></label><label className='field'>Account<select value={filters.account} onChange={e => setFilters({
              ...filters,
              account: e.target.value
            })}><option value=''>All accounts</option>{options.accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label></div>{busy && <p role='status'>Calculating full authorised population…</p>}{report && !busy && <><section className='ledger-findings'><div className='section-heading'><h3>What this report shows</h3><button className='secondary' onClick={exportReport}><Download />Export full report</button></div>{report.findings.map(f => <div key={f.title}><strong>{f.title}</strong><p>{f.text}</p></div>)}{report.limitations.map(t => <p className='muted' key={t}>{t}</p>)}</section><h3>Trial balance · {company.currency}</h3><p className='muted'>Opening + debit − credit = closing. Negative net balances are credits.</p><div className='ledger-table-wrap'><table className='ledger-table'><thead><tr><th>Account</th><th>Opening</th><th>Debit</th><th>Credit</th><th>Closing</th></tr></thead><tbody>{report.trial.map(a => <tr key={a.id}><td data-label='Account'><strong>{a.code} · {a.name}</strong><small>{a.type}</small></td>{['opening', 'debit', 'credit', 'closing'].map(k => <td key={k} data-label={k}>{a[k]}</td>)}</tr>)}<tr className='ledger-totals'><th>Totals</th>{['opening', 'debit', 'credit', 'closing'].map(k => <td key={k} data-label={k}>{report.totals[k]}</td>)}</tr></tbody></table></div><h3>Posted lines · {report.rows.length}</h3>{report.rows.length ? <Lines rows={report.rows} currency={company.currency} open={open} /> : <Empty>No posted lines in this range.</Empty>}</>}</>}
 {!record && !form && !decision && screen === 'setup' && <><section><div className='section-heading'><h3>Chart of accounts</h3>{!preview && <button className='secondary' onClick={() => setForm({
              kind: 'account'
            })}><Plus />New account</button>}</div><p className='muted'>General accounts accept journals. Reserved control accounts await their typed subledgers.</p>{options.accounts.map(a => <div className='ledger-setup-row' key={a.id}><div><strong>{a.code} · {a.name}</strong><p>{a.type} · {a.purpose} · {a.active ? 'Available' : 'Inactive'}</p></div>{!preview && <button className='secondary' onClick={() => setForm({
              kind: 'account',
              existing: a
            })}>Revise {a.code}</button>}</div>)}</section><section><div className='section-heading'><h3>Accounting periods</h3>{!preview && <button className='secondary' onClick={() => setForm({
              kind: 'period'
            })}><Plus />New period</button>}</div>{options.periods.map(p => <div className='ledger-setup-row' key={p.id}><div><strong>{p.name} · {p.state}</strong><p>{dateLabel(p.start_date)} – {dateLabel(p.end_date)}</p></div>{!preview && <button className='secondary' disabled={p.state === 'closed' && p.closed_by === options.actor_id} onClick={() => startDecision(p.state === 'open' ? 'close' : 'reopen', p)}>{p.state === 'open' ? 'Close period' : p.closed_by === options.actor_id ? 'Another controller must reopen' : 'Reopen period'}</button>}</div>)}</section><details className='record-section'><summary>Configuration history</summary>{options.configuration_history.map(h => <article key={h.id}><strong>{h.action} · {h.actor}</strong><p>{h.reason}</p><small>{h.at}</small><details><summary>Saved configuration</summary><pre>{JSON.stringify(h.snapshot, null, 2)}</pre></details></article>)}</details></>}
 </>}</div>;
}
