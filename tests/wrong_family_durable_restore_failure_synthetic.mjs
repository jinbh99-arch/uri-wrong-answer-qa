/**
 * WRONG-02: temporary-file crash/restore safety lab. SYNTHETIC DATA ONLY.
 * Uses fs atomic rename, NOT IndexedDB or the shipping application's backup.
 * Never authorize real restoration: safeToRestore stays false.
 * Run: node --test --test-reporter=tap wrong_family_durable_restore_failure_synthetic.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';

export const safeToRestore = false;
const MAGIC='WRONG02_FS_QA_ONLY_V1';
const PNG=Buffer.from([137,80,78,71,13,10,26,10,0,1,2,3]);
const MAX_PHOTO=256*1024;
const hash=x=>createHash('sha256').update(x).digest('hex');
const reject=why=>{throw new Error('QA_REJECT_'+why)};
const b64=x=>Buffer.from(x).toString('base64');
function bytes(s,n){
 if(typeof s!=='string'||!s||s.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))reject('BASE64');
 const out=Buffer.from(s,'base64');
 if(b64(out)!==s||(n!==undefined&&out.length!==n))reject('BASE64');
 return out;
}
function photo(size=PNG.length){
 const x=Buffer.alloc(size,9);PNG.copy(x);
 return {mime:'image/png',size,content:b64(x)};
}
function snapshot(family,revision,records){return {schema:1,family,revision,records}}
function validate(v,family){
 if(!v||v.schema!==1||v.family!==family||!Number.isSafeInteger(v.revision)||v.revision<0||
    !Array.isArray(v.records)||v.records.length>8)reject('SCHEMA');
 const ids=new Set();
 for(const r of v.records){
  if(!r||typeof r.id!=='string'||!/^syn-[a-z0-9-]{1,32}$/.test(r.id)||ids.has(r.id))reject('ID');
  ids.add(r.id);
  if(typeof r.childAnswer!=='string'||typeof r.guardianNote!=='string'||
     r.childAnswer.length>512||r.guardianNote.length>512||r.photo?.mime!=='image/png'||
     !Number.isInteger(r.photo.size)||r.photo.size<8||r.photo.size>MAX_PHOTO)reject('RECORD');
  const raw=bytes(r.photo.content,r.photo.size);
  if(!raw.subarray(0,8).equals(PNG.subarray(0,8)))reject('PHOTO');
 }
 return v;
}
function seal(v,family,key){
 validate(v,family);if(!Buffer.isBuffer(key)||key.length!==32)reject('KEY');
 const iv=randomBytes(12),aad=Buffer.from(`${MAGIC}|${family}|${v.revision}`);
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);
 const c=Buffer.concat([cipher.update(JSON.stringify(v)),cipher.final()]);
 return JSON.stringify({magic:MAGIC,family,revision:v.revision,iv:b64(iv),tag:b64(cipher.getAuthTag()),ciphertext:b64(c)});
}
function unseal(raw,family,key){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>1024*1024)reject('FILE');
 let e;try{e=JSON.parse(raw)}catch{reject('JSON')}
 if(!e||Object.keys(e).sort().join(',')!=='ciphertext,family,iv,magic,revision,tag'||
    e.magic!==MAGIC||e.family!==family||!Number.isSafeInteger(e.revision))reject('ENVELOPE');
 let content;
 try{
  const d=createDecipheriv('aes-256-gcm',key,bytes(e.iv,12));
  d.setAAD(Buffer.from(`${MAGIC}|${family}|${e.revision}`));
  d.setAuthTag(bytes(e.tag,16));
  content=JSON.parse(Buffer.concat([d.update(bytes(e.ciphertext)),d.final()]).toString('utf8'));
 }catch{reject('AUTH')}
 if(content.revision!==e.revision)reject('REVISION');
 return validate(content,family);
}
async function lab(fn){
 const dir=await mkdtemp(join(tmpdir(),'wrong02-fs-qa-'));
 try{return await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
async function atomicFixtureCommit(path,expectedRevision,next,{abort=false,interruptAfterStage=false,commit=false}={}){
 // A file-stage simulation only. 'commit' may be true ONLY for temporary synthetic paths.
 if(!path.includes('wrong02-fs-qa-'))reject('NON_QA_PATH');
 const oldRaw=await readFile(path,'utf8'),before=JSON.parse(oldRaw);
 if(abort)reject('ABORT');
 validate(next,before.family);
 if(before.revision!==expectedRevision||next.revision!==expectedRevision+1)reject('STALE');
 if(next.records.some(x=>before.records.some(y=>x.id===y.id)))reject('COLLISION');
 const staging=path+'.staging';
 try{
  await writeFile(staging,JSON.stringify(next),{flag:'wx',mode:0o600});
  if(interruptAfterStage)reject('INTERRUPTED');
  if(!commit)return {safeToRestore:false,dryRunOnly:true,writes:0};
  await rename(staging,path); // QA fixture ONLY. Not IndexedDB atomicity evidence.
  return {safeToRestore:false,syntheticTempPublished:true,writes:1};
 }finally{await rm(staging,{force:true})}
}
const initial=f=>snapshot(f,2,[{id:'syn-existing',childAnswer:'가상 풀이',guardianNote:'가상 관찰',photo:photo()}]);
const incoming=f=>snapshot(f,3,[{id:'syn-next',childAnswer:'가상 새 풀이',guardianNote:'가상 새 관찰',photo:photo()}]);

test('encrypted virtual photo survives exact byte round trip with no plaintext',()=>{
 const family='synthetic-A',key=randomBytes(32),v=incoming(family),file=seal(v,family,key);
 assert.equal(file.includes('가상 새 관찰'),false);
 const got=unseal(file,family,key);
 assert.equal(Buffer.compare(bytes(got.records[0].photo.content),bytes(v.records[0].photo.content)),0);
 assert.equal(safeToRestore,false);
});
test('key replacement cannot unlock rotated file; old offline copy stays decryptable with OLD key',()=>{
 const f='synthetic-A',oldKey=randomBytes(32),newKey=randomBytes(32),v=incoming(f);
 const oldFile=seal(v,f,oldKey),newFile=seal(unseal(oldFile,f,oldKey),f,newKey);
 assert.throws(()=>unseal(newFile,f,oldKey),/AUTH/);
 assert.throws(()=>unseal(oldFile,f,newKey),/AUTH/);
 assert.deepEqual(unseal(oldFile,f,oldKey),v); // Important retention risk, not key revocation.
});
test('family switch, encrypted header/tag/ciphertext mutation all fail closed',()=>{
 const f='synthetic-A',key=randomBytes(32),file=seal(incoming(f),f,key);
 assert.throws(()=>unseal(file,'synthetic-B',key),/ENVELOPE/);
 for(const field of ['iv','tag','ciphertext']){
  const obj=JSON.parse(file),p=bytes(obj[field]);p[0]^=1;obj[field]=b64(p);
  assert.throws(()=>unseal(JSON.stringify(obj),f,key),/AUTH/);
 }
 const obj=JSON.parse(file);obj.revision++;
 assert.throws(()=>unseal(JSON.stringify(obj),f,key),/AUTH/);
});
test('schema drift, missing/corrupt image, and oversized photo reject before disk writes',async()=>{
 await lab(async dir=>{
  const f='synthetic-A',path=join(dir,'family-A.json'),base=initial(f);
  await writeFile(path,JSON.stringify(base));const pre=hash(await readFile(path));
  for(const change of [v=>{v.schema=99},v=>{delete v.records[0].photo},
      v=>{v.records[0].photo.content=b64(Buffer.alloc(12,7))},
      v=>{v.records[0].photo=photo(MAX_PHOTO+1)}]){
   const v=structuredClone(incoming(f));change(v);
   await assert.rejects(atomicFixtureCommit(path,2,v,{commit:true}),/QA_REJECT_/);
   assert.equal(hash(await readFile(path)),pre);
  }
 });
});
test('interrupted stage, cancellation, collision and stale revision preserve BOTH family files',async()=>{
 await lab(async dir=>{
  const a=join(dir,'family-A.json'),b=join(dir,'family-B.json');
  await writeFile(a,JSON.stringify(initial('synthetic-A')));
  await writeFile(b,JSON.stringify(initial('synthetic-B')));
  const before=[hash(await readFile(a)),hash(await readFile(b))];
  await assert.rejects(atomicFixtureCommit(a,2,incoming('synthetic-A'),{commit:true,interruptAfterStage:true}),/INTERRUPTED/);
  await assert.rejects(atomicFixtureCommit(a,2,incoming('synthetic-A'),{abort:true,commit:true}),/ABORT/);
  const collision=incoming('synthetic-A');collision.records[0].id='syn-existing';
  await assert.rejects(atomicFixtureCommit(a,2,collision,{commit:true}),/COLLISION/);
  await assert.rejects(atomicFixtureCommit(a,1,incoming('synthetic-A'),{commit:true}),/STALE/);
  assert.deepEqual([hash(await readFile(a)),hash(await readFile(b))],before);
  await assert.rejects(readFile(a+'.staging'),/ENOENT/);
 });
});
test('read-only dry-run writes zero, synthetic temp publish requires explicit opt-in',async()=>{
 await lab(async dir=>{
  const a=join(dir,'family-A.json'),b=join(dir,'family-B.json');
  await writeFile(a,JSON.stringify(initial('synthetic-A')));
  await writeFile(b,JSON.stringify(initial('synthetic-B')));
  const before=hash(await readFile(a)),other=hash(await readFile(b));
  const plan=await atomicFixtureCommit(a,2,incoming('synthetic-A'));
  assert.deepEqual(plan,{safeToRestore:false,dryRunOnly:true,writes:0});
  assert.equal(hash(await readFile(a)),before);
  const result=await atomicFixtureCommit(a,2,incoming('synthetic-A'),{commit:true});
  assert.deepEqual(result,{safeToRestore:false,syntheticTempPublished:true,writes:1});
  assert.equal(JSON.parse(await readFile(a,'utf8')).revision,3);
  assert.equal(hash(await readFile(b)),other);
 });
});
test('offline plaintext input cannot masquerade as authenticated encrypted envelope',()=>{
 const f='synthetic-A',key=randomBytes(32);
 assert.throws(()=>unseal(JSON.stringify(incoming(f)),f,key),/ENVELOPE/);
 assert.throws(()=>unseal('not-json',f,key),/JSON/);
});
