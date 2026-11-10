// WRONG-P2 B4: guardian-only READ projection of B2 child retries and B3
// guardian observations for one record. This is an incremental test, NOT
// a repetition of B2 child role 12/12 or B3 observation CAS 10/10 tests.
// Synthetic PostgreSQL16, two disposable families/children, no real service.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
if(!process.env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1')||
 process.env.QA44_STAGE_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_GUARDIAN_OBS_ONLY!=='1')
 throw Error('WRONG_P2_SYNTHETIC_DB_ONLY');
const {Pool}=pg;
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const writerPool=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const viaRole=role=>({connect:async()=>{
 const c=await writerPool.connect();
 await c.query('SET ROLE '+role);
 return c;
}});
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA='11111111-1111-4111-8111-111111111111';
const PB='22222222-2222-4222-8222-222222222222';
const CA='33333333-3333-4333-8333-333333333333';
const CB='44444444-4444-4444-8444-444444444444';
const PR='55555555-5555-4555-8555-555555555555';
const issued=new Map([
 ['qa-guardian-a-'+'a'.repeat(60),PA],
 ['qa-guardian-b-'+'b'.repeat(60),PB],
 ['qa-child-a-'+'c'.repeat(60),CA],
 ['qa-child-b-'+'d'.repeat(60),CB],
 ['qa-revoked-guardian-a-'+'e'.repeat(60),PR]
]);
const [TPA,TPB,TCA,TCB,TPR]=[...issued.keys()];
const auth={auth:{async getUser(token){
 const id=issued.get(token);
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const legacy={
 at:'2026-11-09T09:00:00.000Z',answer:'옛날 답',explanation:'구형 기록에는 child request ID가 없음',
 review:'not_checked'
};
function backup(family,record){
 return signSynthetic({format:'uriaimath-offline-backup-v02',
  profile:{nickname:'FAKE-'+family,grade:3},
  records:[{id:record,subject:'korean',gradeAtEntry:3,hasPhoto:true,
   problemText:'가상 '+family+' 문제',memo:'PARENT_SECRET_'+family,
   studentAnswer:'PRIVATE_ORIGINAL_'+family,
   generalRetryHistory:family==='A'?[legacy]:[],
   checkHistory:[{at:'2026-11-10T00:00:00Z',
    status:'needs_help',memo:'SECRET_OBSERVATION_'+family,
    by:'parent_observation'}],
   practiceHistory:[]}],
  photos:{[record]:PNG},backupSummary:{recordCount:1,photoCount:1}
 });
}
const docA=backup('A','sameA'),docB=backup('B','sameB');
const checkOriginal=awaitPromise=>awaitPromise;
const inputA1={answer:'12',explanation:'덧셈을 설명했어요'};
const inputA2={answer:'13',explanation:'다시 한번 생각했어요'};
const inputB1={answer:'B',explanation:'다른 가족의 풀이'};
const obsA1={status:'explained',note:'부모: 설명을 들었습니다'};
const obsA2={status:'needs_help',note:'부모: 추가 확인이 필요해요'};
let checks=0;
function pass(label){checks++;console.log('PASS WRONG_GUARDIAN_READ_P2 '+checks+' '+label)}
function onlyCode(code){return e=>e?.code===code}
async function state(family){
 const r=(await admin.query('SELECT revision,snapshot_text,content_sha256,updated_at FROM qa44.family_snapshots WHERE family_id=$1',[family])).rows[0];
 return {revision:Number(r.revision),text:r.snapshot_text,hash:r.content_sha256,updatedAt:r.updated_at.toISOString()};
}
async function totals(family){
 const child=await admin.query('SELECT count(*)::int n FROM qa44.child_retry_events WHERE family_id=$1',[family]);
 const guardian=await admin.query('SELECT count(*)::int n FROM qa44.parent_observation_events WHERE family_id=$1',[family]);
 return {child:child.rows[0].n,guardian:guardian.rows[0].n};
}
const projection=()=>guardian.guardianRetryTimeline(TPA,FA,'sameA');
let guardian,child;
try{
 for(const sql of [
  'CREATE ROLE authenticated NOLOGIN',
  'CREATE ROLE anon NOLOGIN',
  'CREATE SCHEMA auth',
  'CREATE TABLE auth.users(id uuid PRIMARY KEY)',
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
 for(const uid of [PA,PB,CA,CB,PR])
  await admin.query('INSERT INTO auth.users(id) VALUES($1)',[uid]);
 for(const family of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES($1)',[family]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES($1)',[family]);
 }
 for(const [family,uid,revoked] of [[FA,PA,false],[FB,PB,false],[FA,PR,true]])
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at,revoked_at) VALUES($1,$2,'guardian','externally_verified',now(),now(),CASE WHEN $3 THEN now() ELSE NULL END)",
   [family,uid,revoked]);
 for(const [family,uid,record] of [[FA,CA,'sameA'],[FB,CB,'sameB']])
  await admin.query("INSERT INTO qa44.child_retry_grants(family_id,child_user_id,record_id,role,consent_verified_at) VALUES($1,$2,$3,'child',now())",
   [family,uid,record]);
 const seed=createQa44ServerFamilyStore({pool:admin,authClient:auth});
 guardian=createQa44ServerFamilyStore({pool:viaRole('qa44_sync_writer'),authClient:auth});
 child=createQa44ServerFamilyStore({pool:viaRole('qa44_child_retry_writer'),authClient:auth});
 assert.equal((await seed.put(TPA,FA,0,docA)).revision,1);
 assert.equal((await seed.put(TPB,FB,0,docB)).revision,1);
 assert.equal((await child.childAppend(TCA,FA,'sameA',1,'child-a-retry-001',inputA1)).revision,2);
 assert.equal((await guardian.guardianObserve(TPA,FA,'sameA',CA,'child-a-retry-001',2,
  'parent-a-observe-001',obsA1)).revision,3);
 assert.equal((await child.childAppend(TCA,FA,'sameA',3,'child-a-retry-002',inputA2)).revision,4);
 assert.equal((await guardian.guardianObserve(TPA,FA,'sameA',CA,'child-a-retry-001',4,
  'parent-a-observe-002',obsA2)).revision,5);
 assert.equal((await guardian.guardianObserve(TPA,FA,'sameA',CA,'child-a-retry-002',5,
  'parent-a-observe-003',{status:'explained',note:'두번째 풀이 관찰'})).revision,6);
 assert.equal((await child.childAppend(TCB,FB,'sameB',1,'child-b-retry-001',inputB1)).revision,2);
 assert.equal((await guardian.guardianObserve(TPB,FB,'sameB',CB,'child-b-retry-001',2,
  'parent-b-observe-001',{status:'explained',note:'가족B 비공개 관찰'})).revision,3);
 pass('new projection fixtures: 2 families, 2 children, one record ID each, 3 A parent events, 1 B event');

 const savedA=await state(FA),savedB=await state(FB);
 const countsA=await totals(FA),countsB=await totals(FB);
 const view=await projection();
 assert.equal(view.revision,6);
 assert.equal(view.readOnly,true);
 assert.equal(view.observationEventsIncludedInJsonBackup,false);
 assert.equal(view.unlinkedBackupAttempts,1);
 assert.equal(view.record.id,'sameA');
 assert.equal(view.record.hasPhoto,true);
 assert.equal(view.attempts.length,2);
 assert.deepEqual(view.attempts.map(x=>x.attemptId),['child-a-retry-001','child-a-retry-002']);
 assert.deepEqual(view.attempts.map(x=>x.answer),['12','13']);
 assert.deepEqual(view.attempts.map(x=>x.observations.length),[2,1]);
 assert.deepEqual(view.attempts[0].observations.map(x=>x.id),['parent-a-observe-001','parent-a-observe-002']);
 assert.deepEqual(view.attempts[1].observations.map(x=>x.id),['parent-a-observe-003']);
 assert.deepEqual(view.order.map(x=>x.revision),[2,3,4,5,6]);
 assert.deepEqual(view.order.map(x=>x.kind),[
  'child_retry','guardian_observation','child_retry','guardian_observation','guardian_observation'
 ]);
 assert.deepEqual(view.order.filter(x=>x.kind==='guardian_observation').map(x=>x.attemptId),[
  'child-a-retry-001','child-a-retry-001','child-a-retry-002'
 ]);
 pass('guardian sees exact B2 request IDs + B3 observation IDs, linked to attempt and ordered by server CAS revisions');

 const dumped=JSON.stringify(view);
 for(const privateValue of ['PARENT_SECRET_A','PRIVATE_ORIGINAL_A','SECRET_OBSERVATION_A',PNG,
  '가족B 비공개 관찰','PARENT_SECRET_B','옛날 답'])
  assert.ok(!dumped.includes(privateValue),'private/legacy data exposed '+privateValue);
 assert.equal(view.unlinkedBackupAttempts,1);
 assert.equal((await guardian.read(TPA,FA)).snapshot.records[0].generalRetryHistory.length,3);
 pass('projection suppresses full backup, photo bytes, unrelated family, old unlinked history body and parent private original metadata');

 assert.deepEqual(await state(FA),savedA);
 assert.deepEqual(await state(FB),savedB);
 assert.deepEqual(await totals(FA),countsA);
 assert.deepEqual(await totals(FB),countsB);
 const reopened=createQa44ServerFamilyStore({pool:viaRole('qa44_sync_writer'),authClient:auth});
 assert.deepEqual(await reopened.guardianRetryTimeline(TPA,FA,'sameA'),view);
 assert.deepEqual(await state(FA),savedA);
 pass('multiple read-only projections across a new store instance cause no snapshot/revision/SHA/event edits');

 // Duplicate of a B3 request is acknowledged without an additional ledger
 // event; B4 projection must remain deduplicated and independent of caller
 // retries. These are *targeted* projection checks, not replaying 10 B3 tests.
 const duplicate=await guardian.guardianObserve(TPA,FA,'sameA',CA,'child-a-retry-001',2,
  'parent-a-observe-001',obsA1);
 assert.deepEqual(duplicate,{stored:true,duplicate:true,revision:3});
 assert.deepEqual(await projection(),view);
 assert.deepEqual(await totals(FA),countsA);
 assert.deepEqual(await state(FA),savedA);
 await assert.rejects(guardian.guardianObserve(TPA,FA,'sameA',CA,'child-a-retry-001',2,
  'parent-a-observe-001',{status:'needs_help',note:'alter'}),onlyCode('OBSERVATION_REQUEST_ID_REUSED'));
 pass('same request ID replay does not duplicate timeline; mutated replay is rejected, record bytes unchanged');

 assert.equal(await guardian.guardianRetryTimeline(TPA,FB,'sameB'),null);
 assert.equal(await guardian.guardianRetryTimeline(TPB,FA,'sameA'),null);
 assert.equal(await guardian.guardianRetryTimeline(TPA,FA,'sameB'),null);
 assert.equal(await guardian.guardianRetryTimeline(TPR,FA,'sameA'),null);
 assert.equal(await guardian.guardianRetryTimeline(TCA,FA,'sameA'),null);
 assert.equal(await guardian.guardianRetryTimeline(TCB,FB,'sameB'),null);
 await assert.rejects(guardian.guardianRetryTimeline('invalid token',FA,'sameA'),onlyCode('AUTH_REQUIRED'));
 const viewB=await guardian.guardianRetryTimeline(TPB,FB,'sameB');
 assert.equal(viewB.attempts.length,1);
 assert.equal(viewB.attempts[0].observations.length,1);
 assert.ok(!JSON.stringify(viewB).includes('부모: 설명을 들었습니다'));
 pass('guardian-only auth, per-family per-record scoping, revoked guardian and children denied other roles/history');

 // Backup/restore danger: B3 observation events are in a separate DB table,
 // not inside v02 JSON. Simulate a stale v02 restore of only the original
 // signed backup, WITHOUT deleting the event tables. B4 must fail closed
 // rather than imply that child attempts and parent observations survived.
 const originallyB=await state(FB);
 const originalText=JSON.stringify(docB);
 const originalHash=createHash('sha256').update(originalText).digest('hex');
 await admin.query('UPDATE qa44.family_snapshots SET snapshot_text=$2,content_sha256=$3 WHERE family_id=$1',
  [FB,originalText,originalHash]);
 await assert.rejects(guardian.guardianRetryTimeline(TPB,FB,'sameB'),
  onlyCode('CHILD_EVENT_HISTORY_MISMATCH'));
 await admin.query('UPDATE qa44.family_snapshots SET snapshot_text=$2,content_sha256=$3 WHERE family_id=$1',
  [FB,originallyB.text,originallyB.hash]);
 assert.deepEqual((await guardian.guardianRetryTimeline(TPB,FB,'sameB')).attempts[0].observations[0].note,
  '가족B 비공개 관찰');
 pass('old backup without event ledger is NOT a complete restore; signed snapshot mismatch detected and original synthetic state recovered');

 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 const hidden=await projection();
 assert.equal(hidden.attempts.length,0);
 assert.equal(hidden.order.length,0);
 assert.equal(hidden.unlinkedBackupAttempts,3);
 assert.ok(!JSON.stringify(hidden).includes(obsA1.note));
 assert.deepEqual(await state(FA),savedA);
 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=NULL,consent_verified_at=NULL WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 assert.equal((await projection()).attempts.length,0);
 await admin.query('UPDATE qa44.child_retry_grants SET consent_verified_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 assert.deepEqual((await projection()).attempts.length,2);
 pass('child grant withdrawal/missing consent hides linked attempts/observations without deleting stored history or leaking content');

 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,PA]);
 assert.equal(await projection(),null);
 assert.equal(await reopened.guardianRetryTimeline(TPA,FA,'sameA'),null);
 assert.equal((await guardian.guardianRetryTimeline(TPB,FB,'sameB')).attempts.length,1);
 assert.deepEqual(await state(FA),savedA);
 assert.equal((await totals(FA)).guardian,3);
 pass('guardian revocation immediately blocks read, including a newly created store; other family and immutable ledger intact');

 console.log('WRONG_GUARDIAN_READ_P2_RESULT='+JSON.stringify({
  status:'PASS',checks,families:2,children:2,
  linksByB2AttemptId:true,orderedByCASRevision:true,
  noTimestampAsAttemptId:true,readOnlyNoWrites:true,
  staleBackupRestoreFailClosed:true,
  revokedGuardiansDenied:true,revokedChildGrantsHidden:true,
  crossFamilyDenied:true,duplicateTimelineFree:true,
  oldBackupDoesNotContainObservationLedger:true,
  realIdP:false,realSupabase:false,realChildren:0,
  uiIntegrated:false,productionApproved:false
 }));
}catch(e){
 console.error('WRONG_GUARDIAN_READ_P2_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,1600)}));
 process.exitCode=1;
}finally{
 await writerPool.end();await admin.end();
}
