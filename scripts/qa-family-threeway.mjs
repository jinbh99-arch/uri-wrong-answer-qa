// QA28 G15 — consent-gated THREE-WAY conflict preview; synthetic QA only.
// Never deploy as a cloud merge or automatically alter child records.
// Base: last confirmed snapshot; local: changed device; remote: stored revision.
// An SHA-256 digest provides accidental corruption detection, NOT authenticity.
import {checkBackup,signSynthetic,SyncPreflightError} from './qa-family-merge-preflight.mjs';
function same(a,b){
 if(a===undefined||b===undefined)return a===b;
 function canonical(obj){
  if(!obj||typeof obj!=='object')return obj;
  if(Array.isArray(obj))return obj.map(canonical);
  return Object.fromEntries(Object.keys(obj).sort().map(key=>[key,canonical(obj[key])]));
 }
 return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
function rowMap(doc){return new Map(doc.records.map(r=>[r.id,r]))}
function view(doc,id){
 const row=doc.records.find(r=>r.id===id);
 if(!row)return undefined;
 return {record:row,photo:Object.hasOwn(doc.photos,id)?doc.photos[id]:undefined};
}
export function previewThreeWay(base,local,remote){
 for(const doc of [base,local,remote])checkBackup(doc);
 if(!same(base.profile,local.profile)||!same(base.profile,remote.profile))
  throw new SyncPreflightError('PROFILE_CONFLICT','different family profiles are not merged');
 // Preserve unknown top-level metadata rather than silently deleting fields.
 const meta=x=>Object.fromEntries(Object.keys(x).filter(k=>!['records','photos','backupSummary','integrity','exportedAt'].includes(k)).map(k=>[k,x[k]]));
 if(!same(meta(base),meta(local))||!same(meta(base),meta(remote)))
  throw new SyncPreflightError('BACKUP_METADATA_CONFLICT','unsupported metadata edits; review manually');
 const ids=new Set([...base.records.map(x=>x.id),...local.records.map(x=>x.id),...remote.records.map(x=>x.id)]);
 if(ids.size>500)throw new SyncPreflightError('CAPACITY','combined record set exceeds 500');
 const conflicts=[],deletions=[],resolved=[],choices=[];
 for(const id of [...ids].sort()){
  const b=view(base,id),l=view(local,id),r=view(remote,id);
  const changeL=!same(b,l),changeR=!same(b,r);
  if(b&&(l===undefined||r===undefined))deletions.push(id);
  if(changeL&&changeR&&!same(l,r)){
   conflicts.push({recordId:id,reason:'CONCURRENT_DIVERGENT_UPDATE'});
   continue;
  }
  const chosen=changeL?l:(changeR?r:b);
  if(chosen)choices.push({id,record:structuredClone(chosen.record),
    photo:chosen.photo===undefined?undefined:structuredClone(chosen.photo)});
  if(changeL||changeR)resolved.push({recordId:id,source:changeL?(changeR?'both':'local'):'remote'});
 }
 // Fail closed for deletions: deleting one item requires an explicit review.
 const reviewRequired=conflicts.length>0||deletions.length>0;
 // Do not surface a partial merged payload when any unresolved conflict exists.
 let candidate=null;
 if(!reviewRequired){
  const records=choices.map(x=>x.record);
  const photos=Object.create(null);
  for(const item of choices)if(item.photo!==undefined)photos[item.id]=item.photo;
  const out=structuredClone(remote);
  out.records=records;
  out.photos=photos;
  out.backupSummary={...out.backupSummary,recordCount:records.length,photoCount:Object.keys(photos).length};
  // Keep remote export timestamp: the plan is not a new official export.
  signSynthetic(out);
  checkBackup(out);
  candidate=out;
 }
 return Object.freeze({
  version:'qa28-three-way-preview-v01',
  outcome:reviewRequired?'HUMAN_REVIEW_REQUIRED':'NON_CONFLICTING_DRAFT',
  autoUploadAllowed:false,
  deployedFamilySync:false,
  sameBaseRequired:true,
  recordCount:ids.size,
  nonConflictingChangedRecords:resolved.length,
  conflicts,
  deletedRecordIds:deletions,
  candidate
 });
}
