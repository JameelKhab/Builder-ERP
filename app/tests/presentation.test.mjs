import test from 'node:test';
import assert from 'node:assert/strict';
import {amount,numberText} from '../src/api.js';
test('money display preserves exact long amounts and fractional unit prices',()=>{
  assert.equal(amount('12345678901234567890.12','AED'),'AED 12,345,678,901,234,567,890.12');
  assert.equal(amount('900.123456','EUR'),'EUR 900.123456');
  assert.equal(amount('144000.00'),'AED 144,000');
  assert.equal(amount(null),'Not available');
  assert.equal(numberText('-100000.25'),'-100,000.25');
});
