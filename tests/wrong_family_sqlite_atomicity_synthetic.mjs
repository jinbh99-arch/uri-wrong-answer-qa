/**
 * WRONG-02 standalone transaction failure model; SYNTHETIC family data only.
 * Node's built-in SQLite file DB is real SQLite, NOT IndexedDB, browser quota,
 * real family isolation, a production backup/restore or permission to restore.
 * Run: node --no-warnings --test --test-reporter=tap tests/wrong_family_sqlite_atomicity_synthetic.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes,createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const safeToRestore=false;
const PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reject=code=>{throw Error('QA_REJECT_'+code)};
const MAX_PHOTO=256*1024;
const MAX_BUNDLE=300*1024; // synthetic validation limit, NOT browser quota
const photo=(size=16,marker=65)=>{const b=Buffer.alloc(size,marker);PNG.copy(b);return b};
const item=(id,mark=65,bytes=16)=>({id,answer:'synthetic child answer',note:'synthetic parent note',photo:photo(bytes,mark)});
function validateOne(x){
 if(!x||typeof x.id!=='string'||!/^syn-[a-z0-9-]{1,32}$/.test(x.id)||
   typeof x.answer!=='string'||typeof x.note!=='string'||
   x.answer.length>512||x.note.length>512||!Buffer.isBuffer(x.photo)||
   x.photo.length<PNG.length||x.photo.length>MAX_PHOTO||
   !x.photo.subarray(0,PNG.length).equals(PNG))reject('INVALID_RECORD_OR_PHOTO');
}
function validatePlan(family,expectedRevision,records){
 if(!['virtual-family-A','virtual-family-B'].includes(family)||!Number.isSafeInteger(expectedRevision)||
   expectedRevision<0||!Array.isArray(records)||records.length<1||records.length>8)reject('SCHEMA');
 const seen=new Set();let total=0;
 for(const r of records){validateOne(r);if(seen.has(r.id))reject('DUPLICATE_PLAN');seen.add(r.id);
   total+=Buffer.byteLength(r.answer)+Buffer.byteLength(r.note)+r.photo.length;
   if(total>MAX_BUNDLE)reject('PHOTO_QUOTA_SIMULATION');
 }
}
function createLab(){
 const dir=mkdtempSync(join(tmpdir(),'wrong02-sqlite-qa-'));
 const file=join(dir,'synthetic.db');
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE family(family TEXT PRIMARY KEY, revision INTEGER NOT NULL);
 CREATE TABLE record(family TEXT NOT NULL, id TEXT NOT NULL, answer TEXT NOT NULL,
 note TEXT NOT NULL, photo BLOB NOT NULL, PRIMARY KEY(family,id),
 FOREIGN KEY(family) REFERENCES family(family));`);
 for(const f of ['virtual-family-A','virtual-family-B']){
  db.prepare('INSERT INTO family(family,revision) VALUES(?,?)').run(f,2);
  const r=item('syn-existing',f.endsWith('A')?65:66);
  db.prepare('INSERT INTO record(family,id,answer,note,photo) VALUES(?,?,?,?,?)')
    .run(f,r.id,r.answer,r.note,r.photo);
 }
 return {db,file,dispose(){db.close();rmSync(dir,{recursive:true,force:true})}};
}
function state(db,family){
 const rev=db.prepare('SELECT revision FROM family WHERE family=?').get(family)?.revision;
 const rows=db.prepare('SELECT id,answer,note,photo FROM record WHERE family=? ORDER BY id').all(family);
 const serialized=Buffer.concat([Buffer.from(JSON.stringify({family,rev})),
  ...rows.flatMap(r=>[Buffer.from(JSON.stringify({id:r.id,answer:r.answer,note:r.note,bytes:r.photo.length})),Buffer.from(r.photo)])]);
 return {revision:rev,rows:rows.length,ledgerSha256:sha(serialized),
   photosSha256:rows.map(r=>sha(r.photo)),photoBytes:rows.reduce((n,r)=>n+r.photo.length,0)};
}
function states(db){return ['virtual-family-A','virtual-family-B'].map(f=>({family:f,...state(db,f)}))}
function transaction(db,{sessionFamily,claimedFamily,expectedRevision=2,records,
  interruptAfter=null,syntheticCommit=false}={}){
 // Session family is trusted only within this TEST fixture, NOT real Auth.
 if(!['virtual-family-A','virtual-family-B'].includes(sessionFamily)||
    sessionFamily!==claimedFamily)reject('IDOR');
 validatePlan(sessionFamily,expectedRevision,records);
 const before=states(db);
 let active=false;
 try{
  db.exec('BEGIN IMMEDIATE');active=true;
  const current=db.prepare('SELECT revision FROM family WHERE family=?').get(sessionFamily);
  if(!current||current.revision!==expectedRevision)reject('STALE_REVISION');
  for(let i=0;i<records.length;i++){
   const r=records[i];
   db.prepare('INSERT INTO record(family,id,answer,note,photo) VALUES(?,?,?,?,?)')
     .run(sessionFamily,r.id,r.answer,r.note,r.photo);
   if(interruptAfter===i)reject('INTERRUPT_AFTER_WRITE');
  }
  db.prepare('UPDATE family SET revision=revision+1 WHERE family=?').run(sessionFamily);
  if(!syntheticCommit){
   db.exec('ROLLBACK');active=false;
   assert.deepEqual(states(db),before);
   return {safeToRestore:false,dryRunOnly:true,writes:0,validated:records.length};
  }
  // Only an isolated QA temp DB may ever reach here. Never a production restore.
  db.exec('COMMIT');active=false;
  return {safeToRestore:false,syntheticDatabaseCommit:true,writes:records.length};
 }catch(e){
  if(active)db.exec('ROLLBACK');
  assert.deepEqual(states(db),before,'failed transaction must preserve BOTH family ledgers and photos');
  throw e;
 }
}
function within(fn){const lab=createLab();try{return fn(lab)}finally{lab.dispose()}}
const aArgs=records=>({sessionFamily:'virtual-family-A',claimedFamily:'virtual-family-A',records});

test('A/B baseline photo byte digest and separate revision',()=>within(({db})=>{
 const s=states(db);if(process.env.WRONG_QA_HASHES==='1')console.log('QA_HASHES='+JSON.stringify(s));assert.equal(s.length,2);
 assert.notEqual(s[0].ledgerSha256,s[1].ledgerSha256);
 assert.notEqual(s[0].photosSha256[0],s[1].photosSha256[0]);
 assert.deepEqual(s.map(x=>x.revision),[2,2]);assert.equal(safeToRestore,false);
}));
test('actual SQLite dry-run stages 2 photo records then ROLLBACK leaves both families byte-identical',()=>within(({db})=>{
 const before=states(db);const r=transaction(db,aArgs([item('syn-new-1'),item('syn-new-2',70)]));
 assert.deepEqual(r,{safeToRestore:false,dryRunOnly:true,writes:0,validated:2});
 assert.deepEqual(states(db),before);
}));
test('injected interrupt AFTER first SQL INSERT restores both virtual family records/photos',()=>within(({db})=>{
 const before=states(db);assert.throws(()=>transaction(db,{...aArgs([item('syn-new-1'),item('syn-new-2')]),interruptAfter:0}),/INTERRUPT_AFTER_WRITE/);
 assert.deepEqual(states(db),before);
}));
test('duplicate key on second SQL INSERT triggers rollback even after first insert succeeded',()=>within(({db})=>{
 const before=states(db);assert.throws(()=>transaction(db,aArgs([item('syn-new-1'),item('syn-existing')])),/UNIQUE constraint/);
 assert.deepEqual(states(db),before);
}));
test('forged cross-family claim and stale revision reject without any family writes',()=>within(({db})=>{
 const before=states(db);
 assert.throws(()=>transaction(db,{...aArgs([item('syn-new')]),claimedFamily:'virtual-family-B'}),/IDOR/);
 assert.throws(()=>transaction(db,{...aArgs([item('syn-new')]),expectedRevision:1}),/STALE_REVISION/);
 assert.deepEqual(states(db),before);
}));
test('photo corruption and missing buffer reject before transaction, with hash invariant',()=>within(({db})=>{
 const before=states(db);
 const invalid=item('syn-new');invalid.photo[0]^=1;
 const missing={...item('syn-new'),photo:null};
 for(const r of [invalid,missing])assert.throws(()=>transaction(db,aArgs([r])),/INVALID_RECORD_OR_PHOTO/);
 assert.deepEqual(states(db),before);
}));
test('synthetic photo cap, bundle cap and repeated record IDs reject with zero writes',()=>within(({db})=>{
 const before=states(db);
 assert.throws(()=>transaction(db,aArgs([item('syn-huge',65,MAX_PHOTO+1)])),/INVALID_RECORD_OR_PHOTO/);
 assert.throws(()=>transaction(db,aArgs([item('syn-a',65,180*1024),item('syn-b',66,180*1024)])),/PHOTO_QUOTA_SIMULATION/);
 assert.throws(()=>transaction(db,aArgs([item('syn-dupe'),item('syn-dupe')])),/DUPLICATE_PLAN/);
 assert.deepEqual(states(db),before);
}));
test('explicit test-only SQLite commit + reopen persists A while family B SHA stays unchanged',()=>{
 const lab=createLab();let db=lab.db;const before=states(db);
 try{
  const result=transaction(db,{...aArgs([item('syn-new',77,128*1024)]),syntheticCommit:true});
  assert.deepEqual(result,{safeToRestore:false,syntheticDatabaseCommit:true,writes:1});
  const after=states(db);assert.notEqual(after[0].ledgerSha256,before[0].ledgerSha256);
  assert.deepEqual(after[1],before[1]);
  db.close();db=null;
  const reopened=new DatabaseSync(lab.file);
  try{assert.deepEqual(states(reopened),after)}finally{reopened.close()}
 }finally{if(db)db.close();rmSync(lab.file,{force:true});rmSync(lab.file.replace('/synthetic.db',''),{recursive:true,force:true})}
});
test('same-origin/shared-device plaintext is UNSOLVED by this SQLite transaction fixture',()=>within(({db})=>{
 const before=states(db);const localStorageMock=new Map([['guardianNote','synthetic guardian A']]);
 assert.equal(localStorageMock.get('guardianNote'),'synthetic guardian A');
 assert.deepEqual(states(db),before);assert.equal(safeToRestore,false);
}));
