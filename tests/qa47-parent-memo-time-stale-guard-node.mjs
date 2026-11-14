// WRONG QA47: new narrow regression for QA46's time identity + stale async
// parent-detail navigation. Extracts actual index.html code; no old test replay.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const wrongParentMemoPreviousDetail=renderDetail;');
const end=html.indexOf('// WRONG-A-ONLY-INAPP-BACK:',start);
assert.ok(start>0&&end>start,'QA46 actual detail wrapper must exist');
const implementation=html.slice(start,end);
const set=html.indexOf('wrongParentMemoJumpPending={id:r.id,type:memoSource.type,index:memoSource.index,');
assert.ok(set>0,'queue must capture exact parent memo source');
assert.match(html.slice(set,set+180),/memo:memoSource\.memo,time:memoSource\.time/);
let checks=0;
const pass=name=>{checks++;console.log('PASS WRONG QA47 '+name)};
const original={
 id:'A',checkHistory:[
  {at:'2026-11-12T08:00:00.000Z',status:'needs_help',memo:'어려워함'},
  {at:'2026-11-13T08:00:00.000Z',status:'needs_help',memo:'그림을 그리다가 멈춤'}
 ],generalRetryHistory:[]};
const initialSource={type:'check',index:1,memo:'그림을 그리다가 멈춤',
 time:Date.parse(original.checkHistory[1].at)};
const initialPending={id:'A',...initialSource};
const savedBytes=JSON.stringify(original);
const make=(tag,cls,text)=>({tag,className:cls,textContent:text||'',type:'',id:'',
 after(btn){this.appended=btn}});
function deferred(){
 let resume;const promise=new Promise(resolve=>{resume=resolve});
 return {promise,resume};
}
function fixture({pending=initialPending,source=initialSource,mode='parent',
  detail='A',route='detail',question=false,hold=null}={}){
 const rows=[0,1].map(()=>({id:'',tabIndex:0,classList:{contains:k=>k==='tagline'},
   scrollIntoView(){this.scrolled=true},focus(){this.focused=true},
   closest(){return null},after(btn){this.returnButton=btn}}));
 const loc=id=>id==='check-history'?{children:rows}:rows.find(row=>row.id===id)||null;
 const notices=[],returnIds=[],records=[original];
 const api=new Function('config',
  'let v218Mode=config.mode,route=config.route,detailId=config.detail,'+
  'wrongParentMemoJumpPending=config.pending;'+
  'const records=config.records,$=config.loc,make=config.make,'+
  'notify=s=>config.notices.push(s),'+
  'wrongParentLastSavedMemoSource=()=>config.source,'+
  'wrongParentLastSavedQuestionSource=()=>config.question?{question:"new"}:null,'+
  'wrongParentQuestionReturnToQueue=id=>config.returnIds.push(id);'+
  'let renderDetail=async()=>{if(config.hold)await config.hold.promise};'+
  implementation+
  '\nreturn {render:()=>renderDetail(),getPending:()=>wrongParentMemoJumpPending,'+
  'setMode:v=>{v218Mode=v},setRoute:v=>{route=v},'+
  'setDetail:v=>{detailId=v},setPending:v=>{wrongParentMemoJumpPending=v}};'
 )({mode,route,detail,pending:{...pending},records,loc,make,notices,returnIds,source,question,hold});
 return {api,rows,notices,returnIds};
}
const okay=fixture();await okay.api.render();
assert.equal(okay.rows[0].id,'wrong-parent-time-check-1');
assert.equal(okay.rows[0].focused,true);
assert.ok(okay.rows[0].returnButton?.className.includes('v218-parent-only'));
assert.equal(okay.api.getPending(),null);
pass('unmodified verified memo focuses exact original and consumes request');
const editedTime=fixture({source:{...initialSource,time:initialSource.time-1000}});
await editedTime.api.render();
assert.equal(editedTime.rows[0].focused,undefined);
assert.equal(editedTime.rows[0].returnButton,undefined);
assert.ok(editedTime.notices.some(s=>s.includes('달라졌습니다')));
pass('same memo and index but changed parent timestamp fail closed');
const editedMemo=fixture({source:{...initialSource,memo:'다른 말'}});
await editedMemo.api.render();
assert.equal(editedMemo.rows[0].returnButton,undefined);
pass('changed saved memo remains blocked');
const child=fixture({mode:'child'});await child.api.render();
assert.equal(child.api.getPending(),null);
assert.equal(child.rows[0].returnButton,undefined);
pass('child view clears pending and exposes no parent action');
const hiddenQuestion=fixture({question:true});await hiddenQuestion.api.render();
assert.equal(hiddenQuestion.rows[0].returnButton,undefined);
pass('newly recorded question supersedes old no-question source');
const off=deferred(), offPage=fixture({hold:off});
const offTask=offPage.api.render();offPage.api.setRoute('home');off.resume();await offTask;
assert.equal(offPage.api.getPending(),null);
assert.equal(offPage.rows[0].returnButton,undefined);
pass('navigation to home while awaiting detail clears abandoned request');
const offChild=deferred(), childSwitch=fixture({hold:offChild});
const childTask=childSwitch.api.render();childSwitch.api.setMode('child');offChild.resume();await childTask;
assert.equal(childSwitch.api.getPending(),null);
pass('mode switch while awaiting detail clears abandoned request');
const offId=deferred(), different=fixture({hold:offId});
const otherTask=different.api.render();different.api.setDetail('B');offId.resume();await otherTask;
assert.equal(different.api.getPending(),null);
pass('different active detail ID clears stale pending');
const old=deferred(), crossing=fixture({hold:old,detail:'B',pending:initialPending});
const oldTask=crossing.api.render();
crossing.api.setDetail('A');old.resume();await oldTask;
assert.deepEqual(crossing.api.getPending(),initialPending);
assert.equal(crossing.rows[0].focused,undefined);
pass('older async detail completion cannot consume newer record A request');
const newTask=crossing.api.render();await newTask;
assert.equal(crossing.rows[0].focused,true);
assert.equal(crossing.api.getPending(),null);
pass('newer matching detail still executes after old completion');
const corrupt=fixture({source:null});await corrupt.api.render();
assert.equal(corrupt.rows[0].returnButton,undefined);
pass('missing source fails closed');
assert.equal(JSON.stringify(original),savedBytes);
assert.doesNotMatch(implementation,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(|deleteDatabase/);
pass('actual source introduces no data, photo or network write');
console.log('WRONG_QA47_RESULT='+JSON.stringify({status:'PASS',checks,
 syntheticNodeDOM:true,realChromium:false,realFamilyRecords:0,writeCalls:0,
 safeToRestore:false,deployed:false}));
