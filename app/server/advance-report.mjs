import { D, money, sum } from './money.mjs';
import { advanceSettlement, advancePaidComponents } from './advance-balances.mjs';
import { pendingAdvanceReversals } from './advance-recovery.mjs';

// Internal projection. The service must authorise each advance before calling.
export function advancePosition(db, request, cutoff) {
  const invoice = db.prepare('SELECT * FROM client_invoices WHERE advance_id=?').get(request.id);
  const posted = invoice?.state === 'posted' && invoice.accounting_date <= cutoff;
  const paid = posted ? advanceSettlement(db, invoice, cutoff) : { paid_principal: '0.00', paid_tax: '0.00', settled: '0.00', open_receivable: '0.00' };
  const recoveries = invoice ? db.prepare(`SELECT r.*, c.title certificate_title,c.period_to,
    i.id recovery_invoice_id,i.state invoice_state,i.accounting_date,i.journal_id
    FROM client_advance_recoveries r JOIN client_certificates c ON c.id=r.certificate_id
    LEFT JOIN client_invoices i ON i.certificate_id=r.certificate_id
    WHERE r.invoice_id=? ORDER BY r.created_at,r.certificate_id`).all(invoice.id) : [];
  const cleared = recoveries.filter(r => r.invoice_state === 'posted' && r.accounting_date <= cutoff);
  const total = (rows, key) => money(sum(rows.map(r => r[key])));
  const original = posted ? JSON.parse(invoice.journal_json).find(l => l.account_id === JSON.parse(invoice.snapshot).accounts.advance.id).base_credit : '0.00';
  const taxAccount = invoice && JSON.parse(invoice.snapshot).accounts.tax?.id;
  const originalTax = posted && taxAccount ? JSON.parse(invoice.journal_json).find(l => l.account_id === taxAccount).base_credit : '0.00';
  let ledgerTax = posted && taxAccount ? sum(db.prepare('SELECT base_credit,base_debit FROM ledger_lines WHERE entry_id=? AND account_id=?').all(invoice.journal_id,taxAccount).map(l=>new D(l.base_credit).minus(l.base_debit))) : new D(0);
  for (const r of cleared) if (taxAccount) ledgerTax=ledgerTax.minus(sum(db.prepare('SELECT base_debit,base_credit FROM ledger_lines WHERE entry_id=? AND account_id=? AND description=?').all(r.journal_id,taxAccount,`Original advance tax released · ${invoice.id}`).map(l=>new D(l.base_debit).minus(l.base_credit))));
  const currentPaid = invoice?.state === 'posted' ? advanceSettlement(db, invoice) : null;
  const pending = currentPaid ? pendingAdvanceReversals(db, invoice.id) : [];
  const pendingGross = total(pending, 'amount');
  const usable = currentPaid ? advancePaidComponents(invoice, money(new D(currentPaid.settled).minus(pendingGross))) : { paid_principal: '0.00' };
  return {
    invoice: invoice ? { id: invoice.id, state: invoice.state, invoice_date: invoice.invoice_date, accounting_date: invoice.accounting_date, due_date: invoice.due_date, journal_id: invoice.journal_id } : null,
    invoiced_principal: posted ? request.principal : '0.00', invoiced_tax: posted ? request.tax : '0.00',
    paid_principal: paid.paid_principal, paid_tax: paid.paid_tax, settled: paid.settled, open_receivable: paid.open_receivable,
    recovered_principal: total(cleared, 'principal'), recovered_tax: total(cleared, 'tax'),
    paid_unrecovered: money(new D(paid.paid_principal).minus(total(cleared, 'principal'))),
    liability_principal: money(new D(posted ? request.principal : 0).minus(total(cleared, 'principal'))),
    base_invoiced: original, base_recovered: total(cleared, 'base_principal'),
    base_liability: money(new D(original).minus(total(cleared, 'base_principal'))),
    base_invoiced_tax: originalTax, base_recovered_tax: total(cleared, 'base_tax'),
    base_unreleased_tax: money(new D(originalTax).minus(total(cleared, 'base_tax'))), ledger_unreleased_tax: money(ledgerTax),
    current_certified: total(recoveries, 'principal'), current_certified_tax: total(recoveries, 'tax'),
    current_pending_corrections: pendingGross,
    current_available: money(new D(usable.paid_principal).minus(total(recoveries, 'principal'))),
    recoveries
  };
}

