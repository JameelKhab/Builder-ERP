import { qualityCsv } from './quality-export.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Download } from '@phosphor-icons/react';
import { api } from './api.js';
import { Empty, ErrorBox, Status } from './components.jsx';
import './quality.css';
const dueLabel = value => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
}) : 'Not set';
const states = {
  draft: 'Draft',
  open: 'Investigate & plan',
  plan_review: 'Review corrective plan',
  in_progress: 'Corrective work',
  verification: 'Verify the result',
  closed: 'Closed',
  cancelled: 'Cancelled'
};
const day = () => new Date().toISOString().slice(0, 10);
const field = (f, set) => (k, v) => set({
  ...f,
  [k]: v
});
const nameOf = (people, id) => people.find(p => p.id === id)?.name || id;
function People({
  label,
  value,
  onChange,
  people,
  kind = 'can_write',
  exclude = []
}) {
  return <label className="field">{label}<select required value={value} onChange={e => onChange(e.target.value)}><option value="">Choose a person</option>{people.filter(p => p[kind] && !exclude.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
}
function CaseForm({
  existing,
  options,
  project,
  company,
  onSave,
  busy
}) {
  const [f, set] = useState(existing ? {
    ...existing,
    reason: ''
  } : {
    title: '',
    requirement: '',
    observation: '',
    severity: 'medium',
    observed_on: day(),
    due_date: day(),
    owner_id: '',
    reviewer_id: '',
    work_package_id: '',
    location_id: '',
    receipt_id: ''
  });
  const change = field(f, set);
  return <form onSubmit={e => {
    e.preventDefault();
    onSave({
      ...f,
      company_id: company.id,
      project_id: project.id
    });
  }}><h3>{existing ? 'Revise draft NCR' : 'Record a non-conformance'}</h3><p className='eyebrow'>{project.name}</p><p className="muted">Describe the requirement and what differs. Evidence and the corrective plan follow in this same case.</p><div className="form-grid"><label className="field full">Title<input required maxLength={160} value={f.title} onChange={e => change('title', e.target.value)} autoFocus /></label><label className="field full">Requirement or inspection reference<textarea required value={f.requirement} onChange={e => change('requirement', e.target.value)} maxLength={1000} /></label><label className="field full">What was observed<textarea required value={f.observation} onChange={e => change('observation', e.target.value)} maxLength={3000} /></label><label className="field">Work item<select required value={f.work_package_id} onChange={e => change('work_package_id', e.target.value)}><option value="">Choose work item</option>{options.work_packages.map(w => <option value={w.id} key={w.id}>{w.code} · {w.name}</option>)}</select></label><label className="field">Location<select required value={f.location_id} onChange={e => change('location_id', e.target.value)}><option value="">Choose location</option>{options.locations.map(l => <option value={l.id} key={l.id}>{l.code} · {l.name}</option>)}</select></label><label className="field">Severity<select value={f.severity} onChange={e => change('severity', e.target.value)}>{['low', 'medium', 'high', 'critical'].map(s => <option key={s}>{s}</option>)}</select></label><label className="field">Observed on<input required type="date" max={day()} value={f.observed_on} onInput={e => change('observed_on', e.target.value)} /></label><label className="field">Resolve by<input required type="date" min={f.observed_on} value={f.due_date} onInput={e => change('due_date', e.target.value)} /></label><People label="Responsible owner" value={f.owner_id} onChange={v => change('owner_id', v)} people={options.people} /><People label="Independent reviewer" value={f.reviewer_id} onChange={v => change('reviewer_id', v)} people={options.people} kind="can_review" exclude={[f.owner_id, existing?.reporter_id || options.actor_id]} /><label className="field">Related receipt · optional<select value={f.receipt_id || ''} onChange={e => change('receipt_id', e.target.value)}><option value="">No receipt link</option>{options.receipts.map(r => <option key={r.id} value={r.id}>{r.id} · {r.delivery_reference} · {r.accepted} accepted / {r.rejected} rejected</option>)}</select></label>{existing && <label className="field full">Reason for revision<textarea required value={f.reason} onChange={e => change('reason', e.target.value)} /></label>}</div><div className="dialog-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div></form>;
}
function PlanForm({
  r,
  options,
  onSave,
  busy
}) {
  const [f, set] = useState({
    containment: r.containment,
    root_cause: r.root_cause,
    disposition: r.disposition || 'rework',
    remedy: r.remedy,
    acceptance: r.acceptance,
    authority_reference: r.authority_reference,
    reason: '',
    actions: r.actions.length ? r.actions : [{
      title: '',
      owner_id: r.owner_id,
      due_date: r.due_date
    }],
    impacts: r.impacts.map(i => ({
      ...i,
      assessment: i.assessment === 'unknown' ? '' : i.assessment,
      owner_id: i.owner_id || r.owner_id,
      due_date: i.due_date || r.due_date
    }))
  });
  const change = field(f, set);
  function update(key, index, k, v) {
    set({
      ...f,
      [key]: f[key].map((a, n) => n === index ? {
        ...a,
        [k]: v
      } : a)
    });
  }
  return <form onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h3>Containment & corrective plan</h3><div className="form-grid">{[['containment', 'Immediate containment'], ['root_cause', 'Root cause'], ['remedy', 'Corrective approach'], ['acceptance', 'How will the result be verified?']].map(([k, l]) => <label className="field full" key={k}>{l}<textarea required maxLength={3000} value={f[k]} onChange={e => change(k, e.target.value)} /></label>)}<label className="field">Disposition<select value={f.disposition} onChange={e => change('disposition', e.target.value)}>{[['rework', 'Rework to requirement'], ['repair', 'Repair'], ['reject', 'Reject / replace'], ['use_as_is', 'Use as is · external authority required']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="field">External authority reference{f.disposition !== 'use_as_is' ? ' · optional' : ''}<input required={f.disposition === 'use_as_is'} value={f.authority_reference} onChange={e => change('authority_reference', e.target.value)} maxLength={1000} /></label></div><h4>Corrective & preventive actions</h4>{f.actions.map((a, i) => <fieldset className="quality-task" key={i}><legend>Action {i + 1}</legend><div className="form-grid"><label className="field full">Work to complete<textarea required maxLength={600} value={a.title} onChange={e => update('actions', i, 'title', e.target.value)} /></label><People label="Action owner" value={a.owner_id} onChange={v => update('actions', i, 'owner_id', v)} people={options.people} exclude={[r.reviewer_id]} /><label className="field">Due date<input type="date" required value={a.due_date} onInput={e => update('actions', i, 'due_date', e.target.value)} /></label></div>{f.actions.length > 1 && <button type="button" className="text-button" onClick={() => change('actions', f.actions.filter((_, n) => n !== i))}>Remove this unsaved action</button>}</fieldset>)}<button type="button" className="secondary" disabled={f.actions.length >= 20} onClick={() => change('actions', [...f.actions, {
      title: '',
      owner_id: r.owner_id,
      due_date: r.due_date
    }])}><Plus size={16} />Add action</button><h4>Consequences & follow-ups</h4><p className="muted">Assess each consequence. A follow-up assigns responsibility; it does not create a cost, disposal, variation or schedule change.</p>{f.impacts.map((x, i) => <fieldset className="quality-task" key={x.kind}><legend>{x.kind.charAt(0).toUpperCase() + x.kind.slice(1)}</legend><div className="form-grid"><label className="field">Assessment<select required value={x.assessment} onChange={e => update('impacts', i, 'assessment', e.target.value)}><option value="">Choose assessment</option><option value="none">No consequence expected</option><option value="follow_up">Follow-up required</option></select></label><label className="field">Reason<input required maxLength={1000} value={x.reason} onChange={e => update('impacts', i, 'reason', e.target.value)} /></label>{x.assessment === 'follow_up' && <><People label="Follow-up owner" value={x.owner_id} onChange={v => update('impacts', i, 'owner_id', v)} people={options.people} /><label className="field">Follow-up due<input required type="date" value={x.due_date} onInput={e => update('impacts', i, 'due_date', e.target.value)} /></label></>}</div></fieldset>)}<label className="field">Plan basis / revision reason<textarea required maxLength={800} value={f.reason} onChange={e => change('reason', e.target.value)} /></label><div className="dialog-actions"><button className="primary" disabled={busy}>Save corrective plan</button></div></form>;
}
function EvidenceForm({
  r,
  onSave,
  busy
}) {
  const choices = r.state === 'verification' && r.can_review ? ['verification'] : r.state === 'in_progress' ? ['action'] : ['observation', 'containment', 'plan', 'authority'];
  const [purpose, setPurpose] = useState(choices[0]),
    [file, setFile] = useState(null),
    [caption, setCaption] = useState(''),
    [action, setAction] = useState(r.actions.find(a => a.owner_id === r.actor_id && a.state === 'pending')?.id || ''),
    [error, setError] = useState('');
  return <form onSubmit={async e => {
    e.preventDefault();
    setError('');
    try {
      if (!file || file.size > 2097152) throw new Error('Choose a file of up to 2 MiB.');
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.readAsDataURL(file);
      });
      await onSave({
        purpose,
        action_id: purpose === 'action' ? action : null,
        filename: file.name,
        mime: file.type || (/\.txt$/i.test(file.name) ? 'text/plain' : ''),
        content_base64: encoded,
        caption
      });
    } catch (e) {
      setError(e.message);
    }
  }}><h3>Attach evidence</h3><p className="muted">PDF, PNG, JPEG or plain text · maximum 2 MiB. The original file and its fingerprint stay with this cycle.</p><ErrorBox message={error} /><div className="form-grid"><label className="field">Purpose<select value={purpose} onChange={e => setPurpose(e.target.value)}>{choices.map(c => <option key={c}>{c}</option>)}</select></label>{purpose === 'action' && <label className="field">Your corrective action<select required value={action} onChange={e => setAction(e.target.value)}><option value="">Choose action</option>{r.actions.filter(a => a.owner_id === r.actor_id && a.state === 'pending').map(a => <option value={a.id} key={a.id}>{a.title}</option>)}</select></label>}<label className="field full">File<input type="file" required accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e => setFile(e.target.files[0])} /></label><label className="field full">What does this evidence show?<textarea required maxLength={800} value={caption} onChange={e => setCaption(e.target.value)} /></label></div><div className="dialog-actions"><button className="primary" disabled={busy}>Save evidence</button></div></form>;
}
function DecisionForm({
  r,
  action,
  actionId,
  onSave,
  busy
}) {
  const [note, setNote] = useState(''),
    [task, setTask] = useState(actionId || r.actions[0]?.id || '');
  const labels = {
    contain: 'Record containment',
    submit: 'Submit NCR',
    cancel: 'Cancel draft',
    submit_plan: 'Request plan review',
    approve_plan: 'Accept corrective plan',
    return_plan: 'Return / withdraw plan',
    request_verification: 'Request verification',
    withdraw_verification: 'Withdraw verification',
    close: 'Verify & close',
    fail: 'Return for corrective work',
    reopen: 'Reopen as a new cycle',
    complete: 'Complete action'
  };
  return <form onSubmit={e => {
    e.preventDefault();
    onSave({
      action,
      note,
      action_id: task
    });
  }}><h3>{labels[action]}</h3>{action === 'close' && <p className="notice">Check the stated acceptance criteria and your verification evidence. Downstream consequence follow-ups stay open.</p>}{action === 'reopen' && <p className="notice">A new investigation cycle starts. Previous actions, files and closure decisions remain in history.</p>}{action === 'fail' && <label className="field">Action requiring further work<select value={task} onChange={e => setTask(e.target.value)}>{r.actions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>}<label className="field">{action === 'close' ? 'Verification result against acceptance criteria' : action === 'contain' ? 'Immediate controls and who is responsible' : 'Reason / result'}<textarea autoFocus required maxLength={3000} value={note} onChange={e => setNote(e.target.value)} /></label><div className="dialog-actions"><button className="primary" disabled={busy}>{labels[action]}</button></div></form>;
}
function AssignmentForm({
  r,
  options,
  task,
  onSave,
  busy
}) {
  const [f, set] = useState({
    owner_id: task?.owner_id || r.owner_id,
    reviewer_id: r.reviewer_id,
    due_date: task?.due_date || r.due_date,
    note: ''
  });
  const change = field(f, set);
  return <form onSubmit={e => {
    e.preventDefault();
    onSave(f);
  }}><h3>{task ? 'Reassign corrective action' : 'Update responsibility & due date'}</h3><div className="form-grid"><People label="Responsible owner" people={options.people} value={f.owner_id} onChange={v => change('owner_id', v)} exclude={task ? [r.reviewer_id] : []} />{!task && <People label="Independent reviewer" kind="can_review" people={options.people} value={f.reviewer_id} onChange={v => change('reviewer_id', v)} exclude={[f.owner_id, r.reporter_id, r.plan_author_id, ...r.actions.map(a => a.owner_id)]} />}<label className="field">Due date<input required type="date" value={f.due_date} onInput={e => change('due_date', e.target.value)} /></label><label className="field full">Reason<textarea required value={f.note} onChange={e => change('note', e.target.value)} /></label></div><button className="primary" disabled={busy}>Save assignment</button></form>;
}
export function Quality({
  company,
  project,
  projects,
  preview = false,
  initialRecord,
  onChanged = () => {}
}) {
  const [selectedProject, setSelectedProject] = useState(project?.id || ''),
    [report, setReport] = useState(null),
    [r, setR] = useState(null),
    [options, setOptions] = useState(null),
    [mode, setMode] = useState(''),
    [decision, setDecision] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState({
      state: '',
      severity: ''
    });
  const currentProject = projects.find(p => p.id === (r?.project_id || selectedProject));
  useEffect(() => {
    const c = new AbortController();
    setReport(null);
    api(`/quality/report?company=${company.id}&project=${selectedProject}&state=${filter.state}&severity=${filter.severity}`, undefined, 'GET', c.signal).then(setReport).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => c.abort();
  }, [company.id, selectedProject, filter, revision]);
  useEffect(() => {
    const c = new AbortController();
    setOptions(null);
    if (r?.project_id || selectedProject) api(`/quality/options?company=${company.id}&project=${r?.project_id || selectedProject}`, undefined, 'GET', c.signal).then(setOptions).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => c.abort();
  }, [company.id, r?.project_id, selectedProject]);
  useEffect(() => {
    if (initialRecord) open(initialRecord);
  }, [initialRecord]);
  async function open(id) {
    setError('');
    setMode('');
    try {
      setR(await api('/quality/cases/' + id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function mutate(path, body, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const result = await api(path, {
        ...body,
        ...(r ? {
          version: r.version
        } : {})
      }, method);
      setR(result);
      setMode('');
      setDecision(null);
      setRevision(n => n + 1);
      onChanged();
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const perform = (path, body, method) => mutate(path, body, method).catch(() => {});
  const choose = (action, actionId) => {
    setError('');
    setDecision({
      action,
      actionId
    });
    setMode('decision');
  };
  function download() {
    const blob = new Blob([qualityCsv(report)], {
        type: 'text/csv;charset=utf-8'
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `Builder-ERP-NCR-${company.id}-${selectedProject || 'company'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const next = r && {
    draft: 'Attach observation evidence, then submit for investigation.',
    open: r.containment ? 'Investigate the cause and prepare corrective actions. Attach the plan for independent review.' : 'Record immediate containment first, then investigate the cause and prepare corrective actions.',
    plan_review: `${r.reviewer} reviews the corrective plan.`,
    in_progress: 'Assigned owners complete corrective actions and attach evidence.',
    verification: `${r.reviewer} checks the result against the acceptance criteria.`,
    closed: 'Verified closure is recorded. Downstream follow-ups remain separately accountable.',
    cancelled: 'This draft is cancelled and retained in history.'
  }[r.state];
  return <section className="quality-work"><ErrorBox message={error} retry={r ? () => open(r.id) : () => setRevision(n => n + 1)} />{r ? <><button className="back" onClick={() => {
        setR(null);
        setMode('');
        setError('');
      }}><ArrowLeft size={18} />All NCRs</button><p className="eyebrow">{company.name} · {r.project}</p><div className="section-head"><div><h2>{r.title}</h2><p className="muted">{r.id} · Cycle {r.cycle} · Revision {r.version}</p></div><Status value={r.state_label} /></div><div className="next-action"><div><strong>{next}</strong><small>{r.owner} · Due {dueLabel(r.due_date)} · {r.severity} severity</small></div></div><ol className="quality-steps" aria-label="NCR stages">{['draft', 'open', 'plan_review', 'in_progress', 'verification', 'closed'].map((s, i) => <li className={r.state === s ? 'current' : ''} key={s}>{i + 1}. {states[s]}</li>)}</ol><div className="quality-context"><span>{r.location.code} · {r.location.name}</span><span>{r.work_package.code} · {r.work_package.name}</span><span>Reviewer: {r.reviewer}</span></div>
 {mode ? <div className="quality-editor"><button className="back" onClick={() => {
          setMode('');
          setError('');
        }} disabled={busy}><ArrowLeft size={16} />Back to case</button>{options && mode === 'edit' && <CaseForm existing={r} options={options} company={company} project={currentProject} busy={busy} onSave={f => perform('/quality/cases/' + r.id, f, 'PUT')} />} {options && mode === 'plan' && <PlanForm r={r} options={options} busy={busy} onSave={f => perform(`/quality/cases/${r.id}/plan`, f)} />} {mode === 'evidence' && <EvidenceForm r={r} busy={busy} onSave={f => mutate(`/quality/cases/${r.id}/evidence`, f)} />} {mode === 'decision' && <DecisionForm r={r} {...decision} busy={busy} onSave={f => perform(decision.action === 'contain' ? `/quality/cases/${r.id}/containment` : decision.action === 'complete' ? `/quality/cases/${r.id}/actions/${decision.actionId}/complete` : `/quality/cases/${r.id}/decision`, f)} />} {options && mode === 'assignment' && <AssignmentForm r={r} options={options} task={decision?.task} busy={busy} onSave={f => perform(decision?.task ? `/quality/cases/${r.id}/actions/${decision.task.id}/assignment` : `/quality/cases/${r.id}/assignment`, f)} />}</div> : <>
 {!preview && <div className="quality-actions">{r.can_prepare && r.state === 'draft' && <><button className="secondary" onClick={() => setMode('edit')}>Edit draft</button><button className="primary" onClick={() => choose('submit')}>Submit NCR</button><button className="text-button" onClick={() => choose('cancel')}>Cancel draft</button></>}{r.can_prepare && r.state === 'open' && <><button className={r.containment ? 'text-button' : 'primary'} onClick={() => choose('contain')}>{r.containment ? 'Update containment' : 'Record containment'}</button><button className={r.containment ? 'primary' : 'secondary'} onClick={() => setMode('plan')}>{r.root_cause ? 'Revise' : 'Prepare'} corrective plan</button>{r.root_cause && <button className="secondary" onClick={() => choose('submit_plan')}>Request plan review</button>}</>}{r.can_review && r.state === 'plan_review' && <><button className="primary" onClick={() => choose('approve_plan')}>Review & accept plan</button><button className="secondary" onClick={() => choose('return_plan')}>Return plan</button></>}{r.can_prepare && r.state === 'plan_review' && <button className="secondary" onClick={() => choose('return_plan')}>Withdraw plan for revision</button>}{r.can_prepare && r.state === 'in_progress' && <button className="primary" onClick={() => choose('request_verification')}>Request verification</button>}{r.can_review && r.state === 'verification' && <><button className="primary" onClick={() => choose('close')}>Verify & close</button><button className="secondary" onClick={() => choose('fail')}>Return for corrective work</button></>}{r.can_prepare && r.state === 'verification' && <button className="secondary" onClick={() => choose('withdraw_verification')}>Withdraw verification</button>}{r.can_reopen && r.state === 'closed' && <button className="secondary" onClick={() => choose('reopen')}>Reopen case</button>}{(r.can_prepare && ['draft', 'open'].includes(r.state) || r.can_review && r.state === 'verification' || r.state === 'in_progress' && r.actions.some(a => a.owner_id === r.actor_id && a.state === 'pending')) && <button className="secondary" onClick={() => setMode('evidence')}>Attach evidence</button>}{r.can_reassign && !['closed', 'cancelled', 'plan_review', 'verification'].includes(r.state) && <button className="text-button" onClick={() => {
            setDecision(null);
            setMode('assignment');
          }}>Responsibility & due date</button>}</div>}
 <section className="record-section"><h3>Requirement & observation</h3><dl className="detail-list"><div><dt>Requirement</dt><dd>{r.requirement}</dd></div><div><dt>Observed · {dueLabel(r.observed_on)}</dt><dd>{r.observation}</dd></div><div><dt>Reported by</dt><dd>{r.reporter}</dd></div>{r.receipt && <div><dt>Receipt origin</dt><dd>{r.receipt.id} · {r.receipt.delivery_reference} · {r.receipt.accepted} accepted / {r.receipt.rejected} rejected</dd></div>}</dl></section>
 {r.containment && !r.root_cause && <section className='record-section'><h3>Immediate containment</h3><p>{r.containment}</p></section>}{r.root_cause && <section className="record-section"><h3>Corrective plan</h3><dl className="detail-list">{[['containment', 'Containment'], ['root_cause', 'Root cause'], ['disposition', 'Disposition'], ['remedy', 'Corrective approach'], ['acceptance', 'Acceptance criteria'], ['authority_reference', 'External authority']].map(([k, l]) => r[k] && <div key={k}><dt>{l}</dt><dd>{r[k]}</dd></div>)}</dl><h4>Actions</h4>{r.actions.map(a => <article className="quality-task" key={a.id}><div className="section-head"><strong>{a.title}</strong><Status value={a.state === 'complete' ? 'Completed' : 'To do'} /></div><p>{a.owner} · Due {dueLabel(a.due_date)}</p>{a.completion && <p>{a.completion}</p>}{!preview && r.state === 'in_progress' && a.state === 'pending' && <div className="quality-actions">{a.owner_id === r.actor_id && <button className="secondary" onClick={() => choose('complete', a.id)}>Record completion</button>}{r.can_reassign && <button className="text-button" onClick={() => {
                setDecision({
                  task: a
                });
                setMode('assignment');
              }}>Reassign action</button>}</div>}</article>)}</section>}
 <details className="record-section" open={r.impacts.some(i => i.assessment === 'follow_up')}><summary>Consequences & follow-ups</summary>{r.impacts.map(i => <div className="quality-impact" key={i.kind}><strong>{i.kind}</strong><p>{i.assessment === 'unknown' ? 'Not yet assessed' : i.assessment === 'none' ? 'No consequence expected' : 'Follow-up required'} · {i.reason}</p>{i.assessment === 'follow_up' && <small>{i.owner} · Due {dueLabel(i.due_date)} · Remains separate from quality closure</small>}</div>)}{r.cycle > 1 && <p className="muted">Earlier-cycle assessments remain in history and the report’s follow-up count.</p>}</details>
 <details className="record-section" open><summary>Evidence · {r.evidence.length} {r.evidence.length === 1 ? 'file' : 'files'}</summary>{r.evidence.length ? r.evidence.map(e => <div className="quality-file" key={e.id}><a href={`/api/quality/evidence/${e.id}`} download>{e.filename}<Download size={15} /></a><p>{e.caption}</p><small>Cycle {e.cycle} · {e.purpose} · {(e.size / 1024).toFixed(1)} KiB · {new Date(e.at).toLocaleString()}</small><details><summary>File fingerprint</summary><code>{e.sha256}</code></details></div>) : <p className="muted">No files yet. Attach observation evidence before submitting.</p>}</details><details className="record-section"><summary>Activity & previous cycles · {r.history.length} events</summary><ol className="history">{r.history.map(e => <li key={e.id}><strong>{e.action.replaceAll('_', ' ')} · Cycle {e.cycle}</strong><small>{e.actor} · {new Date(e.at).toLocaleString()} · Revision {e.version}</small><p>{e.note}</p><details><summary>Recorded case at this step</summary><p>{e.snapshot.title} · {states[e.snapshot.state]} · {e.snapshot.containment}</p><p>{e.snapshot.root_cause}</p><p>{e.snapshot.remedy}</p><p>{e.snapshot.acceptance}</p>{e.snapshot.actions.map(a => <p key={a.id}>{a.title} · {a.owner} · {a.state} · {a.completion}</p>)}{e.snapshot.impacts.map(i => <p key={i.kind}>{i.kind}: {i.assessment} · {i.reason} {i.owner_id ? `· ${nameOf(options?.people || [], i.owner_id)} · ${i.due_date}` : ''}</p>)}</details></li>)}</ol></details></>}
 </> : <><div className="section-head"><div><h2>Quality & NCRs</h2><p className="muted">One case from observation to independently verified closure.</p></div>{report && mode !== 'new' && <button className="secondary" onClick={download}><Download size={17} />Export findings & register</button>}</div>{mode !== 'new' && <div className="quality-filters"><label className="field">Scope<select value={selectedProject} onChange={e => {
            setSelectedProject(e.target.value);
            setMode('');
          }}><option value="">Company · all authorised projects</option>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field">State<select value={filter.state} onChange={e => setFilter({
            ...filter,
            state: e.target.value
          })}><option value="">All states</option>{Object.entries(states).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="field">Severity<select value={filter.severity} onChange={e => setFilter({
            ...filter,
            severity: e.target.value
          })}><option value="">All severities</option>{['low', 'medium', 'high', 'critical'].map(s => <option key={s}>{s}</option>)}</select></label></div>}{mode === 'new' && options ? <div className="quality-editor"><button className="back" onClick={() => setMode('')}><ArrowLeft size={16} />Back to register</button><CaseForm options={options} project={currentProject} company={company} busy={busy} onSave={f => perform('/quality/cases', f)} /></div> : <>{!report && !error && <p role="status">Loading NCR findings…</p>}{report && <><section className="report-findings"><h3>What this report shows</h3>{report.findings.map(f => <div key={f.id}><p>{f.text}</p>{f.sourceIds.length > 0 && <details className='quality-finding-sources'><summary>Supporting cases · {f.sourceIds.length}</summary>{report.rows.filter(c => f.sourceIds.includes(c.id)).map(c => <button className='text-button' key={c.id} onClick={() => open(c.id)}>{c.title} · {c.id}</button>)}</details>}</div>)}<small>{report.restricted ? 'Permission-limited population' : 'Full selected scope'} · Current UTC date {report.as_of} · {report.definition}</small></section><div className="section-head"><h3>NCR register</h3>{options?.can_write && !preview && <button className="primary" onClick={() => setMode('new')}><Plus size={17} />New NCR</button>}</div>{!selectedProject && <p className="muted">Choose a project above to create an NCR.</p>}{report.rows.length ? <div className="request-list">{report.rows.map(c => <button className="request-row" key={c.id} onClick={() => open(c.id)}><div><small>{c.id} · {c.project}</small><h3>{c.title}</h3><p>{c.location_code} · {c.owner} · Due {dueLabel(c.due_date)}</p><Status value={c.state_label} />{c.cycle > 1 && <small>Reopened · Cycle {c.cycle}</small>}</div><ArrowRight size={20} /></button>)}</div> : <Empty>No NCRs match these filters.</Empty>}<details className="record-section"><summary>Report basis & examples</summary>{report.limitations.map(l => <p key={l}>{l}</p>)}<p>Each supplied project has fictional draft, corrective-work and reopened cases. Open the history of the reopened example to follow an independently accepted plan, completed action, evidence and closure.</p><p>All matching records contribute to findings and export. Generated {report.generated_at} · {report.rules}.</p></details></>}</>}</>}
 </section>;
}
