/**
 * WRONG-02: synthetic security extension; no production imports, data or restoration.
 * Do NOT infer real authentication or shared-device confidentiality. safeToRestore:false.
 * node --test tests/wrong_family_security_delta_synthetic.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash,pbkdf2Sync,createCipheriv,createDecipheriv} from 'node:crypto';
export const safeToRestore=false;
const F=['virtual-family-A','virtual-family-B'];
const C={parentA:{family:F[0],role:'guardian',secret:'credential-A-synthetic'},
 childA:{family:F[0],role:'child',secret:'credential-C-synthetic'},
 parentB:{family:F[1],role:'guardian',secret:'credential-B-synthetic'}};
const PW='synthetic-password-long-0123456789';
const NEW_PW='synthetic-password-rotated-9876543210';
const MAX=256*1024, VERSION=2, ITER=120000, MAGIC='wrong02-testonly';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bad=x=>{throw Error('blocked: '+x)};
const copy=x=>structuredClone(x);
function fixture(id,size=1024){const buf=Buffer.alloc(size,65);buf.set([137,80,78,71,13,10,26,10]);
 return {id,childAnswer:'가상 아이 답',guardianNote:'가상 부모 메모',
   photo:buf.toString('base64'),photoSize:size,mime:'image/png'};}
function valid(r){
 if(!r||typeof r.id!=='string'||!/^syn-[a-z0-9-]+$/.test(r.id)||
 typeof r.childAnswer!=='string'||typeof r.guardianNote!=='string'||r.mime!=='image/png')bad('record');
 if(!Number.isInteger(r.photoSize)||r.photoSize<8||r.photoSize>MAX)bad('photo quota');
 const p=Buffer.from(r.photo||'','base64');
 if(p.toString('base64')!==r.photo||p.length!==r.photoSize||
 !p.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))bad('missing/corrupt photo');
}
function enc(family,records,pass,version=2){
 if(![1,2].includes(version)||pass.length<16)bad('suite');
 records.forEach(valid);
 const salt=randomBytes(16),iv=randomBytes(12),key=pbkdf2Sync(pass,salt,ITER,32,'sha256');
 const c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(MAGIC+':'+version+':'+family));
 const payload=JSON.stringify({schema:VERSION,family,records});
 const data=Buffer.concat([c.update(payload),c.final()]);
 const file=JSON.stringify({magic:MAGIC,version,iterations:ITER,algorithm:'AES-256-GCM',
  salt:salt.toString('base64'),iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')});
 if(Buffer.byteLength(file)>2*MAX)bad('backup quota');
 return file;
}
function dec(file,pass,family){
 if(typeof file!=='string'||Buffer.byteLength(file)>2*MAX)bad('backup quota');
 let v;try{v=JSON.parse(file)}catch{bad('json')}
 if(!v||Object.keys(v).sort().join(',')!=='algorithm,data,iterations,iv,magic,salt,tag,version'||
 v.magic!==MAGIC||![1,2].includes(v.version)||v.algorithm!=='AES-256-GCM'||v.iterations!==ITER)bad('suite');
 const read=(s,n)=>{if(typeof s!=='string'||s.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))bad('base64');
  const b=Buffer.from(s,'base64');if(b.toString('base64')!==s||(n!=null&&b.length!==n))bad('base64');return b};
 const key=pbkdf2Sync(pass,read(v.salt,16),ITER,32,'sha256');
 let payload;try{const d=createDecipheriv('aes-256-gcm',key,read(v.iv,12));
 d.setAAD(Buffer.from(MAGIC+':'+v.version+':'+family));d.setAuthTag(read(v.tag,16));
 payload=JSON.parse(Buffer.concat([d.update(read(v.data)),d.final()]).toString('utf8'))}catch{bad('authenticated decrypt')}
 if(!payload||payload.schema!==VERSION||payload.family!==family||!Array.isArray(payload.records))bad('schema/family');
 const ids=new Set();for(const r of payload.records){valid(r);if(ids.has(r.id))bad('duplicate');ids.add(r.id)}
 return payload.records;
}
class Boundary {
 #tokens=new Map();#stores=new Map([[F[0],[fixture('syn-a')]],[F[1],[fixture('syn-b')] ]]);
 login(id,secret){const p=C[id];if(!p||p.secret!==secret)bad('identity');const t=randomBytes(32).toString('hex');
 this.#tokens.set(t,p);return t;}
 logout(t){this.#tokens.delete(t)}
 #claim(t,family,role){const p=this.#tokens.get(t);if(!p)bad('no session');
 if(family&&family!==p.family)bad('IDOR');if(role&&role!==p.role)bad('role');return p}
 read(t,f){const p=this.#claim(t,f);const records=copy(this.#stores.get(p.family));
 return p.role==='child'?records.map(({guardianNote,photo,...visible})=>visible):records}
 export(t,password){const p=this.#claim(t,undefined,'guardian');return enc(p.family,this.#stores.get(p.family),password)}
 digest(f){return digest(this.#stores.get(f))}
 dryRun(t,password,file,{family,abort}={}){const p=this.#claim(t,family,'guardian');
  if(abort?.aborted)bad('aborted');const before=this.digest(p.family);
  const records=dec(file,password,p.family);if(abort?.aborted)bad('aborted');
  if(records.some(r=>this.#stores.get(p.family).some(x=>x.id===r.id)))bad('collision');
  assert.equal(this.digest(p.family),before);
  return {safeToRestore:false,onlyDryRun:true,writes:0,photoBytes:records.reduce((n,r)=>n+r.photoSize,0)}}
}
const newLab=()=>{const lab=new Boundary();return {lab,a:lab.login('parentA',C.parentA.secret),
 b:lab.login('parentB',C.parentB.secret),child:lab.login('childA',C.childA.secret)}};
test('fixture secret, forged IDOR and family B access denied',()=>{
 const {lab,a,b}=newLab(),before=lab.digest(F[0]);
 assert.throws(()=>lab.login('virtual-family-A','bad'),/identity/);
 assert.throws(()=>lab.read(b,F[0]),/IDOR/);
 assert.throws(()=>lab.read(a,F[1]),/IDOR/);
 assert.equal(lab.digest(F[0]),before);
});
test('child role cannot export, guardian private note and photo are not returned',()=>{
 const {lab,child}=newLab();const row=lab.read(child)[0];
 assert.equal(Object.hasOwn(row,'guardianNote'),false);assert.equal(Object.hasOwn(row,'photo'),false);
 assert.throws(()=>lab.export(child,PW),/role/);
});
test('logged out token/new instance fail closed',()=>{
 const {lab,a}=newLab();lab.logout(a);assert.throws(()=>lab.read(a),/session/);
 assert.throws(()=>new Boundary().read(a),/session/);
});
test('same-origin storage is readable across tabs: expected exposure, not mitigation',()=>{
 const originStorage=new Map([['wrong-parent-memo','가상 부모 메모']]);
 assert.equal(originStorage.get('wrong-parent-memo'),'가상 부모 메모');
 assert.equal(safeToRestore,false);
});
test('encrypted export and simulated key rotation invalidate prior passphrase',()=>{
 const {lab,a}=newLab(),file=lab.export(a,PW),old=dec(file,PW,F[0]);
 assert.equal(file.includes('가상 부모 메모'),false);
 const rotated=enc(F[0],old,NEW_PW,2);
 assert.deepEqual(dec(rotated,NEW_PW,F[0]),old);
 assert.throws(()=>dec(rotated,PW,F[0]),/decrypt/);
 assert.notEqual(JSON.parse(file).iv,JSON.parse(rotated).iv);
});
test('wrong password, alternate family, tag mutation and suite tampering rejected',()=>{
 const {lab,a,b}=newLab(),file=enc(F[0],[fixture('syn-new')],PW);
 assert.throws(()=>lab.dryRun(a,NEW_PW,file),/decrypt/);
 assert.throws(()=>lab.dryRun(b,PW,file),/decrypt/);
 for(const field of ['tag','iv','salt','data']){const v=JSON.parse(file),p=Buffer.from(v[field],'base64');p[0]^=1;
 v[field]=p.toString('base64');assert.throws(()=>dec(JSON.stringify(v),PW,F[0]),/decrypt|base64/)}
 const v=JSON.parse(file);v.iterations=1;assert.throws(()=>dec(JSON.stringify(v),PW,F[0]),/suite/);
});
test('nonconflicting dry-run, collision, abort, missing photo and schema migration make no writes',()=>{
 const {lab,a}=newLab(),a0=lab.digest(F[0]),b0=lab.digest(F[1]);
 const clean=enc(F[0],[fixture('syn-new')],PW),plan=lab.dryRun(a,PW,clean);
 assert.deepEqual(plan,{safeToRestore:false,onlyDryRun:true,writes:0,photoBytes:1024});
 assert.throws(()=>lab.dryRun(a,PW,enc(F[0],[fixture('syn-a')],PW)),/collision/);
 const ctrl=new AbortController();ctrl.abort();
 assert.throws(()=>lab.dryRun(a,PW,clean,{abort:ctrl.signal}),/aborted/);
 const missing=fixture('syn-new');delete missing.photo;
 assert.throws(()=>lab.dryRun(a,PW,enc(F[0],[missing],PW)),/photo/);
 const v=JSON.parse(clean);v.version=3;assert.throws(()=>dec(JSON.stringify(v),PW,F[0]),/suite/);
 assert.equal(lab.digest(F[0]),a0);assert.equal(lab.digest(F[1]),b0);
});
test('128KiB mock photo byte equality and oversized invalid quota',()=>{
 const photo=fixture('syn-large',128*1024),file=enc(F[0],[photo],PW);
 assert.equal(dec(file,PW,F[0])[0].photo,photo.photo);
 const {lab,a}=newLab();assert.equal(lab.dryRun(a,PW,file).photoBytes,128*1024);
 assert.throws(()=>enc(F[0],[fixture('syn-huge',MAX+1)],PW),/photo quota/);
});
test('offline encrypted file dry-run is read-only and plaintext never falls back',()=>{
 const {lab,a}=newLab(),first=lab.digest(F[0]);
 assert.throws(()=>lab.dryRun(a,PW,JSON.stringify({family:F[0],records:[fixture('syn-new')]})),/suite/);
 assert.equal(lab.digest(F[0]),first);
});
