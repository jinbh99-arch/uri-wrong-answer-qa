// NEW differential boundary vs QA34: ACK lost AFTER server commit, then user
// CHANGES the pending draft. A new save must not fire; only fresh GET confirms.
// ISOLATED QA HTTP server, synthetic family/password. Not product auth/deploy.
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {createQaPendingAckGate} from '../scripts/qa-p0-ack-unknown-readback-gate.mjs';
const dir='qa-proof/wrong-p0-ack-unknown-new-delta';mkdirSync(dir,{recursive:true});
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const A='qa-ack-edited-draft-a',PASS='QA-SYNTHETIC-NONREAL-20261121!';
const id='qa-ack-uncertain-single-record',requestId='qa-only-ack-uncertain-request-001';
const original='문제 원문: 7 × 4 = ? (합성)',edited='보호자 수정 초안: 7 × 5 = ? (미전송)';
const row={id,problemText:original,hasPhoto:true,practiceHistory:[],
 generalRetryHistory:[{answer:'28',explanation:'가상 설명',review:'needs_help',parentNote:'보호자 전용 가상 메모'}]};
const doc=signSynthetic({format:'uriaimath-offline-backup-v02',
 profile:{nickname:'가상 A',grade:3},records:[row],photos:{[id]:PNG},
 backupSummary:{recordCount:1,photoCount:1}});
