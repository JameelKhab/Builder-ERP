const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
export function correctionsCsv(report) {
  return [
    ['Builder ERP · Client corrections'],
    ['Company', report.company_id, report.company_name],
    ['Project', report.project_id || 'All authorised projects'],
    ['Currency', report.currency || 'Separate currency groups'],
    ['Effective through', report.to],
    ['Company currency', report.company_currency], [],
    ['Findings'], ...report.findings.map(f => [f]), [],
    ['Currency', 'Applied invoice credit'], ...report.currency_groups.map(g => [g.currency, g.credited]), [],
    ['Correction', 'Title', 'Project', 'Current state', 'Effective date', 'Source', 'Source title', 'Invoice', 'Currency', 'Proposed or applied credit', 'Company credit', 'Applied journal', 'Next action'],
    ...report.rows.map(r => [r.id,r.title,r.project,r.state_label,r.effective_date,r.advance_id||r.certificate_id,r.source_title,r.invoice_id,r.currency,r.credit_total,r.credit_base,r.journal_id,r.next_action]), [],
    ['Applied credits · company currency', 'Source credit', 'AR ledger credit', 'Difference'],
    ['',report.reconciliation.source_credit,report.reconciliation.ledger_credit,report.reconciliation.difference], [],
    ['Definitions and limits'], ...report.limitations.map(l => [l])
  ].map(row => row.map(cell).join(',')).join('\r\n');
}
