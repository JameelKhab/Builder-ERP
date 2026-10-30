import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Plus } from '@phosphor-icons/react';
import { api, amount } from './api.js';
import { ErrorBox } from './components.jsx';
import { correctionsCsv } from './corrections-export.js';
import './commercial.css';
import './certificates.css';
import './advances.css';
import './corrections.css';

const field = (label, control) => <label className='field'>{label}{control}</label>;
const states = {draft:'Draft',technical:'Technical review',commercial:'Commercial review',finance:'Finance review',returned:'Changes requested',applied:'Applied',cancelled:'Cancelled'};
const Findings = ({items}) => <section className='certificate-findings'><h3>What this tells you</h3><ul>{items.map((text,i)=><li key={i}>{text}</li>)}</ul></section>;

function CorrectionForm({record,initialSource,options,busy,onSave,onCancel,onOpen}) {
  const [f,set] = useState(record ? {title:record.title,basis:record.basis,effective_date:record.effective_date,version:record.version,source:record.advance_id||record.certificate_id,reason:''} : {source:initialSource||'',title:'',basis:'',effective_date:options.today,reason:''});
  const [error,setError] = useState(''), [reading,setReading] = useState(false), fileToken = useRef(0);
  useEffect(()=>()=>{fileToken.current++;},[]);
  const source = options.sources.find(s=>s.id===f.source);
  const change = (key,value) => set(s=>({...s,[key]:value}));
  const read = async e => {
    const file=e.target.files[0],token=++fileToken.current;
    set(s=>({...s,filename:undefined,base64:undefined}));setError('');setReading(false);
    if (!file) return;
    if (!/\.(pdf|png|jpe?g|txt)$/i.test(file.name) || file.size<1 || file.size>2*1024*1024) {setError('Choose a non-empty PDF, PNG, JPG or TXT file up to 2 MiB.');return;}
    setReading(true);
    try {
      const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Cannot read this file. Choose it again.'));reader.readAsDataURL(file);});
      if(token===fileToken.current)set(s=>({...s,filename:file.name,base64:String(result).split(',')[1]}));
    } catch(e) {if(token===fileToken.current)setError(e.message);} finally {if(token===fileToken.current)setReading(false);}
  };
  return <form className='offer-form' onSubmit={e=>{e.preventDefault();onSave({...f,...(f.source.startsWith('CAD-')?{advance_id:f.source}:{certificate_id:f.source})});}}>
    <h2>{record?'Revise correction':'Request a full correction'}</h2>
    <p>Withdraw one approved advance or certified period. If invoiced, its full original invoice will be credited after independent approval. Cash stays recorded.</p>
    <section className='record-section'><h3>1. Choose what needs correcting</h3>
      {record ? <p>{record.snapshot.source.title} · {record.project}</p> : field('Approved source',<select required value={f.source} onChange={e=>change('source',e.target.value)}><option value=''>Choose an advance or certified period</option>{options.sources.filter(s=>!s.existing_correction||s.id===f.source).map(s=><option key={s.id} value={s.id}>{s.kind==='advance'?'Advance':'Certificate'} · {s.title} · {s.project}{s.existing_correction?' · correction exists':''}</option>)}</select>)}
      {!record && source?.existing_correction && <p className='preview-notice'>This source already has a correction. <button type='button' className='text-button' onClick={()=>onOpen(source.existing_correction.id)}>Open existing correction</button></p>}
      {field('Correction title',<input required maxLength={200} value={f.title} onChange={e=>change('title',e.target.value)} placeholder='For example: cancel duplicate mobilisation request'/>)}
      {field('Effective date',<input required type='date' max={options.today} value={f.effective_date} onChange={e=>change('effective_date',e.target.value)}/>)}
      <p className='muted'>The date must follow the original invoice and any recorded settlement. Linked recoveries and later certified periods may need to be corrected first.</p>
    </section>
    <section className='record-section'><h3>2. Explain and support the correction</h3>
      {field('Why the source should be withdrawn, and the intended outcome',<textarea required rows={4} maxLength={2000} value={f.basis} onChange={e=>change('basis',e.target.value)}/>)}
      {field(record?.evidence_id?'Add evidence · previous files stay retained':'Supporting evidence · up to 2 MiB',<input type='file' accept='.pdf,.png,.jpg,.jpeg,.txt' onChange={read}/>)}
      {f.filename && <p>{f.filename}</p>}{record?.evidence_id && <p className='muted'>The retained evidence stays attached unless you add a new file.</p>}
      {field('Preparation or revision note',<textarea required rows={2} maxLength={2000} value={f.reason} onChange={e=>change('reason',e.target.value)}/>)}
      <p className='muted'>Save the draft to review the exact impact and blockers before submission. Partial adjustments and customer refunds are separate workflows still being built.</p>
    </section>
    {error && <ErrorBox message={error}/>}<div className='inline-actions'><button className='primary' disabled={busy||reading||!!error||(!record&&!!source?.existing_correction)}>Save & review impact</button><button type='button' className='secondary' disabled={busy} onClick={onCancel}>Cancel editing</button></div>
  </form>;
}

