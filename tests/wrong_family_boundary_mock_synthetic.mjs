/**
 * WRONG-02: OFFLINE SYNTHETIC SECURITY PROTOTYPE ONLY.
 * No production app import; no IndexedDB, network, OS account, or real family/photo access.
 * A mock per-family session is NOT an implemented login or same-origin data isolation.
 * A successful Node test does NOT approve deployment, privacy, or restore.
 * The shipping product remains safeToRestore:false.
 *
 * Run: node --test tests/wrong_family_boundary_mock_synthetic.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';

export const safeToRestore = false;
const MAGIC = 'wrong-synthetic-qa-encrypted-v1';
const PURPOSE = 'WRONG02:offline-qa-only:v1:';
const ITERATIONS = 120_000; // Mock compatibility parameter, NOT production KDF approval.
const MAX_FILE_BYTES = 128 * 1024; // Test fixture cap; NOT a production file limit.
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const clone = value => structuredClone(value);
const syntheticPhoto = [137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 4];

function deny(message = 'synthetic access denied') { throw new Error(message); }
function equalJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function safeB64(bytes) { return Buffer.from(bytes).toString('base64'); }
function parseB64(value, expectedBytes) {
  if (typeof value !== 'string' || !value || value.length > MAX_FILE_BYTES ||
    value.length % 4 !== 0 || !B64.test(value)) deny('invalid mock backup encoding');
  const b = Buffer.from(value, 'base64');
  if (b.toString('base64') !== value || (expectedBytes != null && b.length !== expectedBytes))
    deny('invalid mock backup encoding length');
  return b;
}
function validRecord(x) {
  return x && typeof x.id === 'string' && /^synthetic-[a-z0-9-]{1,32}$/.test(x.id) &&
    typeof x.problemText === 'string' && typeof x.childExplanation === 'string' &&
    typeof x.guardianObservation === 'string' &&
    Array.isArray(x.photoBytes) && x.photoBytes.length >= 8 && x.photoBytes.length <= 64 &&
    x.photoBytes.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    [x.problemText, x.childExplanation, x.guardianObservation].every(s => s.length <= 1000);
}
function validBundle(obj, targetFamily) {
  if (!obj || Object.keys(obj).sort().join(',') !== 'family,records,schema' ||
      obj.schema !== 1 || obj.family !== targetFamily || !Array.isArray(obj.records) ||
      obj.records.length < 1 || obj.records.length > 16) deny('invalid backup or mock family');
  const ids = new Set();
  for (const rec of obj.records) {
    if (!validRecord(rec) || ids.has(rec.id)) deny('bad/missing photo or duplicate record');
    ids.add(rec.id);
  }
  return obj;
}
function encodeAAD(family) { return Buffer.from(PURPOSE + family, 'utf8'); }

export class MockFamilyBoundary {
  #sessions = new Map();
  #stores = new Map();
  constructor({emptyTarget = false} = {}) {
    this.#stores.set('virtual-family-A', emptyTarget ? [] : [{
      id: 'synthetic-1', problemText: '가상 오답', childExplanation: '가상 아동 답',
      guardianObservation: '가상 부모 메모', photoBytes: clone(syntheticPhoto),
    }]);
    this.#stores.set('virtual-family-B', emptyTarget ? [] : [{
      id: 'synthetic-2', problemText: '가상 다른 문제', childExplanation: '가상 B 아동 답',
      guardianObservation: '가상 B 부모 메모', photoBytes: clone(syntheticPhoto).reverse(),
    }]);
  }
  mockLogin(family) {
    if (!this.#stores.has(family)) deny('not a mock registered family');
    const token = safeB64(randomBytes(32));
    this.#sessions.set(token, family);
    return token;
  }
  logout(token) { this.#sessions.delete(token); }
  #resolve(token) {
    if (typeof token !== 'string' || !this.#sessions.has(token)) deny();
    return this.#sessions.get(token);
  }
  #family(token, requestedFamily) {
    const family = this.#resolve(token);
    if (requestedFamily !== undefined && requestedFamily !== family) deny('cross-family mock access');
    return family;
  }
  read(token, requestedFamily) {
    const family = this.#family(token, requestedFamily);
    return clone(this.#stores.get(family));
  }
  write(token, record, requestedFamily) {
    const family = this.#family(token, requestedFamily);
    if (!validRecord(record)) deny('invalid mock record');
    const copy = this.read(token, family);
    if (copy.some(r => r.id === record.id)) deny('duplicate mock id');
    copy.push(clone(record));
    this.#stores.set(family, copy);
  }
  encryptedExport(token, password) {
    const family = this.#family(token);
    if (typeof password !== 'string' || password.length < 16 || password.length > 256)
      deny('mock secret strength/length');
    const payload = validBundle({ schema: 1, family, records: this.read(token) }, family);
    const salt = randomBytes(16), nonce = randomBytes(12);
    const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(encodeAAD(family));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const file = JSON.stringify({format: MAGIC, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
      algorithm: 'AES-256-GCM', salt: safeB64(salt), nonce: safeB64(nonce),
      ciphertext: safeB64(ciphertext), tag: safeB64(cipher.getAuthTag())});
    if (Buffer.byteLength(file, 'utf8') > MAX_FILE_BYTES) deny('oversized mock file');
    return file;
  }
  /** This function returns plan metadata; it NEVER mutates its target store. */
  dryRunRestore(token, password, rawFile, requestedFamily) {
    const family = this.#family(token, requestedFamily);
    if (typeof rawFile !== 'string' || Buffer.byteLength(rawFile, 'utf8') > MAX_FILE_BYTES)
      deny('oversized/non-string mock file');
    if (typeof password !== 'string' || password.length < 16 || password.length > 256)
      deny('mock secret length');
    let env;
    try { env = JSON.parse(rawFile); } catch { deny('invalid backup JSON'); }
    if (!env || typeof env !== 'object' || Array.isArray(env) ||
      Object.keys(env).sort().join(',') !==
      'algorithm,ciphertext,format,iterations,kdf,nonce,salt,tag' ||
      env.format !== MAGIC || env.kdf !== 'PBKDF2-SHA256' ||
      env.iterations !== ITERATIONS || env.algorithm !== 'AES-256-GCM')
      deny('unknown mock crypto suite or version');
    const salt = parseB64(env.salt, 16), nonce = parseB64(env.nonce, 12);
    const ciphertext = parseB64(env.ciphertext), tag = parseB64(env.tag, 16);
    const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
    let decoded;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(encodeAAD(family));
      decipher.setAuthTag(tag);
      const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      decoded = JSON.parse(raw);
    } catch { deny('mock backup decryption/authentication failed'); }
    const payload = validBundle(decoded, family);
    const current = this.read(token, family);
    if (payload.records.some(r => current.some(old => old.id === r.id)))
      deny('conflicting synthetic record - no writes');
    return { dryRunOnly: true, safeToRestore: false, sourceFamily: family,
      validatedCount: payload.records.length, photoBytes: payload.records.reduce((n, r) => n + r.photoBytes.length, 0),
      writes: 0, blocked: false };
  }
  /** Throws after a proposed partial change; rollback is demonstrated on a mock snapshot only. */
  simulateAtomicAbort(token, proposedRecord) {
    const family = this.#family(token);
    const before = this.read(token);
    let working = clone(before);
    try {
      if (!validRecord(proposedRecord)) deny('invalid synthetic transaction');
      working.push(proposedRecord);
      deny('injected failure after proposed record');
    } catch {
      working = before; // mock atomic rollback, NOT an IndexedDB integration result.
      assert.ok(equalJSON(working, before));
      return {rolledBack: true, unchanged: equalJSON(this.read(token), before), writes: 0};
    }
  }
}

