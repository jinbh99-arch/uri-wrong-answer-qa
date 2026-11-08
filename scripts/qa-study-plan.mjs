// QA28 G16 prospective measurement design tool. Statistical assumptions must be
// reviewed externally; not a power guarantee or evidence of real effect.
import {summarizePilot} from './qa-learning-effect-readiness.mjs';
function fail(x){throw new Error(x)}
function valid(label,x,lo,hi){if(!Number.isFinite(x)||x<lo||x>hi)fail(label)}
function round(x){return Math.round(x*1000)/1000}
export function planTwoArmStudy({
 targetDifference=5,standardDeviation=15,zAlpha=1.96,zPower=0.84,
 expectedAttrition=0.20
}={}){
 valid('DIFFERENCE',targetDifference,0.1,100);
 valid('SD',standardDeviation,0.1,100);
 valid('Z_ALPHA',zAlpha,1,4);
 valid('Z_POWER',zPower,0.25,3);
 valid('ATTRITION',expectedAttrition,0,0.7);
 const nPerArm=Math.ceil(2*Math.pow(zAlpha+zPower,2)*Math.pow(standardDeviation/targetDifference,2));
 const recruitPerArm=Math.ceil(nPerArm/(1-expectedAttrition));
 return Object.freeze({
  status:'PLANNING_ASSUMPTIONS_ONLY',formula:'2*(z_alpha+z_power)^2*(sigma/delta)^2; two independent groups',
  targetDifference,standardDeviation,zAlpha,zPower,expectedAttrition,
  completeCasesPerArm:nPerArm,recruitPerArm,plannedTotal:2*recruitPerArm,
  estimatedClinicalOrEducationalValidity:false,consentOrEthicsApproval:false,
  caveats:['Normal approximation; equal group sizes and independent outcomes','Assumed variance and target effect not validated','Cluster designs/pretests require different calculation','Recruitment is never authorized by this calculator']
 });
}
export function readinessForRealPilot(studyRows,protocol){
 if(!protocol||protocol.status!=='DRAFT_NOT_APPROVED')
  fail('PROTOCOL_STATUS_UNEXPECTED');
 const base=summarizePilot(studyRows);
 const blockers=[];
 const fields={
  baselineAssessmentValidated:'primaryOutcomeInstrumentValidated',
  allocationPlanApproved:'randomAllocationConfirmed',
  guardianConsentVerified:'parentsConsentedAndVerified',
  ethicsReviewed:'schoolOrResearchEthicsApproval',
  subjectExpertApproved:'educationalExpertApproval',
  privacyReviewApproved:'privacyReviewApproved',
  externalPreregistration:'preregisteredExternally'
 };
 for(const [name,field] of Object.entries(fields)){
  if(field==='parentsConsentedAndVerified'){
   if(protocol[field]!==base.participantCount||base.participantCount===0)blockers.push(name);
  }else if(protocol[field]!==true)blockers.push(name);
 }
 if(base.participantCount===0)blockers.push('NO_REAL_PARTICIPANTS');
 return Object.freeze({
  auditVersion:'qa28-g16-ethics-gate-v01',
  participantCount:base.participantCount,
  trialCanStart:false,learningEffectValidated:false,
  unapprovedBlockers:blockers,reason:'External research authorization cannot be inferred or granted by synthetic QA tests'
 });
}
