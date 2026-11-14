// QA40 NEW selected feature: view records with unknown retry times in a
// separate collapsed group, never auto-classify them as "no retry".
// Execute actual index.html helpers in synthetic Node DOM; no old suite, no
// production auth/IndexedDB/real family/photos, no browser claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let checks=0;const pass=s=>{checks++;console.log('PASS WRONG QA40 UNKNOWN RETRY DOM',s)};
function part(start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'source boundary not found '+start);return source.slice(i,j);
}
const latest=part('function wrongParentLatestObservation(r){','// Parent-only signal:');
const status=part('function wrongParentRetryAfterObservation(r,latest,nowMs=Date.now()){','// Presentation-only parent filter;');
const home=part('// Presentation-only parent filter;','function groupCount(){');
function node(tag,cls,value){
 return {tag,className:cls||'',textContent:value===undefined?'':String(value),children:[],
  dataset:{},attributes:{},id:'',checked:false,events:{},focused:0,
  append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},
  setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn},
  focus(){this.focused++}};
}
const now=Date.now(),day=86400000,at=shift=>new Date(now+shift).toISOString();
function record(id,stamp,attempts=[],statusValue='needs_help'){
 return {id,problemText:'가상 문제 '+id,hasPhoto:id==='unknown-parent',subject:'math',
  checkHistory:[{at:stamp,status:statusValue,memo:'가상 부모 관찰'}],
  generalRetryHistory:attempts.map(x=>({at:x,answer:'가상 아이 답',review:'not_checked'}))};
}
const rows=[
 record('known-no-retry',at(-day*4)),
 record('unknown-parent','invalid-parent-date'),
 record('unknown-retry',at(-day*3),['invalid-attempt']),
 record('future-retry',at(-day*2),[at(day*2)]),
 record('already-retried',at(-day*5),[at(-day)]),
 record('other-state',at(-day),'','explained'),
 {id:'unknown-reviewed',problemText:'합성 부모가 시각 미확인으로 검토한 문제',
  checkHistory:[],generalRetryHistory:[{at:at(-day*3),answer:'합성 답',review:'needs_help'}]},
 record('known-prior-retry',at(-day),[at(-day*4)]),
];
const baseline=JSON.stringify(rows);
function ctx(data){
 const card=node('section'),stats=node('div');
 const get=id=>{
  if(id==='home-observation')return stats;
  if(id==='home-observation-card')return card;
  const queue=card.children.find(x=>x.id==='wrong-parent-needs-help-queue');
  if(id==='wrong-parent-needs-help-queue')return queue||null;
  return queue?.children.flatMap(x=>x.children||[]).find(x=>x.id===id)||null;
 };
 const isManual=c=>c?.manualDate===true||c?.by==='manual_due_date';
 const document={createTextNode:s=>({tag:'text',textContent:s})};
 const fn=new Function('$','make','document','wrong008ManualDate','records',
  latest+'\n'+status+'\n'+home+'\nreturn {render:renderObservationSummary, classify:wrongParentRetryAfterObservation,latest:wrongParentLatestObservation};'
 )(get,node,document,isManual,data);
 const queue=()=>get('wrong-parent-needs-help-queue');
 const main=()=>queue().children.filter(x=>x.tag==='button');
 const expand=()=>queue().children.find(x=>x.id==='wrong-parent-unknown-retries');
 const toggle=()=>get('wrong-parent-unretried-only');
 return {fn,card,queue,main,expand,toggle};
}
const page=ctx(rows);page.fn.render();
assert.equal(page.main().length,7);
assert.equal(page.expand(),undefined);
assert.equal(page.toggle().checked,false);
assert.equal(JSON.stringify(rows),baseline);
pass('기본 전체 도움 필요 목록에서는 불확실한 기록까지 숨기지 않고, 펼침 그룹은 아직 생성 안 함');

const prior=page.toggle();prior.checked=true;prior.events.change();
assert.deepEqual(page.main().map(x=>x.dataset.record),['known-prior-retry','known-no-retry']);
assert.equal(page.toggle().checked,true);assert.equal(page.toggle().focused,1);
assert.equal(JSON.stringify(rows),baseline);
pass('미재풀이 필터에서는 실제로 확인된 2개만 표시, 재렌더 후 체크·포커스 유지');

