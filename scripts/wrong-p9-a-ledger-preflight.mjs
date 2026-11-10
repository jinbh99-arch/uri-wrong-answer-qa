// WRONG-P9: read-only preflight between the actual A local v02 export/photo
// and independently supplied P6/P7-style synthetic B2/B3 ledger/checkpoint.
// Deliberately does NOT call P5 importer, P6 restore, P7 database or production.
import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
const idPattern=/^[A-Za-z0-9_-]{1,100}$/;
const requestPattern=/^[A-Za-z0-9_-]{8,64}$/;
const isObject=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const clone=o=>JSON.parse(JSON.stringify(o));
const fail=(code)=>{throw Error(code)};
const sameRecord=(x,y)=>Boolean(x&&y&&
  x.id===y.id&&x.subject===y.subject&&
  Number(x.gradeAtEntry)===Number(y.gradeAtEntry)&&
  x.problemText===y.problemText&&x.hasPhoto===y.hasPhoto);
const digestJSON=o=>sha(JSON.stringify(o));

function actualBackupPhoto(data,id,localPhoto){
  if(!isObject(data.photos))fail('A_V02_PHOTOS_INVALID');
  const keys=Object.keys(data.photos);
  if(localPhoto){
    if(keys.length!==1||keys[0]!==id)fail('A_V02_PHOTO_KEY_MISSING');
    const encoded=data.photos[id];
    const m=typeof encoded==='string'&&encoded.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if(!m)fail('A_V02_PHOTO_DATA_INVALID');
    const bytes=Buffer.from(m[2],'base64');
    if(!bytes.length||bytes.toString('base64')!==m[2])fail('A_V02_PHOTO_BASE64_INVALID');
    const signature={key:id,mime:m[1],byteLength:bytes.length,sha256:sha(bytes)};
    if(signature.key!==localPhoto.key||signature.mime!==localPhoto.mime||
       signature.byteLength!==localPhoto.byteLength||signature.sha256!==localPhoto.sha256)
      fail('A_INDEXEDDB_BACKUP_PHOTO_MISMATCH');
    return signature;
  }
  if(keys.length||data.records[0]?.hasPhoto===true)fail('A_V02_UNEXPECTED_PHOTO');
  return null;
}

