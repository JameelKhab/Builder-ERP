export function paymentsCsv(r) {
  const rows = [['Builder ERP · Recorded supplier cash movements'], ['Company', r.company.name], ['Project', r.project_id || 'Authorised company projects'], ['Through', r.to], ['Functional currency', r.company.currency], [], ['Findings'], ...r.findings.map(f => [f]), [], ['Limitations'], ...r.limitations.map(f => [f]), [], ['Payment', 'Bill', 'Project', 'Supplier', 'Accounting date', 'Direction', 'Invoice currency', 'Allocation', 'Carrying amount', 'Bank currency', 'Bank amount', 'Functional bank amount', 'FX loss / (gain)', 'Bank reference', 'Statement', 'Cleared date', 'Reversal of'], ...r.rows.map(x => [x.payment_id, x.bill_id, x.project, x.vendor, x.date, x.direction, x.currency, x.amount, x.base_carrying, x.bank_currency, x.bank_amount, x.bank_base, x.fx, x.bank_reference, x.clearance?.statement, x.clearance?.date, x.reversal_of]), [], ['Approved plans · excluded from actual cash'], ['Payment', 'Title', 'Supplier', 'Invoice currency', 'Amount', 'Bank currency', 'Bank amount'], ...r.planned.map(x => [x.id, x.title, x.vendor, x.currency, x.total, x.bank_currency, x.bank_amount])];
  return rows.map(row => row.map(v => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
