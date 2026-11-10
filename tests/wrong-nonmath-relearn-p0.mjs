// WRONG Nonmath relearning P0: five-subject real browser regression derived from validated P0: one real 390px parent -> 320px child explanation/retry -> parent observation -> backup+restore.
// Synthetic records/photos only; no real guardian auth, production, network uploads or AI grading.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const examples=[
 {subject:'math',grade:'3',concept:'math.natural.addition',title:'가상 수학 17+8=?',answer:'25',explanation:'처음엔 올림을 빠뜨렸어요. 다시 자리값을 확인했어요.',review:'explained',photo:false},
 {subject:'korean',grade:'2',title:'가상 국어 글의 중심 문장은?',answer:'반복해서 나온 문장이에요',explanation:'반복된 말을 글에서 찾아 근거로 설명했어요.',review:'explained',photo:false},
 {subject:'english',grade:'4',title:'가상 영어 I play soccer의 뜻은?',answer:'나는 축구를 해요',explanation:'I와 play를 나누어 단어 뜻을 다시 확인했어요.',review:'needs_help',photo:false},
 {subject:'science',grade:'5',title:'가상 과학 실험 그림과 결과 해석',answer:'관찰한 사실과 예상을 구별했어요',explanation:'처음에는 예상과 실제 관찰을 섞어서 답했어요.',review:'explained',photo:true},
 {subject:'social',grade:'6',title:'가상 사회 지도에서 위치 찾기',answer:'지도 범례를 보고 찾았어요',explanation:'지도에 표시된 기호와 범례를 다시 확인했어요.',review:'needs_help',photo:true}
];
const canon=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
let browser,checks=0;
const pass=t=>{checks++;console.log('PASS WRONG_NONMATH_RELEARN_P0 '+checks+' '+t)};
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
 const row=state.records.find(r=>r.problemText===ex.title);
 assert.ok(row);assert.equal(row.subject,ex.subject);assert.ok(row.id.startsWith('m'));
 return row.id;
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:25000}),
   p.locator('#export-json').click()]);
 return readFile(await download.path());
}
try{
 browser=await chromium.launch({headless:true});
 const parentContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const parent=await parentContext.newPage(),errors=[];
 parent.on('pageerror',err=>errors.push(String(err)));
 await parent.goto(BASE,{waitUntil:'domcontentloaded'});
 const ids={};
 for(const ex of examples)ids[ex.subject]=await add(parent,ex);
 const registered=await stored(parent);
 assert.equal(registered.records.length,5);assert.equal(registered.photos.length,2);
 pass('390px parent creates all five subjects; nonmath four include two synthetic photos');
 
 for(const ex of examples){
  const id=ids[ex.subject];
  await detail(parent,id);
  // Each nonmath subject must show three optional, expand/click learning actions.
  if(ex.subject!=='math'){
   const panel=parent.locator('#wrong-nonmath-activities');
   await panel.waitFor({state:'visible',timeout:25000});
   assert.equal(await panel.locator('details').count(),3);
   assert.equal(await panel.locator('details[data-subject="'+ex.subject+'"]').count(),3);
   const help=await panel.innerText();
   assert.match(help,/일반적인 다시 생각하기 예시/);
   assert.match(help,ex.photo?/저장된 문제 사진을 위에서/:/문제 글을 다시/);
   await panel.locator('details[data-card="1"] summary').click();
   assert.equal(await panel.locator('details[data-card="1"]').getAttribute('open'),'');
   await panel.locator('details[data-card="1"] button[data-wrong-nonmath-use="1"]').click();
   assert.match(await parent.locator('#wrong-nonmath-selected').innerText(),/선택한 활동:/);
   assert.equal(await parent.locator('#v230-answer').inputValue(),'');
   assert.equal(await parent.locator('#v230-explanation').inputValue(),'');
  }else{
   assert.equal(await parent.locator('#wrong-nonmath-activities').count(),0,'math demo must not be changed');
  }
  assert.match(await parent.locator('label[for="v230-explanation"]').innerText(),/왜 틀렸고/);
  assert.match(await parent.locator('#v230-explanation').getAttribute('placeholder'),/처음에는/);
  await parent.locator('#v218-child-mode').click();
  assert.equal(await parent.locator('#v230-review').isVisible(),false,'child mode cannot expose parent review');
  await parent.locator('#wrong002-retry').click();
  await parent.locator('#v230-answer').fill(ex.answer);
  await parent.locator('#v230-explanation').fill(ex.explanation);
  await parent.locator('#v230-save').click();
  await parent.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
  const childSaved=get(await stored(parent),id);
  assert.equal(childSaved.generalRetryHistory.length,1);
  assert.equal(childSaved.generalRetryHistory[0].answer,ex.answer);
  assert.equal(childSaved.generalRetryHistory[0].explanation,ex.explanation);
  assert.equal(childSaved.generalRetryHistory[0].review,'not_checked');
  assert.equal(childSaved.id,id);assert.equal(childSaved.hasPhoto,ex.photo);
  await parent.locator('#v218-parent-mode').click();
  await parent.locator('#wrong-p0-child-reason-readonly:visible').waitFor({timeout:25000});
  assert.match(await parent.locator('#wrong-p0-child-reason-readonly').innerText(),new RegExp(ex.explanation.slice(0,13)));
  await parent.locator('#v230-review').selectOption(ex.review);
  await parent.locator('#v230-review-save').click();
  await parent.waitForFunction(()=>{
   const s=document.querySelector('#v230-review');
   return s&&s.value!=='not_checked'&&!document.querySelector('#v230-review-save')?.disabled;
  },null,{timeout:25000});
  const observed=get(await stored(parent),id);
  assert.equal(observed.generalRetryHistory.length,1);
  assert.equal(observed.generalRetryHistory[0].explanation,ex.explanation);
  assert.equal(observed.generalRetryHistory[0].review,ex.review);
  assert.ok(observed.generalRetryHistory[0].reviewedAt);
  assert.equal(observed.checkHistory.length,0,'parent general review does not forge independent observations');
  pass(ex.subject+': activity cards (if nonmath), child answer/reason and guardian observed explanation saved');
 }
 const after=await stored(parent);
 assert.deepEqual(after.photos,registered.photos);
 for(const ex of examples){
  const r=get(after,ids[ex.subject]);
  assert.equal(r.id,get(registered,ids[ex.subject]).id);
  assert.equal(r.subject,ex.subject);
 }
 pass('all original record IDs/photo byte arrays and generic retry histories remain unchanged by view switching');
 // Optional means optional. No new field or new API/DB contract.
 await detail(parent,ids.science);
 await parent.locator('#v230-answer').fill('물이 얼면 얼음이에요');
 await parent.locator('#v230-explanation').fill('');
 await parent.locator('#v230-save').click();
 await parent.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 2회'),null,{timeout:25000});
 assert.equal(get(await stored(parent),ids.science).generalRetryHistory.at(-1).explanation,'');
 await parent.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 assert.match(await parent.locator('#wrong-p0-child-reason-readonly').innerText(),/설명은 아직 기록되지/);
 pass('blank optional why explanation still saves retry; guardian sees no fabricated rationale');
 const pre=await stored(parent);
 const bytes=await backup(parent),data=JSON.parse(bytes.toString('utf8'));
 assert.equal(data.records.length,5);assert.equal(Object.keys(data.photos).length,2);
 assert.equal(data.photosOmitted,0);assert.equal(data.integrity.algorithm,'SHA-256');
 assert.ok(data.records.find(r=>r.id===ids.science).generalRetryHistory.length===2);
 const freshContext=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const fresh=await freshContext.newPage();fresh.on('pageerror',err=>errors.push(String(err)));
 await fresh.goto(BASE,{waitUntil:'domcontentloaded'});
 await fresh.locator('#nav-settings').click();
 await fresh.locator('#import-file').setInputFiles({name:'wrong-nonmath-synthetic-backup.json',mimeType:'application/json',buffer:bytes});
 await fresh.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await fresh.locator('#dlg-ok').click();
 await fresh.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
 assert.equal(canon(await stored(fresh)),canon(pre),'entire IDB records + photo bytes must survive restore');
 await detail(fresh,ids.korean);
 assert.match(await fresh.locator('#wrong-p0-child-reason-readonly').innerText(),/반복된 말을 글에서 찾아/);
 assert.equal(await fresh.locator('#v230-review').inputValue(),'explained');
 for(const p of [parent,fresh]){
  const res=await p.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(res.scroll<=res.inner+2,'horizontal overflow '+JSON.stringify(res));
 }
 assert.deepEqual(errors,[]);
 pass('full SHA256 JSON backup and fresh 320px restore preserve all 5 IDs, photos and explanations/guardian reviews');
 console.log('WRONG_NONMATH_RELEARN_P0_RESULT='+JSON.stringify({status:'PASS',checks,subjects:['math','korean','english','science','social'],
  viewports:[390,320],originalIdsPreserved:5,photoBytesPreserved:2,
  childWrittenExplanationPerSubject:true,parentObservedExplanationPerSubject:true,
  optionalEmptyAllowed:true,originalRecordSchemaChanged:false,
  realChildren:0,realFamilyLogins:0,operatingDeployment:false,liveCloud:false}));
}catch(e){
 console.error('WRONG_NONMATH_RELEARN_P0_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1900)}));
 process.exitCode=1;
}finally{await browser?.close()}
