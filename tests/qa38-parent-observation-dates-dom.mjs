// QA38 NEW selected parent observation-date feature + deferred queue DOM boundary.
// Runs actual source helpers in a synthetic Node DOM, without old suites.
// No auth, real family data, browser, IndexedDB writes, deployment or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let checks=0;const pass=s=>{checks++;console.log('PASS WRONG QA38 PARENT DOM',s)};
function between(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'function not found '+start);return html.slice(a,b);
}
function make(tag,cls,text){
 return {tag,className:cls||'',textContent:text===undefined?'':String(text),
  children:[],attributes:{},dataset:{},id:'',
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(){this.children=[]},
  setAttribute(key,value){this.attributes[key]=value}};
}
const labels=between('function v230ParentObservationLabel(entry){','// Read only the parent-issued');
const dates=between('function v230ParentObservationDateLabel(entry,nowMs=Date.now()){','function v230ExplanationCompare(parent,entries){');
const compare=between('function v230ExplanationCompare(parent,entries){','function v230HistoryPanel(parent,r){');
const helpers=new Function('make',labels+'\n'+dates+'\n'+compare+'\nreturn {label:v230ParentObservationDateLabel,compare:v230ExplanationCompare};')(make);
const now=Date.parse('2026-11-14T08:00:00.000Z');
const shown=helpers.label({at:'2026-01-01T00:00:00Z',review:'needs_help',reviewedAt:'2026-11-13T18:05:00.000Z'},now);
assert.ok(shown.includes('2026')&&shown.includes('11')&&shown.includes('14'),shown);
pass('서버에 저장된 실제 학부모 reviewedAt을 한국시간 날짜로 변환, 아이 at 날짜와 분리');
assert.equal(helpers.label({review:'not_checked',at:'2026-11-14T01:00:00Z'},now),'학부모 관찰일: 확인 기록 없음');
pass('미검토 재풀이가 있어도 부모 관찰일을 추정하지 않음');
assert.equal(helpers.label({review:'needs_help',at:'2026-11-13T04:00:00Z'},now),'학부모 관찰일: 확인 불가');
pass('학부모 reviewedAt 누락 시 아이 재풀이 시각으로 대체 금지');
for(const invalid of ['invalid-date','2026-02-30T12:00:00Z','2026-11-14T33:00:00Z','2026-11-14','2026-11-15T00:00:00Z',null]){
 assert.equal(helpers.label({review:'explained',reviewedAt:invalid},now),'학부모 관찰일: 확인 불가',String(invalid));
}
pass('형식 오류·존재하지 않는 날짜·미래 시각·날짜만 있는 값은 확인 불가');
assert.equal(helpers.label({review:'explained',reviewedAt:'2026-11-13T23:59:00+09:00'},now).includes('11'),true);
pass('타임존 오프셋이 있는 정식 ISO 관찰 시각 허용');
const entries=[
 {at:'2026-10-01T04:00:00Z',answer:'처음 답',explanation:'가상 아이 처음 설명',review:'needs_help',reviewedAt:'2026-11-12T23:00:00Z'},
 {at:'2026-11-13T02:00:00Z',answer:'중간 답',explanation:'가상 아이 중간 설명',review:'explained',reviewedAt:'2026-11-13T03:00:00Z'},
 {at:'2026-11-14T00:30:00Z',answer:'최신 답',explanation:'가상 아이 최근 설명',review:'not_checked'}
];
const before=JSON.stringify(entries);const box=make('div');helpers.compare(box,entries);
const panel=box.children[0],sides=panel.children[2].children;
assert.equal(sides.length,2);
assert.ok(panel.className.includes('v218-parent-only'));
assert.ok(sides[0].children.at(-1).textContent.includes('11')&&sides[0].children.at(-1).textContent.includes('13'));
assert.equal(sides[1].children.at(-1).textContent,'학부모 관찰일: 확인 기록 없음');
assert.ok(sides[0].children[2].textContent.includes('처음 설명'));
assert.ok(sides[1].children[2].textContent.includes('최근 설명'));
assert.equal(JSON.stringify(entries),before);
pass('실제 부모 전용 비교 DOM 두 칸에 저장된 첫/최근 관찰 날짜만 표시, 답·설명·원본 불변');
const xss=structuredClone(entries);xss[0].explanation='<img src=x onerror=alert(1)>';
const protectedParent=make('div');helpers.compare(protectedParent,xss);
assert.ok(protectedParent.children[0].children[2].children[0].children[2].textContent.includes('<img src'));
pass('아이의 설명에 있는 HTML 유사 코드는 실행 가능한 마크업으로 삽입되지 않음');
const noComparison=make('div');helpers.compare(noComparison,[entries[0]]);
assert.equal(noComparison.children.length,0);
pass('재풀이 1건만 있으면 가상의 전후 설명·날짜 카드를 생성하지 않음');

