import test from 'node:test';
import assert from 'node:assert/strict';
import { D } from '../server/decimal.mjs';
test('rounding boundaries and negative values use half away from zero', () => {
  for (const [value, expected] of [['0.004', '0.00'], ['0.005', '0.01'], ['-0.005', '-0.01'], ['-1.234', '-1.23'], ['9.995', '10.00']]) assert.equal(new D(value).toFixed(2), expected);
  assert.equal(new D('999999999999.999999').times('999999999999.999999').toFixed(2), '999999999999999998000000.00');
  assert.throws(() => new D(0.1));
  assert.throws(() => new D('NaN'));
  assert.throws(() => new D('2').div(0));
});
test('cent round-trip for positive and negative values', () => {
  for (let cents = -10000; cents <= 10000; cents += 37) {
    const sign = cents < 0 ? '-' : '',
      n = Math.abs(cents);
    const text = `${sign}${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`;
    assert.equal(new D(text).plus('0.01').minus('0.01').toFixed(2), text);
  }
  assert.equal(new D('600000').div(1000000).toFixed(1), '0.6');
});
test('exact decimal string serialization preserves integer zeros and fractional precision',()=>{
 for(const [value,expected] of [['0','0'],['100','100'],['100.000000','100'],['0.000001','0.000001'],['-12.2300','-12.23']])assert.equal(new D(value).toString(),expected);
});
