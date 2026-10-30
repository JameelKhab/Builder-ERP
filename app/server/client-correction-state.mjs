// Internal queries. Public callers must authorise source company/project access.
export function correctionEntry(db, access, source, kind) {
  const advance=kind==='advance', key=advance?'advance_id':'certificate_id';
  const readable=access.has('ar.read',source.company_id,source.project_id) && access.has(advance?'advances.read':'certificates.read',source.company_id,source.project_id);
  if (!readable) return {correction_request_id:null,can_prepare_correction:false};
  const existing=db.prepare(`SELECT id FROM client_corrections WHERE ${key}=? AND state<>'cancelled'`).get(source.id);
  return {correction_request_id:existing?.id||null,can_prepare_correction:!existing && source.state==='approved' && (advance?access.has('advances.write',source.company_id,source.project_id):access.has('certificates.write',source.company_id,source.project_id)||access.has('ar.write',source.company_id,source.project_id))};
}
export function appliedCorrection(db, source, to = '9999-12-31') {
  return db.prepare("SELECT * FROM client_corrections WHERE state='applied' AND effective_date<=? AND (advance_id=? OR certificate_id=?)").get(to, source.advance_id || null, source.certificate_id || null) || null;
}
export function invoiceCredit(db, invoiceId, to = '9999-12-31') {
  return db.prepare("SELECT * FROM client_corrections WHERE invoice_id=? AND state='applied' AND journal_id IS NOT NULL AND effective_date<=?").get(invoiceId, to) || null;
}
export function effectiveCertificate(db, contractId) {
  return db.prepare(`SELECT c.* FROM client_certificates c WHERE c.contract_id=? AND c.state='approved'
    AND NOT EXISTS(SELECT 1 FROM client_corrections x WHERE x.certificate_id=c.id AND x.state='applied')
    ORDER BY c.period_to DESC,c.approved_at DESC,c.id DESC LIMIT 1`).get(contractId) || null;
}
export function effectiveRecoveries(db, invoiceId, to = '9999-12-31') {
  return db.prepare(`SELECT r.* FROM client_advance_recoveries r WHERE r.invoice_id=?
    AND NOT EXISTS(SELECT 1 FROM client_corrections x WHERE x.certificate_id=r.certificate_id AND x.state='applied' AND x.effective_date<=?) ORDER BY r.certificate_id`).all(invoiceId, to);
}
