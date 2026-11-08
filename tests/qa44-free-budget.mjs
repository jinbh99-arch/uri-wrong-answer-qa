import assert from 'node:assert/strict';
import {assertQa44FreeBudget,QA44_FREE_CAPS,qa44EmailSmtpPlan}
 from '../scripts/qa44-free-budget.mjs';
let checks=0;const pass=s=>{checks++;console.log('PASS QA44 FREE',s)};
const zero={dbBytes:0,photoBytes:0,egressBytes:0,emailDaily:0,emailMonthly:0};
const b=assertQa44FreeBudget(zero,{photoBytes:1000,photoUploadBytes:500});
assert.equal(b.projectedNoOverage,true);
assert.equal(b.neverUpgradeAutomatically,true);
assert.equal(b.monthlyCostAssumptionKRW,0);
pass('용량·이메일 무료 제공량 기반 예상계산, 자동 유료 전환 없음');
const high={...zero,photoBytes:800000000};
assert.ok(assertQa44FreeBudget(high).warnings.includes('photoBytes'));
for(const key of Object.keys(zero)){
 const current={...zero,[key]:QA44_FREE_CAPS[key]};
 assert.throws(()=>assertQa44FreeBudget(current,{[key]:1}),/FREE_PLAN_HARD_STOP/);
}
pass('DB 500MB, 저장소 1GB, 전송 5GB, 메일 100/일·3000/월에 80% 경보 및 예상 초과 차단');
assert.throws(()=>assertQa44FreeBudget(zero,{photoUploadBytes:1048577}),/PHOTO_PER_FILE_LIMIT/);
assert.throws(()=>assertQa44FreeBudget({...zero,emailDaily:-1}),/INVALID_FREE_QUOTA_COUNT/);
assert.throws(()=>assertQa44FreeBudget({...zero,emailMonthly:NaN}),/INVALID_FREE_QUOTA_COUNT/);
pass('사진 1MiB 단건 제한, 미확인·음수·비정상 사용량은 거부');
const cfg=qa44EmailSmtpPlan({
 senderDomain:'study.example.com',fromAddress:'no-reply@study.example.com',
 secretReference:'secret-manager://qa44/resend-smtp'
});
assert.equal(cfg.smtpHost,'smtp.resend.com');
assert.equal(cfg.smtpPort,465);
assert.equal(cfg.realEmailSent,false);
assert.equal(cfg.automatedPaidOverage,false);
assert.throws(()=>qa44EmailSmtpPlan({
 senderDomain:'study.example.invalid',fromAddress:'no-reply@study.example.invalid',
 secretReference:'secret-manager://qa44/resend-smtp'
}),/VERIFIED_SENDER_DOMAIN_REQUIRED/);
assert.throws(()=>qa44EmailSmtpPlan({
 senderDomain:'example.com',fromAddress:'other@bad.com',
 secretReference:'secret-manager://qa44/resend-smtp'
}),/SENDER_MISMATCH/);
assert.throws(()=>qa44EmailSmtpPlan({
 senderDomain:'example.com',fromAddress:'other@example.com',
 secretReference:'plain-password'
}),/SMTP_CREDENTIALS_MUST_USE_SECRET_REFERENCE/);
pass('Resend SMTP는 인증 도메인·비밀관리 경로 예시만 허용, 평문 비밀번호·가짜 도메인 차단');
console.log('QA44_FREE_BUDGET_RESULT='+JSON.stringify({
 status:'PASS',checks,freePlanChosen:'Supabase+Resend',
 monthlyFeeCommittedKRW:0,actualAccountCreated:false,
 realEmailSent:false,productionApproved:false
}));
