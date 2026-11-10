// WRONG-P4: isolated, READ-ONLY backup/event consistency preflight.
// This is NOT an export/restore API. Never apply a restore on a failed check.
// v02 JSON alone is incomplete whenever parent observation events exist.
import {createHash} from 'node:crypto';
const fail=code=>Object.assign(Error(code),{code});
const hash=s=>createHash('sha256').update(s).digest('hex');
const exactKeys=(o,keys)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
export function assessSyntheticLedgerRestore({familyId,snapshotText,snapshotHash,
 revision,childEvents,parentEvents,manifest}){
 if(process.env.QA44_STAGE_ONLY!=='1'||process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1')
  throw fail('SYNTHETIC_PREFLIGHT_ONLY');
 if(typeof familyId!=='string'||typeof snapshotText!=='string'||
  !Number.isSafeInteger(revision)||revision<0||
  !Array.isArray(childEvents)||!Array.isArray(parentEvents))throw fail('INVALID_INPUT');
 if(hash(snapshotText)!==snapshotHash)throw fail('SNAPSHOT_HASH_MISMATCH');
 let snapshot;try{snapshot=JSON.parse(snapshotText)}catch{throw fail('INVALID_BACKUP_JSON')}
 if(snapshot?.format!=='uriaimath-offline-backup-v02'||
  !Array.isArray(snapshot.records))throw fail('INVALID_BACKUP_FORMAT');
 const records=new Map(snapshot.records.map(r=>[r.id,r]));
 if(records.size!==snapshot.records.length)throw fail('DUPLICATE_RECORD_ID');
 const all=new Map(),revisions=new Set([revision===0?0:1]);
 for(const e of childEvents){
  if(e.family_id!==familyId)throw fail('FOREIGN_FAMILY_EVENT');
  if(!records.has(e.record_id))throw fail('ORPHAN_CHILD_RECORD');
  if(!Number.isSafeInteger(e.applied_revision)||e.applied_revision<2||
   e.applied_revision>revision||revisions.has(e.applied_revision))throw fail('INVALID_EVENT_REVISION');
  revisions.add(e.applied_revision);
  const id=e.child_user_id+'|'+e.request_id;
  if(all.has(id))throw fail('DUPLICATE_CHILD_REQUEST');
  const record=records.get(e.record_id);
  const history=record.generalRetryHistory||[];
  const a=e.attempt_json;
  if(!history.some(h=>h.at===a.at&&h.answer===a.answer&&h.explanation===a.explanation))
   throw fail('CHILD_SNAPSHOT_HISTORY_MISMATCH');
  all.set(id,e);
 }
 const observations=new Set();
 for(const e of parentEvents){
  if(e.family_id!==familyId)throw fail('FOREIGN_FAMILY_EVENT');
  if(!records.has(e.record_id))throw fail('ORPHAN_PARENT_RECORD');
  if(!Number.isSafeInteger(e.applied_revision)||e.applied_revision<2||
   e.applied_revision>revision||revisions.has(e.applied_revision))throw fail('INVALID_EVENT_REVISION');
  revisions.add(e.applied_revision);
  const id=e.guardian_user_id+'|'+e.request_id;
  if(observations.has(id))throw fail('DUPLICATE_PARENT_REQUEST');
  observations.add(id);
  if(!all.has(e.child_user_id+'|'+e.child_request_id)||
   all.get(e.child_user_id+'|'+e.child_request_id).record_id!==e.record_id)
   throw fail('PARENT_CHILD_ATTEMPT_MISSING');
 }
 const sorted=[...revisions].sort((a,b)=>a-b);
 if(revision>0&&(sorted.length!==revision||sorted.some((n,i)=>n!==i+1)))
  throw fail('EVENT_REVISION_GAP');
 if(!manifest){
  if(parentEvents.length)throw fail('V02_PARENT_LEDGER_MISSING');
  // Even with no parent events, v02 alone is not proof that events were
  // completely restored. Never call this a full restoration.
  return Object.freeze({safeToRestore:false,reason:'EVENT_LEDGER_MANIFEST_REQUIRED'});
 }
 if(!exactKeys(manifest,['format','familyId','revision','snapshotSha256','childCount','parentCount','childDigest','parentDigest']))
  throw fail('INVALID_MANIFEST_SHAPE');
 if(manifest.format!=='wrong-synthetic-ledger-manifest-p4'||
  manifest.familyId!==familyId||manifest.revision!==revision||
  manifest.snapshotSha256!==snapshotHash||
  manifest.childCount!==childEvents.length||manifest.parentCount!==parentEvents.length)
  throw fail('MANIFEST_MISMATCH');
 if(manifest.childDigest!==hash(JSON.stringify(childEvents))||
  manifest.parentDigest!==hash(JSON.stringify(parentEvents)))
  throw fail('EVENT_LEDGER_DIGEST_MISMATCH');
 // A verified manifest is a candidate only: no implementation of
 // transactional restore, legal consent, durable backup or key management.
 return Object.freeze({safeToRestore:false,manifestConsistent:true,
  reason:'TRANSACTIONAL_RESTORE_AND_CONSENT_NOT_IMPLEMENTED'});
}
export function makeSyntheticLedgerManifest({familyId,snapshotText,revision,childEvents,parentEvents}){
 if(process.env.QA44_STAGE_ONLY!=='1'||process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1')
  throw fail('SYNTHETIC_PREFLIGHT_ONLY');
 return Object.freeze({format:'wrong-synthetic-ledger-manifest-p4',
  familyId,revision,snapshotSha256:hash(snapshotText),
  childCount:childEvents.length,parentCount:parentEvents.length,
  childDigest:hash(JSON.stringify(childEvents)),parentDigest:hash(JSON.stringify(parentEvents))});
}
