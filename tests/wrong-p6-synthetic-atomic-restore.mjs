// WRONG-P6 ONLY: actual PostgreSQL16 atomic staged import of signed v02
// snapshot + B2 child retries + B3 guardian observations, from the P5 bundle.
// Strictly synthetic/temporary database. No existing P5 6/6 suite replay.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {exportSyntheticBundle,preflightSyntheticImport} from '../scripts/wrong-p5-synthetic-bundle-preflight.mjs';
import {importSyntheticBundleAtomic} from '../scripts/wrong-p6-synthetic-atomic-restore.mjs';
const env=process.env;
if(env.QA44_STAGE_ONLY!=='1'||env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||
 env.WRONG_P5_SYNTHETIC_BUNDLE_ONLY!=='1'||env.WRONG_P6_SYNTHETIC_ATOMIC_ONLY!=='1'||
 !env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1'))
 throw Error('WRONG_P6_EPHEMERAL_POSTGRES_ONLY');
const pool=new pg.Pool({connectionString:env.QA39_TEST_DATABASE_URL,max:4});
const sha=s=>createHash('sha256').update(s).digest('hex');
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CA='33333333-3333-4333-8333-333333333333',CB='44444444-4444-4444-8444-444444444444';
const PA='11111111-1111-4111-8111-111111111111',PB='22222222-2222-4222-8222-222222222222';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const T='2026-11-11T00:00:00.000Z';
const stamp=n=>new Date(Date.parse(T)+n*1000).toISOString();
const attempt=(n,answer,explanation)=>({at:stamp(n),answer,explanation,review:'not_checked'});
const fields=(family,child,guardian,record,tries,observations,extraRecord=false)=>{
 const retry=tries.map((row,i)=>({
  family_id:family,child_user_id:child,request_id:'child-retry-00'+(i+1),
  record_id:record,attempt_json:row,input_sha256:sha(JSON.stringify({
   recordId:record,answer:row.answer,explanation:row.explanation
  })),base_revision:2*i+1,applied_revision:2*i+2,created_at:stamp(10+i)
 }));
 const parents=observations.map((o,i)=>({
  family_id:family,guardian_user_id:guardian,request_id:'parent-observe-00'+(i+1),
  record_id:record,child_user_id:child,child_request_id:retry[o.attemptIndex].request_id,
  status:o.status,note:o.note,
  input_sha256:sha(JSON.stringify({recordId:record,childUserId:child,
   childRequestId:retry[o.attemptIndex].request_id,status:o.status,note:o.note})),
  base_revision:2*i+2,applied_revision:2*i+3,created_at:stamp(30+i)
 }));
 const docs=[{id:record,subject:'korean',gradeAtEntry:3,
  problemText:'가상 가족 '+family+' 국어 문제',hasPhoto:true,
  studentAnswer:'INITIAL_SYNTHETIC_ERROR',memo:'PARENT_PRIVATE_SYNTHETIC_NOTE',
  generalRetryHistory:tries,checkHistory:[{at:stamp(0),status:'not_checked',
   memo:'구형 부모 메모는 그대로 보존',by:'parent_observation'}],practiceHistory:[]}];
 if(extraRecord)docs.push({id:'old-untouched',subject:'math',gradeAtEntry:3,
  problemText:'기존 사진 없는 기록',hasPhoto:false,
  generalRetryHistory:[],checkHistory:[],practiceHistory:[],
  memo:'DO_NOT_LOSE_EXISTING_RECORD'});
 const signed=signSynthetic({format:'uriaimath-offline-backup-v02',
  profile:{grade:3,nickname:'synthetic-'+family},
  records:docs,photos:{[record]:png},
  backupSummary:{recordCount:docs.length,photoCount:1}});
 const snapshotText=JSON.stringify(signed),revision=1+retry.length+parents.length;
 return {familyId:family,revision,snapshotText,snapshotHash:sha(snapshotText),
  childEvents:retry,parentEvents:parents};
};
const sourceA=fields(FA,CA,PA,'sameA',[
 attempt(1,'비가 왔다','비가 온 것이 원인이에요'),
 attempt(3,'비를 피해 우산을 썼다','이유와 행동을 다시 연결해 설명했어요')
],[
 {attemptIndex:0,status:'explained',note:'가상 부모 확인: 첫 설명을 들음'},
 {attemptIndex:1,status:'needs_help',note:'가상 부모 확인: 두번째 설명에 도움 필요'}
],true);
const sourceB=fields(FB,CB,PB,'sameB',
 [attempt(4,'두번째 문장','가상 B 가족의 이유 설명')],
 [{attemptIndex:0,status:'explained',note:'가상 B 관찰 독립'}]);
const bundleA=exportSyntheticBundle(sourceA),bundleB=exportSyntheticBundle(sourceB);
const opts=(family,bundle,requestId='restore-synthetic-001',approve=true,additional={})=>({
 pool,bundleText:bundle,expectedFamilyId:family,expectedTargetRevision:0,
 requestId,syntheticApprove:approve,...additional
});
const rejected=async(p,code)=>assert.rejects(p,e=>e?.code===code);
let checks=0;const pass=label=>{checks++;console.log('PASS WRONG_P6_ATOMIC '+checks+' '+label)};
async function family(family){
 const r=(await pool.query('SELECT family_id,revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1',[family])).rows[0];
 return {family_id:r.family_id,revision:Number(r.revision),snapshot_text:r.snapshot_text,content_sha256:r.content_sha256};
}
async function events(family){
 const [children,parents,receipts]=await Promise.all([
  pool.query('SELECT event_text FROM wrong_p6_synthetic.child_retries WHERE family_id=$1 ORDER BY applied_revision',[family]),
  pool.query('SELECT event_text FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1 ORDER BY applied_revision',[family]),
  pool.query('SELECT request_id FROM wrong_p6_synthetic.restore_receipts WHERE family_id=$1 ORDER BY request_id',[family])
 ]);
 return {child:children.rows.map(x=>JSON.parse(x.event_text)),
  parent:parents.rows.map(x=>JSON.parse(x.event_text)),
  receipts:receipts.rows.map(x=>x.request_id)};
}
async function unchanged(family,expectedSnapshot,expectedEvents){
 assert.deepEqual(await familySnapshot(family),expectedSnapshot);
 assert.deepEqual(await events(family),expectedEvents);
}
async function familySnapshot(familyId){return family(familyId)}
try{
 await pool.query(readFileSync(new URL('../db/wrong-p6-synthetic-restore-only.sql',import.meta.url),'utf8'));
 await pool.query('INSERT INTO wrong_p6_synthetic.family_state(family_id) VALUES($1),($2)',[FA,FB]);
 const beforeA=await family(FA),beforeB=await family(FB);
 const empty={child:[],parent:[],receipts:[]};
 assert.equal(preflightSyntheticImport(bundleA,{expectedFamilyId:FA,expectedRevision:5}).safeToRestore,false);
 assert.equal(preflightSyntheticImport(bundleB,{expectedFamilyId:FB,expectedRevision:3}).safeToRestore,false);
 assert.equal(JSON.parse(bundleA).manifest.parentCount,2);
 pass('P5 preflight applied to signed rich B2/B3 synthetic bundle: manifest valid but safeToRestore remains false');

 await rejected(importSyntheticBundleAtomic(opts(FA,bundleA,'no-approval-001',false)),
  'P6_SYNTHETIC_APPROVAL_REQUIRED');
 await unchanged(FA,beforeA,empty);
 pass('staged rows + manifest verified, but without explicit synthetic go/no-go persistent rows remain zero');

 await rejected(importSyntheticBundleAtomic(opts(FB,bundleA,'foreign-family-001')),
  'FAMILY_CONTEXT_MISMATCH');
 await rejected(importSyntheticBundleAtomic(opts(FA,bundleA,'wrong-target-rev-001',true,
  {expectedTargetRevision:1})),'P6_TARGET_STALE_REVISION');
 const broken=JSON.parse(bundleA);broken.parentEvents[0].note='tampered';
 await rejected(importSyntheticBundleAtomic(opts(FA,JSON.stringify(broken),'tamper-001')),
  'BUNDLE_DIGEST_MISMATCH');
 await unchanged(FA,beforeA,empty);
 await unchanged(FB,beforeB,empty);
 pass('wrong family / stale target revision / tampered payload rejected before target modification');

 const missingInput={...sourceA,parentEvents:sourceA.parentEvents.slice(0,1)};
 const corruptedChild={...sourceA,
  childEvents:sourceA.childEvents.map((x,i)=>i===0?{...x,input_sha256:'0'.repeat(64)}:x)};
 const duplicated={...sourceA,childEvents:[...sourceA.childEvents,sourceA.childEvents[0]]};
 for(const sample of [missingInput,duplicated]){
  assert.throws(()=>exportSyntheticBundle(sample));
 }
 await rejected(importSyntheticBundleAtomic(opts(FA,exportSyntheticBundle(corruptedChild),
  'bad-child-hash-001')),'P6_CHILD_INPUT_HASH_MISMATCH');
 const brokenParent={...sourceA,parentEvents:sourceA.parentEvents.map((p,i)=>
  i===0?{...p,note:'forged but P5-rehashed'}:p)};
 await rejected(importSyntheticBundleAtomic(opts(FA,exportSyntheticBundle(brokenParent),
  'bad-parent-hash-001')),'P6_PARENT_INPUT_HASH_MISMATCH');
 await unchanged(FA,beforeA,empty);
 pass('missing ledger, duplicate attempt ID, and rehashed malicious child/parent input hashes fail closed');

 for(const point of ['after_snapshot','after_child','after_parent','before_commit']){
  await rejected(importSyntheticBundleAtomic(opts(FA,bundleA,'test-rollback-'+point,true,
   {failPoint:point})), 'P6_FORCED_FAIL_'+
   ({after_snapshot:'AFTER_SNAPSHOT',after_child:'AFTER_CHILD',
    after_parent:'AFTER_PARENT',before_commit:'BEFORE_COMMIT'})[point]);
  await unchanged(FA,beforeA,empty);
 }
 pass('forced failures at 4 transaction phases roll back snapshot, both ledgers, revision and request receipt');

 // Actual PostgreSQL trigger failure is independent of the JavaScript
 // exception gates. Parent INSERT fails after snapshot and child INSERT.
 await pool.query(`CREATE FUNCTION wrong_p6_synthetic.fail_parent_insert()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'P6_FORCED_POSTGRES_CONSTRAINT_FAILURE'; END $$`);
 await pool.query(`CREATE TRIGGER p6_force_parent_failure BEFORE INSERT ON
  wrong_p6_synthetic.parent_observations FOR EACH ROW
  EXECUTE FUNCTION wrong_p6_synthetic.fail_parent_insert()`);
 await assert.rejects(importSyntheticBundleAtomic(
  opts(FA,bundleA,'test-sql-rollback-01')),
  /P6_FORCED_POSTGRES_CONSTRAINT_FAILURE/);
 await unchanged(FA,beforeA,empty);
 await pool.query('DROP TRIGGER p6_force_parent_failure ON wrong_p6_synthetic.parent_observations');
 await pool.query('DROP FUNCTION wrong_p6_synthetic.fail_parent_insert()');
 pass('real PostgreSQL parent-insert failure after snapshot/child stage rolls back EVERYTHING');

 const stored=await importSyntheticBundleAtomic(opts(FA,bundleA,'restore-fa-first-001'));
 assert.deepEqual({committed:stored.committedSynthetic,duplicate:stored.duplicate,
  revision:stored.revision,child:stored.childCount,parent:stored.parentCount,
  productionSafe:stored.safeToRestore},
  {committed:true,duplicate:false,revision:5,child:2,parent:2,productionSafe:false});
 const afterA=await family(FA),afterEventsA=await events(FA);
 assert.equal(afterA.snapshot_text,sourceA.snapshotText);
 assert.equal(afterA.content_sha256,sourceA.snapshotHash);
 assert.deepEqual(afterEventsA.child,sourceA.childEvents);
 assert.deepEqual(afterEventsA.parent,sourceA.parentEvents);
 assert.deepEqual(afterEventsA.receipts,['restore-fa-first-001']);
 const record=JSON.parse(afterA.snapshot_text).records;
 assert.equal(record.length,2);
 assert.equal(record[1].memo,'DO_NOT_LOSE_EXISTING_RECORD');
 assert.equal(JSON.parse(afterA.snapshot_text).photos.sameA,png);
 assert.equal(record[0].generalRetryHistory.length,2);
 assert.equal(afterEventsA.parent[1].note,sourceA.parentEvents[1].note);
 await unchanged(FB,beforeB,empty);
 pass('approved synthetic atomic restore commits signed v02 + all B2/B3 events + photo + existing source records exactly, other family unchanged');

 const repeated=await importSyntheticBundleAtomic(opts(FA,bundleA,'restore-fa-first-001'));
 assert.equal(repeated.duplicate,true);
 await unchanged(FA,afterA,afterEventsA);
 const variant={...sourceA,snapshotText:JSON.stringify(signSynthetic({
  ...JSON.parse(sourceA.snapshotText),profile:{grade:3,nickname:'modified synthetic'}
 }))};
 variant.snapshotHash=sha(variant.snapshotText);
 await rejected(importSyntheticBundleAtomic(opts(FA,exportSyntheticBundle(variant),
  'restore-fa-first-001')),'P6_REQUEST_ID_REUSED');
 await unchanged(FA,afterA,afterEventsA);
 pass('same request ID idempotent across calls; reused ID with changed but P5-valid signed payload denied, zero duplicate events');

 await rejected(importSyntheticBundleAtomic(opts(FA,bundleA,'restore-fa-again-new-001',true,
  {expectedTargetRevision:5})),'P6_TARGET_RECORD_CONFLICT');
 await rejected(importSyntheticBundleAtomic(opts(FA,bundleA,'restore-fa-stale-001')),
  'P6_TARGET_STALE_REVISION');
 await unchanged(FA,afterA,afterEventsA);
 pass('occupied same-family target never overwritten or silently merged: RECORD_CONFLICT-style fail-closed and CAS stale protection');

 // Two independently connected writers racing for the same empty FB family
 // each stage the identical source but use distinct request IDs. One winner.
 const contenders=await Promise.allSettled([
  importSyntheticBundleAtomic(opts(FB,bundleB,'race-restorer-01')),
  importSyntheticBundleAtomic(opts(FB,bundleB,'race-restorer-02'))
 ]);
 assert.equal(contenders.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(contenders.filter(x=>x.status==='rejected').length,1);
 assert.equal(contenders.find(x=>x.status==='rejected').reason?.code,'P6_TARGET_STALE_REVISION');
 const afterB=await family(FB),eventsB=await events(FB);
 assert.equal(afterB.revision,3);
 assert.equal(afterB.snapshot_text,sourceB.snapshotText);
 assert.deepEqual(eventsB.child,sourceB.childEvents);
 assert.deepEqual(eventsB.parent,sourceB.parentEvents);
 assert.equal(eventsB.receipts.length,1);
 await unchanged(FA,afterA,afterEventsA);
 pass('concurrent same-family restore attempts serialize on row lock: one commit and one CAS stale; no duplicate/partial state');

 // A new connection/pool witnesses the committed state; no in-memory mock.
 const fresh=new pg.Pool({connectionString:env.QA39_TEST_DATABASE_URL});
 try{
  const verify=await fresh.query('SELECT count(*)::int AS n FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1',[FA]);
  assert.equal(verify.rows[0].n,2);
  const verifyB=await fresh.query('SELECT revision FROM wrong_p6_synthetic.family_state WHERE family_id=$1',[FB]);
  assert.equal(Number(verifyB.rows[0].revision),3);
 }finally{await fresh.end()}
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='qa44'")).rows[0].n,0);
 assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,'qa39_ci');
 pass('reopened SQL connection confirms durable synthetic import, while qa44 operating schema is never created or touched');

 console.log('WRONG_P6_ATOMIC_RESULT='+JSON.stringify({status:'PASS',checks,
  syntheticFamilies:2,signedSnapshotAndPhotoPreserved:true,
  childRetriesRestored:3,parentObservationsRestored:3,
  transactionRollbackFailurePoints:5,consistencyPreflight:true,
  noWriteWithoutSyntheticApproval:true,foreignAndStaleDenied:true,
  mutationAndDuplicateDenied:true,concurrentCasOneWinner:true,
  recordsAndPhotosPreserved:true,
  realOAuth:false,realGuardianConsent:false,realSupabase:false,
  realChildren:0,operatingMigration:false,safeToRestore:false}));
}catch(e){
 console.error('WRONG_P6_ATOMIC_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),
  code:e?.code,stack:String(e?.stack).slice(0,1800)}));
 process.exitCode=1;
}finally{await pool.end()}
