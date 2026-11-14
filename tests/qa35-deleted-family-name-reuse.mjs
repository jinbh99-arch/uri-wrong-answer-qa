// QA35 new counterexample only: a deleted synthetic family name must not be
// re-registered into the SAME gateway instance. Otherwise the QA browser UI,
// which is bound to family name + gateway instance, could unlock orphaned local
// photos/parent observations for a newly registered account.
// No real account, client IndexedDB, production deletion or auth claim.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'qa35-deleted-identity-'));
const file=join(folder,'synthetic-aes-gcm.json');
const encryptionKey=randomBytes(32).toString('hex');
const FAMILY_A='qa-delete-reuse-family',FAMILY_B='qa-unaffected-family',FAMILY_C='qa-fresh-family-c';
const P1='QA35-OLD-SYNTHETIC-PASSWORD-2026',P2='QA35-DIFFERENT-NEW-PASSWORD-2026';
const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const docA=signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{nickname:'QA-old-A',grade:3},
 records:[{id:'qa-old-photo-only',problemText:'합성 아이 A 사진 문제',
  hasPhoto:true,practiceHistory:[],
  generalRetryHistory:[{answer:'합성 아이 A 답',explanation:'합성 아이의 설명',
   review:'needs_help',parentNote:'합성 보호자 관찰'}]}],
 photos:{'qa-old-photo-only':picture},
 backupSummary:{recordCount:1,photoCount:1}
});
const docB=signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{nickname:'QA-unaffected-B',grade:5},
 records:[{id:'qa-b-isolated',problemText:'합성 가족 B 문제',hasPhoto:false,practiceHistory:[]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}
});
let gateway,checks=0;const pass=s=>{checks++;console.log('PASS WRONG DELETED FAMILY REUSE',s)};
async function call(path,method='GET',body,token,rev){
 const headers={'cache-control':'no-store'};
 if(body!==undefined)headers['content-type']='application/json';
 if(token)headers.authorization='Bearer '+token;
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 const res=await fetch(gateway.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,body:await res.json(),etag:res.headers.get('etag')};
}
async function register(name,password=P1){
 return call('/qa/register','POST',{familyKey:name,password});
}
async function login(name,password=P1){
 const result=await call('/qa/login','POST',{familyKey:name,password});
 assert.equal(result.status,200,JSON.stringify(result.body));return result.body;
}
async function snapshot(token){
 const response=await call('/qa/snapshot','GET',undefined,token);
 assert.equal(response.status,200);return response.body;
}
try{
 gateway=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey});
 assert.equal((await register(FAMILY_A)).status,201);
 assert.equal((await register(FAMILY_B)).status,201);
 const a1=await login(FAMILY_A),a2=await login(FAMILY_A),b=await login(FAMILY_B);
 assert.equal(a1.gatewayInstanceId,a2.gatewayInstanceId);
 assert.match(a1.gatewayInstanceId,/^[0-9a-f]{48}$/);
 assert.equal((await call('/qa/snapshot','PUT',docA,a1.token,0)).status,200);
 assert.equal((await call('/qa/snapshot','PUT',docB,b.token,0)).status,200);
 assert.deepEqual((await snapshot(a1.token)).snapshot,docA);
 assert.equal((await snapshot(b.token)).revision,1);
 pass('가상 A 사진·학생 설명·부모 관찰 및 B 원장 분리; 동일 게이트웨이 실행 식별자 확인');

 const confirm={familyKey:FAMILY_A,password:P1,approved:true,
  confirmation:'DELETE_SYNTHETIC_FAMILY'};
 const removed=await call('/qa/family','DELETE',confirm,a2.token,1);
 assert.equal(removed.status,200,JSON.stringify(removed.body));
 assert.equal(removed.body.deleted,true);
 assert.equal(removed.body.forensicEraseGuaranteed,false);
 const encryptedAfterDelete=readFileSync(file);
 // Before a new login attempt can mutate the synthetic login-failure limiter,
 // assert that denied re-registration itself makes no storage changes.
 const reRegisterOld=await register(FAMILY_A,P1);
 assert.equal(reRegisterOld.status,409);
 assert.equal(reRegisterOld.body.error,'DELETED_FAMILY_KEY_RESERVED_IN_GATEWAY');
 assert.deepEqual(readFileSync(file),encryptedAfterDelete);
 const reRegisterNew=await register(FAMILY_A,P2);
 assert.equal(reRegisterNew.status,409);
 assert.equal(reRegisterNew.body.error,'DELETED_FAMILY_KEY_RESERVED_IN_GATEWAY');
 assert.deepEqual(readFileSync(file),encryptedAfterDelete);
 pass('삭제 직후 같은 서버·같은 가족 ID 재등록 2종 409, 기존 가림 화면을 새 계정으로 열 수 없음');

 assert.equal((await call('/qa/snapshot','GET',undefined,a1.token)).status,401);
 assert.equal((await call('/qa/snapshot','GET',undefined,a2.token)).status,401);
 const stale=await call('/qa/login','POST',{familyKey:FAMILY_A,password:P1});
 assert.equal(stale.status,401);
 assert.equal((await snapshot(b.token)).revision,1);
 assert.deepEqual((await snapshot(b.token)).snapshot,docB);
 pass('삭제된 A 모든 기존 세션·로그인 차단, 가족 B 기록·개정번호 불변');

 const newC=await register(FAMILY_C,P2);
 assert.equal(newC.status,201);
 const c=await login(FAMILY_C,P2);
 assert.equal(c.gatewayInstanceId,a1.gatewayInstanceId);
 const cSnap=await snapshot(c.token);
 assert.equal(cSnap.revision,0);assert.equal(cSnap.snapshot,null);
 assert.deepEqual((await snapshot(b.token)).snapshot,docB);
 pass('다른 새 가상 가족 C는 등록 가능하되 A 사진·관찰에 자동 접근하거나 상속하지 않음');

 const oldId=a1.gatewayInstanceId;
 await gateway.shutdown();gateway=null;
 gateway=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey});
 const oldBSession=await call('/qa/snapshot','GET',undefined,b.token);
 assert.equal(oldBSession.status,401);
 const liveB=await login(FAMILY_B);
 assert.notEqual(liveB.gatewayInstanceId,oldId,
  'restarted gateway must never share the old browser-bound instance');
 assert.deepEqual((await snapshot(liveB.token)).snapshot,docB);
 pass('가상 서버 재시작 시 새 실행 식별자로 과거 브라우저 바인딩 분리, B 암호 원장 유지');

 // Fresh server/gateway may re-register that name for an EMPTY independent
 // synthetic account; old browser-bound instance ID prevents local reopen.
 const freshA=await register(FAMILY_A,P2);
 assert.equal(freshA.status,201,JSON.stringify(freshA.body));
 const newA=await login(FAMILY_A,P2);
 assert.notEqual(newA.gatewayInstanceId,oldId);
 assert.equal((await snapshot(newA.token)).revision,0);
 assert.equal((await snapshot(newA.token)).snapshot,null);
 assert.deepEqual((await snapshot(liveB.token)).snapshot,docB);
 pass('재시작 후 같은 이름 새 계정은 빈 상태·새 실행 ID, 삭제 전 A 사진/관찰 복원되지 않음');

 console.log('WRONG_QA35_DELETED_NAME_REUSE_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticOnly:true,realHttp:true,encryptedTempLedger:true,
  deletedNameBlockedInSameInstance:true,restartChangesInstance:true,
  familyBPreserved:true,productionAuth:false,forensicEraseGuaranteed:false,
  safeToRestore:false,deployed:false}));
}catch(err){
 console.error('WRONG_QA35_DELETED_NAME_REUSE_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1100),
  safeToRestore:false}));process.exitCode=1;
}finally{
 if(gateway)await gateway.shutdown();
 rmSync(folder,{recursive:true,force:true});
}
