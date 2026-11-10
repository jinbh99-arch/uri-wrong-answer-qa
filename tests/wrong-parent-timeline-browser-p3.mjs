// WRONG-P3: actual Chromium clicks against loopback-only HTTP and B2/B3/B4
// server-verified synthetic PostgreSQL stores. No mock data rendered in UI.
// Only new connected parent/child browser flow, not previous 12/10/9 suites.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import pg from 'pg';
import {chromium} from 'playwright';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {startWrongP3SyntheticLocalServer} from '../scripts/wrong-p3-local-timeline-server.mjs';

if(!process.env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1')||
 process.env.QA44_STAGE_ONLY!=='1'||process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_GUARDIAN_OBS_ONLY!=='1'||
 process.env.WRONG_P3_SYNTHETIC_LOCAL_ONLY!=='1')throw Error('WRONG_P3_TEST_ONLY');
const {Pool}=pg;
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const guardianPool=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const childPool=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const protectedPool=(pool,role)=>({connect:async()=>{
 const c=await pool.connect();
 try{await c.query('SET ROLE '+role);return c}
 catch(e){c.release();throw e}
}});
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA='11111111-1111-4111-8111-111111111111';
const PB='22222222-2222-4222-8222-222222222222';
const PR='55555555-5555-4555-8555-555555555555';
const CA='33333333-3333-4333-8333-333333333333';
const CB='44444444-4444-4444-8444-444444444444';
const synthetic=new Map([
 ['fake-guardian-a-'+'a'.repeat(65),PA],
 ['fake-guardian-b-'+'b'.repeat(65),PB],
 ['fake-revoked-parent-a-'+'e'.repeat(65),PR],
 ['fake-child-a-'+'c'.repeat(65),CA],
 ['fake-child-b-'+'d'.repeat(65),CB]
]);
const [TPA,TPB,TPR,TCA,TCB]=[...synthetic.keys()];
let getUserCalls=0;
const auth={auth:{async getUser(token){
 getUserCalls++;
 const user=synthetic.get(token);
 return user?{data:{user:{id:user,is_anonymous:false}}}:{error:{status:401}};
}}};
const identities=[
 {role:'guardian',token:TPA,family:FA,recordId:'sameA'},
 {role:'guardian',token:TPB,family:FB,recordId:'sameB'},
 {role:'guardian',token:TPR,family:FA,recordId:'sameA'},
 {role:'child',token:TCA,family:FA,recordId:'sameA'},
 {role:'child',token:TCB,family:FB,recordId:'sameB'}
];
const sessions=new Map(identities.map(x=>[randomBytes(24).toString('hex'),x]));
const sids=[...sessions.keys()];
const evidence={test:'WRONG-P3',source:'synthetic PostgreSQL16 and real Chromium',
 checks:[],networkExternalRequests:0,inputsSynthetic:true,
 restoredExistingBackupEventsAutomatically:false,
 uiOperatingProduct:false,realOAuth:false,realSupabase:false,realChildren:0};
