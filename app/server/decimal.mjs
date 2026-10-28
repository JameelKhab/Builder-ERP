// Exact fixed-decimal arithmetic for the initial two-decimal currency model.
// Twelve fractional places preserve quantity(6) × price(6) before cent rounding.
// No monetary operation uses binary floating point. Other currency minor units
// require a currency-policy extension before use, rather than an implicit default.
const SCALE = 10n ** 12n;
function rounded(numerator, denominator) {
  if (denominator === 0n) throw new RangeError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator,
    d = denominator < 0n ? -denominator : denominator;
  const result = n / d + (n % d * 2n >= d ? 1n : 0n);
  return negative ? -result : result;
}
export class D {
  constructor(value) {
    if (value instanceof D) {
      this.scaled = value.scaled;
      return;
    }
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new TypeError('Use a decimal string, not a floating-point number');
    const text = String(value),
      match = /^(-?)(\d+)(?:\.(\d{1,12}))?$/.exec(text);
    if (!match) throw new TypeError('Invalid decimal');
    this.scaled = (BigInt(match[2]) * SCALE + BigInt((match[3] || '').padEnd(12, '0'))) * (match[1] ? -1n : 1n);
  }
  static raw(value) {
    const result = Object.create(D.prototype);
    result.scaled = value;
    return result;
  }
  plus(value) {
    return D.raw(this.scaled + new D(value).scaled);
  }
  minus(value) {
    return D.raw(this.scaled - new D(value).scaled);
  }
  times(value) {
    return D.raw(rounded(this.scaled * new D(value).scaled, SCALE));
  }
  div(value) {
    return D.raw(rounded(this.scaled * SCALE, new D(value).scaled));
  }
  abs() {
    return D.raw(this.scaled < 0n ? -this.scaled : this.scaled);
  }
  cmp(value) {
    const right = new D(value).scaled;
    return this.scaled < right ? -1 : this.scaled > right ? 1 : 0;
  }
  gt(value) {
    return this.cmp(value) > 0;
  }
  gte(value) {
    return this.cmp(value) >= 0;
  }
  lte(value) {
    return this.cmp(value) <= 0;
  }
  isZero() {
    return this.scaled === 0n;
  }
  toDecimalPlaces(places) {
    return new D(this.toFixed(places));
  }
  toFixed(places = 2) {
    if (!Number.isInteger(places) || places < 0 || places > 12) throw new RangeError('Unsupported decimal precision');
    const value = rounded(this.scaled, 10n ** BigInt(12 - places)),
      abs = value < 0n ? -value : value;
    const digits = abs.toString().padStart(places + 1, '0');
    return `${value < 0n ? '-' : ''}${places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits}`;
  }
}
