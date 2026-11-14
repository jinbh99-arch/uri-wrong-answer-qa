// NEW #61 00 direction: distinct synthetic A/B bearer tokens must never
// read or MODIFY the other family ledger, even when a caller spoofs a
// family hint or supplies the other family's signed (checksum-only) backup.
// Node HTTP and temporary AES-GCM test ledger only; not production auth.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'qa35-token-ledger-'));
const file=join(folder,'synthetic-encrypted.json');
const key=randomBytes(32).toString('hex');
const A='qa-token-ledger-a',B='qa-token-ledger-b',PA='QA-A-NOT-REAL-PASSWORD-2026',PB='QA-B-NOT-REAL-PASSWORD-2026';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const doc=(profile,id,photo)=>signSynthetic({
 format:'uriaimath-offline-backup-v02',profile,
 records:[{id,problemText:'synthetic '+id,hasPhoto:photo,practiceHistory:[],
  generalRetryHistory:[{answer:'가상 답',explanation:'가상 아이 설명',review:'needs_help',
   parentNote:'합성 부모 관찰'}]}],
 photos:photo?{[id]:PNG}:{},backupSummary:{recordCount:1,photoCount:photo?1:0}
});
const DOC_A=doc({nickname:'A-only',grade:3},'qa-photo-a',true);
const DOC_B=doc({nickname:'B-only',grade:5},'qa-text-b',false);
let gate,checks=0;const pass=s=>{checks++;console.log('PASS WRONG CROSS FAMILY TOKEN',s)};
async function call(path,method='GET',body,token,revision,extra={}){
 const headers={...extra,'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,data:await res.json(),etag:res.headers.get('etag')};
}
async function register(name,password){
 assert.equal((await call('/qa/register','POST',{familyKey:name,password})).status,201);
 const login=await call('/qa/login','POST',{familyKey:name,password});
 assert.equal(login.status,200);return login.data.token;
}
async function state(token){const r=await call('/qa/snapshot','GET',undefined,token);
 assert.equal(r.status,200);return r}
try{
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 const a=await register(A,PA),b=await register(B,PB);
 assert.notEqual(a,b);
 assert.equal((await call('/qa/snapshot','PUT',DOC_A,a,0)).status,200);
 assert.equal((await call('/qa/snapshot','PUT',DOC_B,b,0)).status,200);
 assert.equal((await state(a)).data.revision,1);
 assert.equal((await state(b)).data.revision,1);
 assert.deepEqual((await state(a)).data.snapshot,DOC_A);
 assert.deepEqual((await state(b)).data.snapshot,DOC_B);
 pass('서로 다른 불투명 토큰 A/B는 각자 오답·사진·학생 설명·부모 관찰만 읽고 원장 revision 1 독립');

 const initialCiphertext=readFileSync(file);
 // Additional family hint cannot redirect an authorized B read toward A.
 const spoof=await call('/qa/snapshot','GET',undefined,b,undefined,{
  'x-qa-family-key':A});
 assert.equal(spoof.status,200);
 assert.deepEqual(spoof.data.snapshot,DOC_B);
 assert.notDeepEqual(spoof.data.snapshot,DOC_A);
 assert.deepEqual(readFileSync(file),initialCiphertext);
 pass('B 토큰+위조 가족 요청 헤더로 GET해도 A 자료 노출 0, B 전용 내용 반환');

 const guessed=await call('/qa/snapshot?familyKey='+encodeURIComponent(A),'GET',undefined,b);
 assert.equal(guessed.status,404);
 assert.deepEqual(readFileSync(file),initialCiphertext);
 pass('가족 키를 URL로 지정해 A 기록을 조회하려는 B 요청 404, B 원장 불변');

 const wrongToken=await call('/qa/snapshot','GET',undefined,
  a.slice(0,-4)+'aaaa');
 assert.equal(wrongToken.status,401);
 assert.equal((await call('/qa/snapshot','PUT',DOC_A,undefined,1)).status,401);
 pass('위조된 토큰·미인증 쓰기 요청 401, 원장 읽기/쓰기 차단');

 const stale=await call('/qa/snapshot','PUT',DOC_A,b,0);
 assert.equal(stale.status,409);
 assert.equal(stale.data.error,'STALE_REVISION');
 assert.deepEqual((await state(a)).data.snapshot,DOC_A);
 assert.deepEqual((await state(b)).data.snapshot,DOC_B);
 pass('B 토큰이 A 복원 파일로 B의 지난 revision 0을 쓰려 해도 CAS 409, 양 원장 불변');

 const crossWrite=await call('/qa/snapshot','PUT',DOC_A,b,1);
 assert.equal(crossWrite.status,409);
 assert.deepEqual((await state(a)).data.snapshot,DOC_A);
 assert.deepEqual((await state(b)).data.snapshot,DOC_B);
 assert.deepEqual(readFileSync(file),initialCiphertext);
 pass('유효 B 토큰과 최신 B CAS로 A 사진·부모 관찰 백업을 올려도 다른 B 프로필 충돌 409·암호 원장 불변');

 const logout=await call('/qa/logout','POST',undefined,a);
 assert.equal(logout.status,200);
 assert.equal((await call('/qa/snapshot','GET',undefined,a)).status,401);
 assert.equal((await state(b)).data.revision,1);
 assert.deepEqual((await state(b)).data.snapshot,DOC_B);
 pass('A 세션 폐기 이후 A GET 401, 무관한 B 토큰·사진/관찰 원장 그대로');
 console.log('WRONG_QA35_TOKEN_LEDGER_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticFamilies:2,realNodeHttp:true,
  originalAandBEncryptedLedgersUnchanged:true,
  crossFamilyReads:0,unauthorizedCrossFamilyWrites:0,
  sourceAuthenticityProof:false,realFamilies:0,
  safeToRestore:false,deployment:false}));
}catch(err){
 console.error('WRONG_QA35_TOKEN_LEDGER_RESULT='+JSON.stringify({status:'FAIL',
  checks,error:String(err),stack:String(err?.stack).slice(0,1200),safeToRestore:false}));
 process.exitCode=1;
}finally{if(gate)await gate.shutdown();rmSync(folder,{recursive:true,force:true})}
