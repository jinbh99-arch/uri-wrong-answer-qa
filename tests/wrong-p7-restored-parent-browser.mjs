// WRONG-P7 ONLY: actual P6 import -> fresh database client -> B4-shaped
// guardian read adapter -> reused P3 local Chromium UI. Synthetic families.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import pg from 'pg';
import {chromium} from 'playwright';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {exportSyntheticBundle} from '../scripts/wrong-p5-synthetic-bundle-preflight.mjs';
import {importSyntheticBundleAtomic} from '../scripts/wrong-p6-synthetic-atomic-restore.mjs';
import {createWrongP7SyntheticRestoredGuardianReader} from '../scripts/wrong-p7-restored-guardian-read-adapter.mjs';
import {startWrongP3SyntheticLocalServer} from '../scripts/wrong-p3-local-timeline-server.mjs';
const env=process.env;
for(const flag of ['QA44_STAGE_ONLY','WRONG_P4_SYNTHETIC_BACKUP_ONLY',
 'WRONG_P5_SYNTHETIC_BUNDLE_ONLY','WRONG_P6_SYNTHETIC_ATOMIC_ONLY',
 'WRONG_P7_SYNTHETIC_RESTORED_READONLY','QA44_SYNTHETIC_CHILD_ONLY',
 'QA44_SYNTHETIC_GUARDIAN_OBS_ONLY','WRONG_P3_SYNTHETIC_LOCAL_ONLY']){
 if(env[flag]!=='1')throw Error('P7_MISSING_SYNTHETIC_GUARD_'+flag);
}
if(!env.QA39_TEST_DATABASE_URL?.includes('@127.0.0.1:'))
 throw Error('P7_NONLOCAL_DATABASE');
