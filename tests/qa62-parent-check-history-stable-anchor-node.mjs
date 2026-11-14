// WRONG QA62: source-extracted checkHistory rows: original indexes, extra
// display rows, memo/manual dates and no writes. Node 22 only (new scope).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function renderHistory(){');
const end=html.indexOf('renderHistory();',start);
assert.ok(start>=0&&end>start,'actual renderHistory source unavailable');
const source=html.slice(start,end+'renderHistory();'.length);
assert.ok(source.includes("box.id='wrong-parent-time-check-'+(entries.length-1-j)"));
assert.doesNotMatch(html,/if\(checkRows\.length===checks\.length\)/);
assert.doesNotMatch(html,/if\(rows\.length===count\)/);
let checks=0;
const pass=t=>{checks++;console.log('PASS WRONG QA62 NODE '+t)};
class Element{
 constructor(tag,cls='',str=''){
  this.tag=tag;this.className=cls||'';this.textContent=String(str??'');
  this.children=[];this.id='';this.tabIndex=0;this.parent=null;
  this.classList={contains:v=>this.className.split(' ').includes(v),
   add:v=>{if(!this.classList.contains(v))this.className+=' '+v}};
 }
 append(...kids){for(const kid of kids){kid.parent=this;this.children.push(kid)}}
 replaceChildren(...kids){this.children=[];this.append(...kids)}
}
const make=(tag,cls,txt)=>new Element(tag,cls,txt);
const date=x=>String(x);
const manual=x=>typeof x?.memo==='string'&&x.memo.startsWith('다음 확인 메모:')?'2026-11-30':null;
const rows=[
 {at:'2026-11-10T08:00:00.000Z',status:'needs_help',memo:'일부 구별이 어려웠다'},
 {at:'2026-11-11T08:00:00.000Z',status:'not_checked',memo:'다음 확인 메모: 2026-11-30 · 수동'},
 {at:'2026-11-12T08:00:00.000Z',status:'needs_help',memo:'왜 그렇게 생각했나요?'},
 {at:'2026-11-13T08:00:00.000Z',status:'explained',memo:'아이 설명을 관찰함'}
];
function render(data=rows){
 const original=JSON.stringify(data);
 const history=new Element('div','list');
 const fn=new Function('r','$','make','date','wrong008ManualDate',source);
 fn({checkHistory:data},()=>history,make,date,manual);
 return {history,original,data};
}
const a=render();
assert.equal(a.history.children.length,4);
assert.deepEqual(a.history.children.map(x=>x.id),[
 'wrong-parent-time-check-3','wrong-parent-time-check-2',
 'wrong-parent-time-check-1','wrong-parent-time-check-0']);
pass('original chronological indexes on reverse rendered saved rows');
for(const item of a.history.children){
 assert.equal(item.tabIndex,-1);
 assert.ok(item.classList.contains('wrong-parent-time-history-row'));
}
pass('every saved row independently receives a focusable anchor');
assert.match(a.history.children[2].children[0].textContent,/수동 메모/);
assert.ok(a.history.children[2].children[1].textContent.includes('다음 확인 메모'));
pass('manual follow-up memo still remains in original numbered history');
assert.ok(a.history.children[1].children[1].textContent.includes('왜 그렇게 생각했나요?'));
pass('exact saved question retains its source row');
const decorative=make('div','tagline','UI-only note, not saved');
a.history.children.unshift(decorative);
assert.notEqual(a.history.children.filter(n=>n.classList.contains('tagline')).length,rows.length);
assert.equal(a.history.children.find(n=>n.id==='wrong-parent-time-check-2')?.children[1]?.textContent,rows[2].memo);
pass('count mismatch with extra tagline cannot erase or shift original source anchors');
const extra=make('p','small','Screen-only hint');a.history.children.unshift(extra);
assert.equal(a.history.children.find(n=>n.id==='wrong-parent-time-check-0')?.children[1]?.textContent,rows[0].memo);
pass('any added nonhistory display row leaves exact old memo anchor untouched');
assert.equal(a.history.children.filter(n=>n.id.startsWith('wrong-parent-time-check-')).length,rows.length);
assert.equal(new Set(a.history.children.map(n=>n.id).filter(Boolean)).size,rows.length);
pass('no duplicate original IDs even when extra rows appear');
const noMemo=render([{at:'bad',status:'not_checked',memo:''}]);
assert.equal(noMemo.history.children[0].id,'wrong-parent-time-check-0');
pass('missing memo or invalid timestamp does not silently change index');
const empty=render([]);
assert.equal(empty.history.children.length,1);
assert.equal(empty.history.children[0].id,'');
assert.match(empty.history.children[0].textContent,/아직 확인 기록이 없습니다/);
pass('empty state remains unlinked and intact');
assert.equal(JSON.stringify(a.data),a.original);
assert.doesNotMatch(source,/indexedDB|localStorage\.setItem|fetch\(|v20SaveMistakeGuarded|deleteDatabase/);
pass('no original observation/photo mutation or storage/network writes');
assert.match(html,/const target=\$\('wrong-parent-time-'\+source\.type\+'-'\+source\.index\)/);
assert.match(html,/const target=\$\('wrong-parent-time-'\+issue\.type\+'-'\+issue\.index\)/);
pass('memo/question/timestamp jumps share saved original index-based ID lookup');

const headerStart=html.indexOf('const wrongAOnlyNavigateBase=navigate;');
const headerEnd=html.indexOf('// QA56 P18/P19:',headerStart);
assert.ok(headerStart>0&&headerEnd>headerStart,'original detail-header navigation wrapper missing');
const header=html.slice(headerStart,headerEnd);
function sourceHeaderFrames({question=null,memo=null,mode='parent',detailId='one'}={}){
 const frames=[],history=[];
 const get=new Function('p',[
  'let navigate=next=>{p.history.push(next);return next};',
  'const wrongParentQuestionJumpPending=p.question,wrongParentMemoJumpPending=p.memo;',
  'let detailId=p.detailId,v218Mode=p.mode,route="detail";',
  'const requestAnimationFrame=cb=>p.frames.push(cb);',
  'const $=()=>null;',
  header,
  'return navigate;'
 ].join('\n'))({frames,history,question,memo,mode,detailId});
 get('detail');
 return {frames,history};
}
assert.equal(sourceHeaderFrames({question:{id:'one'}}).frames.length,0);
assert.equal(sourceHeaderFrames({memo:{id:'one'}}).frames.length,0);
pass('saved question or memo source navigation never schedules competing detail-header focus');
assert.equal(sourceHeaderFrames().frames.length,1);
assert.equal(sourceHeaderFrames({memo:{id:'another'}}).frames.length,1);
pass('ordinary detail and unrelated pending source retain original header accessibility behavior');

console.log('WRONG_QA62_NODE_RESULT='+JSON.stringify({
 status:'PASS',checks,kind:'Node22 source-extracted DOM, extra display-row mismatch and source IDs',
 realChildren:0,writes:0,safeToRestore:false,deployed:false}));
