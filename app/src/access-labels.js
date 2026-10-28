const areas = {
  pricing: 'Prices',
  cost: 'Cost reports',
  requests: 'Purchase requests',
  materials: 'Materials',
  assets: 'Plant & equipment',
  vendors: 'Suppliers',
  receipts: 'Deliveries',
  stock: 'Stock movements',
  wbs: 'Work breakdown',
  finance: 'Finance',
  people: 'People'
};
export function permissionLabel(value) {
  const [area, action] = value.split('.');
  const name = areas[area] || area.charAt(0).toUpperCase() + area.slice(1);
  return `${name}: ${{
    read: 'view',
    write: 'create and revise',
    manage: 'manage',
    approve: 'approve within assigned limits'
  }[action] || action}`;
}