const details=page.expand();
assert.ok(details&&details.tag==='details'&&details.className.includes('wrong-parent-unknown-retries'));
assert.equal(details.id,'wrong-parent-unknown-retries');
assert.equal(details.children[0].tag,'summary');
assert.ok(details.children[0].textContent.includes('5건'));
assert.ok(details.children[1].textContent.includes('재풀이가 없었다는 뜻이 아닙니다'));
assert.equal(details.children.filter(x=>x.tag==='button').length,5);
assert.equal(JSON.stringify(rows),baseline);
pass('필터 밖 확인 불가 5건을 접힌 details/summary로 별도 제공, 미재풀이 단정 금지');

const ids=details.children.filter(x=>x.tag==='button').map(x=>x.dataset.record);
assert.deepEqual(new Set(ids),new Set(['unknown-parent','unknown-retry','future-retry','unknown-reviewed']));
assert.equal(ids.length,5);
assert.ok(ids.includes('unknown-parent'));
assert.ok(!ids.includes('already-retried')&&!ids.includes('known-no-retry'));
assert.ok(details.children.filter(x=>x.tag==='button').every(x=>x.type==='button'));
pass('오류·미래·부모시각 누락 기록을 모두 접힘 그룹에서 원본 오답 ID 버튼으로 연결, 확인된 항목과 중복 없음');

assert.ok(source.includes("const r=e.target.closest('[data-record]')"));
assert.ok(source.includes("detailId=r.dataset.record;navigate('detail')"));
assert.ok(details.children.filter(x=>x.tag==='button').every(x=>x.children[1].textContent.includes('직접 확인')));
pass('기존 data-record 상세 이동 경로 재사용, 원문 확인 행동을 명확히 안내');

const previously=page.expand().children.filter(x=>x.tag==='button').map(x=>x.dataset.record);
page.fn.render();
assert.deepEqual(page.expand().children.filter(x=>x.tag==='button').map(x=>x.dataset.record),previously);
assert.equal(page.toggle().checked,true);
pass('홈 재렌더에도 미확인 그룹과 필터 유지, 기록 재저장 없이 결정적 순서');

const inp=page.toggle();inp.checked=false;inp.events.change();
assert.equal(page.main().length,7);
assert.equal(page.expand(),undefined);
assert.equal(JSON.stringify(rows),baseline);
pass('필터 해제하면 전체 목록으로 복귀하고 중복 접힘 그룹은 제거, 원본 사진/관찰 불변');

const onlyKnown=ctx([record('only-known',at(-day*2))]);onlyKnown.fn.render();
let chk=onlyKnown.toggle();chk.checked=true;chk.events.change();
assert.equal(onlyKnown.expand(),undefined);
assert.equal(onlyKnown.main().length,1);
pass('확인 불가 0건이면 빈 펼침 그룹을 만들지 않음');

const onlyUnknown=ctx([record('uncertain','not-a-time')]);onlyUnknown.fn.render();
chk=onlyUnknown.toggle();chk.checked=true;chk.events.change();
assert.equal(onlyUnknown.main().length,0);
assert.equal(onlyUnknown.expand().children.filter(x=>x.tag==='button').length,1);
assert.ok(onlyUnknown.queue().children.some(x=>x.tag==='p'&&x.textContent.includes('없는 것으로 확인된')));
pass('확인된 미재풀이 0건이어도 미확인 오답 1건은 별도 펼침에서 수동 확인 가능');

const many=ctx(Array.from({length:34},(_,i)=>record('unknown-'+i,'bad-date')));many.fn.render();
chk=many.toggle();chk.checked=true;chk.events.change();
assert.equal(many.expand().children[0].textContent,'재풀이 시각 확인 불가 34건 따로 보기');
assert.equal(many.expand().children.filter(x=>x.tag==='button').length,30);
assert.ok(many.expand().children.at(-1).textContent.includes('나머지 4건'));
pass('다량 미확인 오답은 전체 34건을 명시하며 30건만 노출하고 나머지 안내');

assert.ok(source.includes('body.v218-child #page-home > #home-observation-card'));
assert.ok(!home.includes('indexedDB')&&!home.includes('fetch(')&&!home.includes('writeOne('));
assert.ok(!home.includes('localStorage.setItem'));
assert.equal(JSON.stringify(rows),baseline);
pass('기존 아이 모드 부모 카드 숨김·로컬 원장/서버 무쓰기·재풀이 판단 불확실성 유지');

console.log('WRONG_QA40_UNKNOWN_RETRY_RESULT='+JSON.stringify({status:'PASS',checks,
 syntheticNodeDOM:true,unknownRecordsNeverClassifiedNoRetry:true,originalRecordLinks:true,
 parentOnly:true,noStorageWrites:true,realFamilyAuth:false,realChromium:false,
 safeToRestore:false,deployment:false}));
