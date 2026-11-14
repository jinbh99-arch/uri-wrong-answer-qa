// WRONG dev P17: actual-source synthetic Node DOM, new scope only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function cut(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'missing real product source '+a);return html.slice(i,j);}
const body=cut('const wrongDevP17Wrap=make(', '// WRONG-A-ONLY-INAPP-BACK:');
const manual=cut('function wrong008ValidDay(value){','function wrong008ObservedCheckCount(r){');
const verify=new Function(manual+'return {wrong008ManualDate}')();
let checks=0;const pass=x=>{checks++;console.log('PASS WRONG DEV P17 '+x)};
class Node{
 constructor(tag,cls='',text=''){
  this.tag=tag;this.className=cls||'';this.textContent=String(text??'');
  this.id='';this.value='';this.dataset={};this.children=[];this.options=[];
  const self=this;
  this.classList={
   add(x){if(!self.className.split(' ').includes(x))self.className+=' '+x},
   remove(x){self.className=self.className.split(' ').filter(v=>v!==x).join(' ')},
   contains(x){return self.className.split(' ').includes(x)},
   toggle(x,on){if(on)this.add(x);else this.remove(x)}
  };
 }
 append(...nodes){for(const x of nodes){this.children.push(x);x.parent=this;
  if(this.tag==='select'&&x.tag==='option'){this.options.push(x);if(this.options.length===1)this.value=x.value;}}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 before(el){this.beforeNode=el}
 querySelector(q){return q==='.formgrid'?this.formgrid:null}
 querySelectorAll(q){assert.equal(q,'[data-record]');return this.children.filter(x=>Object.hasOwn(x.dataset,'record'))}
}
const make=(tag,cls,text)=>new Node(tag,cls,text);
const day=86400000,now=Date.now(),date=o=>new Date(now+o).toISOString();
const retry=(id,{at=date(-day),explanation='그림으로 이유 설명',review='not_checked',subject='math',photo=false,notes=[]}={})=>({
 id,problemText:'문제 '+id,subject,hasPhoto:photo,
 generalRetryHistory:[{at,explanation,review}],checkHistory:notes.map(memo=>({status:'not_checked',memo}))
});
const data=[
 retry('A'),
 retry('B',{subject:'english',photo:true,notes:['다음 확인 메모: 2026-11-18 · 수동']}),
 retry('C',{review:'needs_help',notes:['다음 확인 메모: 2026-02-30 · 오류']}),
 retry('D',{at:date(day)}),
 retry('E',{at:'bad-date',subject:'english'}),
 retry('F',{explanation:'   ',notes:['다음 확인 메모: 2026-12-01 · 수동']})
],preserved=JSON.stringify(data);
function fixture(records=data){
 const page=new Node('section'),grid=new Node('div','formgrid');page.formgrid=grid;
 const list=new Node('div','list'),count=new Node('p');
 const subject=new Node('select'),photo=new Node('select'),
  concept=new Node('select'),search=new Node('input');
 subject.value='';photo.value='all';concept.value='';search.value='';
 const nodes={'page-records':page,'records-list':list,'records-count':count,
  'wrong007-filter-subject':subject,'v11-filter-status':photo,'filter-concept':concept,'search':search};
 const $=id=>nodes[id]||null;
 const renderBase=()=>{
  const visible=records.filter(r=>(!subject.value||r.subject===subject.value)&&
   (photo.value==='all'||(photo.value==='photo_only'?r.hasPhoto:!r.hasPhoto))&&
   (!search.value||r.problemText.includes(search.value)));
  list.replaceChildren(...visible.map(r=>{const e=make('button','item');e.dataset.record=r.id;return e}));
  count.textContent='기존 필터 '+visible.length+'건';
 };
 const fn=new Function('c',[
  'const records=c.records,$=c.$,make=c.make;',
  manual,
  "let route='records',v218Mode='parent',renderRecords=()=>c.renderBase();",
  "let v218ApplyMode=mode=>{v218Mode=mode;return mode};",
  body,
  "return {render:()=>renderRecords(),mode:mode=>v218ApplyMode(mode),filter:wrongDevP17Select};"
 ].join('\n'));
 const api=fn({records,$,make,renderBase});
 return {...api,page,list,count,subject,photo,concept,search,
  visible:()=>list.children.filter(e=>e.dataset.record&&!e.classList.contains('hide')).map(e=>e.dataset.record)};
}
const a=fixture();a.render();
assert.deepEqual(a.visible(),['A','B','C','D','E','F']);
assert.equal(a.page.formgrid.beforeNode.id,'wrong-dev-p17-filter-wrap');
assert.deepEqual(a.filter.options.map(o=>o.value),['all','pending','manual']);
pass('parent-only filter above current list; default entire list');
a.filter.value='pending';a.filter.onchange();
assert.deepEqual(a.visible(),['A','B']);
assert.match(a.count.textContent,/부모 상태 필터 2건/);
pass('actual latest unreviewed explanation only');
for(const id of ['C','D','E','F'])assert.ok(a.list.children.find(x=>x.dataset.record===id).classList.contains('hide'));
pass('reviewed, future, malformed and blank explanation not inferred');
a.filter.value='manual';a.filter.onchange();
assert.deepEqual(a.visible(),['B','F']);
pass('only valid explicit manual follow-up memo selected');
assert.equal(verify.wrong008ManualDate({status:'not_checked',memo:'다음 확인 메모: 2026-02-30'}),null);
pass('original real date validator rejects invalid calendar');
a.subject.value='english';a.subject.onchange();
assert.deepEqual(a.visible(),['B']);
pass('subject and parent filter compose');
a.photo.value='photo_only';a.photo.onchange();
assert.deepEqual(a.visible(),['B']);
pass('photo-only and parent filter compose');
a.search.value='없는';a.search.oninput();
assert.deepEqual(a.visible(),[]);
assert.equal(a.list.children.filter(x=>x.id==='wrong-dev-p17-empty').length,0);
pass('existing no-matches state not doubled');
a.search.value='문제';a.search.oninput();
assert.deepEqual(a.visible(),['B']);
pass('text search reapplies parent filter');
a.mode('child');assert.deepEqual(a.visible(),['B','E']);
assert.match(a.page.formgrid.beforeNode.className,/v218-parent-only/);
pass('child ignores hidden parent filter without leaking parent states');
a.mode('parent');assert.deepEqual(a.visible(),['B']);
pass('returning to parent retains filter only there');
a.filter.value='pending';a.filter.onchange();assert.deepEqual(a.visible(),['B']);
pass('subject/photo/pending combination');
a.subject.value='math';a.photo.value='all';a.subject.onchange();
assert.deepEqual(a.visible(),['A']);
pass('changing subject changes parent filter results');
const empty=fixture([]);empty.filter.value='manual';empty.render();
assert.deepEqual(empty.visible(),[]);assert.equal(empty.list.children.length,0);
pass('no records do not fabricate matches');
const b=fixture();b.render();b.filter.value='manual';b.filter.onchange();
b.filter.value='all';b.filter.onchange();assert.deepEqual(b.visible(),data.map(r=>r.id));
pass('reset to all restores original list');
assert.equal(JSON.stringify(data),preserved);
assert.doesNotMatch(body,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB|fetch\(|deleteDatabase/);
assert.match(html,/body\.v218-child \.v218-parent-only\{display:none!important\}/);
pass('records unchanged; no DB/net writes, child CSS enforced');
console.log('WRONG_DEV_P17_RESULT='+JSON.stringify({status:'PASS',checks,kind:'Node actual-source synthetic DOM',realChromium:false,realChildren:0,writeCalls:0,safeToRestore:false,deployed:false}));
