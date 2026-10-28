import { randomUUID, createHash } from 'node:crypto';
import { policy } from './access.mjs';
import { transaction } from './db.mjs';
import { requireThat } from './money.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (v, label, max = 3000, optional = false) => {
  requireThat(typeof v === 'string' && v.length <= max && (optional || v.trim()), `${label} is required (maximum ${max} characters).`);
  return v.trim();
};
const date = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
export const QUALITY_STATES = {
  draft: 'Draft',
  open: 'Investigate & plan',
  plan_review: 'Review corrective plan',
  in_progress: 'Corrective work',
  verification: 'Verify the result',
  closed: 'Closed',
  cancelled: 'Cancelled'
};
export function quality(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (s, ...v) => db.prepare(s).get(...v),
    all = (s, ...v) => db.prepare(s).all(...v),
    run = (s, ...v) => db.prepare(s).run(...v);
  const can = (cap, r) => access.has(cap, r.company_id, r.project_id);
  const otherCan = (id, cap, r) => {
    const u = get('SELECT active FROM users WHERE id=?', id);
    return !!u?.active && policy(db, id).has(cap, r.company_id, r.project_id);
  };
  const row = id => {
    const r = get('SELECT * FROM quality_cases WHERE id=?', id);
    requireThat(r && can('quality.read', r), 'NCR is not available.', 404);
    return r;
  };
  const actions = r => all('SELECT a.*,u.name owner FROM quality_actions a JOIN users u ON u.id=a.owner_id WHERE case_id=? AND cycle=? ORDER BY a.rowid', r.id, r.cycle);
  const evidence = r => all('SELECT id,case_id,cycle,purpose,action_id,filename,mime,sha256,size,caption,author_id,case_version,at FROM quality_evidence WHERE case_id=? ORDER BY rowid', r.id);
  const impacts = r => all('SELECT i.*,u.name owner FROM quality_impacts i LEFT JOIN users u ON u.id=i.owner_id WHERE case_id=? AND cycle=? ORDER BY kind', r.id, r.cycle);
  const snapshot = r => ({
    ...r,
    actions: actions(r),
    impacts: impacts(r),
    evidence: evidence(r).map(e => e.id)
  });
  const event = (r, action, note) => run('INSERT INTO quality_events(case_id,cycle,version,actor_id,action,note,snapshot,at) VALUES(?,?,?,?,?,?,?,?)', r.id, r.cycle, r.version, actorId, action, note, JSON.stringify(snapshot(r)), now());
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This NCR changed. Reload before continuing.', 409);
  const prepare = r => can('quality.write', r) && [r.reporter_id, r.owner_id].includes(actorId);
  const independent = (r, id = actorId) => ![r.reporter_id, r.owner_id, r.plan_author_id, ...actions(r).map(a => a.owner_id), ...all("SELECT DISTINCT actor_id FROM quality_events WHERE case_id=? AND cycle=? AND action IN ('plan prepared','action completed')", r.id, r.cycle).map(e => e.actor_id), ...all('SELECT DISTINCT completed_by FROM quality_actions WHERE case_id=? AND cycle=? AND completed_by IS NOT NULL', r.id, r.cycle).map(a => a.completed_by)].includes(id);
  const review = r => actorId === r.reviewer_id && can('quality.review', r) && independent(r);
  const currentPeople = r => {
    requireThat(otherCan(r.owner_id, 'quality.write', r), 'The responsible owner no longer has access. Reassign the case.');
    requireThat(otherCan(r.reviewer_id, 'quality.review', r) && independent(r, r.reviewer_id), 'Choose an active independent reviewer with project access.');
    for (const a of actions(r)) requireThat(otherCan(a.owner_id, 'quality.write', r), 'An action owner no longer has access. Return the plan for reassignment.');
  };
  function detail(id) {
    const r = row(id),
      a = actions(r);
    return {
      ...r,
      state_label: QUALITY_STATES[r.state],
      project: get('SELECT name FROM projects WHERE id=?', r.project_id).name,
      location: get('SELECT code,name FROM project_locations WHERE id=?', r.location_id),
      work_package: get('SELECT code,name FROM work_packages WHERE id=?', r.work_package_id),
      reporter: get('SELECT name FROM users WHERE id=?', r.reporter_id).name,
      owner: get('SELECT name FROM users WHERE id=?', r.owner_id).name,
      reviewer: get('SELECT name FROM users WHERE id=?', r.reviewer_id).name,
      actions: a,
      impacts: impacts(r),
      evidence: evidence(r),
      history: all('SELECT e.*,u.name actor FROM quality_events e JOIN users u ON u.id=e.actor_id WHERE case_id=? ORDER BY e.id', id).map(e => ({
        ...e,
        snapshot: JSON.parse(e.snapshot)
      })),
      can_prepare: prepare(r),
      can_review: review(r),
      can_reassign: can('quality.review', r),
      can_reopen: can('quality.review', r),
      can_upload: can('quality.write', r) || can('quality.review', r),
      actor_id: actorId,
      receipt: r.receipt_id ? get('SELECT id,order_id,accepted,rejected,reason,delivery_reference FROM material_receipts WHERE id=?', r.receipt_id) : null
    };
  }
  const changed = (id, action, note) => {
    run('UPDATE quality_cases SET version=version+1 WHERE id=?', id);
    event(row(id), action, note);
    return detail(id);
  };
  function options(company, project) {
    requireThat(access.has('quality.read', company, project), 'Quality work is not available.', 404);
    requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is not available.', 404);
    const r = {
      company_id: company,
      project_id: project
    };
    return {
      actor_id: actorId,
      can_write: can('quality.write', r),
      people: all('SELECT id,name FROM users WHERE active=1').filter(u => otherCan(u.id, 'quality.write', r) || otherCan(u.id, 'quality.review', r)).map(u => ({
        ...u,
        can_write: otherCan(u.id, 'quality.write', r),
        can_review: otherCan(u.id, 'quality.review', r)
      })),
      locations: all('SELECT id,code,name FROM project_locations WHERE company_id=? AND project_id=? ORDER BY code', company, project),
      work_packages: all('SELECT id,code,name FROM work_packages WHERE company_id=? AND project_id=? ORDER BY code', company, project),
      receipts: all('SELECT r.id,r.order_id,r.accepted,r.rejected,r.reason,r.delivery_reference FROM material_receipts r JOIN purchase_orders o ON o.id=r.order_id WHERE o.company_id=? AND o.project_id=? ORDER BY r.rowid DESC', company, project)
    };
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        r = old || {
          company_id: input.company_id,
          project_id: input.project_id
        };
      access.requireCap('quality.write', r.company_id, r.project_id);
      options(r.company_id, r.project_id);
      if (old) {
        version(old, input.version);
        requireThat(old.state === 'draft' && prepare(old), 'Only the reporter or owner can revise a draft.', 403);
      }
      const fields = {
        work_package_id: input.work_package_id,
        location_id: input.location_id,
        receipt_id: input.receipt_id || null,
        title: text(input.title, 'Title', 160),
        requirement: text(input.requirement, 'Requirement / inspection reference', 1000),
        observation: text(input.observation, 'What was observed'),
        severity: input.severity,
        observed_on: date(input.observed_on),
        due_date: date(input.due_date),
        owner_id: input.owner_id,
        reviewer_id: input.reviewer_id
      };
      requireThat(['low', 'medium', 'high', 'critical'].includes(fields.severity), 'Choose a severity.');
      requireThat(fields.observed_on <= today(), 'Observed date cannot be in the future.');
      requireThat(fields.due_date >= fields.observed_on, 'Due date must follow the observation.');
      requireThat(get('SELECT id FROM work_packages WHERE id=? AND company_id=? AND project_id=?', fields.work_package_id, r.company_id, r.project_id) && get('SELECT id FROM project_locations WHERE id=? AND company_id=? AND project_id=?', fields.location_id, r.company_id, r.project_id), 'Choose a work item and location within this project.');
      if (fields.receipt_id) requireThat(get('SELECT r.id FROM material_receipts r JOIN purchase_orders o ON o.id=r.order_id WHERE r.id=? AND o.company_id=? AND o.project_id=?', fields.receipt_id, r.company_id, r.project_id), 'Receipt is not available.', 404);
      const prospective = {
        ...r,
        ...fields,
        reporter_id: old?.reporter_id || actorId
      };
      requireThat(otherCan(fields.owner_id, 'quality.write', r), 'Choose a responsible owner with project access.');
      requireThat(otherCan(fields.reviewer_id, 'quality.review', r) && ![prospective.reporter_id, fields.owner_id].includes(fields.reviewer_id), 'Choose a reviewer independent of the reporter and owner.');
      if (old) {
        run(`UPDATE quality_cases SET ${Object.keys(fields).map(k => k + '=?').join(',')} WHERE id=?`, ...Object.values(fields), id);
        return changed(id, 'draft revised', text(input.reason, 'Reason', 800));
      }
      id = uid('NCR');
      const record = {
        id,
        company_id: r.company_id,
        project_id: r.project_id,
        ...fields,
        reporter_id: actorId,
        state: 'draft',
        created_at: now()
      };
      run(`INSERT INTO quality_cases(${Object.keys(record).join(',')}) VALUES(${Object.keys(record).map(() => '?').join(',')})`, ...Object.values(record));
      for (const kind of ['cost', 'waste', 'change', 'delay']) run("INSERT INTO quality_impacts(case_id,cycle,kind,assessment) VALUES(?,1,?,'unknown')", id, kind);
      event(row(id), 'created', 'Draft NCR recorded.');
      return detail(id);
    });
  }
  function contain(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(r.state === 'open' && prepare(r), 'The reporter or owner records immediate containment before plan review.', 403);
      run('UPDATE quality_cases SET containment=? WHERE id=?', text(input.note, 'Immediate containment'), id);
      return changed(id, 'containment recorded', 'Immediate controls recorded before completing the root-cause investigation.');
    });
  }
  function plan(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(prepare(r) && r.state === 'open', 'The reporter or owner prepares an open NCR plan.', 403);
      const fields = {
        containment: text(input.containment, 'Immediate containment'),
        root_cause: text(input.root_cause, 'Root cause'),
        disposition: input.disposition,
        remedy: text(input.remedy, 'Corrective approach'),
        acceptance: text(input.acceptance, 'Verification / acceptance criteria'),
        authority_reference: text(input.authority_reference || '', 'External authority reference', 1000, true),
        plan_author_id: actorId
      };
      requireThat(['rework', 'repair', 'reject', 'use_as_is'].includes(fields.disposition), 'Choose a disposition.');
      requireThat(Array.isArray(input.actions) && input.actions.length > 0 && input.actions.length <= 20, 'Add 1–20 corrective or preventive actions.');
      const tasks = input.actions.map(a => ({
        title: text(a.title, 'Action', 600),
        owner_id: a.owner_id,
        due_date: date(a.due_date)
      }));
      for (const a of tasks) {
        requireThat(otherCan(a.owner_id, 'quality.write', r) && a.owner_id !== r.reviewer_id, 'An action owner must have project access and cannot be the reviewer.');
        requireThat(a.due_date >= r.observed_on, 'Action due date cannot precede the observation.');
      }
      requireThat(Array.isArray(input.impacts) && input.impacts.length === 4 && new Set(input.impacts.map(i => i.kind)).size === 4, 'Assess cost, waste, change and delay.');
      const assessed = input.impacts.map(i => {
        requireThat(['cost', 'waste', 'change', 'delay'].includes(i.kind) && ['none', 'follow_up'].includes(i.assessment), 'Choose a consequence assessment.');
        const x = {
          kind: i.kind,
          assessment: i.assessment,
          reason: text(i.reason, 'Consequence assessment reason', 1000),
          owner_id: null,
          due_date: null
        };
        if (i.assessment === 'follow_up') {
          requireThat(otherCan(i.owner_id, 'quality.write', r), 'Choose a consequence follow-up owner with project access.');
          x.owner_id = i.owner_id;
          x.due_date = date(i.due_date);
          requireThat(x.due_date >= r.observed_on, 'Follow-up date cannot precede the observation.');
        }
        return x;
      });
      // Old plan tasks remain in immutable event snapshots; unstarted returned-plan rows have no evidence.
      requireThat(!get('SELECT id FROM quality_evidence WHERE case_id=? AND cycle=? AND action_id IS NOT NULL', id, r.cycle), 'Action evidence exists; reopen a new cycle instead of replacing this plan.');
      run('DELETE FROM quality_actions WHERE case_id=? AND cycle=?', id, r.cycle);
      for (const a of tasks) run('INSERT INTO quality_actions(id,case_id,cycle,title,owner_id,due_date) VALUES(?,?,?,?,?,?)', uid('QA'), id, r.cycle, a.title, a.owner_id, a.due_date);
      for (const i of assessed) run('UPDATE quality_impacts SET assessment=?,reason=?,owner_id=?,due_date=? WHERE case_id=? AND cycle=? AND kind=?', i.assessment, i.reason, i.owner_id, i.due_date, id, r.cycle, i.kind);
      run(`UPDATE quality_cases SET ${Object.keys(fields).map(k => k + '=?').join(',')} WHERE id=?`, ...Object.values(fields), id);
      return changed(id, 'plan prepared', text(input.reason, 'Plan basis', 800));
    });
  }
  function attach(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat((can('quality.write', r) || can('quality.review', r)) && !['closed', 'cancelled'].includes(r.state), 'Evidence cannot be added in this state.', 403);
      requireThat(['observation', 'containment', 'plan', 'authority', 'action', 'verification'].includes(input.purpose), 'Choose an evidence purpose.');
      let action = null;
      if (input.purpose === 'action') {
        action = get('SELECT * FROM quality_actions WHERE id=? AND case_id=? AND cycle=?', input.action_id, id, r.cycle);
        requireThat(action && action.owner_id === actorId && r.state === 'in_progress' && action.state === 'pending', 'Only the action owner may attach completion evidence for pending corrective work.', 403);
      } else requireThat(!input.action_id, 'Select an action only for action evidence.');
      if (input.purpose === 'verification') requireThat(r.state === 'verification' && review(r), 'Only the independent reviewer adds verification evidence.', 403);else if (input.purpose !== 'action') requireThat(prepare(r) && ['draft', 'open'].includes(r.state), 'The reporter or owner adds investigation / plan evidence before review.', 403);
      requireThat(typeof input.content_base64 === 'string' && input.content_base64.length <= 2796204 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content_base64), 'Attach a valid file of up to 2 MiB.');
      const content = Buffer.from(input.content_base64, 'base64');
      requireThat(content.length > 0 && content.length <= 2097152, 'Attach a file of 1 byte to 2 MiB.');
      const filename = text(input.filename, 'Filename', 180);
      requireThat(!/[\x00-\x1f\x7f/\\]/.test(filename), 'Use a filename without paths or control characters.');
      const mime = input.mime;
      let valid = false;
      if (mime === 'application/pdf') valid = content.subarray(0, 5).toString() === '%PDF-';
      if (mime === 'image/png') valid = content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (mime === 'image/jpeg') valid = content[0] === 255 && content[1] === 216 && content[2] === 255;
      if (mime === 'text/plain') {
        try {
          const s = new TextDecoder('utf-8', {
            fatal: true
          }).decode(content);
          valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s) && !/<!doctype\s+html|<html|<script|<svg/i.test(s);
        } catch {}
      }
      requireThat(valid, 'Only valid PDF, PNG, JPEG or plain UTF-8 text evidence is supported.');
      const ext = {
        'application/pdf': /\.pdf$/i,
        'image/png': /\.png$/i,
        'image/jpeg': /\.jpe?g$/i,
        'text/plain': /\.txt$/i
      };
      requireThat(ext[mime].test(filename), 'The filename extension must match the file type.');
      requireThat(get('SELECT count(*) n FROM quality_evidence WHERE case_id=?', id).n < 100, 'This case has reached its 100-file limit.');
      run('INSERT INTO quality_evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', uid('QE'), id, r.cycle, input.purpose, action?.id || null, filename, mime, createHash('sha256').update(content).digest('hex'), content.length, content, text(input.caption, 'Evidence description', 800), actorId, r.version, now());
      return changed(id, 'evidence attached', input.purpose + ': ' + filename);
    });
  }
  function completeAction(id, actionId, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      access.requireCap('quality.write', r.company_id, r.project_id);
      const a = get('SELECT * FROM quality_actions WHERE id=? AND case_id=? AND cycle=?', actionId, id, r.cycle);
      requireThat(r.state === 'in_progress' && a?.state === 'pending' && a.owner_id === actorId, 'Only the assigned owner completes pending corrective work.', 403);
      requireThat(get("SELECT id FROM quality_evidence WHERE action_id=? AND purpose='action' AND author_id=? AND case_version>=COALESCE((SELECT MAX(version) FROM quality_events WHERE case_id=? AND action='verification failed'),0)", actionId, actorId, id), 'Attach current action evidence before completing this work.');
      run("UPDATE quality_actions SET state='complete',completion=?,completed_by=?,completed_at=? WHERE id=?", text(input.note, 'Work completed and result'), actorId, now(), actionId);
      return changed(id, 'action completed', a.title);
    });
  }
  function reassign(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      access.requireCap('quality.review', r.company_id, r.project_id);
      requireThat(!['closed', 'cancelled', 'plan_review', 'verification'].includes(r.state), 'Assignments are frozen during review and after closure. Return the review first.');
      const newR = {
        ...r,
        owner_id: input.owner_id,
        reviewer_id: input.reviewer_id
      };
      requireThat(otherCan(newR.owner_id, 'quality.write', r) && otherCan(newR.reviewer_id, 'quality.review', r) && independent(newR, newR.reviewer_id), 'Choose active, scoped, independent assignments.');
      const due = date(input.due_date);
      requireThat(due >= r.observed_on, 'Due date cannot precede observation.');
      run('UPDATE quality_cases SET owner_id=?,reviewer_id=?,due_date=? WHERE id=?', newR.owner_id, newR.reviewer_id, due, id);
      return changed(id, 'assignments revised', text(input.note, 'Reason'));
    });
  }
  function reassignAction(id, actionId, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(r.state === 'in_progress' && can('quality.review', r), 'Quality review authority is required to reassign corrective work.', 403);
      const a = get('SELECT * FROM quality_actions WHERE id=? AND case_id=? AND cycle=?', actionId, id, r.cycle);
      requireThat(a?.state === 'pending' && otherCan(input.owner_id, 'quality.write', r) && input.owner_id !== r.reviewer_id, 'Choose an active action owner, independent of the reviewer.');
      const due = date(input.due_date);
      requireThat(due >= r.observed_on, 'Action due date cannot precede observation.');
      run('UPDATE quality_actions SET owner_id=?,due_date=? WHERE id=?', input.owner_id, due, a.id);
      return changed(id, 'action reassigned', text(input.note, 'Reason'));
    });
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      const note = text(input.note, 'Decision / action reason', 3000);
      let state = r.state;
      switch (input.action) {
        case 'submit':
          requireThat(r.state === 'draft' && prepare(r), 'Only the reporter or owner submits a draft.', 403);
          currentPeople(r);
          requireThat(evidence(r).some(e => e.cycle === r.cycle && e.purpose === 'observation'), 'Attach observation evidence before submission.');
          state = 'open';
          break;
        case 'cancel':
          requireThat(r.state === 'draft' && prepare(r), 'Only a draft can be cancelled by its reporter or owner.', 403);
          state = 'cancelled';
          break;
        case 'submit_plan':
          requireThat(r.state === 'open' && prepare(r), 'Prepare the open case before requesting review.', 403);
          currentPeople(r);
          requireThat(r.containment && r.root_cause && r.remedy && r.acceptance && actions(r).length, 'Complete containment, cause, corrective plan and acceptance criteria.');
          requireThat(evidence(r).some(e => e.cycle === r.cycle && e.purpose === 'plan' && e.case_version >= get("SELECT MAX(version) v FROM quality_events WHERE case_id=? AND cycle=? AND action IN ('plan prepared','containment recorded')", id, r.cycle).v), 'Attach the corrective plan evidence.');
          if (r.disposition === 'use_as_is') requireThat(r.authority_reference && evidence(r).some(e => e.cycle === r.cycle && e.purpose === 'authority' && e.case_version >= get("SELECT MAX(version) v FROM quality_events WHERE case_id=? AND cycle=? AND action IN ('plan prepared','containment recorded')", id, r.cycle).v), 'Use-as-is requires an external authority reference and evidence.');
          state = 'plan_review';
          break;
        case 'approve_plan':
          requireThat(r.state === 'plan_review' && review(r), 'Only the assigned independent reviewer approves this plan.', 403);
          currentPeople(r);
          state = 'in_progress';
          break;
        case 'return_plan':
          requireThat(r.state === 'plan_review' && (review(r) || prepare(r) || can('quality.review', r) && !otherCan(r.reviewer_id, 'quality.review', r)), 'The reporter may withdraw the plan; the reviewer may return it.', 403);
          state = 'open';
          break;
        case 'withdraw_verification':
          requireThat(r.state === 'verification' && prepare(r), 'The reporter or owner may withdraw a verification request.', 403);
          state = 'in_progress';
          break;
        case 'request_verification':
          requireThat(r.state === 'in_progress' && prepare(r), 'The responsible owner or reporter requests verification.', 403);
          currentPeople(r);
          requireThat(actions(r).length && actions(r).every(a => a.state === 'complete'), 'Complete every corrective action first.');
          requireThat(impacts(r).every(i => i.assessment !== 'unknown'), 'Assess all downstream consequences first.');
          run('UPDATE quality_cases SET verification_requested_at=? WHERE id=?', now(), id);
          state = 'verification';
          break;
        case 'close':
          requireThat(r.state === 'verification' && review(r), 'Only the assigned independent reviewer closes this NCR.', 403);
          currentPeople(r);
          const requestVersion = get("SELECT MAX(version) v FROM quality_events WHERE case_id=? AND cycle=? AND action='request_verification'", id, r.cycle)?.v;
          requireThat(evidence(r).some(e => e.cycle === r.cycle && e.purpose === 'verification' && e.author_id === actorId && e.case_version >= requestVersion), 'Attach fresh independent verification evidence for this review.');
          state = 'closed';
          run('UPDATE quality_cases SET closed_at=? WHERE id=?', now(), id);
          break;
        case 'fail':
          requireThat(r.state === 'verification' && review(r), 'Only the assigned independent reviewer records failed verification.', 403);
          const a = get('SELECT * FROM quality_actions WHERE id=? AND case_id=? AND cycle=?', input.action_id, id, r.cycle);
          requireThat(a, 'Choose the corrective action to reopen.');
          run("UPDATE quality_actions SET state='pending',completion='',completed_by=NULL,completed_at=NULL WHERE id=?", a.id);
          state = 'in_progress';
          break;
        case 'reopen':
          requireThat(r.state === 'closed' && can('quality.review', r), 'An authorised quality reviewer reopens closed cases.', 403);
          run("UPDATE quality_cases SET cycle=cycle+1,containment='',root_cause='',disposition='',remedy='',acceptance='',authority_reference='',plan_author_id=NULL,verification_requested_at=NULL,closed_at=NULL WHERE id=?", id);
          for (const kind of ['cost', 'waste', 'change', 'delay']) run("INSERT INTO quality_impacts(case_id,cycle,kind,assessment) VALUES(?,?,?,'unknown')", id, r.cycle + 1, kind);
          state = 'open';
          break;
        default:
          requireThat(false, 'Choose a supported quality action.');
      }
      run('UPDATE quality_cases SET state=? WHERE id=?', state, id);
      return changed(id, input.action === 'fail' ? 'verification failed' : input.action, note);
    });
  }
  function list(company, project = null) {
    requireThat(access.has('quality.read', company, project, !project), 'Quality work is not available.', 404);
    return all('SELECT q.*,p.name project,u.name owner,rv.name reviewer,l.code location_code,l.name location FROM quality_cases q JOIN projects p ON p.id=q.project_id JOIN users u ON u.id=q.owner_id JOIN users rv ON rv.id=q.reviewer_id JOIN project_locations l ON l.id=q.location_id WHERE q.company_id=? ORDER BY q.created_at DESC,q.id', company).filter(r => (!project || r.project_id === project) && can('quality.read', r)).map(r => ({
      ...r,
      state_label: QUALITY_STATES[r.state],
      can_review: ['plan_review', 'verification'].includes(r.state) && review(r),
      my_action: actions(r).some(a => a.owner_id === actorId && a.state === 'pending') && r.state === 'in_progress',
      my_case: [r.owner_id, r.reporter_id].includes(actorId),
      pending_impacts: all("SELECT kind,cycle,reason,owner_id,due_date FROM quality_impacts WHERE case_id=? AND assessment='follow_up'", r.id)
    }));
  }
  function report(company, project, filters = {}) {
    let rows = list(company, project);
    if (filters.state) {
      requireThat(Object.hasOwn(QUALITY_STATES, filters.state), 'Unknown state filter.');
      rows = rows.filter(r => r.state === filters.state);
    }
    if (filters.severity) {
      requireThat(['low', 'medium', 'high', 'critical'].includes(filters.severity), 'Unknown severity filter.');
      rows = rows.filter(r => r.severity === filters.severity);
    }
    const open = rows.filter(r => !['closed', 'cancelled'].includes(r.state)),
      overdue = open.filter(r => r.due_date < today()),
      reviews = rows.filter(r => ['plan_review', 'verification'].includes(r.state)),
      reopened = rows.filter(r => r.cycle > 1),
      followups = rows.filter(r => r.pending_impacts.length);
    const findings = [{
      id: 'population',
      text: `${rows.length} NCRs match this scope: ${open.length} open, ${rows.filter(r => r.state === 'closed').length} closed and ${rows.filter(r => r.state === 'cancelled').length} cancelled.`,
      sourceIds: rows.map(r => r.id)
    }, {
      id: 'overdue',
      text: `${overdue.length} open NCRs are past their due date; ${reviews.length} await a plan or verification decision.`,
      sourceIds: [...new Set([...overdue, ...reviews].map(r => r.id))]
    }, {
      id: 'cycles',
      text: `${reopened.length} ${reopened.length === 1 ? 'case has' : 'cases have'} been reopened. Each case counts once in its current state; earlier cycles remain in history.`,
      sourceIds: reopened.map(r => r.id)
    }, {
      id: 'impacts',
      text: `Consequence follow-ups: ${rows.reduce((n, r) => n + r.pending_impacts.length, 0)} across ${followups.length} ${followups.length === 1 ? 'case' : 'cases'}. Closed cases are included. These are follow-up obligations, not financial or disposal postings.`,
      sourceIds: followups.map(r => r.id)
    }];
    return {
      company: get('SELECT id,name FROM companies WHERE id=?', company),
      project: project || null,
      generated_at: now(),
      as_of: today(),
      definition: 'quality-current-v1',
      rules: 'quality-findings-v1',
      restricted: !access.has('quality.read', company, null),
      filters,
      findings,
      rows,
      totals: {
        cases: rows.length,
        open: open.length,
        overdue: overdue.length,
        closed: rows.filter(r => r.state === 'closed').length
      },
      limitations: ['Current operational register; not a historical cutoff reconstruction.', 'NCRs only. Existing HSE, inspection, ITP and snag sample registers are outside this population.', 'No automatic cost, cash, variation, waste or delay posting. Consequence follow-ups remain open until connected downstream workflows resolve them.']
    };
  }
  function download(id) {
    const e = get('SELECT * FROM quality_evidence WHERE id=?', id);
    requireThat(e, 'Evidence is not available.', 404);
    row(e.case_id);
    return e;
  }
  return {
    detail,
    options,
    save,
    plan,
    contain,
    attach,
    completeAction,
    reassignAction,
    reassign,
    decide,
    list,
    report,
    download
  };
}
