// WRONG QA58: exercise ACTUAL dev calendar validator, due CTA selection, and
// last-moment click guard. Synthetic in-memory rows; no old suites or browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function excerpt(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Cannot locate actual source '+a);
 return html.slice(i,j);
}
const calendar=excerpt('function wrongChildValidParentDay(value){','function wrongChildParentDate(r){');
const dueAndClick=excerpt('function wrongDevDueDateReached(value,today=localToday()){','// QA9: offer exactly one next action');
const card=excerpt('function qa9RenderOneAction(){','const qa9PreviousRenderHome=renderHome;');
assert.match(card,/ordered\.find\(r=>wrongDevDueDateReached\(r\.studyPlan\?\.dueDate,today\)\)/);
assert.match(dueAndClick,/kind==='due'\?wrongDevDueDateReached\(dueDate\):false/);
let checks=0;
const pass=(name)=>{checks++;console.log('PASS WRONG QA58 '+name)};
const table=[
 ['2026-02-28','2026-03-01',true],
 ['2026-03-01','2026-03-01',true],
 ['2026-03-02','2026-03-01',false],
 ['2026-02-29','2026-03-01',false],
 ['2026-02-30','2026-03-01',false],
 ['2026-02-31','2026-03-01',false],
 ['2026-00-14','2026-03-01',false],
 ['2026-13-01','2026-03-01',false],
 ['2026-03-00','2026-03-01',false],
 ['2026-03-32','2026-04-01',false],
 ['2026-03-1','2026-03-01',false],
 ['2028-02-29','2028-02-29',true],
 ['2028-02-29','2028-02-28',false],
 ['2027-02-29','2027-03-01',false],
 ['2099-12-31','2026-03-01',false],
 ['2000-01-01','2026-03-01',true],
 ['2026-01-01T00:00:00Z','2026-03-01',false],
 ['not-a-date','2026-03-01',false],
 [null,'2026-03-01',false],
 [20260301,'2026-03-01',false]
];
function build(rows,today='2026-03-01',role='parent',page='home'){
 const saved=JSON.stringify(rows),logs={routes:[],notices:[],rerenders:0};
 const button={dataset:{},textContent:'',onclick:null,removeAttribute(name){
  if(name==='data-record')delete this.dataset.record
 }};
 const desc={textContent:''};
 const header={classList:{hidden:false,add(k){if(k==='hide')this.hidden=true},remove(k){if(k==='hide')this.hidden=false}}};
 const fields=Object.fromEntries(['problem','ocr-reviewed','check-status'].map(id=>[id,{
  id,isConnected:true,disabled:false,scrollIntoView(){this.scrolled=true},focus(){this.focused=true}
 }]));
 const $=id=>({'qa9-next-action':header,'qa9-next-desc':desc,'qa9-next-open':button,...fields})[id]||null;
 const setup={rows,$,today,page,role,logs};
 const fn=new Function('cfg',[
  'const records=cfg.rows,$=cfg.$,localToday=()=>cfg.today;',
  'const requestAnimationFrame=fn=>fn();',
  "const document={body:{classList:{contains:x=>cfg.role==='child'&&x==='v218-child'}}};",
  "let route=cfg.page,v218Mode=cfg.role,detailId=null,editId=null;",
  "const navigate=next=>{route=next;cfg.logs.routes.push(next)};",
  "const notify=t=>cfg.logs.notices.push(t);",
  calendar,dueAndClick,card,
  'return {valid:wrongDevDueDateReached,render:qa9RenderOneAction,',
  ' run:(id,kind)=>wrongDevOpenSavedParentFallback(id,kind),',
  ' state:()=>({route,editId,detailId}),fields:cfg.$};'
 ].join('\n'))(setup);
 return {...fn,button,desc,header,fields,logs,rows,saved};
}
const dateFixture=build([]);
for(const [day,today,allowed] of table){
 assert.equal(dateFixture.valid(day,today),allowed,'date classification '+day+' <= '+today);
}
pass('20 calendar boundaries including leap years, month lengths, invalid shape, future and null');
const make=(id,day,createdAt)=>({id,subject:'math',problemText:'가상 복습 '+id,
 createdAt,studyPlan:day===undefined?null:{dueDate:day},generalRetryHistory:[]});
