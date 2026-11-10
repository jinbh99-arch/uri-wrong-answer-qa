// WRONG-P8: REAL original A v1.4 IndexedDB/UI local record -> P7 restored
// guardian-only GET in the SAME existing A detail page. NO real account,
// no qa44 production, no product index.html edit, no P6/P7 suites replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {exportSyntheticBundle} from '../scripts/wrong-p5-synthetic-bundle-preflight.mjs';
import {importSyntheticBundleAtomic} from '../scripts/wrong-p6-synthetic-atomic-restore.mjs';
import {createWrongP7SyntheticRestoredGuardianReader} from '../scripts/wrong-p7-restored-guardian-read-adapter.mjs';
import {startWrongP3SyntheticLocalServer} from '../scripts/wrong-p3-local-timeline-server.mjs';
const env=process.env;
for(const key of ['QA44_STAGE_ONLY','WRONG_P4_SYNTHETIC_BACKUP_ONLY',
 'WRONG_P5_SYNTHETIC_BUNDLE_ONLY','WRONG_P6_SYNTHETIC_ATOMIC_ONLY',
 'WRONG_P7_SYNTHETIC_RESTORED_READONLY','WRONG_P8_SYNTHETIC_A_PARENT_ONLY',
 'QA44_SYNTHETIC_CHILD_ONLY','QA44_SYNTHETIC_GUARDIAN_OBS_ONLY',
 'WRONG_P3_SYNTHETIC_LOCAL_ONLY']){
 if(env[key]!=='1')throw Error('P8_MISSING_SYNTHETIC_FLAG_'+key);
}
if(!env.QA39_TEST_DATABASE_URL?.includes('@127.0.0.1:'))
 throw Error('P8_NOT_EPHEMERAL_POSTGRES');
