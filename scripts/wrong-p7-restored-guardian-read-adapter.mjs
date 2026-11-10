// WRONG-P7, ephemeral post-P6 restore -> verified guardian B4-compatible
// one-record read projection. Uses ONLY wrong_p6_synthetic and synthetic
// permission fixtures, never qa44 or an operating Supabase account.
// Reuses the B4 output contract so the existing P3 localhost parent UI can
// render actual restored data without forging legacy timestamp IDs.
import {createHash} from 'node:crypto';
import {checkBackup} from './qa-family-merge-preflight.mjs';
const error=code=>Object.assign(new Error(code),{code});
const digest=s=>createHash('sha256').update(s).digest('hex');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD=/^[A-Za-z0-9_-]{1,100}$/;
const asRevision=v=>{
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw error('P7_REVISION_INVALID');return n;
};
function syntheticGuard(){
 if(process.env.QA44_STAGE_ONLY!=='1'||
  process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||
  process.env.WRONG_P5_SYNTHETIC_BUNDLE_ONLY!=='1'||
  process.env.WRONG_P6_SYNTHETIC_ATOMIC_ONLY!=='1'||
  process.env.WRONG_P7_SYNTHETIC_RESTORED_READONLY!=='1')
  throw error('P7_SYNTHETIC_RESTORE_READ_ONLY');
 let uri;try{uri=new URL(process.env.QA39_TEST_DATABASE_URL)}catch{}
 if(uri?.hostname!=='127.0.0.1'||uri?.pathname!=='/qa39_ci')
  throw error('P7_NOT_LOCAL_TEST_DATABASE');
}
const ensureId=(v,record=false)=>{
 if(typeof v!=='string'||!(record?RECORD:UUID).test(v))
  throw error(record?'P7_INVALID_RECORD_ID':'P7_INVALID_FAMILY_ID');
 return v;
};
function verifySnapshot(row){
 if(!row||typeof row.snapshot_text!=='string'||
  digest(row.snapshot_text)!==row.content_sha256)
  throw error('P7_RESTORED_SNAPSHOT_HASH_MISMATCH');
 let snapshot;try{snapshot=JSON.parse(row.snapshot_text)}catch{
  throw error('P7_RESTORED_SNAPSHOT_INVALID');
 }
 try{checkBackup(snapshot)}catch{throw error('P7_RESTORED_SIGNED_BACKUP_INVALID')}
 return snapshot;
}
function parseEvent(raw,type,family){
 let e;try{e=JSON.parse(raw)}catch{throw error('P7_RESTORED_EVENT_INVALID')}
 if(!e||typeof e!=='object'||Array.isArray(e)||e.family_id!==family||
  typeof e.record_id!=='string'||typeof e.request_id!=='string'||
  !UUID.test(e.child_user_id||'')||
  !Number.isSafeInteger(e.applied_revision)||e.applied_revision<2||
  e.base_revision!==e.applied_revision-1)
  throw error('P7_RESTORED_EVENT_INVALID');
 let input;
 if(type==='child'){
  if(!e.attempt_json||e.attempt_json.review!=='not_checked')throw error('P7_CHILD_EVENT_INVALID');
  input=JSON.stringify({recordId:e.record_id,answer:e.attempt_json.answer,
   explanation:e.attempt_json.explanation});
 }else{
  if(!UUID.test(e.guardian_user_id||'')||
   !['not_checked','explained','needs_help'].includes(e.status))
   throw error('P7_PARENT_EVENT_INVALID');
  input=JSON.stringify({recordId:e.record_id,childUserId:e.child_user_id,
   childRequestId:e.child_request_id,status:e.status,note:e.note});
 }
 if(e.input_sha256!==digest(input))throw error('P7_RESTORED_EVENT_HASH_MISMATCH');
 return e;
}
/** Guard for a SYNTHETIC verified guardian; authClient.getUser is a fixture
 * in this test. Never use this to grant real parent/child authorization.
 */
