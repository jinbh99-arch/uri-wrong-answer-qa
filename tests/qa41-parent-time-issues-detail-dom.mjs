// QA41: execute actual new WRONG detail functions against synthetic Node DOM.
// Confirms guardrail: child's attempt date NEVER stands in for parent review date.
// No real records, IndexedDB writes, network, old suite, production or Chromium.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start='  // WRONG-QA41: identify WHICH stored timestamp needs a parent';
const end='  // WRONG-A-ONLY-INAPP-BACK:';
const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
assert.ok(a>=0&&b>a,'actual product block not found');
const block=html.slice(a,b);
let checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA41 PARENT TIME DOM',s)};
function make(tag,cls,txt){
 return {tag,className:cls||'',textContent:txt===undefined?'':String(txt),
  attributes:{},children:[],id:'',removed:false,
  append(...xs){this.children.push(...xs)},
  prepend(...xs){this.children.unshift(...xs)},
  setAttribute(k,v){this.attributes[k]=v},
  remove(){this.removed=true}};
}
const now=Date.now(),day=86400000;
const at=offset=>new Date(now+offset).toISOString();
function run(record,previous=async()=>{},route='detail'){
 const area=make('div');
 const nodes=id=>{
  if(id==='detail-card')return area;
  if(id==='wrong-parent-time-review')return area.children.find(x=>x.id===id&&!x.removed)||null;
  return null;
 };
 const rows=record?[record]:[];
 const module=new Function('make','$','wrong008ManualDate','records','detailId','route','renderDetail',
  block+'\nreturn {check:wrongParentTimeIssue,items:wrongParentTimeIssueItems,render:renderDetail};')(
   make,nodes,c=>c?.manualDate===true||c?.by==='manual_due_date',
   rows,'synthetic-detail',route,previous);
 return {module,area,rows};
}
const valid=run({id:'synthetic-detail',checkHistory:[],generalRetryHistory:[]});
assert.equal(valid.module.check(at(-day),now),null);
assert.equal(valid.module.check('2026-02-30T10:00:00.000Z',now),'저장된 날짜·시각 확인 불가');
assert.equal(valid.module.check('not ISO',now),'시각 형식 확인 불가');
assert.equal(valid.module.check('',now),'저장된 시각 없음');
assert.equal(valid.module.check(at(day),now),'미래 시각으로 기록됨');
pass('정상·시각 없음·잘못된 형식·실재하지 않는 날짜·미래를 구별');

const manual={id:'synthetic-detail',problemText:'가상 사진 문제',hasPhoto:true,
 checkHistory:[
  {at:'not-a-date',status:'needs_help',memo:'가상 부모 메모'},
  {at:'not-a-date',status:'not_checked',manualDate:true,by:'manual_due_date'}],
 generalRetryHistory:[]};
const aRun=run(manual),before=JSON.stringify(manual);
assert.deepEqual(aRun.module.items(manual,now),['학부모 관찰 1번째: 시각 형식 확인 불가']);
await aRun.module.render();
assert.equal(aRun.area.children.length,1);
const panel=aRun.area.children[0];
assert.equal(panel.id,'wrong-parent-time-review');
assert.ok(panel.className.includes('v218-parent-only'));
assert.equal(panel.attributes['aria-label'],'학부모 관찰·아이 재풀이 시각 확인 안내');
assert.ok(panel.children.some(x=>x.textContent.includes('학부모 관찰 1번째')));
assert.equal(JSON.stringify(manual),before);
pass('학부모 상세 관찰의 오류만 부모 전용 상세 패널에 표시, 수동 재확인 예정일 제외·원본 불변');

const retry={id:'synthetic-detail',checkHistory:[],
 generalRetryHistory:[{at:'broken-at',review:'not_checked',answer:'가상 답'},
  {at:at(-day*2),review:'needs_help',answer:'가상 답',explanation:'직접 설명'}]};
const bRun=run(retry),retryBefore=JSON.stringify(retry);
assert.deepEqual(bRun.module.items(retry,now),[
 '아이 재풀이 1번째 기록일: 시각 형식 확인 불가',
 '재풀이 2번째의 학부모 확인일: 저장된 시각 없음']);
await bRun.module.render();
assert.ok(bRun.area.children[0].children.some(x=>x.textContent.includes('아이 재풀이 1번째')));
assert.ok(bRun.area.children[0].children.some(x=>x.textContent.includes('학부모 확인일')));
assert.equal(JSON.stringify(retry),retryBefore);
pass('아이 재풀이 날짜 오류와 재풀이에 대한 부모 확인일 누락을 서로 다른 항목으로 표시, 아이 at 대체 금지');

const futures={id:'synthetic-detail',checkHistory:[
 {at:at(day),status:'needs_help'}],
 generalRetryHistory:[{at:at(day),answer:'합성 답',review:'explained',reviewedAt:at(day*2)}]};
const cRun=run(futures);
assert.equal(cRun.module.items(futures,now).length,3);
assert.ok(cRun.module.items(futures,now).every(x=>x.endsWith('미래 시각으로 기록됨')));
pass('미래 부모 관찰·아이 재풀이·부모 재확인 3종을 시각 추정 없이 구분');

const clean={id:'synthetic-detail',checkHistory:[{at:at(-day),status:'needs_help'}],
 generalRetryHistory:[{at:at(-day*2),answer:'가상 답',review:'explained',reviewedAt:at(-day)}]};
const dRun=run(clean);
assert.deepEqual(dRun.module.items(clean,now),[]);
await dRun.module.render();
assert.equal(dRun.area.children.length,0);
pass('날짜가 모두 유효하면 경고를 지어내거나 불필요한 패널을 만들지 않음');

const old={id:'synthetic-detail',checkHistory:[{at:'<script>alert(1)</script>',status:'needs_help'}],
 generalRetryHistory:[]};
const eRun=run(old);
await eRun.module.render();
assert.ok(eRun.area.children[0].children.at(-1).textContent.includes('시각 형식 확인 불가'));
assert.ok(!JSON.stringify(eRun.area).includes('<script>'));
assert.ok(!block.includes('innerHTML')&&!block.includes('writeOne(')&&!block.includes('fetch('));
pass('사용자 시각 문자열은 실행/그대로 노출하지 않고 안전한 설명만 표시, 쓰기/네트워크 호출 0');

const missing=run(null);
await missing.module.render();
assert.equal(missing.area.children.length,0);
const notDetail=run(manual,async()=>{},'home');
await notDetail.module.render();
assert.equal(notDetail.area.children.length,0);
pass('원본 기록이 없거나 상세 화면이 아니면 잘못된 경고 UI 표시하지 않음');

const oldNote=run({id:'synthetic-detail',checkHistory:[],
 generalRetryHistory:[{at:'2026-02-30T09:40:00.000Z',review:'not_checked'}]});
assert.ok(oldNote.module.items(oldNote.rows[0],now)[0].includes('저장된 날짜·시각 확인 불가'));
assert.ok(html.includes('body.v218-child #page-detail')||html.includes('.v218-parent-only'));
pass('존재하지 않는 시각과 부모·아이 화면 분리 처리, 기존 앱 모드 규칙 유지');

console.log('WRONG_QA41_PARENT_TIME_DOM_RESULT='+JSON.stringify({
 status:'PASS',checks,actualSourceDOM:true,syntheticRecords:true,readonly:true,
 parentVsChildDatesSeparated:true,realChromium:false,
 realFamilyAuth:false,safeToRestore:false,deployed:false}));
