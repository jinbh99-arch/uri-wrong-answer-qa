import assert from 'node:assert/strict';
import {summarizePilot} from '../scripts/qa-learning-effect-readiness.mjs';
let n=0;const pass=s=>{n++;console.log('PASS G16 PREP',s)};
const rows=[
 {anonymousTrialId:'qa-token-a',arm:'pilot',baseline:30,followup:40,consentReady:true},
 {anonymousTrialId:'qa-token-b',arm:'pilot',baseline:40,followup:50,consentReady:true},
 {anonymousTrialId:'qa-token-c',arm:'comparison',baseline:30,followup:40,consentReady:true},
 {anonymousTrialId:'qa-token-d',arm:'comparison',baseline:40,followup:50,consentReady:true}
];
const a=summarizePilot(rows);
assert.equal(a.unadjustedChangeDifference,0);
assert.equal(a.learningEffectVerified,false);
assert.equal(a.cannotInferCausation,true);
pass('유사 변화의 두 그룹에서 비교 차이 0; 효과 입증이라 표시하지 않음');
const withMissing=summarizePilot([...rows,{anonymousTrialId:'qa-token-e',arm:'pilot',baseline:40,followup:null,consentReady:true}]);
assert.equal(withMissing.arms.pilot.missingFollowup,1);
assert.equal(withMissing.arms.pilot.retentionPercent,66.667);
pass('후속 관찰 누락 분모·완료율 구분, 임의 0점 대입 금지');
const improved=summarizePilot([...rows.slice(0,2).map(r=>({...r,followup:r.followup+10})),...rows.slice(2)]);
assert.equal(improved.unadjustedChangeDifference,10);
assert.equal(improved.learningEffectVerified,false);
pass('가상 집단 개선 수치가 있어도 실학습 효과·인과관계 확정 금지');
function rejects(row){assert.throws(()=>summarizePilot(row))}
rejects([{...rows[0],name:'real child'}]);
rejects([{...rows[0],photo:'data:image/jpeg;base64,AAA'}]);
rejects([{...rows[0],consentReady:false}]);
rejects([...rows,rows[0]]);
rejects([{...rows[0],followup:108}]);
pass('이름·사진·동의미완료·중복 가명·범위 밖 점수 차단');
const none=summarizePilot([]);
assert.equal(none.unadjustedChangeDifference,null);
assert.equal(none.learningEffectVerified,false);
pass('실제 참가자 0건인 상태는 효과 미검증 유지');
console.log('QA_G16_READINESS_RESULT='+JSON.stringify({status:'PASS',checks:n,realParticipants:0,learningEffectVerified:false,productionApproved:false}));
