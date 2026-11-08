// G16 synthetic study readiness/measurement contract. Not an effect study.
// No raw answers, images, personal details or student-identifying metadata.
const ALLOWED=['anonymousTrialId','arm','baseline','followup','consentReady'];
const round=x=>Math.round(x*1000)/1000;
export function summarizePilot(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('INVALID_COHORT');
 const byId=new Set(),groups={pilot:[],comparison:[]};
 for(const r of rows){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('INVALID_ROW');
  if(Object.keys(r).some(k=>!ALLOWED.includes(k)))throw Error('PERSONAL_DATA_OR_UNREGISTERED_FIELD');
  if(r.consentReady!==true)throw Error('CONSENT_NOT_DOCUMENTED');
  if(!/^[a-z0-9-]{8,64}$/i.test(r.anonymousTrialId)||byId.has(r.anonymousTrialId))throw Error('MISSING_OR_DUPLICATED_ANONYMOUS_ID');
  byId.add(r.anonymousTrialId);
  if(!Object.hasOwn(groups,r.arm))throw Error('UNREGISTERED_ARM');
  if(!Number.isFinite(r.baseline)||r.baseline<0||r.baseline>100)throw Error('INVALID_BASELINE');
  if(r.followup!==null&&(!Number.isFinite(r.followup)||r.followup<0||r.followup>100))throw Error('INVALID_FOLLOWUP');
  groups[r.arm].push(r);
 }
 const out={};
 for(const [arm,items] of Object.entries(groups)){
  const completed=items.filter(x=>x.followup!==null);
  const baseMean=completed.length?completed.reduce((s,x)=>s+x.baseline,0)/completed.length:null;
  const followMean=completed.length?completed.reduce((s,x)=>s+x.followup,0)/completed.length:null;
  out[arm]={enrolled:items.length,completed:completed.length,missingFollowup:items.length-completed.length,
   retentionPercent:items.length?round(100*completed.length/items.length):null,
   baselineMean:baseMean===null?null:round(baseMean),
   followupMean:followMean===null?null:round(followMean),
   withinGroupChange:baseMean===null?null:round(followMean-baseMean)};
 }
 const g1=out.pilot.withinGroupChange,g0=out.comparison.withinGroupChange;
 const delta=g1===null||g0===null?null:round(g1-g0);
 return Object.freeze({
  version:'qa22-g16-descriptive-v01',participantCount:rows.length,
  arms:out,unadjustedChangeDifference:delta,
  cannotInferCausation:true,learningEffectVerified:false,
  safeguards:['No names or problem texts','Complete-case descriptive means only','Attrition shown','No significance or causal claims'],
  finalVerdict:'NOT_VERIFIED; real, consented comparison study + external education review required'
 });
}