function compare(aRecord,aPhoto,aBackup,expectedFamilyId,ledger) {
  if(!idPattern.test(aRecord?.id||'')||!aRecord?.problemText||
     typeof aRecord?.subject!=='string'||!Number.isSafeInteger(Number(aRecord.gradeAtEntry))||
     typeof aRecord.hasPhoto!=='boolean')
    fail('A_RECORD_INVALID');
  if(!isObject(aBackup)||aBackup.format!=='uriaimath-offline-backup-v02'||
     !Array.isArray(aBackup.records)||aBackup.records.length!==1||
     !sameRecord(aRecord,aBackup.records[0]))fail('A_V02_RECORD_MISMATCH');
  if(aRecord.hasPhoto!==!!aPhoto)fail('A_LOCAL_PHOTO_FLAG_MISMATCH');
  const photo=actualBackupPhoto(aBackup,aRecord.id,aPhoto);
  // Legacy A retry timestamps cannot be silently converted into B2 request IDs.
  for(const old of (aRecord.generalRetryHistory||[])){
    if(!isObject(old)||!requestPattern.test(old.childRequestId||''))
      fail('A_LEGACY_RETRY_REQUEST_ID_UNMAPPED');
  }
  if(!isObject(ledger)||ledger.syntheticOnly!==true||ledger.ledgerIncluded!==true||
     ledger.familyId!==expectedFamilyId||!idPattern.test(ledger.recordId||'')||
     ledger.recordId!==aRecord.id)fail('LEDGER_FAMILY_OR_RECORD_MISMATCH');
  if(!isObject(ledger.snapshot)||ledger.snapshot.format!=='uriaimath-offline-backup-v02'||
     !Array.isArray(ledger.snapshot.records)||ledger.snapshot.records.length!==1||
     !sameRecord(aRecord,ledger.snapshot.records[0]))fail('B2_SNAPSHOT_RECORD_MISMATCH');
  // B2/P6 signed snapshot carries a photo data URI; compare its real
  // decoded bytes to the A IndexedDB Blob, not merely a claimed hasPhoto flag.
  // This never writes, imports, or exposes a photo on another device.
  try{actualBackupPhoto(ledger.snapshot,aRecord.id,aPhoto)}
  catch{fail('B2_SNAPSHOT_PHOTO_BYTES_MISMATCH')}
  if(!isObject(ledger.photoSignature))fail('B2_PHOTO_SIGNATURE_MISSING');
  if(ledger.photoSignature.sha256!==photo?.sha256||
     ledger.photoSignature.byteLength!==photo?.byteLength||
     ledger.photoSignature.mime!==photo?.mime||
     ledger.photoSignature.key!==aRecord.id)fail('B2_PHOTO_SHA_OR_META_MISMATCH');
  if(!Array.isArray(ledger.childEvents)||!Array.isArray(ledger.parentEvents)||
     !isObject(ledger.checkpoint))fail('B3_LEDGER_NOT_INCLUDED');
  const c=ledger.checkpoint;
  if(!Number.isSafeInteger(c.childCount)||!Number.isSafeInteger(c.parentCount)||
     c.parentCount<1||c.childCount<1||!Number.isSafeInteger(c.revision)||
     c.revision<3||c.revision!==ledger.revision||
     c.childCount!==ledger.childEvents.length||c.parentCount!==ledger.parentEvents.length)
    fail('B3_LEDGER_MISSING_OR_COUNT_MISMATCH');
  const revisions=new Set(), children=new Map(), childAttempts=[];
  for(const e of ledger.childEvents){
    if(!isObject(e)||e.family_id!==expectedFamilyId||e.record_id!==aRecord.id||
       !requestPattern.test(e.request_id||'')||
       !Number.isSafeInteger(e.applied_revision)||e.applied_revision<2||
       e.base_revision!==e.applied_revision-1||
       !isObject(e.attempt_json)||e.attempt_json.review!=='not_checked'||
       typeof e.attempt_json.answer!=='string'||
       typeof e.attempt_json.explanation!=='string'||
       e.input_sha256!==sha(JSON.stringify({recordId:e.record_id,
         answer:e.attempt_json.answer,explanation:e.attempt_json.explanation})))
      fail('B2_CHILD_EVENT_INVALID');
    const key=e.child_user_id+'|'+e.request_id;
    if(children.has(key)||revisions.has(e.applied_revision))
      fail('B2_DUPLICATE_REQUEST_OR_REVISION');
    children.set(key,e);revisions.add(e.applied_revision);
    childAttempts.push(e.attempt_json);
  }
  const histories=ledger.snapshot.records[0].generalRetryHistory;
  if(!Array.isArray(histories)||histories.length!==childAttempts.length||
     childAttempts.some(a=>!histories.some(h=>h.at===a.at&&h.answer===a.answer&&
       h.explanation===a.explanation&&h.review==='not_checked')))
    fail('B2_SNAPSHOT_RETRY_HISTORY_MISMATCH');
  const parents=new Set();
  for(const e of ledger.parentEvents){
    if(!isObject(e)||e.family_id!==expectedFamilyId||e.record_id!==aRecord.id||
       !requestPattern.test(e.request_id||'')||
       !requestPattern.test(e.child_request_id||'')||
       !['explained','needs_help','not_checked'].includes(e.status)||
       typeof e.note!=='string'||!Number.isSafeInteger(e.applied_revision)||
       e.applied_revision<2||e.base_revision!==e.applied_revision-1||
       e.input_sha256!==sha(JSON.stringify({recordId:e.record_id,
         childUserId:e.child_user_id,childRequestId:e.child_request_id,
         status:e.status,note:e.note})))
      fail('B3_PARENT_EVENT_INVALID');
    const target=children.get(e.child_user_id+'|'+e.child_request_id);
    if(!target||target.record_id!==e.record_id||
       target.applied_revision>=e.applied_revision)
      fail('B3_UNLINKED_CHILD_REQUEST');
    const key=e.guardian_user_id+'|'+e.request_id;
    if(parents.has(key)||revisions.has(e.applied_revision))
      fail('B3_DUPLICATE_REQUEST_OR_REVISION');
    parents.add(key);revisions.add(e.applied_revision);
  }
  if(revisions.size!==ledger.revision-1||
     [...revisions].some(r=>r>ledger.revision||r<2))
    fail('B2_B3_REVISION_GAP');
  if(c.childDigest!==digestJSON(ledger.childEvents)||
     c.parentDigest!==digestJSON(ledger.parentEvents)||
     c.snapshotDigest!==digestJSON(ledger.snapshot))
    fail('B2_B3_CHECKPOINT_DIGEST_MISMATCH');
  return {recordId:aRecord.id,subject:aRecord.subject,grade:aRecord.gradeAtEntry,
    problemTextSha256:sha(aRecord.problemText),photo,revision:ledger.revision,
    b2ChildCount:children.size,b3ObservationCount:parents.size};
}

/** Always refuses restoration. Success means only that synthetic preflight
 * metadata is consistent at this instant, never consent or future safety.
 */
export function preflightWrongP9(input){
  if(process.env.WRONG_P9_SYNTHETIC_READONLY!=='1')
    return Object.freeze({contractMatched:false,blocked:true,safeToRestore:false,
      restorePerformed:false,reasons:['P9_SYNTHETIC_READONLY_FLAG_REQUIRED']});
  try{
    const checked=compare(input?.aRecord,input?.aPhoto,input?.aBackup,
      input?.expectedFamilyId,input?.ledger);
    return Object.freeze({contractMatched:true,blocked:false,safeToRestore:false,
      restorePerformed:false,reasons:['NONOPERATING_PREFLIGHT_ONLY'],verified:clone(checked)});
  }catch(e){
    return Object.freeze({contractMatched:false,blocked:true,safeToRestore:false,
      restorePerformed:false,reasons:[String(e?.message||'P9_CONTRACT_UNKNOWN')]});
  }
}