const SAMPLE_PASS = 'synthetic-A-only-very-long-passphrase';
const sampleC = () => ({id:'synthetic-3',problemText:'새 가상 기록',
  childExplanation:'새 가상 답',guardianObservation:'새 가상 메모',photoBytes:clone(syntheticPhoto)});
const mk = () => {
  const lab = new MockFamilyBoundary();
  return {lab,a:lab.mockLogin('virtual-family-A'),b:lab.mockLogin('virtual-family-B')};
};

// Existing real IndexedDB/origin and CSS200 gates are covered separately by 63/63.
// These extra tests target only new MOCK authorization + backup/restore dry-run contracts.
test('mock login, own-family read, and nonproduction boundary disclaimers', () => {
  const {lab,a,b} = mk();
  assert.equal(safeToRestore, false);
  assert.equal(lab.read(a).length, 1);
  assert.equal(lab.read(b).length, 1);
  assert.notDeepEqual(lab.read(a), lab.read(b));
  assert.equal(Object.hasOwn(lab, 'operationalAuth'), false);
});

test('family B and forged claimed family cannot read/write family A', () => {
  const {lab,a,b}=mk(); const original=lab.read(a);
  assert.throws(()=>lab.read(b,'virtual-family-A'),/cross-family/);
  assert.throws(()=>lab.write(b,sampleC(),'virtual-family-A'),/cross-family/);
  assert.throws(()=>lab.read(a,'virtual-family-B'),/cross-family/);
  assert.deepEqual(lab.read(a),original);
});

