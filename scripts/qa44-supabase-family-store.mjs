// QA44 server-only Supabase verified identity -> family RLS -> CAS snapshot.
// NO HTTP listener, NO actual provider connection, NO public DB password.
// A trusted backend may use this only after owner/legal/cloud approvals.
// Browser must NEVER receive the DB login nor service_role credentials.
import {createHash} from 'node:crypto';
import {checkBackup,previewMerge,signSynthetic} from './qa-family-merge-preflight.mjs';
const error=code=>Object.assign(new Error(code),{code});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function familyId(id){if(typeof id!=='string'||!UUID.test(id))throw error('INVALID_FAMILY_ID');return id}
function revision(n){if(!Number.isSafeInteger(n)||n<0)throw error('INVALID_REVISION');return n}
// Defense in depth: never rely on DB RLS being enabled for the backend pool.
// This predicate is checked again on EVERY snapshot read and conditional write,
// even if a synthetic QA connection accidentally runs with elevated SQL rights.
// Viewer/child, absent consent, unverified and revoked memberships are DENIED.
const VERIFIED_GUARDIAN_FOR_ROW=`EXISTS (
 SELECT 1 FROM qa44.guardian_memberships m
 WHERE m.family_id=qa44.family_snapshots.family_id
  AND m.guardian_user_id=(SELECT auth.uid())
  AND m.role='guardian'
  AND m.verification_source='externally_verified'
  AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
  AND m.revoked_at IS NULL
)`;
// B-only, synthetic server route contract. Never expose a full backup to a child.
// A child grant is its own test-only table, NOT a browser role toggle or a real IdP.
// Even a privileged backend pool must explicitly recheck family, grant, adult
// consent and revocation. Both read and CAS write bind a *single record ID*.
const CHILD_ALLOWED=`EXISTS(
 SELECT 1 FROM qa44.child_retry_grants g
 WHERE g.family_id=qa44.family_snapshots.family_id
  AND g.child_user_id=(SELECT auth.uid()) AND g.record_id=$2
  AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL
) AND EXISTS(
 SELECT 1 FROM qa44.guardian_memberships m
 WHERE m.family_id=qa44.family_snapshots.family_id
  AND m.role='guardian' AND m.verification_source='externally_verified'
  AND m.verified_at IS NOT NULL AND m.consent_verified_at IS NOT NULL
  AND m.revoked_at IS NULL
)`;
const CHILD_ID=/^[A-Za-z0-9_-]{1,100}$/;
const REQUEST_ID=/^[A-Za-z0-9_-]{8,64}$/;
function childStage(){
 if(process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1')throw error('SYNTHETIC_CHILD_ONLY');
}
// B3 observation contract: isolated synthetic consent/role boundary only.
// Not a production auth API; B2 child attempt ID is not a client timestamp.
function guardianObservationStage(){
 if(process.env.QA44_SYNTHETIC_GUARDIAN_OBS_ONLY!=='1')
  throw error('SYNTHETIC_GUARDIAN_OBSERVATION_ONLY');
}
function parentObservationPayload(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).some(k=>!['status','note'].includes(k))||
  !Object.hasOwn(value,'status')||
  !['not_checked','explained','needs_help'].includes(value.status)||
  (value.note!==undefined&&(typeof value.note!=='string'||value.note.length>500)))
  throw error('GUARDIAN_OBSERVATION_FIELDS_DENIED');
 return Object.freeze({status:value.status,note:value.note===undefined?'':value.note});
}
function observationRequestId(value){
 if(typeof value!=='string'||!REQUEST_ID.test(value))
  throw error('INVALID_OBSERVATION_REQUEST_ID');
 return value;
}
function childRecordId(value){
 if(typeof value!=='string'||!CHILD_ID.test(value))throw error('INVALID_RECORD_ID');
 return value;
}
function childPayload(value){
 // Exact shape. Client cannot send review, by, date, parent memo, IDs or score.
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).sort().join(',')!=='answer,explanation'||
  typeof value.answer!=='string'||!value.answer.trim()||
  value.answer.length>500||typeof value.explanation!=='string'||
  value.explanation.length>350)throw error('CHILD_RETRY_FIELDS_DENIED');
 return {answer:value.answer.trim(),explanation:value.explanation.trim()};
}
function checkedSnapshot(row){
 if(row.snapshot_text===null)throw error('SNAPSHOT_NOT_READY');
 if(createHash('sha256').update(row.snapshot_text).digest('hex')!==row.content_sha256)
  throw error('SERVER_DATA_TAMPERED');
 const snapshot=JSON.parse(row.snapshot_text);checkBackup(snapshot);
 return snapshot;
}
function prepared(doc){
 checkBackup(doc);
 const text=JSON.stringify(doc);
 if(Buffer.byteLength(text,'utf8')>1024*1024)throw error('PHOTO_OR_RECORD_TOO_LARGE');
 return {text,hash:createHash('sha256').update(text).digest('hex')};
}
export function createQa44ServerFamilyStore({pool,authClient}={}){
 if(process.env.QA44_STAGE_ONLY!=='1')throw error('NO_LIVE_SUPABASE_AUTH_ALLOWED');
 if(!pool||typeof pool.connect!=='function'||
  typeof authClient?.auth?.getUser!=='function')throw error('TRUSTED_SERVER_REQUIREMENTS_MISSING');
 async function scoped(token,fn){
  if(typeof token!=='string'||token.length<50||token.length>12000)
   throw error('AUTH_REQUIRED');
  // Supabase Auth getUser(accessToken) performs server-side validation.
  // NEVER trust getSession() or the user-submitted JWT payload alone.
  let remote;
  try{remote=await authClient.auth.getUser(token)}catch{throw error('AUTH_REQUIRED')}
  const user=remote?.data?.user;
  if(remote?.error||!UUID.test(String(user?.id||''))||user?.is_anonymous===true)
   throw error('AUTH_REQUIRED');
  const c=await pool.connect();
  let active=false;
  try{
   await c.query('BEGIN');active=true;
   // Role credentials are server-private. GUC is protected by the private
   // database session, not by client-side user-controlled fields.
   await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user.id]);
   const result=await fn(c);
   await c.query('COMMIT');active=false;
   return result;
  }catch(e){
   if(active)try{await c.query('ROLLBACK')}catch{}
   throw e;
  }finally{c.release()}
 }
 return Object.freeze({
 async childRead(token,family,record){
  childStage();
  const id=familyId(family),recordId=childRecordId(record);
  return scoped(token,async c=>{
   const result=await c.query(
    "SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+CHILD_ALLOWED,
    [id,recordId]);
   if(result.rowCount!==1)return null; // also hide existence of foreign IDs
   const snapshot=checkedSnapshot(result.rows[0]);
   const row=snapshot.records.find(r=>r.id===recordId);
   if(!row)return null;
   const attempts=await c.query(
    "SELECT attempt_json FROM qa44.child_retry_events WHERE family_id=$1 AND child_user_id=(SELECT auth.uid()) AND record_id=$2 ORDER BY applied_revision,created_at",
    [id,recordId]);
   const history=Array.isArray(row.generalRetryHistory)?row.generalRetryHistory:[];
   const ownAttempts=attempts.rows.map(x=>x.attempt_json);
   for(const entry of ownAttempts){
    if(!history.some(original=>original?.at===entry?.at&&original?.answer===entry?.answer&&original?.explanation===entry?.explanation))
     throw error('CHILD_EVENT_HISTORY_MISMATCH');
   }
   // Deliberately no profile, parent memo, parent review, studentAnswer,
   // complete record, backup envelope, or other record/photo.
   return Object.freeze({
    revision:Number(result.rows[0].revision),
    record:Object.freeze({id:row.id,subject:row.subject,gradeAtEntry:row.gradeAtEntry,
     problemText:row.problemText,hasPhoto:row.hasPhoto===true,
     photo:row.hasPhoto===true?snapshot.photos[recordId]:null}),
    ownAttempts
   });
  });
 },
 async childAppend(token,family,record,expectedRevision,requestId,input){
  childStage();
  const id=familyId(family),recordId=childRecordId(record),expected=revision(expectedRevision);
  if(typeof requestId!=='string'||!REQUEST_ID.test(requestId))
   throw error('INVALID_REQUEST_ID');
  const payload=childPayload(input);
  const inputHash=createHash('sha256').update(JSON.stringify({recordId,...payload})).digest('hex');
  return scoped(token,async c=>{
   // FOR UPDATE serializes concurrent family writers. No merge is performed
   // for stale versions. Existing guardian put/previewMerge remains unchanged.
   const result=await c.query(
    "SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+CHILD_ALLOWED+" FOR UPDATE",
    [id,recordId]);
   if(result.rowCount!==1)throw error('CHILD_RECORD_NOT_ACCESSIBLE');
   const snapshot=checkedSnapshot(result.rows[0]);
   const r=snapshot.records.find(x=>x.id===recordId);
   if(!r)throw error('CHILD_RECORD_NOT_ACCESSIBLE');
   const previous=await c.query(
    "SELECT record_id,input_sha256,base_revision,applied_revision FROM qa44.child_retry_events WHERE family_id=$1 AND child_user_id=(SELECT auth.uid()) AND request_id=$2",
    [id,requestId]);
   if(previous.rowCount){
    const p=previous.rows[0];
    if(p.record_id!==recordId||p.input_sha256!==inputHash||
      Number(p.base_revision)!==expected)throw error('REQUEST_ID_REUSED');
    return Object.freeze({stored:true,duplicate:true,revision:Number(p.applied_revision)});
   }
   if(Number(result.rows[0].revision)!==expected)throw error('STALE_REVISION');
   const history=Array.isArray(r.generalRetryHistory)?r.generalRetryHistory:[];
   if(history.length>=40)throw error('CHILD_RETRY_LIMIT');
   const attempt={at:new Date().toISOString(),answer:payload.answer,
    explanation:payload.explanation,review:'not_checked'};
   const nextHistory=[...history,attempt];
   if(Buffer.byteLength(JSON.stringify(nextHistory),'utf8')>48*1024)
    throw error('CHILD_RETRY_LIMIT');
   const next=structuredClone(snapshot);
   const i=next.records.findIndex(x=>x.id===recordId);
   next.records[i]={...next.records[i],updatedAt:attempt.at,
    generalRetryHistory:nextHistory};
   // The existing backup digest covers the entire record and every photo.
   signSynthetic(next);
   const saved=prepared(next);
   const updated=await c.query(
    "UPDATE qa44.family_snapshots SET revision=revision+1,snapshot_text=$4,content_sha256=$5,updated_at=now() WHERE family_id=$1 AND revision=$3 AND "+CHILD_ALLOWED+" RETURNING revision",
    [id,recordId,expected,saved.text,saved.hash]);
   if(updated.rowCount!==1)throw error('STALE_OR_REVOKED_CHILD');
   const newRevision=Number(updated.rows[0].revision);
   await c.query(
    "INSERT INTO qa44.child_retry_events(family_id,child_user_id,request_id,record_id,input_sha256,attempt_json,base_revision,applied_revision) VALUES($1,(SELECT auth.uid()),$2,$3,$4,$5,$6,$7)",
    [id,requestId,recordId,inputHash,JSON.stringify(attempt),expected,newRevision]);
   return Object.freeze({stored:true,duplicate:false,revision:newRevision});
  });
 },
 async guardianObservations(token,family,record){
  guardianObservationStage();
  const id=familyId(family),recordId=childRecordId(record);
  return scoped(token,async c=>{
   const scope=await c.query(
    "SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+VERIFIED_GUARDIAN_FOR_ROW,
    [id]);
   if(scope.rowCount!==1)return null;
   const snapshot=checkedSnapshot(scope.rows[0]);
   if(!snapshot.records.some(x=>x.id===recordId))return null;
   // Only guardian projection; not returned by childRead or any public API.
   // If a child grant has been revoked, its past observations aren't returned.
   const result=await c.query(
    "SELECT e.request_id,e.child_user_id,e.child_request_id,e.status,e.note,e.created_at,e.applied_revision "+
    "FROM qa44.parent_observation_events e "+
    "JOIN qa44.child_retry_grants g ON g.family_id=e.family_id AND g.child_user_id=e.child_user_id AND g.record_id=e.record_id "+
    "WHERE e.family_id=$1 AND e.record_id=$2 AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL "+
    "ORDER BY e.applied_revision,e.created_at",
    [id,recordId]);
   return Object.freeze({revision:Number(scope.rows[0].revision),
    observations:result.rows.map(r=>Object.freeze({
     id:r.request_id,childUserId:r.child_user_id,childAttemptId:r.child_request_id,
     status:r.status,note:r.note,at:r.created_at,appliedRevision:Number(r.applied_revision)
    }))});
  });
 },
 async guardianObserve(token,family,record,childUserId,childRequestId,
    expectedRevision,requestId,input){
  guardianObservationStage();
  const id=familyId(family),recordId=childRecordId(record),
   childId=familyId(childUserId),childAttempt=observationRequestId(childRequestId),
   expected=revision(expectedRevision),eventId=observationRequestId(requestId),
   payload=parentObservationPayload(input);
  const inputHash=createHash('sha256').update(JSON.stringify({
   recordId,childUserId:childId,childRequestId:childAttempt,...payload
  })).digest('hex');
  return scoped(token,async c=>{
   // Same family snapshot lock and revision used by B2 childAppend. Serialized
   // append-only event; the immutable wrong-answer/photo/attempt JSON is
   // intentionally NOT rewritten or automatically merged.
   const scope=await c.query(
    "SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+VERIFIED_GUARDIAN_FOR_ROW+" FOR UPDATE",
    [id]);
   if(scope.rowCount!==1)throw error('GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
   const snapshot=checkedSnapshot(scope.rows[0]);
   const row=snapshot.records.find(x=>x.id===recordId);
   if(!row)throw error('GUARDIAN_OBSERVATION_NOT_ACCESSIBLE');
   // Require a real B2 event PK and an active consented grant; legacy A
   // attempt timestamps cannot be forged into an ID.
   const target=await c.query(
    "SELECT e.attempt_json FROM qa44.child_retry_events e "+
    "JOIN qa44.child_retry_grants g ON g.family_id=e.family_id AND g.child_user_id=e.child_user_id AND g.record_id=e.record_id "+
    "WHERE e.family_id=$1 AND e.record_id=$2 AND e.child_user_id=$3 AND e.request_id=$4 "+
    "AND g.role='child' AND g.consent_verified_at IS NOT NULL AND g.revoked_at IS NULL",
    [id,recordId,childId,childAttempt]);
   if(target.rowCount!==1)throw error('CHILD_ATTEMPT_NOT_ACCESSIBLE');
   const attempt=target.rows[0].attempt_json;
   const history=Array.isArray(row.generalRetryHistory)?row.generalRetryHistory:[];
   if(!history.some(x=>x?.at===attempt?.at&&x?.answer===attempt?.answer&&
    x?.explanation===attempt?.explanation))
    throw error('CHILD_ATTEMPT_NOT_IN_SNAPSHOT');
   // Idempotency is checked AFTER authorization, consent, and target proof,
   // and BEFORE stale revision to safely acknowledge retried requests.
   const previous=await c.query(
    "SELECT record_id,child_user_id,child_request_id,input_sha256,base_revision,applied_revision "+
    "FROM qa44.parent_observation_events "+
    "WHERE family_id=$1 AND guardian_user_id=(SELECT auth.uid()) AND request_id=$2",
    [id,eventId]);
   if(previous.rowCount){
    const p=previous.rows[0];
    if(p.record_id!==recordId||p.child_user_id!==childId||
     p.child_request_id!==childAttempt||p.input_sha256!==inputHash||
     Number(p.base_revision)!==expected)
      throw error('OBSERVATION_REQUEST_ID_REUSED');
    return Object.freeze({stored:true,duplicate:true,revision:Number(p.applied_revision)});
   }
   if(Number(scope.rows[0].revision)!==expected)
    throw error('STALE_REVISION');
   // This UPDATE claims a single revision but leaves snapshot byte-for-byte
   // unchanged; event and revision are rolled back together on any failure.
   const updated=await c.query(
    "UPDATE qa44.family_snapshots SET revision=revision+1,updated_at=now() "+
    "WHERE family_id=$1 AND revision=$2 AND "+VERIFIED_GUARDIAN_FOR_ROW+
    " RETURNING revision",
    [id,expected]);
   if(updated.rowCount!==1)throw error('STALE_OR_REVOKED_GUARDIAN');
   const applied=Number(updated.rows[0].revision);
   await c.query(
    "INSERT INTO qa44.parent_observation_events "+
    "(family_id,guardian_user_id,request_id,record_id,child_user_id,child_request_id,"+
    "input_sha256,status,note,base_revision,applied_revision) "+
    "VALUES ($1,(SELECT auth.uid()),$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [id,eventId,recordId,childId,childAttempt,inputHash,
     payload.status,payload.note,expected,applied]);
   return Object.freeze({stored:true,duplicate:false,revision:applied});
  });
 },
  async families(token){
   return scoped(token,async c=>{
    const result=await c.query("SELECT family_id FROM qa44.guardian_memberships WHERE guardian_user_id=(SELECT auth.uid()) AND role='guardian' AND verification_source='externally_verified' AND verified_at IS NOT NULL AND consent_verified_at IS NOT NULL AND revoked_at IS NULL ORDER BY family_id");
    return result.rows.map(x=>x.family_id);
   });
  },
  async read(token,family){
   const id=familyId(family);
   return scoped(token,async c=>{
    const result=await c.query("SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+VERIFIED_GUARDIAN_FOR_ROW,[id]);
    if(result.rowCount!==1)return null;
    const row=result.rows[0];
    if(row.snapshot_text!==null&&
     createHash('sha256').update(row.snapshot_text).digest('hex')!==row.content_sha256)
     throw error('SERVER_DATA_TAMPERED');
    return {revision:Number(row.revision),
     snapshot:row.snapshot_text===null?null:JSON.parse(row.snapshot_text)};
   });
  },
  async put(token,family,expectedRevision,doc){
   const id=familyId(family),expected=revision(expectedRevision);
   const next=prepared(doc);
   return scoped(token,async c=>{
    const res=await c.query("SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1 AND "+VERIFIED_GUARDIAN_FOR_ROW,[id]);
    if(res.rowCount!==1)throw error('FAMILY_NOT_ACCESSIBLE');
    const before=res.rows[0];
    if(Number(before.revision)!==expected)throw error('STALE_REVISION');
    if(before.snapshot_text!==null){
     if(createHash('sha256').update(before.snapshot_text).digest('hex')!==before.content_sha256)
      throw error('SERVER_DATA_TAMPERED');
     const merged=previewMerge(JSON.parse(before.snapshot_text),doc);
     if(merged.proposedRecords!==doc.records.length||
      merged.proposedPhotos!==Object.keys(doc.photos).length)
      throw error('SILENT_RECORD_OR_PHOTO_LOSS');
    }
    const updated=await c.query("UPDATE qa44.family_snapshots SET revision=revision+1,snapshot_text=$3,content_sha256=$4,updated_at=now() WHERE family_id=$1 AND revision=$2 AND "+VERIFIED_GUARDIAN_FOR_ROW+" RETURNING revision",
     [id,expected,next.text,next.hash]);
    if(updated.rowCount!==1)throw error('STALE_OR_REVOKED_GUARDIAN');
    return Object.freeze({stored:true,revision:Number(updated.rows[0].revision),sha256:next.hash});
   });
  }
 });
}
