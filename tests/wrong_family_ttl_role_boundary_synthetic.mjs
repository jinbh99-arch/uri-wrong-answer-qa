/**
 * WRONG-02 TEST-ONLY in-memory session authorization fixture. Never production Auth.
 * Evaluates expiry, cross-family claims, child projections, logout/retry; no real data.
 * This does not protect same-origin localStorage/IndexedDB or enable backup/restore.
 * Reproduce: node --test --test-reporter=tap tests/wrong_family_ttl_role_boundary_synthetic.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
export const safeToRestore=false;
const TTL=60_000;
const USERS=Object.freeze({
  parentA:Object.freeze({family:'virtual-family-A',role:'guardian',password:'QA-ONLY-A-123456'}),
  childA:Object.freeze({family:'virtual-family-A',role:'child',password:'QA-ONLY-C-123456'}),
  parentB:Object.freeze({family:'virtual-family-B',role:'guardian',password:'QA-ONLY-B-123456'}),
});
const PHOTO_A=Buffer.from([137,80,78,71,13,10,26,10,65]);
const PHOTO_B=Buffer.from([137,80,78,71,13,10,26,10,66]);
const sha=x=>createHash('sha256').update(x).digest('hex');
const denied=why=>{throw Error('QA_DENIED_'+why)};
const clone=x=>structuredClone(x);
export class SessionBoundaryFixture {
  #sessions=new Map();#now;#families;
  constructor(clock=()=>Date.now()){
    this.#now=clock;
    this.#families=new Map([
      ['virtual-family-A',[{id:'syn-A',childAnswer:'synthetic answer A',guardianNote:'synthetic guardian A',photo:PHOTO_A.toString('base64')}]],
      ['virtual-family-B',[{id:'syn-B',childAnswer:'synthetic answer B',guardianNote:'synthetic guardian B',photo:PHOTO_B.toString('base64')}]],
    ]);
  }
  login(id,password){
    const p=USERS[id];if(!p || p.password!==password)denied('IDENTITY');
    const now=this.#now();if(!Number.isSafeInteger(now)||now<0)denied('CLOCK');
    const token=randomBytes(32).toString('hex');
    this.#sessions.set(token,{id,issuedAt:now,expiresAt:now+TTL});return token;
  }
  logout(token){this.#sessions.delete(token)}
  #session(token){
    if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))denied('SESSION');
    const s=this.#sessions.get(token);if(!s)denied('SESSION');
    const now=this.#now();
    if(!Number.isSafeInteger(now)||now<s.issuedAt){this.#sessions.delete(token);denied('CLOCK')}
    if(now>=s.expiresAt){this.#sessions.delete(token);denied('EXPIRED')}
    return {...s,principal:USERS[s.id]};
  }
  read(token,claimedFamily){
    const p=this.#session(token).principal;
    if(claimedFamily!==undefined&&claimedFamily!==p.family)denied('IDOR');
    const rows=clone(this.#families.get(p.family));
    return p.role==='child'?rows.map(({guardianNote,photo,...safe})=>safe):rows;
  }
  encryptedExportAllowed(token,claimedFamily){
    const p=this.#session(token).principal;
    if(p.role!=='guardian')denied('ROLE');
    if(claimedFamily!==undefined&&claimedFamily!==p.family)denied('IDOR');
    return {authorizedForSyntheticCryptoLab:true,actualExportPerformed:false,safeToRestore:false};
  }
  ledgerSha(family){return sha(JSON.stringify(this.#families.get(family)))}
  photoSha(family){return sha(Buffer.from(this.#families.get(family)[0].photo,'base64'))}
}
const mk=()=>{let ms=1_000_000;const lab=new SessionBoundaryFixture(()=>ms);
  return {lab,advance:n=>{ms+=n},a:lab.login('parentA',USERS.parentA.password),
    b:lab.login('parentB',USERS.parentB.password),child:lab.login('childA',USERS.childA.password)};
};
const baseline=lab=>['virtual-family-A','virtual-family-B'].map(f=>({family:f,ledgerSha:lab.ledgerSha(f),photoSha:lab.photoSha(f)}));
test('expiry at exact 60-second boundary blocks old token and repeated attempts',()=>{
  const {lab,a,advance}=mk();advance(59_999);
  assert.equal(lab.read(a)[0].id,'syn-A');advance(1);
  assert.throws(()=>lab.read(a),/QA_DENIED_EXPIRED/);
  assert.throws(()=>lab.read(a),/QA_DENIED_SESSION|QA_DENIED_EXPIRED/);
});
test('untrusted family ID/other family token cannot read or export cross-family records',()=>{
  const {lab,a,b}=mk(),before=baseline(lab);
  assert.throws(()=>lab.read(b,'virtual-family-A'),/IDOR/);
  assert.throws(()=>lab.read(a,'virtual-family-B'),/IDOR/);
  assert.throws(()=>lab.encryptedExportAllowed(b,'virtual-family-A'),/IDOR/);
  assert.deepEqual(baseline(lab),before);
});
test('child token hides guardian note/photo and cannot export or promote its role',()=>{
  const {lab,child}=mk(),row=lab.read(child,'virtual-family-A')[0];
  assert.equal(row.childAnswer,'synthetic answer A');
  assert.equal(Object.hasOwn(row,'guardianNote'),false);
  assert.equal(Object.hasOwn(row,'photo'),false);
  assert.throws(()=>lab.encryptedExportAllowed(child),/ROLE/);
});
test('logout revokes token even when old token is replayed in another tab',()=>{
  const {lab,a,advance}=mk(),before=baseline(lab);
  lab.logout(a);advance(10);
  assert.throws(()=>lab.read(a),/SESSION/);
  assert.throws(()=>lab.encryptedExportAllowed(a),/SESSION/);
  assert.throws(()=>new SessionBoundaryFixture(()=>1_000_010).read(a),/SESSION/);
  assert.deepEqual(baseline(lab),before);
});
test('forged ID, malformed bearer and bad fixture password fail closed',()=>{
  const {lab,b}=mk();
  assert.throws(()=>lab.login('virtual-family-A','QA-ONLY-A-123456'),/IDENTITY/);
  assert.throws(()=>lab.login('parentA','bad'),/IDENTITY/);
  assert.throws(()=>lab.read('virtual-family-A'),/SESSION/);
  assert.throws(()=>lab.read('f'.repeat(64)),/SESSION/);
  assert.equal(lab.read(b)[0].id,'syn-B');
});
test('browser same-origin plaintext remains an explicit UNSOLVED exposure',()=>{
  const {lab}=mk(),before=baseline(lab);
  const originStore=new Map([['wrong-guardian-note','synthetic guardian A']]);
  assert.equal(originStore.get('wrong-guardian-note'),'synthetic guardian A');
  assert.equal(safeToRestore,false);
  assert.deepEqual(baseline(lab),before);
});
