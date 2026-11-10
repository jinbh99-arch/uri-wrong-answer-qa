// WRONG-P9: genuine A UI/IndexedDB + downloaded v02 JSON + separately
// built P6/P7-shape synthetic B2/B3 events. READS only; NO restore/PG.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {preflightWrongP9} from '../scripts/wrong-p9-a-ledger-preflight.mjs';
if(process.env.WRONG_P9_SYNTHETIC_READONLY!=='1')throw Error('P9_READONLY_FLAG_REQUIRED');
const sha=value=>createHash('sha256').update(value).digest('hex');
const clone=o=>structuredClone(o);
const repoFile=path=>readFileSync(new URL('../'+path,import.meta.url));
const indexOriginal=repoFile('index.html');
const scripts={
 '/scripts/qa-inapp-sync-bridge.mjs':repoFile('scripts/qa-inapp-sync-bridge.mjs'),
 '/scripts/qa47-live-auth-lab.mjs':repoFile('scripts/qa47-live-auth-lab.mjs')
};
const familyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const familyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const child='33333333-3333-4333-8333-333333333333';
const guardian='11111111-1111-4111-8111-111111111111';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const now=i=>new Date(Date.parse('2026-11-11T00:00:00Z')+1000*i).toISOString();
const checks=[], cases=[];
function pass(label){checks.push(label);console.log('PASS WRONG_P9_PREFLIGHT '+checks.length+' '+label)}
function denied(label,result,code){
 assert.equal(result.safeToRestore,false,label);assert.equal(result.restorePerformed,false,label);
 assert.equal(result.contractMatched,false,label);assert.equal(result.blocked,true,label);
 assert.ok(result.reasons.includes(code),label+': expected '+code+', got '+result.reasons);
 cases.push({label,blocked:true,code:result.reasons[0]});pass(label);
}
function testNegative(label,base,mutate,reason){
 const obj=clone(base);mutate(obj);denied(label,preflightWrongP9(obj),reason);
}
function makeLedger(aRecord,aPhoto,aBackup){
 const attempts=[
  {at:now(1),answer:'비가 왔기 때문입니다',explanation:'그림만 보다가 까닭을 다시 설명했어요.',review:'not_checked'},
  {at:now(3),answer:'젖지 않으려고 우산을 썼습니다',explanation:'행동과 이유를 이어서 설명했어요.',review:'not_checked'}
 ];
 const childEvents=attempts.map((attempt,i)=>({
  family_id:familyA,child_user_id:child,request_id:'child-retry-'+String(i+1).padStart(3,'0'),
  record_id:aRecord.id,attempt_json:attempt,
  input_sha256:sha(JSON.stringify({recordId:aRecord.id,answer:attempt.answer,
   explanation:attempt.explanation})),
  base_revision:2*i+1,applied_revision:2*i+2,created_at:now(10+i)
 }));
 const notes=[{status:'explained',note:'아이 말로 이유를 설명함'},
              {status:'needs_help',note:'두 번째는 확인 질문이 더 필요함'}];
 const parentEvents=notes.map((n,i)=>({
  family_id:familyA,guardian_user_id:guardian,child_user_id:child,
  request_id:'parent-observe-'+String(i+1).padStart(3,'0'),
  child_request_id:childEvents[i].request_id,record_id:aRecord.id,
  status:n.status,note:n.note,
  input_sha256:sha(JSON.stringify({recordId:aRecord.id,childUserId:child,
   childRequestId:childEvents[i].request_id,status:n.status,note:n.note})),
  base_revision:2*i+2,applied_revision:2*i+3,created_at:now(20+i)
 }));
 const snapshot={format:'uriaimath-offline-backup-v02',profile:{grade:3,nickname:'SYNTHETIC-ONLY'},
  records:[{...clone(aRecord),generalRetryHistory:attempts}],
  photos:{[aRecord.id]:aBackup.photos[aRecord.id]},
  backupSummary:{recordCount:1,photoCount:1}};
 return {syntheticOnly:true,ledgerIncluded:true,familyId:familyA,recordId:aRecord.id,
  snapshot,photoSignature:clone(aPhoto),revision:5,childEvents,parentEvents,
  checkpoint:{revision:5,childCount:2,parentCount:2,
   childDigest:sha(JSON.stringify(childEvents)),
   parentDigest:sha(JSON.stringify(parentEvents)),
   snapshotDigest:sha(JSON.stringify(snapshot))}};
}
async function readA(page){
 return page.evaluate(async ()=>{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('uriaimath-github-qa-v224-only');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const get=(store,op)=>new Promise((ok,no)=>{
    const r=tx.objectStore(store)[op]();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
   });
   const [records,photoKeys,photos]=await Promise.all([
    get('mistakes','getAll'),get('photos','getAllKeys'),get('photos','getAll')]);
   const sign=[];
   for(let i=0;i<photos.length;i++){
    const blob=photos[i];
    if(!(blob instanceof Blob))throw Error('NOT_A_PHOTO_BLOB');
    const arr=await blob.arrayBuffer();
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',arr));
    const hash=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
    sign.push({key:String(photoKeys[i]),mime:blob.type,byteLength:arr.byteLength,sha256:hash});
   }
   return {records,photoSignatures:sign};
  }finally{db.close()}
 });
}
let browser,server;
const evidence={task:'WRONG-P9 A-v02 vs independent B2/B3 ledger read-only preflight',
 createdAt:new Date().toISOString(),baseP8:'50d9ca48e1209a151a384edb6d16c0f1b565f369',
 aIndexGitBlobExpected:'58754380d6fa764256100963d1a9da5d11873d19',
 realAUI:true,syntheticOnly:true,operatingDataUsed:false,
 pgRestorationPerformed:false,realAuth:false,realConsent:false,
 safeToRestore:false,cases,checks};
