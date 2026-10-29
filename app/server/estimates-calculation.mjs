import { D, decimal, money, sum, requireThat } from './money.mjs';
const SCALE = 1000000000000n;
// Keep products/division rational until the chosen output precision.
export function estimateRatio(factors, divisor = '1', places = 2) {
  requireThat(factors.length > 0 && Number.isInteger(places) && places >= 0 && places <= 12, 'Invalid estimate calculation.');
  const n = factors.reduce((p, v) => p * new D(v).scaled, 1n) * 10n ** BigInt(places);
  const d = new D(divisor).scaled * SCALE ** BigInt(factors.length - 1);
  requireThat(n >= 0n && d > 0n, 'Estimate factors must be non-negative with a positive price basis.');
  const q = n / d + (n % d * 2n >= d ? 1n : 0n);
  return D.raw(q * (SCALE / 10n ** BigInt(places))).toFixed(places);
}
export function allocateEstimatePool(total, rows) {
  const cents = new D(total).scaled / (SCALE / 100n),
    weight = rows.reduce((s, r) => s + new D(r.direct).scaled, 0n);
  requireThat(cents === 0n || weight > 0n, 'Indirect costs need at least one positive direct cost.');
  if (!weight) return Object.fromEntries(rows.map(r => [r.key, '0.00']));
  const shares = rows.map(r => {
    const n = cents * new D(r.direct).scaled;
    return {
      key: r.key,
      code: r.code,
      cents: n / weight,
      remainder: n % weight
    };
  });
  let left = cents - shares.reduce((s, r) => s + r.cents, 0n);
  shares.sort((a, b) => a.remainder === b.remainder ? a.code.localeCompare(b.code, 'en') : a.remainder > b.remainder ? -1 : 1);
  for (const r of shares) if (left > 0n) {
    r.cents++;
    left--;
  }
  return Object.fromEntries(shares.map(r => [r.key, D.raw(r.cents * (SCALE / 100n)).toFixed(2)]));
}
export function calculateEstimate(header, lines, resources, overrides) {
  const factor = p => new D(1).plus(new D(p).div(100)).toString();
  const items = lines.filter(l => l.kind === 'item').map(l => {
    const variants = overrides.filter(v => v.line_key === l.key);
    const quantity = variants.reduce((n, v) => n.plus(v.quantity).minus(l.quantity), new D(l.quantity).times(String(header.buildings))).toString();
    const components = resources.filter(r => r.line_key === l.key).map(r => ({
      ...r,
      total_quantity: new D(quantity).times(r.consumption).toString(),
      amount: estimateRatio([quantity, r.consumption, r.unit_rate, r.rate], r.price_basis)
    }));
    const direct = l.mode === 'assembly' ? money(sum(components.map(r => r.amount))) : estimateRatio([quantity, l.direct_rate]);
    return {
      ...l,
      total_quantity: quantity,
      secondary_quantity: l.secondary_unit ? new D(quantity).times(l.conversion).toString() : null,
      resources: components,
      overrides: variants,
      direct
    };
  });
  const allocations = allocateEstimatePool(header.indirect_pool, items);
  for (const l of items) {
    l.indirect = allocations[l.key];
    l.budget = money(new D(l.direct).plus(l.indirect));
    l.selling = estimateRatio([l.budget, factor(header.overhead), factor(header.profit), factor(l.item_markup), factor(header.header_markup)]);
    l.margin = money(new D(l.selling).minus(l.budget));
    l.selling_rate = new D(l.total_quantity).isZero() ? '0.000000' : estimateRatio([l.selling], l.total_quantity, 6);
    for (const k of ['direct', 'indirect', 'budget', 'selling']) l['company_' + k] = estimateRatio([l[k], header.rate]);
    l.company_indirect = money(new D(l.company_budget).minus(l.company_direct));
    l.company_margin = money(new D(l.company_selling).minus(l.company_budget));
  }
  const totalKeys = ['direct', 'indirect', 'budget', 'selling', 'margin', 'company_direct', 'company_indirect', 'company_budget', 'company_selling', 'company_margin'];
  const totals = Object.fromEntries(totalKeys.map(k => [k, money(sum(items.map(l => l[k])))]));
  totals.margin_percent = new D(totals.selling).isZero() ? null : new D(totals.margin).times(100).div(totals.selling).toFixed(2);
  const children = key => lines.filter(l => l.parent_key === key).flatMap(l => l.kind === 'item' ? [items.find(x => x.key === l.key)] : children(l.key));
  const groups = lines.filter(l => l.kind === 'group').map(l => ({
    ...l,
    ...Object.fromEntries(totalKeys.map(k => [k, money(sum(children(l.key).map(x => x[k])))]))
  }));
  const rows = lines.map(l => [...items, ...groups].find(r => r.key === l.key));
  return {
    policy: 'builder-estimate-v1',
    totals,
    rows,
    override_count: overrides.length,
    resource_count: resources.length,
    findings: [`${items.length} priced work items across ${header.buildings} building(s); ${overrides.length} explicit quantity override(s).`, `Estimated cost ${header.currency} ${totals.budget} includes ${totals.indirect} allocated indirect costs. Selling value before tax is ${totals.selling}.`, `Margin is ${header.currency} ${totals.margin}${totals.margin_percent === null ? '' : ` (${totals.margin_percent}% of selling value)`}; it is not recorded revenue or cash.`, ...[...items].sort((a, b) => new D(b.budget).cmp(a.budget)).slice(0, 3).map(l => `${l.code} · ${l.description}: estimated cost ${header.currency} ${l.budget}.`)]
  };
}
