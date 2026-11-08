// QA38: release blocker is evidence-based, not a self-certified green badge.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessReleaseReadiness} from '../scripts/qa-release-readiness.mjs';
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const register=load('../data/qa38-release-readiness-v0.1.json');
const protocol=load('../data/qa-study-protocol-v0.1.json');
let checks=0;const pass=s=>{checks++;console.log('PASS QA38 RELEASE GATE',s)};
const result=assessReleaseReadiness(register,protocol);
assert.equal(result.status,'BLOCKED_PENDING_EXTERNAL_AUTHORITY');
assert.equal(result.blockedGateCount,10);
assert.equal(result.qaTechnicalGoals,14);
assert.equal(result.totalGoals,16);
assert.equal(result.productApprovedGoals,0);
pass('16개 목표 QA 기술완료와 출시 승인 명확히 분리, 외부 수락항목 10개 차단');
for(const field of ['canDeployToProduction','canEnrollRealChildren','canCollectRealStudyData','learningEffectVerified'])
 assert.equal(result[field],false);
pass('CI 성공만으로 실제 아동 수집·배포·효과 검증을 승인하지 않음');
const change=(fn)=>{
 const r=structuredClone(register),p=structuredClone(protocol);
 fn(r,p);assert.throws(()=>assessReleaseReadiness(r,p));
};
change(r=>r.productionDeploymentApproved=true);
change(r=>r.finalProductApprovedGoals=1);
change(r=>r.realChildRecords=1);
change(r=>r.realResearchParticipants=1);
pass('운영 승인·실사용자·실아동 사진을 사전 승인 없이 선언하면 검증 실패');
change(r=>r.gates.splice(0,1));
change(r=>r.gates.push({...r.gates[0]}));
change(r=>r.gates[0].status='VERIFIED');
change(r=>r.gates[0].evidence=['synthetic CI run']);
pass('누락·중복·검증되지 않은 증빙·QA 자기인증을 모두 거부');
change((r,p)=>p.observedChildren=1);
change((r,p)=>p.status='APPROVED');
change((r,p)=>p.parentsConsentedAndVerified=1);
change((r,p)=>p.educationalExpertApproval=true);
pass('G16 보호자 동의·연구 승인·참여자 수 임의 변경 시 실증 성공 주장 차단');
const app=readFileSync(new URL('../scripts/qa-inapp-sync-bridge.mjs',import.meta.url),'utf8');
const gate=readFileSync(new URL('../scripts/qa-family-gateway.mjs',import.meta.url),'utf8');
assert.ok(app.includes("const LOCAL_ORIGIN='http://127.0.0.1:4173'"));
assert.ok(app.includes('location.origin===LOCAL_ORIGIN'));
assert.ok(gate.includes("server.listen(0,'127.0.0.1'"));
assert.ok(gate.includes("QA_SYNTHETIC_FAMILY_ONLY"));
pass('공개 브라우저와 서버의 로컬 합성 QA 격리 장치가 유지되는지 코드 검사');
console.log('QA38_RELEASE_GATE_RESULT='+JSON.stringify({
 status:'PASS',checks,blockedGates:10,realChildren:0,
 productionApproved:false,learningEffectVerified:false
}));
