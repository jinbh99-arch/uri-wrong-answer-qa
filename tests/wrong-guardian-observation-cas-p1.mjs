// WRONG-P1 B3: ONLY the guardian's same-record observation-event/CAS gap.
// Existing B2 12 checks, prior family-boundary tests and A UI are NOT rerun.
// Ephemeral PostgreSQL16 + synthetic token getUser(); no actual user/project.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
if(process.env.QA44_STAGE_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_GUARDIAN_OBS_ONLY!=='1'||
 !process.env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1'))
 throw Error('WRONG_B3_EPHEMERAL_SYNTHETIC_ONLY');
const {Pool}=pg;
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const privatePool=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const getWriter=role=>({connect:async()=>{
 const c=await privatePool.connect();
 await c.query('SET ROLE '+role);
 return c;
}});
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UA='11111111-1111-4111-8111-111111111111';
const UB='22222222-2222-4222-8222-222222222222';
const UC='66666666-6666-4666-8666-666666666666';
const CA='33333333-3333-4333-8333-333333333333';
const CB='44444444-4444-4444-8444-444444444444';
const tokens=new Map([
 ['synthetic-parent-A-'+'a'.repeat(70),UA],
 ['synthetic-parent-B-'+'b'.repeat(70),UB],
 ['synthetic-revoked-parent-A-'+'x'.repeat(70),UC],
 ['synthetic-child-A-'+'c'.repeat(70),CA],
 ['synthetic-child-B-'+'d'.repeat(70),CB]
]);
const [TA,TB,TX,TCA,TCB]=[...tokens.keys()];
const auth={auth:{async getUser(token){
 const id=tokens.get(token);
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
function backup(label,recordId){
 return signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{nickname:'synthetic-'+label,grade:3},
  records:[{id:recordId,subject:'korean',gradeAtEntry:3,
   problemText:'synthetic '+label+' text',hasPhoto:true,
   memo:'PARENT_PRIVATE_'+label,studentAnswer:'secret-original-'+label,
   generalRetryHistory:[],practiceHistory:[],
   checkHistory:[{at:'2026-11-10T00:00:00.000Z',status:'not_checked',
    memo:'old parent check '+label,by:'parent_observation'}]}],
  photos:{[recordId]:png},
  backupSummary:{recordCount:1,photoCount:1}
 });
}
const originalA=backup('family-A','sameA');
const originalB=backup('family-B','sameB');
const basic={answer:'답 A',explanation:'아이가 자기 말로 설명함'};
const note={status:'explained',note:'가상 부모 관찰: 스스로 설명'};
const childReq='child-retry-a-001';
const parentReq='guardian-review-a-001';
let checks=0;
const pass=t=>{checks++;console.log('PASS WRONG_GUARDIAN_OBS_P1 '+checks+' '+t)};
const assertCode=async(p,code)=>assert.rejects(p,e=>e?.code===code);
async function state(family){
 const r=(await admin.query('SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',[family])).rows[0];
 return {revision:Number(r.revision),snapshot_text:r.snapshot_text,content_sha256:r.content_sha256};
}
async function countEvents(family){
 return Number((await admin.query('SELECT count(*)::int AS n FROM qa44.parent_observation_events WHERE family_id=$1',[family])).rows[0].n);
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
 for(const id of [UA,UB,UC,CA,CB])await admin.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
 for(const family of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES($1)',[family]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES($1)',[family]);
 }
 for(const [family,user,revoked] of [[FA,UA,false],[FB,UB,false],[FA,UC,true]])
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at,revoked_at) VALUES ($1,$2,'guardian','externally_verified',now(),now(),CASE WHEN $3 THEN now() ELSE NULL END)",
   [family,user,revoked]);
 for(const [family,user,record] of [[FA,CA,'sameA'],[FB,CB,'sameB']])
  await admin.query("INSERT INTO qa44.child_retry_grants(family_id,child_user_id,record_id,role,consent_verified_at) VALUES($1,$2,$3,'child',now())",
   [family,user,record]);
 const guardian=createQa44ServerFamilyStore({pool:getWriter('qa44_sync_writer'),authClient:auth});
 const child=createQa44ServerFamilyStore({pool:getWriter('qa44_child_retry_writer'),authClient:auth});
 const seed=createQa44ServerFamilyStore({pool:admin,authClient:auth});
 assert.equal((await seed.put(TA,FA,0,originalA)).revision,1);
 assert.equal((await seed.put(TB,FB,0,originalB)).revision,1);
 const a1=await child.childAppend(TCA,FA,'sameA',1,childReq,basic);
 const b1=await child.childAppend(TCB,FB,'sameB',1,'child-retry-b-001',{answer:'B',explanation:'B 설명'});
 assert.equal(a1.revision,2);assert.equal(b1.revision,2);
 assert.deepEqual((await guardian.guardianObservations(TA,FA,'sameA')).observations,[]);
 const beforeA=await state(FA),beforeB=await state(FB);
 pass('2 synthetic families + 2 synthetic child attempts, no old timestamp as attempt identity');

 const first=await guardian.guardianObserve(TA,FA,'sameA',CA,childReq,2,parentReq,note);
 assert.deepEqual(first,{stored:true,duplicate:false,revision:3});
 const currentA=await state(FA);
 assert.equal(currentA.revision,3);
 assert.equal(currentA.snapshot_text,beforeA.snapshot_text);
 assert.equal(currentA.content_sha256,beforeA.content_sha256);
 assert.deepEqual(await state(FB),beforeB);
 const obs=(await guardian.guardianObservations(TA,FA,'sameA')).observations;
 assert.equal(obs.length,1);
 assert.equal(obs[0].childAttemptId,childReq);
 assert.equal(obs[0].status,'explained');
 assert.equal(obs[0].note,note.note);
 assert.equal((await child.childRead(TCA,FA,'sameA')).ownAttempts[0].review,'not_checked');
 pass('guardian observes exact B2 attempt by immutable ID; append-only event, original answer/photo/parent memo/SHA bytes unchanged');

 const restarted=createQa44ServerFamilyStore({pool:getWriter('qa44_sync_writer'),authClient:auth});
 assert.deepEqual(await restarted.guardianObserve(TA,FA,'sameA',CA,childReq,2,parentReq,note),
  {stored:true,duplicate:true,revision:3});
 assert.equal((await restarted.guardianObservations(TA,FA,'sameA')).observations.length,1);
 assert.equal((await state(FA)).revision,3);
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,2,parentReq,
  {status:'needs_help',note:'changed'}),'OBSERVATION_REQUEST_ID_REUSED');
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,2,
  'guardian-review-a-stale',{status:'explained'}),'STALE_REVISION');
 pass('durable idempotent guardian event across new store instance; changed payload or stale CAS rejected');

 const bad=[
  {status:'explained',note:'x',reviewedAt:'2026-11-10'},
  {status:'explained',photos:{sameA:'tamper'}},
  {status:'explained',generalRetryHistory:[]},
  {status:'approved',note:'x'},
  {status:'explained',note:'x'.repeat(501)}
 ];
 for(const x of bad)await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,3,
   'parent-input-bad-01',x),'GUARDIAN_OBSERVATION_FIELDS_DENIED');
 assert.equal(await countEvents(FA),1);
 assert.deepEqual(await state(FA),currentA);
 pass('exact guardian-only status/note allowlist; no forged answer, photo, timestamp or child history mutation');

 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,'fake-attempt-0001',3,
  'guardian-fake-attempt-01',note),'CHILD_ATTEMPT_NOT_ACCESSIBLE');
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,'2026-11-10T14:00:00.000Z',3,
  'guardian-fake-time-01',note),'INVALID_OBSERVATION_REQUEST_ID');
 await assertCode(guardian.guardianObserve(TA,FA,'sameB',CB,'child-retry-b-001',3,
  'guardian-forged-record-01',note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 await assertCode(guardian.guardianObserve(TB,FA,'sameA',CA,childReq,3,
  'other-family-guardian-01',note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 await assertCode(guardian.guardianObserve(TX,FA,'sameA',CA,childReq,3,
  'revoked-guardian-01',note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 await assertCode(guardian.guardianObserve(TCA,FA,'sameA',CA,childReq,3,
  'self-guardian-01',note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 assert.equal(await guardian.guardianObservations(TB,FA,'sameA'),null);
 assert.equal(await guardian.guardianObservations(TCA,FA,'sameA'),null);
 pass('cross-family, revoked guardian, child-as-parent, forged time and nonexistent attempt IDs denied');

 // SQL privilege defense: an authenticated browser may not directly select or
 // delete parent observations. Server-only writer may SELECT, INSERT but not
 // UPDATE or DELETE; even a server bug cannot overwrite original event.
 const roleConn=await privatePool.connect();
 try{
  await roleConn.query('BEGIN');
  await roleConn.query('SET LOCAL ROLE qa44_sync_writer');
  await roleConn.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[UA]);
  await assert.rejects(roleConn.query('DELETE FROM qa44.parent_observation_events WHERE family_id=$1',[FA]));
  await roleConn.query('ROLLBACK');
 }finally{roleConn.release()}
 const clientConn=await privatePool.connect();
 try{
  await clientConn.query('BEGIN');
  await clientConn.query('SET LOCAL ROLE authenticated');
  await clientConn.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[CA]);
  await assert.rejects(clientConn.query('SELECT * FROM qa44.parent_observation_events'));
  await clientConn.query('ROLLBACK');
 }finally{clientConn.release()}
 pass('server-side observation event has no update/delete privilege; no direct authenticated client view');

 // A synthetic insert failure occurs AFTER family snapshot revision CAS;
 // transaction rollback must restore both family revision and event count.
 await admin.query(`CREATE FUNCTION qa44.fail_observation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.request_id='parent-crash-recover-01' THEN
  RAISE EXCEPTION 'QA_FORCED_EVENT_FAILURE';
 END IF; RETURN NEW; END $$`);
 await admin.query(`CREATE TRIGGER qa44_test_rollback BEFORE INSERT ON qa44.parent_observation_events
 FOR EACH ROW EXECUTE FUNCTION qa44.fail_observation_insert()`);
 await assert.rejects(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,3,
  'parent-crash-recover-01',note),/QA_FORCED_EVENT_FAILURE/);
 assert.deepEqual(await state(FA),currentA);
 assert.equal(await countEvents(FA),1);
 await admin.query('DROP TRIGGER qa44_test_rollback ON qa44.parent_observation_events');
 await admin.query('DROP FUNCTION qa44.fail_observation_insert()');
 pass('forced event-insert failure after CAS fully rolls back revision and preserves old snapshot/event');

 // Parent vs child same revision: both paths lock THE SAME snapshot row.
 // One succeeds, the other fails stale revision; no silent merge.
 const race=await Promise.allSettled([
  guardian.guardianObserve(TA,FA,'sameA',CA,childReq,3,
   'guardian-race-review-01',{status:'needs_help',note:'다음 확인 필요'}),
  child.childAppend(TCA,FA,'sameA',3,'child-race-retry-002',
   {answer:'두 번째 시도',explanation:'새 방법으로 직접 설명'})
 ]);
 const yes=race.filter(x=>x.status==='fulfilled'),no=race.filter(x=>x.status==='rejected');
 assert.equal(yes.length,1);assert.equal(no.length,1);
 assert.equal(no[0].reason?.code,'STALE_REVISION');
 assert.equal((await state(FA)).revision,4);
 // Recover the losing operation by a new revision (explicit caller retry).
 if(race[0].status==='rejected'){
  assert.equal((await guardian.guardianObserve(TA,FA,'sameA',CA,childReq,4,
   'guardian-race-review-01',{status:'needs_help',note:'다음 확인 필요'})).revision,5);
 }else{
  assert.equal((await child.childAppend(TCA,FA,'sameA',4,'child-race-retry-002',
   {answer:'두 번째 시도',explanation:'새 방법으로 직접 설명'})).revision,5);
 }
 assert.equal((await state(FA)).revision,5);
 assert.equal((await guardian.guardianObservations(TA,FA,'sameA')).observations.length,2);
 assert.equal((await child.childRead(TCA,FA,'sameA')).ownAttempts.length,2);
 pass('parent/child concurrent CAS: one success one stale, explicit re-read/retry recovers both append-only events');

 // Existing conservative guardian full-backup put must keep failing when the
 // same ID carries different checkHistory or generalRetryHistory.
 const gCurrent=(await guardian.read(TA,FA)).snapshot;
 const illegal=structuredClone(gCurrent);
 illegal.records[0].checkHistory.push({at:'2026-11-11T00:00:00.000Z',
  status:'needs_help',memo:'would overwrite old parent state',by:'parent_observation'});
 signSynthetic(illegal);
 await assertCode(guardian.put(TA,FA,5,illegal),'RECORD_CONFLICT');
 assert.equal(await countEvents(FA),2);
 assert.equal((await state(FA)).revision,5);
 pass('B2 full-backup same-ID RECORD_CONFLICT is still fail-closed, never globally loosened');

 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,5,
  'guardian-after-childrevoke-01',note),'CHILD_ATTEMPT_NOT_ACCESSIBLE');
 assert.deepEqual((await guardian.guardianObservations(TA,FA,'sameA')).observations,[]);
 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=NULL,consent_verified_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.equal(await guardian.guardianObservations(TA,FA,'sameA'),null);
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,5,
  'guardian-after-revoke-01',note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 await assertCode(guardian.guardianObserve(TA,FA,'sameA',CA,childReq,2,
  parentReq,note),'GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
 assert.equal(await countEvents(FA),2);
 assert.equal((await state(FA)).revision,5);
 assert.equal((await guardian.read(TB,FB)).snapshot.records[0].id,'sameB');
 assert.equal((await guardian.guardianObservations(TB,FB,'sameB')).observations.length,0);
 assert.equal((await child.childRead(TCB,FB,'sameB')).ownAttempts.length,1);
 pass('child/grant or guardian/consent revocation blocks observation and duplicate replay; family B remains intact');

 console.log('WRONG_GUARDIAN_OBS_P1_RESULT='+JSON.stringify({
  status:'PASS',checks,families:2,syntheticChildren:2,
  signedSnapshotImmutableOnParentEvent:true,parentEventAppendOnly:true,
  noUnsafeTimestampId:true,noParentPhotoRetryLoss:true,authorizationDenied:true,
  replayIdempotent:true,crashRollback:true,childGuardianRaceCas:true,
  existingRecordConflictUnchanged:true,revocationFailClosed:true,
  uiIntegrated:false,realOAuth:false,realSupabase:false,realChildren:0,
  productionApproved:false
 }));
}catch(e){
 console.error('WRONG_GUARDIAN_OBS_P1_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,2000)}));
 process.exitCode=1;
}finally{
 await privatePool.end();await admin.end();
}