function Decisions({record:r,busy,onDecision}) {
  const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
  if(!r.can_submit&&!r.can_review&&!r.can_cancel)return null;
  const final=r.state==='finance'&&r.can_review;
  return <section className='record-section'><h3>Your next action</h3>
    {final && <label className='correction-confirm'><input type='checkbox' checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>{r.snapshot.journal.length?<>I have checked the full {amount(r.snapshot.credit_total,r.currency)} credit and source withdrawal. Recorded cash will remain.</>:<>I have checked the source withdrawal. No accounting credit or cash movement is needed.</>}</span></label>}
    {field('Reason for this decision',<textarea rows={2} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/>)}
    <div className='inline-actions'>
      {r.can_submit&&<button className='primary' disabled={busy||!reason.trim()||!!r.blockers.length} onClick={()=>onDecision('submit',reason)}>Submit for {r.advance_id?'finance':'technical'} review</button>}
      {r.can_review&&<><button className='primary' disabled={busy||!reason.trim()||!r.can_accept||(final&&!confirmed)} onClick={()=>onDecision('accept',reason)}>{final?'Apply full correction':'Accept '+states[r.state].toLowerCase()}</button><button className='secondary' disabled={busy||!reason.trim()} onClick={()=>onDecision('return',reason)}>Return for changes</button></>}
      {r.can_cancel&&<button className='secondary' disabled={busy||!reason.trim()} onClick={()=>onDecision('cancel',reason)}>Cancel this request</button>}
    </div>
  </section>;
}

