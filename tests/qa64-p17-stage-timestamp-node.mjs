// WRONG QA64: P17 parent status and P15/P16 stage must classify the SAME
// stored child timestamp. Actual product source, synthetic DOM and no writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function cut(start,end) {const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'source missing '+start);return html.slice(a,b)}
const time=cut('function wrongParentTimeIssue(raw,nowMs=Date.now()){','function wrongParentTimeIssueEntries(');
const cal=cut('function wrong008ValidDay(value){','function wrong008ObservedCheckCount(r){');
const listing=cut('function list(container,items,empty){','function renderHome(){');
const filter=cut('const wrongDevP17Wrap=make(', '// WRONG-A-ONLY-INAPP-BACK:');
assert.match(listing,/wrongParentTimeIssue\(h\.at\)/);
assert.match(filter,/wrongParentTimeIssue\(h\.at,now\)===null/);
let passCount=0;const pass=s=>{passCount++;console.log('PASS WRONG QA64 '+s)};
class El {
 constructor(tag,cls='',txt='') {this.tag=tag;this.className=cls||'';this.textContent=String(txt??'');
  this.children=[];this.dataset={};this.value='';this.id='';this.tabIndex=0;this.options=[];
  const owner=this;this.classList={
   contains:x=>owner.className.split(' ').includes(x),
   add:x=>{if(!owner.className.split(' ').includes(x))owner.className+=' '+x},
   remove:x=>{owner.className=owner.className.split(' ').filter(z=>z!==x).join(' ')},
   toggle:(x,v)=>{if(v)owner.classList.add(x);else owner.classList.remove(x)}
  };
 }
 append(...nodes){for(const node of nodes){this.children.push(node);
  if(this.tag==='select'&&node.tag==='option'){
    this.options.push(node);if(this.options.length===1)this.value=node.value;
  }}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 querySelector(s){return s==='.formgrid'?this.formgrid:null}
 querySelectorAll(s){assert.equal(s,'[data-record]');return this.children.filter(x=>x.dataset.record)}
 before(node){this.beforeNode=node}
}
const make=(...args)=>new El(...args);
const t=Date.now(),date=delta=>new Date(t+delta).toISOString();
const retry=(at,review='not_checked')=>({at,review,answer:'가상 답',explanation:'아이 이유 설명',
 ...(review==='not_checked'?{}:{reviewedAt:date(-5000)})});
const rows=[
 {id:'valid',generalRetryHistory:[retry(date(-86400000))],checkHistory:[{status:'needs_help',at:date(-172800000),memo:'이전 부모 도움 필요'}]},
 {id:'future',generalRetryHistory:[retry(date(86400000))],checkHistory:[]},
 {id:'invalid',generalRetryHistory:[retry('2026-02-30T08:00:00Z')],checkHistory:[]},
 {id:'malformed',generalRetryHistory:[retry('nonsense')],checkHistory:[]},
 {id:'reviewed',generalRetryHistory:[retry(date(-86400000),'explained')],checkHistory:[]},
 {id:'manual',generalRetryHistory:[],checkHistory:[{status:'not_checked',memo:'다음 확인 메모: 2026-11-20 · 수동 등록',at:date(-86400000)}]},
].map(r=>({...r,subject:'science',problemText:'가상 '+r.id,
 createdAt:date(-86400000),gradeAtEntry:3,hasPhoto:false}));
const saved=JSON.stringify(rows);
const ids=['page-records','records-list','records-count','wrong007-filter-subject','v11-filter-status','filter-concept','search'];
const nodes=Object.fromEntries(ids.map(id=>[id,new El('div')]));
nodes['page-records'].formgrid=new El('div','formgrid');
nodes['wrong007-filter-subject'].value='';
nodes['v11-filter-status'].value='all';
nodes['filter-concept'].value='';
nodes.search.value='';
const $=id=>nodes[id]||null;
const fn=new Function('deps',[
 'const records=deps.rows,make=deps.make,$=deps.$;',
 'const date=x=>String(x),cname=x=>x||"—",wrong007SubjectName=x=>x,',
 ' wrong008ObservedCheckCount=r=>r.checkHistory.length;',
 'let route="records",v218Mode="parent";',
 'let renderRecords=()=>list("records-list",records,"없음");',
 'let v218ApplyMode=mode=>{v218Mode=mode;return mode};',
 time,cal,listing,filter,
 'return {render:()=>renderRecords(),mode:m=>v218ApplyMode(m),filter:wrongDevP17Select};'
].join('\n'))({rows,make,$});
const stage=id=>{const button=nodes['records-list'].children.find(x=>x.dataset.record===id);
 assert.ok(button,'original record not found '+id);
 return button.children.find(x=>x.dataset.recordStage===id)?.textContent||''};
const visible=()=>nodes['records-list'].children.filter(x=>x.dataset.record&&!x.classList.contains('hide')).map(x=>x.dataset.record);
fn.render();
assert.deepEqual(visible(),rows.map(x=>x.id));
pass('all filter preserves six saved cards and existing stage content');
assert.match(stage('valid'),/이번 재풀이 부모 확인 전/);
assert.match(stage('valid'),/별도 부모 관찰 이력: 도움 필요/);
pass('valid current pending plus earlier parent observation both visible');
for(const id of ['future','invalid','malformed']){
 assert.match(stage(id),/재풀이 시각 확인 필요/);
 assert.match(stage(id),/부모 확인 전 필터에서는 제외/);
}
pass('future, impossible Gregorian date, malformed timestamp give explicit stage guidance');
fn.filter.value='pending';fn.filter.onchange();
assert.deepEqual(visible(),['valid']);
pass('P17 pending filter excludes all three anomalous timestamps exactly as stage states');
assert.match(nodes['records-count'].textContent,/부모 상태 필터 1건/);
pass('filtered parent count matches actually actionable cards');
fn.filter.value='manual';fn.filter.onchange();
assert.deepEqual(visible(),['manual']);
assert.match(stage('manual'),/수동 메모\(알림·예약·완료 아님\)/);
pass('manual note filter composes with unchanged step and no automatic notification');
fn.mode('child');assert.deepEqual(visible(),rows.map(r=>r.id));
assert.match(nodes['page-records'].formgrid.beforeNode.className,/v218-parent-only/);
pass('child view bypasses parent-only P17 filter');
fn.mode('parent');assert.deepEqual(visible(),['manual']);
fn.filter.value='all';fn.filter.onchange();
assert.deepEqual(visible(),rows.map(r=>r.id));
pass('return to parent preserves selection and all restores cards');
assert.match(stage('reviewed'),/이번 재풀이의 부모 확인 기록 있음/);
pass('verified reviewed retry remains stage 3, not affected by stricter pending');
assert.equal(JSON.stringify(rows),saved);
assert.doesNotMatch(listing+filter,/v20SaveMistakeGuarded|indexedDB\.open|fetch\(|localStorage\.setItem/);
pass('original records and photo data unmodified; selection is read-only');
console.log('WRONG_QA64_NODE_RESULT='+JSON.stringify({status:'PASS',checks:passCount,
 kind:'Node actual list + P17 filter + timestamp validator synthetic DOM',writes:0,realFamilies:0,
 safeToRestore:false,deployed:false}));
