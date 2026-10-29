const areas = {
  pricing: 'Prices',
  tenders: 'Estimates',
  cost: 'Cost reports',
  requests: 'Purchase requests',
  materials: 'Materials',
  assets: 'Plant & equipment',
  vendors: 'Suppliers',
  receipts: 'Deliveries',
  stock: 'Stock movements',
  wbs: 'Work breakdown',
  quality: 'Quality & NCRs',
  ledger: 'General ledger',
  ap: 'Supplier bills',
  ar: 'Client invoices',
  advances: 'Client advances',
  certificates: 'Client certificates',
  contracts: 'Contract finance',
  customer_receipts: 'Customer receipts',
  payments: 'Supplier payments',
  bank: 'Bank evidence',
  sales: 'Offers & awards',
  finance: 'Finance',
  people: 'People'
};
export function permissionLabel(value) {
  const [area, action] = value.split('.');
  const name = areas[area] || area.charAt(0).toUpperCase() + area.slice(1);
  return `${name}: ${{
    post: area === 'ap' ? 'post within separate AP authority' : area === 'ar' ? 'post within separate client invoice authority' : 'post within separate journal authority',
    read: 'view',
    write: 'create and revise',
    manage: 'manage',
    review: 'independent review',
    approve: 'approve within assigned limits',
    record: 'record independently approved offline transactions',
    reconcile: 'independently match bank evidence',
    configure: 'propose and independently review finance settings',
    technical: 'independent technical review',
    commercial: 'commercial review within assigned limits',
    finance: 'finance review within assigned limits'
  }[action] || action}`;
}
