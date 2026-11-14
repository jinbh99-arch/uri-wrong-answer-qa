// QA36: new isolated parent-only feature contract. Exercise exactly the new
// selectors/comparison helpers against synthetic records. No old suite rerun,
// IndexedDB writes, real children, network, cloud or restore.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let count=0;const pass=s=>{count++;console.log('PASS WRONG QA36 PARENT NODE',s)};
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'function boundary missing '+start);
 return source.slice(a,b);
}
const obsFn=extract('function wrongParentLatestObservation(r){','function renderObservationSummary(){');
const getLatest=new Function('wrong008ManualDate',obsFn+'\nreturn wrongParentLatestObservation;')(
 c=>c?.by==='manual_due_date'||c?.manualDate===true);
const compareFn=extract('function v230ExplanationCompare(parent,entries){','function v230HistoryPanel(parent,r){');
function fakeMake(tag,cls,txt){
 return {tag,className:cls||'',textContent:txt===undefined?'':String(txt),children:[],
  attributes:{},id:'',
  append(...children){this.children.push(...children)},
  setAttribute(name,value){this.attributes[name]=value}};
}
const compare=new Function('make',compareFn+'\nreturn v230ExplanationCompare;')(fakeMake);
const iso=t=>new Date(t).toISOString();
const r={
 checkHistory:[{status:'needs_help',at:iso(1000)}],
 generalRetryHistory:[{at:iso(2000),answer:'A',explanation:'처음에는 뺄셈이라고 생각',review:'not_checked'}]
};
assert.equal(getLatest(r).status,'needs_help');
pass('아직 관찰하지 않은 일반 재풀이가 이전 실제 부모 도움 필요를 자동 취소하지 않음');
const checked=structuredClone(r);
checked.generalRetryHistory[0].review='explained';
checked.generalRetryHistory[0].reviewedAt=iso(3000);
assert.equal(getLatest(checked).status,'explained');
pass('새 일반 재풀이에서 실제 부모가 스스로 설명함을 기록하면 옛 도움 필요를 목록에서 제외');
const renewed=structuredClone(checked);
renewed.checkHistory.push({status:'needs_help',at:iso(4000)});
assert.equal(getLatest(renewed).status,'needs_help');
pass('이후 다시 도움 필요 관찰을 남기면 최신 관찰로 목록에 재포함');
const oldReview=structuredClone(renewed);
oldReview.generalRetryHistory[0].reviewedAt=iso(200);
assert.equal(getLatest(oldReview).status,'needs_help');
pass('관찰 이력이 서로 다른 저장 필드에 있어도 시간순으로 가장 최근 상태 우선');
const planned=structuredClone(r);
planned.checkHistory.push({status:'explained',at:iso(5000),manualDate:true,by:'manual_due_date'});
assert.equal(getLatest(planned).status,'needs_help');
pass('수동 예정일 메모는 실제 학부모 관찰로 오인하지 않음');
const before=[{at:iso(1000),answer:'5/12',explanation:'첫 풀이에서 분모를 더했어요',review:'not_checked'},
 {at:iso(2000),answer:'5/12',explanation:'중간에 계산 순서를 바꿨어요',review:'explained'},
 {at:iso(3000),answer:'5/12',explanation:'공통분모로 맞춰 보았어요',review:'needs_help'}];
const immutable=JSON.stringify(before);
const parent=fakeMake('div');compare(parent,before);
assert.equal(parent.children.length,1);
const card=parent.children[0];
assert.equal(card.id,'wrong-parent-retry-comparison');
assert.ok(card.className.includes('v218-parent-only'),'card must be parent-only');
assert.equal(card.children[2].children.length,2);
assert.ok(JSON.stringify(card).includes(before[0].explanation));
assert.ok(JSON.stringify(card).includes(before[2].explanation));
assert.ok(!JSON.stringify(card).includes(before[1].explanation));
assert.equal(JSON.stringify(before),immutable);
pass('최초/최신 아이 직접 설명만 읽기 전용으로 나란히 표시, 중간 이력 보존·미변경');
const empty=fakeMake('div');compare(empty,[before[0]]);
assert.equal(empty.children.length,0);
pass('재풀이 1회 이하에서는 전후 변화를 지어내지 않음');
const injected=structuredClone(before);
injected[2].explanation='<img src=x onerror=alert(1)> & "가상 설명"';
const malicious=fakeMake('div');compare(malicious,injected);
assert.ok(malicious.children[0].children[2].children[1].children[2].textContent.includes('<img'));
assert.equal(JSON.stringify(injected),JSON.stringify(injected));
pass('HTML 유사 아이 입력은 textContent로 보관, 코드 실행/기록 수정 경로 없음');
console.log('WRONG_QA36_PARENT_NODE_RESULT='+JSON.stringify({
 status:'PASS',checks:count,parentOnly:true,mostRecentCrossSource:true,
 readonly:true,syntheticOnly:true,safeToRestore:false,deployed:false}));
