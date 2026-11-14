// QA45: execute only the new return helper and the real QA44 detail wrapper
// with synthetic DOM targets. No production, old suite replay or record writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('function wrongParentQuestionReturnToQueue(');
const b=html.indexOf('  // WRONG-A-ONLY-INAPP-BACK:',a);
assert.ok(a>=0&&b>a,'real return/helper source missing');
const source=html.slice(a,b);
let checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA45 '+s)};
const record={id:'recordA',checkHistory:[{at:'2026-11-12T12:00:00Z',status:'needs_help',memo:'왜 같을까?'}],generalRetryHistory:[]};
const saved={time:Date.parse(record.checkHistory[0].at),type:'check',index:0,question:'왜 같을까?'};
const copy=JSON.stringify(record);
function build({mode='parent',detailId='recordA',route='detail',queueRecords=['other','recordA'],sourceNow=saved,queueExists=true}={}){
 const targets=[],historyRows=[],buttons={};let current=sourceNow;
 const getRow=(id)=>{
  const row={id:'',tag:'div',tabIndex:0,classList:{contains:c=>c==='tagline'},closest:()=>null,
   scrollIntoView(){this.scrolled=(this.scrolled||0)+1},
   focus(){this.focused=(this.focused||0)+1},
   after(b){this.afterButtons=(this.afterButtons||[]).concat([b])}};
  historyRows.push(row);return row;
 };
 const row=getRow();
 const history={children:historyRows};
 const list=queueRecords.map(id=>({dataset:{record:id},scrollIntoView(){this.scrolled=(this.scrolled||0)+1},focus(){this.focused=(this.focused||0)+1}}));
 const queue={querySelectorAll:()=>list,scrollIntoView(){this.scrolled=(this.scrolled||0)+1},focus(){this.focused=(this.focused||0)+1}};
 const $=id=>id==='check-history'?history:id==='wrong-parent-needs-help-queue'&&queueExists?queue:
  id==='wrong-parent-time-check-0'?row:null;
 const make=(type,cls,text)=>{const b={type,className:cls,textContent:text};targets.push(b);return b};
 const fixture={mode,route,detailId,records:[record],pending:{id:'recordA',...saved},
  $,make,source:()=>current,notify:()=>{}};
 const actual=new Function('p',`
  let v218Mode=p.mode,route=p.route,detailId=p.detailId,
      wrongParentQuestionJumpPending=p.pending;
  const records=p.records,make=p.make,$=p.$,notify=p.notify;
  const navigate=next=>{route=next;};
  const wrongParentLastSavedQuestionSource=p.source;
  let renderDetail=async()=>{};
  ${source}
  return {render:()=>renderDetail(),back:id=>wrongParentQuestionReturnToQueue(id),
   getRoute:()=>route,setMode:v=>{v218Mode=v;},
   setRoute:v=>{route=v;},setId:v=>{detailId=v;},
   setPending:v=>{wrongParentQuestionJumpPending=v;}};
 `)(fixture);
 return {actual,row,queue,list,buttons:targets,record,changeSource:v=>{current=v}};
}
const e=build();await e.actual.render();
const button=e.row.afterButtons?.[0];
assert.ok(button&&button.className.includes('v218-parent-only')&&button.id==='wrong-parent-question-back');
assert.match(button.textContent,/도움 필요 목록으로 돌아가기/);
assert.equal(e.row.focused,1);
pass('source history focused and parent-only return directly after exact row');
button.onclick();
assert.equal(e.actual.getRoute(),'home');
assert.equal(e.list[1].focused,1);
assert.equal(e.list[1].scrolled,1);
assert.equal(e.list[0].focused||0,0);
pass('return rebuilds home and focuses same saved record instead of another');
const missing=build({queueRecords:['other']});await missing.actual.render();missing.row.afterButtons[0].onclick();
assert.equal(missing.actual.getRoute(),'home');
assert.equal(missing.queue.focused,1);
assert.equal(missing.list[0].focused||0,0);
pass('filtered or removed original item focuses queue fallback, never wrong child');
const child=build({mode:'child'});await child.actual.render();assert.equal(child.row.afterButtons,undefined);
pass('child mode cannot render source-return action');
const changedMode=build();await changedMode.actual.render();changedMode.actual.setMode('child');
changedMode.row.afterButtons[0].onclick();
assert.equal(changedMode.actual.getRoute(),'detail');
pass('switch to child mode before click blocks return');
const wrongRoute=build();await wrongRoute.actual.render();wrongRoute.actual.setRoute('records');
wrongRoute.row.afterButtons[0].onclick();
assert.equal(wrongRoute.actual.getRoute(),'records');
pass('stale route blocks return from old source row');
const wrongId=build();await wrongId.actual.render();wrongId.actual.setId('recordB');
wrongId.row.afterButtons[0].onclick();assert.equal(wrongId.actual.getRoute(),'detail');
pass('stale or different record ID blocks return');
const altered=build({sourceNow:{...saved,question:'바뀐 질문?'}});await altered.actual.render();
assert.equal(altered.row.afterButtons,undefined);
pass('source changed while loading prevents stale return control');
const noQueue=build({queueExists:false});await noQueue.actual.render();
noQueue.row.afterButtons[0].onclick();assert.equal(noQueue.actual.getRoute(),'home');
pass('missing queue is safe without focus on another record');
assert.equal(JSON.stringify(record),copy);
assert.doesNotMatch(source,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(|deleteDatabase/);
assert.match(html,/\.wrong-parent-question-back\{display:block;min-height:44px/);
pass('no record or photo write, parent-only keyboard-sized return control');
console.log('WRONG_QA45_RESULT='+JSON.stringify({status:'PASS',checks,syntheticNodeDOM:true,realChromium:false,realChildren:0,writeCalls:0,safeToRestore:false,deployed:false}));
