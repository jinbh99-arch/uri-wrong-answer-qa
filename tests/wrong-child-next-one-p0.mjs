// WRONG child P0 v1.3 focused E2E: child first page -> direct choice -> existing retry/parent observation -> lossless backup.
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
const pass=t=>{checks++;console.log('PASS WRONG_CHILD_NEXT_ONE_P0 '+checks+' '+t)};
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
async function chooseChild(p,id){
 await p.locator('#nav-home').click();
 await p.locator('#v218-child-mode').click();
 const chooser=p.locator('#wrong-child-next-one');
 await chooser.waitFor({state:'visible',timeout:25000});
 const btn=p.locator('#wrong-child-next-list [data-wrong-child-pick="'+id+'"]');
 await btn.click();
 await p.locator('#v230-answer:visible').waitFor({timeout:25000});
 await p.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.equal(await p.locator('#wrong002-state').isVisible(),true);
 assert.equal(await p.locator('#v230-review').isVisible(),false);
}
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#v218-child-mode').click();
 await page.locator('#wrong-child-next-one:visible').waitFor();
 assert.match(await page.locator('#wrong-child-next-list').innerText(),/아직 저장한 문제가 없어요/);
 assert.equal(await page.locator('#wrong-child-next-all').isVisible(),false);
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 pass('390px child first page zero records: honest empty, parent QA9 inaccessible');
 await page.locator('#v218-parent-mode').click();
 const ids={};
 for(const ex of examples)ids[ex.subject]=await add(page,ex);
 const before=await stored(page);
 assert.equal(before.records.length,5);assert.equal(before.photos.length,2);
 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-child-next-list button[data-wrong-child-pick]').count(),3);
 assert.equal(await page.locator('#wrong-child-next-all').isVisible(),true);
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 const displayed=await page.locator('#wrong-child-next-list').innerText();
 assert.match(displayed,/사진만 저장한 문제/);
 assert.match(displayed,/사회/);
 assert.equal(canon(await stored(page)),canon(before),'preview must not save/alter any record');
 pass('5 subject records: neutral 3 previews, photo-only marker, all-list button, no writes');
 await page.locator('#wrong-child-next-list [data-wrong-child-pick="'+ids.social+'"]').click();
 await page.locator('#v230-answer:visible').waitFor({timeout:25000});
 await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',{},{timeout:25000});
 assert.equal(await page.locator('#wrong002-state').isVisible(),true);
 assert.equal(await page.locator('#v230-review').isVisible(),false);
 assert.equal(await page.locator('#detail-image img').count(),1);
 assert.equal(await page.locator('#wrong-nonmath-activities details').count(),3);
 assert.equal(canon(await stored(page)),canon(before),'direct choice is read-only');
 pass('direct one-tap photo-only social -> same stored image + focused existing retry');
 await page.locator('#v230-answer').fill(examples.at(-1).answer);
 await page.locator('#v230-explanation').fill(examples.at(-1).explanation);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 assert.equal(get(await stored(page),ids.social).generalRetryHistory[0].explanation,examples.at(-1).explanation);
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 assert.match(await page.locator('#wrong-p0-child-reason-readonly').innerText(),/범례와 위치/);
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&& !document.querySelector('#v230-review-save')?.disabled,null,{timeout:25000});
 assert.equal(get(await stored(page),ids.social).generalRetryHistory[0].review,'needs_help');
 pass('child answer/direct explanation -> original guardian read-only view and manual observation');
 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 await page.locator('#wrong-child-next-list [data-wrong-child-pick="'+ids.english+'"]').click();
 await page.locator('#v230-answer:visible').waitFor({timeout:25000});
 await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.equal(get(await stored(page),ids.english).generalRetryHistory?.length||0,0);
 assert.equal(await page.locator('#detail-image img').count(),0);
 await page.locator('#v230-answer').fill('나는 축구를 해요');
 await page.locator('#v230-explanation').fill('단어 뜻을 확인했어요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 pass('text-only English preview goes to same retry; no photo dependency, no new records');
 await page.locator('#nav-home').click();
 await page.locator('#wrong-child-next-all').click();
 assert.equal(await page.locator('#page-records').isVisible(),true);
 assert.equal(await page.locator('#wrong007-filter-subject').inputValue(),'');
 assert.equal(await page.locator('#v11-filter-status').inputValue(),'all');
 assert.equal(await page.locator('#records-list button[data-record]').count(),5);
 await page.locator('#records-list button[data-record="'+ids.math+'"]').click();
 await page.locator('#v230-answer:visible').waitFor({timeout:25000});
 assert.equal(await page.locator('#wrong-nonmath-activities').count(),0);
 assert.equal(await page.locator('#v230-answer').isVisible(),true);
 pass('full-list includes all 5 subjects; math pilot unchanged and generic retry accessible');
 const prior=await stored(page);
 await page.locator('#v218-parent-mode').click();
 const bytes=await backup(page),data=JSON.parse(bytes.toString());
 assert.equal(data.records.length,5);assert.equal(Object.keys(data.photos).length,2);
 assert.equal(data.integrity.algorithm,'SHA-256');
 const fctx=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const fresh=await fctx.newPage();fresh.on('pageerror',e=>errors.push(String(e)));
 await fresh.goto(BASE,{waitUntil:'domcontentloaded'});
 await fresh.locator('#nav-settings').click();
 await fresh.locator('#import-file').setInputFiles({name:'wrong-child-next-synthetic-backup.json',mimeType:'application/json',buffer:bytes});
 await fresh.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await fresh.locator('#dlg-ok').click();
 await fresh.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
 assert.equal(canon(await stored(fresh)),canon(prior));
 await fresh.locator('#nav-home').click();
 await fresh.locator('#v218-child-mode').click();
 assert.equal(await fresh.locator('#wrong-child-next-list button[data-wrong-child-pick]').count(),3);
 await fresh.locator('#wrong-child-next-list [data-wrong-child-pick="'+ids.social+'"]').click();
 await fresh.locator('#v230-answer:visible').waitFor({timeout:25000});
 await fresh.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:25000});
 assert.match(await fresh.locator('#wrong002-state').innerText(),/다시 푼 기록 1회/);
 assert.equal(await fresh.locator('#detail-image img').count(),1);
 for(const p of [page,fresh]){
  let widths=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(widths.scroll<=widths.width+2,'overflow: '+JSON.stringify(widths));
 }
 assert.deepEqual(errors,[]);
 pass('fresh 320px browser full JSON+2 photo bytes restored; child shortcut works again');
 console.log('WRONG_CHILD_NEXT_ONE_P0_RESULT='+JSON.stringify({status:'PASS',checks,source:'extracted-ZIP',fiveSubjects:true,preview:3,originalIds:5,photos:2,viewports:[390,320],newSchema:false,automaticDiagnosis:false,realStudentData:0,operatingDeployment:false}));
}catch(e){
 console.error('WRONG_CHILD_NEXT_ONE_P0_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1800)}));
 process.exitCode=1;
}finally{await browser?.close()}
