// WRONG-P6: minimal ATOMIC synthetic staging/import of P5 manifest bundle.
// Explicitly NOT production restoration, credential validation, OAuth or
// legal-guardian consent. Never connects to or mutates qa44/operating schemas.
// Uses ONE client/transaction for staging, CAS, snapshot + B2/B3 ledgers,
// verification and receipt. Any error rolls back EVERYTHING.
import {createHash} from 'node:crypto';
import {checkBackup} from './qa-family-merge-preflight.mjs';
import {preflightSyntheticImport} from './wrong-p5-synthetic-bundle-preflight.mjs';
const fail=code=>Object.assign(new Error(code),{code});
const sha=value=>createHash('sha256').update(value).digest('hex');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQ=/^[a-zA-Z0-9_-]{8,64}$/;
function guard(){
 if(process.env.QA44_STAGE_ONLY!=='1'||
  process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||
  process.env.WRONG_P5_SYNTHETIC_BUNDLE_ONLY!=='1'||
  process.env.WRONG_P6_SYNTHETIC_ATOMIC_ONLY!=='1')
  throw fail('P6_EPHEMERAL_SYNTHETIC_ONLY');
}
const serializable=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validString=v=>typeof v==='string'&&v.length>0;
function validateEvents(bundle){
 let signed;try{signed=JSON.parse(bundle.snapshotText)}catch{throw fail('P6_INVALID_SIGNED_SNAPSHOT')}
 try{checkBackup(signed)}catch{throw fail('P6_SIGNED_SNAPSHOT_INVALID')}
 if(signed.format!=='uriaimath-offline-backup-v02')throw fail('P6_BACKUP_FORMAT');
 const records=new Map(signed.records.map(r=>[r.id,r]));
 const seenChild=new Set(),seenParent=new Set(),childById=new Map(),usedHistory=new Map();
 const revisions=new Set();
 for(const c of bundle.childEvents){
  if(!serializable(c)||c.family_id!==bundle.familyId||
   !UUID.test(c.child_user_id||'')||!REQ.test(c.request_id||'')||
   !validString(c.record_id)||!serializable(c.attempt_json)||
   !Number.isSafeInteger(c.applied_revision)||c.applied_revision<2||
   !Number.isSafeInteger(c.base_revision)||c.base_revision!==c.applied_revision-1||
   typeof c.created_at!=='string'||!Number.isFinite(Date.parse(c.created_at))||
   typeof c.attempt_json.at!=='string'||
   !Number.isFinite(Date.parse(c.attempt_json.at))||
   typeof c.attempt_json.answer!=='string'||
   !c.attempt_json.answer.trim()||c.attempt_json.answer.length>500||
   typeof c.attempt_json.explanation!=='string'||
   c.attempt_json.explanation.length>350||
   c.attempt_json.review!=='not_checked')
   throw fail('P6_CHILD_EVENT_SHAPE');
  const input=JSON.stringify({recordId:c.record_id,answer:c.attempt_json.answer,
   explanation:c.attempt_json.explanation});
  if(c.input_sha256!==sha(input))throw fail('P6_CHILD_INPUT_HASH_MISMATCH');
  const key=c.child_user_id+'|'+c.request_id;
  if(seenChild.has(key))throw fail('P6_DUPLICATE_CHILD_ID');
  seenChild.add(key);childById.set(key,c);
  if(revisions.has(c.applied_revision))throw fail('P6_DUPLICATE_REVISION');
  revisions.add(c.applied_revision);
  const record=records.get(c.record_id);
  if(!record)throw fail('P6_CHILD_RECORD_MISSING');
  const history=Array.isArray(record.generalRetryHistory)?record.generalRetryHistory:[];
  const signature=x=>JSON.stringify([x?.at,x?.answer,x?.explanation]);
  const wanted=signature(c.attempt_json);
  let used=usedHistory.get(c.record_id);
  if(!used){used=new Set();usedHistory.set(c.record_id,used)}
  const idx=history.findIndex((h,i)=>!used.has(i)&&signature(h)===wanted&&h?.review==='not_checked');
  if(idx<0)throw fail('P6_CHILD_HISTORY_MISMATCH');
  used.add(idx);
 }
 for(const p of bundle.parentEvents){
  if(!serializable(p)||p.family_id!==bundle.familyId||
   !UUID.test(p.guardian_user_id||'')||!UUID.test(p.child_user_id||'')||
   !REQ.test(p.request_id||'')||!REQ.test(p.child_request_id||'')||
   !validString(p.record_id)||
   !['not_checked','explained','needs_help'].includes(p.status)||
   typeof p.note!=='string'||p.note.length>500||
   !Number.isSafeInteger(p.applied_revision)||p.applied_revision<2||
   !Number.isSafeInteger(p.base_revision)||p.base_revision!==p.applied_revision-1||
   typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at)))
   throw fail('P6_PARENT_EVENT_SHAPE');
  const input=JSON.stringify({recordId:p.record_id,childUserId:p.child_user_id,
   childRequestId:p.child_request_id,status:p.status,note:p.note});
  if(p.input_sha256!==sha(input))throw fail('P6_PARENT_INPUT_HASH_MISMATCH');
  const key=p.guardian_user_id+'|'+p.request_id;
  if(seenParent.has(key))throw fail('P6_DUPLICATE_PARENT_ID');
  seenParent.add(key);
  if(revisions.has(p.applied_revision))throw fail('P6_DUPLICATE_REVISION');
  revisions.add(p.applied_revision);
  const target=childById.get(p.child_user_id+'|'+p.child_request_id);
  if(!target||target.record_id!==p.record_id||
   target.applied_revision>=p.applied_revision)
   throw fail('P6_PARENT_ATTEMPT_MISMATCH');
 }
 if(revisions.size!==bundle.revision-1)throw fail('P6_REVISION_GAP');
 return Object.freeze({records:signed.records.length,photos:Object.keys(signed.photos).length,
  children:bundle.childEvents.length,observations:bundle.parentEvents.length});
}
/**
 * @param {{pool:object,bundleText:string,expectedFamilyId:string,
 * expectedTargetRevision:number,requestId:string,syntheticApprove:boolean,
 * failPoint?:string}} input
 * Every apply must be explicitly approved in the synthetic test harness, NOT
 * interpreted as legal guardian consent or real account approval.
 */
