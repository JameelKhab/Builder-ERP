import { D } from './decimal.mjs';
export { D };
export class DomainError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}
export const requireThat = (condition, message, status) => {
  if (!condition) throw new DomainError(message, status);
};
export function decimal(value, name = 'Amount', allowZero = true) {
  requireThat(typeof value === 'string' && /^\d{1,12}(\.\d{1,6})?$/.test(value), `${name} must be a positive decimal with at most 6 decimal places.`);
  const result = new D(value);
  requireThat(allowZero ? result.gte(0) : result.gt(0), `${name} must be greater than zero.`);
  return result;
}
export const money = value => new D(value).toFixed(2);
export const sum = values => values.reduce((total, value) => total.plus(value), new D(0));
export function price(quantity, unitPrice, rate) {
  const original = decimal(quantity, 'Quantity', false).times(decimal(unitPrice, 'Unit price')).toDecimalPlaces(2);
  return {
    amount: money(original),
    companyAmount: money(original.times(decimal(rate, 'Exchange rate', false)))
  };
}
