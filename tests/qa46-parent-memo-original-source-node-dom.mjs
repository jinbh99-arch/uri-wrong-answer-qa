// QA46 ONLY: execute actual saved-parent-memo source & parent queue/detail
// functions in synthetic Node DOM. No old-suite replay, real family or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function slice(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'missing actual source '+start);
 return html.slice(a,b);
}
const queueSource=slice('function wrongParentLatestObservation(r){','function groupCount(){');
const timeSource=slice('function wrongParentTimeIssue(raw,nowMs=Date.now()){','function wrongParentTimeIssueEntries(');
const detailSource=slice('  // QA46: parent-only guarded navigation','  // WRONG-A-ONLY-INAPP-BACK:');
const historySource=slice('function v230HistoryPanel(parent,r){','// QA11: read-only concept mini-map');
const manual=c=>c?.status==='not_checked'&&typeof c.memo==='string'&&c.memo.startsWith('다음 확인 메모:')?'2099-12-31':null;
let count=0;const pass=s=>{count++;console.log('PASS WRONG QA46 '+s)};
class Node{
 constructor(tag,cls='',text=''){
  this.tag=tag;this.className=cls||'';this.textContent=String(text??'');
  this.id='';this.type='';this.tabIndex=0;this.open=false;
  this.dataset={};this.children=[];this.attrs={};
  this.classList={contains:v=>this.className.split(' ').includes(v),add:v=>this.className+=' '+v};
 }
 append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x)}}
 replaceChildren(...xs){this.children=[];this.append(...xs)}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(){}
 scrollIntoView(){this.scrolled=(this.scrolled||0)+1}
 focus(){this.focused=(this.focused||0)+1}
 after(node){this.afterButtons=(this.afterButtons||[]).concat([node])}
 closest(tag){return tag==='details'?this.closestDetails||null:null}
}
const make=(tag,css,text)=>new Node(tag,css,text);
const now=Date.now(),at=ms=>new Date(now+ms).toISOString(),day=86400000;
const base={id:'A',problemText:'수학 오답',checkHistory:[
 {at:at(-4*day),status:'needs_help',memo:'답을 비교하는 모습을 관찰'},
 {at:at(-3*day),status:'needs_help',memo:'그림을 그리다가 멈춤'}],
 generalRetryHistory:[]};
const backup=JSON.stringify(base);
const queueRecords=[
 base,
 {id:'B',problemText:'국어 오답',checkHistory:[{at:at(-day),status:'needs_help',memo:'아이에게 왜 그렇게 읽었니?'}]},
 {id:'C',problemText:'과학 오답',checkHistory:[{at:at(-day),status:'needs_help',memo:''}]}
];
function queueFixture(records=queueRecords,mode='parent'){
 const root=make('root'),overview=make('div'),card=make('div');
 overview.id='home-observation';card.id='home-observation-card';root.append(overview,card);
 function get(parent,id){if(parent.id===id)return parent;for(const child of parent.children){const x=get(child,id);if(x)return x}return null}
 const $=id=>get(root,id);
 const document={createTextNode:text=>make('text',null,text)};
 const api=new Function('records','make','$','document','wrong008ManualDate','mode',
  'let route="home",detailId=null,v218Mode=mode;let navigated=null;'+
  timeSource+'\n'+queueSource+
  '\nconst navigate=next=>{navigated=next;route=next};'+
  '\nreturn {render:renderObservationSummary,memo:wrongParentLastSavedMemoSource,'+
  'question:wrongParentLastSavedQuestionSource,getPending:()=>wrongParentMemoJumpPending,'+
  'getNavigated:()=>navigated,setMode:v=>{v218Mode=v}};'
 )(records,make,$,document,manual,mode);
 return {...api,$,root};
}
const q=queueFixture();
assert.deepEqual({...q.memo(base,now)},{
 type:'check',index:1,memo:'그림을 그리다가 멈춤',time:Date.parse(base.checkHistory[1].at)});
pass('exact latest valid checkHistory memo and index, no question inference');
assert.equal(q.memo({...base,checkHistory:[...base.checkHistory,
 {at:at(-day),status:'not_checked',memo:'다음 확인 메모: 2099-12-31 · 부모 질문: 언제?'}]},now).index,1);
pass('planned future-check note excluded');
assert.equal(q.memo({...base,checkHistory:[...base.checkHistory,
 {at:at(10000),status:'needs_help',memo:'미래 날짜 메모'},
 {at:'not-date',status:'needs_help',memo:'잘못된 시각 메모'}]},now).index,1);
pass('invalid and future parent timestamps excluded');
assert.equal(q.memo({...base,checkHistory:[],
 generalRetryHistory:[{at:at(-day),review:'needs_help',parentNote:'부모가 들은 설명'}]},now),null);
pass('child retry date not borrowed for absent parent reviewedAt');
const retry={...base,generalRetryHistory:[
 {at:at(-2000),review:'needs_help',reviewedAt:at(-5000),parentNote:'재풀이할 때 관찰함'}]};
