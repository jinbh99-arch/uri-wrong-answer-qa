// WRONG QA57 (new scope only): run actual parent fallback helper in Node.
// No real families, photo bytes, old test suite, network, DB or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function wrongDevOpenSavedParentFallback(id,kind){');
const end=html.indexOf('// QA9: offer exactly one next action',start);
assert.ok(start>=0&&end>start,'actual saved parent fallback missing');
const body=html.slice(start,end);
let checks=0;const pass=s=>{checks++;console.log('PASS WRONG QA57 NODE '+s)};
const today=new Date().toISOString().slice(0,10),before=new Date(Date.now()-86400000).toISOString().slice(0,10);
const records=[
 {id:'p',hasPhoto:true,problemText:''},
 {id:'o',hasPhoto:true,problemText:'실제 OCR 확인 전',ocrStatus:'browser_ocr_unconfirmed'},
 {id:'d',hasPhoto:false,problemText:'복습일 예정',studyPlan:{dueDate:before}},
 {id:'n',hasPhoto:false,problemText:'최근 일반 오답'},
 {id:'future',studyPlan:{dueDate:'2099-12-01'}},
 {id:'bad',studyPlan:{dueDate:'2026-99-99'}}
];
const original=JSON.stringify(records);
function fixture(mode='parent',route='home'){
 const elements=Object.fromEntries(['problem','ocr-reviewed','check-status'].map(id=>[id,{
  id,isConnected:true,disabled:false,scrollIntoView(){this.scrolled=true},focus(){this.focused=true}
 }]));
 const logs={nav:[],reselection:0,notices:[]};
 const api=new Function('args',[
  'const records=args.records,$=id=>args.elements[id],localToday=()=>args.today;',
  "let route=args.route,v218Mode=args.mode,editId=null,detailId=null;",
  'const requestAnimationFrame=cb=>cb();',
  'const qa9RenderOneAction=()=>{args.logs.reselection++};',
  'const navigate=p=>{route=p;args.logs.nav.push(p)};',
  'const notify=t=>args.logs.notices.push(t);',
  body,
  'return {run:wrongDevOpenSavedParentFallback,state:()=>({route,editId,detailId}),setMode:v=>{v218Mode=v}};'
 ].join('\n'))({records,elements,logs,mode,route,today});
 return {...api,elements,logs};
}
const photo=fixture();await photo.run('p','photo');
assert.deepEqual(photo.logs.nav,['add']);assert.equal(photo.state().editId,'p');
assert.equal(photo.elements.problem.focused,true);assert.equal(photo.elements.problem.scrolled,true);
pass('photo-only opens same existing record edit and focuses problem field');
const ocr=fixture();await ocr.run('o','ocr');
assert.deepEqual(ocr.logs.nav,['add']);assert.equal(ocr.state().editId,'o');
assert.equal(ocr.elements['ocr-reviewed'].focused,true);
pass('unconfirmed OCR opens same record edit and focuses review checkbox');
const due=fixture();await due.run('d','due');
assert.deepEqual(due.logs.nav,['detail']);assert.equal(due.state().detailId,'d');
assert.equal(due.elements['check-status'].focused,true);
pass('due parent plan opens existing observation selector without writing plan');
const child=fixture('child');await child.run('p','photo');
assert.deepEqual(child.logs.nav,[]);
pass('child view cannot execute parent-only fallback');
const off=fixture('parent','records');await off.run('o','ocr');
assert.deepEqual(off.logs.nav,[]);
pass('not on parent home cannot execute stale CTA');
const invalid=fixture();await invalid.run('n','ocr');
assert.deepEqual(invalid.logs.nav,[]);assert.equal(invalid.logs.reselection,1);
pass('record no longer OCR eligible fails closed and refreshes card');
const missing=fixture();await missing.run('missing','photo');
assert.deepEqual(missing.logs.nav,[]);assert.equal(missing.logs.reselection,1);
pass('deleted record cannot navigate to unrelated entry');
const later=fixture();await later.run('future','due');
assert.deepEqual(later.logs.nav,[]);assert.equal(later.logs.reselection,1);
pass('future plan date never becomes due task');
const malformed=fixture();await malformed.run('bad','due');
assert.deepEqual(malformed.logs.nav,[]);assert.equal(malformed.logs.reselection,1);
pass('malformed plan date never becomes due task');
assert.match(html,/button\.onclick=parentPending\?async event=>/);
assert.match(html,/}:fallbackKind\?event=>\{\s*event\.stopPropagation\(\)/);
pass('existing pending explanation and fallback-specific handlers composed without nested card click');
assert.equal(JSON.stringify(records),original);
assert.doesNotMatch(body,/v20SaveMistakeGuarded|localStorage\.setItem|indexedDB|fetch\(|deleteDatabase|removeMistake/);
pass('original records unchanged, navigation only and no writes');
console.log('WRONG_QA57_NODE_RESULT='+JSON.stringify({status:'PASS',checks,scope:'actual product helper Node execution',
 livePhotos:0,realChromium:false,writeCalls:0,safeToRestore:false,deployed:false}));