export default function Corrections({company,project,preview,onOpen,onChanged,initialRecord,initialSource}) {
  const [options,setOptions]=useState(null),[rows,setRows]=useState([]),[report,setReport]=useState(null),[record,setRecord]=useState(null),[editing,setEditing]=useState(!!initialSource),[view,setView]=useState('requests');
  const [scope,setScope]=useState(project?.id||''),[currency,setCurrency]=useState(''),[cutoff,setCutoff]=useState(new Date().toISOString().slice(0,10)),[status,setStatus]=useState('all');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0), navigation=useRef(0);
  const query=new URLSearchParams({company:company.id,...(scope?{project:scope}:{})}).toString();
  useEffect(()=>{let live=true;setLoading(true);setError('');setReport(null);setRows([]);Promise.all([api('/client-corrections/options?'+query),api('/client-corrections/documents?'+query),view==='report'?api('/client-corrections/report?'+query+'&'+new URLSearchParams({to:cutoff,...(currency?{currency}:{})})):null]).then(([o,r,p])=>{if(live){setOptions(o);setRows(r);setReport(p);}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[query,view,cutoff,currency,revision]);
  const open=async id=>{const token=++navigation.current;setBusy(true);setError('');setEditing(false);try{const r=await api('/client-corrections/documents/'+id);if(token===navigation.current)setRecord(r);}catch(e){if(token===navigation.current)setError(e.message);}finally{if(token===navigation.current)setBusy(false);}};
  useEffect(()=>{if(initialRecord)open(initialRecord);return()=>{navigation.current++;};},[initialRecord]);
  const act=async fn=>{setBusy(true);setError('');try{setRecord(await fn());setEditing(false);setRevision(n=>n+1);onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const back=()=>{navigation.current++;setRecord(null);setEditing(false);setError('');setRevision(n=>n+1);};
  const exportReport=()=>{const url=URL.createObjectURL(new Blob([correctionsCsv(report)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='builder-client-corrections.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  let body;
  if(editing&&options&&!preview) body=<CorrectionForm key={record?.id||'new'} record={record} initialSource={initialSource} options={options} busy={busy} onOpen={onOpen} onSave={f=>act(()=>api('/client-corrections/documents'+(record?'/'+record.id:''),f,record?'PUT':'POST'))} onCancel={()=>setEditing(false)}/>;
  else if(record){const r=record,s=r.snapshot;body=<>
    <div className='section-head'><div><p className='eyebrow'>CLIENT CORRECTION · {r.id}</p><h2>{r.title}</h2><p>{r.project} · {r.state_label} · Effective {r.effective_date}</p></div>{!preview&&r.can_edit&&<button className='secondary' disabled={busy} onClick={()=>setEditing(true)}>Revise correction</button>}</div>
    <div className='advance-next'><strong>Next action</strong><span>{r.next_action}</span></div>
    <div className='offer-overview'><div><small>{r.state==='applied'?'Applied invoice credit':'Proposed full invoice credit'}</small><strong>{amount(s.credit_total,r.currency)}</strong></div><div><small>{r.state==='applied'?'Cash retained when applied':'Cash retained in this review basis'}</small><strong>{amount(s.customer_credit_after,r.currency)}</strong></div><div><small>Source</small><strong>{r.advance_id?'Approved advance':'Certified period'}</strong><small>Prepared by {r.author}</small></div></div>
    {!!r.blockers.length&&<section className='correction-blockers' role='status'><h3>Before this can proceed</h3>{r.blockers.map((b,i)=><p key={i}>{b}</p>)}<p>Reviewers can return the request. Its author can revise the basis and start a fresh review.</p></section>}
    <Findings items={r.findings}/><section className='record-section'><h3>Reason and intended outcome</h3><p>{r.basis}</p><div className='inline-actions'><button className='secondary' onClick={()=>onOpen(r.advance_id||r.certificate_id)}>Original {r.advance_id?'advance':'certificate'}</button>{r.invoice_id&&<button className='secondary' onClick={()=>onOpen(r.invoice_id)}>Original invoice & cash balance</button>}{r.journal_id&&r.can_open_journal&&<button className='secondary' onClick={()=>onOpen(r.journal_id)}>Posted credit journal</button>}</div></section>
    <section className='record-section'><h3>Supporting evidence</h3>{r.evidence.length?r.evidence.map(e=><div className='certificate-evidence' key={e.id}><a href={'/api/client-corrections/evidence/'+e.id}>{e.filename}</a><span>{e.id===r.evidence_id?'Current basis':'Earlier retained file'} · {e.size} bytes</span><details><summary>File fingerprint</summary><code>{e.sha256}</code></details></div>):<p>No evidence attached. Add it before submission.</p>}</section>
    {!preview&&<Decisions key={r.id+':'+r.version} record={r} busy={busy} onDecision={(action,reason)=>act(()=>api(`/client-corrections/documents/${r.id}/decision`,{version:r.version,action,reason}))}/>}
    <details className='record-section'><summary>Review route and history · {r.history.length} events</summary><p>{r.advance_id?'Preparation → independent finance review → applied':'Preparation → technical review → commercial review → finance review → applied'}. Each reviewer must have current, separate authority. Review cycle {r.cycle}.</p>{r.history.map(h=><div className='certificate-history' key={h.id}><strong>{h.action}</strong><span>{h.actor} · {h.at.slice(0,16).replace('T',' ')}</span><p>{h.reason}</p></div>)}</details>
    <details className='record-section'><summary>Exact accounting and recovery impact</summary><p>Original company carrying credit {amount(s.credit_base,r.company_currency)}. No new exchange rate is used. Original source: {s.source.title}.</p>{s.recoveries.length>0&&<><h4>Linked recovery</h4>{s.recoveries.map((a,i)=><p key={i}><button className='text-button' onClick={()=>onOpen(a.certificate_id)}>{a.certificate_id}</button> · {amount(a.principal,r.currency)} principal + {amount(a.tax,r.currency)} tax</p>)}</>}{s.journal.length?<div className='table-scroll'><table className='certificate-table'><thead><tr><th>Account</th><th>{r.currency} debit</th><th>{r.currency} credit</th><th>{r.company_currency} debit</th><th>{r.company_currency} credit</th></tr></thead><tbody>{s.journal.map((l,i)=><tr key={i}><td>{l.account_code} · {l.account_name}</td><td>{l.debit}</td><td>{l.credit}</td><td>{l.base_debit}</td><td>{l.base_credit}</td></tr>)}</tbody></table></div>:<p>No posted invoice exists in this basis, so no accounting credit will be posted.</p>}</details>
  </>;}
  else body=<>
    <div className='section-head'><div><p className='eyebrow'>CONTROLLED CLIENT CHANGES</p><h2>Client corrections</h2><p>Correct approved advances or certified work, with the original records kept intact.</p></div>{!preview&&options?.can_write&&<button className='primary' disabled={busy||loading} onClick={()=>setEditing(true)}><Plus/>Request correction</button>}</div>
    <div className='inline-actions advance-views'><button className={view==='requests'?'primary':'secondary'} aria-pressed={view==='requests'} onClick={()=>setView('requests')}>Requests & next actions</button><button className={view==='report'?'primary':'secondary'} aria-pressed={view==='report'} onClick={()=>setView('report')}>Correction report</button></div>
    <div className='certificate-filters'>{!project&&field('Project',<select value={scope} onChange={e=>setScope(e.target.value)}><option value=''>All authorised projects</option>{options?.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>)}{view==='requests'?field('Request status',<select value={status} onChange={e=>setStatus(e.target.value)}><option value='all'>All corrections</option>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>):<>{field('Currency',<select value={currency} onChange={e=>setCurrency(e.target.value)}><option value=''>All · kept separate</option>{[...new Set(rows.map(r=>r.currency))].sort().map(c=><option key={c}>{c}</option>)}</select>)}{field('Effective through',<input type='date' max={options?.today} value={cutoff} onChange={e=>setCutoff(e.target.value)}/>)}</>}</div>
    {loading?<p role='status'>Loading corrections…</p>:view==='requests'?<>{rows.filter(r=>status==='all'||r.state===status).map(r=><button className='certificate-row' key={r.id} onClick={()=>open(r.id)}><span><strong>{r.title}</strong><small>{r.project} · {r.state_label}</small><small>{r.next_action}</small></span><span>{amount(r.credit_total,r.currency)}<small>{r.journal_id?'Posted credit':r.credit_total==='0.00'?'No accounting credit':r.state==='cancelled'?'Not applied':'Proposed invoice credit'}</small></span><ArrowRight/></button>)}{!rows.some(r=>status==='all'||r.state===status)&&<p>No corrections match this scope. Start from an approved advance or certificate.</p>}</>:report&&<><Findings items={report.findings}/><button className='secondary' disabled={loading||!!error} onClick={exportReport}><Download/>Export complete report</button>{report.currency_groups.map(g=><p className='record-section' key={g.currency}>Applied invoice credits · <strong>{amount(g.credited,g.currency)}</strong></p>)}<details className='record-section'><summary>Records behind the findings · {report.rows.length}</summary>{report.rows.map(r=><button className='certificate-row' key={r.id} onClick={()=>open(r.id)}><span><strong>{r.title}</strong><small>{r.project} · {r.state_label} · {r.effective_date}</small></span><span>{amount(r.credit_total,r.currency)}</span><ArrowRight/></button>)}</details><details className='record-section'><summary>Report definitions and scope</summary>{report.limitations.map((l,i)=><p key={i}>{l}</p>)}</details></>}
  </>;
  return <div className='certificates-page corrections-page'>{(record||editing)&&<button className='text-button' disabled={busy} onClick={back}><ArrowLeft/>All client corrections</button>}{preview&&<p className='preview-notice'>Read-only access preview</p>}{error&&<ErrorBox message={error}/>}<div aria-busy={busy}>{body}</div></div>;
}