const pass=(title,extra={})=>{
 evidence.checks.push({number:evidence.checks.length+1,title,...extra});
 console.log('PASS WRONG_PARENT_TIMELINE_P3 '+evidence.checks.length+' '+title);
};
let server,browser;
const clients=[];
function requireCode(e,code){return e?.code===code}
async function dbState(family){
 const {rows}=await admin.query(
  'SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',
  [family]);
 return {revision:Number(rows[0].revision),text:rows[0].snapshot_text,hash:rows[0].content_sha256};
}
async function eventCounts(family){
 const a=await admin.query('SELECT count(*)::int AS n FROM qa44.child_retry_events WHERE family_id=$1',[family]);
 const b=await admin.query('SELECT count(*)::int AS n FROM qa44.parent_observation_events WHERE family_id=$1',[family]);
 return {child:a.rows[0].n,guardian:b.rows[0].n};
}
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
async function fetchPage(page,url,init){
 return page.evaluate(async({url,init})=>{
  const r=await fetch(url,init);
  return {status:r.status,text:await r.text()};
 },{url,init});
}
try{
 for(const sql of [
  'CREATE ROLE authenticated NOLOGIN','CREATE ROLE anon NOLOGIN',
  'CREATE SCHEMA auth','CREATE TABLE auth.users(id uuid PRIMARY KEY)',
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
  'CREATE SCHEMA storage',
  'CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])',
  'CREATE TABLE storage.objects(id bigserial PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL UNIQUE)',
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY',
  'GRANT USAGE ON SCHEMA storage,auth TO authenticated',
  'GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated',
  'GRANT USAGE,SELECT ON SEQUENCE storage.objects_id_seq TO authenticated'
 ])await admin.query(sql);
 for(const file of [
  '../db/qa44_supabase_staging_rls.sql',
  '../db/qa44_child_retry_stage_only.sql',
  '../db/qa44_guardian_observation_stage_only.sql'
 ])await admin.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 for(const uid of [PA,PB,PR,CA,CB])
  await admin.query('INSERT INTO auth.users(id) VALUES($1)',[uid]);
 for(const id of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES($1)',[id]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES($1)',[id]);
 }
 for(const [family,user,revoked] of [[FA,PA,false],[FB,PB,false],[FA,PR,true]])
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at,revoked_at) VALUES($1,$2,'guardian','externally_verified',now(),now(),CASE WHEN $3 THEN now() ELSE NULL END)",[family,user,revoked]);
 for(const [family,child,recordId] of [[FA,CA,'sameA'],[FB,CB,'sameB']])
  await admin.query("INSERT INTO qa44.child_retry_grants(family_id,child_user_id,record_id,role,consent_verified_at) VALUES($1,$2,$3,'child',now())",[family,child,recordId]);
 const guardianStore=createQa44ServerFamilyStore({
  pool:protectedPool(guardianPool,'qa44_sync_writer'),authClient:auth});
 const childStore=createQa44ServerFamilyStore({
  pool:protectedPool(childPool,'qa44_child_retry_writer'),authClient:auth});
 server=await startWrongP3SyntheticLocalServer({guardianStore,childStore,sessions,port:0});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const getPage=async(index,width)=>{
  const context=await browser.newContext({
   viewport:{width,height:860},locale:'ko-KR',colorScheme:'light'});
  await context.addCookies([{name:'wrong_p3_demo_session',value:sids[index],
   url:server.origin,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();
  page.on('request',request=>{
   if(!request.url().startsWith(server.origin))
    evidence.networkExternalRequests++;
  });
  clients.push(context);return page;
 };
 const parentA=await getPage(0,390);
 const parentB=await getPage(1,390);
 const revokedA=await getPage(2,390);
 const childA=await getPage(3,320);
 const childB=await getPage(4,320);
 const noAuth=await fetch(server.origin+'/qa-p3/parent');
 assert.equal(noAuth.status,401);
 const noHostStatus=await new Promise((resolve,reject)=>{
  const req=httpRequest(server.origin+'/qa-p3/parent',{headers:{host:'evil.example'}},
   res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});
  req.on('error',reject);req.end();
 });
 assert.equal(noHostStatus,403);
 await parentA.goto(server.origin+'/qa-p3/parent');
 await parentA.locator('#register-panel:visible').waitFor();
 assert.ok((await parentA.locator('body').innerText()).includes('로컬 비운영 합성 연결시험'));
 assert.equal((await parentA.locator('#parent-study').isVisible()),false);
 pass('local browser requires synthetic session; wrong Host denied; unregistered guardian has no invented timeline');

 await childA.goto(server.origin+'/qa-p3/child');
 await childA.waitForFunction(()=>document.getElementById('app-state')?.textContent?.includes('요청이 거부됐습니다'));
 assert.ok((await childA.locator('body').innerText()).includes('보호자 관찰 기록은 이 화면에 표시하지 않습니다'));
 await parentA.locator('#problem-input').fill('합성 국어 문제: 우산을 쓴 까닭은 무엇인가요?');
 await parentA.locator('#register-form button').click();
 await parentA.locator('#parent-study:visible').waitFor();
 const stateRegistered=await dbState(FA);
 assert.equal(stateRegistered.revision,1);
 assert.equal(JSON.parse(stateRegistered.text).records.length,1);
 assert.equal(JSON.parse(stateRegistered.text).records[0].id,'sameA');
 assert.equal(JSON.parse(stateRegistered.text).photos.sameA,PNG);
 await childA.reload();
 await childA.locator('#child-problem').getByText('합성 국어 문제',{exact:false}).waitFor();
 pass('guardian browser registers one wrong-answer using existing verified guardian.put; child only sees granted same record and original fake photo persisted');

 await childA.locator('#retry-answer').fill('비가 왔기 때문입니다.');
 await childA.locator('#retry-explanation').fill('처음에는 우산이 있어서라고 생각했지만 비가 원인이란 걸 다시 읽었어요.');
 await childA.locator('#retry-save').click();
 await childA.locator('#child-own-history li').first().waitFor();
 assert.equal((await dbState(FA)).revision,2);
 await parentA.reload();
 await parentA.locator('#timeline li[data-kind="child_retry"]').first().waitFor();
 assert.equal(await parentA.locator('#timeline li[data-kind="child_retry"]').count(),1);
 await parentA.locator('#observation-note').fill('아이가 문제의 까닭을 자기 말로 설명했습니다.');
 await parentA.locator('#observation-status').selectOption('explained');
 const priorObserve=await dbState(FA);
 await parentA.locator('#observation-save').click();
 await parentA.locator('#timeline li[data-kind="guardian_observation"]').first().waitFor();
 const afterObserve=await dbState(FA);
 assert.equal(afterObserve.revision,3);
 assert.equal(afterObserve.text,priorObserve.text);
 assert.equal(afterObserve.hash,priorObserve.hash);
 pass('child answer/explanation button -> B2 childAppend -> real parent B4 timeline -> B3 observation button; original snapshot/SHA bytes unchanged by parent observation');

 await childA.reload();
 await childA.locator('#retry-answer').fill('비가 와서 젖지 않으려고 우산을 썼습니다.');
 await childA.locator('#retry-explanation').fill('비가 온 사실과 우산을 쓴 행동을 연결해 이유를 더 정확하게 말했어요.');
 await childA.locator('#retry-save').click();
 await childA.locator('#child-own-history li').nth(1).waitFor();
 await parentA.reload();
 await parentA.locator('#timeline li[data-kind="child_retry"]').nth(1).waitFor();
 await parentA.locator('#attempt-select').selectOption({index:1});
 await parentA.locator('#observation-status').selectOption('needs_help');
 await parentA.locator('#observation-note').fill('더 구체적인 근거는 말했으나 설명에 도움이 조금 더 필요했습니다.');
 await parentA.locator('#observation-save').click();
 await parentA.locator('#timeline li[data-kind="guardian_observation"]').nth(1).waitFor();
 const details=await parentA.locator('#timeline li').allTextContents();
 assert.equal(details.length,4);
 assert.ok(details[0].includes('비가 왔기 때문입니다'));
 assert.ok(details[1].includes('자기 말로 설명했습니다'));
 assert.ok(details[2].includes('더 정확하게 말했어요'));
 assert.ok(details[3].includes('도움이 조금 더 필요했습니다'));
 assert.deepEqual((await guardianStore.guardianRetryTimeline(TPA,FA,'sameA')).order.map(e=>e.revision),[2,3,4,5]);
 pass('two actual browser retries and two observations show a four-step, server-revision-ordered learning-change timeline without automatic grading');

 await parentB.goto(server.origin+'/qa-p3/parent');
 await parentB.locator('#register-panel:visible').waitFor();
 await parentB.locator('#problem-input').fill('가족B만의 가상 문제: 중심 내용은?');
 await parentB.locator('#register-form button').click();
 await parentB.locator('#parent-study:visible').waitFor();
 await childB.goto(server.origin+'/qa-p3/child');
 await childB.locator('#child-problem').getByText('가족B만의',{exact:false}).waitFor();
 await childB.locator('#retry-answer').fill('가족B 답변');
 await childB.locator('#retry-explanation').fill('다른 가족 문제입니다');
 await childB.locator('#retry-save').click();
 await childB.locator('#child-own-history li').first().waitFor();
 await parentB.reload();
 await parentB.locator('#timeline li[data-kind="child_retry"]').first().waitFor();
 assert.ok(!(await parentB.locator('body').innerText()).includes('비가 와서 젖지'));
 const forbidden=await fetchPage(parentB,'/qa-p3/api/parent/timeline?family='+FA);
 assert.equal(forbidden.status,403);
 assert.ok(!forbidden.text.includes('비가 왔기 때문입니다.'));
 const forbiddenA=await fetchPage(parentA,'/qa-p3/api/parent/timeline?family='+FB);
 assert.equal(forbiddenA.status,403);
 assert.equal((await guardianStore.guardianRetryTimeline(TPB,FB,'sameB')).attempts.length,1);
 pass('second family independently registers/retries; cross-family query parameters are rejected and parent cards remain isolated');

 const childForbidden=await fetchPage(childA,'/qa-p3/api/parent/timeline');
 assert.equal(childForbidden.status,403);
 const childHtml=await childA.goto(server.origin+'/qa-p3/parent');
 assert.equal(childHtml.status(),403);
 const parentWrong=await parentA.goto(server.origin+'/qa-p3/child');
 assert.equal(parentWrong.status(),403);
 await parentA.goto(server.origin+'/qa-p3/parent');
 await parentA.locator('#timeline li').nth(3).waitFor();
 const withoutHeader=await fetchPage(parentA,'/qa-p3/api/parent/observe',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({attemptId:'child-unverified',expectedRevision:5,
   requestId:'forged-request-001',status:'explained',note:''})
 });
 assert.equal(withoutHeader.status,403);
 await revokedA.goto(server.origin+'/qa-p3/parent');
 await revokedA.waitForFunction(()=>document.getElementById('app-state')?.textContent?.includes('요청이 거부됐습니다'));
 const revokedData=await fetchPage(revokedA,'/qa-p3/api/parent/timeline');
 assert.equal(revokedData.status,403);
 assert.ok(!revokedData.text.includes('비가 와서 젖지'));
 pass('role-separated routes, revoked guardian, CSRF header and direct HTTP cross-role observation denied; no private timeline returned');

 const beforeRevisit=await dbState(FA),beforeB=await dbState(FB);
 const countA=await eventCounts(FA),countB=await eventCounts(FB);
 await parentA.reload();
 await parentA.locator('#timeline li[data-kind="guardian_observation"]').nth(1).waitFor();
 await parentA.reload();
 await parentA.locator('#timeline li[data-kind="child_retry"]').nth(1).waitFor();
 assert.deepEqual(await dbState(FA),beforeRevisit);
 assert.deepEqual(await dbState(FB),beforeB);
 assert.deepEqual(await eventCounts(FA),countA);
 assert.deepEqual(await eventCounts(FB),countB);
 assert.deepEqual(countA,{child:2,guardian:2});
 assert.deepEqual(countB,{child:1,guardian:0});
 assert.ok((await parentA.locator('#backup-limitation').innerText()).includes('v02 JSON 백업에는 별도 부모 관찰 이벤트 원장이 포함되지 않습니다'));
 const backup=JSON.parse(beforeRevisit.text);
 assert.equal(backup.records[0].generalRetryHistory.length,2);
 assert.equal(backup.records[0].generalRetryHistory[0].review,'not_checked');
 assert.equal(backup.photos.sameA,PNG);
 assert.equal(backup.records[0].memo,'가상 부모 비공개 메모');
 assert.ok(!JSON.stringify(backup).includes('아이가 문제의 까닭을 자기 말로 설명했습니다.'));
 pass('refresh is read-only; photo/private memo and B2 history retained, B3 observation ledger absent from v02 backup and prominently disclosed');

 mkdirSync('test-results/wrong-p3',{recursive:true});
 await parentA.screenshot({path:'test-results/wrong-p3/parent-390.png',fullPage:true});
 await childB.screenshot({path:'test-results/wrong-p3/child-320.png',fullPage:true});
 await parentB.screenshot({path:'test-results/wrong-p3/other-family-390.png',fullPage:true});
 await revokedA.screenshot({path:'test-results/wrong-p3/revoked-390.png',fullPage:true});
 assert.ok(getUserCalls>=12);
 assert.equal(evidence.networkExternalRequests,0);
 pass('real Chromium 390px parent + 320px child screenshots captured from B2/B3/B4 backed HTTP; zero external requests',
  {screenshots:4});
 evidence.result='PASS';evidence.checkCount=evidence.checks.length;
 evidence.finalRevisionA=(await dbState(FA)).revision;
 evidence.eventsA=await eventCounts(FA);
 evidence.eventsB=await eventCounts(FB);
 evidence.getUserCalls=getUserCalls;
 evidence.sessionSecurity='synthetic cookie only + original server getUser; NOT IdP';
 writeFileSync('test-results/wrong-p3/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_PARENT_TIMELINE_P3_RESULT='+JSON.stringify({
  status:'PASS',checks:evidence.checkCount,families:2,children:2,
  screenshotCount:4,realChromium:true,localhostOnly:true,
  readBackedByB4:true,guardianWriteB3:true,childWriteB2:true,
  crossFamilyDenied:true,revokedGuardianDenied:true,
  backupLedgerGapShown:true,noActualAccount:true,operatingDeployment:false}));
}catch(e){
 evidence.result='FAIL';evidence.error=String(e);evidence.stack=String(e?.stack).slice(0,1600);
 mkdirSync('test-results/wrong-p3',{recursive:true});
 writeFileSync('test-results/wrong-p3/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_PARENT_TIMELINE_P3_RESULT='+JSON.stringify({
  status:'FAIL',checks:evidence.checks.length,error:String(e),stack:evidence.stack}));
 process.exitCode=1;
}finally{
 for(const ctx of clients)try{await ctx.close()}catch{}
 if(browser)await browser.close();
 if(server)await server.close();
 await guardianPool.end();await childPool.end();await admin.end();
}
