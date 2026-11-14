// QA78 NEW race: asynchronous synthetic OCR recognition completes after a parent
// discards a photo-edit draft / switches to child, or after replacing its image.
// This is not the QA77 discarded-draft regression replay: only late callbacks.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA78_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const DB='uriaimath-github-qa-v224-only';
const lateAfterChild='QA78 지연 OCR 부모 메모 · 폐기된 사진의 비공개 문장';
const lateAfterSwap='QA78 예전 사진 지연 OCR 결과 · 새 사진에 섞이면 안 됨';
const lateReject='QA78 이전 OCR 오류에 포함된 가상 부모 문구';
const checks=[];
const pass=s=>{checks.push(s);console.log('PASS WRONG QA78 '+s)};
async function photoAndRows(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const keys=tx.objectStore('photos').getAllKeys();
   const blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{const photos=await Promise.all(keys.result.map(async(id,i)=>({
     id,type:blobs.result[i].type,
     bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));db.close();resolve({rows:rows.result,photos})}
    catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
let preview,browser;
try{
 const username='qa78-synthetic-only',password=randomBytes(25).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outbound=[];
 page.on('pageerror',err=>errors.push(String(err)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('blob:')&&!u.startsWith('data:'))outbound.push(u);
  return route.abort();
 });
 // Fake Tesseract installed BEFORE app boot; no OCR script, training model or network.
 // Each recognize promise resolves ONLY when this test releases it from Playwright.
 await page.addInitScript(()=>{
  const q={pending:[],started:0,terminated:0,created:0};
  q.release=text=>{const next=q.pending.shift();if(!next)throw Error('OCR worker not pending');next.resolve({data:{text}})};
  q.fail=message=>{const next=q.pending.shift();if(!next)throw Error('OCR worker not pending');next.reject(Error(message))};
  window.__qa78=q;
  window.Tesseract={createWorker:async(...args)=>{
   q.created++;const logger=args[2]?.logger;
   return {
    recognize:async()=>{q.started++;logger?.({status:'synthetic OCR pending',progress:0.5});
      return new Promise((resolve,reject)=>q.pending.push({resolve,reject}));},
    terminate:async()=>{q.terminated++}
   };
  }};
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 assert.equal(await page.evaluate(()=>typeof window.Tesseract.createWorker),'function');

 // Keep one independently saved original photo to verify byte-level non-mutation.
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA78 별도 저장된 가상 사진 오답');
 await page.locator('#take-photo').setInputFiles({name:'qa78-original.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 const baseline=await photoAndRows(page);
 assert.equal(baseline.rows.length,1);
 assert.equal(baseline.photos.length,1);
 pass('original fake photo and mistake baseline exists');

 // RACE A: parent starts OCR for a replacement photo, then discards unsaved edit.
 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor({timeout:15000});
 await page.locator('#take-photo').setInputFiles({name:'qa78-replacement.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#ocr-run').click();
 await page.locator('#dlg-ok').click(); // fictional consent: Tesseract mocked, no external request
 await page.waitForFunction(()=>window.__qa78.started===1,{timeout:15000});
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#v13-old-photo img').count(),1);
 pass('pending OCR cannot bypass parent photo-edit draft protection');

 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click(); // explicitly confirm discard, not an implicit loss
 await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 await page.evaluate(x=>window.__qa78.release(x),lateAfterChild);
 await page.waitForFunction(()=>window.__qa78.terminated===1);
 let child=await page.evaluate(text=>({
  visible:document.body.innerText.includes(text),
  inDOM:document.body.textContent.includes(text),
  input:document.querySelector('#ocr-preview').value.includes(text)||
   document.querySelector('#problem').value.includes(text),
  cropPixels:document.querySelector('#crop-canvas').width*
   document.querySelector('#crop-canvas').height
 }),lateAfterChild);
 assert.deepEqual(child,{visible:false,inDOM:false,input:false,cropPixels:0},
  'late OCR after confirmed discard re-injected hidden parent information');
 pass('late successful OCR response after child switch cannot repopulate DOM/input/canvas');

 // RACE B: a fresh photo replaces the photo while the old recognition is pending.
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-add').click();
 await page.locator('#take-photo').setInputFiles({name:'qa78-old.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#ocr-run').click();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>window.__qa78.started===2);
 await page.locator('#choose-photo').setInputFiles({name:'qa78-new.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.evaluate(x=>window.__qa78.release(x),lateAfterSwap);
 await page.waitForFunction(()=>window.__qa78.terminated===2);
 assert.equal(await page.locator('#ocr-preview').inputValue(),'');
 assert.equal(await page.locator('#problem').inputValue(),'');
 assert.ok(!(await page.evaluate(x=>document.body.textContent.includes(x),lateAfterSwap)));
 pass('old OCR response after new photo selection cannot mix previous photo text');

 // RACE C: rejection from an OCR worker arrives after parent discards a draft.
 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click();
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-add').click();
 await page.locator('#take-photo').setInputFiles({name:'qa78-reject.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#ocr-run').click();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>window.__qa78.started===3);
 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click();
 await page.locator('#v218-child-mode').click();
 await page.evaluate(x=>window.__qa78.fail(x),lateReject);
 await page.waitForFunction(()=>window.__qa78.terminated===3);
 assert.ok(!(await page.evaluate(x=>document.body.textContent.includes(x),lateReject)));
 assert.equal(await page.locator('#ocr-preview').inputValue(),'');
 assert.equal(await page.locator('#problem').inputValue(),'');
 assert.equal(await page.evaluate(()=>document.querySelector('#crop-canvas').width),0);
 pass('late OCR error after child switch cannot write parent-only hidden error text');

 const final=await photoAndRows(page);
 assert.deepEqual(final,baseline,'race handlers must never rewrite saved photo bytes/records');
 assert.deepEqual(errors,[],'browser JS exceptions');
 assert.deepEqual(outbound,[],'external network blocked and not attempted');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323,'320px horizontal overflow');
 pass('stored records/photo byte-identical, no JS error/outbound/overflow');
 console.log('WRONG_QA78_RESULT='+JSON.stringify({status:'PASS',checks,
  devSha:SHA,realChromium:true,viewport:320,syntheticWorker:true,syntheticPhoto:true,
  lateSuccessAfterChildBlocked:true,lateOldPhotoResultBlocked:true,
  lateRejectAfterChildBlocked:true,productChangeRequired:false,
  operationalIsolationVerified:false,viewModeAuthentication:false,safeToRestore:false}));
 await ctx.close();
}catch(error){
 console.error('WRONG_QA78_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(error),stack:String(error?.stack).slice(0,1200),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
