export const BOQ_COLUMNS = {
  code: ['Code', 'Item', 'Item code', 'BOQ code', 'البند', 'رمز البند'],
  description: ['Description', 'Name', 'الوصف', 'وصف البند'],
  quantity: ['Quantity', 'Qty', 'الكمية'],
  unit: ['Unit', 'UOM', 'الوحدة'],
  direct_rate: ['Unit cost', 'Rate', 'Direct unit cost', 'سعر الوحدة', 'التكلفة'],
  cost_code: ['Cost code', 'Cost-code', 'رمز التكلفة'],
  product: ['Product', 'Product reference', 'Product code', 'المنتج'],
  parent: ['Parent code', 'Parent', 'البند الرئيسي'],
  share: ['Parent %', 'Parent share', 'Share of parent', 'نسبة الأب'],
  group: ['Group', 'Parent group', 'مجموعة']
};
export const normaliseHeading = s => String(s).normalize('NFKC').trim().toLowerCase().replace(/[\s_*:]+/g, ' ').trim();
export function suggestBoqMapping(parsed) {
  let best = null;
  for (const sheet of parsed.sheets) for (const row of sheet.rows.filter(r => r.number <= 20)) {
    const mapping = {};
    let score = 0;
    for (const [key, aliases] of Object.entries(BOQ_COLUMNS)) {
      const matches = row.cells.filter(c => aliases.some(a => normaliseHeading(a) === normaliseHeading(c.value)));
      if (matches.length === 1) {
        mapping[key] = matches[0].column;
        score++;
      }
    }
    if (!best || score > best.score) best = {
      score,
      sheet: sheet.name,
      header: row.number,
      mapping,
      expected_total: '',
      default_product: '',
      default_cost_code: ''
    };
  }
  return best || {
    sheet: parsed.sheets[0].name,
    header: 1,
    mapping: {},
    expected_total: '',
    default_product: '',
    default_cost_code: ''
  };
}
export const BOQ_STATES = {
  uploaded: 'Choose columns',
  checked: 'Checked',
  reviewed: 'Reviewed',
  returned: 'Changes requested',
  committed: 'Added to draft',
  cancelled: 'Cancelled'
};
