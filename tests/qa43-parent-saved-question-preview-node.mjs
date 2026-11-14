// QA43: Run ONLY new parent-saved-question logic from the real index.html.
// Synthetic Node DOM; no browser, IndexedDB, family records or deployments.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const from=html.indexOf('function wrongParentLatestObservation(r){');
const to=html.indexOf('function groupCount(){',from);
assert.ok(from>0&&to>from,'actual parent queue source must be available');
const actual=html.slice(from,to);
const now=Date.now(), day=86400000;
const at=delta=>new Date(now+delta).toISOString();
let checks=0;
const pass=label=>{checks++;console.log('PASS WRONG QA43 '+label)};
class Element{
 constructor(tag,cls='',text=''){
  this.tag=tag;this.className=cls||'';this.textContent=String(text??'');
  this.children=[];this.parentElement=null;this.id='';this.dataset={};
  this.type='';this.checked=false;this.listeners={};this.attrs={};
 }
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,fn){this.listeners[k]=fn}
 focus(){this.focused=true}
}
const make=(tag,css,text)=>new Element(tag,css,text);
function create(records){
 const root=make('section');
 const summary=make('div');summary.id='home-observation';
 const card=make('div');card.id='home-observation-card';
 root.append(summary,card);
 const find=(parent,id)=>{
  if(parent.id===id)return parent;
  for(const c of parent.children){const found=find(c,id);if(found)return found}
  return null;
 };
 const get=id=>find(root,id);
 const doc={createTextNode:text=>new Element('text','',text)};
 const manual=c=>typeof c?.memo==='string'&&c.memo.startsWith('다음 확인 메모:')?'2099-12-31':null;
 const factory=new Function('records','make','$','document','wrong008ManualDate',
  actual+'\nreturn {getQuestion:wrongParentLastSavedQuestion,render:renderObservationSummary};');
 const api=factory(records,make,get,doc,manual);
 return {...api,get,root};
}
const r={id:'r1',createdAt:at(-5*day),problemText:'분수 크기 비교',
 checkHistory:[
  {at:at(-4*day),status:'needs_help',memo:'두 분수가 왜 같을까?',by:'parent_observation'},
  {at:at(-3*day),status:'needs_help',memo:'답을 잘 모르겠다고 표현함',by:'parent_observation'}],
 generalRetryHistory:[]};
const q=create([r]);
assert.equal(q.getQuestion(r,now),'두 분수가 왜 같을까?');
pass('latest genuine question from older observation; newer plain note not invented');
const newer={...r,generalRetryHistory:[
 {at:at(-day),review:'needs_help',reviewedAt:at(-day/2),parentNote:'학부모 질문: 어떻게 계산했는지 말해 볼래?'}]};
assert.equal(q.getQuestion(newer,now),'어떻게 계산했는지 말해 볼래?');
pass('latest actual question across checkHistory and parent-reviewed retries');
const unreviewed={...r,generalRetryHistory:[
 {at:at(-day/10),review:'needs_help',parentNote:'아이 질문: 옮겨야 할까?'}]};
assert.equal(q.getQuestion(unreviewed,now),'두 분수가 왜 같을까?');
pass('child attempt time never substituted for missing parent reviewedAt');
const manual={...r,checkHistory:[
 ...r.checkHistory,
 {at:at(-1000),status:'not_checked',memo:'다음 확인 메모: 2099-12-31 · 학부모 질문: 언제 다시 풀까?'}]};
assert.equal(q.getQuestion(manual,now),'두 분수가 왜 같을까?');
pass('manual planned check question excluded from actual observation');
const bad={...r,checkHistory:[
 ...r.checkHistory,
 {at:at(day),status:'needs_help',memo:'미래의 질문: 어느 수일까?'},
 {at:'날짜없음',status:'needs_help',memo:'질문: 왜 다를까?'}]};
assert.equal(q.getQuestion(bad,now),'두 분수가 왜 같을까?');
pass('future and malformed saved times not presented as latest');
assert.equal(q.getQuestion({...r,checkHistory:[{at:at(-day),status:'needs_help',memo:'집중을 잘함'}]},now),null);
pass('no explicit stored question produces no manufactured prompt');
const labelled={...r,checkHistory:[{at:at(-day),status:'needs_help',memo:'확인 질문: 같은 크기를 그림으로 설명해 보기'}]};
assert.equal(q.getQuestion(labelled,now),'같은 크기를 그림으로 설명해 보기');
pass('explicit saved question label supported even without question mark');
q.render();
const queue=q.get('wrong-parent-needs-help-queue');
assert.ok(queue,'parent queue must render');
const buttons=queue.children.filter(x=>x.tag==='button'&&x.dataset.record);
assert.equal(buttons.length,1);
assert.equal(buttons[0].dataset.record,'r1');
const preview=buttons[0].children.find(x=>x.className.includes('wrong-parent-question-preview'));
assert.ok(preview);
assert.equal(preview.textContent,'마지막 저장된 부모 확인 질문: 두 분수가 왜 같을까?');
assert.ok(preview.className.includes('v218-parent-only'));
pass('actual queue renders parent-only one-line question with original record link');
const plain=create([{id:'r2',problemText:'시각 읽기',checkHistory:[
 {at:at(-day),status:'needs_help',memo:'질문 없이 단어만 기록'}]}]);
plain.render();
const plainQueue=plain.get('wrong-parent-needs-help-queue');
const plainButton=plainQueue.children.find(x=>x.tag==='button'&&x.dataset.record);
const placeholder=plainButton.children.find(x=>x.className.includes('wrong-parent-question-preview'));
assert.equal(placeholder.textContent,'저장된 부모 확인 질문 없음');
pass('missing question visibly labelled rather than inference');
assert.ok(html.includes('.wrong-parent-question-preview{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'));
assert.ok(!/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(/.test(actual));
pass('one-line display and no new save/network path in queue logic');
console.log('WRONG_QA43_RESULT='+JSON.stringify({status:'PASS',checks,syntheticNodeDOM:true,realChromium:false,realChildren:0,writeCalls:0,safeToRestore:false,deployed:false}));
