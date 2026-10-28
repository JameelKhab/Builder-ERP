function quote(value) {
  let text = String(value ?? 'Not available');
  // Quoting alone does not prevent spreadsheet formula execution.
  if (/^[\s]*[=+@]/.test(text) || (/^[\s]*-/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function costReportCsv(report) {
  const lines = [
    ['JAKH cost report'],
    ['Company', report.meta.company.name],
    ['Project', report.meta.project?.name || 'All authorised company activity'],
    ['Currency', report.meta.currency],
    ['As of', report.meta.asOf],
    ['Tax basis', report.meta.taxBasis],
    ['Permission-limited population', report.meta.restricted ? 'Yes' : 'No'],
    ['Snapshot', report.snapshot],
    ['Definition', report.meta.definition],
    ['Rules', report.meta.rules],
    ['Findings'],
    ...report.findings.map(f => [f.text, 'Source items', f.sourceIds.join(', ')]),
    ['Limitations'],
    ...report.limitations.map(s => [s]),
    [],
    ['Item', 'Location', 'Original budget', 'Revised budget', 'Commitments', 'Incurred', 'Cash paid', 'Forecast', 'Source'],
    ...report.rows.map(r => [r.name, r.location, r.original_budget, r.revised_budget, r.committed, r.incurred, r.cash, r.forecast, r.source])
  ];
  return '\uFEFF' + lines.map(row => row.map(quote).join(',')).join('\r\n');
}