// Unrelated but still-unverified earlier selected queue: execute source DOM
// paths once to verify latest observation sorting and elapsed days.
const sourceLatest=between('function wrongParentLatestObservation(r){','function renderObservationSummary(){');
const sourceHome=between('function renderObservationSummary(){','function groupCount(){');
const baseNow=Date.now();
const at=(ms)=>new Date(ms).toISOString();
const records=[
 {id:'older',problemText:'오래된 가상 A',checkHistory:[{at:at(baseNow-5*86400000),status:'needs_help',memo:'첫 메모'}],generalRetryHistory:[]},
 {id:'newer',problemText:'최근 가상 B',checkHistory:[{at:at(baseNow-9000000),status:'needs_help',memo:'최근 메모'}],generalRetryHistory:[]},
 {id:'tie1',problemText:'같은 날짜 C',checkHistory:[{at:at(baseNow-2*86400000),status:'needs_help'}],generalRetryHistory:[]},
 {id:'tie2',problemText:'같은 날짜 D',checkHistory:[{at:at(baseNow-2*86400000),status:'needs_help'}],generalRetryHistory:[]},
 {id:'unknown',problemText:'날짜 모름 E',checkHistory:[{at:'not-a-date',status:'needs_help'}],generalRetryHistory:[]},
 {id:'onlyRetry',problemText:'관찰 전 재풀이',checkHistory:[],generalRetryHistory:[{at:at(baseNow),review:'not_checked'}]},
 {id:'recovered',problemText:'이후 설명함',checkHistory:[{at:at(baseNow-4*86400000),status:'needs_help'}],
  generalRetryHistory:[{at:at(baseNow-100000),review:'explained',reviewedAt:at(baseNow-100000)}]}
];
const home=make('section'),stats=make('div');
const $=id=>id==='home-observation'?stats:id==='home-observation-card'?home:
 home.children.find(x=>x.id===id)||null;
const isManual=c=>c?.manualDate===true||c?.by==='manual_due_date';
const renderHome=new Function('$','make','wrong008ManualDate','records',
 sourceLatest+'\n'+sourceHome+'\nreturn renderObservationSummary;')($,make,isManual,records);
const oldJson=JSON.stringify(records);
renderHome();
const queue=home.children.find(x=>x.id==='wrong-parent-needs-help-queue');
assert.ok(queue);
const buttons=queue.children.filter(x=>x.tag==='button');
assert.deepEqual(buttons.map(x=>x.dataset.record),['newer','tie1','tie2','older','unknown']);
assert.equal(JSON.stringify(records),oldJson);
pass('기존 정렬 실제 Node DOM 실행: 최신 유효 관찰 우선·동률 원본 순서 안정·미검토 제외');
assert.equal(buttons[0].children[0].textContent,'오늘 관찰');
assert.equal(buttons[1].children[0].textContent,'2일 경과');
assert.equal(buttons.at(-1).children[0].textContent,'관찰일 확인 불가');
pass('기존 부모 관찰 경과일 DOM: 오늘/이틀/날짜 확인 불가 구별, 누락값 미추정');
assert.ok(html.includes('body.v218-child #page-home > #home-observation-card'));
assert.ok(html.includes('.v230-parent-compare-grid{'));
assert.ok(html.includes('@media(max-width:390px){.v230-parent-compare-grid'));
pass('기존 아이 화면 비노출 및 390px 이하 부모 카드 한 열 계약 유지');
console.log('WRONG_QA38_OBSERVATION_DATES_DOM_RESULT='+JSON.stringify({
 status:'PASS',checks,selectedFeature:'twoActualParentReviewDates',syntheticNodeDOM:true,
 oldSortingAndAgeDOMChecked:true,readOnly:true,realFamilies:0,
 safeToRestore:false,deployment:false,realChromium:false}));
