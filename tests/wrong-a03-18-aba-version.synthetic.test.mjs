import test from 'node:test';
import assert from 'node:assert/strict';
const snapshot = s => JSON.stringify(s.records);
const read = s => ({content:snapshot(s), revision:s.revision});
const mutate = (s, records) => { s.records=records; s.revision++; };
test('A18-1: two content reads miss ABA', () => {
 const s={records:['photo-A'],revision:1}; const a=read(s);
 mutate(s,['photo-B']); mutate(s,['photo-A']); const b=read(s);
 assert.equal(a.content,b.content); assert.notEqual(a.revision,b.revision);
});
test('A18-2: revision rejects ABA even with identical content', () => {
 const s={records:['original'],revision:10}; const before=read(s);
 mutate(s,['changed']); mutate(s,['original']); const after=read(s);
 assert.equal(before.content,after.content); assert.equal(before.revision===after.revision,false);
});
test('A18-3: revision token alone does not prevent write after validation', () => {
 const s={records:['original'],revision:1}; const before=read(s); const after=read(s);
 assert.equal(before.revision,after.revision); mutate(s,['changed']);
 assert.notEqual(s.revision,after.revision);
});
test('A18-4: transaction-scoped version check rejects stale commit', () => {
 const s={records:['original'],revision:3}; const expected=s.revision;
 mutate(s,['other']); const commitIfCurrent = (revision,fn) => {
   if(s.revision!==revision) return false; fn(); s.revision++; return true;
 };
 assert.equal(commitIfCurrent(expected,()=>{s.records=['unsafe']}),false);
 assert.deepEqual(s.records,['other']);
});
