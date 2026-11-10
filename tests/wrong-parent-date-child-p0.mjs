// WRONG v1.4 parent date to child home: narrow synthetic 320/390px E2E on extracted PC ZIP.
 // Synthetic 5 subjects / photo-only / 390 & 320px. No new schema, auth, diagnosis or live services.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const examples=[
 {subject:'math',grade:'3',concept:'math.natural.addition',title:'가상 수학 17+8=?',answer:'25',explanation:'받아올림을 다시 확인했어요.',review:'explained',photo:false},
 {subject:'korean',grade:'2',title:'가상 국어 중심 문장 찾기',answer:'두 번째 문장',explanation:'글에 반복된 말을 찾았어요.',review:'explained',photo:false},
 {subject:'english',grade:'4',title:'가상 영어 I play soccer 뜻',answer:'나는 축구를 해요',explanation:'I 와 play 의 뜻을 찾아봤어요.',review:'needs_help',photo:false},
 {subject:'science',grade:'5',title:'가상 과학 실험 그래프 관찰',answer:'관찰과 예상을 구별했어요',explanation:'그래프를 다시 살펴봤어요.',review:'explained',photo:true},
 {subject:'social',grade:'6',title:'',answer:'그림의 지도 기호를 찾았어요',explanation:'사진의 범례와 위치를 봤어요.',review:'needs_help',photo:true}
];
const canon=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
let browser,checks=0;
const pass=t=>{checks++;console.log('PASS WRONG_PARENT_DATE_CHILD_P0 '+checks+' '+t)};
async function stored(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  const q=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const [records,keys,photos]=await Promise.all([
    q(tx.objectStore('mistakes').getAll()),q(tx.objectStore('photos').getAllKeys()),
    q(tx.objectStore('photos').getAll())]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(keys.map(async(id,i)=>({id,mime:photos[i].type,
     bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
function get(x,id){const row=x.records.find(r=>r.id===id);assert.ok(row,'missing '+id);return row}
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 // Saved photo is asynchronous; do NOT check stale generic controls.
 await p.locator('#wrong002-state:visible').waitFor({timeout:25000});
 await p.locator('#v230-answer:visible').waitFor({timeout:25000});
}
async function add(p,ex){
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption(ex.subject);
 await p.locator('#wrong007-grade').selectOption(ex.grade);
 await p.locator('#problem').fill(ex.title);
 if(ex.concept)await p.locator('#concept').selectOption(ex.concept);
 if(ex.photo){
  await p.locator('#choose-photo').setInputFiles({name:'synthetic-1px.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const state=await stored(p);
 const row=state.records.find(r=>r.problemText===ex.title&&r.subject===ex.subject);
 assert.ok(row);assert.equal(row.subject,ex.subject);assert.ok(row.id.startsWith('m'));
 return row.id;
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:25000}),
   p.locator('#export-json').click()]);
 return readFile(await download.path());
}

async function dayShift(p,by){
 return p.evaluate(delta=>{
  const now=new Date(),shifted=new Date(now.getFullYear(),now.getMonth(),now.getDate()+delta,12);
  return [shifted.getFullYear(),String(shifted.getMonth()+1).padStart(2,'0'),String(shifted.getDate()).padStart(2,'0')].join('-');
 },by);
}
async function injectInvalidSyntheticLegacyDate(p,id){
 await p.evaluate(({dbName,id})=>new Promise((resolve,reject)=>{
  const opening=indexedDB.open(dbName);
  opening.onerror=()=>reject(opening.error);
  opening.onsuccess=()=>{
   const db=opening.result,tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
   const request=store.get(id);
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const row=request.result;
    if(!row){reject(Error('synthetic record not found'));return}
    row.checkHistory=[...(row.checkHistory||[]),{
     at:new Date().toISOString(),status:'not_checked',
     memo:'다음 확인 메모: 2026-02-30 · 학부모 질문: 가상 비공개 정보',by:'parent_observation'}];
    store.put(row);
   };
  };
 }),{dbName:DB,id});
}
async function openDateChild(p,id){
 await p.locator('#nav-home').click();
 await p.locator('#v218-child-mode').click();
 await p.locator('#wrong-child-parent-dates:visible').waitFor({timeout:25000});
 await p.locator('#wrong-child-date-items [data-wrong-child-date-pick="'+id+'"]').click();
 await p.locator('#v230-answer:visible').waitFor({timeout:25000});
 await p.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.equal(await p.locator('#v230-review').isVisible(),false);
}
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-child-parent-dates').isVisible(),false);
 assert.match(await page.locator('#wrong-child-next-list').innerText(),/아직 저장한 문제가 없어요/);
 pass('390px empty child home: no parent dates and existing v1.3 empty guidance');
 await page.locator('#v218-parent-mode').click();
 const ids={};for(const ex of examples)ids[ex.subject]=await add(page,ex);
 const registered=await stored(page);
 assert.equal(registered.records.length,5);assert.equal(registered.photos.length,2);
 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-child-parent-dates').isVisible(),false,'no parent date => original flow');
 assert.equal(await page.locator('#wrong-child-next-list button[data-wrong-child-pick]').count(),3);
 assert.equal(await page.locator('#wrong-child-next-all').isVisible(),true);
 assert.equal(canon(await stored(page)),canon(registered));
 pass('5 subjects but no date: neutral 3 previews and full-list stay unchanged, no reads mutate records');
 await page.locator('#v218-parent-mode').click();
 const mathPast=await dayShift(page,-1),koreanFuture=await dayShift(page,4);
 // Parent: existing math studyPlan dueDate, not a new child-entered date field.
 await detail(page,ids.math);
 await page.locator('#v05-plan-date:visible').fill(mathPast);
 await page.getByRole('button',{name:'복습 계획 저장',exact:true}).click();
 await page.getByText('저장된 계획:',{exact:false}).waitFor({timeout:25000});
 assert.equal(get(await stored(page),ids.math).studyPlan.dueDate,mathPast);
 pass('parent math existing plan saved with past date (not completed by the date)');
 // Parent: existing nonmath manual not_checked memo is offered only after a child retry.
 await detail(page,ids.korean);
 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill('가상 국어 중심 내용을 찾았어요');
 await page.locator('#v230-explanation').fill('지문의 반복된 표현을 봤어요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong008-next-date:visible').fill(koreanFuture);
 const secret='가상 보호자 개인 질문 상세는 아이 홈 노출 금지';
 await page.locator('#wrong008-next-question').fill(secret);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(day=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),koreanFuture,{timeout:25000});
 const afterParent=get(await stored(page),ids.korean);
 assert.equal(afterParent.generalRetryHistory.length,1);
 assert.equal(afterParent.checkHistory.length,1);
 assert.equal(afterParent.checkHistory[0].status,'not_checked');
 assert.match(afterParent.checkHistory[0].memo,/다음 확인 메모:/);
 assert.ok(afterParent.checkHistory[0].memo.includes(secret));
 assert.equal(afterParent.generalRetryHistory[0].review,'not_checked');
 pass('parent Korean manual next-check saved separately as not_checked; no false observation');
 // The old backup schema allows literal manual memos. Synthetically seed one
 // malformed calendar day in English to check the child date panel excludes it.
 await injectInvalidSyntheticLegacyDate(page,ids.english);
 await page.reload({waitUntil:'domcontentloaded'});
 const beforeChoice=await stored(page);
 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 const dates=page.locator('#wrong-child-parent-dates');
 await dates.waitFor({state:'visible',timeout:25000});
 assert.equal(await dates.locator('[data-wrong-child-date-pick]').count(),2);
 assert.equal(await page.locator('#wrong-child-next-list [data-wrong-child-pick]').count(),3,'recent3 not replaced');
 assert.equal(await page.locator('#wrong-child-next-all').isVisible(),true);
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 assert.equal(await dates.locator('[data-wrong-child-date-pick="'+ids.math+'"]').count(),1);
 assert.equal(await dates.locator('[data-wrong-child-date-pick="'+ids.korean+'"]').count(),1);
 const label=await dates.innerText();
 assert.match(label,/부모님이 적어 둔 다음 확인 희망일/);
 assert.ok(label.includes(mathPast)&&label.includes(koreanFuture));
 assert.ok(!label.includes(secret),'parent private question must never be shown on child home');
 assert.ok(!label.includes('확인 완료로 기록'),'expired date cannot pretend to be observed');
 assert.equal(canon(await stored(page)),canon(beforeChoice),'render date references must be read-only');
 assert.equal(await dates.locator('[data-wrong-child-date-pick="'+ids.english+'"]').count(),0,
  'English invalid legacy 2026-02-30 note must not render as a valid day');
 pass('child home shows exactly 2 parent-saved dates and hides private text, missing/invalid dates; no auto completion');
 // Old math record is not in the latest three; date jump must still select its original ID.
 await dates.locator('[data-wrong-child-date-pick="'+ids.math+'"]').click();
 await page.locator('#v230-answer:visible').waitFor({timeout:25000});
 await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.equal(await page.locator('#wrong-nonmath-activities').count(),0,'math pilot stays math');
 assert.equal(await page.locator('#v230-review').isVisible(),false);
 assert.equal(canon(await stored(page)),canon(beforeChoice),'clicking a date does not save anything');
 await page.locator('#v230-answer').fill('25');
 await page.locator('#v230-explanation').fill('십의 자리 받아올림을 확인했어요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor({timeout:25000});
 assert.match(await page.locator('#wrong-p0-child-reason-readonly').innerText(),/받아올림/);
 await page.locator('#v230-review').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='explained'&&!document.querySelector('#v230-review-save')?.disabled,null,{timeout:25000});
 const math=get(await stored(page),ids.math);
 assert.equal(math.generalRetryHistory.at(-1).review,'explained');
 assert.equal(math.studyPlan.dueDate,mathPast,'expired plan cannot be rewritten automatically');
 pass('past math parent date -> original retry and guardian observation, existing plan unchanged');
 await openDateChild(page,ids.korean);
 assert.equal(await page.locator('#wrong-nonmath-activities details').count(),3);
 assert.match(await page.locator('#wrong002-state').innerText(),/다시 푼 기록 1회/);
 await page.locator('#v230-answer').fill('가상 국어 다시 푼 답');
 await page.locator('#v230-explanation').fill('지문에서 다른 단서도 찾았어요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 2회'),null,{timeout:25000});
 const korean=get(await stored(page),ids.korean);
 assert.equal(korean.generalRetryHistory.length,2);
 assert.equal(korean.checkHistory.length,1,'date memo retained, not mistaken for parent check');
 assert.equal(korean.checkHistory[0].status,'not_checked');
 pass('Korean date -> existing 3 activity cards and second child retry, no memo completion');
 await page.locator('#nav-home').click();
 assert.equal(await page.locator('#wrong-child-next-list button[data-wrong-child-pick]').count(),3);
 await page.locator('#wrong-child-next-list [data-wrong-child-pick="'+ids.social+'"]').click();
 await page.locator('#v230-answer:visible').waitFor({timeout:25000});
 await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.equal(await page.locator('#detail-image img').count(),1,'photo-only undated preview remains working');
 assert.equal(get(await stored(page),ids.social).generalRetryHistory.length,0);
 pass('undated photo-only social stays selectable via unchanged recent3 and existing saved photo');
 const pre=await stored(page);
 assert.deepEqual(pre.photos,registered.photos,'photo bytes stay unchanged');
 await page.locator('#v218-parent-mode').click();
 const bytes=await backup(page),data=JSON.parse(bytes.toString('utf8'));
 assert.equal(data.records.length,5);
 assert.equal(Object.keys(data.photos).length,2);
 assert.equal(data.integrity.algorithm,'SHA-256');
 const freshContext=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const fresh=await freshContext.newPage();fresh.on('pageerror',e=>errors.push(String(e)));
 await fresh.goto(BASE,{waitUntil:'domcontentloaded'});
 await fresh.locator('#nav-settings').click();
 await fresh.locator('#import-file').setInputFiles({name:'wrong-parent-date-v14-synthetic.json',mimeType:'application/json',buffer:bytes});
 await fresh.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await fresh.locator('#dlg-ok').click();
 await fresh.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
 assert.equal(canon(await stored(fresh)),canon(pre),'5 IDs, both photo bytes, math plan and manual note must survive');
 await fresh.locator('#nav-home').click();
 await fresh.locator('#v218-child-mode').click();
 await fresh.locator('#wrong-child-parent-dates:visible').waitFor({timeout:25000});
 assert.equal(await fresh.locator('#wrong-child-date-items [data-wrong-child-date-pick]').count(),2);
 assert.ok(!(await fresh.locator('#wrong-child-parent-dates').innerText()).includes(secret));
 await fresh.locator('#wrong-child-date-items [data-wrong-child-date-pick="'+ids.korean+'"]').click();
 await fresh.locator('#v230-answer:visible').waitFor({timeout:25000});
 await fresh.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.match(await fresh.locator('#wrong002-state').innerText(),/다시 푼 기록 2회/);
 for(const p of [page,fresh]){
  const w=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(w.scroll<=w.width+2,'horizontal overflow: '+JSON.stringify(w));
 }
 assert.deepEqual(errors,[]);
 pass('full JSON+photo SHA256 restore in clean 320px browser preserves dates and child direct jump; no JS errors');
 console.log('WRONG_PARENT_DATE_CHILD_P0_RESULT='+JSON.stringify({
  status:'PASS',checks,source:'extracted-PC-ZIP',viewports:[390,320],subjects:5,datedRecords:2,
  originalRecords:5,photoBytesPreserved:2,emptyDatesUnchanged:true,invalidDatesIgnored:true,
  sensitiveMemoHidden:true,pastDateAutoCompletion:false,newSchema:false,autoDiagnosis:false,
  realStudentData:0,productionDeployment:false}));
}catch(e){
 console.error('WRONG_PARENT_DATE_CHILD_P0_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,2000)}));
 process.exitCode=1;
}finally{await browser?.close()}