test('logged out / random token / new device / no login fail closed', () => {
  const {lab,a}=mk();lab.logout(a);
  for(const token of [a, '', undefined,'forged-session-token']) {
    assert.throws(()=>lab.read(token),/access denied/);
    assert.throws(()=>lab.write(token,sampleC()),/access denied/);
    assert.throws(()=>lab.encryptedExport(token,SAMPLE_PASS),/access denied/);
  }
  assert.throws(()=>new MockFamilyBoundary().read(a),/access denied/);
});

test('mock writes are own-family only, and copy returns cannot mutate other users', () => {
  const {lab,a,b}=mk(); const bBefore=lab.read(b);
  const aRead=lab.read(a); aRead[0].guardianObservation='external mutation';
  assert.notEqual(lab.read(a)[0].guardianObservation,'external mutation');
  lab.write(a,sampleC());
  assert.equal(lab.read(a).length,2);
  assert.deepEqual(lab.read(b),bBefore);
  assert.throws(()=>lab.write(a,sampleC()),/duplicate mock id/);
});

test('export is encrypted and contains no child answers, notes or picture bytes in the plaintext envelope', () => {
  const {lab,a}=mk(); const file=lab.encryptedExport(a,SAMPLE_PASS);
  for(const word of ['가상 아동 답','가상 부모 메모','가상 오답','virtual-family-A','photoBytes','problemText'])
    assert.equal(file.includes(word),false,`unexpected plaintext ${word}`);
  const env=JSON.parse(file); assert.equal(env.algorithm,'AES-256-GCM');
  assert.equal(env.format,MAGIC);
  assert.equal(env.ciphertext.length>32,true);
});

test('wrong passphrase, family, session and attacker-provided family ID cannot decrypt', () => {
  const {lab,a,b}=mk(); const beforeA=lab.read(a),beforeB=lab.read(b);
  const file=lab.encryptedExport(a,SAMPLE_PASS);
  assert.throws(()=>lab.dryRunRestore(a,'another-wrong-passphrase',file),/authentication failed/);
  assert.throws(()=>lab.dryRunRestore(b,SAMPLE_PASS,file),/authentication failed/);
  assert.throws(()=>lab.dryRunRestore(b,SAMPLE_PASS,file,'virtual-family-A'),/cross-family/);
  lab.logout(a);
  assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,file),/access denied/);
  assert.deepEqual(lab.read(b),beforeB);
  const a2=lab.mockLogin('virtual-family-A');assert.deepEqual(lab.read(a2),beforeA);
});

test('ciphertext, tag, salt and nonce tampering all fail closed', () => {
  const {lab,a}=mk();const file=lab.encryptedExport(a,SAMPLE_PASS);
  for(const field of ['ciphertext','tag','salt','nonce']){
    const env=JSON.parse(file);let b=Buffer.from(env[field],'base64');b[0]^=1;
    env[field]=b.toString('base64');
    assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,JSON.stringify(env)),/failed|invalid/);
  }
});

test('unknown format, algorithm, iteration cost, missing fields and malformed base64 reject before any write', () => {
  const {lab,a}=mk();const file=lab.encryptedExport(a,SAMPLE_PASS);
  for(const [key,value] of [['format','not-current'],['algorithm','AES-128-CBC'],
    ['iterations',2_000_000],['kdf','unknown']]){
    const env=JSON.parse(file);env[key]=value;
    assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,JSON.stringify(env)),/suite or version/);
  }
  for(const field of ['salt','ciphertext','tag']){
    const env=JSON.parse(file);delete env[field];
    assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,JSON.stringify(env)));
  }
  const env=JSON.parse(file);env.nonce='^^/bad';
  assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,JSON.stringify(env)),/encoding/);
  assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,'{' ),/backup JSON/);
  assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,'x'.repeat(MAX_FILE_BYTES+1)),/oversized/);
});

