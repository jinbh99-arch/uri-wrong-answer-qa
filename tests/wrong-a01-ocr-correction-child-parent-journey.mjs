// WRONG A-01: a NEW single-record real-app integration:
// synthetic photo -> mock OCR -> user corrects OCR text -> explicit parent review
// -> local IndexedDB saved record -> child free-answer/explanation -> parent observation.
// Deliberately excludes existing QA78/84 late-callback races, QA92 zoom, backup/restore.
// No actual child/parent identity, real OCR model, third-party network or deployment.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_A01_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/,'actual pinned dev SHA required');
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const OCR_FAKE='A01 합성 OCR 오인식: 낮에 그림지가 생기는 까닭?';
const CORRECTED='A01 부모가 실제 입력하여 고친 가상 문제: 낮에 그림자가 생기는 까닭은?';
const MEMO='A01 보호자만 보는 비공개 메모 — 아이 DOM에 없어야 함';
const ANSWER='A01 아이 가상 재풀이: 빛을 물체가 가려서 그림자가 생겨요';
const REASON='A01 아이 스스로 쓴 가상 설명: 빛이 닿지 않는 곳이 생깁니다';
const OUT='qa-proof/wrong-a01';mkdirSync(OUT,{recursive:true});
let browser,preview,checks=0,screens=0;
const errors=[],outside=[];
const pass=msg=>{checks++;console.log('WRONG_A01_PASS '+checks+' '+msg)};
async function shot(page,title){
 const file=OUT+'/'+String(++screens).padStart(2,'0')+'-'+title+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled'});
 console.log('WRONG_A01_SCREENSHOT='+file);
}
async function ledger(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,t=db.transaction(['mistakes','photos'],'readonly');
   const rows=t.objectStore('mistakes').getAll();
   const keys=t.objectStore('photos').getAllKeys();
   const pics=t.objectStore('photos').getAll();
   t.onerror=()=>{db.close();reject(t.error)};
   t.oncomplete=async()=>{
    try{
     const images=await Promise.all(keys.result.map(async(id,i)=>({
      id,mime:pics.result[i].type,
      bytes:Array.from(new Uint8Array(await pics.result[i].arrayBuffer()))
     })));
     db.close();resolve({rows:rows.result,photos:images})
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
try{
 const username='qa-a01-synthetic-only',password=randomBytes(25).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>{
  const u=r.url();if(!u.startsWith(preview.url)&&!u.startsWith('data:')&&!u.startsWith('blob:'))
   outside.push(u);
 });
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))outside.push(u);
  return route.abort();
 });
 // Stub only the OCR engine. Actual application's photo picker, OCR action,
 // user correction/review, IndexedDB, child retry and parent review remain real.
 await page.addInitScript(text=>{
  window.__a01={reads:0,terminations:0};
  window.Tesseract={createWorker:async()=>({
   recognize:async()=>{window.__a01.reads++;return {data:{text}}},
   terminate:async()=>{window.__a01.terminations++}
  })};
 },OCR_FAKE);
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(SHA));
 const initial=await ledger(page);
 assert.equal(initial.rows.length,0);assert.equal(initial.photos.length,0);
 pass('pinned SHA, Basic auth localhost and clean ephemeral fake store');

 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#memo').fill(MEMO);
 await page.locator('#student-answer').fill('A01 아이의 처음 가상 오답: 빛이 없는 밤에만');
 await page.locator('#take-photo').setInputFiles({name:'a01-synthetic-one-pixel.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 assert.equal(await page.locator('#ocr-run').isEnabled(),true);
 await page.locator('#ocr-run').click();
 await page.locator('#dlg-ok').click(); // this is synthetic consent, no external OCR assets
 await page.waitForFunction(()=>window.__a01.reads===1 && document.querySelector('#ocr-preview')?.value.includes('그림지'),null,{timeout:15000});
 assert.equal(await page.locator('#ocr-preview').isEditable(),true);
 assert.equal(await page.locator('#ocr-preview').inputValue(),OCR_FAKE);
 assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
 pass('real photo picker + fake OCR result, never silently marked reviewed');
 await shot(page,'01-original-ocr-unreviewed-320');

 await page.locator('#ocr-preview').fill(CORRECTED);
 await page.locator('#ocr-replace').click();
 assert.equal(await page.locator('#problem').inputValue(),CORRECTED);
 assert.equal(await page.locator('#ocr-reviewed').isChecked(),false,
  'editing OCR should never grant automatic parent acknowledgement');
 await page.locator('#ocr-reviewed').check();
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#detail-image img').waitFor({timeout:20000});
 const saved=await ledger(page);
 assert.equal(saved.rows.length,1);
 assert.equal(saved.photos.length,1);
 const row=saved.rows[0],photo=saved.photos[0];
 assert.equal(row.id,photo.id);
 assert.equal(row.subject,'science');assert.equal(row.gradeAtEntry,3);
 assert.equal(row.problemText,CORRECTED);
 assert.equal(row.memo,MEMO);
 assert.equal(row.ocrStatus,'browser_ocr_reviewed');
 assert.equal(row.hasPhoto,true);
 assert.deepEqual(row.generalRetryHistory,[]);
 assert.ok(photo.bytes.length>0);
 assert.equal(await page.locator('#detail-text').innerText(),CORRECTED);
 assert.equal((await page.locator('#detail-text').innerText()).includes(OCR_FAKE),false);
 pass('corrected OCR and explicit reviewed status committed with exact photo/record ID');
 await shot(page,'02-reviewed-corrected-saved-320');

 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').waitFor({timeout:15000});
 const audit=await page.evaluate(({secret,old})=>({
  secretText:document.body.textContent.includes(secret),
  secretDom:document.querySelector('#memo')?.value.includes(secret)||false,
  staleOCRText:document.body.textContent.includes(old),
  staleOCRInput:document.querySelector('#ocr-preview')?.value.includes(old)||false,
  parentObservation:!!document.querySelector('#v25-learning-flow #v230-review-save'),
  correctedShown:document.querySelector('#detail-text')?.textContent||''
 }),{secret:MEMO,old:OCR_FAKE});
 assert.equal(audit.secretText,false,'parent memo visible in child DOM');
 assert.equal(audit.secretDom,false,'hidden parent input retained sensitive memo');
 assert.equal(audit.staleOCRText,false,'unreviewed OCR candidate text leaked to child DOM');
 assert.equal(audit.staleOCRInput,false,'unreviewed OCR candidate input leaked to child DOM');
 assert.equal(audit.parentObservation,false,'parent observation control in child DOM');
 assert.equal(audit.correctedShown,CORRECTED);
 await page.locator('#v230-answer').fill(ANSWER);
 await page.locator('#v230-explanation').fill(REASON);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v25-learning-flow')?.textContent?.includes('일반 재풀이 기록 1회'),null,{timeout:20000});
 const child=await ledger(page);
 assert.equal(child.rows.length,1);assert.equal(child.rows[0].id,row.id);
 assert.equal(child.rows[0].generalRetryHistory.length,1);
 assert.equal(child.rows[0].generalRetryHistory[0].explanation,REASON);
 assert.equal(child.rows[0].generalRetryHistory[0].review,'not_checked');
 assert.deepEqual(child.photos,[photo],'child save must never rewrite original photo');
 assert.equal(child.rows[0].problemText,CORRECTED);
 assert.equal(child.rows[0].ocrStatus,'browser_ocr_reviewed');
 pass('child DOM has no private memo/draft; free answer and explanation appended once');
 await shot(page,'03-child-explains-private-dom-clean-320');

 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').waitFor({timeout:15000});
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&
  document.querySelector('#v25-learning-flow')?.textContent?.includes('도움이 필요했다고 관찰'),null,{timeout:20000});
 const final=await ledger(page);
 assert.equal(final.rows.length,1);
 assert.equal(final.rows[0].id,row.id);
 assert.equal(final.rows[0].generalRetryHistory.length,1);
 assert.equal(final.rows[0].generalRetryHistory[0].answer,ANSWER);
 assert.equal(final.rows[0].generalRetryHistory[0].explanation,REASON);
 assert.equal(final.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.ok(final.rows[0].generalRetryHistory[0].reviewedAt);
 assert.equal(final.rows[0].problemText,CORRECTED);
 assert.equal(final.rows[0].memo,MEMO);
 assert.equal(final.rows[0].ocrStatus,'browser_ocr_reviewed');
 assert.deepEqual(final.photos,[photo],'parent review must preserve original picture bytes');
 pass('actual parent observation saved independently, 1 id/1 retry/1 original photo unchanged');
 await shot(page,'04-parent-observation-320');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#detail-text').waitFor({timeout:20000});
 const persisted=await ledger(page);
 assert.deepEqual(persisted,final,'page reload changed corrected OCR/photo/retry/review');
 const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.width+2,'320 horizontal overflow');
 await page.setViewportSize({width:390,height:844});
 await shot(page,'05-parent-after-reload-390');
 const wide=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(wide.scroll<=wide.width+2,'390 horizontal overflow');
 assert.deepEqual(errors,[]);
 assert.deepEqual(outside,[]);
 pass('reload preserved entire same-ID ledger; 320/390 mobile overflow0 JS0 egress0');
 const result={status:'PASS',devSha:SHA,checks,screens,
  journey:'synthetic photo -> stub OCR -> human corrected preview -> explicit review -> IndexedDB -> child answer/explanation -> parent observation',
  realApp:true,localhostOnly:true,syntheticOCR:true,actualOCR:false,
  childDomPrivateMemoAbsent:true,originalPhotoBytesPreserved:true,
  reloadPreserved:true,numberOfRecords:1,numberOfRetries:1,
  widths:[320,390],externalRequests:outside.length,jsErrors:errors.length,
  safeToRestore:false,realFamilyAuth:false,productionChanged:false,
  previousQa78Qa84Qa92NotRepeated:true};
 writeFileSync(OUT+'/wrong-a01-result.json',JSON.stringify(result,null,2));
 console.log('WRONG_A01_RESULT='+JSON.stringify(result));
 await context.close();
}catch(e){
 process.exitCode=1;
 const r={status:'FAIL',devSha:SHA,checks,screens,error:String(e),
  stack:String(e?.stack||'').slice(0,1450),errors,outside,
  safeToRestore:false,productionChanged:false};
 writeFileSync(OUT+'/wrong-a01-failure.json',JSON.stringify(r,null,2));
 console.error('WRONG_A01_RESULT='+JSON.stringify(r));
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 console.log('WRONG_A01_EPHEMERAL_PREVIEW_STOPPED');
}
