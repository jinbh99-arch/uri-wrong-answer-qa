// QA57 actual Chromium only for NEW parent photo / OCR / due first actions.
// Isolated localhost synthetic records and tiny fictional 1px photo only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,checks=0;
function pass(msg){checks++;console.log('PASS WRONG QA57 CHROMIUM '+msg)}
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(dbName);
  open.onerror=()=>reject(open.error);
  open.onsuccess=async()=>{
   const db=open.result;
   try{
    const tx=db.transaction(['mistakes','photos'],'readonly');
    const read=req=>new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
    const [rows,keys,photos]=await Promise.all([
     read(tx.objectStore('mistakes').getAll()),
     read(tx.objectStore('photos').getAllKeys()),
     read(tx.objectStore('photos').getAll())]);
    const images=await Promise.all(keys.map(async(id,i)=>({
     id,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))
    })));
    resolve({rows,images});
   }catch(error){reject(error)}finally{db.close()}
  };
 }),DB);
}
async function patchSynthetic(page,id,patch){
 await page.evaluate(({dbName,id,patch})=>new Promise((resolve,reject)=>{
  const opened=indexedDB.open(dbName);
  opened.onerror=()=>reject(opened.error);
  opened.onsuccess=()=>{
   const db=opened.result,tx=db.transaction('mistakes','readwrite');
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve(true)};
   const rows=tx.objectStore('mistakes');
   const read=rows.get(id);
   read.onsuccess=()=>{
    if(!read.result){tx.abort();return}
    rows.put({...read.result,...patch},id);
   };
  };
 }),{dbName:DB,id,patch});
}
async function save(page,{label='',photo=false,subject='science'}={}){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption(subject);
 if(label)await page.locator('#problem').fill(label);
 if(photo){
  await page.locator('#choose-photo').setInputFiles({name:'qa57-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#nav-home').click();
 const ss=await snapshot(page);
 assert.equal(ss.rows.length,1);
 if(photo)assert.equal(ss.images.length,1);
 return {id:ss.rows[0].id};
}
function todayShift(offset){
 const x=new Date(Date.now()+offset*86400000);
 return x.toISOString().slice(0,10);
}
async function scenario(width,kind){
 const context=await browser.newContext({viewport:{width,height:760},acceptDownloads:false});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const title='QA57 가상 '+kind+' 원본 문제 '+width;
 try{
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  const isPhoto=kind==='photo'||kind==='ocr';
  const {id}=await save(page,{label:kind==='photo'?'':title,photo:isPhoto,subject:kind==='due'?'math':'science'});
  if(kind==='ocr')await patchSynthetic(page,id,{ocrStatus:'browser_ocr_unconfirmed'});
  if(kind==='due')await patchSynthetic(page,id,{
   studyPlan:{conceptId:'math.fraction.meaning',method:'explain',dueDate:todayShift(-1),
    note:'가상 복습 후 설명 관찰',createdAt:new Date().toISOString(),
    by:'parent_planned',reviewState:'draft_unapproved'}
  });
  if(kind==='ocr'||kind==='due')await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav-home').click();
  const btn=page.locator('#qa9-next-open');
  await btn.waitFor();
  assert.equal(await btn.getAttribute('data-record'),id);
  if(kind==='photo')assert.match(await btn.textContent(),/사진 기록 이어서 정리하기/);
  if(kind==='ocr')assert.match(await btn.textContent(),/OCR 기록 검토하기/);
  if(kind==='due')assert.match(await btn.textContent(),/복습 기록 열기/);
  if(kind==='recent')assert.match(await btn.textContent(),/최근 오답 학습 이어가기/);
  pass(width+'px '+kind+' first action points to exact existing record');
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  if(kind==='photo'){
   await page.locator('#v218-child-mode').click();
   assert.equal(await btn.isVisible(),false);
   await page.locator('#v218-parent-mode').click();
   assert.equal(await btn.isVisible(),true);
   pass(width+'px parent first action hidden on child view, restored parent-only');
  }
  await btn.click();
  if(kind==='photo'||kind==='ocr'){
   await page.locator('#page-add:visible').waitFor();
   const field=kind==='photo'?'#problem':'#ocr-reviewed';
   await page.waitForFunction(field=>document.activeElement?.id===field.slice(1),field,{timeout:6500});
   const active=await page.evaluate(field=>{
    const el=document.querySelector(field),b=el.getBoundingClientRect();
    return {id:el.id,visible:b.top>=0&&b.bottom<=innerHeight,disabled:Boolean(el.disabled)};
   },field);
   assert.equal(active.visible,true);
   assert.equal(active.disabled,false);
   if(kind==='ocr')assert.match(await page.locator('#ocr-status').textContent(),/아직 확인되지 않았습니다/);
   if(kind==='photo')assert.equal(await page.locator('#problem').inputValue(),'');
   pass(width+'px '+kind+' moves directly to editable original field, in viewport and focused');
  }else{
   await page.locator('#page-detail:visible').waitFor();
   assert.ok((await page.locator('#detail-text').textContent()).includes(title));
   if(kind==='due'){
    await page.waitForFunction(()=>document.activeElement?.id==='check-status',null,{timeout:6500});
    const pos=await page.locator('#check-status').evaluate(el=>{
     const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:innerHeight};
    });
    assert.ok(pos.top>=0&&pos.bottom<=pos.height,'due observation field offscreen');
    pass(width+'px due plan moves to original saved parent observation field, not auto-completing');
   }else pass(width+'px normal recent action still opens same detail through original delegation');
  }
  const after=await snapshot(page);
  assert.deepEqual(after,before,'opening parent action must never mutate IDB records or photos');
  assert.deepEqual(errors,[]);
  pass(width+'px '+kind+' original bytes unchanged, JavaScript errors 0');
 }finally{await context.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  for(const kind of ['photo','ocr','due','recent'])await scenario(width,kind);
 }
 console.log('WRONG_QA57_BROWSER_RESULT='+JSON.stringify({
  status:'PASS',checks,viewports:[320,390],scenarios:['photo','ocr','due','recent'],
  realChromium:true,syntheticLocal:true,realChildren:0,realAuth:false,
  sourceRecordsUnchanged:true,safeToRestore:false,deployed:false
 }));
}catch(e){
 console.error('WRONG_QA57_BROWSER_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1800),
  safeToRestore:false
 }));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
