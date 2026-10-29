import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { payableRatio } from './payables.mjs';
import { payableBalance } from './payable-balance.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`,
  now = () => new Date().toISOString();
const text = (v, name, max = 2000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${name} is required (maximum ${max} characters).`);
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
const effect = r => (r.kind === 'payment' ? 1 : -1) * (r.reversal_of ? -1 : 1);
export const PAYMENT_STATES = {
  draft: 'Draft',
  submitted: 'Needs approval',
  returned: 'Changes requested',
  approved: 'Approved · awaiting recording',
  recorded: 'Recorded · check bank clearance',
  cancelled: 'Cancelled'
};
export function payments(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(cap, r.company_id, r.project_id),
    version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This payment or bank record changed. Reload.', 409);
  const company = c => {
    const r = get('SELECT * FROM companies WHERE id=?', c);
    requireThat(r, 'Company is unavailable.', 404);
    return r;
  };
  const scope = (c, p) => {
    company(c);
    requireThat(access.has('payments.read', c, p, !p), 'Payment scope is unavailable.', 404);
    if (p) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', p, c), 'Project is unavailable.', 404);
  };
  const row = id => {
    const r = get('SELECT * FROM payments WHERE id=?', id);
    requireThat(r && can('payments.read', r), 'Payment is unavailable.', 404);
    return r;
  };
  const event = (type, r, action, reason) => run('INSERT INTO payment_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', type, r.id, r.company_id, r.project_id || null, actorId, action, text(reason, 'Reason'), JSON.stringify(r), now());
  const account = (id, c, correction = false) => {
    const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, c);
    requireThat(a && (a.active || correction), 'Choose an active company account.');
    return a;
  };
  const bankRow = id => {
    const b = get('SELECT * FROM payment_banks WHERE id=?', id);
    requireThat(b, 'Bank account is unavailable.', 404);
    return b;
  };
  const bankSnapshot = (id, c, correction = false) => {
    const b = bankRow(id);
    requireThat(b.company_id === c && (b.active || correction), 'Bank is inactive or belongs to another company.');
    return {
      ...b,
      accounts: [b.account_id, b.gain_account_id, b.loss_account_id].map(id => account(id, c, correction))
    };
  };
  const limit = (r, who = actorId) => policy(db, who).matching(r.company_id, r.project_id).filter(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('payments.approve')).reduce((v, g) => new D(g.payment_approval_limit || '0').gt(v) ? money(g.payment_approval_limit) : v, '0.00');
  const reviewer = (r, who = actorId) => who !== r.author_id && policy(db, who).has('payments.approve', r.company_id, r.project_id) && new D(limit(r, who)).gt(0) && new D(limit(r, who)).gte(r.authority_amount);
  const cleared = (id, to = '9999-12-31') => get('SELECT r.id row_id,r.date,r.reference,s.reference statement,m.actor_id FROM bank_matches m JOIN bank_rows r ON r.id=m.row_id JOIN bank_statements s ON s.id=r.statement_id WHERE m.payment_id=? AND m.active=1 AND r.date<=?', id, to) || null;
  const reversed = (id, to = '9999-12-31') => get("SELECT id FROM payments WHERE reversal_of=? AND state='recorded' AND accounting_date<=?", id, to)?.id || null;
  function bank(id, input) {
    return transaction(db, () => {
      const old = id ? bankRow(id) : null,
        c = old?.company_id || input.company_id;
      access.requireCap('payments.manage', c);
      company(c);
      if (old) version(old, input.version);
      requireThat(typeof input.active === 'boolean', 'Choose availability.');
      const name = text(input.name, 'Bank alias', 100);
      requireThat(!get('SELECT id FROM payment_banks WHERE company_id=? AND name=? AND id<>?', c, name, id || ''), 'Bank alias already exists.');
      if (old) run('UPDATE payment_banks SET name=?,active=?,version=version+1 WHERE id=?', name, +input.active, id);else {
        requireThat(['AED', 'EUR', 'USD'].includes(input.currency), 'Supported bank currencies: AED, EUR, USD.');
        const b = account(input.account_id, c),
          g = account(input.gain_account_id, c),
          l = account(input.loss_account_id, c);
        requireThat(b.type === 'asset' && b.purpose === 'bank' && g.type === 'income' && g.purpose === 'general' && l.type === 'expense' && l.purpose === 'general', 'Select a bank asset, general FX income and general FX expense account.');
        id = uid('BNK');
        run('INSERT INTO payment_banks(id,company_id,name,currency,account_id,gain_account_id,loss_account_id,active) VALUES(?,?,?,?,?,?,?,?)', id, c, name, input.currency, b.id, g.id, l.id, +input.active);
      }
      const r = bankRow(id);
      event('bank', r, old ? 'bank availability revised' : 'bank registered', input.reason);
      return r;
    });
  }
  function balances(c, p = null) {
    scope(c, p);
    return all("SELECT * FROM payable_documents WHERE company_id=? AND kind='bill' AND state='posted' ORDER BY due_date,id", c).filter(b => (!p || b.project_id === p) && can('payments.read', b)).map(b => ({
      id: b.id,
      project_id: b.project_id,
      project: get('SELECT name FROM projects WHERE id=?', b.project_id).name,
      vendor_id: b.vendor_id,
      vendor: JSON.parse(b.source_json).order.vendor,
      reference: b.reference,
      currency: b.currency,
      due_date: b.due_date,
      ...payableBalance(db, b),
      reserved: money(sum(all("SELECT payload FROM payments WHERE company_id=? AND state='approved' AND reversal_of IS NULL", c).flatMap(r => JSON.parse(r.payload).allocations).filter(a => a.bill_id === b.id).map(a => a.amount)))
    }));
  }
  function prepare(r, input) {
    const b = bankSnapshot(r.bank_id, r.company_id),
      items = input.allocations;
    requireThat(Array.isArray(items) && items.length > 0 && items.length <= 30, 'Select between 1 and 30 supplier bills.');
    requireThat(new Set(items.map(x => x.bill_id)).size === items.length, 'Select each bill once.');
    let first;
    const allocations = items.map(x => {
      const bill = get("SELECT * FROM payable_documents WHERE id=? AND kind='bill' AND state='posted'", x.bill_id);
      requireThat(bill && bill.company_id === r.company_id && can('payments.read', bill), 'Supplier bill is unavailable.', 404);
      if (!first) first = bill;
      requireThat(bill.vendor_id === first.vendor_id && bill.currency === first.currency, 'One payment must use one supplier and invoice currency.');
      const pos = payableBalance(db, bill),
        a = amount(x.amount),
        sign = r.kind === 'payment' ? 1 : -1;
      requireThat(new D(pos.open).times(sign).gt(0) && new D(a).lte(abs(pos.open)), 'Allocation exceeds the open bill or supplier refund balance.');
      requireThat(r.accounting_date >= pos.latest_date, 'Payment date cannot precede its latest bill, credit or settlement.');
      const base = payableRatio(a, abs(pos.base_open).toString(), abs(pos.open).toString());
      requireThat(new D(pos.base_open).times(sign).gte(0), 'Carrying balance needs a separate accounting correction.');
      const control = JSON.parse(bill.source_json).control,
        ac = account(control.account_id, r.company_id, true);
      return {
        bill_id: bill.id,
        reference: bill.reference,
        project_id: bill.project_id,
        amount: a,
        base_amount: base,
        control: ac,
        open_snapshot: pos.open,
        base_snapshot: pos.base_open,
        latest_date: pos.latest_date
      };
    });
    const projects = [...new Set(allocations.map(a => a.project_id))],
      project = projects.length === 1 ? projects[0] : null;
    access.requireCap('payments.write', r.company_id, project);
    const total = money(sum(allocations.map(a => a.amount))),
      bankAmount = amount(input.bank_amount),
      bankRate = decimal(input.bank_rate, 'Bank accounting rate', false).toString();
    requireThat(b.currency !== first.currency || new D(total).cmp(bankAmount) === 0, 'Same-currency bank amount must equal the bill allocations.');
    requireThat(b.currency !== company(r.company_id).currency || bankRate === '1', 'Functional-currency bank rate must be 1.');
    const base = money(new D(bankAmount).times(bankRate));
    requireThat(new D(base).gt(0), 'Functional bank amount rounds to zero.');
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
      vendor_id: first.vendor_id,
      currency: first.currency,
      total,
      bank_amount: bankAmount,
      bank_rate: bankRate,
      company_total: base,
      authority_amount: new D(base).gte(carrying) ? base : carrying,
      payload: JSON.stringify({
        bank: b,
        vendor: JSON.parse(first.source_json).order.vendor,
        allocations
      })
    };
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null;
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && can('payments.write', old) && ['draft', 'returned'].includes(old.state) && !old.reversal_of, 'Only the author can revise an unsubmitted payment.', 403);
      }
      const c = old?.company_id || input.company_id;
      scope(c, null);
      const r = {
        id: id || uid('PAY'),
        company_id: c,
        bank_id: old?.bank_id || input.bank_id,
        kind: old?.kind || input.kind,
        title: text(input.title, 'Title', 160),
        accounting_date: day(input.accounting_date),
        rate_date: day(input.rate_date),
        rate_source: text(input.rate_source, 'Exchange-rate evidence', 500),
        explanation: text(input.explanation, 'Purpose')
      };
      requireThat(['payment', 'refund'].includes(r.kind), 'Choose outgoing payment or supplier refund.');
      requireThat(r.accounting_date <= today() && r.rate_date <= r.accounting_date, 'Payment/rate dates must not be in the future or rate after payment.');
      Object.assign(r, prepare(r, input));
      if (old) requireThat(r.vendor_id === old.vendor_id && r.currency === old.currency && r.project_id === old.project_id, 'Supplier, currency and scope are fixed; cancel and create a new payment.');
      if (old) {
        const keys = Object.keys(r).filter(k => !['id', 'company_id', 'bank_id', 'vendor_id', 'project_id', 'kind'].includes(k));
        run(`UPDATE payments SET ${keys.map(k => k + '=?').join(',')},state='draft',version=version+1 WHERE id=?`, ...keys.map(k => r[k]), id);
      } else {
        Object.assign(r, {
          author_id: actorId,
          state: 'draft',
          created_at: now()
        });
        const keys = Object.keys(r);
        run(`INSERT INTO payments(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => r[k]));
      }
      event('payment', row(r.id), old ? 'draft revised' : 'draft created', r.explanation);
      return detail(r.id);
    });
  }
  function validate(r) {
    const p = JSON.parse(r.payload),
      b = bankSnapshot(r.bank_id, r.company_id, !!r.reversal_of);
    requireThat(JSON.stringify(b) === JSON.stringify(p.bank), 'Bank configuration or account changed. Return and prepare again.', 409);
    requireThat(r.accounting_date <= today(), 'Future transactions cannot be recorded.');
    const period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.accounting_date, r.accounting_date);
    requireThat(period, 'The payment date needs an open company period.');
    if (r.reversal_of) {
      const original = row(r.reversal_of);
      requireThat(original.state === 'recorded' && !original.reversal_of && !reversed(original.id) && !cleared(original.id), 'Only an uncleared, unreversed original can be reversed.');
      for (const a of p.allocations) {
        const bill = get('SELECT * FROM payable_documents WHERE id=?', a.bill_id);
        requireThat(r.accounting_date >= payableBalance(db, bill).latest_date, 'Reversal must follow all dependent bill and settlement dates.');
      }
      return {
        p,
        period
      };
    }
    for (const a of p.allocations) {
      const bill = get('SELECT * FROM payable_documents WHERE id=?', a.bill_id),
        pos = payableBalance(db, bill),
        current = account(a.control.id, r.company_id, true);
      requireThat(current.version === a.control.version && pos.open === a.open_snapshot && pos.base_open === a.base_snapshot && pos.latest_date === a.latest_date, 'Bill balance or account changed. Withdraw or return and revise this payment.', 409);
      const reserved = sum(all("SELECT payload FROM payments WHERE company_id=? AND state='approved' AND id<>? AND reversal_of IS NULL", r.company_id, r.id).flatMap(x => JSON.parse(x.payload).allocations).filter(x => x.bill_id === a.bill_id).map(x => x.amount));
      requireThat(new D(a.amount).plus(reserved).lte(abs(pos.open)), 'Another approved payment reserves this bill balance.', 409);
    }
    return {
      p,
      period
    };
  }
  function post(r, reference, evidence) {
    const {
        p,
        period
      } = validate(r),
      lines = [];
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
    const sign = effect(r);
    for (const a of p.allocations) {
      line(a.control, a.project_id, new D(a.base_amount).times(sign), `${a.reference} · ${a.amount} ${r.currency}`);
      line(p.bank.accounts[0], a.project_id, new D(a.bank_base).times(-sign), `${reference} · ${a.bank_amount} ${p.bank.currency}`);
      const originalFx = new D(a.bank_base).minus(a.base_amount).times(r.kind === 'payment' ? 1 : -1),
        fx = originalFx.times(r.reversal_of ? -1 : 1);
      line(originalFx.gt(0) ? p.bank.accounts[2] : p.bank.accounts[1], a.project_id, fx, 'Settlement exchange difference');
    }
    requireThat(sum(lines.map(l => l.debit)).cmp(sum(lines.map(l => l.credit))) === 0, 'Payment journal does not balance.');
    const id = uid('JRN'),
      year = r.accounting_date.slice(0, 4),
      base = company(r.company_id).currency,
      total = money(sum(lines.map(l => l.debit)));
    run('INSERT OR IGNORE INTO ledger_sequences(company_id,year,next_number) VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id,reversal_of) VALUES(?,?,?,?,?,?,'1',?,?,?,?,?,?,?,?,'submitted',?,'payment',?,?)", id, r.company_id, r.project_id, r.title, r.accounting_date, base, r.accounting_date, 'Functional journal; invoice/bank currencies and rates retained in payment', reference, r.explanation, JSON.stringify(lines), total, total, r.author_id, now(), r.id, r.reversal_of ? get('SELECT journal_id FROM payments WHERE id=?', r.reversal_of).journal_id : null);
    lines.forEach((l, i) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, l.project_id, l.account_id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", `GL/${year}/${String(n).padStart(6, '0')}`, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'supplier settlement recorded', `${r.id}: independent payment approval; ${evidence}`, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    for (const a of p.allocations) run('INSERT INTO payment_allocations(id,payment_id,bill_id,project_id,amount,base_amount,bank_amount,bank_base,effect) VALUES(?,?,?,?,?,?,?,?,?)', uid('PAL'), r.id, a.bill_id, a.project_id, a.amount, a.base_amount, a.bank_amount, a.bank_base, sign);
    run("UPDATE payments SET state='recorded',bank_reference=?,reference_key=?,evidence=?,journal_id=?,recorded_by=?,recorded_at=?,version=version+1 WHERE id=?", reference, reference.toLocaleLowerCase('en'), evidence, id, actorId, now(), r.id);
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      const reason = text(input.reason, 'Decision reason'),
        author = r.author_id === actorId && can('payments.write', r);
      let state;
      if (input.action === 'record') {
        requireThat(r.state === 'approved' && can('payments.record', r) && actorId !== r.approved_by && reviewer(r, r.approved_by), 'Recording requires a different person and current independent payment authority.', 403);
        const ref = text(input.bank_reference, 'Actual bank reference', 120);
        requireThat(!get('SELECT id FROM payments WHERE bank_id=? AND reference_key=?', r.bank_id, ref.toLocaleLowerCase('en')) && !get('SELECT id FROM client_receipts WHERE bank_id=? AND reference_key=?', r.bank_id, ref.toLocaleLowerCase('en')), 'This bank reference is already recorded.', 409);
        post(r, ref, text(input.evidence, 'Transaction evidence', 2000));
      } else {
        if (input.action === 'submit') {
          requireThat(author && ['draft', 'returned'].includes(r.state), 'Only the author can submit a draft.', 403);
          validate(r);
          state = 'submitted';
        } else if (input.action === 'approve') {
          requireThat(r.state === 'submitted' && reviewer(r), 'Independent payment authority must cover the carrying and bank amounts.', 403);
          validate(r);
          state = 'approved';
        } else if (input.action === 'return') {
          requireThat(['submitted', 'approved'].includes(r.state) && can('payments.approve', r) && actorId !== r.author_id, 'Independent reviewer required.', 403);
          state = 'returned';
        } else if (input.action === 'withdraw') {
          requireThat(author && ['submitted', 'approved'].includes(r.state), 'Only the author can withdraw an unrecorded payment.', 403);
          state = 'draft';
        } else if (input.action === 'cancel') {
          requireThat(author && ['draft', 'returned'].includes(r.state), 'Only an unsubmitted payment can be cancelled.', 403);
          state = 'cancelled';
        } else requireThat(false, 'Unknown payment decision.');
        run('UPDATE payments SET state=?,approved_by=?,version=version+1 WHERE id=?', state, state === 'approved' ? actorId : null, id);
      }
      event('payment', row(id), input.action, reason);
      return detail(id);
    });
  }
  function reverse(id, input) {
    return transaction(db, () => {
      const original = row(id);
      version(original, input.version);
      access.requireCap('payments.write', original.company_id, original.project_id);
      requireThat(original.state === 'recorded' && !original.reversal_of && !cleared(id) && !get("SELECT id FROM payments WHERE reversal_of=? AND state<>'cancelled'", id), 'Unmatch bank evidence first; only an unreversed original can be corrected.');
      const date = day(input.accounting_date);
      requireThat(date >= original.accounting_date && date <= today(), 'Reversal date must follow the original and not be future.');
      const r = {
        ...original,
        id: uid('PAY'),
        title: `Reversal · ${original.title}`.slice(0, 160),
        accounting_date: date,
        reversal_of: id,
        explanation: text(input.reason, 'Reversal evidence'),
        author_id: actorId,
        state: 'draft',
        version: 1,
        approved_by: null,
        recorded_by: null,
        bank_reference: null,
        reference_key: null,
        evidence: null,
        journal_id: null,
        created_at: now(),
        recorded_at: null
      };
      const p = JSON.parse(r.payload);
      p.bank = bankSnapshot(r.bank_id, r.company_id, true);
      r.payload = JSON.stringify(p);
      const keys = Object.keys(r);
      run(`INSERT INTO payments(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => r[k]));
      validate(r);
      event('payment', r, 'reversal prepared', r.explanation);
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
      state_label: PAYMENT_STATES[r.state],
      company_currency: company(r.company_id).currency,
      clearance: cleared(id),
      reversed_by: reversed(id),
      direction: effect(r) > 0 ? 'out' : 'in',
      can_write: can('payments.write', r) && r.author_id === actorId,
      can_reverse: can('payments.write', r),
      can_review: reviewer(r),
      can_return: can('payments.approve', r) && actorId !== r.author_id,
      can_record: can('payments.record', r) && r.approved_by !== actorId,
      can_open_bill: can('ap.read', r),
      can_open_ledger: can('finance.read', r),
      author: get('SELECT name FROM users WHERE id=?', r.author_id).name,
      history: all('SELECT e.*,u.name actor FROM payment_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id', 'payment', id)
    };
  }
  function list(c, p = null) {
    scope(c, p);
    return all('SELECT * FROM payments WHERE company_id=? ORDER BY created_at DESC,rowid DESC', c).filter(r => can('payments.read', r) && (!p || r.project_id === p)).map(r => {
      const x = JSON.parse(r.payload);
      return {
        id: r.id,
        title: r.title,
        company_id: c,
        project_id: r.project_id,
        state: r.state,
        state_label: PAYMENT_STATES[r.state],
        accounting_date: r.accounting_date,
        currency: r.currency,
        total: r.total,
        bank_amount: r.bank_amount,
        bank_currency: x.bank.currency,
        bank_id: r.bank_id,
        direction: effect(r) > 0 ? 'out' : 'in',
        vendor: x.vendor,
        kind: r.kind,
        reversal_of: r.reversal_of,
        clearance: cleared(r.id),
        reversed_by: reversed(r.id),
        can_review: r.state === 'submitted' && reviewer(r),
        can_record: r.state === 'approved' && can('payments.record', r) && r.approved_by !== actorId,
        my_draft: r.author_id === actorId && ['draft', 'returned'].includes(r.state)
      };
    });
  }
  function options(c, p = null) {
    scope(c, p);
    return {
      company: company(c),
      today: today(),
      actor_id: actorId,
      can_write: access.has('payments.write', c, p, !p),
      can_manage: access.has('payments.manage', c),
      can_bank_read: access.has('bank.read', c),
      can_reconcile: access.has('bank.reconcile', c),
      projects: all('SELECT id,name FROM projects WHERE company_id=?', c).filter(x => access.has('payments.read', c, x.id)),
      banks: all('SELECT * FROM payment_banks WHERE company_id=? ORDER BY name', c),
      accounts: access.has('payments.manage', c) ? all('SELECT * FROM ledger_accounts WHERE company_id=? ORDER BY code', c) : [],
      balances: balances(c, p)
    };
  }
  function statement(input) {
    return transaction(db, () => {
      const b = bankRow(input.bank_id);
      access.requireCap('bank.reconcile', b.company_id);
      const start = day(input.start_date),
        end = day(input.end_date),
        reference = text(input.reference, 'Statement reference', 120);
      requireThat(end >= start && end <= today(), 'Statement period is invalid.');
      requireThat(!get('SELECT id FROM bank_statements WHERE bank_id=? AND id NOT IN (SELECT statement_id FROM bank_statement_voids) AND NOT(end_date<? OR start_date>?)', b.id, start, end), 'Statement dates overlap existing evidence.');
      const signed = v => {
        requireThat(typeof v === 'string' && /^-?\d{1,12}(\.\d{1,2})?$/.test(v), 'Balances need signed amounts with at most two decimals.');
        return money(v);
      };
      const opening = signed(input.opening),
        closing = signed(input.closing);
      requireThat(Array.isArray(input.rows) && input.rows.length > 0 && input.rows.length <= 100, 'Provide 1–100 statement rows.');
      const rows = input.rows.map(x => {
        const date = day(x.date);
        requireThat(date >= start && date <= end && ['in', 'out'].includes(x.direction), 'Statement row date or direction is invalid.');
        return {
          date,
          direction: x.direction,
          amount: amount(x.amount),
          reference: text(x.reference, 'Bank row reference', 120)
        };
      });
      requireThat(new D(opening).plus(sum(rows.map(x => new D(x.amount).times(x.direction === 'in' ? 1 : -1)))).cmp(closing) === 0, 'Opening plus statement movements must equal closing.');
      const id = uid('BST');
      run('INSERT INTO bank_statements(id,bank_id,company_id,reference,start_date,end_date,opening,closing,author_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', id, b.id, b.company_id, reference, start, end, opening, closing, actorId, now());
      for (const r of rows) run('INSERT INTO bank_rows(id,statement_id,date,direction,amount,reference) VALUES(?,?,?,?,?,?)', uid('BSR'), id, r.date, r.direction, r.amount, r.reference);
      event('statement', {
        id,
        company_id: b.company_id,
        bank: b,
        ...input
      }, 'statement recorded', input.reason);
      return statements(b.company_id).find(s => s.id === id);
    });
  }
  function statements(c) {
    access.requireCap('bank.read', c);
    return all('SELECT s.*,b.name bank,b.currency FROM bank_statements s JOIN payment_banks b ON b.id=s.bank_id WHERE s.company_id=? ORDER BY end_date DESC', c).map(s => ({
      ...s,
      voided: get('SELECT * FROM bank_statement_voids WHERE statement_id=?', s.id) || null,
      can_void: s.author_id !== actorId,
      rows: all('SELECT * FROM bank_rows WHERE statement_id=? ORDER BY date,rowid', s.id).map(r => ({
        ...r,
        matches: [...all("SELECT m.*,p.title,p.bank_reference,'payment' source_type FROM bank_matches m JOIN payments p ON p.id=m.payment_id WHERE row_id=? ORDER BY m.id", r.id), ...all("SELECT m.*,p.title,p.bank_reference,'receipt' source_type FROM bank_receipt_matches m JOIN client_receipts p ON p.id=m.receipt_id WHERE row_id=? ORDER BY m.id", r.id)]
      }))
    }));
  }
  function voidStatement(id, input) {
    return transaction(db, () => {
      const r = get('SELECT * FROM bank_statements WHERE id=?', id);
      requireThat(r, 'Statement unavailable.', 404);
      access.requireCap('bank.reconcile', r.company_id);
      requireThat(r.author_id !== actorId, 'Another reconciler must void the statement.', 403);
      requireThat(!get('SELECT statement_id FROM bank_statement_voids WHERE statement_id=?', id), 'Statement already voided.', 409);
      requireThat(!get('SELECT m.id FROM bank_matches m JOIN bank_rows r ON r.id=m.row_id WHERE r.statement_id=? AND m.active=1', id), 'Unmatch every row before voiding statement evidence.');
      requireThat(!get('SELECT m.id FROM bank_receipt_matches m JOIN bank_rows r ON r.id=m.row_id WHERE r.statement_id=? AND m.active=1', id), 'Unmatch every customer receipt before voiding statement evidence.');
      const reason = text(input.reason, 'Correction reason');
      run('INSERT INTO bank_statement_voids(statement_id,actor_id,reason,at) VALUES(?,?,?,?)', id, actorId, reason, now());
      event('statement', r, 'statement voided', reason);
      return statements(r.company_id).find(s => s.id === id);
    });
  }
  function match(id, input) {
    return transaction(db, () => {
      const r = get('SELECT r.*,s.company_id,s.bank_id FROM bank_rows r JOIN bank_statements s ON s.id=r.statement_id WHERE r.id=?', id);
      requireThat(r, 'Statement row unavailable.', 404);
      access.requireCap('bank.reconcile', r.company_id);
      requireThat(!get('SELECT statement_id FROM bank_statement_voids WHERE statement_id=?', r.statement_id), 'Statement was voided; use replacement evidence.');
      version(r, input.version);
      const reason = text(input.reason, 'Reconciliation reason');
      if (input.action === 'unmatch') {
        requireThat(get('SELECT id FROM bank_matches WHERE row_id=? AND active=1', id) || get('SELECT id FROM bank_receipt_matches WHERE row_id=? AND active=1', id), 'No active match.');
        requireThat(!get('SELECT m.id FROM bank_matches m JOIN payments p ON p.id=m.payment_id WHERE m.row_id=? AND m.active=1 AND p.recorded_by=?', id, actorId), 'Unmatching requires an independent reconciler.');
        requireThat(!get('SELECT m.id FROM bank_receipt_matches m JOIN client_receipts p ON p.id=m.receipt_id WHERE m.row_id=? AND m.active=1 AND p.recorded_by=?', id, actorId), 'Unmatching customer receipts requires an independent reconciler.');
        run('UPDATE bank_matches SET active=0 WHERE row_id=? AND active=1', id);
        run('UPDATE bank_receipt_matches SET active=0 WHERE row_id=? AND active=1', id);
      } else {
        requireThat(input.action === 'match' && !get('SELECT id FROM bank_matches WHERE row_id=? AND active=1', id) && !get('SELECT id FROM bank_receipt_matches WHERE row_id=? AND active=1', id), 'Row is already matched.');
        const paymentIds=input.payment_ids??[],receiptIds=input.receipt_ids??[];
        requireThat(Array.isArray(paymentIds)&&Array.isArray(receiptIds)&&paymentIds.length+receiptIds.length>0&&paymentIds.length+receiptIds.length<=100&&new Set(paymentIds).size===paymentIds.length&&new Set(receiptIds).size===receiptIds.length, 'Choose distinct recorded transactions.');
        const ps = paymentIds.map(row),rs=receiptIds.map(receiptId=>{const receipt=get('SELECT * FROM client_receipts WHERE id=?',receiptId);requireThat(receipt&&access.has('customer_receipts.read',receipt.company_id,receipt.project_id),'Customer receipt is unavailable.',404);return receipt;});
        for (const p of ps) {
          requireThat(p.state === 'recorded' && p.bank_id === r.bank_id && p.recorded_by !== actorId && !cleared(p.id) && p.accounting_date <= r.date && (effect(p) > 0 ? 'out' : 'in') === r.direction, 'Matching needs uncleared transactions from this bank, date and direction, and an independent reconciler.');
        }
        for(const receipt of rs) requireThat(receipt.state==='recorded'&&receipt.bank_id===r.bank_id&&receipt.recorded_by!==actorId&&!get('SELECT id FROM bank_receipt_matches WHERE receipt_id=? AND active=1',receipt.id)&&receipt.accounting_date<=r.date&&(receipt.reversal_of?'out':'in')===r.direction,'Matching needs uncleared customer receipts from this bank, date and direction, and an independent reconciler.');
        requireThat(sum([...ps,...rs].map(p => p.bank_amount)).cmp(r.amount) === 0, 'Selected bank amounts must exactly equal the statement row.');
        for (const p of ps) run('INSERT INTO bank_matches(row_id,payment_id,active,actor_id,at) VALUES(?,?,1,?,?)', id, p.id, actorId, now());
        for (const receipt of rs) run('INSERT INTO bank_receipt_matches(row_id,receipt_id,active,actor_id,at) VALUES(?,?,1,?,?)', id, receipt.id, actorId, now());
      }
      run('UPDATE bank_rows SET version=version+1 WHERE id=?', id);
      event('bank-row', {
        ...r,
        version: r.version + 1,
        matches: all('SELECT * FROM bank_matches WHERE row_id=?', id),
        receipt_matches: all('SELECT * FROM bank_receipt_matches WHERE row_id=?', id)
      }, input.action, reason);
      return statements(r.company_id).flatMap(s => s.rows).find(x => x.id === id);
    });
  }
  function report(c, {
    project = null,
    to = today()
  } = {}) {
    scope(c, project);
    day(to);
    requireThat(to <= today(), 'Report cutoff cannot be future.');
    const docs = all("SELECT * FROM payments WHERE company_id=? AND state='recorded' AND accounting_date<=?", c, to);
    const rows = docs.flatMap(r => {
      const p = JSON.parse(r.payload);
      return p.allocations.filter(a => (!project || a.project_id === project) && access.has('payments.read', c, a.project_id)).map(a => ({
        payment_id: r.id,
        can_open: can('payments.read', r),
        bill_id: a.bill_id,
        bill_reference: a.reference,
        project_id: a.project_id,
        project: get('SELECT name FROM projects WHERE id=?', a.project_id).name,
        title: r.title,
        vendor: p.vendor,
        date: r.accounting_date,
        currency: r.currency,
        amount: a.amount,
        base_carrying: a.base_amount,
        bank_currency: p.bank.currency,
        bank_amount: a.bank_amount,
        bank_base: a.bank_base,
        direction: effect(r) > 0 ? 'out' : 'in',
        fx: money(new D(a.bank_base).minus(a.base_amount).times(effect(r))),
        clearance: cleared(r.id, to),
        journal_id: r.journal_id,
        reversal_of: r.reversal_of,
        bank_reference: r.bank_reference
      }));
    });
    const out = money(sum(rows.filter(r => r.direction === 'out').map(r => r.bank_base))),
      incoming = money(sum(rows.filter(r => r.direction === 'in').map(r => r.bank_base))),
      net = money(new D(out).minus(incoming)),
      clear = money(sum(rows.filter(r => r.clearance).map(r => new D(r.bank_base).times(r.direction === 'out' ? 1 : -1)))),
      planned = all("SELECT * FROM payments WHERE company_id=? AND state='approved' AND accounting_date<=?", c, to).flatMap(r => {
        const p = JSON.parse(r.payload),
          allocations = p.allocations.filter(a => (!project || a.project_id === project) && access.has('payments.read', c, a.project_id));
        return allocations.length ? [{
          id: r.id,
          title: r.title,
          vendor: p.vendor,
          currency: r.currency,
          total: money(sum(allocations.map(a => a.amount))),
          bank_currency: p.bank.currency,
          bank_amount: money(sum(allocations.map(a => a.bank_amount))),
          scope_partial: allocations.length !== p.allocations.length,
          can_open: can('payments.read', r)
        }] : [];
      });
    return {
      company: company(c),
      project_id: project,
      to,
      rows,
      planned,
      totals: {
        out,
        incoming,
        net,
        cleared: clear,
        uncleared: money(new D(net).minus(clear)),
        fx: money(sum(rows.map(r => r.fx)))
      },
      findings: [`${rows.length} bill allocation(s) from ${new Set(rows.map(r => r.payment_id)).size} recorded transactions through ${to}.`, `${out} ${company(c).currency} recorded out; ${incoming} recorded in; ${net} net outflow.`, `${clear} ${company(c).currency} net outflow has current bank matches dated through the cutoff.`, `${planned.length} approved plan(s) await recording; these are excluded from cash.`],
      limitations: ['Supplier settlement subset only. This is movement, not a complete bank balance or company cash-flow statement. Customer receipts, charges, transfers, opening balances and policy classification remain separate work.', 'Clearance reflects currently active matches with statement date through cutoff; historical unmatched/re-matched status is retained in audit, not reconstructed here.', 'Functional values reflect payment snapshots; foreign bank remeasurement and reporting translation are not included. Operational cost/cash opening examples are not merged with these postings.', project ? 'Selected project allocations only.' : access.has('payments.read', c) ? 'All company project allocations.' : 'Restricted to your authorised projects; not a full legal-company statement.']
    };
  }
  return {
    bank,
    balances,
    save,
    decide,
    reverse,
    detail,
    list,
    options,
    statement,
    voidStatement,
    statements,
    match,
    report
  };
}
