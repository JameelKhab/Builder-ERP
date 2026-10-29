import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { snapshot, quantityFor, quotePrice } from './master-rules.mjs';
import { convertJournal, LEDGER_STATES } from './ledger.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const counted = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const text = (v, label, max = 1000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${label} is required (maximum ${max} characters).`);
  return v.trim();
};
const date = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
// Round the exact ratio once to cents; also used to exhaust a credit's remaining cents.
export function payableRatio(quantity, price, basis = '1') {
  const n = new D(quantity).scaled * new D(price).scaled * 100n,
    d = new D(basis).scaled * 10n ** 12n;
  requireThat(n >= 0n && d > 0n, 'Invalid positive price ratio.');
  const c = n / d + (n % d * 2n >= d ? 1n : 0n);
  return `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;
}
export function payables(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(cap, r.company_id, r.project_id);
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && v === r.version, 'This payable record changed. Reload before continuing.', 409);
  const scope = (company, project = null) => {
    requireThat(get('SELECT id FROM companies WHERE id=?', company) && access.has('ap.read', company, project, !project), 'Supplier accounting scope is unavailable.', 404);
    if (project) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is unavailable.', 404);
  };
  const row = id => {
    const r = get('SELECT * FROM payable_documents WHERE id=?', id);
    requireThat(r && can('ap.read', r), 'Supplier bill or credit is unavailable.', 404);
    return r;
  };
  const limit = r => access.matching(r.company_id, r.project_id).filter(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('ap.post')).reduce((n, g) => new D(g.ap_approval_limit || '0').gt(n) ? money(g.ap_approval_limit) : n, '0.00');
  const review = r => can('ap.post', r) && r.author_id !== actorId && new D(limit(r)).gt(0) && new D(limit(r)).gte(r.company_total);
  const event = (type, r, action, reason) => run('INSERT INTO payable_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', type, r.id || r.company_id, r.company_id, r.project_id || null, actorId, action, text(reason, 'Reason', 2000), JSON.stringify(r), now());
  const history = (type, id) => all('SELECT e.*,u.name actor FROM payable_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id', type, id).map(e => ({
    ...e,
    snapshot: JSON.parse(e.snapshot)
  }));
  const account = (id, company, correction = false) => {
    const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, company);
    requireThat(a && (a.active || correction), 'Choose an active account in this company.');
    return a;
  };
  const accountSnapshot = a => ({
    account_id: a.id,
    account_version: a.version,
    account_code: a.code,
    account_name: a.name,
    account_type: a.type
  });
  const postedLines = (receipt, to = '9999-12-31') => all("SELECT l.*,d.kind,d.accounting_date,d.id source_id FROM payable_lines l JOIN payable_documents d ON d.id=l.document_id WHERE l.receipt_id=? AND d.state='posted' AND d.accounting_date<=?", receipt, to);
  const netBilled = (receipt, to) => sum(postedLines(receipt, to).map(l => l.kind === 'bill' ? l.quantity : new D(0).minus(l.quantity)));
  function receipt(id, to = '9999-12-31') {
    const r = get('SELECT r.*,o.currency,o.vendor_id,o.state order_state,ol.request_line_id,ol.unit_price,ol.rate,ol.quantity ordered,a.quote_id,rl.product_id,rl.work_package_id,rl.location_id FROM material_receipts r JOIN purchase_orders o ON o.id=r.order_id JOIN purchase_order_lines ol ON ol.id=r.order_line_id JOIN sourcing_allocations a ON a.id=ol.allocation_id JOIN material_request_lines rl ON rl.id=ol.request_line_id WHERE r.id=?', id);
    requireThat(r && can('ap.read', r), 'Accepted receipt is unavailable.', 404);
    const returned = sum(all("SELECT quantity FROM stock_movements WHERE receipt_id=? AND kind='return' AND substr(at,1,10)<=?", id, to).map(m => m.quantity));
    const net = new D(r.accepted).minus(returned),
      billed = netBilled(id, to),
      master = snapshot(db, 'line', r.request_line_id);
    return {
      ...r,
      ...master,
      id: r.id,
      returned: returned.toString(),
      net_accepted: net.toString(),
      net_billed: billed.toString(),
      available: Dmax(net.minus(billed), 0).toString(),
      credit_needed: Dmax(billed.minus(net), 0).toString(),
      pack: get('SELECT * FROM quote_pack_details WHERE quote_id=?', r.quote_id) || null,
      work_package: get('SELECT name FROM work_packages WHERE id=?', r.work_package_id)?.name,
      location: get('SELECT name FROM project_locations WHERE id=?', r.location_id)?.name
    };
  }
  function sources(company, project = null) {
    scope(company, project);
    return all('SELECT * FROM purchase_orders WHERE company_id=? ORDER BY issued_at DESC', company).filter(o => (!project || o.project_id === project) && can('ap.read', o)).map(o => ({
      ...o,
      ...snapshot(db, 'order', o.id),
      receipts: all('SELECT id FROM material_receipts WHERE order_id=?', o.id).map(r => receipt(r.id)).filter(r => new D(r.accepted).gt(0))
    })).filter(o => o.receipts.length);
  }
  function settings(company, input) {
    return transaction(db, () => {
      access.requireCap('ap.manage', company);
      const old = get('SELECT * FROM payable_settings WHERE company_id=?', company);
      if (old) version(old, input.version);
      const a = account(input.account_id, company);
      requireThat(a.type === 'liability' && a.purpose === 'payable', 'AP control must be a payable liability account.');
      if (old) run('UPDATE payable_settings SET account_id=?,version=version+1 WHERE company_id=?', a.id, company);else run('INSERT INTO payable_settings(company_id,account_id) VALUES(?,?)', company, a.id);
      const r = get('SELECT * FROM payable_settings WHERE company_id=?', company);
      event('settings', r, 'AP control selected', input.reason);
      return r;
    });
  }
  function tax(id, input) {
    return transaction(db, () => {
      const old = id ? get('SELECT * FROM payable_tax_codes WHERE id=?', id) : null;
      requireThat(!id || old, 'Tax code is unavailable.', 404);
      const company = old?.company_id || input.company_id;
      access.requireCap('ap.manage', company);
      if (old) version(old, input.version);
      requireThat(typeof input.active === 'boolean', 'Choose tax-code availability.');
      if (old) {
        run('UPDATE payable_tax_codes SET name=?,active=?,version=version+1 WHERE id=?', text(input.name, 'Tax name', 120), +input.active, id);
      } else {
        const rate = decimal(input.rate, 'Tax percentage').toString(),
          recoverable = decimal(input.recoverable, 'Recoverable percentage').toString();
        requireThat(new D(rate).lte(100) && new D(recoverable).lte(100), 'Percentages must be between 0 and 100.');
        const start = date(input.effective_from),
          end = input.effective_until ? date(input.effective_until) : null;
        requireThat(!end || end >= start, 'Tax effective dates are reversed.');
        const a = input.account_id ? account(input.account_id, company) : null;
        requireThat(!new D(rate).times(recoverable).gt(0) || a?.type === 'asset' && a.purpose === 'tax', 'Recoverable tax needs a tax asset account.');
        const code = text(input.code, 'Tax code', 25).toUpperCase();
        requireThat(/^[A-Z0-9.-]+$/.test(code) && !get('SELECT id FROM payable_tax_codes WHERE company_id=? AND code=?', company, code), 'Tax code must be unique letters/numbers/dots/hyphens.');
        id = uid('TAX');
        run('INSERT INTO payable_tax_codes(id,company_id,code,name,rate,recoverable,account_id,effective_from,effective_until,active) VALUES(?,?,?,?,?,?,?,?,?,?)', id, company, code, text(input.name, 'Tax name', 120), rate, recoverable, a?.id || null, start, end, +input.active);
      }
      const r = get('SELECT * FROM payable_tax_codes WHERE id=?', id);
      event('tax', r, old ? 'tax availability revised' : 'tax code created', input.reason);
      return r;
    });
  }
  function options(company, project = null) {
    scope(company, project);
    return {
      company: get('SELECT id,name,currency FROM companies WHERE id=?', company),
      actor_id: actorId,
      today: today(),
      projects: all('SELECT id,name FROM projects WHERE company_id=?', company).filter(p => access.has('ap.read', company, p.id)),
      can_write: access.has('ap.write', company, project, !project),
      can_manage: access.has('ap.manage', company),
      settings: get('SELECT * FROM payable_settings WHERE company_id=?', company) || null,
      accounts: all("SELECT * FROM ledger_accounts WHERE company_id=? AND ((purpose='general' AND type IN ('asset','expense')) OR purpose IN ('payable','tax')) ORDER BY code", company),
      taxes: all('SELECT * FROM payable_tax_codes WHERE company_id=? ORDER BY code', company),
      configuration_history: access.has('ap.manage', company) ? all("SELECT e.*,u.name actor FROM payable_events e JOIN users u ON e.actor_id=u.id WHERE company_id=? AND entity_type IN ('settings','tax') ORDER BY e.id DESC", company) : []
    };
  }
  const currentTax = (id, company, day) => {
    const t = get('SELECT * FROM payable_tax_codes WHERE id=? AND company_id=?', id, company);
    requireThat(t && t.active && t.effective_from <= day && (!t.effective_until || t.effective_until >= day), 'Select a tax code effective on the supplier document date.');
    return t;
  };
  const checkCapacity = (r, lines) => {
    for (const l of lines) {
      const lot = receipt(l.receipt_id);
      requireThat(lot.order_id === r.order_id, 'Receipt does not belong to this supplier order.');
      requireThat(r.accounting_date >= lot.received_at.slice(0, 10), 'Accounting date cannot precede the accepted receipt.');
      if (r.kind === 'bill') requireThat(new D(l.quantity).lte(lot.available), 'Bill quantity exceeds net accepted, unbilled receipt quantity. Return or revise this bill.', 409);else {
        const original = get('SELECT * FROM payable_lines WHERE id=?', l.original_line_id);
        const used = sum(all("SELECT l.quantity FROM payable_lines l JOIN payable_documents d ON d.id=l.document_id WHERE l.original_line_id=? AND d.state='posted'", original.id).map(x => x.quantity));
        requireThat(new D(l.quantity).lte(lot.credit_needed) && new D(l.quantity).lte(new D(original.quantity).minus(used)), 'Credit exceeds returned overbilled quantity or the original bill remainder.', 409);
        const latestReturn = get("SELECT MAX(substr(at,1,10)) day FROM stock_movements WHERE receipt_id=? AND kind='return'", l.receipt_id)?.day;
        requireThat(latestReturn && r.accounting_date >= latestReturn, 'Credit accounting date must include the supporting return date.');
      }
    }
  };
  function billLines(r, inputs) {
    const config = get('SELECT * FROM payable_settings WHERE company_id=?', r.company_id);
    requireThat(config, 'Configure the company AP control account first.');
    const control = account(config.account_id, r.company_id);
    requireThat(control.purpose === 'payable' && control.type === 'liability', 'AP account is invalid.');
    const lines = inputs.map((l, i) => {
      const s = receipt(l.receipt_id);
      requireThat(s.order_id === r.order_id, 'Receipt belongs to another order.');
      const q = quantityFor(l.quantity, s.precision ?? 6),
        unit = decimal(l.unit_price, 'Invoice price', false).toString(),
        basis = decimal(l.price_basis, 'Price base quantity', false).toString();
      const a = account(l.account_id, r.company_id);
      requireThat(a.purpose === 'general' && ['asset', 'expense'].includes(a.type), 'Classify each line with a general expense or asset account.');
      const t = currentTax(l.tax_id, r.company_id, r.document_date),
        net = payableRatio(q.toString(), unit, basis),
        tax = money(new D(net).times(t.rate).div(100)),
        recoverable = money(new D(tax).times(t.recoverable).div(100)),
        cost = money(new D(net).plus(tax).minus(recoverable));
      requireThat(new D(net).gt(0), 'Invoice net amount must be positive.');
      const expected = quotePrice(db, s.quote_id, q.toString(), s.unit_price, '1').amount,
        variance = money(new D(net).minus(expected));
      const variance_reason = new D(variance).isZero() ? l.variance_reason || '' : text(l.variance_reason, 'Price variance explanation', 500);
      const ta = new D(recoverable).gt(0) ? account(t.account_id, r.company_id) : null;
      return {
        id: `${r.id}-${i + 1}`,
        receipt_id: s.id,
        order_line_id: s.order_line_id,
        original_line_id: null,
        product: s.product,
        uom: s.uom,
        precision: s.precision,
        product_id: s.product_id,
        work_package_id: s.work_package_id,
        work_package: s.work_package,
        location_id: s.location_id,
        location: s.location,
        delivery_reference: s.delivery_reference,
        quantity: q.toString(),
        unit_price: unit,
        price_basis: basis,
        expected_net: expected,
        variance,
        variance_reason,
        net,
        tax,
        recoverable,
        cost,
        gross: money(new D(net).plus(tax)),
        tax_id: t.id,
        tax_snapshot: t,
        cost_account: accountSnapshot(a),
        tax_account: ta ? accountSnapshot(ta) : null
      };
    });
    const raw = [];
    for (const l of lines) {
      raw.push({
        ...l.cost_account,
        description: `${l.product} · ${l.receipt_id}`.slice(0, 300),
        debit: l.cost,
        credit: '0.00'
      });
      if (new D(l.recoverable).gt(0)) raw.push({
        ...l.tax_account,
        description: `Recoverable tax · ${l.receipt_id}`,
        debit: l.recoverable,
        credit: '0.00'
      });
    }
    const gross = money(sum(lines.map(l => l.gross)));
    raw.push({
      ...accountSnapshot(control),
      description: `Supplier payable · ${r.reference}`.slice(0, 300),
      debit: '0.00',
      credit: gross
    });
    const converted = convertJournal(raw, r.rate);
    converted.lines = converted.lines.map((l, i) => ({
      ...raw[i],
      ...l
    }));
    let j = 0;
    for (const l of lines) {
      l.base_cost = converted.lines[j++].base_debit;
      l.base_recoverable = new D(l.recoverable).gt(0) ? converted.lines[j++].base_debit : '0.00';
      l.base_gross = money(new D(l.base_cost).plus(l.base_recoverable));
    }
    return {
      lines,
      journal: converted.lines,
      total: converted.total,
      company_total: converted.company_total,
      control: {
        ...accountSnapshot(control),
        settings_version: config.version
      }
    };
  }
  function creditLines(r, inputs) {
    const original = row(r.original_id);
    requireThat(original.kind === 'bill' && original.state === 'posted', 'Choose an original posted supplier bill.');
    requireThat(r.accounting_date >= original.accounting_date, 'Credit accounting date cannot precede its bill.');
    const source = JSON.parse(original.source_json);
    const lines = inputs.map((input, i) => {
      const originalLine = get('SELECT * FROM payable_lines WHERE id=? AND document_id=?', input.original_line_id, original.id);
      requireThat(originalLine, 'Original bill line is unavailable.');
      const l = JSON.parse(originalLine.payload),
        q = quantityFor(input.quantity, l.precision ?? 6);
      const used = all("SELECT l.* FROM payable_lines l JOIN payable_documents d ON d.id=l.document_id WHERE l.original_line_id=? AND d.state='posted'", originalLine.id).map(x => ({
        ...JSON.parse(x.payload),
        quantity: x.quantity
      }));
      const remaining = new D(l.quantity).minus(sum(used.map(x => x.quantity)));
      requireThat(remaining.gt(0) && q.lte(remaining), 'Credit quantity exceeds the original bill remainder.');
      const next = {
        ...l,
        id: `${r.id}-${i + 1}`,
        original_line_id: originalLine.id,
        quantity: q.toString()
      };
      for (const key of ['net', 'tax', 'recoverable', 'base_cost', 'base_recoverable']) {
        const rest = new D(l[key]).minus(sum(used.map(x => x[key])));
        next[key] = payableRatio(q.toString(), rest.toString(), remaining.toString());
      }
      // Allocate nonrecoverable and recoverable components independently, preserving total tax/net.
      next.cost = money(new D(next.net).plus(next.tax).minus(next.recoverable));
      next.gross = money(new D(next.net).plus(next.tax));
      next.base_gross = money(new D(next.base_cost).plus(next.base_recoverable));
      requireThat(new D(next.cost).gte(0) && new D(next.gross).gt(0) && new D(next.base_gross).gt(0), 'Credit is too small for the supported currency precision. Combine quantities.');
      next.cost_account = {
        ...l.cost_account,
        account_version: account(l.cost_account.account_id, r.company_id, true).version
      };
      if (l.tax_account) next.tax_account = {
        ...l.tax_account,
        account_version: account(l.tax_account.account_id, r.company_id, true).version
      };
      return next;
    });
    const control = {
      ...source.control,
      account_version: account(source.control.account_id, r.company_id, true).version
    };
    const total = money(sum(lines.map(l => l.gross))),
      company_total = money(sum(lines.map(l => l.base_gross)));
    const journal = [];
    for (const l of lines) {
      for (const [amount, base, a, label] of [[l.cost, l.base_cost, l.cost_account, 'Cost correction'], [l.recoverable, l.base_recoverable, l.tax_account, 'Tax correction']]) {
        if (new D(amount).gt(0) || new D(base).gt(0)) journal.push({
          ...a,
          description: `${label} · ${l.receipt_id}`,
          debit: '0.00',
          credit: amount,
          base_debit: '0.00',
          base_credit: base,
          rounding_adjustment: money(new D(base).minus(new D(amount).times(r.rate)))
        });
      }
    }
    journal.push({
      ...control,
      description: `Supplier credit · ${r.reference}`.slice(0, 300),
      debit: total,
      credit: '0.00',
      base_debit: company_total,
      base_credit: '0.00',
      rounding_adjustment: money(new D(company_total).minus(new D(total).times(r.rate)))
    });
    return {
      lines,
      journal,
      total,
      company_total,
      control
    };
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null;
      const order = get('SELECT * FROM purchase_orders WHERE id=?', old?.order_id || input.order_id);
      requireThat(order && can('ap.write', order), 'Supplier order is unavailable for bill preparation.', 404);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the author may revise an unsubmitted bill or credit.', 403);
      }
      const kind = old?.kind || input.kind;
      requireThat(['bill', 'credit'].includes(kind), 'Choose a bill or return credit.');
      const original = kind === 'credit' ? row(old?.original_id || input.original_id) : null;
      requireThat(!original || original.order_id === order.id && original.kind === 'bill' && original.state === 'posted', 'Credit must use its original posted bill and supplier order.');
      const docDate = date(input.document_date),
        acctDate = date(input.accounting_date),
        due = kind === 'bill' ? date(input.due_date) : docDate;
      requireThat(acctDate >= docDate && acctDate <= today() && due >= docDate, 'Check supplier, accounting and due dates; future accounting is unavailable.');
      const company = get('SELECT * FROM companies WHERE id=?', order.company_id),
        rate = original?.rate || decimal(input.rate, 'Accounting rate', false).toString(),
        rate_date = original?.rate_date || date(input.rate_date);
      requireThat(rate_date <= acctDate && (order.currency !== company.currency || new D(rate).cmp(1) === 0), 'Check FX date and rate; functional currency uses 1.');
      const reference = text(input.reference, 'Supplier reference', 120),
        reference_key = reference.normalize('NFKC').replace(/\s+/g, ' ').toUpperCase();
      requireThat(!all("SELECT id FROM payable_documents WHERE company_id=? AND vendor_id=? AND kind=? AND reference_key=? AND state<>'cancelled'", order.company_id, order.vendor_id, kind, reference_key).some(d => d.id !== id), 'This supplier reference already exists for this company and document kind.', 409);
      requireThat(Array.isArray(input.lines) && input.lines.length > 0 && input.lines.length <= 20, 'Use 1 to 20 receipt lines.');
      const r = {
        id: id || uid('AP'),
        company_id: order.company_id,
        project_id: order.project_id,
        order_id: order.id,
        vendor_id: order.vendor_id,
        kind,
        original_id: original?.id || null,
        reference,
        reference_key,
        title: text(input.title, 'Document title', 160),
        document_date: docDate,
        accounting_date: acctDate,
        due_date: due,
        currency: order.currency,
        rate,
        rate_date,
        rate_source: original?.rate_source || text(input.rate_source, 'Rate source', 200),
        explanation: text(input.explanation, 'Supporting explanation', 2000)
      };
      const prepared = kind === 'bill' ? billLines(r, input.lines) : creditLines(r, input.lines);
      requireThat(new Set(prepared.lines.map(l => l.receipt_id)).size === prepared.lines.length, 'Use each receipt only once per document.');
      checkCapacity(r, prepared.lines);
      const source = {
        order: snapshot(db, 'order', order.id),
        control: prepared.control
      };
      const fields = {
        ...r,
        source_json: JSON.stringify(source),
        lines_json: JSON.stringify(prepared.lines),
        journal_json: JSON.stringify(prepared.journal),
        total: prepared.total,
        company_total: prepared.company_total
      };
      if (old) {
        const keys = ['reference', 'reference_key', 'title', 'document_date', 'accounting_date', 'due_date', 'rate', 'rate_date', 'rate_source', 'explanation', 'source_json', 'lines_json', 'journal_json', 'total', 'company_total'];
        run(`UPDATE payable_documents SET ${keys.map(k => k + '=?').join(',')},state='draft',version=version+1 WHERE id=?`, ...keys.map(k => fields[k]), id);
      } else {
        Object.assign(fields, {
          author_id: actorId,
          state: 'draft',
          created_at: now()
        });
        const keys = Object.keys(fields);
        run(`INSERT INTO payable_documents(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => fields[k]));
      }
      event('document', row(r.id), old ? 'draft revised' : 'draft created', r.explanation);
      return detail(r.id);
    });
  }
  function validate(r) {
    const lines = JSON.parse(r.lines_json),
      journal = JSON.parse(r.journal_json);
    checkCapacity(r, lines);
    requireThat(r.accounting_date <= today(), 'Accounting date is in the future.');
    for (const l of journal) {
      const a = account(l.account_id, r.company_id, r.kind === 'credit');
      requireThat(a.version === l.account_version, 'An account changed after preparation. Return and revise the document.', 409);
    }
    if (r.kind === 'bill') {
      const s = JSON.parse(r.source_json),
        config = get('SELECT * FROM payable_settings WHERE company_id=?', r.company_id);
      requireThat(config?.version === s.control.settings_version && config.account_id === s.control.account_id, 'AP control changed. Return and revise the bill.', 409);
      for (const l of lines) requireThat(currentTax(l.tax_id, r.company_id, r.document_date).version === l.tax_snapshot.version, 'Tax code changed. Return and revise the bill.', 409);
    } else {
      const fresh = creditLines(r, lines);
      requireThat(JSON.stringify(fresh.lines) === JSON.stringify(lines), 'Another credit or account change altered the remaining values. Return and revise this credit.', 409);
    }
    requireThat(sum(journal.map(l => l.debit)).cmp(sum(journal.map(l => l.credit))) === 0 && sum(journal.map(l => l.base_debit)).cmp(sum(journal.map(l => l.base_credit))) === 0, 'Payable journal must balance in both currencies.');
    return {
      lines,
      journal
    };
  }
  // Private typed posting path. No HTTP caller can supply a journal or override its source amounts.
  function post(r) {
    const {
        lines,
        journal
      } = validate(r),
      period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.accounting_date, r.accounting_date);
    requireThat(period, 'The accounting date needs an open company period.');
    const id = uid('JRN'),
      year = r.accounting_date.slice(0, 4);
    run('INSERT OR IGNORE INTO ledger_sequences(company_id,year,next_number) VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    const number = `GL/${year}/${String(n).padStart(6, '0')}`;
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,'payable',?)", id, r.company_id, r.project_id, r.title, r.accounting_date, r.currency, r.rate, r.rate_date, r.rate_source, r.reference, r.explanation, r.journal_json, r.total, r.company_total, r.author_id, now(), r.id);
    journal.forEach((l, i) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, r.project_id, l.account_id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", number, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'supplier document posted', `Typed supplier ${r.kind} ${r.id}; independent AP authority`, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    for (const l of lines) run('INSERT INTO payable_lines(id,document_id,receipt_id,original_line_id,quantity,payload) VALUES(?,?,?,?,?,?)', l.id, r.id, l.receipt_id, l.original_line_id, l.quantity, JSON.stringify(l));
    run("UPDATE payable_documents SET state='posted',journal_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", id, actorId, now(), r.id);
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      const reason = text(input.reason, 'Decision reason', 2000),
        author = can('ap.write', r) && r.author_id === actorId;
      if (input.action === 'post') {
        requireThat(r.state === 'submitted' && review(r), 'Posting requires independent AP authority covering this functional-currency amount.', 403);
        post(r);
      } else {
        let state;
        if (input.action === 'submit') {
          requireThat(author && ['draft', 'returned'].includes(r.state), 'Only the author can submit this draft.', 403);
          validate(r);
          state = 'submitted';
        } else if (input.action === 'return') {
          requireThat(r.state === 'submitted' && can('ap.post', r) && r.author_id !== actorId, 'An independent AP reviewer must return a submitted document.', 403);
          state = 'returned';
        } else if (input.action === 'withdraw') {
          requireThat(author && r.state === 'submitted', 'Only the author can withdraw a submitted document.', 403);
          state = 'draft';
        } else if (input.action === 'cancel') {
          requireThat(author && ['draft', 'returned'].includes(r.state), 'Only the author can cancel an unsubmitted document.', 403);
          state = 'cancelled';
        } else requireThat(false, 'Unknown payable decision.');
        run('UPDATE payable_documents SET state=?,version=version+1 WHERE id=?', state, id);
      }
      event('document', row(id), input.action, reason);
      return detail(id);
    });
  }
  function detail(id) {
    const r = row(id);
    return {
      ...r,
      lines_json: undefined,
      journal_json: undefined,
      source_json: undefined,
      lines: JSON.parse(r.lines_json),
      journal: JSON.parse(r.journal_json),
      source: JSON.parse(r.source_json),
      company_currency: get('SELECT currency FROM companies WHERE id=?', r.company_id).currency,
      state_label: LEDGER_STATES[r.state],
      author: get('SELECT name FROM users WHERE id=?', r.author_id).name,
      poster: r.posted_by ? get('SELECT name FROM users WHERE id=?', r.posted_by).name : null,
      project: get('SELECT name FROM projects WHERE id=?', r.project_id).name,
      can_write: can('ap.write', r) && r.author_id === actorId,
      can_credit: can('ap.write', r) && r.kind === 'bill' && r.state === 'posted',
      can_review: review(r),
      can_return: can('ap.post', r) && r.author_id !== actorId,
      posting_limit: can('ap.post', r) ? limit(r) : '0.00',
      can_open_ledger: can('finance.read', r),
      can_open_order: can('requests.read', r) || can('materials.read', r),
      journal_number: r.journal_id ? get('SELECT number FROM ledger_entries WHERE id=?', r.journal_id).number : null,
      credits: all('SELECT id,reference,state,total,company_total FROM payable_documents WHERE original_id=?', id),
      receipt_position: JSON.parse(r.lines_json).map(l => receipt(l.receipt_id)),
      history: history('document', id)
    };
  }
  function list(company, project = null) {
    scope(company, project);
    return all('SELECT * FROM payable_documents WHERE company_id=? ORDER BY created_at DESC,rowid DESC', company).filter(r => (!project || r.project_id === project) && can('ap.read', r)).map(r => ({
      id: r.id,
      company_id: r.company_id,
      project_id: r.project_id,
      order_id: r.order_id,
      title: r.title,
      reference: r.reference,
      kind: r.kind,
      state: r.state,
      state_label: LEDGER_STATES[r.state],
      accounting_date: r.accounting_date,
      due_date: r.due_date,
      currency: r.currency,
      total: r.total,
      company_total: r.company_total,
      author_id: r.author_id,
      version: r.version,
      vendor: JSON.parse(r.source_json).order.vendor,
      project: get('SELECT name FROM projects WHERE id=?', r.project_id).name,
      can_review: r.state === 'submitted' && review(r),
      my_draft: r.author_id === actorId && ['draft', 'returned'].includes(r.state)
    }));
  }
  function report(company, {
    project = null,
    to = today()
  } = {}) {
    scope(company, project);
    date(to);
    requireThat(to <= today(), 'Report date cannot be in the future.');
    const docs = all("SELECT * FROM payable_documents WHERE company_id=? AND state='posted' AND accounting_date<=?", company, to).filter(r => (!project || r.project_id === project) && can('ap.read', r));
    const rows = docs.filter(r => r.kind === 'bill').map(r => {
      const credits = docs.filter(c => c.original_id === r.id),
        credit = money(sum(credits.map(c => c.total))),
        base_credit = money(sum(credits.map(c => c.company_total))),
        open = money(new D(r.total).minus(credit)),
        base_open = money(new D(r.company_total).minus(base_credit));
      return {
        id: r.id,
        reference: r.reference,
        title: r.title,
        project_id: r.project_id,
        project: get('SELECT name FROM projects WHERE id=?', r.project_id).name,
        vendor: JSON.parse(r.source_json).order.vendor,
        currency: r.currency,
        accounting_date: r.accounting_date,
        due_date: r.due_date,
        original: r.total,
        credited: credit,
        open,
        base_original: r.company_total,
        base_credited: base_credit,
        base_open,
        overdue: r.due_date < to && new D(open).gt(0),
        journal_id: r.journal_id,
        credits: credits.map(c => ({
          id: c.id,
          reference: c.reference,
          total: c.total,
          company_total: c.company_total
        }))
      };
    });
    const exceptions = all('SELECT id,company_id,project_id,received_at FROM material_receipts WHERE company_id=? AND substr(received_at,1,10)<=?', company, to).filter(r => (!project || r.project_id === project) && can('ap.read', r)).map(r => receipt(r.id, to)).filter(r => new D(r.available).gt(0) || new D(r.credit_needed).gt(0));
    const controlLines = docs.flatMap(d => all("SELECT l.* FROM ledger_lines l JOIN ledger_accounts a ON a.id=l.account_id WHERE l.entry_id=? AND a.purpose='payable'", d.journal_id));
    const control = money(sum(controlLines.map(l => new D(l.base_credit).minus(l.base_debit)))),
      open = money(sum(rows.map(r => r.base_open))),
      difference = money(new D(control).minus(open)),
      pending = list(company, project).filter(r => r.state === 'submitted' && r.accounting_date <= to).length;
    return {
      company: get('SELECT id,name,currency FROM companies WHERE id=?', company),
      project_id: project,
      to,
      rows,
      exceptions,
      pending,
      totals: {
        original: money(sum(rows.map(r => r.base_original))),
        credited: money(sum(rows.map(r => r.base_credited))),
        open,
        overdue: money(sum(rows.filter(r => r.overdue).map(r => r.base_open))),
        control,
        difference
      },
      currencies: [...new Set(rows.map(r => r.currency))].map(currency => ({
        currency,
        open: money(sum(rows.filter(r => r.currency === currency).map(r => r.open)))
      })),
      findings: [`${counted(rows.length, 'posted supplier bill')}; ${counted(docs.filter(r => r.kind === 'credit').length, 'posted return credit')} through ${to}.`, `${open} ${get('SELECT currency FROM companies WHERE id=?', company).currency} remains payable before cash settlement; past-due bills: ${rows.filter(r => r.overdue).length}.`, `Unbilled accepted receipt lots: ${exceptions.filter(r => new D(r.available).gt(0)).length}. Billed returns awaiting credit: ${exceptions.filter(r => new D(r.credit_needed).gt(0)).length}.`, `Documents awaiting review: ${pending}. Linked AP control difference: ${difference}.`],
      limitations: ['Material receipt bills and quantity return credits only. Payments and settlements are not implemented here; open amounts do not claim actual cash movement.', 'Invoice classification is explicit. Automatic stock valuation/GRNI, subcontract certificates, retention, price-only credits and legal tax localisation remain open.', 'Posted bill accounting is separate from the operational cost report; it does not add the same material cost twice.', 'Receipt exceptions use operational UTC event dates; financial balances use accounting dates. Pending documents reflect the current review queue within the date filter, not historical workflow status.', project ? 'Selected project only.' : access.has('ap.read', company) ? 'All authorised company projects.' : 'Restricted to your authorised projects; this is not a full legal-company statement.']
    };
  }
  return {
    options,
    sources,
    settings,
    tax,
    save,
    decide,
    detail,
    list,
    report
  };
}
function Dmax(a, b) {
  return new D(a).gte(b) ? new D(a) : new D(b);
}
