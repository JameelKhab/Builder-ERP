import { fixture, post, today, decide } from './payable-fixture.mjs';
import { payments } from '../../server/payments.mjs';
import { D } from '../../server/money.mjs';
export function setup(t) {
  const f = fixture(t);
  for (const [id, role] of [['treasury', 'treasury_clerk'], ['bank-review', 'bank_reconciler']]) {
    f.db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    f.db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES(?,?,?,?)').run(id, 'jakh', '*', role);
  }
  f.db.prepare("UPDATE memberships SET payment_approval_limit='100000' WHERE user_id='ap-reviewer'").run();
  const create = (code, type, purpose) => f.accounting.account(null, {
    company_id: 'jakh',
    code,
    name: code,
    type,
    purpose,
    active: true,
    reason: 'Test bank accounts'
  });
  const bankAccount = create('1100', 'asset', 'bank'),
    gain = create('4100', 'income', 'general'),
    loss = create('5100', 'expense', 'general');
  const maker = payments(f.db, 'treasury', today),
    checker = payments(f.db, 'ap-reviewer', today),
    banker = payments(f.db, 'bank-review', today),
    bank = checker.bank(null, {
      company_id: 'jakh',
      name: 'Test AED bank',
      currency: 'AED',
      account_id: bankAccount.id,
      gain_account_id: gain.id,
      loss_account_id: loss.id,
      active: true,
      reason: 'Test bank alias'
    });
  const bill = post(f);
  return {
    ...f,
    maker,
    checker,
    banker,
    bank,
    bill,
    inputPay: {
      company_id: 'jakh',
      bank_id: bank.id,
      kind: 'payment',
      title: 'Partial settlement',
      accounting_date: today(),
      rate_date: today(),
      rate_source: 'Fictional actual bank debit evidence',
      bank_rate: '1',
      bank_amount: '430.00',
      explanation: 'Test partial supplier settlement',
      allocations: [{
        bill_id: bill.id,
        amount: '100.00'
      }]
    }
  };
}
export const approve = (f, input = f.inputPay) => decide(f.checker, decide(f.maker, f.maker.save(null, input), 'submit'), 'approve');
export const record = (f, r, ref = 'BANK-001') => f.maker.decide(r.id, {
  version: r.version,
  action: 'record',
  reason: 'Checked recorded offline movement',
  bank_reference: ref,
  evidence: 'Fictional transfer reference; no real bank action'
});
export const statement = (f, p, extras = {}) => f.banker.statement({
  bank_id: f.bank.id,
  reference: 'STMT-001',
  start_date: today(),
  end_date: today(),
  opening: '10000',
  closing: new D('10000').minus(p.bank_amount).toFixed(2),
  reason: 'Fictional bank statement',
  rows: [{
    date: today(),
    direction: 'out',
    amount: p.bank_amount,
    reference: p.bank_reference
  }],
  ...extras
});
