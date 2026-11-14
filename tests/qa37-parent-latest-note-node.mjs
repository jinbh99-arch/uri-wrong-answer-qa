// QA37: only the NEW parent-note one-line preview on the existing read-only
// needs-help queue. Synthetic in-memory data, never real family/child records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let checks=0;
const pass=label=>{checks++;console.log('PASS WRONG QA37 NOTE NODE',label)};
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing source: '+start);
 return html.slice(a,b);
}
const helper=section('function wrongParentLatestObservation(r){','function renderObservationSummary(){');
const renderer=section('function renderObservationSummary(){','function groupCount(){');
const isManual=c=>c?.by==='manual_due_date'||c?.manualDate===true;
const latest=new Function('wrong008ManualDate',helper+'\nreturn wrongParentLatestObservation;')(isManual);
function element(tag,cls,txt){
 return {tag,cls:cls||'',textContent:txt===undefined?'':String(txt),children:[],dataset:{},attributes:{},id:'',
  append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},
  setAttribute(key,value){this.attributes[key]=value}};
}
function execute(rows){
 const card=element('section'),stats=element('div');
 const lookup=id=>{
  if(id==='home-observation')return stats;
  if(id==='home-observation-card')return card;
  return card.children.find(node=>node.id===id)||null;
 };
 const render=new Function('$','make','wrong008ManualDate','records',
  helper+'\n'+renderer+'\nreturn renderObservationSummary;')(lookup,element,isManual,rows);
 const before=JSON.stringify(rows);render();assert.equal(JSON.stringify(rows),before,
  'rendering must not mutate any stored observation or record');
 const queue=card.children.find(node=>node.id==='wrong-parent-needs-help-queue');
 assert.ok(queue);
 return {queue,buttons:queue.children.filter(x=>x.tag==='button'),stats};
}
const old='2026-11-14T01:00:00.000Z',middle='2026-11-14T02:00:00.000Z',now='2026-11-14T03:00:00.000Z';
const base={id:'qa-photo-parent-note-a',problemText:'가상 사진 오답',
 checkHistory:[{status:'needs_help',at:old,memo:'  분자와 분모를  바꾸어 보려 함  '}],
 generalRetryHistory:[{answer:'2/5',explanation:'가상 아이 설명',review:'not_checked',at:middle}]};
let result=execute([structuredClone(base)]);
assert.equal(result.buttons.length,1);
assert.equal(result.buttons[0].dataset.record,base.id);
assert.equal(result.buttons[0].children[2].textContent,
 '최근 부모 확인 메모: 분자와 분모를 바꾸어 보려 함');
pass('가장 최근 실제 학부모 확인 메모를 한 줄로 정리하여 기존 원문 링크에 표시');
const newer=structuredClone(base);
newer.generalRetryHistory[0].review='needs_help';
newer.generalRetryHistory[0].reviewedAt=now;
newer.generalRetryHistory[0].parentNote=' 이번에는 조건을 다시 질문  ';
result=execute([newer]);
assert.equal(result.buttons[0].children[2].textContent,'최근 부모 확인 메모: 이번에는 조건을 다시 질문');
assert.ok(!JSON.stringify(result.queue).includes('분자와 분모를 바꾸어'));
pass('일반 재풀이 후 부모 관찰의 새 메모는 오래된 상세 관찰 메모를 대체');
const without=structuredClone(newer);delete without.generalRetryHistory[0].parentNote;
result=execute([without]);
assert.equal(result.buttons[0].children[2].textContent,'최근 관찰 메모 없음 · 원문에서 확인');
pass('최신 부모 관찰에 메모가 없으면 과거 메모를 현재 것으로 빌려오지 않음');
const explained=structuredClone(newer);explained.generalRetryHistory[0].review='explained';
assert.equal(execute([explained]).buttons.length,0);
pass('가장 최근 학부모 관찰이 스스로 설명이면 도움 필요 목록에서 제외');
const newerCheck=structuredClone(newer);
newerCheck.checkHistory.push({status:'needs_help',at:'2026-11-14T04:00:00Z',
 memo:' 이제 긴 문장 대신 도형을 그려서 확인할 것  '});
result=execute([newerCheck]);
assert.ok(result.buttons[0].children[2].textContent.includes('도형을 그려서'));
pass('상세 관찰이 더 최신일 경우 저장 경로와 무관하게 최신 메모만 선택');
const manual=structuredClone(newerCheck);
manual.checkHistory.push({status:'needs_help',at:'2026-11-14T05:00:00Z',
 memo:'오늘 실제로 관찰하지 않은 일정',manualDate:true});
result=execute([manual]);
assert.ok(!JSON.stringify(result.queue).includes('실제로 관찰하지 않은'));
pass('수동 확인 예정일은 실제 부모 관찰 메모로 취급하지 않음');
const adversarial=structuredClone(base);
adversarial.checkHistory[0].memo='<img src=x onerror=alert(1)>\n질문 계속';
result=execute([adversarial]);
assert.ok(result.buttons[0].children[2].textContent.includes('<img src=x'));
assert.ok(result.buttons[0].children[2].textContent.includes('> 질문 계속'));
assert.ok(!renderer.includes('innerHTML'));
pass('사용자가 쓴 HTML 유사 문자열은 DOM textContent로만 보관');
const none=execute([{id:'only',checkHistory:[],generalRetryHistory:[]}]);
assert.equal(none.buttons.length,0);
pass('관찰 없는 기록은 생성한 메모나 진단 없이 제외');
assert.match(html,/\.wrong-parent-note-preview\{[^}]*white-space:nowrap;[^}]*text-overflow:ellipsis/);
assert.match(html,/body\.v218-child #page-home > #home-observation-card/);
pass('모바일 한 줄 말줄임·기존 아이 모드 부모 카드 숨김 경계 유지');
console.log('WRONG_QA37_NOTE_NODE_RESULT='+JSON.stringify({
 status:'PASS',checks,readOnly:true,mostRecentAcrossSources:true,
 noStaleNotes:true,realFamilyAuth:false,safeToRestore:false,deployment:false}));