export function advanceReport(db, access, company, project, currency, cutoff, rows) {
  const sumKey = (rr, key) => money(sum(rr.map(r => r[key])));
  const keys = ['approved_principal','invoiced_principal','invoiced_tax','paid_principal','paid_tax','open_receivable','recovered_principal','recovered_tax','paid_unrecovered','liability_principal','current_certified','current_available'];
  const groups = [...new Set(rows.map(r => r.currency))].sort().map(c => ({ currency: c, ...Object.fromEntries(keys.map(k => [k, sumKey(rows.filter(r => r.currency === c), k)])) }));
  const ledger = db.prepare(`SELECT l.project_id,e.currency,l.base_debit,l.base_credit FROM ledger_lines l
    JOIN ledger_entries e ON e.id=l.entry_id JOIN ledger_accounts a ON a.id=l.account_id
    WHERE e.company_id=? AND e.state='posted' AND e.accounting_date<=? AND a.purpose='client_advance'`).all(company.id, cutoff)
    .filter(l => (!project || project === l.project_id) && (!currency || currency === l.currency) && access.has('advances.read', company.id, l.project_id));
  const source = sumKey(rows, 'base_liability'), control = money(sum(ledger.map(l => new D(l.base_credit).minus(l.base_debit))));
  const sourceTax = sumKey(rows, 'base_unreleased_tax'), ledgerTax = sumKey(rows, 'ledger_unreleased_tax');
  return {
    company, project_id: project, currency, to: cutoff, rows, currency_groups: groups,
    reconciliation: { source_liability: source, ledger_liability: control, difference: money(new D(source).minus(control)) },
    tax_reconciliation: { source_unreleased_tax: sourceTax, ledger_unreleased_tax: ledgerTax, difference: money(new D(sourceTax).minus(ledgerTax)) },
    findings: [
      `${rows.length} advance requests dated through ${cutoff}. Approval and certification columns show current workflow decisions; accounting amounts use the cutoff.`,
      ...groups.map(g => `${g.currency}: invoiced principal ${g.invoiced_principal}; paid principal ${g.paid_principal}; posted recovery ${g.recovered_principal}. Paid but unrecovered ${g.paid_unrecovered}; remaining invoiced liability ${g.liability_principal}.`),
      `Advance liability source ${source} and ledger ${control} ${company.currency}; difference ${money(new D(source).minus(control))}. Unpaid invoices remain part of the liability.`,
      `Selected advance tax: ${sourceTax} ${company.currency} originally charged and not yet released; selected ledger lines ${ledgerTax}; difference ${money(new D(sourceTax).minus(ledgerTax))}. This excludes tax on measured work.`,
      `${rows.filter(r => r.can_review).length} requests need your approval; ${rows.filter(r => r.can_invoice).length} approved requests can be invoiced in this scope.`
    ],
    limitations: [
      'Accounting amounts include only posted invoices and recorded receipts/corrections dated through the cutoff, using the records known now. This is not a reconstruction of what was known on that date.',
      'Approved principal, certified recovery, pending corrections and available-to-certify are current workflow positions for the selected requests, regardless of cutoff. Certification reserves principal before the recovery invoice is posted.',
      'Principal reconciles to the advance control at original carrying values. Advance tax reconciles only its original invoice and identified recovery-release lines, not the whole tax payable account. Shared AR and bank controls are reported under Customer receipts. Paid principal excludes allocated tax.',
      'Requests awaiting approval are not liabilities or cash. Approved advance cancellation, credits and correction of recovered certificates remain unavailable.',
      project ? 'Selected project only.' : access.has('advances.read', company.id) ? 'All authorised company projects.' : 'Only your authorised projects; this is not the complete legal-company statement.'
    ]
  };
}