try{
 server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'&&req.method==='GET'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   return res.end(indexOriginal);
  }
  if(Object.hasOwn(scripts,url.pathname)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
   return res.end(scripts[url.pathname]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},
  locale:'ko-KR',acceptDownloads:true});
 // Synthetic local browser only; no external OAuth, production, or remote photographs.
 let external=0;
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==origin){external++;return route.abort()}
  return route.continue();
 });
 const page=await context.newPage();
 const response=await page.goto(origin+'/');assert.equal(response.status(),200);
 await page.locator('#nav-add').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('우리아이 오답노트'));
 pass('real, unmodified A product index loads in Chromium 390px with synthetic-only localhost');

 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 const question='가상 국어: 민수가 비 오는 날 우산을 쓴 까닭은?';
 await page.locator('#problem').fill(question);
 await page.locator('#choose-photo').setInputFiles({
  name:'synthetic-1px.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const original=await readA(page);
 assert.equal(original.records.length,1);
 assert.equal(original.photoSignatures.length,1);
 const aRecord=original.records[0],aPhoto=original.photoSignatures[0];
 assert.equal(aRecord.subject,'korean');assert.equal(Number(aRecord.gradeAtEntry),3);
 assert.equal(aRecord.problemText,question);assert.equal(aRecord.hasPhoto,true);
 assert.equal(aPhoto.key,aRecord.id);assert.ok(['image/jpeg','image/png'].includes(aPhoto.mime));
 assert.match(aPhoto.sha256,/^[a-f0-9]{64}$/);
 pass('A form creates one local IndexedDB mistake, exact ID/subject/grade/question and real stored Blob SHA256');

 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+aRecord.id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),question);
 mkdirSync('test-results/wrong-p9',{recursive:true});
 await page.screenshot({path:'test-results/wrong-p9/actual-a-record-390.png'});
 pass('original A record detail displays exact locally generated question; captured Chromium 390px PNG');

 await page.locator('#nav-settings').click();
 const downloadPromise=page.waitForEvent('download',{timeout:25000});
 await page.locator('#export-json').click();
 const download=await downloadPromise;
 const aBackup=JSON.parse(readFileSync(await download.path(),'utf8'));
 assert.equal(aBackup.format,'uriaimath-offline-backup-v02');
 assert.equal(aBackup.records.length,1);
 assert.ok(aBackup.photos[aRecord.id]);
 assert.equal(aBackup.records[0].id,aRecord.id);
 assert.equal(aBackup.backupSummary?.photoCount,1);
 assert.equal(aBackup.parentEvents,undefined);
 assert.equal(aBackup.guardianObservations,undefined);
 pass('actual A Export button downloads v02 JSON with same record/photo but NO independent B3 parent ledger');

 const ledger=makeLedger(aRecord,aPhoto,aBackup);
 const input={aRecord,aPhoto,aBackup,expectedFamilyId:familyA,ledger};
 const good=preflightWrongP9(input);
 assert.equal(good.contractMatched,true);assert.equal(good.blocked,false);
 assert.equal(good.safeToRestore,false);assert.equal(good.restorePerformed,false);
 assert.equal(good.verified.b2ChildCount,2);assert.equal(good.verified.b3ObservationCount,2);
 assert.equal(good.verified.revision,5);
 evidence.normalCase={contractMatched:good.contractMatched,blocked:good.blocked,
  safeToRestore:good.safeToRestore,verified:good.verified,
  source:'A real exported v02 and IndexedDB + separate P6/P7-style synthetic ledgers'};
 pass('normal synthetic snapshot/child2/guardian2 linked by source family, record ID, request IDs and rev2..5; never approves restore');

 testNegative('missing B3 ledger',input,x=>{delete x.ledger.parentEvents},'B3_LEDGER_NOT_INCLUDED');
 testNegative('dropped one B3 observation',input,x=>{x.ledger.parentEvents.pop()},'B3_LEDGER_MISSING_OR_COUNT_MISMATCH');
 testNegative('photo hash mismatch',input,x=>{x.ledger.photoSignature.sha256='f'.repeat(64)},'B2_PHOTO_SHA_OR_META_MISMATCH');
 testNegative('P6 snapshot photo bytes differ',input,x=>{x.ledger.snapshot.photos[x.aRecord.id]='data:image/png;base64,AA=='},'B2_SNAPSHOT_PHOTO_BYTES_MISMATCH');
 testNegative('A v02 downloaded photo data mismatch',input,x=>{x.aBackup.photos[x.aRecord.id]='data:image/png;base64,AA=='},'A_INDEXEDDB_BACKUP_PHOTO_MISMATCH');
 testNegative('cross-family ledger mix',input,x=>{x.ledger.familyId=familyB},'LEDGER_FAMILY_OR_RECORD_MISMATCH');
 testNegative('cross-family guardian observation',input,x=>{x.ledger.parentEvents[0].family_id=familyB},'B3_PARENT_EVENT_INVALID');
 testNegative('different record ID',input,x=>{x.ledger.recordId='other-family-record-01'},'LEDGER_FAMILY_OR_RECORD_MISMATCH');
 testNegative('P7 child request ID missing in B3',input,x=>{delete x.ledger.parentEvents[0].child_request_id},'B3_PARENT_EVENT_INVALID');
 testNegative('legacy A retry missing stable request ID',input,x=>{
  x.aRecord.generalRetryHistory=[{at:now(1),answer:'old retry',explanation:'old'}]
 },'A_LEGACY_RETRY_REQUEST_ID_UNMAPPED');
 testNegative('revision differs from independent checkpoint',input,x=>{x.ledger.revision=4},'B3_LEDGER_MISSING_OR_COUNT_MISMATCH');
 testNegative('v02 record grade differs',input,x=>{x.aBackup.records[0].gradeAtEntry=4},'A_V02_RECORD_MISMATCH');
 testNegative('whole separate B2/B3 ledger missing, v02 alone',input,x=>{
  delete x.ledger;
 },'LEDGER_FAMILY_OR_RECORD_MISMATCH');
 pass('13 negative scenarios all fail closed with explicit reason and safeToRestore false');

 const reread=await readA(page);
 assert.deepEqual(reread,original);
 assert.equal(sha(repoFile('index.html')),sha(indexOriginal));
 assert.equal(external,0);
 pass('actual A IndexedDB records + photo byte signatures and original product index unchanged; no external HTTP');
 evidence.result='PASS';evidence.checkCount=checks.length;
 evidence.record={id:aRecord.id,subject:aRecord.subject,grade:aRecord.gradeAtEntry,
  problemSha256:sha(question),photo:{mime:aPhoto.mime,byteLength:aPhoto.byteLength,sha256:aPhoto.sha256}};
 evidence.aBackup={format:aBackup.format,recordCount:aBackup.records.length,
  photoCount:Object.keys(aBackup.photos).length,independentB3Included:false};
 evidence.externalRequests=external;
 writeFileSync('test-results/wrong-p9/preflight-evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P9_PREFLIGHT_RESULT='+JSON.stringify({status:'PASS',checks:checks.length,
  negativeScenarios:cases.length,readOnly:true,originalAUsed:true,
  photoSHACompared:true,independentB3Required:true,safeToRestore:false}));
 await context.close();
}catch(e){
 mkdirSync('test-results/wrong-p9',{recursive:true});
 evidence.result='FAIL';evidence.error=String(e);evidence.stack=String(e?.stack).slice(0,1800);
 writeFileSync('test-results/wrong-p9/preflight-evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P9_PREFLIGHT_RESULT='+JSON.stringify({status:'FAIL',error:String(e),
  checkCount:checks.length,safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(server)await new Promise(ok=>server.close(()=>ok()));
}