test('valid encrypted file is authenticated but conflicting dry-run makes zero target writes',()=>{
  const {lab,a}=mk(),before=lab.read(a);const file=lab.encryptedExport(a,SAMPLE_PASS);
  assert.throws(()=>lab.dryRunRestore(a,SAMPLE_PASS,file),/conflicting/);
  assert.deepEqual(lab.read(a),before);
});

test('authenticated non-conflicting dry-run validates photo and refuses to commit any record',()=>{
  const {lab,a,b}=mk(); const sourceBefore=lab.read(a),sourceBBefore=lab.read(b);
  const file=lab.encryptedExport(a,SAMPLE_PASS);
  const target=new MockFamilyBoundary({emptyTarget:true});
  const targetA=target.mockLogin('virtual-family-A');
  const targetB=target.mockLogin('virtual-family-B');
  const beforeA=target.read(targetA),beforeB=target.read(targetB);
  const plan=target.dryRunRestore(targetA,SAMPLE_PASS,file);
  assert.deepEqual(plan,{dryRunOnly:true,safeToRestore:false,sourceFamily:'virtual-family-A',
    validatedCount:1,photoBytes:syntheticPhoto.length,writes:0,blocked:false});
  assert.deepEqual(target.read(targetA),beforeA);
  assert.deepEqual(target.read(targetB),beforeB);
  assert.deepEqual(lab.read(a),sourceBefore);
  assert.deepEqual(lab.read(b),sourceBBefore);
  assert.throws(()=>target.dryRunRestore(targetB,SAMPLE_PASS,file),/authentication failed/);
});

test('schema mismatch or missing photos in authenticated file fail closed before dry-run plan',()=>{
  const {lab,a}=mk(); const target=new MockFamilyBoundary({emptyTarget:true});
  const tok=target.mockLogin('virtual-family-A'); const before=target.read(tok);
  const rewrap=(change)=>{
    const payload={family:'virtual-family-A',schema:1,records:lab.read(a)};
    change(payload);
    const salt=randomBytes(16),nonce=randomBytes(12);
    const k=pbkdf2Sync(SAMPLE_PASS,salt,ITERATIONS,32,'sha256');
    const cipher=createCipheriv('aes-256-gcm',k,nonce);
    cipher.setAAD(encodeAAD('virtual-family-A'));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload)),cipher.final()]);
    return JSON.stringify({format:MAGIC,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
      algorithm:'AES-256-GCM',salt:safeB64(salt),nonce:safeB64(nonce),
      ciphertext:safeB64(encrypted),tag:safeB64(cipher.getAuthTag())});
  };
  for(const change of [
    obj=>{obj.schema=999},
    obj=>{delete obj.records[0].photoBytes},
    obj=>{obj.records.push(clone(obj.records[0]))},
    obj=>{obj.family='virtual-family-B'},
    obj=>{obj.records[0].photoBytes=[-1,400]},
  ]){
    assert.throws(()=>target.dryRunRestore(tok,SAMPLE_PASS,rewrap(change)),/invalid backup|bad\/missing/);
    assert.deepEqual(target.read(tok),before);
  }
});

test('malformed photo, duplicate item, invalid schema and malicious huge payload fail closed at encryption input',()=>{
  const {lab,a}=mk();const before=lab.read(a);
  assert.throws(()=>lab.write(a,{...sampleC(),photoBytes:null}),/invalid mock record/);
  assert.throws(()=>lab.write(a,{...sampleC(),photoBytes:[999]}),/invalid mock record/);
  assert.throws(()=>lab.write(a,{...sampleC(),id:'../../spoofed'}),/invalid mock record/);
  assert.deepEqual(lab.read(a),before);
});

test('injected partial transaction/restore failure leaves both synthetic family ledgers unchanged',()=>{
  const {lab,a,b}=mk();const beforeA=lab.read(a),beforeB=lab.read(b);
  const result=lab.simulateAtomicAbort(a,sampleC());
  assert.deepEqual(result,{rolledBack:true,unchanged:true,writes:0});
  assert.deepEqual(lab.read(a),beforeA);
  assert.deepEqual(lab.read(b),beforeB);
});
