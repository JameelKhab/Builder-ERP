import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { advanceAuthority } from './advances.mjs';
import { receivableBalance } from './receivable-balance.mjs';
import { appliedCorrection, effectiveCertificate, effectiveRecoveries } from './client-correction-state.mjs';
import { D, money, sum, requireThat } from './money.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (v, name, max = 2000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${name} is required (maximum ${max} characters).`);
  return v.trim();
};
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const max = (...values) => money(values.map(v => new D(v)).reduce((a, b) => a.gte(b) ? a : b));
const labels = { draft: 'Draft correction', returned: 'Changes requested', technical: 'Technical review', commercial: 'Commercial review', finance: 'Finance review', applied: 'Applied · originals retained', cancelled: 'Cancelled request' };
const next = { draft: 'Author to check impact, attach evidence and submit', returned: 'Author to revise the basis and start a fresh review', technical: 'Independent technical reviewer', commercial: 'Independent commercial reviewer', finance: 'Independent finance reviewer to apply the correction', applied: 'Review the credit and settle any customer credit separately', cancelled: 'History retained; no correction applied' };
export function clientCorrections(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const canRead = r => access.has(r.advance_id ? 'advances.read' : 'certificates.read', r.company_id, r.project_id) && access.has('ar.read', r.company_id, r.project_id);
  const canWrite = (r, who = actorId) => r.advance_id ? advanceAuthority(db, who, 'advances.write', r) : advanceAuthority(db, who, 'certificates.write', r) || advanceAuthority(db, who, 'ar.write', r);
  function scope(company, project) {
    requireThat(get('SELECT id FROM companies WHERE id=?', company) && access.has('ar.read', company, project, !project), 'Correction scope is unavailable.', 404);
    if (project) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is unavailable.', 404);
  }
  function options(company, project = null) {
    scope(company, project);
    const projects = all('SELECT id,name FROM projects WHERE company_id=? ORDER BY name', company).filter(p => canRead({company_id:company,project_id:p.id,advance_id:true}) || canRead({company_id:company,project_id:p.id}));
    const sources = [['client_advances','advance_id'],['client_certificates','certificate_id']].flatMap(([table,key]) => all(`SELECT * FROM ${table} WHERE company_id=? AND state='approved' ORDER BY rowid DESC`,company).filter(s => (!project || s.project_id===project) && canRead({...s,[key]:s.id}) && canWrite({...s,[key]:s.id})).map(s => {
      const existing=get(`SELECT id,state FROM client_corrections WHERE ${key}=? AND state<>'cancelled'`,s.id);
      return {id:s.id,kind:key==='advance_id'?'advance':'certificate',title:s.title,project_id:s.project_id,project:projects.find(p=>p.id===s.project_id)?.name,currency:s.currency,existing_correction:existing||null};
    }));
    return {company:get('SELECT id,name,currency FROM companies WHERE id=?',company),today:today(),projects,sources,can_write:sources.some(s=>!s.existing_correction)};
  }
  const row = id => {
    const r = get('SELECT * FROM client_corrections WHERE id=?', id);
    requireThat(r && canRead(r), 'Client correction is unavailable.', 404);
    return r;
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && v === r.version, 'Correction changed. Reload before continuing.', 409);
  const event = (r, action, reason) => run('INSERT INTO client_correction_events(correction_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?)', r.id, actorId, action, text(reason, 'Reason'), JSON.stringify(r), now());
  function source(input) {
    requireThat(!!input.advance_id !== !!input.certificate_id, 'Choose exactly one advance or certificate to correct.');
    const key = input.advance_id ? 'advance_id' : 'certificate_id',
      table = input.advance_id ? 'client_advances' : 'client_certificates';
    const s = get(`SELECT * FROM ${table} WHERE id=?`, input[key]);
    requireThat(s && canRead({
      ...s,
      [key]: s.id
    }), 'Approved correction source is unavailable.', 404);
    requireThat(s.state === 'approved', 'Only an approved source can be annulled.');
    return {
      source: s,
      key
    };
  }
  function calculate(input, effectiveDate) {
    const {
        source: s,
        key
      } = source(input),
      sourceRef = {
        [key]: s.id
      };
    requireThat(!appliedCorrection(db, sourceRef), 'This source already has an applied correction.', 409);
    const invoice = get(`SELECT * FROM client_invoices WHERE ${key}=?`, s.id) || null;
    const isAdvance = key === 'advance_id',
      snap = JSON.parse(s.snapshot),
      blockers = [];
    const pending = all("SELECT id FROM client_certificates WHERE contract_id=? AND state NOT IN ('approved','cancelled') ORDER BY id", s.contract_id);
    if (!isAdvance) {
      if (effectiveCertificate(db, s.contract_id)?.id !== s.id) blockers.push('Correct the later effective certificate first; cumulative quantities depend on this period.');
      if (pending.length) blockers.push(`Resolve pending measurement ${pending.map(x => x.id).join(', ')} before annulling certified work.`);
    }
    const recoveries = invoice && isAdvance ? effectiveRecoveries(db, invoice.id) : !isAdvance ? all('SELECT * FROM client_advance_recoveries WHERE certificate_id=? ORDER BY ordinal', s.id) : [];
    if (isAdvance && recoveries.length) blockers.push(`Correct the certified recovery first: ${recoveries.map(r => r.certificate_id).join(', ')}.`);
    const settlement = invoice?.state === 'posted' ? receivableBalance(db, invoice) : null;
    const pendingReceipts = invoice ? all("SELECT id,version,payload,reversal_of FROM client_receipts WHERE state='approved' ORDER BY id").filter(r => JSON.parse(r.payload).allocations.some(a => a.invoice_id === invoice.id)).map(r => ({
      id: r.id,
      version: r.version,
      reversal_of: r.reversal_of
    })) : [];
    if (pendingReceipts.length) blockers.push(`Return, cancel or record approved cash plans first: ${pendingReceipts.map(r => r.id).join(', ')}.`);
    const lastCorrection = get("SELECT max(effective_date) date FROM client_corrections WHERE contract_id=? AND state='applied'", s.contract_id)?.date;
    const earliest = [s.request_date || s.period_to, invoice?.accounting_date, settlement?.latest_date, lastCorrection].filter(Boolean).sort().at(-1);
    day(effectiveDate);
    requireThat(effectiveDate >= earliest && effectiveDate <= today(), `Correction date must be between ${earliest} and ${today()}.`);
    let journal = [];
    if (invoice?.state === 'posted') {
      const original = all('SELECT * FROM ledger_lines WHERE entry_id=? ORDER BY ordinal', invoice.journal_id);
      requireThat(original.length && get("SELECT id FROM ledger_entries WHERE id=? AND state='posted' AND source_type='client_invoice' AND source_id=?", invoice.journal_id, invoice.id), 'Original posted invoice journal is inconsistent.', 409);
      journal = original.map(l => ({
        account_id: l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        account_type: l.account_type,
        description: l.description,
        debit: l.credit,
        credit: l.debit,
        base_debit: l.base_credit,
        base_credit: l.base_debit,
        rounding_adjustment: money(new D(0).minus(l.rounding_adjustment))
      }));
      requireThat(money(sum(journal.map(l => l.debit))) === money(sum(journal.map(l => l.credit))) && money(sum(journal.map(l => l.base_debit))) === money(sum(journal.map(l => l.base_credit))), 'Original journal is unbalanced.', 409);
      for (const l of journal) {
        const a = get('SELECT * FROM ledger_accounts WHERE id=?', l.account_id);
        requireThat(a && a.company_id === s.company_id && a.type === l.account_type, 'Original reversal account identity changed.', 409);
      }
    }
    return {
      policy: 'builder-client-full-annulment-v1',
      source: s,
      invoice,
      settlement,
      recoveries,
      pending_receipts: pendingReceipts,
      predecessor_id: isAdvance ? null : s.predecessor_id,
      effective_predecessor: isAdvance ? null : effectiveCertificate(db, s.contract_id)?.id,
      authority_amount: max(isAdvance ? s.company_total : snap.company_authority, invoice?.company_gross || '0'),
      credit_total: journal.length ? invoice.total : '0.00',
      credit_base: journal.length ? invoice.company_total : '0.00',
      credit_exposure: money(sum(journal.map(l => l.base_debit))),
      customer_credit_after: settlement ? settlement.settled : '0.00',
      journal,
      earliest_date: earliest,
      blockers
    };
  }
  function stageAuthority(r, who, stage = r.state) {
    const s = JSON.parse(r.snapshot),
      distinct = ![r.author_id, ...(stage === 'commercial' ? [r.technical_by] : stage === 'finance' ? [r.technical_by, r.commercial_by] : [])].includes(who);
    if (!distinct) return false;
    if (stage === 'technical') return advanceAuthority(db, who, 'certificates.technical', r);
    if (stage === 'commercial') return advanceAuthority(db, who, 'certificates.commercial', r, 'certificate_approval_limit', s.authority_amount);
    if (stage !== 'finance') return false;
    const financial = advanceAuthority(db, who, r.advance_id ? 'advances.approve' : 'certificates.finance', r, r.advance_id ? 'advance_approval_limit' : 'certificate_approval_limit', s.authority_amount);
    return financial && (!s.journal.length || advanceAuthority(db, who, 'ar.post', r, 'ar_approval_limit', s.credit_exposure));
  }
  function validate(r) {
    const s = calculate(r, r.effective_date);
    requireThat(!s.blockers.length, s.blockers.join(' '), 409);
    requireThat(JSON.stringify(s) === r.snapshot, 'Correction dependencies changed. Return and revise the request.', 409);
    requireThat(canWrite(r, r.author_id), 'Correction author no longer has current scope. Resolve ownership before continuing.', 409);
    requireThat(r.evidence_id && get('SELECT id FROM client_correction_evidence WHERE id=? AND correction_id=?', r.evidence_id, r.id), 'Attach original correction evidence before submitting.');
    if (r.technical_by) requireThat(stageAuthority(r, r.technical_by, 'technical'), 'Technical reviewer no longer has current authority. Return for a new review cycle.', 409);
    if (r.commercial_by) requireThat(stageAuthority(r, r.commercial_by, 'commercial'), 'Commercial reviewer no longer has current authority. Return for a new review cycle.', 409);
    return s;
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        selected = old || input,
        {
          source: s,
          key
        } = source(selected);
      const ref = {
        ...s,
        [key]: s.id
      };
      requireThat(canWrite(ref), 'Current source preparation authority is required.', 403);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the correction author may revise an unsubmitted request.', 403);
      }
      const existing = get(`SELECT id FROM client_corrections WHERE ${key}=? AND state<>'cancelled' AND id<>?`, s.id, id || '');
      requireThat(!existing, `An existing correction already covers this source${existing ? ': ' + existing.id : ''}.`, 409);
      const snapshot = calculate(selected, input.effective_date),
        title = text(input.title, 'Correction title', 200),
        basis = text(input.basis, 'Correction reason and intended outcome');
      id = old?.id || uid('CCR');
      if (old) run("UPDATE client_corrections SET title=?,effective_date=?,basis=?,snapshot=?,invoice_id=?,state='draft',technical_by=NULL,commercial_by=NULL,version=version+1 WHERE id=?", title, input.effective_date, basis, JSON.stringify(snapshot), snapshot.invoice?.id || null, id);else run("INSERT INTO client_corrections(id,advance_id,certificate_id,invoice_id,contract_id,company_id,project_id,currency,title,effective_date,basis,snapshot,author_id,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)", id, key === 'advance_id' ? s.id : null, key === 'certificate_id' ? s.id : null, snapshot.invoice?.id || null, s.contract_id, s.company_id, s.project_id, s.currency, title, input.effective_date, basis, JSON.stringify(snapshot), actorId, now());
      if (input.base64 !== undefined) {
        const filename = text(input.filename, 'Evidence filename', 180);
        requireThat(!/[\\/\x00-\x1f]/.test(filename) && /\.(pdf|png|jpe?g|txt)$/i.test(filename), 'Use a plain PDF, PNG, JPG or TXT evidence filename.');
        requireThat(typeof input.base64 === 'string' && input.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64), 'Evidence encoding is invalid.');
        const bytes = Buffer.from(input.base64, 'base64');
        requireThat(bytes.length > 0 && bytes.length <= 2 * 1024 * 1024, 'Evidence must contain 1 byte–2 MiB.');
        const eid = uid('CCE');
        run('INSERT INTO client_correction_evidence VALUES(?,?,?,?,?,?,?)', eid, id, filename, createHash('sha256').update(bytes).digest('hex'), bytes, actorId, now());
        run('UPDATE client_corrections SET evidence_id=? WHERE id=?', eid, id);
      }
      event(row(id), old ? 'Correction revised' : 'Correction prepared', input.reason);
      return detail(id);
    });
  }
  function post(r, s) {
    if (!s.journal.length) return null;
    const period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.effective_date, r.effective_date);
    requireThat(period, 'Credit accounting date needs an open company period.');
    const id = uid('JRN'),
      year = r.effective_date.slice(0, 4),
      i = s.invoice,
      lines = JSON.stringify(s.journal);
    run('INSERT OR IGNORE INTO ledger_sequences VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id,reversal_of) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,'client_correction',?,?)", id, r.company_id, r.project_id, r.title, r.effective_date, r.currency, i.rate, i.rate_date, 'Exact original invoice carrying values', r.id, r.basis, lines, money(sum(s.journal.map(l => l.debit))), s.credit_exposure, r.author_id, now(), r.id, i.journal_id);
    s.journal.forEach((l, index) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${index + 1}`, id, r.company_id, r.project_id, l.account_id, index + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", `GL/${year}/${String(n).padStart(6, '0')}`, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'Client credit posted', r.basis, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    return id;
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      if (r.state === 'applied' && input.action === 'accept' && r.applied_by === actorId && stageAuthority(r, actorId, 'finance')) return detail(id);
      version(r, input.version);
      let state;
      if (input.action === 'cancel') {
        requireThat(r.author_id === actorId && canWrite(r) && !['applied', 'cancelled'].includes(r.state), 'Only the author may cancel an unapplied correction.', 403);
        state = 'cancelled';
      } else if (input.action === 'submit') {
        requireThat(r.state === 'draft' && r.author_id === actorId && canWrite(r), 'Only the author may submit a draft correction.', 403);
        validate(r);
        state = r.advance_id ? 'finance' : 'technical';
      } else {
        requireThat(stageAuthority(r, actorId), 'A different currently authorised reviewer is required for this stage.', 403);
        requireThat(['accept', 'return'].includes(input.action), 'Choose accept or return.');
        state = input.action === 'return' ? 'returned' : {
          technical: 'commercial',
          commercial: 'finance',
          finance: 'applied'
        }[r.state];
        if (input.action === 'accept') {
          const s = validate(r);
          if (state === 'applied') run('UPDATE client_corrections SET journal_id=?,applied_by=?,applied_at=? WHERE id=?', post(r, s), actorId, now(), id);
          if (state === 'commercial') run('UPDATE client_corrections SET technical_by=? WHERE id=?', actorId, id);
          if (state === 'finance') run('UPDATE client_corrections SET commercial_by=? WHERE id=?', actorId, id);
        }
      }
      run('UPDATE client_corrections SET state=?,version=version+1,cycle=cycle+? WHERE id=?', state, input.action === 'submit' ? 1 : 0, id);
      event(row(id), `${r.state} → ${state}`, input.reason);
      return detail(id);
    });
  }
  function readiness(r) {
    const s=JSON.parse(r.snapshot);
    let blockers = [];
    if (!['applied', 'cancelled'].includes(r.state)) {
      try {
        validate(r);
        if (s.journal.length && !get("SELECT id FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?",r.company_id,r.effective_date,r.effective_date)) blockers.push('The effective date needs an open company accounting period.');
      } catch (e) {
        blockers = [e.message];
      }
    }
    return blockers;
  }
  function detail(id) {
    const r=row(id),s=JSON.parse(r.snapshot),blockers=readiness(r);
    return {
      ...r,
      snapshot: s,
      blockers,
      state_label: labels[r.state], next_action: blockers.length ? 'Resolve the blockers before submitting or accepting' : r.state==='applied'&&!r.journal_id?'Source withdrawn; original evidence retained':next[r.state],
      today: today(), company_currency:get('SELECT currency FROM companies WHERE id=?',r.company_id).currency,
      project:get('SELECT name FROM projects WHERE id=?',r.project_id).name,
      author:get('SELECT name FROM users WHERE id=?',r.author_id).name,
      can_open_journal:access.has('finance.read',r.company_id,r.project_id),
      can_open_receipts:access.has('customer_receipts.read',r.company_id,r.project_id),
      can_accept:stageAuthority(r,actorId) && !blockers.length,
      can_edit: r.author_id === actorId && ['draft', 'returned'].includes(r.state) && canWrite(r),
      can_submit: r.author_id === actorId && r.state === 'draft' && canWrite(r),
      can_review: stageAuthority(r, actorId),
      can_cancel: r.author_id === actorId && !['applied', 'cancelled'].includes(r.state) && canWrite(r),
      evidence: all('SELECT id,filename,sha256,length(bytes) size,created_at FROM client_correction_evidence WHERE correction_id=? ORDER BY created_at,id', id),
      history: all('SELECT e.*,u.name actor FROM client_correction_events e JOIN users u ON u.id=e.actor_id WHERE correction_id=? ORDER BY e.id', id),
      findings: [s.journal.length ? `${r.currency} ${s.credit_total} full invoice credit; original functional carrying ${s.credit_base}.` : 'No posted invoice is affected, so this source withdrawal has no accounting credit.', s.settlement ? `${r.currency} ${s.customer_credit_after} cash in the retained review basis remains after this correction. No cash is refunded. Open the original invoice for its current balance.` : 'No recorded customer cash is affected by this correction.', r.certificate_id ? (r.state==='applied'?'This measurement and its certified recovery are withdrawn; original records remain.':'Measurement and its certified recovery will be withdrawn together at application; original records remain.') : (r.state==='applied'?'The approved advance has been withdrawn; original approval and evidence remain.':'The approved advance will be withdrawn at application; original approval and evidence remain.')]
    };
  }
  function list(company, project = null) {
    scope(company,project);
    return all('SELECT * FROM client_corrections WHERE company_id=? ORDER BY created_at DESC,id', company).filter(r => (!project || r.project_id === project) && canRead(r)).map(r => {
      const s = JSON.parse(r.snapshot),blockers=readiness(r);
      return {
        id: r.id,
        title: r.title,
        company_id: r.company_id,
        project_id: r.project_id,
        advance_id: r.advance_id,
        certificate_id: r.certificate_id,
        invoice_id: r.invoice_id,
        state: r.state,
        state_label:labels[r.state],next_action:blockers.length?blockers[0]:r.state==='applied'&&!r.journal_id?'Source withdrawn; original evidence retained':next[r.state],total:s.credit_total,blockers,
        project:get('SELECT name FROM projects WHERE id=?',r.project_id).name,
        contract_id:r.contract_id,
        source_title:s.source.title,
        currency: r.currency,
        effective_date: r.effective_date,
        credit_total: s.credit_total,
        credit_base: s.credit_base,
        journal_id: r.journal_id,
        can_review: stageAuthority(r, actorId),
        my_draft: r.author_id === actorId && ['draft', 'returned'].includes(r.state) && canWrite(r)
      };
    });
  }
  function download(id) {
    const e = get('SELECT * FROM client_correction_evidence WHERE id=?', id);
    requireThat(e, 'Evidence is unavailable.', 404);
    row(e.correction_id);
    return e;
  }
  function report(company, {
    project = null,
    currency: filterCurrency = null,
    to = today()
  } = {}) {
    day(to);
    requireThat(to <= today(), 'Report cutoff cannot be future.');
    requireThat(filterCurrency===null || /^[A-Z]{3}$/.test(filterCurrency),'Choose a three-letter currency.');
    const rows = list(company, project).filter(r => r.effective_date <= to && (!filterCurrency || r.currency===filterCurrency)),
      applied = rows.filter(r => r.state === 'applied');
    const currency = get('SELECT currency FROM companies WHERE id=?', company).currency;
    let ledgerCredit = new D(0);
    for (const r of applied.filter(r => r.journal_id)) {
      const invoice = get('SELECT * FROM client_invoices WHERE id=?', r.invoice_id),
        control = JSON.parse(invoice.snapshot).accounts.receivable.id;
      ledgerCredit = ledgerCredit.plus(sum(all('SELECT base_credit,base_debit FROM ledger_lines WHERE entry_id=? AND account_id=?', r.journal_id, control).map(l => new D(l.base_credit).minus(l.base_debit))));
    }
    const source = money(sum(applied.map(r => r.credit_base))),
      ledger = money(ledgerCredit);
    return {
      company_id: company,
      company_name:get('SELECT name FROM companies WHERE id=?',company).name,
      currency:filterCurrency,
      project_id: project,
      to,
      company_currency: currency,
      rows,
      currency_groups: [...new Set(applied.map(r => r.currency))].sort().map(currency => ({
        currency,
        credited: money(sum(applied.filter(r => r.currency === currency).map(r => r.credit_total)))
      })),
      reconciliation: {
        source_credit: source,
        ledger_credit: ledger,
        difference: money(new D(source).minus(ledger))
      },
      findings: [`${rows.length} correction requests dated through ${to}; ${applied.length} applied, including ${applied.filter(r => r.journal_id).length} posted credits.`, `${source} ${currency} credited from original carrying values; selected AR ledger credits ${ledger}; difference ${money(new D(source).minus(ledger))}.`, 'Cash is unchanged by these corrections. Customer receipts reports show debit balances and customer credits separately; refunds and reallocations are separate work.'],
      limitations: ['Full source annulments only. Partial/forward adjustments, refund/reallocation and full source parity remain open.', 'Status reflects records known now; effective dates select the accounting cutoff. This is not a reconstruction of historical knowledge.']
    };
  }
  return {
    options,
    save,
    decide,
    detail,
    list,
    download,
    report
  };
}
