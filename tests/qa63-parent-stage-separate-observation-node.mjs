// WRONG QA63: actual dev list() parent stage under cross-history cases.
// Synthetic DOM and saved in-memory records only; no old suite or DB writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function list(container,items,empty){');
const end=html.indexOf('function renderHome(){',start);
assert.ok(start>=0&&end>start,'source list unavailable');
const realList=html.slice(start,end);
const valid=html.indexOf('function wrong008ValidDay(value){');
const observed=html.indexOf('function wrong008ObservedCheckCount(r){',valid);
assert.ok(valid>0&&observed>valid);
const dateFunctions=html.slice(valid,observed);
let count=0;const pass=s=>{count++;console.log('PASS WRONG QA63 '+s)};
class El{
 constructor(tag,cls='',value=''){
  this.tag=tag;this.className=cls||'';this.textContent=String(value??'');
  this.children=[];this.dataset={};this.id='';this.type='';
 }
 append(...els){this.children.push(...els)}
 replaceChildren(...els){this.children=[];this.append(...els)}
}
const make=(tag,cls,txt)=>new El(tag,cls,txt);
const boxes={'records-list':new El('div'),'home-recent':new El('div')};
const $=id=>boxes[id];
const fn=new Function('make','$','date','wrong007SubjectName','cname','wrong008ObservedCheckCount',
 dateFunctions+realList+'return list;');
const list=fn(make,$,s=>String(s||''),x=>x==='math'?'수학':'과학',x=>x||'개념 미확인',
 r=>(r.checkHistory||[]).length);
const attempt=(review,explanation='아이 이유 설명')=>({at:'2026-11-14T08:00:00.000Z',answer:'2',
 explanation,review,...(review!=='not_checked'?{reviewedAt:'2026-11-14T08:01:00.000Z'}:{})});
const check=(status,memo='가상 부모 메모')=>({at:'2026-11-13T08:00:00.000Z',
 status,memo,by:'parent_observation'});
const row=(id,retries=[],history=[])=>({id,problemText:'가상 문제 '+id,subject:'science',
 gradeAtEntry:3,createdAt:'2026-11-12T00:00:00.000Z',hasPhoto:false,
 generalRetryHistory:retries,checkHistory:history});
const rows=[
 row('older-need',[attempt('not_checked')],[check('needs_help')]),
 row('older-explain',[],[check('explained')]),
 row('current-reviewed',[attempt('explained')],[check('needs_help')]),
 row('retry-history',[attempt('needs_help'),attempt('not_checked')]),
 row('manual-only',[attempt('not_checked')],[{at:'2026-11-13T08:00:00.000Z',status:'not_checked',memo:'다음 확인 메모: 2026-11-30 · 수동'}]),
 row('older-unable',[attempt('not_checked')],[check('not_checked')]),
 row('invalid',[attempt('not_checked')],[{at:'2026-11-13T08:00:00.000Z',status:'unknown',memo:'이유'}]),
 row('no-note',[attempt('not_checked')]),
 row('latest-no-explanation',[attempt('not_checked','')],[check('mistake')])
];
const original=JSON.stringify(rows);
list('records-list',rows,'비었음');
const all=boxes['records-list'].children;
assert.equal(all.length,rows.length);
function stage(id){
 const button=all.find(x=>x.dataset.record===id);
 assert.ok(button,'missing original button '+id);
 const spans=button.children.filter(x=>x.dataset.recordStage===id);
 assert.equal(spans.length,1);
 assert.ok(spans[0].className.includes('v218-parent-only'));
 return spans[0].textContent;
}
assert.match(stage('older-need'),/② 이번 아이 설명 · 이번 재풀이 부모 확인 전/);
assert.match(stage('older-need'),/별도 부모 관찰 이력: 도움 필요/);
assert.match(stage('older-need'),/이번 아이 재풀이에 대한 판단인지 확인 전/);
pass('latest unreviewed explanation and prior needs-help judgment shown separately');
assert.match(stage('older-explain'),/① 아이 재풀이 기록 전/);
assert.match(stage('older-explain'),/별도 부모 관찰 이력: 스스로 설명 관찰/);
pass('no retry still preserves separate saved parent observation in list');
assert.match(stage('current-reviewed'),/③ 이번 재풀이의 부모 확인 기록 있음/);
assert.doesNotMatch(stage('current-reviewed'),/별도 부모 관찰 이력/);
pass('latest actually reviewed retry retains stage 3, older check does not overwrite');
assert.match(stage('retry-history'),/② 이번 아이 설명/);
assert.match(stage('retry-history'),/별도 부모 관찰 이력: 도움 필요/);
pass('older reviewed generic retry remains visible distinct from newest unreviewed');
assert.match(stage('manual-only'),/수동 메모\(알림·예약·완료 아님\)/);
assert.doesNotMatch(stage('manual-only'),/별도 부모 관찰 이력/);
pass('manual follow-up memo is not counted as previous parent observation');
assert.match(stage('older-unable'),/별도 부모 관찰 이력: 확인 못함/);
pass('explicit could-not-check remains distinct from inferred completion');
assert.doesNotMatch(stage('invalid'),/별도 부모 관찰 이력/);
pass('unrecognized check status never treated as parent judgment');
assert.doesNotMatch(stage('no-note'),/별도 부모 관찰 이력/);
pass('single new retry without older check keeps concise one-action label');
assert.match(stage('latest-no-explanation'),/아이 설명 없음/);
assert.match(stage('latest-no-explanation'),/별도 부모 관찰 이력: 계산·표기 실수로 보임/);
pass('child no explanation does not hide different saved parent check');
list('home-recent',rows.slice(0,2),'없음');
assert.ok(boxes['home-recent'].children.every(b=>!b.children.some(x=>x.dataset.recordStage)));
pass('home recent list receives no parent stage or layout change');
list('records-list',[],'기록 없음');
assert.equal(boxes['records-list'].children[0].textContent,'기록 없음');
pass('existing empty list unchanged');
assert.equal(JSON.stringify(rows),original);
assert.doesNotMatch(realList,/v20SaveMistakeGuarded|indexedDB|localStorage\.setItem|fetch\(|deleteDatabase/);
assert.match(html,/body\.v218-child \.v218-parent-only\{display:none!important\}/);
assert.match(html,/@media\(max-width:390px\)\{\.wrong-dev-record-stage/);
pass('no mutation, writes, child leakage, or mobile style regression');
console.log('WRONG_QA63_NODE_RESULT='+JSON.stringify({status:'PASS',checks:count,
 source:'actual dev list()',kind:'Node22 synthetic DOM',realFamilies:0,
 writes:0,release:false,safeToRestore:false}));
