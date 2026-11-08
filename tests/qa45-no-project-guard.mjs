// QA45: no-project, no-billing guard and precreate readiness contract.
// Uses checked-in proposed policy / evidence only, NO cloud API calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertQa45NoProjectReadiness} from '../scripts/qa45-no-project-guard.mjs';
const root=new URL('../',import.meta.url);
const plan=JSON.parse(readFileSync(new URL('../data/qa45-free-no-project-plan.json',import.meta.url),'utf8'));
let checks=0;
const pass=s=>{checks++;console.log('PASS QA45 PRECREATE',s)};
const rejected=(change,expected)=>{
 const modified=structuredClone(plan);
 change(modified);
 assert.throws(()=>assertQa45NoProjectReadiness(modified,root.pathname),expected);
};
const result=assertQa45NoProjectReadiness(plan,root.pathname);
assert.equal(result.projectCountObserved,0);
assert.equal(result.projectCreated,false);
assert.equal(result.billingTouched,false);
assert.equal(result.actualSupabaseMigrationsApplied,0);
assert.equal(result.actualStorageBucketsCreated,0);
assert.equal(result.realServerTestsPerformed,0);
pass('실제 무료 조직 조사 결과를 별도 계획에 기록: 프로젝트 0개, 실서비스 설정·보안시험 0회');

for(const flag of Object.keys(plan.policy))
 rejected(x=>x.policy[flag]=true,/NO_PROJECT_NO_BILLING_GUARD/);
pass('프로젝트 생성·과금/카드·실아이 수집·유료전환·운영 공개 등 금지사항 9개 모두 자체 승인 거부');
rejected(x=>x.organization.confirmedPlan='pro',/FREE_EMPTY_ORGANIZATION_REQUIRED/);
rejected(x=>x.organization.projectCountObserved=1,/FREE_EMPTY_ORGANIZATION_REQUIRED/);
pass('계정이 유료이거나 프로젝트가 생겼다고 변경되면 현재 사전 준비 결과 무효');
rejected(x=>x.freeArchitecture.monthlyCommittedCostKRW=500,/FREE_PROVIDER_IDENTITY_POLICY/);
rejected(x=>x.freeArchitecture.authProviders=['google'],/FREE_PROVIDER_IDENTITY_POLICY/);
rejected(x=>x.freeArchitecture.photoStorage='public',/FREE_PROVIDER_IDENTITY_POLICY/);
pass('0원·구글과 이메일 모두·사진 비공개·보호자 승인 분리 기준 강제');
rejected(x=>x.tasks[1].status='APPLIED',/UNVERIFIED_REAL_SERVICE_CLAIM/);
rejected(x=>x.tasks[2].realServiceVerified=true,/UNVERIFIED_REAL_SERVICE_CLAIM/);
rejected(x=>x.tasks[4].status='PASSED_LIVE',/UNVERIFIED_REAL_SERVICE_CLAIM/);
pass('프로젝트 미생성인데 RLS·Google/Email·실서버 보안 완료로 허위 표시 불가');
rejected(x=>x.tasks[0].evidence=['docs/not-real.md','docs/not-real2.md'],/MISSING_EVIDENCE_FILE/);
pass('실제 코드·계획 파일이 없는 완료 증거는 인정하지 않음');
rejected(x=>x.externalGates.guardianConsent='VERIFIED',/FALSE_REAL_APPROVAL/);
rejected(x=>x.externalGates.productionRelease='APPROVED',/FALSE_REAL_APPROVAL/);
rejected(x=>x.externalGates.physicalPhonesTested=2,/FALSE_REAL_APPROVAL/);
pass('아동 동의/실기기/운영 승인도 실제 증빙 없으면 완료 선언 차단');
const release=JSON.parse(readFileSync(new URL('../data/qa38-release-readiness-v0.1.json',import.meta.url),'utf8'));
assert.equal(release.finalProductApprovedGoals,0);
assert.equal(release.gates.length,10);
assert.ok(release.gates.every(g=>g.status==='BLOCKED'));
pass('전체 G15/G16 실제 운영/연구 게이트 모두 BLOCKED, 제품 최종 승인 0/16 유지');
console.log('QA45_NO_PROJECT_GATE_RESULT='+JSON.stringify({
 status:'PASS',checks,
 freeOrgVerifiedExternal:true,projectCountObserved:0,projectCreated:false,
 migrationsAppliedToSupabase:0,actualGoogleEmailConfigured:false,
 realStorageBucketsCreated:0,realServerSecurityTests:0,
 actualPaymentKRW:0,realChildren:0,productionApproved:false
}));
