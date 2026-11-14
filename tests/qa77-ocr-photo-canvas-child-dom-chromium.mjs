// QA77: new synthetic OCR-applied draft/crop-canvas DOM residue after confirmed discard.
// Unlike QA74-76, examine the ADD form and transient photo crop pixel buffer.
// PHASE=baseline confirms the actual regression before a surgical patch;
// PHASE=fixed proves scrub after patch and preserves the saved fake photo bytes.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA77_DEV_SHA,PHASE=process.env.WRONG_QA77_PHASE;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
assert.ok(['baseline','fixed'].includes(PHASE));
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const DB='uriaimath-github-qa-v224-only';
const discarded='QA77 가상 OCR 적용 후 폐기할 사진 문구 7÷3';
const pass=s=>console.log('PASS WRONG QA77 '+s);
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(name);o.onerror=()=>reject(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly'),
    rows=tx.objectStore('mistakes').getAll(),
    ids=tx.objectStore('photos').getAllKeys(),
    blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{const photos=await Promise.all(ids.result.map(async(id,i)=>({
     id,mime:blobs.result[i].type,bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));db.close();resolve({rows:rows.result,photos})}
    catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
let preview,browser;
try{
 const username='qa77-only-synthetic',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},httpCredentials:{username,password},
  acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))external.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));

 // Saved photo fixture, must survive ALL unrelated parent/child draft operations.
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA77 저장할 별도 가상 그림자 사진');
 await page.locator('#take-photo').setInputFiles({name:'qa77-saved-fake.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 const original=await snapshot(page);
 assert.equal(original.rows.length,1);
 assert.equal(original.photos.length,1);
 pass('saved fake photo record and byte-for-byte baseline');

 // A photo-edit screen exposes the old photo ONLY while parent is editing.
 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#v13-old-photo img').count(),1);
 await page.locator('#cancel-edit').click();
 await page.locator('#nav-records').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#v13-old-photo img'));
 pass('photo edit cannot switch to child, existing-photo URL preview is removed on exit');

 // Distinct: an UNSAVED selected photo with a simulated OCR-apply candidate.
 await page.locator('#nav-add').click();
 await page.locator('#take-photo').setInputFiles({name:'qa77-new-unsaved-fake.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.evaluate(value=>{
  const input=document.querySelector('#ocr-preview');
  input.readOnly=false;input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
 },discarded);
 await page.locator('#ocr-apply').click();
 assert.equal(await page.locator('#problem').inputValue(),discarded);
 const before=await page.evaluate(()=>({
  w:document.querySelector('#crop-canvas')?.width||0,
  h:document.querySelector('#crop-canvas')?.height||0
 }));
 assert.ok(before.w>0&&before.h>0,'synthetic crop pixels were not drawn');
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#problem').inputValue(),discarded);
 pass('photo/OCR draft mode switch blocked, parent work remains untouched');

 // The user explicitly confirms DISCARD by leaving the form.
 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').waitFor({timeout:10000});
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 const residue=await page.evaluate(()=>({
  ocrPreview:document.querySelector('#ocr-preview')?.value||'',
  appliedOcr:document.querySelector('#problem')?.value||'',
  cropWidth:document.querySelector('#crop-canvas')?.width||0,
  cropHeight:document.querySelector('#crop-canvas')?.height||0,
  oldPhotoImages:document.querySelectorAll('#v13-old-photo img').length,
  fileCount:document.querySelector('#take-photo')?.files?.length||0,
  visibleDiscarded:document.body.innerText.includes('QA77 가상 OCR 적용 후 폐기할')
 }));
 assert.equal(residue.ocrPreview,'','temporary OCR candidate already cleared by prior resetImage');
 assert.equal(residue.oldPhotoImages,0);
 assert.equal(residue.fileCount,0);
 assert.equal(residue.visibleDiscarded,false);
 if(PHASE==='baseline'){
  assert.ok(residue.appliedOcr===discarded&&residue.cropWidth>0&&residue.cropHeight>0,
   'baseline regression must be reproduced before modifying product');
  console.log('WRONG_QA77_BASELINE='+JSON.stringify({status:'LEAK_REPRODUCED',residue,
   actualChildVisible:false,hiddenDomInputResidue:true,hiddenPhotoCanvasPixelBuffer:true}));
 }else{
  assert.equal(residue.appliedOcr,'','discarded OCR-applied add form still in child DOM');
  assert.equal(residue.cropWidth,0,'discarded crop canvas still retains photo pixels');
  assert.equal(residue.cropHeight,0,'discarded crop canvas still retains photo pixels');
  pass('confirmed discard clears hidden OCR-applied text and photo canvas pixel buffer');
 }
 const after=await snapshot(page);
 assert.deepEqual(after,original,'discard must never change saved fake record or photo bytes');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('saved record/photo, external network, JS errors and 320px overflow unchanged');
 console.log('WRONG_QA77_RESULT='+JSON.stringify({phase:PHASE,status:'PASS',photoBytesPreserved:true,
  storedRecordUnchanged:true,syntheticOnly:true,realChromium:true,
  viewIsNotAuthentication:true,externalStorageIsolationVerified:false,safeToRestore:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA77_RESULT='+JSON.stringify({phase:PHASE,status:'FAIL',
  reason:String(e),stack:String(e?.stack).slice(0,1100),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
