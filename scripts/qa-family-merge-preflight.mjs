// QA22 G15 candidate: local-only, no network or account authentication.
// Conservative, non-destructive cross-device backup preflight. NEVER a restorable
// signed backup or production synchronization service.
import {createHash} from 'node:crypto';
const FORMAT='uriaimath-offline-backup-v02';
export class SyncPreflightError extends Error {
 constructor(code,msg){super(msg);this.name='SyncPreflightError';this.code=code}
}
function stop(code,msg){throw new SyncPreflightError(code,msg)}
function stable(x){try{return JSON.stringify(x)}catch{stop('INVALID_JSON','unserializable payload')}}
function digest(x){return createHash('sha256').update(stable(x)).digest('hex')}
const maxBytes=10*1024*1024;
export function checkBackup(doc){
 if(!doc||typeof doc!=='object'||Array.isArray(doc)||doc.format!==FORMAT)stop('FORMAT','unknown backup document');
 const size=Buffer.byteLength(stable(doc));
 if(size>maxBytes)stop('SIZE','input exceeds safe sample size');
 if(!Array.isArray(doc.records)||doc.records.length>500)stop('COUNT','records must be an array of at most 500');
 if(!doc.profile||typeof doc.profile!=='object'||Array.isArray(doc.profile))stop('PROFILE','profile missing');
 if(!doc.photos||typeof doc.photos!=='object'||Array.isArray(doc.photos))stop('PHOTOS','photos map missing');
 if(doc.integrity?.algorithm!=='SHA-256'||typeof doc.integrity?.digest!=='string')stop('CHECKSUM','unsupported checksum');
 const clone=structuredClone(doc);delete clone.integrity;
 if(digest(clone)!==doc.integrity.digest)stop('CHECKSUM','local backup digest does not match');
 const ids=new Set();
 for(const r of doc.records){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>200)stop('ROW','invalid record ID');
  if(ids.has(r.id))stop('DUPLICATE','duplicate ID');
  ids.add(r.id);
  if(r.hasPhoto===true&&!Object.hasOwn(doc.photos,r.id))stop('ORPHAN','photo missing for record');
  if(r.hasPhoto===false&&Object.hasOwn(doc.photos,r.id))stop('ORPHAN','photo references photo-free record');
 }
 for(const id of Object.keys(doc.photos)){
  if(id==='__proto__'||id==='constructor'||id==='prototype')stop('KEY','dangerous photo map key');
  if(!ids.has(id))stop('ORPHAN','photo without record');
 }
 return {recordCount:doc.records.length,photoCount:Object.keys(doc.photos).length,sha256:doc.integrity.digest};
}
export function previewMerge(left,right){
 const a=checkBackup(left),b=checkBackup(right);
 if(stable(left.profile)!==stable(right.profile))stop('PROFILE_CONFLICT','profiles differ; require authorized manual selection');
 const byId=new Map(left.records.map(x=>[x.id,x]));
 let newRecords=0,dupes=0;
 for(const r of right.records){
  const old=byId.get(r.id);
  if(old){
   if(stable(old)!==stable(r))stop('RECORD_CONFLICT','same record ID contains different content: never overwrite');
   dupes++;
  }else{byId.set(r.id,r);newRecords++}
 }
 if(byId.size>500)stop('CAPACITY','merged count exceeds 500');
 for(const [id,p] of Object.entries(right.photos)){
  const l=left.photos[id];
  if(l!==undefined&&stable(l)!==stable(p))stop('PHOTO_CONFLICT','same photo ID has different bytes: never overwrite');
 }
 const mergedPhotoCount=new Set([...Object.keys(left.photos),...Object.keys(right.photos)]).size;
 // Deliberately RETURN ONLY A PLAN, not unverified restorable data. No mutation.
 return Object.freeze({
  format:'qa22-review-only-sync-plan-v01',canAutoApply:false,requiresAuthAndUserApproval:true,
  localRecords:a.recordCount,remoteRecords:b.recordCount,identicalRecords:dupes,newRecords,
  proposedRecords:byId.size,proposedPhotos:mergedPhotoCount,
  dataDelivered:false,networkUsed:false,encryptedTransportProvided:false,
  note:'No actual login, cryptography, server, merge commit or access control is implemented.'
 });
}
export function signSynthetic(doc){
 const out=structuredClone(doc);delete out.integrity;
 doc.integrity={algorithm:'SHA-256',digest:digest(out)};
 return doc;
}
