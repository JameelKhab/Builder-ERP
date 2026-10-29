// Original Builder policy vocabulary. No unknown capability or role grants access.
export const CATEGORY_CAPABILITY = {
  'Programme & delays': 'programme.read',
  'KPIs & performance': 'programme.read',
  'Daily work': 'site.read',
  'Quality & safety': 'quality.read',
  'Materials & waste': 'materials.read',
  'Plant & equipment': 'assets.read',
  'Subcontracts': 'commercial.read',
  'Changes & variations': 'commercial.read',
  'Payments & cash flow': 'payments.read',
  'Drawings & revisions': 'documents.read',
  'RFIs & correspondence': 'documents.read',
  'Snags & defects': 'handover.read',
  'Testing & commissioning': 'handover.read',
  People: 'people.read',
  Stores: 'materials.read',
  'Bids & estimates': 'tenders.read',
  'Quotations & awards': 'sales.read',
  'Client contracts': 'sales.read',
  'Client certificates': 'certificates.read',
  certificates: 'certificates.read',
  'Customer receipts': 'customer_receipts.read',
  'customer-receipts': 'customer_receipts.read',
  commercial: 'sales.read',
  'Purchase requests': 'requests.read',
  'Orders & deliveries': 'requests.read',
  'Cost report': 'cost.read',
  'Project setup': 'projects.read',
  'Budget control': 'cost.read',
  'setup': 'projects.read',
  report: 'cost.read',
  buying: 'requests.read',
  quality: 'quality.read',
  'General ledger': 'finance.read',
  ledger: 'finance.read',
  payables: 'ap.read',
  'Supplier bills': 'ap.read',
  vendors: 'vendors.read'
};
const delivery = ['projects.read', 'programme.read', 'site.read', 'quality.read', 'materials.read', 'assets.read', 'documents.read', 'handover.read'];
const buying = ['projects.read', 'requests.read', 'requests.write', 'procurement.write', 'pricing.read', 'vendors.read'];
const commercial = [...delivery, ...buying, 'cost.read', 'commercial.read', 'finance.read', 'requests.approve', 'tenders.read'];
const role = (id, name, capabilities, description, available = true) => ({
  id,
  name,
  capabilities: [...new Set([...capabilities, ...((capabilities.includes('finance.read') || ['ar_clerk','treasury_clerk','bank_reconciler'].includes(id)) ? ['customer_receipts.read'] : []), ...(['ar_clerk','accountant','project_accountant','financial_controller','cfo','treasury_clerk'].includes(id) ? ['customer_receipts.write'] : []), ...(['accountant','project_accountant','financial_controller','cfo','treasury_clerk'].includes(id) ? ['customer_receipts.record'] : []), ...(['financial_controller','cfo'].includes(id) ? ['customer_receipts.approve'] : []), ...((capabilities.includes('finance.read') || ['quantity_surveyor','ar_clerk'].includes(id)) ? ['certificates.read','ar.read'] : []), ...(['quantity_surveyor','project_manager','commercial_manager','director'].includes(id) ? ['certificates.write'] : []), ...(['project_manager','director'].includes(id) ? ['certificates.technical'] : []), ...(['commercial_manager','director'].includes(id) ? ['certificates.commercial'] : []), ...(['financial_controller','cfo'].includes(id) ? ['contracts.configure','certificates.finance','ar.post'] : []), ...(['accountant','project_accountant','financial_controller','cfo','ar_clerk'].includes(id) ? ['ar.write'] : []), ...((capabilities.includes('tenders.read') || capabilities.includes('commercial.read') && capabilities.includes('cost.read')) ? ['sales.read'] : []), ...(['estimator','tendering_manager','commercial_manager','director','project_manager'].includes(id) ? ['sales.write'] : []), ...(['tendering_manager','commercial_manager','director'].includes(id) ? ['sales.approve'] : []), ...(['estimator', 'tendering_manager', 'commercial_manager', 'director', 'project_manager'].includes(id) ? ['tenders.write'] : []), ...(['tendering_manager', 'commercial_manager', 'director'].includes(id) ? ['tenders.approve'] : []), ...(['director', 'project_manager'].includes(id) ? ['tenders.handover'] : []), ...(['auditor', 'financial_controller', 'cfo', 'bank_reconciler'].includes(id) ? ['bank.read'] : []), ...(['accountant', 'project_accountant'].includes(id) ? ['payments.write', 'payments.record'] : []), ...(['financial_controller', 'cfo'].includes(id) ? ['payments.write', 'payments.approve', 'payments.record', 'payments.manage', 'bank.reconcile'] : []), ...(capabilities.includes('finance.read') ? ['ap.read', 'payments.read'] : []), ...(['accountant', 'project_accountant', 'financial_controller', 'cfo'].includes(id) ? ['ap.write'] : []), ...(['financial_controller', 'cfo'].includes(id) ? ['ap.post', 'ap.manage'] : []), ...(['accountant', 'project_accountant', 'financial_controller', 'cfo'].includes(id) ? ['ledger.write'] : []), ...(['financial_controller', 'cfo'].includes(id) ? ['ledger.post', 'ledger.manage'] : []), ...(['project_manager', 'quality_hse'].includes(id) ? ['quality.write', 'quality.review'] : ['site_engineer', 'technical_engineer'].includes(id) ? ['quality.write'] : [])])],
  description,
  available,
  version: (capabilities.includes('finance.read') || ['ar_clerk','treasury_clerk','bank_reconciler'].includes(id)) ? 9 : (capabilities.includes('finance.read') || ['quantity_surveyor','ar_clerk'].includes(id)) ? 8 : id==='quantity_surveyor' ? 2 : id==='auditor' ? 6 : ['estimator', 'tendering_manager', 'commercial_manager', 'director', 'project_manager'].includes(id) ? 7 : capabilities.includes('finance.read') ? 5 : id === 'ap_clerk' ? 2 : ['accountant', 'project_accountant', 'financial_controller', 'cfo'].includes(id) ? 2 : ['project_manager', 'quality_hse', 'site_engineer', 'technical_engineer'].includes(id) ? 3 : capabilities.includes('masters.write') ? 2 : 1
});
export const ROLES = [role('project_manager', 'Project manager', [...commercial, 'masters.write', 'suppliers.approve', 'receipts.write', 'stock.write', 'projects.manage', 'locations.write', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Delivery and commercial visibility. Approval requires a separate amount limit; no HR access.'), role('commercial_manager', 'Commercial manager', [...commercial, 'masters.write', 'suppliers.approve', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Cost, contracts and sourcing review within assigned companies and projects.'), role('site_engineer', 'Site engineer', [...delivery, 'receipts.write', 'requests.read', 'requests.write', 'vendors.read'], 'Site quantities, quality, documents and requests. Prices, budgets and financial records are withheld.'), role('procurement', 'Procurement officer', [...buying, 'masters.write'], 'Prepare and price requests. No approval authority or cost report by default.'), role('purchase_manager', 'Purchasing manager', [...buying, 'masters.write', 'suppliers.approve', 'requests.approve', 'materials.read'], 'Sourcing and stores; approval is separately limited in company currency.'), role('planner', 'Planning engineer', ['projects.read', 'programme.read', 'site.read', 'documents.read'], 'Programme, constraints and supporting site evidence.'), role('document_controller', 'Document controller', ['projects.read', 'documents.read', 'handover.read'], 'Drawings, correspondence and handover evidence.'), role('quality_hse', 'Quality & HSE officer', ['projects.read', 'quality.read', 'site.read', 'documents.read', 'handover.read'], 'NCR investigation, corrective work and independent verification; other quality/HSE and handover registers remain illustrative.'), role('technical_engineer', 'Technical engineer', [...delivery, 'requests.read', 'requests.write', 'vendors.read'], 'Technical and site work without construction prices.'), role('storekeeper', 'Storekeeper', ['projects.read', 'materials.read', 'requests.read', 'receipts.write', 'stock.write'], 'Materials and request quantities, without prices.'), role('inventory_manager', 'Inventory manager', ['projects.read', 'materials.read', 'requests.read', 'pricing.read', 'receipts.write', 'stock.write'], 'Materials and request pricing; no finance or approval authority.'), role('plant_manager', 'Plant & equipment manager', ['projects.read', 'assets.read', 'site.read'], 'Plant use, custody and maintenance information; no financial details.'), role('hr_manager', 'HR manager', ['people.read'], 'People records only. Business and financial access must be assigned separately.'), role('quantity_surveyor', 'Quantity surveyor', ['projects.read', 'commercial.read', 'cost.read', 'pricing.read', 'documents.read', 'budgets.write'], 'Measurement, variations and cost review; no approval authority.'), role('subcontractor_manager', 'Subcontract manager', ['projects.read', 'commercial.read', 'pricing.read', 'documents.read'], 'Package and measured-work information; no payment execution.'), role('estimator', 'Estimator', ['tenders.read', 'pricing.read'], 'Prepare BOQ assemblies, quantities and revisions; independent estimate approval is required.'), role('tendering_manager', 'Tendering manager', ['tenders.read', 'pricing.read'], 'Prepare estimates and independently review them within separate estimate authority. External bid submission remains separate.'), role('accountant', 'Accountant', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Prepare general journals and read scoped finance; independent posting is separately controlled.'), role('project_accountant', 'Project accountant', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Prepare journals and read finance and costs within assigned projects.'), role('financial_controller', 'Financial controller', ['projects.read', 'finance.read', 'cost.read', 'pricing.read', 'budgets.approve'], 'Company ledger configuration and independent posting with a separate journal limit; budget review has its own limit.'), role('cfo', 'Chief financial officer', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Ledger configuration and independent posting with an explicit journal limit; no HR or user administration.'), role('director', 'Construction director', [...commercial, 'masters.write', 'suppliers.approve', 'projects.manage', 'locations.write', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Delivery and commercial information; separate approval limits still apply.'), role('auditor', 'Read-only auditor', commercial.filter(c => !c.endsWith('.write') && !c.endsWith('.approve') && !c.endsWith('.manage')), 'Read-only business access; excludes people records and user administration.'), role('ap_clerk', 'Accounts payable clerk', ['projects.read', 'ap.read', 'ap.write'], 'Prepare receipt-matched supplier bills and return credits. No general ledger, customer, HR, posting or payment authority.'), role('treasury_clerk', 'Treasury clerk', ['projects.read', 'payments.read', 'payments.write', 'payments.record'], 'Prepare supplier payments and record independently approved offline transactions; no approval, general ledger or bank reconciliation.'), role('bank_reconciler', 'Bank reconciler', ['projects.read', 'payments.read', 'bank.reconcile'], 'Record statement evidence and independently match recorded transactions. No payment preparation or approval.'), role('ar_clerk', 'Accounts receivable clerk', ['projects.read'], 'Prepare invoices from approved client certificates. No supplier, general-ledger, people, posting or payment authority.'), role('payroll_officer', 'Payroll officer', [], 'Unavailable until payroll and confidential compensation controls are implemented.', false), role('timekeeper', 'Timekeeper', [], 'Unavailable until attendance and timesheet-specific field controls are implemented.', false)];
export const ROLE_BY_ID = Object.fromEntries(ROLES.map(r => [r.id, r]));
export const canCategory = (caps, category) => category === 'resources' ? ['assets.read', 'materials.read'].some(c => caps.includes(c)) : caps.includes(CATEGORY_CAPABILITY[category]);
export const DESTINATIONS = [{
  id: 'organisation',
  group: 'Administration',
  title: 'Companies',
  description: 'Legal identities and functional currencies.',
  cap: 'organisation.manage',
  section: 'Organisation',
  icon: 'Buildings'
}, {
  id: 'projects',
  group: 'Project delivery',
  title: 'Projects',
  description: 'Programme, site work, quality and handover.',
  cap: 'projects.read',
  section: 'Projects',
  area: 'Overview',
  icon: 'Buildings'
}, {
  id: 'buying',
  group: 'Project delivery',
  title: 'Buying',
  description: 'Requests, supplier quotations and subcontract packages.',
  cap: 'requests.read',
  section: 'Projects',
  area: 'Buying',
  icon: 'ShoppingCart'
}, {
  id: 'commercial',
  group: 'Project delivery',
  title: 'Contracts & costs',
  description: 'Variations, payment records and cost position.',
  cap: 'commercial.read',
  section: 'Projects',
  area: 'Costs & Contracts',
  icon: 'Scales'
}, {
  id: 'documents',
  group: 'Project delivery',
  title: 'Documents',
  description: 'Drawings, revisions, RFIs and correspondence.',
  cap: 'documents.read',
  section: 'Projects',
  area: 'Documents',
  icon: 'Files'
}, {
  id: 'quality',
  group: 'Project delivery',
  title: 'Quality & NCRs',
  description: 'Containment, corrective work and independent verification.',
  cap: 'quality.read',
  section: 'Company',
  category: 'quality',
  icon: 'ShieldCheck'
}, {
  id: 'customer-receipts',
  group: 'Company operations',
  title: 'Customer receipts',
  description: 'Invoice settlement, recorded money and bank evidence.',
  cap: 'customer_receipts.read',
  section: 'Company',
  category: 'customer-receipts',
  icon: 'Wallet'
}, {
  id: 'certificates',
  group: 'Company operations',
  title: 'Client certificates',
  description: 'Measured work, independent review and client invoices.',
  cap: 'certificates.read',
  section: 'Company',
  category: 'certificates',
  icon: 'Scales'
}, {
  id: 'sales',
  group: 'Company operations',
  title: 'Quotations & awards',
  description: 'Reviewed offers, client acceptance and original contract scope.',
  cap: 'sales.read',
  section: 'Company',
  category: 'commercial',
  icon: 'Scales'
}, {
  id: 'tenders',
  group: 'Company operations',
  title: 'Tenders',
  description: 'BOQ studies, resource pricing, revisions and independent review.',
  cap: 'tenders.read',
  section: 'Tenders',
  icon: 'Notebook'
}, {
  id: 'resources',
  group: 'Company operations',
  title: 'Resources',
  description: 'Plant, equipment, materials and stores.',
  any: ['assets.read', 'materials.read'],
  section: 'Company',
  category: 'resources',
  icon: 'Crane'
}, {
  id: 'masters',
  group: 'Company operations',
  title: 'Contacts & catalogue',
  description: 'Supplier terms, company contacts and material definitions.',
  cap: 'vendors.read',
  section: 'Company',
  category: 'vendors',
  icon: 'AddressBook'
}, {
  id: 'people',
  group: 'Company operations',
  title: 'People',
  description: 'People records and workforce examples.',
  cap: 'people.read',
  section: 'Company',
  category: 'People',
  icon: 'Users'
}, {
  id: 'reports',
  group: 'Company operations',
  title: 'Reports & findings',
  description: 'Project or company costs, with explained findings.',
  cap: 'cost.read',
  section: 'Company',
  category: 'report',
  icon: 'ChartBar'
}, {
  id: 'ledger',
  group: 'Company operations',
  title: 'Accounting',
  description: 'General journals, periods and posted ledger findings.',
  cap: 'finance.read',
  section: 'Company',
  category: 'ledger',
  icon: 'Scales'
}, {
  id: 'payables',
  group: 'Company operations',
  title: 'Supplier bills',
  description: 'Receipt matching, bill review and supplier return credits.',
  cap: 'ap.read',
  section: 'Company',
  category: 'payables',
  icon: 'Receipt'
}, {
  id: 'finance',
  group: 'Company operations',
  title: 'Payments & cash flow',
  description: 'Supplier settlements, bank clearance and cash findings.',
  cap: 'payments.read',
  section: 'Company',
  category: 'Payments & cash flow',
  icon: 'Wallet'
}, {
  id: 'access',
  group: 'Administration',
  title: 'Users & access',
  description: 'Review roles, scope and approval authority together.',
  cap: 'access.manage',
  section: 'Access',
  icon: 'ShieldCheck'
}];
export const destinationsFor = caps => DESTINATIONS.filter(d => d.any ? d.any.some(c => caps.includes(c)) : caps.includes(d.cap));
