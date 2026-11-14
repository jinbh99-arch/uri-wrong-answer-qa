// QA52: validate ONLY P15/16 dev-adapted compact parent stage in actual list().
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function list(container,items,empty){');
const end=html.indexOf('function renderHome(){',start);
assert.ok(start>0&&end>start,'actual list function not located');
const source=html.slice(start,end);
let checks=0;
const pass=m=>{checks++;console.log('PASS WRONG DEV QA52 '+m)};
class El{
 constructor(type,cls,text){this.type=type;this.className=cls||'';this.textContent=String(text??'');this.children=[];this.dataset={};this.attributes={};}
 append(...v){this.children.push(...v)}
 replaceChildren(...v){this.children=[];this.append(...v)}
}
const make=(kind,cls,txt)=>new El(kind,cls,txt);
const boxes={'records-list':new El('section'),'home-recent':new El('section')};
const $=id=>boxes[id];
const date=x=>String(x||'');
const manual=x=>x?.status==='not_checked'&&typeof x.memo==='string'&&x.memo.startsWith('다음 확인 메모:')?'2026-11-19':null;
const fn=new Function('make','$','date','wrong007SubjectName','cname','wrong008ObservedCheckCount','wrong008ManualDate',
 source+'\nreturn list;');
const list=fn(make,$,date,x=>x||'수학',x=>x||'미분류',r=>r.checkHistory?.length||0,manual);
const row=(id,history=[],checks=[])=>({id,problemText:'문항 '+id,createdAt:'2026-11-14T00:00:00Z',
 subject:'math',gradeAtEntry:3,conceptId:'math.fraction',hasPhoto:false,generalRetryHistory:history,checkHistory:checks});
const data=[
 row('a'),
 row('b',[{at:'2026-11-14T00:01:00Z',answer:'2',review:'not_checked'}]),
 row('c',[{at:'2026-11-14T00:02:00Z',answer:'2',review:'not_checked',explanation:'그림으로 답을 설명'}]),
 row('d',[{at:'2026-11-14T00:03:00Z',review:'needs_help',explanation:'그림을 설명'}]),
 row('e',[{at:'2026-11-14T00:04:00Z',review:'other',explanation:'왜인지 설명'}]),
 row('f',[],[{at:'2026-11-14T00:05:00Z',status:'not_checked',memo:'다음 확인 메모: 2026-11-19 · 수동'}])
];
const original=JSON.stringify(data);
list('records-list',data,'비었음');
const rows=boxes['records-list'].children;
assert.equal(rows.length,6);
for(const el of rows)assert.ok(el.dataset.record);
const labels=rows.map(x=>x.children.find(y=>y.dataset.recordStage)?.textContent);
assert.ok(labels[0].includes('① 아이 재풀이 기록 전'));pass('no retry remains unreviewed and not judged');
assert.ok(labels[1].includes('재풀이 기록 · 아이 설명 없음'));pass('retry without explanation not invented');
assert.ok(labels[2].includes('아이 설명 기록 · 부모 관찰 전'));pass('unreviewed saved child explanation in parent stage');
assert.ok(labels[3].includes('부모 관찰 기록 있음'));pass('saved parent review displayed without mastery claim');
assert.ok(labels[4].includes('저장된 부모 확인 상태 검토 필요'));pass('unsupported status shown as check required');
assert.ok(labels[5].includes('다음 확인 2026-11-19 수동 메모(알림·예약·완료 아님)'));pass('manual date not confused with scheduled notification');
assert.ok(rows.every(r=>r.children.some(x=>x.className.includes('v218-parent-only'))));
pass('every stage is parent-only presentation markup, no child leak');
assert.ok(rows.every(r=>r.children.find(x=>x.className==='details')),'previous records metadata preserved');
pass('original list title/date/subject/metadata retained');
list('home-recent',data.slice(0,2),'비었음');
assert.ok(boxes['home-recent'].children.every(x=>!x.children.some(y=>y.dataset.recordStage)));
pass('home recent list remains unchanged without parent stage');
list('records-list',[],'기록 없음');
assert.equal(boxes['records-list'].children.length,1);
assert.equal(boxes['records-list'].children[0].textContent,'기록 없음');
pass('existing empty state preserved');
assert.equal(JSON.stringify(data),original);
assert.doesNotMatch(source,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB\.open|fetch\(|deleteDatabase/);
assert.match(html,/body\.v218-child \.v218-parent-only\{display:none!important\}/);
assert.match(html,/@media\(max-width:390px\)\{\.wrong-dev-record-stage/);
pass('original records never mutated, no write/network, child CSS and mobile style');
console.log('WRONG_DEV_QA52_RESULT='+JSON.stringify({status:'PASS',checks,type:'Node synthetic DOM actual list',realChromium:false,realChildren:0,writeCalls:0,safeToRestore:false,deployed:false}));