assert.equal(q.memo(retry,now).type,'retry');
assert.equal(q.memo(retry,now).index,0);
pass('real reviewedAt selects precise parent-retry memo');
q.render();
const queue=q.$('wrong-parent-needs-help-queue');
const memoButtons=queue.children.filter(x=>x.dataset.memoSource);
const questionButtons=queue.children.filter(x=>x.dataset.questionSource);
assert.deepEqual(memoButtons.map(x=>x.dataset.memoSource),['A']);
assert.deepEqual(questionButtons.map(x=>x.dataset.questionSource),['B']);
pass('memo jump only on item without saved question; missing memo no action');
memoButtons[0].onclick();
assert.deepEqual(q.getPending(),{id:'A',type:'check',index:1,memo:'그림을 그리다가 멈춤'});
assert.equal(q.getNavigated(),'detail');
pass('click keeps exact saved original ID/type/index/text for detail');
const child=queueFixture(queueRecords,'child');child.render();
child.$('wrong-parent-needs-help-queue').children.find(x=>x.dataset.memoSource==='A').onclick();
assert.equal(child.getPending(),null);
pass('child view click cannot activate parent jump');
// Run actual detail wrapper with synthetic original history, including focus and return.
function detailFixture({mode='parent',route='detail',id='A',current=base,
 pending={id:'A',type:'check',index:1,memo:'그림을 그리다가 멈춤'},rowsCount=2,
 source=q.memo(base,now),question=false}={}){
 const rows=Array.from({length:rowsCount},()=>make('div','tagline'));
 const container={children:rows}, notices=[],returned=[];
 const $=key=>{
  if(key==='check-history')return container;
  if(key==='wrong-parent-time-check-1')return rows.find(x=>x.id===key);
  return null;
 };
 const api=new Function('make','$','current','memoSource','question','notices','returned','mode','routeValue','idValue','pendingValue',
  'let v218Mode=mode,route=routeValue,detailId=idValue,wrongParentMemoJumpPending=pendingValue;'+
  'const records=[current],notify=text=>notices.push(text);'+
  'const wrongParentLastSavedMemoSource=()=>memoSource;'+
  'const wrongParentLastSavedQuestionSource=()=>question?{question:"?"}:null;'+
  'const wrongParentQuestionReturnToQueue=x=>returned.push(x);'+
  'let renderDetail=async()=>{};'+detailSource+
  '\nreturn {render:()=>renderDetail(),getPending:()=>wrongParentMemoJumpPending};'
 )(make,$,current,source,question,notices,returned,mode,route,id,pending);
 return {api,rows,notices,returned};
}
const detail=detailFixture();await detail.api.render();
assert.equal(detail.rows[0].id,'wrong-parent-time-check-1');
assert.equal(detail.rows[0].focused,1);
assert.equal(detail.rows[0].scrolled,1);
assert.ok(detail.rows[0].afterButtons?.[0]?.className.includes('v218-parent-only'));
detail.rows[0].afterButtons[0].onclick();assert.deepEqual(detail.returned,['A']);
pass('exact reverse original check row focused and return action remains parent-only');
const stale=detailFixture({source:{...q.memo(base,now),memo:'changed'}});await stale.api.render();
assert.equal(stale.rows[0].afterButtons,undefined);assert.ok(stale.notices.some(x=>x.includes('달라졌')));
pass('changed stored memo blocks stale original link');
const childDetail=detailFixture({mode:'child'});await childDetail.api.render();
assert.equal(childDetail.rows[0].afterButtons,undefined);
pass('child detail cannot expose original memo jump');
const wrongId=detailFixture({id:'B'});await wrongId.api.render();
assert.equal(wrongId.rows[0].afterButtons,undefined);
pass('mismatched record ID cannot jump');
const wrongRows=detailFixture({rowsCount:1});await wrongRows.api.render();
assert.ok(wrongRows.notices.some(x=>x.includes('표시하지 못했습니다')));
pass('unlocatable target fails closed without navigating another record');
const newlyQuestion=detailFixture({question:true});await newlyQuestion.api.render();
assert.equal(newlyQuestion.rows[0].afterButtons,undefined);
pass('new question supersedes stale no-question memo link');
// Actual retry history renderer must include only selected old retry and show
// parentNote only in parent-only read-only DOM, without changing saved arrays.
const attempts=Array.from({length:10},(_,i)=>({at:at(-10*day+i*day),answer:'답'+i,review:'needs_help',
 reviewedAt:at(-10*day+i*day),parentNote:'저장된 관찰 '+i}));
const selected={id:'R',generalRetryHistory:attempts},historyBefore=JSON.stringify(selected);
const pendingRetry={id:'R',type:'retry',index:0,memo:'저장된 관찰 0'};
const history=new Function('make','wrongParentTimeIssue','wrongParentQuestionJumpPending',
 'wrongParentMemoJumpPending','v230ExplanationCompare','date',
 historySource+'\nreturn v230HistoryPanel;'
 )(make,()=>null,null,pendingRetry,()=>{},x=>x);
const panel=make('div');history(panel,selected);
const details=panel.children.find(x=>x.tag==='details');
assert.ok(details);
const old=details.children.find(x=>x.id==='wrong-parent-time-retry-0');
assert.ok(old,'older saved retry must become visible for exact jump');
assert.ok(old.children.some(x=>x.textContent==='저장된 부모 관찰 메모: 저장된 관찰 0'&&
 x.className.includes('v218-parent-only')));
assert.equal(JSON.stringify(selected),historyBefore);
pass('older saved retry note is displayed read-only and original bytes unchanged');
assert.equal(JSON.stringify(base),backup);
assert.doesNotMatch(detailSource,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(|deleteDatabase/);
assert.doesNotMatch(queueSource.slice(queueSource.indexOf('function wrongParentLastSavedMemoSource')),/localStorage\.setItem|indexedDB\.open|fetch\(/);
pass('original records unchanged, new navigation has no storage/network writes');
console.log('WRONG_QA46_RESULT='+JSON.stringify({status:'PASS',checks:count,syntheticNodeDOM:true,
 realChromium:false,realChildren:0,writeCalls:0,safeToRestore:false,deployed:false}));
