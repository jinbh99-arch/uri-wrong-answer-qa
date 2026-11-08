// QA30: actual local-only consented three-way merge commits, validated encrypted
// revision ancestry and concurrent body-stream race hardening. SYNTHETIC ONLY.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const password='SYNTHETIC-QA30-NOT-A-REAL-PASSWORD-2026';
const row=(id,answer='가상 오답')=>({id,problemText:'SYNTHETIC_QA30_'+id,studentAnswer:answer,
 hasPhoto:false,practiceHistory:[]});
const doc=rows=>signSynthetic({
 format:'uriaimath-offline-backup-v02',profile:{nickname:'SYNTHETIC_QA30',grade:3},
 backupSummary:{recordCount:rows.length,photoCount:0},records:rows,photos:{}
});
const initial=doc([row('q-a'),row('q-b')]);
const aEdit=doc([row('q-a','QA30 기기A 수정'),row('q-b')]);
const bEdit=doc([row('q-a'),row('q-b','QA30 기기B 수정')]);
const bothA=doc([row('q-a','QA30 기기A 수정'),row('q-b','QA30 기기B 수정')]);
const tmp=mkdtempSync(join(tmpdir(),'qa30-synthetic-'));
const file=join(tmp,'encrypted-families.json');
const key=randomBytes(32).toString('hex');
let server,checks=0;
const pass=s=>{checks++;console.log('PASS QA30 G15',s)};
async function call(path,method='GET',body,token,revision){
 const headers={};if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined&&revision!==null)headers['if-match']='"'+revision+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const res=await fetch(server.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:res.status,data:await res.json(),etag:res.headers.get('etag')};
}
async function registerAndLogin(family){
 assert.equal((await call('/qa/register','POST',{familyKey:family,password})).status,201);
 const login=await call('/qa/login','POST',{familyKey:family,password});
 assert.equal(login.status,200);return login.data.token;
}
function slowPut(body,token,rev){
 // Keep the HTTP request body open after sending part of JSON. Another client
 // can commit while the first is awaiting the rest: must reject the stale write.
 const json=JSON.stringify(body),url=new URL(server.baseUrl+'/qa/snapshot');
 let finish;
 const outcome=new Promise((resolve,reject)=>{
  const req=httpRequest(url,{method:'PUT',headers:{
   authorization:'Bearer '+token,'if-match':'"'+rev+'"',
   'content-type':'application/json','transfer-encoding':'chunked'
  }},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));
   res.on('end',()=>resolve({status:res.statusCode,
    data:JSON.parse(Buffer.concat(chunks).toString())}));
  });
  req.on('error',reject);
  req.write(json.slice(0,Math.floor(json.length/2)));
  finish=()=>req.end(json.slice(Math.floor(json.length/2)));
 });
 return {outcome,finish:()=>finish()};
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 process.env.QA_DURABLE_TEST_ONLY='1';
 server=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 const A=await registerAndLogin('qa-30-family-a'),B=await registerAndLogin('qa-30-family-b');
 assert.equal((await call('/qa/snapshot','PUT',initial,A,0)).status,200);
 assert.equal((await call('/qa/snapshot','GET',undefined,B)).data.snapshot,null);
 pass('분리된 가족 B에서는 가족 A의 기준본/병합기록 조회 불가능');
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:aEdit,approved:false},A,1)).status,428);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:aEdit,approved:true},A)).status,428);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:aEdit,approved:true})).status,401);
 pass('사용자 확인·If-Match·인증 토큰 중 하나만 없어도 병합 저장 거부');
 const first=await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:aEdit,approved:true},A,1);
 assert.equal(first.status,200,JSON.stringify(first.data));
 assert.equal(first.data.revision,2);
 assert.equal(first.data.approvedManualMerge,true);
 assert.equal((await call('/qa/snapshot','GET',undefined,A)).data.snapshot.records[0].studentAnswer,'QA30 기기A 수정');
 pass('과거 서버 기준본에서 기기 A의 명시적 수정 1건을 최초 승인 후 원자적 저장');
 const preview=await call('/qa/sync-preview','POST',{base:initial,local:bEdit},A);
 assert.equal(preview.status,200);
 assert.equal(preview.data.candidateAvailable,true);
 assert.equal(preview.data.autoUploadAllowed,false);
 assert.equal((await call('/qa/snapshot','GET',undefined,A)).data.revision,2);
 pass('다른 기기 B의 서로 다른 오답 변경을 미리보기만 하고 원본/리비전 불변');
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:bEdit,approved:true},A,1)).status,409);
 const second=await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:bEdit,approved:true},A,2);
 assert.equal(second.status,200,JSON.stringify(second.data));
 assert.equal(second.data.revision,3);
 const final=(await call('/qa/snapshot','GET',undefined,A)).data.snapshot;
 assert.equal(final.records.find(r=>r.id==='q-a').studentAnswer,'QA30 기기A 수정');
 assert.equal(final.records.find(r=>r.id==='q-b').studentAnswer,'QA30 기기B 수정');
 pass('과거 기준본 1의 B 수정은 서버 버전 2로 안전 병합해 A/B 별도 오답 변경 모두 유지');
 const changed=doc([row('q-a','동일 오답 충돌'),row('q-b')]);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:changed,approved:true},A,3)).status,409);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:initial,local:doc([row('q-a')]),approved:true},A,3)).status,409);
 assert.deepEqual((await call('/qa/snapshot','GET',undefined,A)).data.snapshot,final);
 pass('동일 ID 상충 수정·기존 오답 삭제는 승인 체크 후에도 서버 변경 없이 거부');
 const forged=structuredClone(initial);forged.records[0].studentAnswer='위조';signSynthetic(forged);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:1,base:forged,local:bEdit,approved:true},A,3)).status,409);
 assert.equal((await call('/qa/sync-commit','POST',{baseRevision:0,base:initial,local:bEdit,approved:true},A,3)).status,422);
 pass('서버에 실제 존재했던 승인 버전·암호화된 원본과 불일치하는 클라이언트 기준본 거부');
 const bytes=readFileSync(file,'utf8');
 assert.ok(!bytes.includes('QA30 기기A 수정'));
 assert.ok(!bytes.includes('qa-30-family-a'));
 pass('병합 이력까지 AES-GCM 암호 파일에 보관하며 외부 평문 비노출');
 await server.shutdown();
 server=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 const old=await call('/qa/snapshot','GET',undefined,A);
 assert.equal(old.status,401);
 const relog=(await call('/qa/login','POST',{familyKey:'qa-30-family-a',password})).data.token;
 const after=await call('/qa/snapshot','GET',undefined,relog);
 assert.equal(after.data.revision,3);assert.deepEqual(after.data.snapshot,final);
 const cEdit=doc([...initial.records,row('q-new-c')]);
 const restored=await call('/qa/sync-commit','POST',{
  baseRevision:1,base:initial,local:cEdit,approved:true
 },relog,3);
 assert.equal(restored.status,200,JSON.stringify(restored.data));
 assert.equal(restored.data.revision,4);
 assert.equal((await call('/qa/snapshot','GET',undefined,relog)).data.snapshot.records.length,3);
 pass('암호화 저장소 재시작 후 이전 세션 폐기·과거 기준본에서 신규 ID 3방향 병합 성공');
 // Prove a slow request cannot overwrite a more recent commit after the first
 // revision check and while its JSON body is awaiting more bytes.
 const slow=slowPut(doc([...initial.records,row('q-slow')]),relog,4);
 await new Promise(resolve=>setTimeout(resolve,100));
 const fast=await call('/qa/sync-commit','POST',{baseRevision:4,
  base:(await call('/qa/snapshot','GET',undefined,relog)).data.snapshot,
  local:doc([row('q-a','QA30 기기A 수정'),row('q-b','QA30 기기B 수정'),row('q-new-c'),row('q-fast')]),
  approved:true},relog,4);
 assert.equal(fast.status,200,JSON.stringify(fast.data));
 slow.finish();
 const oldWrite=await slow.outcome;
 assert.equal(oldWrite.status,409,'A slow body must never overwrite a newer revision');
 const last=await call('/qa/snapshot','GET',undefined,relog);
 assert.equal(last.data.revision,5);
 assert.ok(last.data.snapshot.records.find(r=>r.id==='q-fast'));
 assert.ok(!last.data.snapshot.records.find(r=>r.id==='q-slow'));
 pass('본문을 절반만 보낸 지연 HTTP PUT과 선행 병합이 경쟁해도 오래된 쓰기 409·최신 기록 보존');
 console.log('QA_G15_EXPLICIT_MERGE_RESULT='+JSON.stringify({
  status:'PASS',checks,historyPersisted:true,simulatedFamilies:2,
  originalRowsPreserved:true,staleWritesRejected:true,
  consentGuard:true,realCloud:false,realChildren:0,productionAuth:false
 }));
}finally{if(server)await server.shutdown();rmSync(tmp,{recursive:true,force:true})}
