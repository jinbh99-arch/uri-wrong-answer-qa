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
import {assessSyntheticLedgerRestore,makeSyntheticLedgerManifest} from '../scripts/wrong-p4-synthetic-ledger-preflight.mjs';
if(process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||!process.env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1')||
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
function pass(label){checks++;console.log('PASS WRONG_P4_BACKUP_RISK '+checks+' '+label)}
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

 // P4 new scope only: independently capture actual PostgreSQL v02 backup
 // and the two separate event ledgers; never write/restore live rows.
 const load=async family=>{
  const snap=(await admin.query('SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',[family])).rows[0];
  const ce=(await admin.query('SELECT family_id,child_user_id,request_id,record_id,attempt_json,applied_revision FROM qa44.child_retry_events WHERE family_id=$1 ORDER BY applied_revision',[family])).rows.map(x=>({...x,applied_revision:Number(x.applied_revision)}));
  const pe=(await admin.query('SELECT family_id,guardian_user_id,request_id,record_id,child_user_id,child_request_id,applied_revision FROM qa44.parent_observation_events WHERE family_id=$1 ORDER BY applied_revision',[family])).rows.map(x=>({...x,applied_revision:Number(x.applied_revision)}));
  return {familyId:family,snapshotText:snap.snapshot_text,snapshotHash:snap.content_sha256,
   revision:Number(snap.revision),childEvents:ce,parentEvents:pe};
 };
 const a=await load(FA),b=await load(FB);
 assert.equal(a.parentEvents.length,3);assert.equal(b.parentEvents.length,1);
 assert.equal(JSON.parse(a.snapshotText).photos.sameA,PNG);
 assert.equal(JSON.parse(a.snapshotText).records[0].generalRetryHistory.length,3);
 pass('two real synthetic PostgreSQL families have separate v02 snapshots and B2/B3 event ledgers');

 const errorCode=code=>e=>e?.code===code;
 assert.throws(()=>assessSyntheticLedgerRestore(a),errorCode('V02_PARENT_LEDGER_MISSING'));
 assert.throws(()=>assessSyntheticLedgerRestore(b),errorCode('V02_PARENT_LEDGER_MISSING'));
 pass('real v02 JSON-only restore is rejected for both families: parent observation ledger absent');

 const ma=makeSyntheticLedgerManifest(a),mb=makeSyntheticLedgerManifest(b);
 const good=assessSyntheticLedgerRestore({...a,manifest:ma});
 assert.equal(good.manifestConsistent,true);assert.equal(good.safeToRestore,false);
 assert.equal(good.reason,'TRANSACTIONAL_RESTORE_AND_CONSENT_NOT_IMPLEMENTED');
 assert.equal(assessSyntheticLedgerRestore({...b,manifest:mb}).safeToRestore,false);
 pass('manifest digest and counts match exact database rows; verification never claims operational restore');

 assert.throws(()=>assessSyntheticLedgerRestore({...a,manifest:mb}),errorCode('MANIFEST_MISMATCH'));
 assert.throws(()=>assessSyntheticLedgerRestore({...a,parentEvents:[...a.parentEvents,b.parentEvents[0]],manifest:ma}),errorCode('FOREIGN_FAMILY_EVENT'));
 assert.throws(()=>assessSyntheticLedgerRestore({...a,childEvents:[...a.childEvents,b.childEvents[0]],manifest:ma}),errorCode('FOREIGN_FAMILY_EVENT'));
 pass('cross-family ledger or manifest mixing rejected before restore');

 const dropped={...a,parentEvents:a.parentEvents.slice(0,2)};
 assert.throws(()=>assessSyntheticLedgerRestore({...dropped,manifest:ma}),errorCode('EVENT_REVISION_GAP'));
 const duplicated={...a,parentEvents:[...a.parentEvents,a.parentEvents[0]]};
 assert.throws(()=>assessSyntheticLedgerRestore({...duplicated,manifest:ma}),errorCode('INVALID_EVENT_REVISION'));
 const corrupt={...a,parentEvents:a.parentEvents.map((e,i)=>i?e:{...e,child_request_id:'forged-child-request'})};
 assert.throws(()=>assessSyntheticLedgerRestore({...corrupt,manifest:ma}),errorCode('PARENT_CHILD_ATTEMPT_MISSING'));
 pass('partial ledger, duplicated event and orphan observation request fail closed');

 const altered={...a,parentEvents:a.parentEvents.map((e,i)=>i?e:{...e,request_id:'tampered-observation'})};
 assert.throws(()=>assessSyntheticLedgerRestore({...altered,manifest:ma}),errorCode('EVENT_LEDGER_DIGEST_MISMATCH'));
 const forged={...a,snapshotText:a.snapshotText+' '};
 assert.throws(()=>assessSyntheticLedgerRestore({...forged,manifest:ma}),errorCode('SNAPSHOT_HASH_MISMATCH'));
 pass('tampered event and v02 snapshot bytes rejected by independent digests');

 const revoked=await guardian.guardianRetryTimeline(TPR,FA,'sameA');
 assert.equal(revoked,null);
 assert.equal(await guardian.guardianRetryTimeline(TPA,FB,'sameB'),null);
 // This preflight accepts a trusted server-side dataset, NOT a caller token:
 // it must never be offered as a public API or interpreted as authorization.
 assert.equal(assessSyntheticLedgerRestore({...a,manifest:ma}).safeToRestore,false);
 pass('existing revoked/cross-family guardian read remains denied; preflight is not an authentication/restore endpoint');

 assert.deepEqual(await load(FA),a);
 assert.deepEqual(await load(FB),b);
 assert.deepEqual(await totals(FA),{child:2,guardian:3});
 assert.deepEqual(await totals(FB),{child:1,guardian:1});
 pass('all fail-closed probes read-only; photo, retry IDs, revisions, SHA and both event ledgers unchanged');

 console.log('WRONG_P4_BACKUP_RISK_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticFamilies:2,guardianEventsA:3,guardianEventsB:1,
  v02OnlyRestore:'DENIED',manifest:'READ_ONLY_PREFLIGHT',
  transactionalRestoreImplemented:false,realSupabase:false,realUsers:false,
  changesToExistingA:false}));
}catch(e){
 console.error('WRONG_P4_BACKUP_RISK_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:e?.stack}));
 process.exitCode=1;
}finally{
 await writerPool.end();await admin.end();
}
