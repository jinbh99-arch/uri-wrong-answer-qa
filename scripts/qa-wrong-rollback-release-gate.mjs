// WRONG release preflight (offline synthetic-only test candidate, NOT a deploy action).
// Never touches IndexedDB, user files, operating servers, GitHub PRs or auth.
// A no-go verdict MUST NOT be overridden by a previous successful export.
import {createHash} from 'node:crypto';

export const WRONG_MAIN_SHA='47b6645df5ac75a45b8038e4f416b1c53c6da949';
export const WRONG_RC_SHA='d95b07ac1d9d846525418fb1bcea63402ea9036f';
const CAPABILITIES=new Map([
 [WRONG_MAIN_SHA,{name:'historical-main',subjects:new Set(['math']),reasonCandidates:false}],
 [WRONG_RC_SHA,{name:'five-subject-RC',subjects:new Set(['math','korean','english','science','social']),reasonCandidates:true}]
]);
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const B64=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const digest=x=>createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
  Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const fail=(code,context='')=>{throw Object.assign(new Error(code+(context?':'+context:'')),{code})};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const sorted=xs=>xs.slice().sort();

function signature(snapshot){
 if(!object(snapshot)||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.photos))
  fail('SNAPSHOT_MISSING');
 if(snapshot.records.length>500)fail('OVER_MAX_RECORDS');
 const ids=new Map();
 for(const row of snapshot.records){
  if(!object(row)||typeof row.id!=='string'||!ID.test(row.id)||ids.has(row.id))
   fail('DUPLICATE_OR_BAD_ID');
  ids.set(row.id,row);
 }
 const photos=new Map();
 for(const pic of snapshot.photos){
  if(!object(pic)||typeof pic.id!=='string'||photos.has(pic.id)||!ids.has(pic.id)||
     !Array.isArray(pic.bytes)||pic.bytes.length<12||
     pic.bytes.some(b=>!Number.isInteger(b)||b<0||b>255)||
     !['image/png','image/jpeg','image/webp'].includes(pic.mime??pic.type))
   fail('ORPHAN_OR_INVALID_PHOTO');
  photos.set(pic.id,{sha256:digest(Buffer.from(pic.bytes)),type:pic.mime??pic.type,bytes:pic.bytes.length});
 }
 for(const [id,row] of ids){
  if(Boolean(row.hasPhoto)!==photos.has(id))fail('SNAPSHOT_PHOTO_MISSING',id);
 }
 return {ids,photos,
   recordDigest:digest(plain(snapshot.records.slice().sort((a,b)=>a.id.localeCompare(b.id))))};
}

function backupVerified(backup,live){
 if(!object(backup)||backup.format!=='uriaimath-offline-backup-v02'||
    !Array.isArray(backup.records)||!object(backup.photos)||!object(backup.profile))
  fail('BACKUP_FORMAT');
 if(backup.photosOmitted!==0)fail('PARTIAL_PHOTO_BACKUP');
 if(!backup.integrity||backup.integrity.scheme!=='v18-json-payload'||
    backup.integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(String(backup.integrity.digest||'')))
  fail('STRONG_DIGEST_REQUIRED');
 const raw={...backup};delete raw.integrity;
 if(digest(JSON.stringify(raw))!==backup.integrity.digest)
  fail('BACKUP_DIGEST_MISMATCH');
 if(!object(backup.backupSummary)||
    backup.backupSummary.recordCount!==live.ids.size||
    backup.backupSummary.photoCount!==live.photos.size)
  fail('BACKUP_COUNT_MISMATCH');
 const dataIds=backup.records.map(r=>r?.id);
 if(dataIds.length!==live.ids.size||new Set(dataIds).size!==dataIds.length||
    dataIds.some(id=>!live.ids.has(id)))
  fail('BACKUP_RECORD_SET_MISMATCH');
 if(plain(backup.records.slice().sort((a,b)=>a.id.localeCompare(b.id)))!==
    plain([...live.ids.values()].sort((a,b)=>a.id.localeCompare(b.id))))
  fail('BACKUP_RECORD_BYTES_CHANGED');
 const names=Object.keys(backup.photos);
 if(names.length!==live.photos.size||
    names.some(id=>!live.photos.has(id)))
  fail('BACKUP_PHOTO_SET_MISMATCH');
 for(const id of names){
  const m=B64.exec(backup.photos[id]||'');
  if(!m)fail('BACKUP_PHOTO_ENCODING',id);
  const bytes=Buffer.from(m[2],'base64');
  // Decode and re-encode, so permissive base64 parsing cannot bypass equality.
  if(bytes.toString('base64')!==m[2]||bytes.length>=2.5*1024*1024)
   fail('BACKUP_PHOTO_INVALID',id);
  const actual={sha256:digest(bytes),type:m[1],bytes:bytes.length};
  const expected=live.photos.get(id);
  if(plain(actual)!==plain(expected))fail('BACKUP_PHOTO_BYTES_CHANGED',id);
 }
 return {records:live.ids.size,photos:live.photos.size,photoSha256s:sorted([...live.photos.entries()].map(([id,v])=>id+':'+v.sha256))};
}

function ensureIdentical(live,restored){
 const a=signature(live),b=signature(restored);
 if(a.recordDigest!==b.recordDigest||a.ids.size!==b.ids.size)
  fail('RESTORE_RECORDS_CHANGED');
 if(a.photos.size!==b.photos.size)fail('RESTORE_PHOTO_COUNT_CHANGED');
 for(const [id,p] of a.photos){
  if(plain(b.photos.get(id))!==plain(p))fail('RESTORE_PHOTO_BYTES_CHANGED',id);
 }
}

export function assessWrongRelease({fromSha,toSha,live,backup,restored}={}){
 const blocks=[];
 let proof=null;
 try{
  if(!CAPABILITIES.has(fromSha))fail('UNKNOWN_SOURCE_SHA');
  if(!CAPABILITIES.has(toSha))fail('UNKNOWN_TARGET_SHA');
  const state=signature(live);
  proof=backupVerified(backup,state);
  ensureIdentical(live,restored);
 }catch(e){blocks.push(e?.code||'PREFLIGHT_UNEXPECTED_ERROR')}
 // Even a corrupt backup cannot turn a downgrade into a permitted plan.
 const target=CAPABILITIES.get(toSha);
 if(target&&object(live)&&Array.isArray(live.records)){
  if(live.records.some(r=>!target.subjects.has(r?.subject)))
   blocks.push('TARGET_UNSUPPORTED_SUBJECT');
  if(!target.reasonCandidates&&live.records.some(r=>r&&Object.hasOwn(r,'reasonCandidates')))
   blocks.push('TARGET_UNSUPPORTED_REASON_CANDIDATES');
 }
 return {
  verdict:blocks.length?'BLOCK':'CANDIDATE_ONLY',
  blockedReasons:[...new Set(blocks)],
  source:CAPABILITIES.get(fromSha)?.name||'unknown',
  target:target?.name||'unknown',
  fromSha,toSha,
  evidence:proof?{records:proof.records,photos:proof.photos,recordAndPhotosStable:true,
    strongSha256Backup:true,restoredInFreshContext:true}:null,
  productionApproved:false,
  note:'No deployment/merge/rollback is performed. Auth, consent, live hosting, and physical copy of backup remain separate required checks.'
 };
}
