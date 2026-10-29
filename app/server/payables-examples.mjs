import { transaction } from './db.mjs';
import { payables } from './payables.mjs';
import { ledger } from './ledger.mjs';
import { procurement } from './procurement.mjs';
export const PAYABLE_EXAMPLES = 'payables-v1';
export function installPayableExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(PAYABLE_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-ap-author', 'Nadia · example payable clerk', 'ap_clerk'], ['example-ap-reviewer', 'Tariq · example AP controller', 'financial_controller']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const company of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,ap_approval_limit) VALUES(?,?,'*',?,?)").run(id, company, role, role === 'financial_controller' ? '1000000' : '0');
    }
    const today = () => new Date().toISOString().slice(0, 10),
      day = today(),
      author = payables(db, 'example-ap-author', today),
      reviewer = payables(db, 'example-ap-reviewer', today),
      accounting = ledger(db, 'example-ap-reviewer', today);
    for (const company of ['jakh', 'build']) {
      const control = accounting.account(null, {
        company_id: company,
        code: '2101',
        name: 'Example · Trade payables',
        type: 'liability',
        purpose: 'payable',
        active: true,
        reason: 'Fictional AP control for material-bill examples.'
      });
      const taxAccount = accounting.account(null, {
        company_id: company,
        code: '1401',
        name: 'Example · Recoverable input tax',
        type: 'asset',
        purpose: 'tax',
        active: true,
        reason: 'Fictional arithmetic example, not a jurisdiction tax policy.'
      });
      reviewer.settings(company, {
        account_id: control.id,
        reason: 'Fictional payable control selection.'
      });
      const tax = reviewer.tax(null, {
        company_id: company,
        code: 'DEMO5',
        name: 'Example only · 5% exclusive, fully recoverable',
        rate: '5',
        recoverable: '100',
        account_id: taxAccount.id,
        effective_from: '2026-01-01',
        effective_until: null,
        active: true,
        reason: 'Fictional tax arithmetic, not a tax-law determination.'
      });
      const expense = db.prepare("SELECT id FROM ledger_accounts WHERE company_id=? AND code='5100'").get(company);
      for (const [project, engineer, buyerId, item, vendor] of company === 'jakh' ? [['harbour', 'mohammed', 'sara', 'C-103', 'euro'], ['gardens', 'amina', 'sara', 'C-201', 'gulf']] : [['creek', 'noah', 'maya', 'C-301', 'world']]) {
        const site = procurement(db, engineer, today),
          buyer = procurement(db, buyerId, today),
          manager = procurement(db, 'ahmed', today);
        let req = site.createRequest({
          company_id: company,
          project_id: project,
          title: 'Example · Supplier bill and return chain',
          needed_by: '2026-11-06',
          lines: [{
            product_id: `${company}-BLOCK`,
            work_package_id: `WP-${item}`,
            location_id: `${project}-unit`,
            quantity: '30',
            note: 'Synthetic receipts for bill, tax, credit and open-balance examples.'
          }]
        });
        req = site.decide(req.id, {
          version: req.version,
          action: 'submit'
        });
        req = buyer.addQuote(req.id, {
          version: req.version,
          line_id: req.lines[0].id,
          vendor_id: vendor,
          reference: `Example AP ${project}`,
          quantity: '30',
          unit_price: '12',
          rate: vendor === 'euro' ? '4' : '1',
          rate_date: day,
          rate_source: 'Fictional order rate',
          valid_until: '2026-11-06',
          lead_days: 1
        });
        req = buyer.sourcePlan(req.id, {
          version: req.version,
          allocations: [{
            quote_id: req.quotes[0].id,
            quantity: '30'
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
          command_key: 'example-ap-receipt',
          line_id: order.lines[0].id,
          accepted: '25',
          rejected: '5',
          delivery_reference: `Example AP delivery ${project}`,
          reason: 'Five rejected blocks never become billable.'
        });
        const input = {
          kind: 'bill',
          order_id: order.id,
          title: 'Example · Matched material bill',
          reference: `DEMO-BILL-${project}`,
          document_date: day,
          accounting_date: day,
          due_date: day,
          rate: vendor === 'euro' ? '4.123456' : '1',
          rate_date: day,
          rate_source: 'Fictional accounting FX distinct from PO',
          explanation: 'Synthetic accepted-material bill. No payment or second operational cost is created.',
          lines: [{
            receipt_id: order.receipts[0].id,
            quantity: '20',
            unit_price: '12',
            price_basis: '1',
            account_id: expense.id,
            tax_id: tax.id,
            variance_reason: ''
          }]
        };
        let bill = author.save(null, input);
        bill = author.decide(bill.id, {
          version: bill.version,
          action: 'submit',
          reason: 'Synthetic bill for independent AP review.'
        });
        bill = reviewer.decide(bill.id, {
          version: bill.version,
          action: 'post',
          reason: 'Fictional source, classification and tax reviewed.'
        });
        order = manager.moveStock(order.receipts[0].id, {
          version: order.version,
          command_key: 'example-ap-return',
          kind: 'return',
          quantity: '8',
          location_id: `${project}-unit`,
          reason: 'Synthetic return after billing: three billed units now need supplier credit.'
        });
        let credit = author.save(null, {
          ...input,
          kind: 'credit',
          original_id: bill.id,
          title: 'Example · Partial supplier return credit',
          reference: `DEMO-CREDIT-${project}`,
          lines: [{
            original_line_id: bill.lines[0].id,
            quantity: '2'
          }]
        });
        credit = author.decide(credit.id, {
          version: credit.version,
          action: 'submit',
          reason: 'Synthetic partial credit of two returned billed units.'
        });
        reviewer.decide(credit.id, {
          version: credit.version,
          action: 'post',
          reason: 'Independent source-value correction reviewed.'
        });
        author.save(null, {
          ...input,
          kind: 'credit',
          original_id: bill.id,
          title: 'Example · Remaining return credit draft',
          reference: `DEMO-CREDIT-REMAIN-${project}`,
          lines: [{
            original_line_id: bill.lines[0].id,
            quantity: '1'
          }]
        });
        // Another receipt on the same order supplies a reviewable, unposted bill.
        order = manager.receive(order.id, {
          version: order.version,
          command_key: 'example-ap-replacement',
          line_id: order.lines[0].id,
          accepted: '4',
          rejected: '0',
          delivery_reference: `Example replacement ${project}`,
          reason: 'Synthetic replacement accepted after the earlier rejected delivery.'
        });
        const lot = order.receipts.find(r => r.delivery_reference === `Example replacement ${project}`);
        let pending = author.save(null, {
          ...input,
          title: 'Example · Supplier bill awaiting review',
          reference: `DEMO-REVIEW-${project}`,
          lines: [{
            ...input.lines[0],
            receipt_id: lot.id,
            quantity: '3'
          }]
        });
        author.decide(pending.id, {
          version: pending.version,
          action: 'submit',
          reason: 'Synthetic receipt-matched bill awaiting an independent reviewer.'
        });
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(PAYABLE_EXAMPLES, new Date().toISOString());
  });
}
