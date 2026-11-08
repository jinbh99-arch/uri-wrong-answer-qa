import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateQa43OperatingCandidate} from '../scripts/qa43-ops-preflight.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const files=[
 'docs/QA43_1단계_운영보안_인증_연동준비_v1.0.md',
 'docs/QA43_2단계_백업_장애복구_훈련_v1.0.md',
 'docs/QA43_3단계_Android_iOS_실기기검수표_v1.0.md',
 'docs/QA43_4단계_개인정보처리방침_검토초안_v1.0.md',
 'docs/QA43_4단계_법정대리인_동의문_검토초안_v1.0.md',
 'docs/QA43_4단계_G16_학습효과_사전등록검토_v0.3.md',
 'docs/QA43_4단계_출시승인_체크리스트_v1.0.md'
];
let checks=0;const pass=x=>{checks++;console.log('PASS QA43 CONTRACT',x)};
for(const p of files){assert.ok(read(p).length>700,p)}
pass('4단계 일곱 개 인계·개인정보·실기기·G16 문서가 모두 존재하며 검토 가능한 길이');
const p=read(files[3]),consent=read(files[4]);
for(const word of ['[운영 주체','[운영','미완료','동의','파기','보관','사진','법정대리인'])
 assert.ok(p.includes(word),'privacy '+word);
for(const word of ['미사용 초안','법정대리인','OCR','동의','철회','미승인'])
 assert.ok(consent.includes(word),'consent '+word);
pass('개인정보·보호자 동의 문안의 미확정 운영자/보관/삭제/철회와 선택 AI 분리');
const study=read(files[5]);
for(const word of ['DRAFT_NOT_APPROVED','참가자 0명','독립','사전','대조','결측','법정대리인'])
 assert.ok(study.includes(word),'study '+word);
const old=JSON.parse(read('data/qa-study-protocol-v0.1.json'));
assert.equal(old.status,'DRAFT_NOT_APPROVED');
assert.equal(old.observedChildren,0);
assert.equal(old.actualLearningEffectVerified,false);
pass('G16 독립 평가 사전등록 초안과 실제 연구 0명·학습효과 미검증 일치');
const gate=JSON.parse(read('data/qa38-release-readiness-v0.1.json'));
assert.equal(gate.gates.length,10);
assert.ok(gate.gates.every(x=>x.status==='BLOCKED'&&x.evidence.length===0));
assert.equal(gate.finalProductApprovedGoals,0);
const candidate=JSON.parse(read('data/qa43-operating-candidate.template.json'));
assert.equal(validateQa43OperatingCandidate(candidate).canDeploy,false);
const launch=read(files[6]);
assert.ok(launch.includes('승인 0/16'));
assert.ok(launch.includes('BLOCKED'));
pass('G15 5개+G16 5개 외부 승인 게이트 10개 전부 BLOCKED, 실출시 0/16');
const mobile=read(files[2]);
assert.ok(mobile.includes('Android')&&mobile.includes('iOS'));
assert.ok(mobile.includes('미실시'));
assert.ok(mobile.includes('실기기'));
pass('실제 Android/iOS 기기 검사 0대와 미완료 진실성 보호');
const ops=read(files[0]),recovery=read(files[1]);
assert.ok(ops.includes('토큰 철회')&&ops.includes('비밀관리'));
assert.ok(recovery.includes('자동 부활')&&recovery.includes('PITR'));
pass('토큰 철회·비밀 관리·삭제 후 복구 금지·실제 PITR 미실시를 문서에 명시');
console.log('QA43_DOCUMENT_CONTRACT_RESULT='+JSON.stringify({
 status:'PASS',checks,documents:files.length,externalGatesBlocked:10,
 productionApproval:0,participants:0,physicalDevicesVerified:0
}));
