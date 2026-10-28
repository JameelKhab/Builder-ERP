import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
test('implementation coverage retains all comparison functions and data contracts without certifying samples as parity',()=>{
 const source=read('docs/migration/comparison.json'),current=read('docs/implementation/coverage.json');
 for(const [key,count] of [['functions',267],['data_contracts',34],['domains',21]]){
  assert.equal(current[key].length,count);assert.deepEqual(current[key].map(r=>r.id).sort(),source[key].map(r=>r.id).sort());assert.equal(new Set(current[key].map(r=>r.id)).size,count);
 }
 for(const row of current.functions){assert.ok(['open','foundation','partial'].includes(row.local_status));assert.equal(row.parity_status,'unverified');for(const file of row.evidence)assert.ok(existsSync(new URL(file,root)),`${row.id} missing evidence ${file}`);}
});
