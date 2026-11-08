import assert from 'node:assert/strict';
import {planTwoArmStudy,readinessForRealPilot} from '../scripts/qa-study-plan.mjs';
import {readFileSync} from 'node:fs';
const protocol=JSON.parse(readFileSync('data/qa-study-protocol-v0.1.json','utf8'));
let count=0;const pass=s=>{count++;console.log('PASS QA28 G16',s)};
const baseline=planTwoArmStudy();
assert.equal(baseline.completeCasesPerArm,142);
assert.equal(baseline.recruitPerArm,178);
assert.equal(baseline.plannedTotal,356);
assert.equal(baseline.consentOrEthicsApproval,false);
pass('가상 추정 5점/표준편차15/탈락20%: 142명 완주·178명 모집 가정 — 승인 아님');
const easier=planTwoArmStudy({targetDifference:10});
assert.ok(easier.plannedTotal<baseline.plannedTotal);
pass('동일 분산·표본가정에서 가정 효과차 확대 시 산식 일관성');
const highLoss=planTwoArmStudy({expectedAttrition:0.4});
assert.ok(highLoss.recruitPerArm>baseline.recruitPerArm);
pass('탈락률을 높이면 필요 모집 가정 수 자동 증가');
const noLoss=planTwoArmStudy({expectedAttrition:0});
assert.equal(noLoss.recruitPerArm,noLoss.completeCasesPerArm);
pass('탈락률 0이라면 목표 완주 표본 수와 모집 수 일치');
assert.throws(()=>planTwoArmStudy({standardDeviation:0}),/SD/);
assert.throws(()=>planTwoArmStudy({targetDifference:0}),/DIFFERENCE/);
assert.throws(()=>planTwoArmStudy({expectedAttrition:1}),/ATTRITION/);
pass('불가능한 수치·근거 없는 극단 설정 거부');
const readiness=readinessForRealPilot([],protocol);
assert.equal(readiness.participantCount,0);
assert.equal(readiness.trialCanStart,false);
assert.equal(readiness.learningEffectValidated,false);
assert.ok(readiness.unapprovedBlockers.includes('NO_REAL_PARTICIPANTS'));
assert.ok(readiness.unapprovedBlockers.includes('guardianConsentVerified'));
assert.ok(readiness.unapprovedBlockers.includes('baselineAssessmentValidated'));
pass('기존 연구계획 초안은 동의·윤리·측정·참가자 미확정이므로 실행 차단');
const cloned={...protocol,primaryOutcomeInstrumentValidated:true,
 randomAllocationConfirmed:true,parentsConsentedAndVerified:0,
 schoolOrResearchEthicsApproval:true,educationalExpertApproval:true,
 privacyReviewApproved:true,preregisteredExternally:true};
const still=readinessForRealPilot([],cloned);
assert.equal(still.trialCanStart,false);
assert.equal(still.learningEffectValidated,false);
pass('시험에서 승인 플래그를 모두 임의로 바꿔도 실제 학생 0명이면 실증으로 인정하지 않음');
console.log('QA_G16_STUDY_PLAN_RESULT='+JSON.stringify({status:'PASS',checks:count,
 observedChildren:0,realTrialApproved:false,studyOutcomeVerified:false,
 illustrativeNPerGroup:baseline.recruitPerArm}));