const records=[
 make('invalid','2026-02-30','2026-03-01T05:00:00Z'),
 make('valid','2026-02-28','2026-02-28T04:00:00Z'),
 make('future','2026-03-02','2026-02-27T04:00:00Z')
];
const f=build(records);f.render();
assert.equal(f.button.dataset.record,'valid');
assert.match(f.button.textContent,/복습 기록 열기/);
pass('invalid newest due date skipped, real older due date selected');
await f.run('invalid','due');
assert.deepEqual(f.logs.routes,[]);
assert.equal(f.logs.routes.length,0);
pass('direct click guard rejects malformed due even when caller passes its ID');
await f.run('valid','due');
assert.deepEqual(f.logs.routes,['detail']);
assert.equal(f.state().detailId,'valid');
assert.equal(f.fields['check-status'].focused,true);
pass('valid due clicked through to exact saved record and existing parent check control');
const invalidOnly=build([make('bad','2026-02-30','2026-03-01T04:00:00Z')]);
invalidOnly.render();
assert.equal(invalidOnly.button.dataset.record,'bad');
assert.match(invalidOnly.button.textContent,/최근 오답 학습 이어가기/);
assert.equal(invalidOnly.button.onclick,null);
pass('invalid due alone falls back to existing recent-record CTA, not false due');
const futureOnly=build([make('later','2026-03-02','2026-02-28T01:00:00Z')]);
futureOnly.render();
assert.match(futureOnly.button.textContent,/최근 오답 학습/);
pass('next day not treated as current due');
const todayOne=build([make('today','2026-03-01','2026-02-28T01:00:00Z')]);
todayOne.render();
assert.match(todayOne.button.textContent,/복습 기록/);
await todayOne.run('today','due');
assert.equal(todayOne.state().detailId,'today');
pass('exact local calendar day is due; no artificial alert or completion');
const leap=build([make('leap','2028-02-29','2028-02-01T00:00:00Z')],'2028-02-29');
leap.render();assert.match(leap.button.textContent,/복습 기록/);
pass('legitimate leap-day plan is not lost');
const leapBad=build([make('not-leap','2027-02-29','2027-02-01T00:00:00Z')],'2027-03-01');
leapBad.render();assert.match(leapBad.button.textContent,/최근 오답 학습/);
pass('invalid February 29 in non-leap year is not a task');
const stale=build([make('change','2026-03-01','2026-02-20T00:00:00Z')]);
stale.render();
assert.match(stale.button.textContent,/복습 기록/);
stale.rows[0].studyPlan.dueDate='2026-02-30';
await stale.run('change','due');
assert.deepEqual(stale.logs.routes,[]);
assert.match(stale.button.textContent,/최근 오답 학습/);
pass('re-check at click fails closed if parent date changed after rendering');
const child=build([make('child','2026-02-28','2026-02-20T00:00:00Z')],'2026-03-01','child');
child.render();await child.run('child','due');
assert.deepEqual(child.logs.routes,[]);
pass('child view cannot execute parent due callback');
const different=build([make('different','2026-03-01','2026-02-20T00:00:00Z')],'2026-03-01','parent','records');
await different.run('different','due');assert.deepEqual(different.logs.routes,[]);
pass('off-home stale action cannot change record');
const photo=build([{id:'photo',createdAt:'2026-03-01T10:00:00Z',subject:'science',
 hasPhoto:true,problemText:'',studyPlan:{dueDate:'2026-03-01'}}]);
photo.render();
assert.match(photo.button.textContent,/사진 기록 이어서 정리하기/);
pass('photo-only priority unchanged');
const ocr=build([{id:'ocr',createdAt:'2026-03-01T10:00:00Z',subject:'science',
 hasPhoto:true,problemText:'문장',ocrStatus:'browser_ocr_unconfirmed',
 studyPlan:{dueDate:'2026-03-01'}}]);
ocr.render();assert.match(ocr.button.textContent,/OCR 기록 검토하기/);
pass('unconfirmed OCR priority unchanged');
const pending=build([{id:'attempt',createdAt:'2026-02-20T01:00:00Z',subject:'math',
 problemText:'설명 저장',generalRetryHistory:[{
  at:'2025-11-01T00:00:00Z',explanation:'아이 말로 풀이 설명',
  review:'not_checked'}],studyPlan:{dueDate:'2026-02-28'}}]);
pending.render();assert.match(pending.button.textContent,/아이 설명 보고 부모가 관찰하기/);
pass('saved unreviewed child explanation still outranks due');
for(const fixture of [f,invalidOnly,futureOnly,todayOne,leap,leapBad,stale,child,different,photo,ocr,pending]){
 if(fixture!==stale)assert.equal(JSON.stringify(fixture.rows),fixture.saved,'records never mutated');
}
assert.doesNotMatch(dueAndClick+card,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(|deleteDatabase/);
pass('all selection and navigation read-only, no new storage or network');
console.log('WRONG_QA58_RESULT='+JSON.stringify({status:'PASS',checks,
 kind:'actual product source Node DOM/date boundary regression',realChromium:false,
 recordsWritten:0,photoWritten:0,safeToRestore:false,deployed:false}));
