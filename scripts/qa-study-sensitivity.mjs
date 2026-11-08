// QA27 G16: worst-case attrition and observational sensitivity for a pilot
// PREPARATION ONLY — never use this output to assert effect/causality.
import {summarizePilot} from './qa-learning-effect-readiness.mjs';
function round(x){return Math.round(x*1000)/1000}
export function evaluateSyntheticStudy(rows){
 const basic=summarizePilot(rows);
 const arms={pilot:[],comparison:[]};
 for(const row of rows)arms[row.arm].push(row);
 const statistics={};
 for(const [arm,group] of Object.entries(arms)){
  const n=group.length,observed=group.filter(x=>x.followup!==null);
  const missing=n-observed.length;
  const baselineSum=group.reduce((sum,x)=>sum+x.baseline,0);
  const observedFollowup=observed.reduce((sum,x)=>sum+x.followup,0);
  const bounds=n?{
   pessimisticChange:round((observedFollowup-baselineSum)/n),
   optimisticChange:round((observedFollowup+100*missing-baselineSum)/n)
  }:null;
  statistics[arm]={enrolled:n,completed:observed.length,missing,
   baselineAll: n?round(baselineSum/n):null,
   completeCaseChange:basic.arms[arm].withinGroupChange,
   fullCohortBounds:bounds};
 }
 const a=statistics.pilot.fullCohortBounds,b=statistics.comparison.fullCohortBounds;
 const contrastBounds=a&&b?{
  min:round(a.pessimisticChange-b.optimisticChange),
  max:round(a.optimisticChange-b.pessimisticChange)
 }:null;
 const completeCase=basic.unadjustedChangeDifference;
 const problemFlags=[];
 if(statistics.pilot.enrolled===0||statistics.comparison.enrolled===0)problemFlags.push('EMPTY_ARM');
 if(statistics.pilot.missing>0||statistics.comparison.missing>0)problemFlags.push('FOLLOWUP_MISSING');
 if(statistics.pilot.baselineAll!==null&&statistics.comparison.baselineAll!==null)
  if(Math.abs(statistics.pilot.baselineAll-statistics.comparison.baselineAll)>10)
   problemFlags.push('BASELINE_DIFFERENCE_OVER_10_POINTS_REVIEW_ONLY');
 if(contrastBounds&&contrastBounds.min<=0&&contrastBounds.max>=0)
  problemFlags.push('ATTRITION_BOUNDS_INCLUDE_ZERO');
 return Object.freeze({
  contract:'qa27-g16-sensitivity-v01',
  sampleType:'descriptive input only',
  groups:statistics,
  completeCaseUnadjustedDifference:completeCase,
  missingOutcomeWorstCaseContrast:contrastBounds,
  qualityWarnings:problemFlags,
  learnerImpactConfirmed:false,
  causalEffectConfirmed:false,
  studyExternallyApproved:false,
  interpretation:'Missing scores bounded at 0..100. Conservative range and complete-case contrast are descriptive and not causal.',
  limitation:'Synthetic QA examples, no actual minors or verified consent records; small samples and selection bias remain.'
 });
}
