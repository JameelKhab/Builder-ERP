import { procurement } from './procurement.mjs';
import { payables } from './payables.mjs';
import { transaction } from './db.mjs';
import { payments } from './payments.mjs';
import { D, sum, money } from './money.mjs';
import { ledger } from './ledger.mjs';
export const PAYMENT_EXAMPLES = 'payments-v1';
export function installPaymentExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(PAYMENT_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-treasury', 'Lina · example treasury preparer', 'treasury_clerk'], ['example-payment-reviewer', 'Omar · example payment controller', 'financial_controller'], ['example-bank-reviewer', 'Zara · example bank reconciler', 'bank_reconciler']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const c of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,payment_approval_limit) VALUES(?,?,'*',?,?)").run(id, c, role, role === 'financial_controller' ? '1000000' : '0');
    }
    const today = () => new Date().toISOString().slice(0, 10),
      date = today(),
      maker = payments(db, 'example-treasury', today),
      reviewer = payments(db, 'example-payment-reviewer', today),
      banker = payments(db, 'example-bank-reviewer', today),
      gl = ledger(db, 'example-payment-reviewer', today);
    const decide = (svc, p, action) => svc.decide(p.id, {
      version: p.version,
      action,
      reason: 'Fictional example · independent source and amount review'
    });
    const approve = p => decide(reviewer, decide(maker, p, 'submit'), 'approve');
    const record = (p, reference) => maker.decide(p.id, {
      version: p.version,
      action: 'record',
      reason: 'Fictional offline transaction example',
      bank_reference: reference,
      evidence: 'Synthetic bank reference only. No transfer was executed.'
    });
    for (const c of db.prepare('SELECT * FROM companies').all()) {
      const account = (code, name, type, purpose) => gl.account(null, {
        company_id: c.id,
        code,
        name: 'Example · ' + name,
        type,
        purpose,
        active: true,
        reason: 'Fictional payment accounting setup'
      });
      const b = account('1110', 'Settlement bank', 'asset', 'bank'),
        gain = account('4190', 'Settlement exchange gain', 'income', 'general'),
        loss = account('5190', 'Settlement exchange loss', 'expense', 'general');
      const bank = reviewer.bank(null, {
        company_id: c.id,
        name: 'Example · Settlement bank',
        currency: c.currency,
        account_id: b.id,
        gain_account_id: gain.id,
        loss_account_id: loss.id,
        active: true,
        reason: 'Fictional bank alias; no routing credentials'
      });
      const statementRows = [];
      for (const project of db.prepare('SELECT * FROM projects WHERE company_id=?').all(c.id)) {
        const bill = db.prepare("SELECT * FROM payable_documents WHERE company_id=? AND project_id=? AND kind='bill' AND state='posted' AND author_id='example-ap-author' ORDER BY created_at LIMIT 1").get(c.id, project.id);
        const fx = bill.currency !== c.currency;
        const input = (title, allocation, bankAmount) => ({
          company_id: c.id,
          bank_id: bank.id,
          kind: 'payment',
          title: 'Example · ' + title,
          accounting_date: date,
          bank_rate: '1',
          bank_amount: bankAmount,
          rate_date: date,
          rate_source: fx ? 'Fictional bank quote: EUR 1 = AED 4.20' : 'Functional currency; rate 1',
          explanation: 'Synthetic supplier settlement example for ' + project.name,
          allocations: [{
            bill_id: bill.id,
            amount: allocation
          }]
        });
        const cleared = record(approve(maker.save(null, input('Partial payment · bank matched', '100', fx ? '420' : '100'))), 'DEMO-CLEARED-' + project.id);
        statementRows.push({
          payment: cleared,
          match: true,
          date,
          direction: 'out',
          amount: cleared.bank_amount,
          reference: cleared.bank_reference
        });
        const pending = record(approve(maker.save(null, input('Partial payment · awaiting bank match', '25', fx ? '105' : '25'))), 'DEMO-PENDING-' + project.id);
        statementRows.push({
          payment: pending,
          match: false,
          date,
          direction: 'out',
          amount: pending.bank_amount,
          reference: pending.bank_reference
        });
        const original = record(approve(maker.save(null, input('Returned transfer · original', '10', fx ? '42' : '10'))), 'DEMO-RETURNED-' + project.id);
        const reversal = maker.reverse(original.id, {
          version: original.version,
          accounting_date: date,
          reason: 'Fictional returned transaction; prepare a separate immutable reversal'
        });
        record(approve(reversal), 'DEMO-REVERSAL-' + project.id);
        approve(maker.save(null, input('Approved plan · no cash yet', '20', fx ? '84' : '20')));
        maker.save(null, input('Draft · prepare for review', '15', fx ? '63' : '15'));
        // Separate operational chain demonstrates a refund without changing earlier sample records.
        const buyer = procurement(db, project.id === 'creek' ? 'maya' : 'sara', today),
          manager = procurement(db, 'ahmed', today);
        const work = {
          id: {
            harbour: 'WP-C-103',
            gardens: 'WP-C-201',
            creek: 'WP-C-301'
          }[project.id]
        };
        let req = buyer.createRequest({
          company_id: c.id,
          project_id: project.id,
          title: 'Example · Refund after payment',
          needed_by: '2026-11-06',
          lines: [{
            product_id: c.id + '-BLOCK',
            work_package_id: work.id,
            location_id: project.id + '-unit',
            quantity: '4',
            note: 'Separate fictional return and refund chain'
          }]
        });
        req = buyer.decide(req.id, {
          version: req.version,
          action: 'submit'
        });
        req = buyer.addQuote(req.id, {
          version: req.version,
          line_id: req.lines[0].id,
          vendor_id: bill.vendor_id,
          reference: 'Refund example ' + project.id,
          quantity: '4',
          unit_price: '10',
          rate: fx ? '4' : '1',
          rate_date: date,
          rate_source: 'Fictional purchasing quote',
          valid_until: '2026-11-06',
          lead_days: 1
        });
        req = buyer.sourcePlan(req.id, {
          version: req.version,
          allocations: [{
            quote_id: req.quotes[0].id,
            quantity: '4'
          }]
        });
        req = manager.decide(req.id, {
          version: req.version,
          action: 'approve'
        });
        let order = buyer.issueOrders(req.id, {
          version: req.version
        })[0];
        order = manager.receive(order.id, {
          version: order.version,
          command_key: 'refund-example-' + project.id,
          line_id: order.lines[0].id,
          accepted: '4',
          rejected: '0',
          delivery_reference: 'DEMO-REFUND-DN-' + project.id,
          reason: 'Four fictional accepted units'
        });
        const ap = payables(db, 'example-ap-author', today),
          apReviewer = payables(db, 'example-ap-reviewer', today),
          expense = db.prepare("SELECT id FROM ledger_accounts WHERE company_id=? AND code='5100'").get(c.id),
          tax = db.prepare("SELECT id FROM payable_tax_codes WHERE company_id=? AND code='DEMO5'").get(c.id);
        const base = {
          order_id: order.id,
          title: 'Example · Paid bill with later return',
          reference: 'DEMO-REFUND-INV-' + project.id,
          kind: 'bill',
          document_date: date,
          accounting_date: date,
          due_date: date,
          rate: fx ? '4.123456' : '1',
          rate_date: date,
          rate_source: 'Fictional accounting rate',
          explanation: 'Separate refund example; no real supplier transaction',
          lines: [{
            receipt_id: order.receipts[0].id,
            quantity: '4',
            unit_price: '10',
            price_basis: '1',
            account_id: expense.id,
            tax_id: tax.id,
            variance_reason: ''
          }]
        };
        const posted = decide(apReviewer, decide(ap, ap.save(null, base), 'submit'), 'post');
        const refundInput = {
          ...input('Paid bill before return', '42', fx ? '176.40' : '42'),
          allocations: [{
            bill_id: posted.id,
            amount: '42'
          }]
        };
        record(approve(maker.save(null, refundInput)), 'DEMO-BEFORE-REFUND-' + project.id);
        manager.moveStock(order.receipts[0].id, {
          version: order.version,
          command_key: 'refund-return-' + project.id,
          kind: 'return',
          quantity: '1',
          location_id: project.id + '-unit',
          reason: 'One fictional billed and paid unit returned'
        });
        decide(apReviewer, decide(ap, ap.save(null, {
          ...base,
          kind: 'credit',
          original_id: posted.id,
          title: 'Example · Credit after payment',
          reference: 'DEMO-REFUND-CREDIT-' + project.id,
          lines: [{
            original_line_id: posted.lines[0].id,
            quantity: '1'
          }]
        }), 'submit'), 'post');
        record(approve(maker.save(null, {
          ...refundInput,
          kind: 'refund',
          title: 'Example · Supplier refund after return',
          bank_amount: fx ? '44.10' : '10.50',
          allocations: [{
            bill_id: posted.id,
            amount: '10.50'
          }]
        })), 'DEMO-REFUND-' + project.id);
      }
      const closingText = money(new D('1000000').minus(sum(statementRows.map(r => r.amount))));
      const s = banker.statement({
        bank_id: bank.id,
        reference: 'DEMO-STATEMENT-' + c.id,
        start_date: date,
        end_date: date,
        opening: '1000000.00',
        closing: closingText,
        reason: 'Fictional statement section for independent matching',
        rows: statementRows.map(({
          payment,
          match,
          ...r
        }) => r)
      });
      for (let i = 0; i < s.rows.length; i++) if (statementRows[i].match) banker.match(s.rows[i].id, {
        version: s.rows[i].version,
        action: 'match',
        payment_ids: [statementRows[i].payment.id],
        reason: 'Fictional reference and exact bank amount reconciled'
      });
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(PAYMENT_EXAMPLES, new Date().toISOString());
  });
}
