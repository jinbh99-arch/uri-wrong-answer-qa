import assert from 'node:assert/strict';
import {evaluateSyntheticStudy} from '../scripts/qa-study-sensitivity.mjs';
const p=(id,arm,baseline,followup)=>({anonymousTrialId:'qa-example-'+id,arm,baseline,followup,consentReady:true});
let checks=0;const pass=s=>{checks++;console.log('PASS QA27 G16',s)};
const initial=[
 p('001','pilot',30,40),p('002','pilot',40,50),
 p('003','comparison',30,40),p('004','comparison',40,50)
];
const consistent=evaluateSyntheticStudy(initial);
assert.equal(consistent.completeCaseUnadjustedDifference,0);
assert.deepEqual(consistent.missingOutcomeWorstCaseContrast,{min:0,max:0});
assert.deepEqual(consistent.qualityWarnings,['ATTRITION_BOUNDS_INCLUDE_ZERO']);
assert.equal(consistent.learnerImpactConfirmed,false);
pass('대조집단 두 그룹에 같은 평균 변화: 0점, 학습효과 자동 승인 없음');
const missing=evaluateSyntheticStudy([...initial,p('005','pilot',50,null)]);
assert.equal(missing.groups.pilot.missing,1);
assert.deepEqual(missing.missingOutcomeWorstCaseContrast,{min:-20,max:13.333});
assert.ok(missing.qualityWarnings.includes('ATTRITION_BOUNDS_INCLUDE_ZERO'));
assert.ok(missing.qualityWarnings.includes('FOLLOWUP_MISSING'));
pass('사후 1명 탈락이 있으면 0~100점 최악/최선 범위 제시, 효과 단정 불가능');
const biased=evaluateSyntheticStudy([
 p('101','pilot',90,100),p('102','pilot',85,95),
 p('103','comparison',20,30),p('104','comparison',25,35)
]);
assert.ok(biased.qualityWarnings.includes('BASELINE_DIFFERENCE_OVER_10_POINTS_REVIEW_ONLY'));
assert.equal(biased.causalEffectConfirmed,false);
pass('사전 수준이 크게 다른 두 집단의 선택 편향 경고·인과효과 불인정');
const incomplete=evaluateSyntheticStudy([p('201','pilot',20,50)]);
assert.ok(incomplete.qualityWarnings.includes('EMPTY_ARM'));
assert.equal(incomplete.missingOutcomeWorstCaseContrast,null);
pass('대조군이 없으면 차이 계산·성공 판정 보류');
const missingAll=evaluateSyntheticStudy([p('301','pilot',40,null),p('302','comparison',40,null)]);
assert.equal(missingAll.completeCaseUnadjustedDifference,null);
assert.deepEqual(missingAll.missingOutcomeWorstCaseContrast,{min:-100,max:100});
pass('사후 100% 결측은 -100~100점 범위로 표시하고 평균 변화 생성 금지');
assert.throws(()=>evaluateSyntheticStudy([{...initial[0],name:'child'}]));
assert.throws(()=>evaluateSyntheticStudy([p('401','pilot',10,12),p('401','comparison',10,12)]));
assert.throws(()=>evaluateSyntheticStudy([{...initial[0],consentReady:false}]));
pass('개인식별 필드·중복 가명·동의 플래그 누락 자료 거부');
console.log('QA_G16_SENSITIVITY_RESULT='+JSON.stringify({status:'PASS',checks,realChildren:0,
 actualLearningEffectVerified:false,externalStudyApproved:false}));
