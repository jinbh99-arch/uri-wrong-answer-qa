// WRONG dev QA51: execute the ACTUAL existing parent one-action card code.
// New scope plus regressions for previous photo/OCR/due/recent actions only.
// Synthetic DOM, no old suite, no real family/photo, no writes or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function qa9RenderOneAction(){');
const end=html.indexOf('const qa9PreviousRenderHome=renderHome;',start);
assert.ok(start>0&&end>start,'actual QA9 source absent');
const source=html.slice(start,end);
let passed=0;
const pass=label=>{passed++;console.log('PASS WRONG DEV QA51 '+label)};
const now=Date.now(),day=86400000,at=o=>new Date(now+o).toISOString();
const question=(id,offset,review='not_checked',explanation='왜 같은 크기인지 설명함')=>
 ({id,problemText:'오답 '+id,createdAt:at(-3*day),
  generalRetryHistory:[{at:at(offset),review,explanation}]});
function makeRows(rows){
 const snapshot=JSON.stringify(rows);
 const card={classList:{hidden:true,add(v){if(v==='hide')this.hidden=true},
  remove(v){if(v==='hide')this.hidden=false}}};
 const desc={textContent:''},button={textContent:'',dataset:{},removeAttribute(x){
  if(x==='data-record')delete this.dataset.record;
 }};
 const elements={'qa9-next-action':card,'qa9-next-desc':desc,'qa9-next-open':button};
 const fn=new Function('records','$','localToday',source+'\nreturn qa9RenderOneAction;');
 const render=fn(rows,id=>elements[id],()=>new Date().toISOString().slice(0,10));
 return {render,card,desc,button,rows,snapshot};
}
const old=question('old',-3*day), newest=question('new',-day);
newest.createdAt=at(-20*day);
const list=makeRows([old,newest]);list.render();
assert.equal(list.button.dataset.record,'new');
assert.match(list.button.textContent,/아이 설명 보고 부모가 관찰하기/);
assert.match(list.desc.textContent,/부모가 아직 확인하지 않은/);
assert.equal(list.card.classList.hidden,false);
pass('newest valid child explanation awaiting parent review is first action');
const photo={id:'photo',hasPhoto:true,problemText:'',createdAt:at(-100)};
const priority=makeRows([photo,old]);priority.render();
assert.equal(priority.button.dataset.record,'old');
pass('genuine unreviewed explanation outranks photo-only task without another CTA');
const reviewed=makeRows([question('reviewed',-day,'explained'),photo]);reviewed.render();
assert.equal(reviewed.button.dataset.record,'photo');
assert.match(reviewed.button.textContent,/사진 기록/);
pass('already reviewed child explanation excluded, existing photo fallback preserved');
const noWords=makeRows([question('blank',-day,'not_checked','   '),photo]);
noWords.render();assert.equal(noWords.button.dataset.record,'photo');
pass('no actual child explanatory sentence means no inferred parent action');
const future=makeRows([question('future',day),photo]);future.render();
assert.equal(future.button.dataset.record,'photo');
pass('future retry timestamp never prioritized');
const corrupt=question('bad',-day);corrupt.generalRetryHistory[0].at='not-a-date';
const bad=makeRows([corrupt,photo]);bad.render();assert.equal(bad.button.dataset.record,'photo');
pass('malformed retry timestamp never prioritized');
const other={id:'other',problemText:'오답',createdAt:at(-day)};
const ocr={id:'ocr',problemText:'OCR 문장',ocrStatus:'browser_ocr_unconfirmed',createdAt:at(-2*day)};
const ocrCase=makeRows([ocr,other]);ocrCase.render();
assert.equal(ocrCase.button.dataset.record,'ocr');
assert.match(ocrCase.button.textContent,/OCR 기록 검토/);
pass('previous OCR follow-up priority is unchanged');
const due={id:'due',problemText:'복습',createdAt:at(-5*day),
 studyPlan:{dueDate:new Date(now-day).toISOString().slice(0,10)}};
const dueCase=makeRows([due,other]);dueCase.render();
assert.equal(dueCase.button.dataset.record,'due');
assert.match(dueCase.button.textContent,/복습 기록 열기/);
pass('previous due-study-plan priority is unchanged');
const recent=makeRows([other,{...other,id:'other2',createdAt:at(-2*day)}]);
recent.render();assert.equal(recent.button.dataset.record,'other');
assert.match(recent.button.textContent,/최근 오답 학습/);
pass('previous most recent record fallback is unchanged');
const empty=makeRows([]);empty.button.dataset.record='stale';empty.render();
assert.equal(empty.card.classList.hidden,true);
assert.equal(empty.button.dataset.record,undefined);
pass('no saved record hides card and clears stale record link');
assert.ok(html.includes('id="qa9-next-open"'));
assert.ok(html.includes('class="card v218-parent-only hide" id="qa9-next-action"'));
assert.match(html,/const r=e\.target\.closest\('\[data-record\]'\);if\(r\)\{detailId=r\.dataset\.record;navigate\('detail'\)/);
pass('reuses existing parent-only first action and original data-record detail navigation');
for(const f of [list,priority,reviewed,noWords,future,bad,ocrCase,dueCase,recent,empty])
 assert.equal(JSON.stringify(f.rows),f.snapshot,'original child explanations and photos unchanged');
assert.doesNotMatch(source,/v20SaveMistakeGuarded|indexedDB|localStorage\.setItem|fetch\(|deleteDatabase/);
assert.equal((html.match(/id="qa9-next-action"/g)||[]).length,1);
pass('no storage or network writes, duplicate first-action UI absent');
console.log('WRONG_DEV_QA51_RESULT='+JSON.stringify({status:'PASS',checks:passed,
 type:'Node synthetic DOM, actual source',realChromium:false,realChildren:0,
 writes:0,deployed:false,safeToRestore:false}));
