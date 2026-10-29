export function payablesCsv(report) {
  const rows = [['Builder ERP · Supplier payable report'], ['Company', report.company.name], ['Project scope', report.project_id || 'Authorised company projects'], ['Accounting through', report.to], ['Functional currency', report.company.currency], [], ['Findings'], ...report.findings.map(f => [f]), [], ['Limitations'], ...report.limitations.map(f => [f]), [], ['Bill ID', 'Supplier reference', 'Supplier', 'Project', 'Accounting date', 'Due date', 'Currency', 'Original', 'Credited', 'Open', 'Functional original', 'Functional credited', 'Functional open', 'Overdue', 'Journal ID'], ...report.rows.map(r => [r.id, r.reference, r.vendor, r.project, r.accounting_date, r.due_date, r.currency, r.original, r.credited, r.open, r.base_original, r.base_credited, r.base_open, r.overdue ? 'Yes' : 'No', r.journal_id]), [], ['Linked return credits'], ['Bill ID', 'Credit ID', 'Supplier reference', 'Transaction amount', 'Functional amount'], ...report.rows.flatMap(r => r.credits.map(c => [r.id, c.id, c.reference, c.total, c.company_total])), [], ['Receipt exceptions'], ['Receipt ID', 'Order ID', 'Product', 'UOM', 'Net accepted', 'Net billed', 'Unbilled quantity', 'Return credit quantity'], ...report.exceptions.map(r => [r.id, r.order_id, r.product, r.uom, r.net_accepted, r.net_billed, r.available, r.credit_needed])];
  return rows.map(row => row.map(v => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
