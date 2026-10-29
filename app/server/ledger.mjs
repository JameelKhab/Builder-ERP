import { randomUUID } from 'node:crypto';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { policy } from './access.mjs';
import { transaction } from './db.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const txt = (v, n, max = 1000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${n} is required (maximum ${max} characters).`);
  return v.trim();
};
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const amt = v => {
  requireThat(typeof v === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(v), 'Journal amounts need up to two decimals and 12 integer digits.');
  return money(v);
};
export const LEDGER_STATES = {
  draft: 'Draft',
  submitted: 'Independent review',
  returned: 'Returned for correction',
  posted: 'Posted',
  cancelled: 'Cancelled'
};
export function convertJournal(input, rate) {
  requireThat(Array.isArray(input) && input.length >= 2 && input.length <= 50, 'Use 2 to 50 journal lines.');
  const lines = input.map(l => {
    const debit = amt(l.debit),
      credit = amt(l.credit);
    requireThat(new D(debit).gt(0) !== new D(credit).gt(0), 'Each line needs either a positive debit or a positive credit.');
    return {
      account_id: l.account_id,
      description: txt(l.description, 'Line description', 300),
      debit,
      credit,
      base_debit: money(new D(debit).times(rate)),
      base_credit: money(new D(credit).times(rate)),
      rounding_adjustment: '0.00'
    };
  });
  const total = sum(lines.map(l => l.debit));
  requireThat(total.gt(0) && total.cmp(sum(lines.map(l => l.credit))) === 0, 'Debits and credits must balance in the transaction currency.');
  const base = money(total.times(rate));
  for (const side of ['debit', 'credit']) {
    const eligible = lines.filter(l => new D(l[side]).gt(0));
    const target = eligible.reduce((a, b) => new D(b[side]).gt(a[side]) ? b : a);
    const difference = new D(base).minus(sum(lines.map(l => l[`base_${side}`])));
    target[`base_${side}`] = money(new D(target[`base_${side}`]).plus(difference));
    target.rounding_adjustment = money(difference);
    requireThat(eligible.every(l => new D(l[`base_${side}`]).gt(0)), 'The rate rounds a line to zero. Combine related lines or revise the accounting rate.');
  }
  return {
    lines,
    total: money(total),
    company_total: base
  };
}
export function ledger(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(cap, r.company_id, r.project_id);
  const requireScope = (company, project = null) => {
    requireThat(get('SELECT id FROM companies WHERE id=?', company) && access.has('finance.read', company, project, !project), 'Accounting scope is not available.', 404);
    if (project) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is not available.', 404);
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This accounting record changed. Reload before continuing.', 409);
  const limit = r => access.matching(r.company_id, r.project_id).filter(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('ledger.post')).reduce((n, g) => new D(g.ledger_approval_limit || '0').gt(n) ? money(g.ledger_approval_limit) : n, '0.00');
  const event = (type, r, action, reason) => run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', type, r.id, r.company_id, r.project_id || null, actorId, action, txt(reason, 'Reason', 2000), JSON.stringify(r), now());
  const row = id => {
    const r = get('SELECT * FROM ledger_entries WHERE id=?', id);
    requireThat(r && can('finance.read', r), 'Journal is not available.', 404);
    return r;
  };
  const independent = r => r.author_id !== actorId;
  const review = r => can('ledger.post', r) && independent(r) && new D(limit(r)).gte(r.company_total) && new D(limit(r)).gt(0);
  const periodFor = r => {
    const p = get('SELECT * FROM ledger_periods WHERE company_id=? AND start_date<=? AND end_date>=?', r.company_id, r.accounting_date, r.accounting_date);
    requireThat(p?.state === 'open', 'The accounting date needs an open company period.');
    return p;
  };
  const linesFor = r => JSON.parse(r.lines_json);
  const validateAccounts = r => {
    for (const l of linesFor(r)) {
      const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', l.account_id, r.company_id);
      requireThat(a && (a.active || r.reversal_of) && a.purpose === 'general', 'Each account must be active and allow general journals. Control accounts need their typed subledger.');
      requireThat(a.version === l.account_version, 'An account changed after preparation. Return and revise the journal before posting.');
    }
  };
  const history = (type, id) => all('SELECT e.*,u.name actor FROM ledger_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id', type, id).map(e => ({
    ...e,
    snapshot: JSON.parse(e.snapshot)
  }));
  function detail(id) {
    const r = row(id);
    return {
      ...r,
      lines_json: undefined,
      lines: r.state === 'posted' ? all('SELECT * FROM ledger_lines WHERE entry_id=? ORDER BY ordinal', id) : linesFor(r),
      state_label: LEDGER_STATES[r.state],
      company_currency: get('SELECT currency FROM companies WHERE id=?', r.company_id).currency,
      project: r.project_id ? get('SELECT name FROM projects WHERE id=?', r.project_id).name : 'Company · unallocated',
      author: get('SELECT name FROM users WHERE id=?', r.author_id).name,
      poster: r.posted_by ? get('SELECT name FROM users WHERE id=?', r.posted_by).name : null,
      can_write: can('ledger.write', r) && r.author_id === actorId,
      can_review: review(r),
      can_return: can('ledger.post', r) && independent(r),
      can_reverse: can('ledger.write', r) && r.state === 'posted' && !r.reversal_of && !get("SELECT id FROM ledger_entries WHERE reversal_of=? AND state<>'cancelled'", id),
      posting_limit: can('ledger.post', r) ? limit(r) : '0.00',
      reversal: get("SELECT id,number,state FROM ledger_entries WHERE reversal_of=? AND state<>'cancelled'", id) || null,
      history: history('journal', id)
    };
  }
  function list(company, project = null) {
    requireScope(company, project);
    return all('SELECT * FROM ledger_entries WHERE company_id=? ORDER BY created_at DESC,rowid DESC', company).filter(r => (!project || r.project_id === project) && can('finance.read', r)).map(r => ({
      id: r.id,
      company_id: r.company_id,
      project_id: r.project_id,
      title: r.title,
      accounting_date: r.accounting_date,
      state: r.state,
      state_label: LEDGER_STATES[r.state],
      number: r.number,
      currency: r.currency,
      total: r.total,
      company_total: r.company_total,
      reversal_of: r.reversal_of,
      author_id: r.author_id,
      can_review: r.state === 'submitted' && review(r),
      my_draft: r.author_id === actorId && ['draft', 'returned'].includes(r.state),
      version: r.version,
      project: r.project_id ? get('SELECT name FROM projects WHERE id=?', r.project_id).name : 'Company · unallocated'
    }));
  }
  function options(company, project = null) {
    requireScope(company, project);
    return {
      company: get('SELECT id,name,currency FROM companies WHERE id=?', company),
      actor_id: actorId,
      projects: all('SELECT id,name FROM projects WHERE company_id=? ORDER BY name', company).filter(p => access.has('finance.read', company, p.id)),
      company_wide: access.has('finance.read', company),
      can_write: access.has('ledger.write', company, project, !project),
      can_company_write: access.has('ledger.write', company),
      can_manage: access.has('ledger.manage', company),
      accounts: all('SELECT * FROM ledger_accounts WHERE company_id=? ORDER BY code', company),
      periods: all('SELECT * FROM ledger_periods WHERE company_id=? ORDER BY start_date DESC', company),
      configuration_history: access.has('ledger.manage', company) ? all("SELECT e.*,u.name actor FROM ledger_events e JOIN users u ON u.id=e.actor_id WHERE e.company_id=? AND e.entity_type IN ('account','period') ORDER BY e.id DESC", company).map(e => ({
        ...e,
        snapshot: JSON.parse(e.snapshot)
      })) : [],
      currencies: ['AED', 'USD', 'EUR'],
      today: today()
    };
  }
  function account(id, input) {
    return transaction(db, () => {
      const old = id ? get('SELECT * FROM ledger_accounts WHERE id=?', id) : null;
      requireThat(!id || old, 'Account is unavailable.', 404);
      const company = old?.company_id || input.company_id;
      access.requireCap('ledger.manage', company);
      if (old) version(old, input.version);
      requireThat(['asset', 'liability', 'equity', 'income', 'expense'].includes(input.type) && ['general', 'bank', 'payable', 'receivable', 'tax', 'stock'].includes(input.purpose), 'Choose a valid account type and purpose.');
      const code = txt(input.code, 'Account code', 20),
        name = txt(input.name, 'Account name', 120);
      requireThat(/^[A-Z0-9.-]+$/.test(code), 'Use uppercase letters, numbers, dots or hyphens in the code.');
      requireThat(!all('SELECT id FROM ledger_accounts WHERE company_id=? AND code=?', company, code).some(r => r.id !== id), 'This account code already exists.');
      requireThat(typeof input.active === 'boolean', 'Choose account availability.');
      if (old) requireThat(old.code === code && old.type === input.type && old.purpose === input.purpose, 'Account code, type and purpose cannot change. Create a new account.');
      id ||= uid('ACC');
      if (old) run('UPDATE ledger_accounts SET name=?,active=?,version=version+1 WHERE id=?', name, +input.active, id);else run('INSERT INTO ledger_accounts(id,company_id,code,name,type,purpose,active) VALUES(?,?,?,?,?,?,?)', id, company, code, name, input.type, input.purpose, +input.active);
      const r = get('SELECT * FROM ledger_accounts WHERE id=?', id);
      event('account', r, old ? 'account revised' : 'account created', input.reason);
      return {
        ...r,
        history: history('account', id)
      };
    });
  }
  function period(input) {
    return transaction(db, () => {
      access.requireCap('ledger.manage', input.company_id);
      const start = day(input.start_date),
        end = day(input.end_date);
      requireThat(start <= end, 'Period end must not precede its start.');
      requireThat(!get('SELECT id FROM ledger_periods WHERE company_id=? AND start_date<=? AND end_date>=?', input.company_id, end, start), 'Accounting periods cannot overlap.');
      const id = uid('PER');
      run("INSERT INTO ledger_periods(id,company_id,name,start_date,end_date,state) VALUES(?,?,?,?,?,'open')", id, input.company_id, txt(input.name, 'Period name', 80), start, end);
      const r = get('SELECT * FROM ledger_periods WHERE id=?', id);
      event('period', r, 'period opened', input.reason);
      return r;
    });
  }
  function periodDecision(id, input) {
    return transaction(db, () => {
      const r = get('SELECT * FROM ledger_periods WHERE id=?', id);
      requireThat(r, 'Period is unavailable.', 404);
      access.requireCap('ledger.manage', r.company_id);
      version(r, input.version);
      requireThat(['close', 'reopen'].includes(input.action), 'Choose close or reopen.');
      if (input.action === 'close') {
        requireThat(r.state === 'open', 'Period is already closed.');
        requireThat(!get("SELECT id FROM ledger_entries WHERE company_id=? AND state='submitted' AND accounting_date BETWEEN ? AND ?", r.company_id, r.start_date, r.end_date), 'Return or post submitted journals before closing this period.');
        run("UPDATE ledger_periods SET state='closed',closed_by=?,closed_at=?,version=version+1 WHERE id=?", actorId, now(), id);
      } else {
        requireThat(r.state === 'closed', 'Period is already open.');
        requireThat(r.closed_by !== actorId, 'Another controller must independently reopen a closed period.', 403);
        run("UPDATE ledger_periods SET state='open',version=version+1 WHERE id=?", id);
      }
      const next = get('SELECT * FROM ledger_periods WHERE id=?', id);
      event('period', next, input.action === 'close' ? 'period closed' : 'period reopened', input.reason);
      return {
        ...next,
        history: history('period', id)
      };
    });
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        r = old || {
          company_id: input.company_id,
          project_id: input.project_id || null
        };
      access.requireCap('ledger.write', r.company_id, r.project_id);
      requireScope(r.company_id, r.project_id);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the author can edit a draft or returned journal.', 403);
        requireThat(!old.reversal_of, 'Reversal amounts are frozen. Cancel and prepare a new reversal.');
      }
      const company = get('SELECT * FROM companies WHERE id=?', r.company_id),
        date = day(input.accounting_date);
      requireThat(date <= today(), 'Future accounting dates are not posted in this local ledger.');
      requireThat(['AED', 'USD', 'EUR'].includes(input.currency), 'Unsupported transaction currency.');
      const rate = decimal(input.rate, 'Accounting exchange rate', false).toString(),
        rate_date = day(input.rate_date);
      requireThat(rate_date <= date, 'Rate date cannot follow accounting date.');
      requireThat(input.currency !== company.currency || new D(rate).cmp(1) === 0, 'Functional-currency journals use rate 1.');
      const converted = convertJournal(input.lines, rate);
      converted.lines = converted.lines.map(l => {
        const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', l.account_id, r.company_id);
        requireThat(a, 'Account is not available.');
        return {
          ...l,
          account_version: a.version,
          account_code: a.code,
          account_name: a.name,
          account_type: a.type
        };
      });
      const next = {
        ...r,
        id: id || uid('JRN'),
        title: txt(input.title, 'Journal title', 160),
        accounting_date: date,
        currency: input.currency,
        rate,
        rate_date,
        rate_source: txt(input.rate_source, 'Rate source', 200),
        source_reference: txt(input.source_reference, 'Supporting source reference', 300),
        explanation: txt(input.explanation, 'Explanation', 2000),
        lines_json: JSON.stringify(converted.lines),
        total: converted.total,
        company_total: converted.company_total
      };
      validateAccounts(next);
      periodFor(next);
      if (old) run("UPDATE ledger_entries SET title=?,accounting_date=?,currency=?,rate=?,rate_date=?,rate_source=?,source_reference=?,explanation=?,lines_json=?,total=?,company_total=?,state='draft',version=version+1 WHERE id=?", ...[next.title, date, next.currency, rate, rate_date, next.rate_source, next.source_reference, next.explanation, next.lines_json, next.total, next.company_total, next.id]);else run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)", next.id, r.company_id, r.project_id, next.title, date, next.currency, rate, rate_date, next.rate_source, next.source_reference, next.explanation, next.lines_json, next.total, next.company_total, actorId, now());
      event('journal', row(next.id), old ? 'draft revised' : 'draft created', input.reason || next.explanation);
      return detail(next.id);
    });
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      const reason = txt(input.reason, 'Decision reason', 2000);
      const author = r.author_id === actorId && can('ledger.write', r);
      if (input.action === 'submit') {
        requireThat(author && ['draft', 'returned'].includes(r.state), 'Only the author can submit a draft.', 403);
        periodFor(r);
        validateAccounts(r);
        run("UPDATE ledger_entries SET state='submitted',version=version+1 WHERE id=?", id);
      } else if (input.action === 'withdraw') {
        requireThat(author && r.state === 'submitted', 'Only the author can withdraw a submitted journal.', 403);
        run("UPDATE ledger_entries SET state='draft',version=version+1 WHERE id=?", id);
      } else if (input.action === 'return') {
        requireThat(r.state === 'submitted' && can('ledger.post', r) && independent(r), 'An independent journal reviewer must return this submission.', 403);
        run("UPDATE ledger_entries SET state='returned',version=version+1 WHERE id=?", id);
      } else if (input.action === 'cancel') {
        requireThat(author && ['draft', 'returned'].includes(r.state), 'Only an unsubmitted journal can be cancelled by its author.', 403);
        run("UPDATE ledger_entries SET state='cancelled',version=version+1 WHERE id=?", id);
      } else if (input.action === 'post') {
        requireThat(r.state === 'submitted' && review(r), 'Posting needs an independent reviewer with sufficient separate journal authority.', 403);
        const p = periodFor(r);
        validateAccounts(r);
        const lines = linesFor(r);
        requireThat(sum(lines.map(l => l.debit)).cmp(sum(lines.map(l => l.credit))) === 0 && sum(lines.map(l => l.base_debit)).cmp(sum(lines.map(l => l.base_credit))) === 0, 'Journal is not balanced.');
        if (r.reversal_of) {
          const original = row(r.reversal_of);
          requireThat(original.state === 'posted' && !original.reversal_of && r.accounting_date >= original.accounting_date, 'Reversal source or date is invalid.');
        }
        const year = r.accounting_date.slice(0, 4);
        run('INSERT OR IGNORE INTO ledger_sequences(company_id,year,next_number) VALUES(?,?,1)', r.company_id, year);
        const sequence = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
        run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
        const number = `GL/${year}/${String(sequence).padStart(6, '0')}`;
        lines.forEach((l, i) => {
          const a = get('SELECT * FROM ledger_accounts WHERE id=?', l.account_id);
          run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, r.project_id, a.id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment);
        });
        run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", number, p.id, actorId, now(), id);
      } else requireThat(false, 'Unknown journal decision.');
      event('journal', row(id), input.action, reason);
      return detail(id);
    });
  }
  function reverse(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      access.requireCap('ledger.write', r.company_id, r.project_id);
      requireThat(r.state === 'posted' && !r.reversal_of, 'Only an original posted journal can be reversed.');
      requireThat(!get("SELECT id FROM ledger_entries WHERE reversal_of=? AND state<>'cancelled'", id), 'A reversal already exists. Open that record.', 409);
      const accounting_date = day(input.accounting_date);
      requireThat(accounting_date >= r.accounting_date && accounting_date <= today(), 'Reversal date must be on or after the original, and not in the future.');
      periodFor({
        ...r,
        accounting_date
      });
      const reason = txt(input.reason, 'Reversal reason', 2000),
        lines = all('SELECT * FROM ledger_lines WHERE entry_id=? ORDER BY ordinal', id).map(l => ({
          account_id: l.account_id,
          account_version: get('SELECT version FROM ledger_accounts WHERE id=?', l.account_id).version,
          account_code: l.account_code,
          account_name: l.account_name,
          account_type: l.account_type,
          description: `Reversal: ${l.description}`.slice(0, 300),
          debit: l.credit,
          credit: l.debit,
          base_debit: l.base_credit,
          base_credit: l.base_debit,
          rounding_adjustment: l.rounding_adjustment
        }));
      const next = uid('JRN');
      run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,reversal_of,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)", next, r.company_id, r.project_id, `Reversal · ${r.number}`, accounting_date, r.currency, r.rate, r.rate_date, r.rate_source, r.number, reason, JSON.stringify(lines), r.total, r.company_total, actorId, id, now());
      event('journal', row(next), 'reversal prepared', reason);
      return detail(next);
    });
  }
  function report(company, {
    project = null,
    from = '0001-01-01',
    to = today(),
    account = null
  } = {}) {
    requireScope(company, project);
    day(from);
    day(to);
    requireThat(from <= to, 'Report start must not follow its end.');
    if (account) requireThat(get('SELECT id FROM ledger_accounts WHERE id=? AND company_id=?', account, company), 'Account is not available.', 404);
    const population = all("SELECT l.*,e.number,e.title,e.accounting_date,e.currency,e.rate,e.rate_date,e.rate_source,e.source_reference,e.reversal_of,e.posted_at FROM ledger_lines l JOIN ledger_entries e ON e.id=l.entry_id WHERE e.company_id=? AND e.state='posted' AND e.accounting_date<=? ORDER BY e.accounting_date,e.number,l.ordinal", company, to).filter(r => (!project || r.project_id === project) && (!account || r.account_id === account) && can('finance.read', r));
    const rows = population.filter(r => r.accounting_date >= from),
      opening = population.filter(r => r.accounting_date < from),
      accounts = all('SELECT * FROM ledger_accounts WHERE company_id=? ORDER BY code', company).filter(a => (!account || a.id === account) && population.some(l => l.account_id === a.id));
    const net = rs => money(sum(rs.map(l => new D(l.base_debit).minus(l.base_credit))));
    const trial = accounts.map(a => {
      const allLines = population.filter(l => l.account_id === a.id),
        movement = allLines.filter(l => l.accounting_date >= from);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        opening: net(allLines.filter(l => l.accounting_date < from)),
        debit: money(sum(movement.map(l => l.base_debit))),
        credit: money(sum(movement.map(l => l.base_credit))),
        closing: net(allLines)
      };
    });
    const totals = {
      opening: net(opening),
      debit: money(sum(rows.map(l => l.base_debit))),
      credit: money(sum(rows.map(l => l.base_credit))),
      closing: net(population)
    };
    const pending = list(company, project).filter(r => r.state === 'submitted' && r.accounting_date >= from && r.accounting_date <= to && (!account || linesFor(row(r.id)).some(l => l.account_id === account))),
      entryIds = [...new Set(rows.map(l => l.entry_id))],
      reversalIds = [...new Set(rows.filter(l => l.reversal_of).map(l => l.entry_id))],
      restricted = !project && !access.has('finance.read', company);
    const findings = [{
      title: 'Posted population',
      text: `Posted journals: ${entryIds.length}. Lines: ${rows.length}. Accounts: ${trial.length}. Scope: ${project ? get('SELECT name FROM projects WHERE id=?', project).name : 'authorised company records'}.`,
      source_ids: entryIds
    }, {
      title: account ? 'Account movement' : 'Debit and credit check',
      text: `Opening net ${totals.opening}; debits ${totals.debit}; credits ${totals.credit}; closing net ${totals.closing} ${get('SELECT currency FROM companies WHERE id=?', company).currency}. ${account ? 'An individual account is not expected to balance to zero.' : 'The net must be zero for this complete scoped journal population.'}`,
      source_ids: entryIds
    }, {
      title: 'Awaiting posting',
      text: `${pending.length} submitted journals are excluded from posted balances.`,
      source_ids: pending.map(r => r.id)
    }, {
      title: 'Reversals',
      text: `${reversalIds.length} posted reversals in this range; originals remain in their original periods.`,
      source_ids: reversalIds
    }];
    return {
      scope: {
        company: get('SELECT id,name,currency FROM companies WHERE id=?', company),
        project: project ? get('SELECT id,name FROM projects WHERE id=?', project) : null,
        from,
        to,
        account,
        restricted,
        generated_at: now(),
        basis: 'Accounting date; current posted facts, including later postings to earlier open periods.'
      },
      findings,
      totals,
      trial,
      rows,
      limitations: ['Only this original local general ledger is included. No imported opening balances, tax return, AP/AR, bank reconciliation or operational-cost double counting.', project ? 'Selected project only; company-unallocated and other project journals are excluded.' : restricted ? 'Limited authorised project scope; this is not the full legal-company trial balance.' : 'Company scope includes company-unallocated and authorised project journals.', 'Accounting dates are explicit; operational today uses UTC. Signed net balances are debit positive, credit negative.']
    };
  }
  return {
    options,
    account,
    period,
    periodDecision,
    save,
    decide,
    reverse,
    detail,
    list,
    report
  };
}
