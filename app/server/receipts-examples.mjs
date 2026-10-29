import { transaction } from './db.mjs';
import { receipts } from './receipts.mjs';
import { payments } from './payments.mjs';
import { ledger } from './ledger.mjs';
import { money, sum } from './money.mjs';
export const RECEIPT_EXAMPLES = 'customer-receipts-v1';
export function installReceiptExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(RECEIPT_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-receipt-author', 'Rania · example receipt preparer', 'ar_clerk'], ['example-receipt-reviewer', 'Kareem · example receipt reviewer', 'financial_controller'], ['example-receipt-recorder', 'Dina · example receipt recorder', 'treasury_clerk']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const c of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,receipt_approval_limit) VALUES(?,?,'*',?,?)").run(id, c, role, role === 'financial_controller' ? '1000000' : '0');
    }
    const today = () => new Date().toISOString().slice(0, 10),
      date = today(),
      reason = 'Fictional customer receipt walkthrough; no external transaction.',
      author = receipts(db, 'example-receipt-author', today),
      reviewer = receipts(db, 'example-receipt-reviewer', today),
      recorder = receipts(db, 'example-receipt-recorder', today),
      banker = payments(db, 'example-bank-reviewer', today),
      bankAdmin = payments(db, 'example-receipt-reviewer', today),
      gl = ledger(db, 'example-receipt-reviewer', today);
    const decide = (s, r, action, extra = {}) => s.decide(r.id, {
        version: r.version,
        action,
        reason,
        ...extra
      }),
      approve = r => decide(reviewer, decide(author, r, 'submit'), 'approve');
    const record = (r, reference) => decide(recorder, r, 'record', {
      bank_reference: reference,
      file: {
        filename: 'fictional-remittance.txt',
        base64: Buffer.from('FICTIONAL ONLY\n' + reference + '\nNo real money or bank transfer.').toString('base64')
      }
    });
    for (const c of db.prepare('SELECT * FROM companies').all()) {
      const original = db.prepare('SELECT * FROM payment_banks WHERE company_id=? ORDER BY rowid LIMIT 1').get(c.id);
      const control = gl.account(null, {
        company_id: c.id,
        code: '1120',
        name: 'Example · Receipt demonstration bank',
        type: 'asset',
        purpose: 'bank',
        active: true,
        reason
      });
      const bank = bankAdmin.bank(null, {
          company_id: c.id,
          name: 'Example · Receipt demonstration bank',
          currency: c.currency,
          account_id: control.id,
          gain_account_id: original.gain_account_id,
          loss_account_id: original.loss_account_id,
          active: true,
          reason
        }),
        cash = [];
      for (const p of db.prepare('SELECT * FROM projects WHERE company_id=?').all(c.id)) {
        const invoice = author.balances(c.id, p.id).find(i => i.open === '3415.10');
        if (!invoice) continue;
        const input = (title, amount) => ({
          company_id: c.id,
          bank_id: bank.id,
          title: `Example · ${p.name} · ${title}`,
          accounting_date: date,
          bank_amount: amount,
          bank_rate: '1',
          rate_date: date,
          rate_source: 'Same-currency fictional company bank',
          explanation: reason,
          allocations: [{
            invoice_id: invoice.id,
            amount
          }]
        });
        let r = record(approve(author.save(null, input('Receipt later corrected', '1000.00'))), 'DEMO-CLIENT-' + p.id);
        cash.push(r);
        let rev = author.reverse(r.id, {
          version: r.version,
          accounting_date: date,
          reason: 'Fictional full reversal to correct an erroneous receipt while retaining its original evidence.'
        });
        rev = record(approve(rev), 'DEMO-CLIENT-REV-' + p.id);
        cash.push(rev);
        approve(author.save(null, input('Receipt approved, not yet recorded', '500.00')));
        decide(author, author.save(null, input('Receipt awaiting independent review', '400.00')), 'submit');
        author.save(null, input('Receipt draft for allocation', '300.00'));
      }
      if (cash.length) {
        const statement = banker.statement({
          bank_id: bank.id,
          reference: 'DEMO-CLIENT-STATEMENT-' + c.id,
          start_date: date,
          end_date: date,
          opening: '0.00',
          closing: money(sum(cash.map(r => r.reversal_of ? '-' + r.bank_amount : r.bank_amount))),
          rows: cash.map(r => ({
            date,
            direction: r.reversal_of ? 'out' : 'in',
            amount: r.bank_amount,
            reference: r.bank_reference
          })),
          reason
        });
        for (let i = 0; i < statement.rows.length; i++) banker.match(statement.rows[i].id, {
          version: statement.rows[i].version,
          action: 'match',
          receipt_ids: [cash[i].id],
          reason
        });
      }
    }
    db.prepare('INSERT INTO sample_packs VALUES(?,?)').run(RECEIPT_EXAMPLES, new Date().toISOString());
  });
}
