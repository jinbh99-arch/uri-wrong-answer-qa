// QA34 NEW boundary: a PUT commits to the real in-memory localhost gateway,
// but the HTTP ACK is deliberately cut off before the client sees it.
// Explicit CAS reread/replay must not duplicate revisions/records/photos or
// mix two distinct synthetic family ledgers. NOT production auth/restore.
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

const PASS='QA-SYNTHETIC-ACK-LOSS-NOT-REAL-PASSWORD-2026';
const A='qa-lost-ack-a',B='qa-lost-ack-b';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
let gateway,checks=0,holdNext=false,resolveHeld,releaseHeld;
const ackHeld=new Promise(resolve=>{resolveHeld=resolve});
const pass=name=>{checks++;console.log('PASS WRONG ACK CAS',name)};
const parentProfile={nickname:'QA 합성 가족 A',grade:3};
const rowA={id:'qa-lost-ack-photo-a',problemText:'합성 사진 오답 A',
 hasPhoto:true,practiceHistory:[],generalRetryHistory:[{
  answer:'가상 아이 답',explanation:'가상 아이의 다시 생각한 이유',
  review:'needs_help',parentNote:'가상 보호자 관찰'}]};
const rowB={id:'qa-only-family-b',problemText:'B 전용 합성 오답',
 hasPhoto:false,practiceHistory:[]};
const createDoc=(profile,records,photos={})=>signSynthetic({
 format:'uriaimath-offline-backup-v02',profile,records,photos,
 backupSummary:{recordCount:records.length,photoCount:Object.keys(photos).length}
});
const docA=createDoc(parentProfile,[rowA],{[rowA.id]:PNG});
const docB=createDoc({nickname:'QA 합성 가족 B',grade:5},[rowB]);
const docA2=createDoc(parentProfile,[rowA,{
 id:'qa-added-after-ack-loss',problemText:'A 추가 합성 오답',hasPhoto:false,practiceHistory:[]
}],{[rowA.id]:PNG});

