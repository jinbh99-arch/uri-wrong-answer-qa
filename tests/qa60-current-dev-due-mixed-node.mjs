// WRONG QA60: new regression from CURRENT dev, validating calendar-sensitive
// parent CTA against legacy malformed dates and mixed saved records.
// Actual source extraction, Node 22 synthetic DOM, no old tests or data writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cut=(a,b)=>{
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'product source missing '+a);return html.slice(i,j);
};
const calendar=cut('function wrongChildValidParentDay(value){','function wrongChildParentDate(r){');
const helper=cut('function wrongDevDueDateReached(value,today=localToday()){','// QA9: offer exactly one next action');
const card=cut('function qa9RenderOneAction(){','const qa9PreviousRenderHome=renderHome;');
assert.match(card,/wrongDevDueDateReached\(r\.studyPlan\?\.dueDate,today\)/);
assert.match(helper,/kind==='due'\?wrongDevDueDateReached\(dueDate\):false/);
let checks=0;const ok=name=>{checks++;console.log('PASS WRONG QA60 '+name)};
const when=(id,day,stamp='2026-03-01T11:00:00Z')=>({
 id,createdAt:stamp,problemText:'가상 복습 문제 '+id,
 studyPlan:day?{dueDate:day}:null,subject:'math',
 generalRetryHistory:[],hasPhoto:false
});
function fixture(rows,today='2026-03-01',mode='parent'){
 const cardNode={classList:{add(){this.hidden=true},remove(){this.hidden=false}}};
 const text={textContent:''},button={dataset:{},textContent:'',onclick:null,
 removeAttribute(n){if(n==='data-record')delete this.dataset.record}};
 const original=JSON.stringify(rows),routes=[],messages=[];
 const elt=id=>({'qa9-next-action':cardNode,'qa9-next-desc':text,'qa9-next-open':button,
   'check-status':{isConnected:true,scrollIntoView(){this.scrolled=true},focus(){this.focused=true}}})[id];
 const obj=new Function('cfg',[
  'const records=cfg.rows,$=cfg.elt,localToday=()=>cfg.today;',
  'const requestAnimationFrame=cb=>cb();',
  'let route="home",v218Mode=cfg.mode,editId=null,detailId=null;',
  'const navigate=v=>{route=v;cfg.routes.push(v)};',
  'const notify=v=>cfg.messages.push(v);',
  calendar,helper,card,
  'return {valid:wrongDevDueDateReached,render:qa9RenderOneAction,',
  ' click:(id,kind)=>wrongDevOpenSavedParentFallback(id,kind),',
  ' state:()=>({route,detailId,editId})}'
 ].join('\n'))({rows,today,mode,elt,routes,messages});
 return {...obj,rows,original,routes,text,button,messages};
}
const t=fixture([]);
assert.equal(t.valid('2024-02-29','2024-02-29'),true);
assert.equal(t.valid('2025-02-29','2025-03-01'),false);
assert.equal(t.valid('2026-02-30','2026-03-01'),false);
assert.equal(t.valid('2026-04-31','2026-05-01'),false);
assert.equal(t.valid('2026-12-32','2027-01-01'),false);
assert.equal(t.valid('2026-03-02','2026-03-01'),false);
assert.equal(t.valid('2026-03-01','2026-03-01'),true);
ok('real Gregorian validator rejects rollover and allows true local due');
const mix=fixture([
 when('invalid','2026-02-30','2026-03-01T12:00:00Z'),
 when('old-valid','2026-02-28','2026-02-20T12:00:00Z'),
 when('future','2026-03-02','2026-03-01T13:00:00Z')
]);
mix.render();assert.equal(mix.button.dataset.record,'old-valid');
assert.match(mix.button.textContent,/복습 기록 열기/);
ok('invalid/future newest records cannot displace older genuinely due record');
await mix.click('old-valid','due');
assert.deepEqual(mix.routes,['detail']);assert.equal(mix.state().detailId,'old-valid');
ok('selected valid record opens its own parent observation detail');
const bad=fixture([when('bad','2026-02-30')]);bad.render();
assert.match(bad.button.textContent,/최근 오답 학습 이어가기/);
assert.equal(bad.button.dataset.record,'bad');
await bad.click('bad','due');assert.equal(bad.routes.length,0);
ok('invalid date alone is ordinary recent record, never due CTA or due click');
const future=fixture([when('future','2026-03-02')]);future.render();
assert.match(future.button.textContent,/최근 오답 학습/);
ok('tomorrow plan never marked due today');
const leap=fixture([when('leap','2028-02-29')],'2028-02-29');leap.render();
assert.match(leap.button.textContent,/복습 기록/);
ok('true leap-year February 29 retained as due');
const race=fixture([when('race','2026-03-01')]);race.render();
assert.match(race.button.textContent,/복습 기록/);
race.rows[0].studyPlan.dueDate='2026-02-30';
await race.click('race','due');assert.deepEqual(race.routes,[]);
assert.match(race.button.textContent,/최근 오답/);
ok('after rendering, modified malformed date fails closed at click');
const photo=fixture([{...when('photo','2026-02-20'),hasPhoto:true,problemText:''}]);
photo.render();assert.match(photo.button.textContent,/사진 기록/);
ok('photo-only existing first-action priority preserved');
const ocr=fixture([{...when('ocr','2026-02-20'),ocrStatus:'browser_ocr_unconfirmed'}]);
ocr.render();assert.match(ocr.button.textContent,/OCR 기록/);
ok('unconfirmed OCR existing priority preserved');
const pending=fixture([{...when('pending','2026-02-20'),
 generalRetryHistory:[{at:'2025-08-01T00:00:00Z',explanation:'가상 아이 설명',review:'not_checked'}]}]);
pending.render();assert.match(pending.button.textContent,/아이 설명 보고/);
ok('genuine child explanation waiting parent observation remains top priority');
const child=fixture([when('child','2026-02-28')],'2026-03-01','child');
await child.click('child','due');assert.deepEqual(child.routes,[]);
ok('child mode cannot invoke parent-only due action');
for(const item of [mix,bad,future,leap,photo,ocr,pending,child])
 assert.equal(JSON.stringify(item.rows),item.original,'records unchanged '+item.button.dataset.record);
assert.doesNotMatch(helper+card,/v20SaveMistakeGuarded|indexedDB\.open|localStorage\.setItem|fetch\(|deleteDatabase/);
ok('actual selection and click guards have no storage or network write');
console.log('WRONG_QA60_RESULT='+JSON.stringify({status:'PASS',checks,
 kind:'Node22 actual source + focused mixed-record regression',
 legacySuiteReruns:0,realFamilies:0,writeCalls:0,safeToRestore:false,deployed:false}));
