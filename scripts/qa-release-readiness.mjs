// QA38: offline-only G15/G16 readiness audit. A CI check NEVER authorizes
// production deployment, collection of child data, or human research.
const REQUIRED=[
 'G15-IDENTITY','G15-HOSTING','G15-PRIVACY','G15-DEVICES','G15-RECOVERY',
 'G16-ETHICS','G16-INSTRUMENT','G16-PROTOCOL','G16-DATA','G16-OUTCOME'
];
function fail(code){throw new Error(code)}
export function assessReleaseReadiness(register,protocol){
 if(register?.schema!=='qa38-release-readiness-v1')fail('UNKNOWN_READINESS_SCHEMA');
 if(register.mode!=='SYNTHETIC_LOOPBACK_ONLY'||register.productionDeploymentApproved!==false||
    register.realDataCollectionApproved!==false||register.finalProductApprovedGoals!==0)
  fail('UNAUTHORIZED_PRODUCT_APPROVAL_CLAIM');
 if(register.totalGoals!==16||register.qaTechnicallyCompleteGoals!==14||
    register.realChildRecords!==0||register.realResearchParticipants!==0)
  fail('UNSUPPORTED_METRIC_OR_REAL_CHILD_DATA');
 if(protocol?.status!=='DRAFT_NOT_APPROVED'||protocol.observedChildren!==0||
    protocol.parentsConsentedAndVerified!==0||protocol.actualLearningEffectVerified!==false||
    protocol.schoolOrResearchEthicsApproval!==false||protocol.privacyReviewApproved!==false||
    protocol.educationalExpertApproval!==false)
  fail('RESEARCH_AUTHORIZATION_OR_PARTICIPANTS_UNSUPPORTED');
 const gs=register.gates;
 if(!Array.isArray(gs)||gs.length!==REQUIRED.length)fail('MISSING_OR_EXTRA_RELEASE_GATE');
 const seen=new Set(),blocked=[];
 for(const gate of gs){
  if(!gate||!REQUIRED.includes(gate.id)||seen.has(gate.id))fail('DUPLICATED_OR_UNKNOWN_GATE');
  seen.add(gate.id);
  if(gate.externalApprovalNeeded!==true||typeof gate.requiredEvidence!=='string'||
      gate.requiredEvidence.length<8)fail('GATE_REQUIREMENTS_INCOMPLETE');
  if(!Array.isArray(gate.evidence))fail('EVIDENCE_FORMAT_INVALID');
  if(gate.status!=='BLOCKED'||gate.evidence.length!==0)
   fail('EXTERNAL_APPROVAL_NOT_VERIFIABLE_IN_QA');
  blocked.push(gate.id);
 }
 if(REQUIRED.some(id=>!seen.has(id)))fail('MISSING_RELEASE_GATE');
 return Object.freeze({
  status:'BLOCKED_PENDING_EXTERNAL_AUTHORITY',
  qaTechnicalGoals:register.qaTechnicallyCompleteGoals,
  totalGoals:register.totalGoals,
  blockedGates:blocked,
  blockedGateCount:blocked.length,
  productApprovedGoals:0,
  canDeployToProduction:false,
  canEnrollRealChildren:false,
  canCollectRealStudyData:false,
  learningEffectVerified:false,
  message:'Synthetic CI pass is not external authorization or proof of learning effect'
 });
}
