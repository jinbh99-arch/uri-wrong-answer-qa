// QA39: selected parent-only filter on existing actual source DOM functions.
// Node synthetic DOM only. Does not touch IndexedDB, photos, auth, or prod.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let count=0;const pass=s=>{count++;console.log('PASS WRONG QA39 PARENT FILTER DOM',s)};
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'source boundary '+start);return source.slice(a,b);
}
const helper=extract('function wrongParentLatestObservation(r){','// Parent-only signal:');
const signal=extract('function wrongParentRetryAfterObservation(r,latest,nowMs=Date.now()){','// Presentation-only parent filter;');
const renderer=extract('// Presentation-only parent filter;','function groupCount(){');
function make(tag,cls,value){
 const el={tag,className:cls||'',textContent:value===undefined?'':String(value),
  children:[],dataset:{},attributes:{},id:'',type:'',checked:false,events:{},focused:0,
  append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},
  setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,fn){this.events[k]=fn},
  focus(){this.focused++}};
 return el;
}
const root=make('section'),stats=make('div'),doc={
 createTextNode(s){return {tag:'text',textContent:s}}
};
const get=id=>{
 if(id==='home-observation')return stats;
 if(id==='home-observation-card')return root;
 const queue=root.children.find(x=>x.id==='wrong-parent-needs-help-queue');
 if(id==='wrong-parent-needs-help-queue')return queue||null;
 return queue?.children.flatMap(x=>x.children||[]).find(x=>x.id===id)||null;
};
const now=Date.now(),day=86400000;
const at=shift=>new Date(now+shift).toISOString();
const review=(id,time,extras={})=>({id,subject:'math',problemText:'가상 기록 '+id,
 checkHistory:[{status:'needs_help',at:time,memo:'가상 부모 메모'}],
 generalRetryHistory:[],...extras});
const rows=[
 review('never',at(-day*5)),
 review('retry-after',at(-day*4),{generalRetryHistory:[{at:at(-day*3),answer:'가상 답',review:'not_checked'}]}),
 review('invalid-parent','wrong-parent-timestamp'),
 review('invalid-attempt',at(-day*4),{generalRetryHistory:[{at:'invalid-attempt',answer:'x'}]}),
 review('retry-before',at(-day),{generalRetryHistory:[{at:at(-day*2),answer:'before'}]}),
 {id:'reviewed-retry',problemText:'가상 부모 재풀이 리뷰',subject:'math',checkHistory:[],
  generalRetryHistory:[{at:at(-day*3),review:'needs_help',reviewedAt:at(-day*2),answer:'한 번 풀었어요'}]},
 review('explained',at(-day*3),{checkHistory:[
  {status:'needs_help',at:at(-day*3)}, {status:'explained',at:at(-day)}]}),
 review('future-parent',at(day*2)),
 review('future-attempt',at(-day*2),{generalRetryHistory:[{at:at(day*2),answer:'future'}]})
];
const original=JSON.stringify(rows),isManual=x=>x?.manualDate===true||x?.by==='manual_due_date';
const fns=new Function('$','make','document','wrong008ManualDate','records',
 helper+'\n'+signal+'\n'+renderer+'\nreturn {render:renderObservationSummary,signal:wrongParentRetryAfterObservation,latest:wrongParentLatestObservation};'
)(get,make,doc,isManual,rows);
const queue=()=>get('wrong-parent-needs-help-queue');
const buttons=()=>queue().children.filter(x=>x.tag==='button');
const input=()=>queue().children.flatMap(x=>x.children||[]).find(x=>x.id==='wrong-parent-unretried-only');
fns.render();
assert.equal(input().type,'checkbox');assert.equal(input().checked,false);
assert.equal(buttons().length,8,'all needs_help records, including unknown, remain available by default');
assert.equal(JSON.stringify(rows),original);
pass('기본 화면에서 모든 실제 needs_help 대상 유지, 상태는 임시 체크박스·원본 무수정');