const pool=new pg.Pool({connectionString:env.QA39_TEST_DATABASE_URL,max:4});
const readPool=new pg.Pool({connectionString:env.QA39_TEST_DATABASE_URL,max:4});
const sha=s=>createHash('sha256').update(s).digest('hex');
const F1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const F2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const G1='11111111-1111-4111-8111-111111111111';
const G2='22222222-2222-4222-8222-222222222222';
const C1='33333333-3333-4333-8333-333333333333';
const C2='44444444-4444-4444-8444-444444444444';
const REVOKED='55555555-5555-4555-8555-555555555555';
const VIEWER='66666666-6666-4666-8666-666666666666';
const tokenFor=new Map([
 ['synthetic-guardian-one-'+'a'.repeat(64),G1],
 ['synthetic-guardian-two-'+'b'.repeat(64),G2],
 ['synthetic-revoked-guardian-'+'c'.repeat(64),REVOKED],
 ['synthetic-child-one-'+'d'.repeat(64),C1],
 ['synthetic-viewer-one-'+'e'.repeat(64),VIEWER]
]);
const [TG1,TG2,TR,TC1,TV]=[...tokenFor.keys()];
let authRequests=0;
const authClient={auth:{async getUser(token){
 authRequests++;
 const id=tokenFor.get(token);
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const iso=(delta)=>new Date(Date.parse('2026-11-11T00:00:00.000Z')+delta*1000).toISOString();
const attempt=(at,answer,explanation)=>({at:iso(at),answer,explanation,review:'not_checked'});
function makeFamily(family,child,guardian,record,attempts,parentInput,extra=false){
 const records=[{id:record,subject:'korean',gradeAtEntry:3,hasPhoto:true,
  problemText:family===F1?'가상 국어: 민수가 우산을 쓴 까닭은?':'가상 영어: 글의 중심은?',
  studentAnswer:'ORIGINAL_CHILD_PRIVATE',memo:'PARENT_PRIVATE_ORIGINAL',
  generalRetryHistory:attempts,checkHistory:[{
   at:iso(0),status:'needs_help',memo:'ORIGINAL_PARENT_MEMO',
   by:'parent_observation'}],practiceHistory:[]}];
 if(extra)records.push({id:'legacy-no-id',subject:'math',gradeAtEntry:3,
  hasPhoto:false,problemText:'별도 오래된 오답',memo:'PRESERVE_OLD_RECORD',
  generalRetryHistory:[{at:iso(0),answer:'원래 답',explanation:'구형 별도 오답'}],
  checkHistory:[],practiceHistory:[]});
 const signed=signSynthetic({format:'uriaimath-offline-backup-v02',
  profile:{grade:3,nickname:'QA-SYNTHETIC-'+family},
  records,photos:{[record]:PNG},
  backupSummary:{recordCount:records.length,photoCount:1}});
 const childEvents=attempts.map((entry,i)=>({
  family_id:family,child_user_id:child,request_id:'child-retry-'+String(i+1).padStart(3,'0'),
  record_id:record,attempt_json:entry,
  input_sha256:sha(JSON.stringify({recordId:record,answer:entry.answer,explanation:entry.explanation})),
  base_revision:2*i+1,applied_revision:2*i+2,created_at:iso(10+i)
 }));
 const parentEvents=parentInput.map((input,i)=>({
  family_id:family,guardian_user_id:guardian,
  request_id:'parent-observe-'+String(i+1).padStart(3,'0'),
  record_id:record,child_user_id:child,
  child_request_id:childEvents[input.attempt].request_id,
  status:input.status,note:input.note,
  input_sha256:sha(JSON.stringify({recordId:record,childUserId:child,
   childRequestId:childEvents[input.attempt].request_id,status:input.status,note:input.note})),
  base_revision:2*i+2,applied_revision:2*i+3,created_at:iso(30+i)
 }));
 const snapshotText=JSON.stringify(signed);
 return {familyId:family,revision:1+childEvents.length+parentEvents.length,
  snapshotText,snapshotHash:sha(snapshotText),childEvents,parentEvents};
}
const A=makeFamily(F1,C1,G1,'sameA',[
 attempt(1,'비가 왔다','비가 오는 까닭을 첫 번째로 설명했어요.'),
 attempt(3,'젖지 않으려고 우산을 썼다','비와 우산 사이의 이유를 더 정확하게 설명했어요.')
],[
 {attempt:0,status:'explained',note:'첫 번째 자기 설명을 들었습니다.'},
 {attempt:1,status:'needs_help',note:'두 번째 설명에서 추가 도움이 필요했습니다.'}
],true);
const B=makeFamily(F2,C2,G2,'sameB',
 [attempt(4,'글의 중심 생각','가상 가족 B의 설명입니다.')],
 [{attempt:0,status:'explained',note:'가족 B 부모만의 관찰 메모'}]);
const sessions=new Map([
 [randomBytes(24).toString('hex'),{role:'guardian',token:TG1,family:F1,recordId:'sameA'}],
 [randomBytes(24).toString('hex'),{role:'guardian',token:TG2,family:F2,recordId:'sameB'}],
 [randomBytes(24).toString('hex'),{role:'guardian',token:TR,family:F1,recordId:'sameA'}],
 [randomBytes(24).toString('hex'),{role:'child',token:TC1,family:F1,recordId:'sameA'}],
 [randomBytes(24).toString('hex'),{role:'guardian',token:TV,family:F1,recordId:'sameA'}]
]);
let checks=0,server,browser;
const contexts=[];
const evidence={kind:'WRONG-P7 actual P6 restore -> new connection -> B4/P3 guardian browser',
 synthetic:true,checks:[],screenCaptures:[],realSupabase:false,operating:false,safeToRestore:false};
function pass(label){checks++;console.log('PASS WRONG_P7_RESTORED_GUARDIAN '+checks+' '+label);evidence.checks.push(label)}
async function rawState(family){
 const value=await pool.query(
  'SELECT revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1',[family]);
 return value.rows[0];
}
async function rawLedgers(family){
 const [child,parent,receipts]=await Promise.all([
  pool.query('SELECT event_text FROM wrong_p6_synthetic.child_retries WHERE family_id=$1 ORDER BY applied_revision',[family]),
  pool.query('SELECT event_text FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1 ORDER BY applied_revision',[family]),
  pool.query('SELECT request_id FROM wrong_p6_synthetic.restore_receipts WHERE family_id=$1 ORDER BY request_id',[family])
 ]);
 return {children:child.rows.map(r=>r.event_text),parents:parent.rows.map(r=>r.event_text),
  receipts:receipts.rows.map(r=>r.request_id)};
}
const expectCode=(promise,code)=>assert.rejects(promise,e=>e?.code===code);
try{
 for(const file of [
  '../db/wrong-p6-synthetic-restore-only.sql',
  '../db/wrong-p7-restored-guardian-read-only.sql'
 ])await pool.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 await pool.query('INSERT INTO wrong_p6_synthetic.family_state(family_id) VALUES($1),($2)',[F1,F2]);
 for(const [family,guardian,role,verified,revoked] of [
  [F1,G1,'guardian',true,false],[F2,G2,'guardian',true,false],
  [F1,REVOKED,'guardian',true,true],[F1,VIEWER,'viewer',true,false]
 ]){
  await pool.query(
   "INSERT INTO wrong_p7_synthetic.guardian_permissions(family_id,guardian_user_id,role,externally_verified,consent_verified_at,revoked_at) VALUES($1,$2,$3,$4,now(),CASE WHEN $5 THEN now() ELSE NULL END)",
   [family,guardian,role,verified,revoked]);
 }
 for(const [family,child,record] of [[F1,C1,'sameA'],[F2,C2,'sameB']]){
  await pool.query(
   'INSERT INTO wrong_p7_synthetic.child_grants(family_id,child_user_id,record_id,consent_verified_at) VALUES($1,$2,$3,now())',
   [family,child,record]);
 }
 const restoredA=await importSyntheticBundleAtomic({
  pool,bundleText:exportSyntheticBundle(A),expectedFamilyId:F1,
  expectedTargetRevision:0,requestId:'p7-family-a-restore-001',syntheticApprove:true
 });
 const restoredB=await importSyntheticBundleAtomic({
  pool,bundleText:exportSyntheticBundle(B),expectedFamilyId:F2,
  expectedTargetRevision:0,requestId:'p7-family-b-restore-001',syntheticApprove:true
 });
 assert.equal(restoredA.revision,5);assert.equal(restoredB.revision,3);
 assert.equal(restoredA.safeToRestore,false);assert.equal(restoredB.safeToRestore,false);
 const beforeA=await rawState(F1),beforeB=await rawState(F2);
 const ledgerA=await rawLedgers(F1),ledgerB=await rawLedgers(F2);
 assert.equal(beforeA.snapshot_text,A.snapshotText);
 assert.equal(beforeA.content_sha256,A.snapshotHash);
 assert.equal(ledgerA.children.length,2);assert.equal(ledgerA.parents.length,2);
 pass('P6 actual signed snapshot+B2 2 events+B3 2 events imported into one synthetic family; second family isolated, safeToRestore false');

 // Reader is intentionally a fresh PostgreSQL connection pool, not the
 // original import client or an in-memory copy of exportSyntheticBundle.
 const freshReader=createWrongP7SyntheticRestoredGuardianReader({
  pool:readPool,authClient});
 const view=await freshReader.guardianRetryTimeline(TG1,F1,'sameA');
 assert.equal(view.readOnlyRestored,true);
 assert.equal(view.safeToRestore,false);
 assert.equal(view.revision,5);
 assert.equal(view.attempts.length,2);
 assert.deepEqual(view.order.map(x=>[x.kind,x.revision]),[
  ['child_retry',2],['guardian_observation',3],
  ['child_retry',4],['guardian_observation',5]]);
 assert.deepEqual(view.attempts.map(x=>x.attemptId),
  ['child-retry-001','child-retry-002']);
 assert.deepEqual(view.attempts.map(x=>x.observations.length),[1,1]);
 assert.equal(view.attempts[0].observations[0].note,
  '첫 번째 자기 설명을 들었습니다.');
 assert.equal(view.attempts[1].explanation,
  '비와 우산 사이의 이유를 더 정확하게 설명했어요.');
 assert.equal(view.unlinkedBackupAttempts,0);
 assert.equal(view.observationEventsIncludedInJsonBackup,false);
 const viewJson=JSON.stringify(view);
 for(const secret of [PNG,'ORIGINAL_CHILD_PRIVATE','PARENT_PRIVATE_ORIGINAL',
  'PRESERVE_OLD_RECORD','가족 B 부모만의 관찰 메모'])
  assert.ok(!viewJson.includes(secret),'private/foreign content leaked');
 pass('fresh new reader joins actual restored event IDs to B4-compatible chronological guardian projection without leaking original photo/private/other-family data');

 assert.equal(await freshReader.guardianRetryTimeline(TG2,F1,'sameA'),null);
 assert.equal(await freshReader.guardianRetryTimeline(TG1,F2,'sameB'),null);
 assert.equal(await freshReader.guardianRetryTimeline(TG1,F1,'sameB'),null);
 assert.equal(await freshReader.guardianRetryTimeline(TR,F1,'sameA'),null);
 assert.equal(await freshReader.guardianRetryTimeline(TC1,F1,'sameA'),null);
 assert.equal(await freshReader.guardianRetryTimeline(TV,F1,'sameA'),null);
 await expectCode(freshReader.guardianRetryTimeline('invalid',F1,'sameA'),'AUTH_REQUIRED');
 const ownB=await freshReader.guardianRetryTimeline(TG2,F2,'sameB');
 assert.equal(ownB.attempts.length,1);assert.equal(ownB.attempts[0].observations.length,1);
 pass('cross-family guardians, revoked guardian, child and viewer denied by fresh DB-backed synthetic permission checks');

 server=await startWrongP3SyntheticLocalServer({
  guardianStore:freshReader,sessions,restoredReadOnly:true,port:0
 });
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const names=[...sessions.keys()];
 const pageFor=async(index,width)=>{
  const context=await browser.newContext({
   viewport:{width,height:844},locale:'ko-KR',colorScheme:'light'});
  await context.addCookies([{
   name:'wrong_p3_demo_session',value:names[index],
   url:server.origin,httpOnly:true,sameSite:'Strict'
  }]);
  contexts.push(context);
  const page=await context.newPage();
  return page;
 };
 const parent=await pageFor(0,390);
 await parent.goto(server.origin+'/qa-p3/parent');
 await parent.locator('#timeline li[data-kind="guardian_observation"]').nth(1).waitFor();
 assert.equal(await parent.locator('#timeline li').count(),4);
 const rows=await parent.locator('#timeline li').allTextContents();
 assert.ok(rows[0].includes('비가 오는 까닭을 첫 번째로 설명'));
 assert.ok(rows[1].includes('첫 번째 자기 설명을 들었습니다'));
 assert.ok(rows[2].includes('비와 우산 사이의 이유를 더 정확하게'));
 assert.ok(rows[3].includes('두 번째 설명에서 추가 도움이'));
 assert.equal(await parent.locator('#observe-form').isVisible(),false);
 assert.equal(await parent.locator('#register-panel').isVisible(),false);
 assert.ok((await parent.locator('#backup-limitation').innerText())
  .includes('v02 JSON 백업에는 별도 부모 관찰 이벤트 원장이 포함되지 않습니다'));
 mkdirSync('test-results/wrong-p7',{recursive:true});
 await parent.screenshot({path:'test-results/wrong-p7/restored-parent-390.png',fullPage:true});
 evidence.screenCaptures.push('restored-parent-390.png');
 pass('real Chromium 390px reuses existing P3 HTML/JS against restored P6 rows; four ordered learning-change events visible and all write forms hidden');

 const beforePost=await rawState(F1);
 const formPost=await parent.evaluate(async()=>{
  const r=await fetch('/qa-p3/api/parent/observe',{
   method:'POST',headers:{'content-type':'application/json','x-wrong-p3-action':'synthetic-only'},
   body:JSON.stringify({attemptId:'child-retry-001',expectedRevision:5,
    requestId:'forged-review-0001',status:'explained',note:'forgery'})
  });
  return {status:r.status,text:await r.text()};
 });
 assert.equal(formPost.status,405);
 assert.ok(formPost.text.includes('P7_RESTORED_READ_ONLY'));
 const childPage=await pageFor(3,320);
 const childResponse=await childPage.goto(server.origin+'/qa-p3/parent');
 assert.equal(childResponse.status(),403);
 const revoked=await pageFor(2,390);
 await revoked.goto(server.origin+'/qa-p3/parent');
 await revoked.waitForFunction(()=>document.querySelector('#app-state')?.textContent?.includes('요청이 거부됐습니다'));
 const revokedGet=await revoked.evaluate(async()=>{
  const r=await fetch('/qa-p3/api/parent/timeline');return {status:r.status,text:await r.text()};
 });
 assert.equal(revokedGet.status,404);
 assert.ok(!revokedGet.text.includes('첫 번째 자기 설명'));
 const other=await pageFor(1,390);
 await other.goto(server.origin+'/qa-p3/parent');
 await other.locator('#timeline li[data-kind="guardian_observation"]').first().waitFor();
 assert.equal(await other.locator('#timeline li').count(),2);
 assert.ok(!(await other.locator('body').innerText()).includes('우산 사이의 이유'));
 const foreignGet=await other.evaluate(async family=>{
  const r=await fetch('/qa-p3/api/parent/timeline?family='+family);
  return {status:r.status,text:await r.text()};
 },F1);
 assert.equal(foreignGet.status,403);
 assert.ok(!foreignGet.text.includes('첫 번째 자기 설명'));
 pass('HTTP/Chromium denies all P7 writes, child/read cross-role, revoked guardian, foreign family; no observation content exposed');

 await parent.reload();
 await parent.locator('#timeline li[data-kind="child_retry"]').nth(1).waitFor();
 const reopenedReader=createWrongP7SyntheticRestoredGuardianReader({
  pool:readPool,authClient});
 assert.deepEqual(await reopenedReader.guardianRetryTimeline(TG1,F1,'sameA'),view);
 assert.deepEqual(await rawState(F1),beforePost);
 assert.deepEqual(await rawState(F1),beforeA);
 assert.deepEqual(await rawState(F2),beforeB);
 assert.deepEqual(await rawLedgers(F1),ledgerA);
 assert.deepEqual(await rawLedgers(F2),ledgerB);
 assert.ok(authRequests>5);
 pass('browser reload and fresh adapter instance leave same family revision, signed backup/photo SHA, child+parent event ledgers, other family and restore receipt bit-for-bit unchanged');

 await pool.query('UPDATE wrong_p7_synthetic.child_grants SET revoked_at=now() WHERE family_id=$1 AND child_user_id=$2',
  [F1,C1]);
 const hidden=await freshReader.guardianRetryTimeline(TG1,F1,'sameA');
 assert.equal(hidden.attempts.length,0);assert.equal(hidden.order.length,0);
 assert.equal(hidden.unlinkedBackupAttempts,2);
 assert.ok(!JSON.stringify(hidden).includes('첫 번째 자기 설명'));
 await pool.query('UPDATE wrong_p7_synthetic.child_grants SET revoked_at=NULL WHERE family_id=$1 AND child_user_id=$2',
  [F1,C1]);
 assert.equal((await freshReader.guardianRetryTimeline(TG1,F1,'sameA')).attempts.length,2);
 await pool.query('UPDATE wrong_p7_synthetic.guardian_permissions SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',
  [F1,G1]);
 assert.equal(await freshReader.guardianRetryTimeline(TG1,F1,'sameA'),null);
 assert.deepEqual(await rawState(F1),beforeA);
 assert.deepEqual(await rawLedgers(F1),ledgerA);
 pass('child-grant and guardian revocation independently fail closed even after restore, without erasing signed data');

 // Detect later synthetic corruption instead of silently constructing a
 // persuasive but incomplete "learning change" UI.
 await pool.query("UPDATE wrong_p6_synthetic.child_retries SET event_text=$4 WHERE family_id=$1 AND child_user_id=$2 AND request_id=$3",
  [F2,C2,'child-retry-001',JSON.stringify({...B.childEvents[0],
   attempt_json:{...B.childEvents[0].attempt_json,answer:'MUTATED'}})]);
 await expectCode(freshReader.guardianRetryTimeline(TG2,F2,'sameB'),
  'P7_RESTORED_EVENT_HASH_MISMATCH');
 await pool.query("UPDATE wrong_p6_synthetic.child_retries SET event_text=$4 WHERE family_id=$1 AND child_user_id=$2 AND request_id=$3",
  [F2,C2,'child-retry-001',JSON.stringify(B.childEvents[0])]);
 await pool.query('DELETE FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1',[F2]);
 await expectCode(freshReader.guardianRetryTimeline(TG2,F2,'sameB'),'P7_RESTORED_LEDGER_GAP');
 await pool.query("INSERT INTO wrong_p6_synthetic.parent_observations(family_id,guardian_user_id,request_id,child_user_id,child_request_id,record_id,event_text,applied_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
  [F2,G2,B.parentEvents[0].request_id,C2,B.parentEvents[0].child_request_id,'sameB',
   JSON.stringify(B.parentEvents[0]),3]);
 assert.deepEqual(await rawLedgers(F2),ledgerB);
 pass('post-restore tampered child event and missing observation are detected with fail-closed errors; synthetic ledger restored to original');

 const tables=await pool.query("SELECT table_schema FROM information_schema.tables WHERE table_schema='qa44'");
 assert.equal(tables.rowCount,0);
 assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,'qa39_ci');
 assert.equal((await freshReader.guardianRetryTimeline(TG2,F2,'sameB')).safeToRestore,false);
 pass('actual QA PostgreSQL16 contains no qa44 operating schema; P7 still safeToRestore false and no real IdP, child or Supabase used');
 evidence.result='PASS';
 evidence.checkCount=checks;
 evidence.syntheticFamilies=2;
 evidence.actualFreshDbReader=true;
 evidence.actualChromium=true;
 evidence.readOnlyAfterRestore=true;
 evidence.legacyIdForged=false;
 evidence.signedBackupAndEventsUnchanged=true;
 evidence.authCheckCount=authRequests;
 writeFileSync('test-results/wrong-p7/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P7_RESTORED_GUARDIAN_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticFamilies:2,restoredChildAttempts:3,
  restoredParentObservations:3,parentViewport:390,realChromium:true,
  dbReadAfterSeparateConnection:true,crossFamilyDenied:true,
  revokedGuardianDenied:true,readOnlyHTTP:true,shaPreserved:true,
  tamperedLedgerDenied:true,operatingSchemaTouched:false,
  realOAuth:false,realSupabase:false,realChildren:0,safeToRestore:false
 }));
}catch(e){
 mkdirSync('test-results/wrong-p7',{recursive:true});
 evidence.result='FAIL';evidence.error=String(e);
 evidence.stack=String(e?.stack).slice(0,2000);
 writeFileSync('test-results/wrong-p7/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P7_RESTORED_GUARDIAN_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:evidence.stack}));
 process.exitCode=1;
}finally{
 for(const ctx of contexts)try{await ctx.close()}catch{}
 if(browser)await browser.close();
 if(server)await server.close();
 await readPool.end();await pool.end();
}
