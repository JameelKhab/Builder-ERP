import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { estimates } from './estimates.mjs';
import { policy } from './access.mjs';
import { requireThat } from './money.mjs';
import { readBoqWorkbook } from './boq-workbook.mjs';
import { intakeDigest, validateIntake } from './boq-intake-validation.mjs';
import { BOQ_STATES, suggestBoqMapping } from '../shared/boq-intake.mjs';
import { createHash } from 'node:crypto';
const uid = p => `${p}-${randomUUID().slice(0, 12).toUpperCase()}`,
  now = () => new Date().toISOString();
const note = v => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= 2000, 'Add a review/correction reason (up to 2,000 characters).');
  return v.trim();
};
export function boqIntake(db, actorId, today) {
  const est = estimates(db, actorId, today),
    access = policy(db, actorId);
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const row = id => {
    const b = get('SELECT * FROM boq_intakes WHERE id=?', id);
    requireThat(b, 'Intake is unavailable.', 404);
    est.detail(b.estimate_id);
    return b;
  };
  const estimate = b => est.detail(b.estimate_id);
  const files = b => all('SELECT * FROM boq_intake_files WHERE batch_id=? ORDER BY rowid', b.id);
  const currentCheck = b => b.current_check_id ? get('SELECT * FROM boq_intake_checks WHERE id=? AND batch_id=?', b.current_check_id, b.id) : null;
  const version = (b, v) => requireThat(Number.isSafeInteger(v) && b.version === v, 'This intake changed. Reload before continuing.', 409);
  const reviewerAllowed = (b, who = actorId) => who !== b.author_id && get('SELECT active FROM users WHERE id=?', who)?.active === 1 && policy(db, who).has('tenders.approve', estimate(b).company_id, estimate(b).project_id);
  const editable = b => {
    requireThat(b.author_id === actorId && estimate(b).can_edit && !['committed', 'cancelled'].includes(b.state), 'Only the estimate author can prepare this open intake.', 403);
  };
  const event = (b, action, reason, checkId = b.current_check_id) => run('INSERT INTO boq_intake_events(batch_id,actor_id,action,reason,check_id,at) VALUES(?,?,?,?,?,?)', b.id, actorId, action, note(reason), checkId, now());
  const summary = b => {
    const e = estimate(b),
      check = currentCheck(b),
      result = check ? JSON.parse(check.result) : null;
    return {
      ...b,
      title: e.title,
      company_id: e.company_id,
      project_id: e.project_id,
      state_label: b.state === 'checked' ? result?.issues.length ? 'Needs correction' : 'Needs intake review' : BOQ_STATES[b.state],
      file_names: all('SELECT filename FROM boq_intake_files WHERE batch_id=? ORDER BY rowid', b.id).map(f => f.filename),
      author: get('SELECT name FROM users WHERE id=?', b.author_id)?.name,
      file_count: get('SELECT count(*) n FROM boq_intake_files WHERE batch_id=?', b.id).n,
      issue_count: result?.issues.length ?? null,
      can_cancel: b.author_id === actorId && access.has('tenders.write', e.company_id, e.project_id) && !['committed', 'cancelled'].includes(b.state),
      can_check: b.author_id === actorId && e.can_edit && !['committed', 'cancelled'].includes(b.state),
      can_review: b.state === 'checked' && !result?.issues.length && check?.estimate_version === e.version && ['draft', 'returned'].includes(e.state) && reviewerAllowed(b),
      can_return: b.state === 'checked' && reviewerAllowed(b),
      can_commit: b.state === 'reviewed' && b.author_id === actorId && e.can_edit && check?.estimate_version === e.version,
      stale: check ? check.estimate_version !== e.version && b.state !== 'committed' : false
    };
  };
  const detail = id => {
    const b = row(id),
      check = currentCheck(b),
      result = check ? JSON.parse(check.result) : null;
    return {
      ...summary(b),
      result,
      configs: check ? JSON.parse(check.config) : files(b).map(f => ({
        file_id: f.id,
        ...suggestBoqMapping(JSON.parse(f.parsed))
      })),
      files: files(b).map(f => {
        const parsed = JSON.parse(f.parsed);
        return {
          id: f.id,
          filename: f.filename,
          sha256: f.sha256,
          size: f.bytes.length,
          format: parsed.format,
          sheets: parsed.sheets.map(s => ({
            name: s.name,
            hidden: s.hidden,
            rows: s.rows.length,
            headings: s.rows.filter(r => r.number <= 20)
          }))
        };
      }),
      history: all('SELECT e.id,e.action,e.reason,e.at,e.check_id,u.name actor FROM boq_intake_events e JOIN users u ON u.id=e.actor_id WHERE e.batch_id=? ORDER BY e.id', id),
      checks: all('SELECT id,estimate_version,at FROM boq_intake_checks WHERE batch_id=? ORDER BY rowid', id),
      reviewed_by_name: b.reviewed_by ? get('SELECT name FROM users WHERE id=?', b.reviewed_by)?.name : null
    };
  };
  const refresh = b => {
    const check = currentCheck(b),
      e = estimate(b);
    requireThat(check && ['draft', 'returned'].includes(e.state) && e.version === check.estimate_version, 'Estimate changed or is no longer editable. Run a fresh intake check.', 409);
    const result = validateIntake(db, e, files(b), JSON.parse(check.config));
    requireThat(!result.issues.length && intakeDigest(result) === check.digest, 'Rows, masters or calculations changed. Run a fresh intake check and obtain review again.', 409);
    return {
      check,
      result,
      e
    };
  };
  return {
    detail,
    list(c, p = null) {
      est.options(c, p);
      return all('SELECT i.* FROM boq_intakes i JOIN estimate_versions e ON e.id=i.estimate_id WHERE e.company_id=? ORDER BY i.created_at DESC', c).filter(b => {
        const e = get('SELECT company_id,project_id FROM estimate_versions WHERE id=?', b.estimate_id);
        return (!p || e.project_id === p) && access.has('tenders.read', c, e.project_id);
      }).map(summary);
    },
    options(estimateId) {
      const e = est.detail(estimateId),
        o = est.options(e.company_id, e.project_id);
      return {
        units: o.units,
        cost_codes: o.cost_codes,
        products: all('SELECT id,code,name,uom FROM products WHERE company_id=? AND active=1 ORDER BY code', e.company_id)
      };
    },
    upload(estimateId, input) {
      const e = est.detail(estimateId);
      requireThat(e.can_edit, 'Only the author can upload into an editable estimate.', 403);
      requireThat(input.estimate_version === e.version, 'Estimate changed. Reload before uploading.', 409);
      const reason = note(input.reason);
      requireThat(Array.isArray(input.files) && input.files.length >= 1 && input.files.length <= 5, 'Upload 1 to 5 files in one intake.');
      let total = 0;
      const seen = new Set();
      const parsed = input.files.map(f => {
        requireThat(typeof f.base64 === 'string' && f.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.base64), 'Invalid or oversized file encoding.');
        const bytes = Buffer.from(f.base64, 'base64');
        total += bytes.length;
        requireThat(total <= 6 * 1024 * 1024, 'The combined intake must be at most 6 MiB.');
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        requireThat(!seen.has(sha256), 'The same file appears twice in this intake.');
        seen.add(sha256);
        return {
          id: uid('BFILE'),
          filename: f.filename,
          bytes,
          sha256,
          parsed: JSON.stringify(readBoqWorkbook(f.filename, bytes))
        };
      });
      return transaction(db, () => {
        for (const f of parsed) requireThat(!get("SELECT f.id FROM boq_intake_files f JOIN boq_intakes b ON b.id=f.batch_id JOIN estimate_versions e ON e.id=b.estimate_id WHERE e.study_id=? AND f.sha256=? AND b.state='committed'", e.study_id, f.sha256), 'This workbook was already added to this study. Revise the source deliberately; duplicate imports are blocked.', 409);
        const id = uid('INTAKE');
        run("INSERT INTO boq_intakes(id,estimate_id,author_id,state,created_at) VALUES(?,?,?,'uploaded',?)", id, estimateId, actorId, now());
        for (const f of parsed) run('INSERT INTO boq_intake_files VALUES(?,?,?,?,?,?)', f.id, id, f.filename, f.sha256, f.bytes, f.parsed);
        event(row(id), 'uploaded', reason);
        return detail(id);
      });
    },
    check(id, input) {
      return transaction(db, () => {
        const b = row(id);
        version(b, input.version);
        editable(b);
        const fs = files(b);
        requireThat(Array.isArray(input.configs) && input.configs.length === fs.length && new Set(input.configs.map(c => c.file_id)).size === fs.length && input.configs.every(c => fs.some(f => f.id === c.file_id)), 'Configure each file exactly once.');
        const configs = fs.map(f => {
          const c = input.configs.find(c => c.file_id === f.id);
          requireThat(c.mapping && typeof c.mapping === 'object' && !Array.isArray(c.mapping) && Object.keys(c.mapping).length <= 10, 'Provide a bounded column mapping.');
          return {
            file_id: f.id,
            sheet: c.sheet,
            header: c.header,
            mapping: c.mapping,
            expected_total: c.expected_total,
            default_product: c.default_product || '',
            default_cost_code: c.default_cost_code || ''
          };
        });
        const e = estimate(b),
          result = validateIntake(db, e, fs, configs),
          checkId = uid('BCHECK');
        run('INSERT INTO boq_intake_checks VALUES(?,?,?,?,?,?,?,?)', checkId, id, actorId, e.version, JSON.stringify(configs), JSON.stringify(result), intakeDigest(result), now());
        run("UPDATE boq_intakes SET state='checked',version=version+1,current_check_id=?,reviewed_by=NULL,reviewed_at=NULL WHERE id=?", checkId, id);
        event(row(id), result.issues.length ? 'checked with issues' : 'checked and reconciled', input.reason);
        return detail(id);
      });
    },
    decide(id, input) {
      return transaction(db, () => {
        const b = row(id);
        version(b, input.version);
        const reason = note(input.reason);
        if (input.action === 'review') {
          requireThat(b.state === 'checked' && reviewerAllowed(b), 'A different authorised tender reviewer must review this checked intake.', 403);
          requireThat(input.confirmed === true, 'Confirm the file selection, mappings and expected totals have been reconciled.');
          refresh(b);
          run("UPDATE boq_intakes SET state='reviewed',version=version+1,reviewed_by=?,reviewed_at=? WHERE id=?", actorId, now(), id);
        } else if (input.action === 'return') {
          requireThat(b.state === 'checked' && reviewerAllowed(b), 'A different tender reviewer may request changes.', 403);
          run("UPDATE boq_intakes SET state='returned',version=version+1,reviewed_by=NULL,reviewed_at=NULL WHERE id=?", id);
        } else if (input.action === 'cancel') {
          requireThat(summary(b).can_cancel, 'Only the authorised author can cancel an open intake.', 403);
          run("UPDATE boq_intakes SET state='cancelled',version=version+1 WHERE id=?", id);
        } else requireThat(false, 'Unknown intake decision.');
        event(row(id), input.action, reason);
        return detail(id);
      });
    },
    commit(id, input) {
      return transaction(db, () => {
        const b = row(id),
          e = estimate(b);
        requireThat(b.author_id === actorId && access.has('tenders.write', e.company_id, e.project_id), 'Only the authorised intake author may add these rows.', 403);
        if (b.state === 'committed') return detail(id);
        version(b, input.version);
        editable(b);
        requireThat(b.state === 'reviewed' && reviewerAllowed(b, b.reviewed_by), 'Obtain independent review from a currently authorised reviewer before adding rows.', 403);
        const {
            result
          } = refresh(b),
          reason = note(input.reason);
        const saved = est.save(e.id, {
          ...e,
          lines: [...e.lines, ...result.rows.map(r => r.line)],
          reason: `${reason}\nBOQ intake ${id}; checked ${b.current_check_id}; reviewed by ${b.reviewed_by}.`
        });
        requireThat(JSON.stringify(saved.calculation.totals) === JSON.stringify(result.calculation.totals), 'Calculated totals changed while applying intake.', 409);
        for (const r of result.rows) run('INSERT INTO boq_intake_lines VALUES(?,?,?,?,?,?,?,?)', id, r.file_id, e.study_id, e.id, r.line.key, r.source_sheet, r.source_row, JSON.stringify(r));
        run("UPDATE boq_intakes SET state='committed',version=version+1,committed_version=? WHERE id=?", saved.version, id);
        event(row(id), 'added to draft', reason);
        return detail(id);
      });
    },
    download(fileId) {
      const f = get('SELECT * FROM boq_intake_files WHERE id=?', fileId);
      requireThat(f, 'File unavailable.', 404);
      row(f.batch_id);
      return {
        filename: f.filename,
        bytes: f.bytes,
        sha256: f.sha256
      };
    },
    previousCheck(id, checkId) {
      row(id);
      const c = get('SELECT * FROM boq_intake_checks WHERE id=? AND batch_id=?', checkId, id);
      requireThat(c, 'Check unavailable.', 404);
      return {
        ...c,
        config: JSON.parse(c.config),
        result: JSON.parse(c.result)
      };
    }
  };
}