export async function importSyntheticBundleAtomic({
 pool,bundleText,expectedFamilyId,expectedTargetRevision,
 requestId,syntheticApprove=false,failPoint=null
}={}){
 guard();
 if(!pool||typeof pool.connect!=='function')throw fail('P6_PRIVATE_POOL_REQUIRED');
 if(!UUID.test(expectedFamilyId||'')||!Number.isSafeInteger(expectedTargetRevision)||
  expectedTargetRevision<0||typeof requestId!=='string'||!REQ.test(requestId))
  throw fail('P6_INVALID_IMPORT_CONTEXT');
 if(typeof bundleText!=='string'||Buffer.byteLength(bundleText)>1024*1024)
  throw fail('P6_BUNDLE_SIZE_OR_TYPE');
 let bundle;try{bundle=JSON.parse(bundleText)}catch{throw fail('P6_INVALID_BUNDLE')}
 // P5 preflight proves internal bundle/manifest consistency but STILL says
 // safeToRestore:false. This function is only a synthetic transaction test.
 preflightSyntheticImport(bundleText,{expectedFamilyId,expectedRevision:bundle?.revision});
 const verified=validateEvents(bundle);
 const bundleDigest=sha(bundleText);
 const client=await pool.connect();let active=false;
 try{
  await client.query('BEGIN');active=true;
  // Deny any possible accidental connection to a real external database;
  // ALSO enforced by the disposable QA fixture migration itself.
  const db=await client.query('SELECT current_database() AS db,inet_server_addr() AS ip');
  if(db.rows[0].db!=='qa39_ci'||!['127.0.0.1','::1'].includes(String(db.rows[0].ip)))
   throw fail('P6_NOT_EPHEMERAL_LOOPBACK_DB');
  const owner=await client.query(
   'SELECT family_id,revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1 FOR UPDATE',
   [expectedFamilyId]);
  if(owner.rowCount!==1)throw fail('P6_TARGET_FAMILY_MISSING');
  // Duplicate check AFTER target lock and staging input validation. Never
  // repeat writes on retry; same request ID with altered data fails closed.
  const prior=await client.query(
   'SELECT bundle_sha256,imported_revision FROM wrong_p6_synthetic.restore_receipts WHERE family_id=$1 AND request_id=$2',
   [expectedFamilyId,requestId]);
  if(prior.rowCount){
   if(prior.rows[0].bundle_sha256!==bundleDigest||
    Number(prior.rows[0].imported_revision)!==bundle.revision)
    throw fail('P6_REQUEST_ID_REUSED');
   if(!syntheticApprove)throw fail('P6_SYNTHETIC_APPROVAL_REQUIRED');
   await client.query('COMMIT');active=false;
   return Object.freeze({committedSynthetic:true,duplicate:true,
    revision:bundle.revision,childCount:verified.children,
    parentCount:verified.observations,safeToRestore:false,
    realUserApproval:false});
  }
  if(Number(owner.rows[0].revision)!==expectedTargetRevision)
   throw fail('P6_TARGET_STALE_REVISION');
  if(owner.rows[0].snapshot_text!==null||owner.rows[0].content_sha256!==null)
   throw fail('P6_TARGET_RECORD_CONFLICT');
  const childCount=await client.query(
   'SELECT count(*)::int AS n FROM wrong_p6_synthetic.child_retries WHERE family_id=$1',
   [expectedFamilyId]);
  const parentCount=await client.query(
   'SELECT count(*)::int AS n FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1',
   [expectedFamilyId]);
  if(childCount.rows[0].n!==0||parentCount.rows[0].n!==0)
   throw fail('P6_TARGET_LEDGER_CONFLICT');

  // Stage both event sets as session-private temporary tables INSIDE the
  // transaction; none of the actual target tables are changed yet.
  await client.query('CREATE TEMP TABLE wrong_p6_child_stage (family_id uuid,child_user_id text,request_id text,record_id text,event_text text,applied_revision bigint) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE wrong_p6_parent_stage (family_id uuid,guardian_user_id text,request_id text,child_user_id text,child_request_id text,record_id text,event_text text,applied_revision bigint) ON COMMIT DROP');
  for(const e of bundle.childEvents)await client.query(
   'INSERT INTO pg_temp.wrong_p6_child_stage VALUES ($1,$2,$3,$4,$5,$6)',
   [expectedFamilyId,e.child_user_id,e.request_id,e.record_id,JSON.stringify(e),e.applied_revision]);
  for(const e of bundle.parentEvents)await client.query(
   'INSERT INTO pg_temp.wrong_p6_parent_stage VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
   [expectedFamilyId,e.guardian_user_id,e.request_id,e.child_user_id,e.child_request_id,
    e.record_id,JSON.stringify(e),e.applied_revision]);
  const stage=await client.query(
   'SELECT (SELECT count(*)::int FROM pg_temp.wrong_p6_child_stage) AS children, '+
   '(SELECT count(*)::int FROM pg_temp.wrong_p6_parent_stage) AS observations');
  if(stage.rows[0].children!==verified.children||
   stage.rows[0].observations!==verified.observations)
   throw fail('P6_STAGE_COUNT_MISMATCH');
  const dangling=await client.query(
   'SELECT count(*)::int AS n FROM pg_temp.wrong_p6_parent_stage p '+
   'LEFT JOIN pg_temp.wrong_p6_child_stage c ON c.family_id=p.family_id '+
   'AND c.child_user_id=p.child_user_id AND c.request_id=p.child_request_id '+
   'AND c.record_id=p.record_id AND c.applied_revision<p.applied_revision '+
   'WHERE c.request_id IS NULL');
  if(dangling.rows[0].n!==0)throw fail('P6_STAGED_PARENT_ORPHAN');
  if(syntheticApprove!==true)throw fail('P6_SYNTHETIC_APPROVAL_REQUIRED');
  // Explicit go/no-go after staging, before writing ANY persistent record.
  const updated=await client.query(
   'UPDATE wrong_p6_synthetic.family_state SET revision=$3,snapshot_text=$4,content_sha256=$5,updated_at=now() '+
   'WHERE family_id=$1 AND revision=$2 AND snapshot_text IS NULL AND content_sha256 IS NULL RETURNING revision',
   [expectedFamilyId,expectedTargetRevision,bundle.revision,bundle.snapshotText,bundle.snapshotHash]);
  if(updated.rowCount!==1)throw fail('P6_CAS_OR_EXISTING_RECORD_CONFLICT');
  if(failPoint==='after_snapshot')throw fail('P6_FORCED_FAIL_AFTER_SNAPSHOT');
  await client.query(
   'INSERT INTO wrong_p6_synthetic.child_retries '+
   '(family_id,child_user_id,request_id,record_id,event_text,applied_revision) '+
   'SELECT family_id,child_user_id,request_id,record_id,event_text,applied_revision '+
   'FROM pg_temp.wrong_p6_child_stage ORDER BY applied_revision');
  if(failPoint==='after_child')throw fail('P6_FORCED_FAIL_AFTER_CHILD');
  await client.query(
   'INSERT INTO wrong_p6_synthetic.parent_observations '+
   '(family_id,guardian_user_id,request_id,child_user_id,child_request_id,record_id,event_text,applied_revision) '+
   'SELECT family_id,guardian_user_id,request_id,child_user_id,child_request_id,record_id,event_text,applied_revision '+
   'FROM pg_temp.wrong_p6_parent_stage ORDER BY applied_revision');
  if(failPoint==='after_parent')throw fail('P6_FORCED_FAIL_AFTER_PARENT');
  const [stored,children,parents]=await Promise.all([
   client.query('SELECT revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1',[expectedFamilyId]),
   client.query('SELECT event_text FROM wrong_p6_synthetic.child_retries WHERE family_id=$1 ORDER BY applied_revision',[expectedFamilyId]),
   client.query('SELECT event_text FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1 ORDER BY applied_revision',[expectedFamilyId])
  ]);
  if(stored.rowCount!==1||Number(stored.rows[0].revision)!==bundle.revision||
   stored.rows[0].snapshot_text!==bundle.snapshotText||
   stored.rows[0].content_sha256!==bundle.snapshotHash||
   children.rows.length!==verified.children||parents.rows.length!==verified.observations||
   children.rows.some((r,i)=>r.event_text!==JSON.stringify(
    [...bundle.childEvents].sort((a,b)=>a.applied_revision-b.applied_revision)[i]))||
   parents.rows.some((r,i)=>r.event_text!==JSON.stringify(
    [...bundle.parentEvents].sort((a,b)=>a.applied_revision-b.applied_revision)[i])))
   throw fail('P6_POST_IMPORT_LOSS_OR_MISMATCH');
  await client.query(
   'INSERT INTO wrong_p6_synthetic.restore_receipts(family_id,request_id,bundle_sha256,imported_revision) VALUES($1,$2,$3,$4)',
   [expectedFamilyId,requestId,bundleDigest,bundle.revision]);
  if(failPoint==='before_commit')throw fail('P6_FORCED_FAIL_BEFORE_COMMIT');
  await client.query('COMMIT');active=false;
  return Object.freeze({committedSynthetic:true,duplicate:false,
   revision:bundle.revision,childCount:verified.children,
   parentCount:verified.observations,safeToRestore:false,
   realUserApproval:false});
 }catch(e){
  if(active)try{await client.query('ROLLBACK')}catch{}
  throw e;
 }finally{client.release()}
}
