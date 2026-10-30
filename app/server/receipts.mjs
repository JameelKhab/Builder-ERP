import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { payableRatio } from './payables.mjs';
import { assertAdvancePaidProtection } from './advance-recovery.mjs';
import { receivableBalance } from './receivable-balance.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`,
  now = () => new Date().toISOString();
const text = (v, label, max = 2000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${label} is required (maximum ${max} characters).`);
  return v.trim();
};
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const amount = v => {
  decimal(v, 'Amount', false);
  requireThat(new D(v).cmp(money(v)) === 0, 'Use at most two decimals for amounts.');
  return money(v);
};
const abs = v => new D(v).gte(0) ? new D(v) : new D(0).minus(v);
export const RECEIPT_STATES = {
  draft: 'Draft receipt',
  submitted: 'Needs approval',
  returned: 'Changes requested',
  approved: 'Approved · awaiting recording',
  recorded: 'Recorded receipt',
  cancelled: 'Cancelled'
};
export function receipts(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(`customer_receipts.${cap}`, r.company_id, r.project_id);
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This receipt changed. Reload before continuing.', 409);
  const company = c => {
    const r = get('SELECT * FROM companies WHERE id=?', c);
    requireThat(r, 'Company is unavailable.', 404);
    return r;
  };
  const scope = (c, p) => {
    company(c);
    requireThat(access.has('customer_receipts.read', c, p, !p), 'Receipt scope is unavailable.', 404);
    if (p) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', p, c), 'Project is unavailable.', 404);
  };
  const row = id => {
    const r = get('SELECT * FROM client_receipts WHERE id=?', id);
    requireThat(r && can('read', r), 'Receipt is unavailable.', 404);
    return r;
  };
  const invoiceRow = id => {
    const r = get("SELECT * FROM client_invoices WHERE id=? AND state='posted'", id);
    requireThat(r && can('read', r), 'Posted client invoice is unavailable.', 404);
    return r;
  };
  const event = (r, action, reason) => run('INSERT INTO client_receipt_events(receipt_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?)', r.id, r.company_id, r.project_id, actorId, action, text(reason, 'Reason'), JSON.stringify(r), now());
  const authority = (r, who, cap = 'approve') => {
    try {
      const p = policy(db, who);
      p.actor();
      return p.has(`customer_receipts.${cap}`, r.company_id, r.project_id) && (cap !== 'approve' || p.matching(r.company_id, r.project_id).some(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('customer_receipts.approve') && new D(g.receipt_approval_limit || 0).gt(0) && new D(g.receipt_approval_limit || 0).gte(r.authority_amount)));
    } catch {
      return false;
    }
  };
  const reviewer = (r, who = actorId) => who !== r.author_id && authority(r, who);
  const clearance = (id, to = '9999-12-31') => get('SELECT b.id row_id,b.date,b.reference,s.reference statement,m.actor_id FROM bank_receipt_matches m JOIN bank_rows b ON b.id=m.row_id JOIN bank_statements s ON s.id=b.statement_id WHERE m.receipt_id=? AND m.active=1 AND b.date<=?', id, to) || null;
  const reversed = (id, to = '9999-12-31') => get("SELECT id FROM client_receipts WHERE reversal_of=? AND state='recorded' AND accounting_date<=?", id, to)?.id || null;
  const account = (id, c, correction = false) => {
    const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, c);
    requireThat(a && (a.active || correction), 'A receipt account is inactive or unavailable.');
    return a;
  };
  const bankSnapshot = (id, c, correction = false) => {
    const b = get('SELECT * FROM payment_banks WHERE id=? AND company_id=?', id, c);
    requireThat(b && (b.active || correction), 'Choose an active accounting bank in this company.');
    return {
      ...b,
      accounts: [b.account_id, b.gain_account_id, b.loss_account_id].map(a => account(a, c, correction))
    };
  };
  const reserved = (id, exclude = null) => money(sum(all("SELECT id,payload FROM client_receipts WHERE state='approved' AND reversal_of IS NULL AND id<>?", exclude || '').flatMap(r => JSON.parse(r.payload).allocations).filter(a => a.invoice_id === id).map(a => a.amount)));
  const balanceRow = (i, to = '9999-12-31') => {
    const s = JSON.parse(i.snapshot),
      b = receivableBalance(db, i, to);
    return {
      id: i.id,
      title: i.title,
      contract_id: i.contract_id,
      project_id: i.project_id,
      project: get('SELECT name FROM projects WHERE id=?', i.project_id).name,
      customer_id: i.customer_id,
      customer: s.contract.customer,
      currency: i.currency,
      total: i.total,
      company_total: i.company_total,
      accounting_date: i.accounting_date,
      due_date: i.due_date,
      settled: b.settled,
      base_settled: b.base_settled,
      open: b.open,
      base_open: b.base_open,
      latest_date: b.latest_date,
      reserved: reserved(i.id)
    };
  };
  function balances(c, p = null, to = '9999-12-31') {
    scope(c, p);
    return all("SELECT * FROM client_invoices WHERE company_id=? AND state='posted' AND accounting_date<=? ORDER BY due_date,id", c, to).filter(i => (!p || i.project_id === p) && can('read', i)).map(i => balanceRow(i, to));
  }
  function prepare(r, input) {
    const bank = bankSnapshot(r.bank_id, r.company_id),
      items = input.allocations;
    requireThat(Array.isArray(items) && items.length > 0 && items.length <= 30 && items.every(a => a && typeof a.invoice_id === 'string'), 'Choose 1–30 posted client invoices.');
    requireThat(new Set(items.map(a => a.invoice_id)).size === items.length, 'Select each invoice once.');
    let first;
    const allocations = items.map(x => {
      const i = invoiceRow(x.invoice_id),
        p = receivableBalance(db, i);
      if (!first) first = i;
      requireThat(i.company_id === r.company_id && i.customer_id === first.customer_id && i.currency === first.currency, 'A receipt needs one company, customer and invoice currency.');
      const a = amount(x.amount);
      requireThat(new D(a).lte(p.open) && new D(p.base_open).gte(0), 'Allocation exceeds the open receivable.');
      requireThat(r.accounting_date >= p.latest_date, 'Receipt date cannot precede the latest invoice or settlement.');
      const control = account(JSON.parse(i.snapshot).accounts.receivable.id, r.company_id);
      requireThat(control.type === 'asset' && control.purpose === 'receivable', 'Invoice receivable control is invalid.');
      return {
        invoice_id: i.id,
        contract_id: i.contract_id,
        reference: i.title,
        project_id: i.project_id,
        amount: a,
        base_amount: payableRatio(a, p.base_open, p.open),
        control,
        open_snapshot: p.open,
        base_snapshot: p.base_open,
        latest_date: p.latest_date
      };
    });
    const projects = [...new Set(allocations.map(a => a.project_id))],
      project = projects.length === 1 ? projects[0] : null;
    access.requireCap('customer_receipts.write', r.company_id, project);
    const total = money(sum(allocations.map(a => a.amount))),
      bankAmount = amount(input.bank_amount),
      bankRate = decimal(input.bank_rate, 'Bank accounting rate', false).toString();
    requireThat(bank.currency !== first.currency || new D(total).cmp(bankAmount) === 0, 'Same-currency bank amount must equal allocations.');
    requireThat(bank.currency !== company(r.company_id).currency || new D(bankRate).cmp(1) === 0, 'Functional-currency bank rate must be 1.');
    const base = money(new D(bankAmount).times(bankRate));
    requireThat(new D(base).gt(0), 'Bank amount rounds to zero in company currency.');
    let remaining = total,
      remainingBank = bankAmount,
      remainingBase = base;
    for (const a of allocations) {
      a.bank_amount = payableRatio(a.amount, remainingBank, remaining);
      a.bank_base = payableRatio(a.amount, remainingBase, remaining);
      remaining = money(new D(remaining).minus(a.amount));
      remainingBank = money(new D(remainingBank).minus(a.bank_amount));
      remainingBase = money(new D(remainingBase).minus(a.bank_base));
    }
    const carrying = money(sum(allocations.map(a => a.base_amount)));
    return {
      project_id: project,
      customer_id: first.customer_id,
      currency: first.currency,
      total,
      bank_amount: bankAmount,
      bank_rate: bankRate,
      company_total: base,
      authority_amount: new D(base).gte(carrying) ? base : carrying,
      payload: JSON.stringify({
        bank,
        customer: JSON.parse(first.snapshot).contract.customer,
        allocations
      })
    };
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        c = old?.company_id || input.company_id;
      scope(c, null);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && can('write', old) && ['draft', 'returned'].includes(old.state) && !old.reversal_of, 'Only the author can revise an unsubmitted original receipt.', 403);
      }
      const r = {
        id: id || uid('CRC'),
        company_id: c,
        bank_id: old?.bank_id || input.bank_id,
        title: text(input.title, 'Receipt title', 160),
        accounting_date: day(input.accounting_date),
        rate_date: day(input.rate_date),
        rate_source: text(input.rate_source, 'Conversion evidence', 500),
        explanation: text(input.explanation, 'Receipt purpose')
      };
      requireThat(r.accounting_date <= today() && r.rate_date <= r.accounting_date, 'Receipt/rate dates cannot be future or rate after receipt.');
      Object.assign(r, prepare(r, input));
      if (old) {
        requireThat(r.customer_id === old.customer_id && r.currency === old.currency && r.project_id === old.project_id, 'Customer, currency and project scope are fixed. Cancel and prepare a new receipt.');
        const keys = Object.keys(r).filter(k => !['id', 'company_id', 'bank_id', 'customer_id', 'project_id', 'currency'].includes(k));
        run(`UPDATE client_receipts SET ${keys.map(k => k + '=?').join(',')},state='draft',version=version+1 WHERE id=?`, ...keys.map(k => r[k]), id);
      } else {
        Object.assign(r, {
          author_id: actorId,
          state: 'draft',
          created_at: now()
        });
        const keys = Object.keys(r);
        run(`INSERT INTO client_receipts(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => r[k]));
      }
      event(row(r.id), old ? 'Receipt revised' : 'Receipt prepared', r.explanation);
      return detail(r.id);
    });
  }
  function validate(r) {
    const p = JSON.parse(r.payload),
      bank = bankSnapshot(r.bank_id, r.company_id, !!r.reversal_of);
    requireThat(JSON.stringify(bank) === JSON.stringify(p.bank), 'Bank configuration changed. Return or withdraw and revise.', 409);
    requireThat(authority(r, r.author_id, 'write'), 'Receipt author no longer has current scope. Resolve ownership before continuing.', 409);
    const period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.accounting_date, r.accounting_date);
    requireThat(period && r.accounting_date <= today(), 'Receipt requires an open company period and a non-future date.');
    if (r.reversal_of) {
      const original = row(r.reversal_of);
      requireThat(original.state === 'recorded' && !original.reversal_of && !reversed(original.id) && !clearance(original.id), 'Unmatch an unreversed original before recording its correction.');
    }
    for (const a of p.allocations) {
      const i = invoiceRow(a.invoice_id),
        b = receivableBalance(db, i),
        control = account(a.control.id, r.company_id, !!r.reversal_of);
      requireThat(r.accounting_date >= b.latest_date, 'Receipt or reversal must follow all dependent settlement dates.');
      if (r.reversal_of && i.advance_id) assertAdvancePaidProtection(db, i, { id: r.id, amount: a.amount });
      if (!r.reversal_of) {
        requireThat(JSON.stringify(control) === JSON.stringify(a.control) && b.open === a.open_snapshot && b.base_open === a.base_snapshot && b.latest_date === a.latest_date, 'Invoice balance or control changed. Return or withdraw and revise.', 409);
        requireThat(new D(a.amount).plus(reserved(i.id, r.id)).lte(b.open), 'Another approved receipt reserves this balance.', 409);
      }
    }
    return {
      p,
      period
    };
  }
  function file(input) {
    requireThat(input && typeof input === 'object', 'Original transaction evidence is required.');
    const filename = text(input.filename, 'Evidence filename', 180);
    requireThat(!/[\/\\\x00-\x1f]/.test(filename) && /\.(pdf|png|jpe?g|txt)$/i.test(filename), 'Choose a PDF, PNG, JPG or TXT file with a plain filename.');
    requireThat(typeof input.base64 === 'string' && input.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64), 'Evidence encoding is invalid.');
    const bytes = Buffer.from(input.base64, 'base64');
    requireThat(bytes.length > 0 && bytes.length <= 2 * 1024 * 1024, 'Evidence must be 1 byte–2 MiB.');
    return {
      filename,
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex')
    };
  }
  function post(r, reference, evidence) {
    const {
        p,
        period
      } = validate(r),
      lines = [],
      sign = r.reversal_of ? -1 : 1;
    const line = (a, project, signed, description) => {
      if (new D(signed).isZero()) return;
      const debit = new D(signed).gt(0) ? money(signed) : '0.00',
        credit = new D(signed).gt(0) ? '0.00' : money(abs(signed));
      lines.push({
        project_id: project,
        account_id: a.id,
        account_code: a.code,
        account_name: a.name,
        account_type: a.type,
        description,
        debit,
        credit,
        base_debit: debit,
        base_credit: credit,
        rounding_adjustment: '0.00'
      });
    };
    for (const a of p.allocations) {
      line(p.bank.accounts[0], a.project_id, new D(a.bank_base).times(sign), `${reference} · ${a.bank_amount} ${p.bank.currency}`);
      line(a.control, a.project_id, new D(a.base_amount).times(-sign), `${a.reference} · ${a.amount} ${r.currency}`);
      const diff = new D(a.base_amount).minus(a.bank_base);
      line(diff.gt(0) ? p.bank.accounts[2] : p.bank.accounts[1], a.project_id, diff.times(sign), 'Customer settlement exchange difference');
    }
    requireThat(sum(lines.map(l => l.debit)).cmp(sum(lines.map(l => l.credit))) === 0, 'Receipt journal does not balance.');
    const id = uid('JRN'),
      year = r.accounting_date.slice(0, 4),
      base = company(r.company_id).currency,
      total = money(sum(lines.map(l => l.debit)));
    run('INSERT OR IGNORE INTO ledger_sequences(company_id,year,next_number) VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id,reversal_of) VALUES(?,?,?,?,?,?,'1',?,?,?,?,?,?,?,?,'submitted',?,'client_receipt',?,?)", id, r.company_id, r.project_id, r.title, r.accounting_date, base, r.accounting_date, 'Functional journal; original invoice/bank values retained in receipt', reference, r.explanation, JSON.stringify(lines), total, total, r.author_id, now(), r.id, r.reversal_of ? get('SELECT journal_id FROM client_receipts WHERE id=?', r.reversal_of).journal_id : null);
    lines.forEach((l, i) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, l.project_id, l.account_id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", `GL/${year}/${String(n).padStart(6, '0')}`, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'Customer receipt recorded', `Typed settlement ${r.id}; retained original evidence`, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    for (const a of p.allocations) run('INSERT INTO client_receipt_allocations VALUES(?,?,?,?,?,?,?,?,?)', uid('CRA'), r.id, a.invoice_id, a.project_id, a.amount, a.base_amount, a.bank_amount, a.bank_base, sign);
    const f = uid('CRE');
    run('INSERT INTO client_receipt_evidence VALUES(?,?,?,?,?,?,?)', f, r.id, evidence.filename, evidence.sha256, evidence.bytes, actorId, now());
    run("UPDATE client_receipts SET state='recorded',bank_reference=?,reference_key=?,evidence_id=?,journal_id=?,recorded_by=?,recorded_at=?,version=version+1 WHERE id=?", reference, reference.toLocaleLowerCase('en'), f, id, actorId, now(), r.id);
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id),
        reason = text(input.reason, 'Decision reason');
      if (input.action === 'record' && r.state === 'recorded') {
        const e = file(input.file),
          old = get('SELECT * FROM client_receipt_evidence WHERE id=?', r.evidence_id);
        requireThat(actorId === r.recorded_by && can('record', r) && input.bank_reference?.trim() === r.bank_reference && e.sha256 === old.sha256 && e.filename === old.filename, 'This receipt is already recorded with different evidence.', 409);
        return detail(id);
      }
      version(r, input.version);
      const author = r.author_id === actorId && can('write', r);
      let state;
      if (input.action === 'record') {
        requireThat(r.state === 'approved' && can('record', r) && actorId !== r.approved_by && reviewer(r, r.approved_by), 'Recording needs a different person and current receipt approval authority.', 403);
        const ref = text(input.bank_reference, 'Actual bank reference', 120),
          key = ref.toLocaleLowerCase('en');
        requireThat(!get('SELECT id FROM client_receipts WHERE bank_id=? AND reference_key=?', r.bank_id, key) && !get('SELECT id FROM payments WHERE bank_id=? AND reference_key=?', r.bank_id, key), 'This bank reference is already recorded.', 409);
        post(r, ref, file(input.file));
      } else {
        if (input.action === 'submit') {
          requireThat(author && r.state === 'draft', 'Only the author can submit a prepared draft.', 403);
          validate(r);
          state = 'submitted';
        } else if (input.action === 'approve') {
          requireThat(r.state === 'submitted' && reviewer(r), 'Independent receipt authority must cover bank and carrying amounts.', 403);
          validate(r);
          state = 'approved';
        } else if (input.action === 'return') {
          requireThat(['submitted', 'approved'].includes(r.state) && can('approve', r) && actorId !== r.author_id, 'Independent reviewer required.', 403);
          state = 'returned';
        } else if (input.action === 'withdraw') {
          requireThat(author && ['submitted', 'approved'].includes(r.state), 'Only the author can withdraw unrecorded work.', 403);
          state = 'draft';
        } else if (input.action === 'cancel') {
          requireThat(author && ['draft', 'returned'].includes(r.state), 'Only the author can cancel unsubmitted work.', 403);
          state = 'cancelled';
        } else requireThat(false, 'Unknown receipt decision.');
        run('UPDATE client_receipts SET state=?,approved_by=?,version=version+1 WHERE id=?', state, state === 'approved' ? actorId : null, id);
      }
      event(row(id), input.action, reason);
      return detail(id);
    });
  }
  function reverse(id, input) {
    return transaction(db, () => {
      const original = row(id);
      version(original, input.version);
      access.requireCap('customer_receipts.write', original.company_id, original.project_id);
      requireThat(original.state === 'recorded' && !original.reversal_of && !clearance(id) && !get("SELECT id FROM client_receipts WHERE reversal_of=? AND state<>'cancelled'", id), 'Unmatch the unreversed original before preparing its correction.');
      const date = day(input.accounting_date);
      requireThat(date >= original.accounting_date && date <= today(), 'Reversal date must follow the original and not be future.');
      const r = {
        ...original,
        id: uid('CRC'),
        title: `Reversal · ${original.title}`.slice(0, 160),
        accounting_date: date,
        reversal_of: id,
        explanation: text(input.reason, 'Correction evidence'),
        author_id: actorId,
        state: 'draft',
        version: 1,
        approved_by: null,
        recorded_by: null,
        bank_reference: null,
        reference_key: null,
        evidence_id: null,
        journal_id: null,
        created_at: now(),
        recorded_at: null
      };
      const p = JSON.parse(r.payload);
      p.bank = bankSnapshot(r.bank_id, r.company_id, true);
      r.payload = JSON.stringify(p);
      const keys = Object.keys(r);
      run(`INSERT INTO client_receipts(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => r[k]));
      validate(r);
      event(r, 'Receipt reversal prepared', r.explanation);
      return detail(r.id);
    });
  }
  function detail(id) {
    const r = row(id),
      p = JSON.parse(r.payload);
    return {
      ...r,
      payload: undefined,
      ...p,
      state_label: RECEIPT_STATES[r.state],
      company_currency: company(r.company_id).currency,
      clearance: clearance(id),
      reversed_by: reversed(id),
      direction: r.reversal_of ? 'out' : 'in',
      can_write: can('write', r) && r.author_id === actorId,
      can_reverse: can('write', r),
      can_review: reviewer(r),
      can_return: can('approve', r) && actorId !== r.author_id,
      can_record: can('record', r) && r.approved_by !== actorId,
      can_open_invoice: access.has('ar.read', r.company_id, r.project_id),
      can_open_ledger: access.has('finance.read', r.company_id, r.project_id),
      author: get('SELECT name FROM users WHERE id=?', r.author_id).name,
      evidence: r.evidence_id ? get('SELECT id,filename,sha256,length(bytes) size,created_at FROM client_receipt_evidence WHERE id=?', r.evidence_id) : null,
      history: all('SELECT e.*,u.name actor FROM client_receipt_events e JOIN users u ON u.id=e.actor_id WHERE receipt_id=? ORDER BY e.id', id)
    };
  }
  function list(c, p = null) {
    scope(c, p);
    return all('SELECT * FROM client_receipts WHERE company_id=? ORDER BY created_at DESC,rowid DESC', c).flatMap(r => {
      const x = JSON.parse(r.payload),
        selected = x.allocations.filter(a => (!p || a.project_id === p) && access.has('customer_receipts.read', c, a.project_id));
      if (!selected.length) return [];
      const visible = can('read', r);
      return [{
        id: r.id,
        title: visible ? r.title : 'Customer receipt allocation',
        company_id: c,
        project_id: r.project_id,
        allocation_project_ids: [...new Set(selected.map(a => a.project_id))],
        scope_partial: selected.length !== x.allocations.length,
        can_open: visible,
        state: r.state,
        state_label: RECEIPT_STATES[r.state],
        accounting_date: r.accounting_date,
        currency: r.currency,
        total: money(sum(selected.map(a => a.amount))),
        bank_amount: money(sum(selected.map(a => a.bank_amount))),
        bank_currency: x.bank.currency,
        bank_id: r.bank_id,
        direction: r.reversal_of ? 'out' : 'in',
        customer: x.customer,
        reversal_of: r.reversal_of,
        clearance: clearance(r.id),
        reversed_by: reversed(r.id),
        can_review: visible && r.state === 'submitted' && reviewer(r),
        can_record: visible && r.state === 'approved' && can('record', r) && actorId !== r.approved_by,
        my_draft: visible && r.author_id === actorId && ['draft', 'returned'].includes(r.state) && can('write', r)
      }];
    });
  }
  function options(c, p = null) {
    scope(c, p);
    return {
      company: company(c),
      today: today(),
      actor_id: actorId,
      can_write: access.has('customer_receipts.write', c, p, !p),
      can_bank_read: access.has('bank.read', c),
      projects: all('SELECT id,name FROM projects WHERE company_id=?', c).filter(x => access.has('customer_receipts.read', c, x.id)),
      banks: all('SELECT id,name,currency,active FROM payment_banks WHERE company_id=? ORDER BY name', c),
      balances: balances(c, p)
    };
  }
  function download(id) {
    const e = get('SELECT * FROM client_receipt_evidence WHERE id=?', id);
    requireThat(e, 'Evidence is unavailable.', 404);
    row(e.receipt_id);
    return e;
  }
  function report(c, {
    project = null,
    to = today()
  } = {}) {
    scope(c, project);
    day(to);
    requireThat(to <= today(), 'Report cutoff cannot be future.');
    const docs = all("SELECT * FROM client_receipts WHERE company_id=? AND state='recorded' AND accounting_date<=?", c, to);
    const rows = docs.flatMap(r => {
      const p = JSON.parse(r.payload),
        sign = r.reversal_of ? -1 : 1;
      return p.allocations.filter(a => (!project || a.project_id === project) && access.has('customer_receipts.read', c, a.project_id)).map(a => ({
        receipt_id: r.id,
        can_open: can('read', r),
        invoice_id: a.invoice_id,
        invoice_title: a.reference,
        project_id: a.project_id,
        project: get('SELECT name FROM projects WHERE id=?', a.project_id).name,
        title: can('read', r) ? r.title : 'Customer receipt allocation',
        customer: p.customer,
        date: r.accounting_date,
        currency: r.currency,
        amount: a.amount,
        base_carrying: a.base_amount,
        bank_currency: p.bank.currency,
        bank_amount: a.bank_amount,
        bank_base: a.bank_base,
        direction: sign > 0 ? 'in' : 'out',
        fx: money(new D(a.bank_base).minus(a.base_amount).times(sign)),
        clearance: clearance(r.id, to),
        journal_id: r.journal_id,
        reversal_of: r.reversal_of,
        bank_reference: r.bank_reference
      }));
    });
    const open = balances(c, project, to),
      incoming = money(sum(rows.filter(r => r.direction === 'in').map(r => r.bank_base))),
      out = money(sum(rows.filter(r => r.direction === 'out').map(r => r.bank_base))),
      net = money(new D(incoming).minus(out)),
      cleared = money(sum(rows.filter(r => r.clearance).map(r => new D(r.bank_base).times(r.direction === 'in' ? 1 : -1))));
    const planned = all("SELECT * FROM client_receipts WHERE company_id=? AND state='approved' AND accounting_date<=?", c, to).flatMap(r => {
      const p = JSON.parse(r.payload),
        aa = p.allocations.filter(a => (!project || a.project_id === project) && access.has('customer_receipts.read', c, a.project_id));
      return aa.length ? [{
        id: r.id,
        title: can('read', r) ? r.title : 'Approved customer receipt allocation',
        currency: r.currency,
        total: money(sum(aa.map(a => a.amount))),
        bank_currency: p.bank.currency,
        bank_amount: money(sum(aa.map(a => a.bank_amount))),
        can_open: can('read', r),
        scope_partial: aa.length !== p.allocations.length
      }] : [];
    });
    const groups = [...new Set(open.map(i => i.currency))].map(currency => {
      const rr = open.filter(i => i.currency === currency);
      return {
        currency,
        invoiced: money(sum(rr.map(i => i.total))),
        settled: money(sum(rr.map(i => i.settled))),
        open: money(sum(rr.map(i => i.open))),
        overdue: money(sum(rr.filter(i => i.due_date < to).map(i => i.open)))
      };
    });
    const sourceOpen = money(sum(open.map(i => i.base_open)));
    let ledgerOpen = new D(0);
    for (const i of open) {
      const original = get('SELECT journal_id,snapshot FROM client_invoices WHERE id=?', i.id),
        control = JSON.parse(original.snapshot).accounts.receivable.id;
      ledgerOpen = ledgerOpen.plus(sum(all('SELECT base_debit,base_credit FROM ledger_lines WHERE entry_id=? AND account_id=?', original.journal_id, control).map(l => new D(l.base_debit).minus(l.base_credit))));
    }
    for (const r of docs) {
      const p = JSON.parse(r.payload);
      for (const projectId of [...new Set(p.allocations.filter(a => (!project || a.project_id === project) && access.has('customer_receipts.read', c, a.project_id)).map(a => a.project_id))]) {
        const controls = [...new Set(p.allocations.filter(a => a.project_id === projectId).map(a => a.control.id))];
        for (const a of controls) ledgerOpen = ledgerOpen.plus(sum(all('SELECT base_debit,base_credit FROM ledger_lines WHERE entry_id=? AND project_id=? AND account_id=?', r.journal_id, projectId, a).map(l => new D(l.base_debit).minus(l.base_credit))));
      }
    }
    const reconciliation = {
      source_open: sourceOpen,
      ledger_open: money(ledgerOpen),
      difference: money(new D(sourceOpen).minus(ledgerOpen))
    };
    return {
      company: company(c),
      project_id: project,
      to,
      rows,
      planned,
      open_items: open,
      currency_groups: groups,
      reconciliation,
      totals: {
        incoming,
        out,
        net,
        cleared,
        uncleared: money(new D(net).minus(cleared)),
        fx: money(sum(rows.map(r => r.fx)))
      },
      findings: [`${new Set(rows.map(r => r.receipt_id)).size} recorded receipts/corrections through ${to}; ${incoming} ${company(c).currency} received and ${out} reversed.`, `${cleared} ${company(c).currency} net receipts have current bank matches dated through the cutoff; ${planned.length} approved plans remain excluded from cash.`, ...groups.map(g => `${g.currency} ${g.open} remains receivable; ${g.overdue} is past due. Settled ${g.settled} of posted ${g.invoiced}.`), `AR source-to-ledger difference: ${reconciliation.difference} ${company(c).currency}.`],
      limitations: ['Only posted client invoices and recorded receipts/corrections are included. Measured-work and advance invoices share this receipt path. Retention release, unallocated cash and credits remain separate unfinished workflows.', 'Receipt amounts are movements, not bank opening/closing balances or a full company cash-flow classification.', 'Clearance uses currently active matches dated through cutoff; historical match decisions are retained in audit and are not reconstructed.', project ? 'Selected project allocations only.' : access.has('customer_receipts.read', c) ? 'All company project allocations.' : 'Only your authorised project allocations; not the complete legal-company statement.']
    };
  }
  return {
    save,
    decide,
    reverse,
    detail,
    list,
    options,
    balances,
    report,
    download
  };
}