export function createWrongP7SyntheticRestoredGuardianReader({pool,authClient}={}){
 syntheticGuard();
 if(!pool?.connect||typeof authClient?.auth?.getUser!=='function')
  throw error('P7_PRIVATE_SERVER_DEPENDENCIES_REQUIRED');
 async function authorized(token,family,operation){
  syntheticGuard();
  const familyId=ensureId(family);
  if(typeof token!=='string'||token.length<50||token.length>12000)
   throw error('AUTH_REQUIRED');
  let value;try{value=await authClient.auth.getUser(token)}catch{
   throw error('AUTH_REQUIRED');
  }
  const user=value?.data?.user;
  if(value?.error||!UUID.test(user?.id||'')||user?.is_anonymous===true)
   throw error('AUTH_REQUIRED');
  const c=await pool.connect();
  let active=false;
  try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');active=true;
   const db=await c.query('SELECT current_database() AS db');
   if(db.rows[0].db!=='qa39_ci')throw error('P7_NOT_EPHEMERAL');
   // For every read, recheck independent synthetic guardian consent and
   // revocation in PostgreSQL, NOT a cookie role or caller-provided flag.
   const permission=await c.query(
    "SELECT 1 FROM wrong_p7_synthetic.guardian_permissions "+
    "WHERE family_id=$1 AND guardian_user_id=$2 AND role='guardian' "+
    "AND externally_verified=true AND consent_verified_at IS NOT NULL "+
    "AND revoked_at IS NULL",[familyId,user.id]);
   if(permission.rowCount!==1){
    await c.query('COMMIT');active=false;return null;
   }
   const row=await c.query(
    'SELECT revision,snapshot_text,content_sha256 FROM wrong_p6_synthetic.family_state WHERE family_id=$1',
    [familyId]);
   if(row.rowCount!==1||row.rows[0].snapshot_text===null){
    await c.query('COMMIT');active=false;return null;
   }
   const snapshot=verifySnapshot(row.rows[0]);
   const result=await operation(c,snapshot,asRevision(row.rows[0].revision),familyId);
   await c.query('COMMIT');active=false;
   return result;
  }catch(e){
   if(active)try{await c.query('ROLLBACK')}catch{}
   throw e;
  }finally{c.release()}
 }
 async function restoredEvents(c,familyId,snapshot,revision){
  const [children,parents]=await Promise.all([
   c.query('SELECT event_text FROM wrong_p6_synthetic.child_retries WHERE family_id=$1 ORDER BY applied_revision',
    [familyId]),
   c.query('SELECT event_text FROM wrong_p6_synthetic.parent_observations WHERE family_id=$1 ORDER BY applied_revision',
    [familyId])
  ]);
  // Every version 2..N MUST be present. A missing event (including another
  // record) is a restore integrity failure; do not return partial UX data.
  const usedRevisions=new Set(),byChild=new Map(),historyMap=new Map();
  const records=new Map(snapshot.records.map(r=>[r.id,r]));
  const childEvents=children.rows.map(x=>parseEvent(x.event_text,'child',familyId));
  const parentEvents=parents.rows.map(x=>parseEvent(x.event_text,'parent',familyId));
  for(const e of childEvents){
   const record=records.get(e.record_id);
   if(!record)throw error('P7_ORPHAN_RETRY_RECORD');
   if(usedRevisions.has(e.applied_revision)||e.applied_revision>revision)
    throw error('P7_DUPLICATE_OR_AHEAD_REVISION');
   usedRevisions.add(e.applied_revision);
   const key=e.child_user_id+'|'+e.request_id;
   if(byChild.has(key))throw error('P7_DUPLICATE_CHILD_EVENT');
   const hist=Array.isArray(record.generalRetryHistory)?record.generalRetryHistory:[];
   const signature=v=>JSON.stringify([v?.at,v?.answer,v?.explanation]);
   const seen=historyMap.get(e.record_id)||new Set();
   const wanted=signature(e.attempt_json);
   const idx=hist.findIndex((x,i)=>!seen.has(i)&&signature(x)===wanted&&
    x.review==='not_checked');
   if(idx<0)throw error('P7_RESTORED_RETRY_HISTORY_MISMATCH');
   seen.add(idx);historyMap.set(e.record_id,seen);
   byChild.set(key,e);
  }
  for(const e of parentEvents){
   if(!records.has(e.record_id))throw error('P7_ORPHAN_OBSERVATION_RECORD');
   if(usedRevisions.has(e.applied_revision)||e.applied_revision>revision)
    throw error('P7_DUPLICATE_OR_AHEAD_REVISION');
   usedRevisions.add(e.applied_revision);
   const target=byChild.get(e.child_user_id+'|'+e.child_request_id);
   if(!target||target.record_id!==e.record_id||
    target.applied_revision>=e.applied_revision)
    throw error('P7_RESTORED_OBSERVATION_ORPHAN');
  }
  if(usedRevisions.size!==revision-1||
   [...usedRevisions].some(i=>i<2||i>revision))
   throw error('P7_RESTORED_LEDGER_GAP');
  return {childEvents,parentEvents,historyMap};
 }
 return Object.freeze({
  async read(token,family){
   return authorized(token,family,async(_c,snapshot,revision)=>{
    // Existing P3 parent/status only needs the record metadata. Do not
    // expose original parent-private memo, photo data or full v02 backup.
    return Object.freeze({revision,snapshot:{
     records:snapshot.records.map(r=>({
      id:r.id,problemText:r.problemText,subject:r.subject,
      gradeAtEntry:r.gradeAtEntry,hasPhoto:r.hasPhoto===true
     }))
    }});
   });
  },
  async guardianRetryTimeline(token,family,record){
   const recordId=ensureId(record,true);
   return authorized(token,family,async(c,snapshot,revision,familyId)=>{
    const row=snapshot.records.find(r=>r.id===recordId);
    if(!row)return null;
    const {childEvents,parentEvents,historyMap}=await restoredEvents(
     c,familyId,snapshot,revision);
    const perms=await c.query(
     "SELECT child_user_id FROM wrong_p7_synthetic.child_grants "+
     "WHERE family_id=$1 AND record_id=$2 AND consent_verified_at IS NOT NULL "+
     "AND revoked_at IS NULL",[familyId,recordId]);
    const granted=new Set(perms.rows.map(r=>r.child_user_id));
    const attempts=[],byId=new Map(),order=[];
    for(const e of childEvents){
     if(e.record_id!==recordId||!granted.has(e.child_user_id))continue;
     const a=Object.freeze({
      attemptId:e.request_id,childUserId:e.child_user_id,
      answer:e.attempt_json.answer,explanation:e.attempt_json.explanation,
      at:e.attempt_json.at,revision:e.applied_revision,
      observations:[] // rebuilt below before freezing
     });
     const writable={...a,observations:[]};
     attempts.push(writable);byId.set(e.child_user_id+'|'+e.request_id,writable);
     order.push({kind:'child_retry',attemptId:e.request_id,revision:e.applied_revision});
    }
    for(const e of parentEvents){
     if(e.record_id!==recordId||!granted.has(e.child_user_id))continue;
     const a=byId.get(e.child_user_id+'|'+e.child_request_id);
     if(!a)throw error('P7_RESTORED_PARENT_JOIN_MISMATCH');
     a.observations.push(Object.freeze({id:e.request_id,status:e.status,
      note:e.note,at:e.created_at,revision:e.applied_revision}));
     order.push({kind:'guardian_observation',attemptId:a.attemptId,
      observationId:e.request_id,revision:e.applied_revision});
    }
    attempts.sort((a,b)=>a.revision-b.revision);
    order.sort((a,b)=>a.revision-b.revision);
    for(const a of attempts){
     a.observations.sort((x,y)=>x.revision-y.revision);
     Object.freeze(a.observations);Object.freeze(a);
    }
    const legacy=Math.max(0,
     (Array.isArray(row.generalRetryHistory)?row.generalRetryHistory.length:0)-
      attempts.length);
    return Object.freeze({
     revision,
     record:Object.freeze({id:row.id,subject:row.subject,
      gradeAtEntry:row.gradeAtEntry,problemText:row.problemText,
      hasPhoto:row.hasPhoto===true}),
     attempts:Object.freeze(attempts),
     order:Object.freeze(order.map(e=>Object.freeze(e))),
     unlinkedBackupAttempts:legacy,
     observationEventsIncludedInJsonBackup:false,
     readOnly:true,readOnlyRestored:true,safeToRestore:false
    });
   });
  }
 });
}
