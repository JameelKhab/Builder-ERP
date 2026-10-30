import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { payableRatio } from './payables.mjs';
import { receivableBalance } from './receivable-balance.mjs';
import { creditReserved } from './customer-credit-state.mjs';
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
const absolute = v => new D(v).gte(0) ? money(v) : money(new D(0).minus(v));
const file = v => {
  requireThat(v && typeof v === 'object', 'Original evidence is required.');
  const filename = text(v.filename, 'Evidence filename', 180);
  requireThat(!/[\/\\\x00-\x1f]/.test(filename) && /\.(pdf|png|jpe?g|txt)$/i.test(filename), 'Use a plain PDF, PNG, JPG or TXT filename.');
  requireThat(typeof v.base64 === 'string' && v.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.base64), 'Evidence encoding is invalid.');
  const bytes = Buffer.from(v.base64, 'base64');
  requireThat(bytes.length > 0 && bytes.length <= 2 * 1024 * 1024, 'Evidence must be 1 byte–2 MiB.');
  return {
    filename,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
};
export function customerCredits(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has('customer_receipts.' + cap, r.company_id, r.project_id);
  const company = c => {
    const r = get('SELECT * FROM companies WHERE id=?', c);
    requireThat(r, 'Company unavailable.', 404);
    return r;
  };
  const scope = (c, p) => {
    company(c);
    requireThat(access.has('customer_receipts.read', c, p, !p), 'Credit scope is unavailable.', 404);
    if (p) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', p, c), 'Project unavailable.', 404);
  };
  const row = id => {
    const r = get('SELECT * FROM client_credit_settlements WHERE id=?', id);
    requireThat(r && can('read', r), 'Credit settlement unavailable.', 404);
    return r;
  };
  const invoice = id => {
    const r = get("SELECT * FROM client_invoices WHERE id=? AND state='posted'", id);
    requireThat(r && can('read', r), 'Posted invoice unavailable.', 404);
    return r;
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && v === r.version, 'This settlement changed. Reload before continuing.', 409);
  const account = (id, c, purpose, type) => {
    const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, c);
    requireThat(a && a.active && a.purpose === purpose && a.type === type, 'Choose active company accounts with the required type and purpose.');
    return a;
  };
  const bankSnapshot = (id, c) => {
    const b = get('SELECT * FROM payment_banks WHERE id=? AND company_id=?', id, c);
    requireThat(b && b.active, 'Choose an active company bank.');
    return {
      ...b,
      accounts: [account(b.account_id, c, 'bank', 'asset'), account(b.gain_account_id, c, 'general', 'income'), account(b.loss_account_id, c, 'general', 'expense')]
    };
  };
  const authority = (r, who, cap = 'approve') => {
    try {
      const p = policy(db, who);
      p.actor();
      return p.has('customer_receipts.' + cap, r.company_id, r.project_id) && (cap !== 'approve' || p.matching(r.company_id, r.project_id).some(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('customer_receipts.approve') && new D(g.customer_credit_approval_limit || 0).gt(0) && new D(g.customer_credit_approval_limit || 0).gte(r.authority_amount)));
    } catch {
      return false;
    }
  };
  const reviewer = (r, who = actorId) => who !== r.author_id && authority(r, who);
  const event = (r, action, reason) => run('INSERT INTO client_credit_events(settlement_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?)', r.id, actorId, action, text(reason, 'Decision reason'), JSON.stringify(r), now());
  const receiptReserved = id => money(sum(all("SELECT payload FROM client_receipts WHERE state='approved' AND reversal_of IS NULL").flatMap(r => JSON.parse(r.payload).allocations).filter(a => a.invoice_id === id).map(a => a.amount)));
  const leg = (i, n, effect) => {
    const b = receivableBalance(db, i),
      open = effect === 1 ? b.customer_credit : b.debit_open,
      base = effect === 1 ? new D(0).minus(b.base_open) : new D(b.base_open);
    requireThat(new D(open).gt(0) && base.gte(0) && new D(n).lte(open), 'Amount exceeds the remaining credit or receivable.');
    return {
      invoice_id: i.id,
      project_id: i.project_id,
      reference: i.title,
      amount: n,
      base_amount: payableRatio(n, base, open),
      effect,
      control: account(JSON.parse(i.snapshot).accounts.receivable.id, i.company_id, 'receivable', 'asset'),
      open_snapshot: b.open,
      base_snapshot: b.base_open,
      latest_date: b.latest_date
    };
  };
  function prepare(r, input) {
    const source = invoice(r.source_invoice_id),
      targets = input.allocations ?? [];
    requireThat(source.company_id === r.company_id, 'Source must belong to the selected company.');
    requireThat(['allocation', 'refund'].includes(r.kind), 'Choose allocation or refund.');
    let total,
      legs,
      bank = null,
      accounts = null,
      bankAmount = null,
      bankRate = null,
      rateDate = null,
      rateSource = null,
      base = '0.00',
      beneficiary = null;
    if (r.kind === 'allocation') {
      requireThat(Array.isArray(targets) && targets.length > 0 && targets.length <= 30 && targets.every(a => a && typeof a.invoice_id === 'string') && new Set(targets.map(a => a.invoice_id)).size === targets.length, 'Choose 1–30 distinct target invoices.');
      const tt = targets.map(a => {
        const i = invoice(a.invoice_id);
        requireThat(i.id !== source.id && i.company_id === source.company_id && i.customer_id === source.customer_id && i.currency === source.currency, 'Allocation needs another invoice of the same company, customer and currency.');
        return leg(i, amount(a.amount), -1);
      });
      total = money(sum(tt.map(l => l.amount)));
      legs = [leg(source, total, 1), ...tt];
      accounts = {
        transfer: account(input.transfer_account, r.company_id, 'client_credit_transfer', 'asset'),
        gain: account(input.gain_account, r.company_id, 'general', 'income'),
        loss: account(input.loss_account, r.company_id, 'general', 'expense')
      };
      let remaining = total,
        carrying = legs[0].base_amount;
      for (const l of tt) {
        l.source_base = payableRatio(l.amount, carrying, remaining);
        remaining = money(new D(remaining).minus(l.amount));
        carrying = money(new D(carrying).minus(l.source_base));
      }
    } else {
      requireThat(Array.isArray(targets) && targets.length === 0, 'Refunds have no target invoice allocations.');
      total = amount(input.amount);
      legs = [leg(source, total, 1)];
      bank = bankSnapshot(r.bank_id, r.company_id);
      bankAmount = amount(input.bank_amount);
      bankRate = decimal(input.bank_rate, 'Bank accounting rate', false).toString();
      rateDate = day(input.rate_date);
      rateSource = text(input.rate_source, 'Rate source', 500);
      beneficiary = text(input.beneficiary, 'Reviewed beneficiary instructions', 2000);
      requireThat(bank.currency !== source.currency || new D(bankAmount).cmp(total) === 0, 'Same-currency bank amount must equal the refund.');
      requireThat(bank.currency !== company(r.company_id).currency || new D(bankRate).cmp(1) === 0, 'Functional-currency bank rate must be 1.');
      requireThat(rateDate <= r.accounting_date, 'Rate date cannot follow the refund date.');
      base = money(new D(bankAmount).times(bankRate));
      requireThat(new D(base).gt(0), 'Bank functional amount rounds to zero.');
    }
    const projects = [...new Set(legs.map(l => l.project_id))],
      project_id = projects.length === 1 ? projects[0] : null;
    access.requireCap('customer_receipts.write', r.company_id, project_id);
    requireThat(r.accounting_date <= today() && legs.every(l => r.accounting_date >= l.latest_date), 'Accounting date must follow affected invoices and settlements and cannot be future.');
    const targetBase = money(sum(legs.filter(l => l.effect === -1).map(l => l.base_amount)));
    const exposure = [legs[0].base_amount, targetBase, base].reduce((a, b) => new D(a).gte(b) ? a : b, '0.00');
    return {
      project_id,
      customer_id: source.customer_id,
      currency: source.currency,
      total,
      authority_amount: exposure,
      bank_amount: bankAmount,
      bank_rate: bankRate,
      rate_date: rateDate,
      rate_source: rateSource,
      company_total: r.kind === 'refund' ? base : legs[0].base_amount,
      payload: JSON.stringify({
        customer: JSON.parse(source.snapshot).contract.customer,
        legs,
        bank,
        accounts,
        beneficiary
      })
    };
  }
  const evidence = (r, f) => {
    const id = uid('CCE');
    run('INSERT INTO client_credit_evidence VALUES(?,?,?,?,?,?,?)', id, r.id, f.filename, f.sha256, f.bytes, actorId, now());
    return id;
  };
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        c = old?.company_id || input.company_id;
      scope(c, null);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && can('write', old) && ['draft', 'returned'].includes(old.state), 'Only the author can revise unsubmitted work.', 403);
      }
      const r = {
        id: id || uid('CCS'),
        company_id: c,
        source_invoice_id: old?.source_invoice_id || input.source_invoice_id,
        kind: old?.kind || input.kind,
        bank_id: old?.bank_id || (input.kind === 'refund' ? input.bank_id : null),
        title: text(input.title, 'Title', 160),
        accounting_date: day(input.accounting_date),
        basis: text(input.basis, 'Settlement basis')
      };
      Object.assign(r, prepare(r, input));
      if (old) {
        requireThat(old.project_id === r.project_id && old.customer_id === r.customer_id && old.currency === r.currency, 'Company/customer/currency/project scope is fixed. Prepare a new request.');
        const keys = Object.keys(r).filter(k => !['id', 'company_id', 'source_invoice_id', 'kind', 'bank_id', 'project_id', 'customer_id', 'currency'].includes(k));
        run(`UPDATE client_credit_settlements SET ${keys.map(k => k + '=?')},state='draft',approved_by=NULL,version=version+1 WHERE id=?`, ...keys.map(k => r[k]), id);
      } else {
        Object.assign(r, {
          author_id: actorId,
          state: 'draft',
          created_at: now()
        });
        const keys = Object.keys(r);
        run(`INSERT INTO client_credit_settlements(${keys}) VALUES(${keys.map(() => '?')})`, ...keys.map(k => r[k]));
      }
      if (input.file) run('UPDATE client_credit_settlements SET instruction_id=? WHERE id=?', evidence(r, file(input.file)), r.id);
      event(row(r.id), old ? 'Credit settlement revised' : 'Credit settlement prepared', r.basis);
      return detail(r.id);
    });
  }
  function validate(r) {
    const p = JSON.parse(r.payload);
    requireThat(r.instruction_id, 'Attach the original customer instruction before submitting.');
    requireThat(authority(r, r.author_id, 'write'), 'Author no longer has current scope. Resolve ownership before continuing.', 409);
    const period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.accounting_date, r.accounting_date);
    requireThat(period && r.accounting_date <= today(), 'An open company period and non-future date are required.');
    if (p.bank) requireThat(JSON.stringify(bankSnapshot(r.bank_id, r.company_id)) === JSON.stringify(p.bank), 'Bank configuration changed. Return and revise.', 409);
    if (p.accounts) for (const [key, a] of Object.entries(p.accounts)) requireThat(JSON.stringify(account(a.id, r.company_id, key === 'transfer' ? 'client_credit_transfer' : 'general', key === 'transfer' ? 'asset' : key === 'gain' ? 'income' : 'expense')) === JSON.stringify(a), 'Allocation accounts changed. Return and revise.', 409);
    for (const l of p.legs) {
      const i = invoice(l.invoice_id),
        b = receivableBalance(db, i);
      requireThat(b.open === l.open_snapshot && b.base_open === l.base_snapshot && b.latest_date === l.latest_date && r.accounting_date >= b.latest_date && JSON.stringify(account(l.control.id, r.company_id, 'receivable', 'asset')) === JSON.stringify(l.control), 'Invoice balance or account changed. Return and revise.', 409);
      requireThat(new D(l.amount).plus(creditReserved(db, i.id, l.effect, r.id)).plus(l.effect === -1 ? receiptReserved(i.id) : '0').lte(l.effect === 1 ? b.customer_credit : b.debit_open), 'Another approved plan reserves this balance.', 409);
      if (l.effect === 1) requireThat(!all("SELECT payload FROM client_receipts WHERE state='approved' AND reversal_of IS NOT NULL").some(x => JSON.parse(x.payload).allocations.some(a => a.invoice_id === i.id)), 'An approved receipt correction reserves this customer credit.', 409);
    }
    return {
      p,
      period
    };
  }
  const clearance = (id, to = '9999-12-31') => get('SELECT b.id row_id,b.date,b.reference,s.reference statement FROM bank_credit_matches m JOIN bank_rows b ON b.id=m.row_id JOIN bank_statements s ON s.id=b.statement_id WHERE m.settlement_id=? AND m.active=1 AND b.date<=?', id, to) || null;
  function post(r, ref, remittance) {
    const {
        p,
        period
      } = validate(r),
      lines = [],
      source = p.legs[0];
    const line = (a, project, signed, description) => {
      if (new D(signed).isZero()) return;
      const debit = new D(signed).gt(0) ? money(signed) : '0.00',
        credit = new D(signed).gt(0) ? '0.00' : absolute(signed);
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
    line(source.control, source.project_id, source.base_amount, `${r.id} · source credit ${source.amount} ${r.currency}`);
    if (r.kind === 'refund') {
      line(p.bank.accounts[0], source.project_id, new D(0).minus(r.company_total), `${ref} · refund ${r.bank_amount} ${p.bank.currency}`);
      const diff = new D(r.company_total).minus(source.base_amount);
      line(diff.gt(0) ? p.bank.accounts[2] : p.bank.accounts[1], source.project_id, diff, 'Customer refund exchange difference');
    } else {
      line(p.accounts.transfer, source.project_id, new D(0).minus(source.base_amount), 'Customer credit transferred');
      for (const l of p.legs.slice(1)) {
        line(p.accounts.transfer, l.project_id, l.source_base, 'Customer credit received');
        line(l.control, l.project_id, new D(0).minus(l.base_amount), `${l.reference} · ${l.amount} ${r.currency}`);
        const diff = new D(l.base_amount).minus(l.source_base);
        line(diff.gt(0) ? p.accounts.loss : p.accounts.gain, l.project_id, diff, 'Credit allocation exchange difference');
      }
    }
    for (const project of new Set(p.legs.map(l => l.project_id))) {
      const ll = lines.filter(l => l.project_id === project);
      requireThat(sum(ll.map(l => l.debit)).cmp(sum(ll.map(l => l.credit))) === 0, 'Credit journal must balance in every project.');
    }
    const id = uid('JRN'),
      year = r.accounting_date.slice(0, 4),
      total = money(sum(lines.map(l => l.debit)));
    run('INSERT OR IGNORE INTO ledger_sequences(company_id,year,next_number) VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id) VALUES(?,?,?,?,?,?,'1',?,?,?,?,?,?,?,?,'submitted',?,'customer_credit',?)", id, r.company_id, r.project_id, r.title, r.accounting_date, company(r.company_id).currency, r.accounting_date, 'Original carrying values; explicit allocation or bank FX', ref || r.id, r.basis, JSON.stringify(lines), total, total, r.author_id, now(), r.id);
    lines.forEach((l, i) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, l.project_id, l.account_id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", `GL/${year}/${String(n).padStart(6, '0')}`, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'Customer credit settled', r.basis, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    for (const l of p.legs) run('INSERT INTO client_credit_legs VALUES(?,?,?,?,?,?,?,?)', uid('CCL'), r.id, l.invoice_id, l.project_id, l.control.id, l.amount, l.base_amount, l.effect);
    const f = remittance ? evidence(r, remittance) : null;
    run("UPDATE client_credit_settlements SET state='recorded',recorded_by=?,recorded_at=?,journal_id=?,bank_reference=?,reference_key=?,evidence_id=?,version=version+1 WHERE id=?", actorId, now(), id, ref, ref?.toLocaleLowerCase('en') || null, f, r.id);
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id),
        reason = text(input.reason, 'Decision reason');
      if (input.action === 'record' && r.state === 'recorded') {
        requireThat(actorId === r.recorded_by && can('record', r), 'This settlement is already recorded.', 409);
        if (r.kind === 'refund') {
          const f = file(input.file),
            old = get('SELECT * FROM client_credit_evidence WHERE id=?', r.evidence_id);
          requireThat(input.bank_reference?.trim() === r.bank_reference && f.filename === old.filename && f.sha256 === old.sha256, 'This refund already has different evidence.', 409);
        }
        return detail(id);
      }
      version(r, input.version);
      const author = r.author_id === actorId && can('write', r);
      let state;
      if (input.action === 'record') {
        requireThat(r.state === 'approved' && can('record', r) && actorId !== r.approved_by && reviewer(r, r.approved_by), 'Recording requires another person and current independent credit authority.', 403);
        let ref = null,
          f = null;
        if (r.kind === 'refund') {
          ref = text(input.bank_reference, 'Actual bank reference', 120);
          f = file(input.file);
          for (const table of ['payments', 'client_receipts', 'client_credit_settlements']) requireThat(!get(`SELECT id FROM ${table} WHERE bank_id=? AND reference_key=?`, r.bank_id, ref.toLocaleLowerCase('en')), 'This bank reference is already recorded.', 409);
        }
        post(r, ref, f);
      } else {
        if (input.action === 'submit') {
          requireThat(author && r.state === 'draft', 'Only the author can submit a draft.', 403);
          validate(r);
          state = 'submitted';
        } else if (input.action === 'approve') {
          requireThat(r.state === 'submitted' && reviewer(r), 'Independent customer credit authority must cover all carrying and bank amounts.', 403);
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
        } else requireThat(false, 'Unknown settlement decision.');
        run('UPDATE client_credit_settlements SET state=?,approved_by=?,version=version+1 WHERE id=?', state, state === 'approved' ? actorId : null, id);
      }
      event(row(id), input.action, reason);
      return detail(id);
    });
  }
  function detail(id) {
    const r = row(id),
      p = JSON.parse(r.payload),
      blockers = [];
    if (!['recorded', 'cancelled'].includes(r.state)) {
      try {
        validate(r);
      } catch (e) {
        blockers.push(e.message);
      }
    }
    return {
      ...r,
      payload: p,
      blockers,
      company_currency: company(r.company_id).currency,
      author: get('SELECT name FROM users WHERE id=?', r.author_id).name,
      evidence: all('SELECT id,filename,sha256,created_at FROM client_credit_evidence WHERE settlement_id=? ORDER BY rowid', id),
      history: all('SELECT e.id,e.action,e.reason,e.at,u.name actor FROM client_credit_events e JOIN users u ON u.id=e.actor_id WHERE settlement_id=? ORDER BY e.id', id),
      clearance: clearance(id),
      can_edit: r.author_id === actorId && can('write', r) && ['draft', 'returned'].includes(r.state),
      can_approve: r.state === 'submitted' && reviewer(r) && !blockers.length,
      can_return: ['submitted', 'approved'].includes(r.state) && can('approve', r) && actorId !== r.author_id,
      can_record: r.state === 'approved' && can('record', r) && actorId !== r.approved_by && reviewer(r, r.approved_by) && !blockers.length,
      can_open_journal: access.has('ledger.read', r.company_id, r.project_id)
    };
  }
  function list(c, p = null) {
    scope(c, p);
    return all('SELECT * FROM client_credit_settlements WHERE company_id=? ORDER BY created_at DESC,id', c).filter(r => can('read', r) && (!p || JSON.parse(r.payload).legs.some(l => l.project_id === p))).map(r => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      state: r.state,
      version: r.version,
      company_id: c,
      project_id: r.project_id,
      currency: r.currency,
      total: r.total,
      accounting_date: r.accounting_date,
      author_id: r.author_id
    }));
  }
  function options(c, p = null) {
    scope(c, p);
    return {
      company: company(c),
      project_id: p,
      today: today(),
      invoices: all("SELECT * FROM client_invoices WHERE company_id=? AND state='posted'", c).filter(i => (!p || i.project_id === p) && can('read', i)).map(i => {
        const b = receivableBalance(db, i);
        return {
          id: i.id,
          title: i.title,
          project_id: i.project_id,
          customer_id: i.customer_id,
          currency: i.currency,
          debit_open: b.debit_open,
          customer_credit: b.customer_credit,
          base_open: b.base_open,
          credit_reserved: creditReserved(db, i.id, 1),
          debit_reserved: money(new D(creditReserved(db, i.id, -1)).plus(receiptReserved(i.id)))
        };
      }),
      banks: all('SELECT id,name,currency FROM payment_banks WHERE company_id=? AND active=1', c),
      accounts: all("SELECT id,code,name,type,purpose FROM ledger_accounts WHERE company_id=? AND active=1 AND purpose IN ('general','client_credit_transfer')", c),
      can_prepare: access.has('customer_receipts.write', c, p, !p)
    };
  }
  function download(id) {
    const f = get('SELECT * FROM client_credit_evidence WHERE id=?', id);
    requireThat(f, 'Evidence unavailable.', 404);
    row(f.settlement_id);
    return f;
  }
  function report(c, {
    project = null,
    currency = null,
    to = today()
  } = {}) {
    scope(c, project);
    day(to);
    requireThat(to <= today(), 'Report cutoff cannot be future.');
    requireThat(!currency || /^[A-Z]{3}$/.test(currency), 'Use a valid currency filter.');
    const docs = all("SELECT * FROM client_credit_settlements WHERE company_id=? AND state='recorded' AND accounting_date<=?", c, to).filter(r => !currency || r.currency === currency);
    const rows = docs.flatMap(r => JSON.parse(r.payload).legs.filter(l => (!project || l.project_id === project) && access.has('customer_receipts.read', c, l.project_id)).map(l => ({
      id: r.id,
      invoice_id: l.invoice_id,
      project_id: l.project_id,
      kind: r.kind,
      date: r.accounting_date,
      currency: r.currency,
      amount: l.amount,
      base_amount: l.base_amount,
      effect: l.effect,
      account_id: l.control.id,
      title: can('read', r) ? r.title : 'Customer credit allocation',
      can_open: can('read', r),
      journal_id: r.journal_id,
      bank_amount: r.kind === 'refund' ? r.bank_amount : null,
      bank_currency: r.kind === 'refund' ? JSON.parse(r.payload).bank.currency : null,
      bank_base: r.kind === 'refund' ? r.company_total : null,
      clearance: r.kind === 'refund' ? clearance(r.id, to) : null
    })));
    const source = money(sum(rows.map(l => new D(l.base_amount).times(l.effect))));
    let ledger = new D(0);
    const groups = new Set();
    for (const l of rows) {
      const key = JSON.stringify([l.journal_id, l.project_id, l.account_id]);
      if (groups.has(key)) continue;
      groups.add(key);
      ledger = ledger.plus(sum(all('SELECT base_debit,base_credit FROM ledger_lines WHERE entry_id=? AND project_id=? AND account_id=?', l.journal_id, l.project_id, l.account_id).map(x => new D(x.base_debit).minus(x.base_credit))));
    }
    const currencies = [...new Set(rows.map(l => l.currency))].map(currency => {
      const rr = rows.filter(l => l.currency === currency);
      return {
        currency,
        applied: money(sum(rr.filter(l => l.kind === 'allocation' && l.effect === 1).map(l => l.amount))),
        received: money(sum(rr.filter(l => l.effect === -1).map(l => l.amount))),
        refunded: money(sum(rr.filter(l => l.kind === 'refund').map(l => l.amount)))
      };
    });
    return {
      company: company(c),
      project_id: project,
      currency,
      to,
      rows,
      currency_groups: currencies,
      reconciliation: {
        source_effect: source,
        ledger_effect: money(ledger),
        difference: money(new D(source).minus(ledger))
      },
      findings: [`${new Set(rows.map(l => l.id)).size} recorded credit settlements through ${to}. Approved plans are excluded.`, ...currencies.map(g => `${g.currency}: ${g.applied} credit applied, ${g.received} received against invoices, ${g.refunded} refunded.`), `AR movement difference: ${money(new D(source).minus(ledger))} ${company(c).currency}.`],
      limitations: ['Allocation is noncash; refund recording is distinct from bank matching. This is not a full company cash-flow statement.', 'Current bank matches dated through cutoff are shown, not reconstructed historic clearance.', project ? 'Selected project legs only.' : access.has('customer_receipts.read', c) ? 'All company projects.' : 'Only authorised project legs; not the complete company.']
    };
  }
  return {
    save,
    decide,
    detail,
    list,
    options,
    download,
    report
  };
}
