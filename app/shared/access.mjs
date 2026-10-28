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
  'Payments & cash flow': 'finance.read',
  'Drawings & revisions': 'documents.read',
  'RFIs & correspondence': 'documents.read',
  'Snags & defects': 'handover.read',
  'Testing & commissioning': 'handover.read',
  People: 'people.read',
  Stores: 'materials.read',
  'Bids & estimates': 'tenders.read',
  'Purchase requests': 'requests.read',
  'Orders & deliveries': 'requests.read',
  'Cost report': 'cost.read',
  'Project setup': 'projects.read',
  'Budget control': 'cost.read',
  'setup': 'projects.read',
  report: 'cost.read',
  buying: 'requests.read',
  vendors: 'vendors.read'
};
const delivery = ['projects.read', 'programme.read', 'site.read', 'quality.read', 'materials.read', 'assets.read', 'documents.read', 'handover.read'];
const buying = ['projects.read', 'requests.read', 'requests.write', 'procurement.write', 'pricing.read', 'vendors.read'];
const commercial = [...delivery, ...buying, 'cost.read', 'commercial.read', 'finance.read', 'requests.approve', 'tenders.read'];
const role = (id, name, capabilities, description, available = true) => ({
  id,
  name,
  capabilities: [...new Set(capabilities)],
  description,
  available,
  version: capabilities.includes('masters.write') ? 2 : 1
});
export const ROLES = [role('project_manager', 'Project manager', [...commercial, 'masters.write', 'suppliers.approve', 'receipts.write', 'stock.write', 'projects.manage', 'locations.write', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Delivery and commercial visibility. Approval requires a separate amount limit; no HR access.'), role('commercial_manager', 'Commercial manager', [...commercial, 'masters.write', 'suppliers.approve', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Cost, contracts and sourcing review within assigned companies and projects.'), role('site_engineer', 'Site engineer', [...delivery, 'receipts.write', 'requests.read', 'requests.write', 'vendors.read'], 'Site quantities, quality, documents and requests. Prices, budgets and financial records are withheld.'), role('procurement', 'Procurement officer', [...buying, 'masters.write'], 'Prepare and price requests. No approval authority or cost report by default.'), role('purchase_manager', 'Purchasing manager', [...buying, 'masters.write', 'suppliers.approve', 'requests.approve', 'materials.read'], 'Sourcing and stores; approval is separately limited in company currency.'), role('planner', 'Planning engineer', ['projects.read', 'programme.read', 'site.read', 'documents.read'], 'Programme, constraints and supporting site evidence.'), role('document_controller', 'Document controller', ['projects.read', 'documents.read', 'handover.read'], 'Drawings, correspondence and handover evidence.'), role('quality_hse', 'Quality & HSE officer', ['projects.read', 'quality.read', 'site.read', 'documents.read', 'handover.read'], 'Quality and safety evidence, NCR and handover sample registers.'), role('technical_engineer', 'Technical engineer', [...delivery, 'requests.read', 'requests.write', 'vendors.read'], 'Technical and site work without construction prices.'), role('storekeeper', 'Storekeeper', ['projects.read', 'materials.read', 'requests.read', 'receipts.write', 'stock.write'], 'Materials and request quantities, without prices.'), role('inventory_manager', 'Inventory manager', ['projects.read', 'materials.read', 'requests.read', 'pricing.read', 'receipts.write', 'stock.write'], 'Materials and request pricing; no finance or approval authority.'), role('plant_manager', 'Plant & equipment manager', ['projects.read', 'assets.read', 'site.read'], 'Plant use, custody and maintenance information; no financial details.'), role('hr_manager', 'HR manager', ['people.read'], 'People records only. Business and financial access must be assigned separately.'), role('quantity_surveyor', 'Quantity surveyor', ['projects.read', 'commercial.read', 'cost.read', 'pricing.read', 'documents.read', 'budgets.write'], 'Measurement, variations and cost review; no approval authority.'), role('subcontractor_manager', 'Subcontract manager', ['projects.read', 'commercial.read', 'pricing.read', 'documents.read'], 'Package and measured-work information; no payment execution.'), role('estimator', 'Estimator', ['tenders.read', 'pricing.read'], 'Tender and estimating information.'), role('tendering_manager', 'Tendering manager', ['tenders.read', 'pricing.read'], 'Tender information. Bid submission and estimate approval are not implemented.'), role('accountant', 'Accountant', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Read financial and cost samples. Posting and reconciliation are not implemented.'), role('project_accountant', 'Project accountant', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Read finance and costs within assigned projects.'), role('financial_controller', 'Financial controller', ['projects.read', 'finance.read', 'cost.read', 'pricing.read', 'budgets.approve'], 'Financial reporting and independent budget review with a separate limit. Accounting posting remains unimplemented.'), role('cfo', 'Chief financial officer', ['projects.read', 'finance.read', 'cost.read', 'pricing.read'], 'Financial reporting; no automatic access to HR or user administration.'), role('director', 'Construction director', [...commercial, 'masters.write', 'suppliers.approve', 'projects.manage', 'locations.write', 'wbs.write', 'budgets.write', 'budgets.approve'], 'Delivery and commercial information; separate approval limits still apply.'), role('auditor', 'Read-only auditor', commercial.filter(c => !c.endsWith('.write') && !c.endsWith('.approve') && !c.endsWith('.manage')), 'Read-only business access; excludes people records and user administration.'), role('ap_clerk', 'Accounts payable clerk', [], 'Unavailable until supplier-only accounting document rules are implemented.', false), role('ar_clerk', 'Accounts receivable clerk', [], 'Unavailable until customer-only accounting document rules are implemented.', false), role('payroll_officer', 'Payroll officer', [], 'Unavailable until payroll and confidential compensation controls are implemented.', false), role('timekeeper', 'Timekeeper', [], 'Unavailable until attendance and timesheet-specific field controls are implemented.', false)];
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
  id: 'tenders',
  group: 'Company operations',
  title: 'Tenders',
  description: 'Opportunities, bid decisions and estimating examples.',
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
  id: 'finance',
  group: 'Company operations',
  title: 'Payments & cash flow',
  description: 'Certificates, due amounts and cash planning examples.',
  cap: 'finance.read',
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