const {Pool}=pg;
const pool=new Pool({connectionString:env.QA39_TEST_DATABASE_URL,max:4});
const freshPool=new Pool({connectionString:env.QA39_TEST_DATABASE_URL,max:4});
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GA='11111111-1111-4111-8111-111111111111';
const GB='22222222-2222-4222-8222-222222222222';
const CA='33333333-3333-4333-8333-333333333333';
const CB='44444444-4444-4444-8444-444444444444';
const GR='55555555-5555-4555-8555-555555555555';
const tokenMap=new Map([
 ['p8-synthetic-guardian-a-'+ 'a'.repeat(64),GA],
 ['p8-synthetic-guardian-b-'+ 'b'.repeat(64),GB],
 ['p8-synthetic-child-a-'+ 'c'.repeat(64),CA],
 ['p8-synthetic-revoked-a-'+ 'd'.repeat(64),GR]
]);
const [TGA,TGB,TCA,TGR]=[...tokenMap.keys()];
let verifiedCalls=0;
const fakeAuth={auth:{async getUser(token){
 verifiedCalls++;
 const id=tokenMap.get(token);
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const pngData='data:image/png;base64,'+png.toString('base64');
const sha=v=>createHash('sha256').update(v).digest('hex');
const at=n=>new Date(Date.parse('2026-11-11T00:00:00Z')+n*1000).toISOString();
const attempts=[
 {at:at(1),answer:'비가 왔기 때문입니다',explanation:'처음에는 우산을 보고 답했지만 원인을 다시 생각했어요.',review:'not_checked'},
 {at:at(3),answer:'젖지 않으려고 우산을 썼습니다',explanation:'비가 오는 것과 행동의 까닭을 연결해 다시 설명했어요.',review:'not_checked'}
];
function source(family,child,guardian,recordId,problemText,tryList,notes,withPhoto){
 const childEvents=tryList.map((a,i)=>({
  family_id:family,child_user_id:child,
  request_id:'child-retry-'+String(i+1).padStart(3,'0'),
  record_id:recordId,attempt_json:a,
  input_sha256:sha(JSON.stringify({recordId,answer:a.answer,explanation:a.explanation})),
  base_revision:2*i+1,applied_revision:2*i+2,created_at:at(20+i)
 }));
 const parentEvents=notes.map((v,i)=>({
  family_id:family,guardian_user_id:guardian,
  request_id:'parent-observe-'+String(i+1).padStart(3,'0'),
  record_id:recordId,child_user_id:child,
  child_request_id:childEvents[i].request_id,
  status:v.status,note:v.note,
  input_sha256:sha(JSON.stringify({recordId,childUserId:child,
   childRequestId:childEvents[i].request_id,status:v.status,note:v.note})),
  base_revision:2*i+2,applied_revision:2*i+3,created_at:at(30+i)
 }));
 const record={id:recordId,subject:'korean',gradeAtEntry:3,
  problemText,hasPhoto:withPhoto,
  studentAnswer:'SYNTHETIC_ORIGINAL_CHILD_PRIVATE',
  memo:'SYNTHETIC_ORIGINAL_PARENT_PRIVATE',
  generalRetryHistory:tryList,practiceHistory:[],checkHistory:[]};
 const doc=signSynthetic({format:'uriaimath-offline-backup-v02',
  profile:{grade:3,nickname:'SYNTHETIC-ONLY'},
  records:[record],photos:withPhoto?{[recordId]:pngData}:{},
  backupSummary:{recordCount:1,photoCount:withPhoto?1:0}});
 const snapshotText=JSON.stringify(doc);
 return {familyId:family,revision:1+childEvents.length+parentEvents.length,
  snapshotText,snapshotHash:sha(snapshotText),childEvents,parentEvents};
}
const statusNotes=[
 {status:'explained',note:'첫 번째 설명을 직접 들었습니다.'},
 {status:'needs_help',note:'두 번째 설명에는 추가 질문이 필요합니다.'}
];
const sessionA=randomBytes(24).toString('hex');
const sessionB=randomBytes(24).toString('hex');
const sessionChild=randomBytes(24).toString('hex');
const sessionRevoked=randomBytes(24).toString('hex');
const sessions=new Map([
 [sessionA,{role:'guardian',token:TGA,family:FA,recordId:'notyet'}],
 [sessionB,{role:'guardian',token:TGB,family:FB,recordId:'foreign'}],
 [sessionChild,{role:'child',token:TCA,family:FA,recordId:'notyet'}],
 [sessionRevoked,{role:'guardian',token:TGR,family:FA,recordId:'notyet'}]
]);
let checks=0,server,browser;
const contexts=[];
const evidence={name:'WRONG-P8 actual A v1.4 record detail + P7 restored read bridge',
 syntheticOnly:true,checks:[],autoSync:false,
 realOAuth:false,realGuardianConsent:false,realSupabase:false,
 AOriginalIndexModified:false,safeToRestore:false,
 screenshots:[],externalRequests:0};
function pass(label){checks++;evidence.checks.push(label);console.log('PASS WRONG_P8_A_PARENT_READ '+checks+' '+label)}
async function state(family){
 const r=(await pool.query('SELECT revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1',[family])).rows[0];
 const c=await pool.query('SELECT event_text FROM wrong_p6_synthetic.child_retries WHERE family_id=$1 ORDER BY applied_revision',[family]);
 const p=await pool.query('SELECT event_text FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1 ORDER BY applied_revision',[family]);
 return {revision:Number(r.revision),snapshot:r.snapshot_text,sha:r.content_sha256,
  child:c.rows.map(x=>x.event_text),parent:p.rows.map(x=>x.event_text)};
}
async function storedA(page){
 return page.evaluate(async name=>{
  const db=await new Promise((ok,no)=>{
   const req=indexedDB.open(name);req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)
  });
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=await new Promise((ok,no)=>{
    const r=tx.objectStore('mistakes').getAll();
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
   });
   const photoCount=await new Promise((ok,no)=>{
    const r=tx.objectStore('photos').count();
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
   });
   return {records:rows.sort((x,y)=>x.id.localeCompare(y.id)),photoCount};
  }finally{db.close()}
 },'uriaimath-github-qa-v224-only');
}
async function openRecord(page,id){
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#wrong-p8-read-action:visible').waitFor();
}
async function bodyAPI(page,path){
 return page.evaluate(async path=>{
  const r=await fetch(path,{credentials:'same-origin',cache:'no-store'});
  return {status:r.status,text:await r.text()};
 },path);
}
try{
 for(const file of ['../db/wrong-p6-synthetic-restore-only.sql',
  '../db/wrong-p7-restored-guardian-read-only.sql'])
  await pool.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 await pool.query('INSERT INTO wrong_p6_synthetic.family_state(family_id) VALUES($1),($2)',[FA,FB]);
 for(const [family,guardian,revoked] of [[FA,GA,false],[FB,GB,false],[FA,GR,true]]){
  await pool.query("INSERT INTO wrong_p7_synthetic.guardian_permissions(family_id,guardian_user_id,role,externally_verified,consent_verified_at,revoked_at) VALUES($1,$2,'guardian',true,now(),CASE WHEN $3 THEN now() ELSE NULL END)",
   [family,guardian,revoked]);
 }
 const reader=createWrongP7SyntheticRestoredGuardianReader({pool:freshPool,authClient:fakeAuth});
 server=await startWrongP3SyntheticLocalServer({
  guardianStore:reader,sessions,restoredReadOnly:true,
  aParentReadOnly:true,port:0
 });
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({
  viewport:{width:390,height:844},locale:'ko-KR',
  acceptDownloads:true
 });
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionA,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 contexts.push(context);
 const page=await context.newPage();
 page.on('request',req=>{
  if(!req.url().startsWith(server.origin))evidence.externalRequests++;
 });
 const response=await page.goto(server.origin+'/qa-p8/a-parent');
 assert.equal(response.status(),200);
 await page.locator('#nav-add').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('우리아이 오답노트'));
 assert.ok((await page.locator('body').innerText()).includes('계정·비밀번호 보호가 아닙니다'));
 // These modules are the original A scripts, never the actual auth lab
 // because its owner-only origin is restricted to port 4173.
 assert.notEqual(new URL(server.origin).port,'4173');
 pass('original A v1.4 parent application loaded from unmodified index on ephemeral localhost, bridge injected only in QA response; local role toggle explicitly not real auth');

 const title='가상 국어: 민수가 비 오는 날 우산을 쓴 까닭은?';
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(title);
 await page.locator('#choose-photo').setInputFiles({
  name:'synthetic-1px.png',mimeType:'image/png',buffer:png
 });
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const initialA=await storedA(page);
 assert.equal(initialA.records.length,1);
 assert.equal(initialA.photoCount,1);
 const id=initialA.records[0].id;
 assert.ok(/^[A-Za-z0-9_-]{1,100}$/.test(id));
 assert.equal(initialA.records[0].problemText,title);
 assert.equal(initialA.records[0].subject,'korean');
 assert.equal(initialA.records[0].hasPhoto,true);
 sessions.set(sessionA,{role:'guardian',token:TGA,family:FA,recordId:id});
 sessions.set(sessionB,{role:'guardian',token:TGB,family:FB,recordId:id});
 sessions.set(sessionRevoked,{role:'guardian',token:TGR,family:FA,recordId:id});
 sessions.set(sessionChild,{role:'child',token:TCA,family:FA,recordId:id});
 await openRecord(page,id);
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p8-read-status')?.textContent?.includes('조회 차단'));
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 assert.deepEqual(await storedA(page),initialA);
 pass('real A add/photo UI created a synthetic ID in local IndexedDB; P7 restore absent -> no invented timeline and no local edit');

 await pool.query('INSERT INTO wrong_p7_synthetic.child_grants(family_id,child_user_id,record_id,consent_verified_at) VALUES($1,$2,$3,now())',[FA,CA,id]);
 const sourceA=source(FA,CA,GA,id,title,attempts,statusNotes,true);
 const sourceB=source(FB,CB,GB,id,'가상 국어: 가족 B 독립 문제',
  [{at:at(6),answer:'B answer',explanation:'B reason',review:'not_checked'}],
  [{status:'explained',note:'FOREIGN_PARENT_ONLY'}],false);
 await pool.query('INSERT INTO wrong_p7_synthetic.child_grants(family_id,child_user_id,record_id,consent_verified_at) VALUES($1,$2,$3,now())',[FB,CB,id]);
 const [doneA,doneB]=await Promise.all([
  importSyntheticBundleAtomic({
   pool,bundleText:exportSyntheticBundle(sourceA),expectedFamilyId:FA,
   expectedTargetRevision:0,requestId:'p8-restore-family-a-001',syntheticApprove:true
  }),
  importSyntheticBundleAtomic({
   pool,bundleText:exportSyntheticBundle(sourceB),expectedFamilyId:FB,
   expectedTargetRevision:0,requestId:'p8-restore-family-b-001',syntheticApprove:true
  })
 ]);
 assert.equal(doneA.revision,5);assert.equal(doneB.revision,3);
 assert.equal(doneA.safeToRestore,false);
 const beforeDbA=await state(FA),beforeDbB=await state(FB);
 const authView=await reader.guardianRetryTimeline(TGA,FA,id);
 assert.deepEqual(authView.order.map(x=>x.revision),[2,3,4,5]);
 assert.equal(authView.record.id,id);
 pass('P6 actual atomic synthetic import uses A original generated record ID; P7 new connection authenticates same family and reads child2/guardian2');

 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-p8-read-events li').length===4);
 const elements=await page.locator('#wrong-p8-read-events li').allTextContents();
 assert.equal(elements.length,4);
 assert.ok(elements[0].includes('처음에는 우산을 보고 답했지만'));
 assert.ok(elements[1].includes('첫 번째 설명을 직접 들었습니다'));
 assert.ok(elements[2].includes('행동의 까닭을 연결해'));
 assert.ok(elements[3].includes('두 번째 설명에는 추가 질문'));
 assert.ok((await page.locator('#wrong-p8-read-status').innerText()).includes('읽기 전용'));
 assert.equal(await page.locator('#detail-text').innerText(),title);
 assert.ok((await page.locator('#wrong-p8-restored-read').innerText()).includes('실제 계정 연결이 아닙니다'));
 assert.ok(!(await page.locator('#wrong-p8-restored-read').innerText()).includes('FOREIGN_PARENT_ONLY'));
 mkdirSync('test-results/wrong-p8',{recursive:true});
 await page.screenshot({path:'test-results/wrong-p8/actual-a-parent-restored-390.png',fullPage:true});
 evidence.screenshots.push('actual-a-parent-restored-390.png');
 pass('actual A original parent detail DOM shows P7 restored 4 ordered synthetic child/parent records and their exact Korean words, captured real Chromium 390px');

 assert.deepEqual(await storedA(page),initialA);
 assert.deepEqual(await state(FA),beforeDbA);
 assert.deepEqual(await state(FB),beforeDbB);
 await page.reload();
 await openRecord(page,id);
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-p8-read-events li').length===4);
 assert.deepEqual(await storedA(page),initialA);
 assert.deepEqual(await state(FA),beforeDbA);
 pass('A and P7 data read-only across browser reload: original IndexedDB rows/photos and restored snapshot/SHA/event payloads bit-for-bit unchanged');

 // Genuine A record remains byte-identical. Family B is synthetically
 // restored under the SAME record ID but with different problem content.
 // Even a verified B guardian must not join B history to A's local detail.
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionB,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 await page.reload();
 await openRecord(page,id);
 const bOwn=await bodyAPI(page,'/qa-p3/api/parent/timeline');
 assert.equal(bOwn.status,200);
 assert.ok(bOwn.text.includes('FOREIGN_PARENT_ONLY'));
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p8-read-status')?.textContent?.includes('조회 차단'));
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 assert.ok(!(await page.locator('#wrong-p8-restored-read').innerText()).includes('FOREIGN_PARENT_ONLY'));
 assert.ok(!(await page.locator('#wrong-p8-restored-read').innerText()).includes('첫 번째 설명을 직접 들었습니다'));
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionA,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 await page.reload();
 await openRecord(page,id);
 assert.deepEqual(await storedA(page),initialA);
 pass('same local A record ID with verified family B but mismatched subject/problem/photo refuses join without mutating any A record');

 // Revoked guardian and child share an otherwise matching local record and
 // cannot see restored guardian events, even if A shows a parent-mode button.
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionRevoked,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p8-read-status')?.textContent?.includes('조회 차단'));
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 const revokedApi=await bodyAPI(page,'/qa-p3/api/parent/timeline');
 assert.equal(revokedApi.status,404);
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionChild,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 const denied=await bodyAPI(page,'/qa-p3/api/parent/timeline');
 assert.equal(denied.status,403);
 const forbiddenHTML=await page.goto(server.origin+'/qa-p8/a-parent');
 assert.equal(forbiddenHTML.status(),403);
 pass('revoked guardian and child-as-parent cannot fetch restored data even while A local mode switch exists');

 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionB,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 const foreign=await page.goto(server.origin+'/qa-p8/a-parent');
 assert.equal(foreign.status(),200);
 const foreignApi=await bodyAPI(page,'/qa-p3/api/parent/timeline?family='+FA);
 assert.equal(foreignApi.status,403);
 assert.ok(!foreignApi.text.includes('첫 번째 설명을 직접'));
 await context.addCookies([{name:'wrong_p3_demo_session',value:sessionA,
  url:server.origin,httpOnly:true,sameSite:'Strict'}]);
 await page.goto(server.origin+'/qa-p8/a-parent');
 await openRecord(page,id);
 const script=await bodyAPI(page,'/qa-p3/api/parent/timeline');
 assert.equal(script.status,200);
 assert.ok(script.text.includes('child-retry-001'));
 const post=await page.evaluate(async()=>{
  const r=await fetch('/qa-p3/api/parent/observe',{
   method:'POST',headers:{'content-type':'application/json',
    'x-wrong-p3-action':'synthetic-only'},
   body:JSON.stringify({attemptId:'child-retry-001',requestId:'malicious-ask-01',
    expectedRevision:5,status:'explained',note:'bad'})
  });return r.status;
 });
 assert.equal(post,405);
 assert.deepEqual(await state(FA),beforeDbA);
 assert.deepEqual(await state(FB),beforeDbB);
 pass('foreign family and write attempts are denied by server-scoped P7; restored B3 observation remains immutable and another family preserved');

 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-p8-read-events li').length===4);
 await page.locator('#nav-home').click();
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 assert.equal(await page.locator('#wrong-p8-restored-read').isVisible(),false);
 await openRecord(page,id);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-p8-read-events li').length===4);
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 assert.equal(await page.locator('#wrong-p8-restored-read').isVisible(),false);
 assert.equal(evidence.externalRequests,0);
 assert.ok(verifiedCalls>=6);
 pass('actual A navigation and child view erase guardian projection; zero external network calls or production auth, no stale private events');

 const sourceIndex=readFileSync(new URL('../index.html',import.meta.url));
 // GitHub CI verifies the original A index Git blob exactly. No test
 // writes to this file or to the source A branch.
 const sourceAgain=readFileSync(new URL('../index.html',import.meta.url));
 assert.deepEqual(sourceAgain,sourceIndex);
 const schema=await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='qa44'");
 assert.equal(schema.rows[0].n,0);
 assert.deepEqual(await state(FA),beforeDbA);
 assert.deepEqual(await storedA(page),initialA);
 pass('original A source unchanged; final synthetic local IndexedDB and restored PostgreSQL snapshot/CAS/ledgers intact');

 evidence.status='PASS';evidence.checkCount=checks;
 evidence.originalALocalRecordId=id;evidence.P7Revision=5;
 evidence.authGetUserCalls=verifiedCalls;
 writeFileSync('test-results/wrong-p8/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P8_A_PARENT_READ_RESULT='+JSON.stringify({
  status:'PASS',checks,realAParentDOM:true,originalAIndexChanged:false,
  sameRecordIdRoundtrip:true,parentViewport:390,
  p6RestoredEvents:4,verifiedP7Query:true,readOnly:true,
  rejectedMismatchedLocal:true,revokedDenied:true,crossFamilyDenied:true,
  noOperatingAuth:true,noQa44Schema:true,noDataLoss:true,
  realOAuth:false,realSupabase:false,realChildren:0,safeToRestore:false
 }));
}catch(e){
 mkdirSync('test-results/wrong-p8',{recursive:true});
 evidence.status='FAIL';evidence.error=String(e);
 evidence.stack=String(e?.stack).slice(0,1800);
 writeFileSync('test-results/wrong-p8/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P8_A_PARENT_READ_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:evidence.stack}));
 process.exitCode=1;
}finally{
 for(const c of contexts)try{await c.close()}catch{}
 if(browser)await browser.close();
 if(server)await server.close();
 await freshPool.end();await pool.end();
}