const latest=rows.map(x=>fns.latest(x));
assert.equal(fns.signal(rows[0],latest[0]),'관찰 이후 재풀이: 기록 없음');
assert.equal(fns.signal(rows[1],latest[1]),'관찰 이후 재풀이: 기록 있음');
assert.equal(fns.signal(rows[2],latest[2]),'관찰 이후 재풀이: 확인 불가');
assert.equal(fns.signal(rows[3],latest[3]),'관찰 이후 재풀이: 확인 불가');
assert.equal(fns.signal(rows[8],latest[8]),'관찰 이후 재풀이: 확인 불가');
pass('검토 뒤 기록 있음/없음과 부모·재풀이 시각 오류를 엄격히 세 갈래로 구분');

const oldInput=input();oldInput.checked=true;oldInput.events.change();
assert.equal(input().checked,true);assert.ok(input().focused>0);
assert.deepEqual(buttons().map(x=>x.dataset.record),['retry-before','reviewed-retry','never']);
assert.ok(queue().children.some(x=>String(x.textContent).includes('확인할 수 없는')));
assert.equal(JSON.stringify(rows),original);
pass('필터 켜면 관찰 뒤 재풀이 없음이 실제 확인된 3건만 최신 관찰순 표시, 기존 가족 기록 변경 없음');

assert.ok(!buttons().some(x=>['invalid-parent','invalid-attempt','future-parent','future-attempt','retry-after'].includes(x.dataset.record)));
pass('불명확한 시각·미래 시간·이미 재풀이한 오답은 미재풀이로 단정하지 않음');

assert.ok(buttons().every(x=>x.children.some(c=>c.className?.includes('wrong-parent-retry-after')&&c.textContent.includes('기록 없음'))));
assert.ok(buttons().every(x=>x.children.some(c=>c.className?.includes('wrong-parent-note-preview'))));
assert.ok(buttons().every(x=>x.children.some(c=>c.className?.includes('wrong-parent-observation-age'))));
pass('기존 정렬·경과일·부모 메모·재풀이 신호를 선택된 버튼에서 함께 유지');

const visible=buttons().map(x=>x.dataset.record);
fns.render();assert.deepEqual(buttons().map(x=>x.dataset.record),visible);
assert.equal(input().checked,true);
pass('홈 재렌더에서도 일시 필터 선택 유지, 중복 이벤트·재저장 없음');

const active=input();active.checked=false;active.events.change();
assert.equal(input().checked,false);assert.equal(buttons().length,8);
pass('체크 해제 즉시 미확인 대상을 포함하는 전체 도움 필요 기록으로 복귀');

assert.ok(source.includes('body.v218-child #page-home > #home-observation-card'));
assert.ok(!renderer.includes('indexedDB')&&!renderer.includes('fetch('));
assert.ok(!renderer.includes('localStorage.setItem')&&!renderer.includes('writeOne('));
pass('부모 카드의 아이 모드 비노출 유지, 필터 동작 내 저장·외부 업로드 추가 없음');

const onlyUnknown=[review('uncertain','invalid-raw')];
const r2=make('section'),s2=make('div');
const get2=id=>{
 if(id==='home-observation')return s2;if(id==='home-observation-card')return r2;
 const q=r2.children.find(x=>x.id==='wrong-parent-needs-help-queue');
 if(id==='wrong-parent-needs-help-queue')return q;
 return q?.children.flatMap(x=>x.children||[]).find(x=>x.id===id)||null;
};
const f2=new Function('$','make','document','wrong008ManualDate','records',
 helper+'\n'+signal+'\n'+renderer+'\nreturn renderObservationSummary;'
)(get2,make,doc,isManual,onlyUnknown);
f2();
const inp2=get2('wrong-parent-unretried-only');inp2.checked=true;inp2.events.change();
assert.equal(r2.children[0].children.filter(x=>x.tag==='button').length,0);
assert.ok(r2.children[0].children.some(x=>String(x.textContent).includes('없는 것으로 확인된 오답이 없습니다')));
pass('확인된 미재풀이 기록이 0건이면 설명 메시지, 불명확 항목 자동 포함 금지');

console.log('WRONG_QA39_PARENT_FILTER_RESULT='+JSON.stringify({
 status:'PASS',checks:count,syntheticNodeDom:true,verifiedOnly:true,
 noAssumptionFromUnknownTimes:true,parentOnly:true,noWrites:true,
 realFamilyAuth:false,safeToRestore:false,deployment:false,realChromium:false}));