const photoHash=createHash('sha256').update(PNG).digest('hex');
let server,releaseHeld,resolveHeld,holdNext=false;
const ackHeld=new Promise(resolve=>{resolveHeld=resolve});
const count={snapshotPUT:0,snapshotGET:0,newSaveCallbacks:0},checks=[];
function pass(label){checks.push(label);console.log('PASS P0 ACK NEW',label)}
function emit(status,extra={}){
 const result={status,test:'unknown-ACK-changed-draft-readback',backend:'ACTUAL_SYNTHETIC_LOCALHOST_HTTP',
  checks,counts:count,requestId,recordId:id,photoSha256:photoHash,
  duplicateCreates:status.startsWith('PASS')?0:null,
  safeToRestore:false,realOperationalServerTested:false,realFamilyAuthTested:false,
  productAppIntegrated:false,oldQa34Rerun:false,oldW03Rerun:false,...extra};
 writeFileSync(dir+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log('WRONG_P0_ACK_CHANGED_DRAFT_RESULT='+JSON.stringify(result));
}
async function call(path,method='GET',data,token,revision){
 if(path==='/qa/snapshot'){if(method==='GET')count.snapshotGET++;if(method==='PUT')count.snapshotPUT++;}
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(data!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const response=await fetch(server.baseUrl+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
 return {status:response.status,body:await response.json(),etag:response.headers.get('etag')};
}
function putThenCutAck(payload,token,revision){
 count.snapshotPUT++;
 const data=JSON.stringify(payload),url=new URL(server.baseUrl+'/qa/snapshot');
 return new Promise((resolve,reject)=>{
  const req=httpRequest(url,{method:'PUT',headers:{
   authorization:'Bearer '+token,'if-match':'"'+revision+'"',
   'content-type':'application/json','content-length':Buffer.byteLength(data)
  }},r=>{r.resume();reject(Error('UNEXPECTED_ACK '+r.statusCode));});
  req.on('error',e=>String(e.message).includes('QA_ACK_CUT_AFTER_COMMIT')?resolve('ACK_CUT'):reject(e));
  req.end(data);
  ackHeld.then(()=>req.destroy(new Error('QA_ACK_CUT_AFTER_COMMIT')));
 });
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 server=await createIsolatedQaFamilyGateway({holdSnapshotPutAck:()=>{
  if(!holdNext)return;
  holdNext=false;resolveHeld();
  return new Promise(resolve=>{releaseHeld=resolve});
 }});
 assert.equal((await call('/qa/register','POST',{familyKey:A,password:PASS})).status,201);
 const login=await call('/qa/login','POST',{familyKey:A,password:PASS});
 assert.equal(login.status,200);
 const token=login.body.token;
 const client=createQaPendingAckGate({requestId,recordId:id,expectedRevision:0,signedSnapshot:doc,initialDraft:original});
 holdNext=true;
 const lost=putThenCutAck(doc,token,0);
 await Promise.race([ackHeld,new Promise((_,reject)=>setTimeout(()=>reject(Error('COMMIT_HOOK_TIMEOUT')),9000))]);
 assert.equal(await lost,'ACK_CUT');
 client.markUnknown();
 assert.equal(client.phase(),'ACK_UNKNOWN');
 pass('real local HTTP PUT was committed before client ACK loss');
 client.editDraft(edited);
 const blocked=await client.attemptNewWrite(async()=>{
  count.newSaveCallbacks++;return call('/qa/snapshot','PUT',doc,token,0);
 });
 assert.equal(blocked.status,'BLOCKED_PENDING_ACK');
 assert.equal(blocked.recordId,id);
 assert.equal(blocked.requestId,requestId);
 assert.equal(count.snapshotPUT,1);
 assert.equal(count.newSaveCallbacks,0);
 pass('parent changed draft; UNKNOWN blocks second PUT and keeps original identity');
 const verified=await client.confirmByReadback(()=>call('/qa/snapshot','GET',undefined,token));
 assert.equal(verified.status,'CONFIRMED_BY_READBACK');
 assert.equal(verified.revision,1);
 assert.equal(client.pendingDraft(),edited);
 pass('GET matches full signed snapshot, recordId, ETag and revision 1');
 releaseHeld();releaseHeld=null;
 const after=await call('/qa/snapshot','GET',undefined,token);
 assert.equal(after.status,200);
 assert.equal(after.body.revision,1);
 assert.equal(after.etag,'"1"');
 assert.deepEqual(after.body.snapshot,doc);
 assert.equal(after.body.snapshot.records.length,1);
 assert.equal(after.body.snapshot.records[0].id,id);
 assert.equal(after.body.snapshot.records[0].problemText,original);
 assert.equal(after.body.snapshot.photos[id],PNG);
 assert.equal(after.body.snapshot.records[0].generalRetryHistory[0].parentNote,'보호자 전용 가상 메모');
 assert.equal(count.snapshotPUT,1);
 assert.equal(count.snapshotGET,2);
 pass('independent GET confirms one stored row and original photo, history and parent memo');
 const mismatch=createQaPendingAckGate({requestId:'qa-unconfirmed-second',recordId:id,
  expectedRevision:0,signedSnapshot:doc,initialDraft:edited});
 mismatch.markUnknown();
 const falseReceipt={...after,body:{...after.body,snapshot:{...doc,records:[{...row,problemText:edited}]}}};
 const denied=await mismatch.confirmByReadback(async()=>falseReceipt);
 assert.equal(denied.status,'UNVERIFIED');
 assert.equal(mismatch.phase(),'ACK_UNKNOWN');
 assert.equal(count.snapshotPUT,1);
 pass('different server content is NOT a valid readback receipt, still no extra PUT');
 emit('PASS_ISOLATED_NEW_HTTP_BOUNDARY',{
  serverRevision:1,serverRecordCount:1,extraRecords:0,automaticResends:0,
  changedDraftPreserved:true,originalPhotoPreserved:true,
  originalParentObservationPreserved:true,confirmedByRealHttpGET:true,verifiedETag:'"1"',
  originalSnapshotSha256:createHash('sha256').update(JSON.stringify(doc)).digest('hex')});
}catch(e){
 emit('FAIL',{error:String(e),stack:String(e?.stack).slice(0,1600)});
 process.exitCode=1;
}finally{
 if(releaseHeld)releaseHeld();
 if(server)await server.shutdown();
}