async function call(path,method='GET',body,token,revision){
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const res=await fetch(gateway.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,body:await res.json(),etag:res.headers.get('etag')};
}
async function family(familyKey){
 assert.equal((await call('/qa/register','POST',{familyKey,password:PASS})).status,201);
 const response=await call('/qa/login','POST',{familyKey,password:PASS});
 assert.equal(response.status,200);
 return response.body.token;
}
// A real HTTP PUT with a fully transmitted JSON body. The gateway's test-only
// end hook signals AFTER its synchronous commit, BEFORE res.end emits the ACK.
function sendPutAndLoseAck(doc,token,revision){
 const body=JSON.stringify(doc),url=new URL(gateway.baseUrl+'/qa/snapshot');
 return new Promise((resolve,reject)=>{
  const req=httpRequest(url,{method:'PUT',headers:{
   authorization:'Bearer '+token,'if-match':'"'+revision+'"',
   'content-type':'application/json','content-length':Buffer.byteLength(body)
  }},response=>{
   response.resume();
   reject(Error('UNEXPECTED_ACK_VISIBLE_TO_CLIENT status '+response.statusCode));
  });
  req.on('error',err=>{
   if(String(err.message).includes('QA_INTENTIONAL_ACK_LOSS'))resolve(err.message);
   else reject(err);
  });
  req.end(body);
  ackHeld.then(()=>req.destroy(new Error('QA_INTENTIONAL_ACK_LOSS')));
 });
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gateway=await createIsolatedQaFamilyGateway({holdSnapshotPutAck:()=>{
  if(!holdNext)return;
  holdNext=false;
  resolveHeld();
  return new Promise(resolve=>{releaseHeld=resolve});
 }});
 const a1=await family(A),a2=(await call('/qa/login','POST',{familyKey:A,password:PASS})).body.token;
 const b1=await family(B);
 const bFirst=await call('/qa/snapshot','PUT',docB,b1,0);
 assert.equal(bFirst.status,200);assert.equal(bFirst.body.revision,1);
 assert.deepEqual((await call('/qa/snapshot','GET',undefined,b1)).body.snapshot,docB);
 pass('두 가상 가족 분리, B 합성 원장 revision 1 및 A 사진·관찰 미혼입');

 holdNext=true;
 const lost=sendPutAndLoseAck(docA,a1,0);
 await Promise.race([ackHeld,new Promise((_,reject)=>setTimeout(()=>reject(Error('SERVER_DID_NOT_COMMIT_ACK_TEST')),7000))]);
 // At this instant, the server has committed but the wire acknowledgement has
 // not been emitted. A different valid session can already read revision 1.
 const committed=await call('/qa/snapshot','GET',undefined,a2);
 assert.equal(committed.status,200);
 assert.equal(committed.body.revision,1);
 assert.equal(committed.etag,'"1"');
 assert.deepEqual(committed.body.snapshot,docA);
 assert.equal(committed.body.snapshot.photos[rowA.id],PNG);
 assert.equal(committed.body.snapshot.records[0].generalRetryHistory[0].review,'needs_help');
 pass('PUT ACK 대기 중 서버는 먼저 revision 1 커밋·사진/학생 설명/보호자 관찰 전부 보존');

 const lostReason=await lost;
 assert.match(lostReason,/QA_INTENTIONAL_ACK_LOSS/);
 releaseHeld();
 const confirmed=await call('/qa/snapshot','GET',undefined,a1);
 assert.equal(confirmed.body.revision,1);
 assert.deepEqual(confirmed.body.snapshot,docA);
 pass('실제 HTTP ACK만 유실, 별도 GET은 확정 서버 revision 1 반환');

 const stale=await call('/qa/snapshot','PUT',docA,a1,0);
 assert.equal(stale.status,409);
 assert.equal(stale.body.error,'STALE_REVISION');
 assert.equal((await call('/qa/snapshot','GET',undefined,a2)).body.revision,1);
 pass('ACK 유실 뒤 구 개정번호 0 그대로 재전송은 CAS 409, 중복 저장 0');

 // After explicitly inspecting the server snapshot, resending identical signed
 // bytes with fresh CAS must remain a NO-OP, not create a duplicate revision.
 const identical=await call('/qa/snapshot','PUT',docA,a2,1);
 assert.equal(identical.status,200,JSON.stringify(identical.body));
 assert.equal(identical.body.unchanged,true);
 assert.equal(identical.body.revision,1);
 assert.equal(identical.etag,'"1"');
 assert.deepEqual((await call('/qa/snapshot','GET',undefined,a1)).body.snapshot,docA);
 pass('명시적 서버 재조회 후 동일 사진 백업 재전송: revision 그대로 1, 변동 없음');

 // A subsequent legitimate append still advances exactly one CAS version.
 const append=await call('/qa/snapshot','PUT',docA2,a1,1);
 assert.equal(append.status,200,JSON.stringify(append.body));
 assert.equal(append.body.revision,2);
 const after=await call('/qa/snapshot','GET',undefined,a2);
 assert.equal(after.body.revision,2);
 assert.deepEqual(after.body.snapshot,docA2);
 assert.equal(after.body.snapshot.records.length,2);
 assert.equal(Object.keys(after.body.snapshot.photos).length,1);
 pass('진짜 새 오답 1건만 추가할 때 revision 1→2, 기존 사진·관찰 그대로');

 const olderReplay=await call('/qa/snapshot','PUT',docA,a1,1);
 assert.equal(olderReplay.status,409);
 assert.equal((await call('/qa/snapshot','GET',undefined,a1)).body.revision,2);
 pass('새 저장 뒤 과거 revision 1 재시도는 409, 최신 원장과 사진 무변경');

 // Try the A backup with B's valid credential and B's current CAS.
 // This must NOT overwrite already-stored B data; synthetic user accounts
 // must never be interpreted as real-family access control.
 const otherFamilyPayload=await call('/qa/snapshot','PUT',docA,b1,1);
 assert.equal(otherFamilyPayload.status,409);
 const finalB=await call('/qa/snapshot','GET',undefined,b1);
 assert.equal(finalB.body.revision,1);
 assert.deepEqual(finalB.body.snapshot,docB);
 assert.equal(finalB.body.snapshot.records.length,1);
 assert.equal(Object.keys(finalB.body.snapshot.photos).length,0);
 assert.equal((await call('/qa/snapshot','GET')).status,401);
 pass('기존 B 원장에 A 사진 백업을 끼워넣는 PUT 거절, B revision/내용 불변·미인증 차단');

 console.log('WRONG_PUT_ACK_LOSS_CAS_RESULT='+JSON.stringify({status:'PASS',checks,
  actualNodeHttp:true,ackDroppedAfterCommit:true,duplicateRevisions:0,
  familyLedgers:2,originalPhotoPreserved:true,parentObservationPreserved:true,
  syntheticOnly:true,realFamilyAuthorization:false,safeToRestore:false,deploy:false}));
}catch(err){
 console.error('WRONG_PUT_ACK_LOSS_CAS_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(err),stack:String(err?.stack).slice(0,1500),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(releaseHeld)releaseHeld();
 if(gateway)await gateway.shutdown();
}
