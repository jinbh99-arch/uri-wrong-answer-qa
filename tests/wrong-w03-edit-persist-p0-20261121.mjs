// W03 P0 one new synthetic contract only: user-corrected OCR -> explicit photo
// review -> saved readback -> reload/edit readback; no real OCR/family auth.
// No existing QA84 or ACK CI is rerun by this test.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const APP_BLOB='250aff5b0a46490488b64f7b96a83c940d2d6c71';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const OUT='qa-proof/wrong-w03-edit-persist';
mkdirSync(OUT,{recursive:true});
const report={contract:'W03_OCR_PARENT_EDIT_PERSIST_A4_P0_SYNTHETIC',
  devSha:SHA,indexBlob:APP_BLOB,appCodeDiff:false,
  cases:[],shots:[],errors:[],external:[],pageErrors:[],
  syntheticOnly:true,realOCR:'NOT_TESTED',realFamilyAuth:'BLOCK',
  safeToRestore:false,productionDataChanged:false};
const sha=b=>createHash('sha256').update(b).digest('hex');
async function snapshot(page){
 return page.evaluate(async name=>{
  const open=indexedDB.open(name);
  const db=await new Promise((ok,no)=>{open.onsuccess=()=>ok(open.result);open.onerror=()=>no(open.error)});
  const tx=db.transaction(['mistakes','photos'],'readonly');
  const get=(store,op)=>new Promise((ok,no)=>{
   const req=tx.objectStore(store)[op]();
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  });
  const [rows,keys,blobs]=await Promise.all([
   get('mistakes','getAll'),get('photos','getAllKeys'),get('photos','getAll')]);
  const photos=await Promise.all(blobs.map(async(b,i)=>({
   id:String(keys[i]),bytes:Array.from(new Uint8Array(await b.arrayBuffer()))
  })));
  db.close();return {rows,photos};
 },DB);
}
async function shot(page,width,stage){
 const bytes=await page.screenshot({fullPage:false,animations:'disabled'});
 const path=OUT+'/'+width+'-'+stage+'.png';
 writeFileSync(path,bytes);report.shots.push({path,sha256:sha(bytes),bytes:bytes.length,
   width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
}
let preview,browser;
try{
 const username='w03-synthetic-qa',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:900},httpCredentials:{username,password},
   deviceScaleFactor:1,acceptDownloads:false});
  const p=await ctx.newPage();
  p.on('pageerror',e=>report.pageErrors.push(String(e)));
  await p.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url))return route.continue();
   if(!url.startsWith('blob:')&&!url.startsWith('data:'))report.external.push(url);
   return route.abort();
  });
  // No real photo content or external OCR library/model: controlled synthetic OCR.
  await p.addInitScript(()=>{
   window.Tesseract={createWorker:async()=>({
    recognize:async()=>({data:{text:'OCR 가상 초안 1/2 + 1/4 = 9/4'}}),
    terminate:async()=>{}
   })};
  });
  await p.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.ok((await p.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
  await p.locator('#nav-add').click();
  await p.locator('#wrong007-subject').selectOption('science');
  await p.locator('#problem').fill('부모가 OCR로 교체하기 전 가상 문장');
  await p.locator('#take-photo').setInputFiles({
   name:'synthetic-w03.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await p.locator('#ocr-run').click();
  await p.locator('#confirm-dialog[open]').waitFor();
  await p.locator('#dlg-ok').click();
  await p.waitForFunction(()=>!document.querySelector('#ocr-preview').readOnly &&
   document.querySelector('#ocr-preview').value.includes('OCR 가상 초안'));
  const fixed='W03 부모 직접 수정 1/2 + 1/4 = 3/4 · '+width;
  await p.locator('#ocr-preview').fill(fixed);
  assert.equal(await p.locator('#ocr-replace').isEnabled(),true);
  await p.locator('#ocr-replace').click();
  await p.locator('#confirm-dialog[open]').waitFor();
  await p.locator('#dlg-ok').click();
  assert.equal(await p.locator('#problem').inputValue(),fixed);
  assert.equal(await p.locator('#ocr-reviewed').isEnabled(),true);
  assert.equal(await p.locator('#ocr-reviewed').isChecked(),false,
   'corrected OCR must require explicit new photo review');
  await p.locator('#ocr-reviewed').check();
  const final=fixed+' (부모가 다시 교정)';
  await p.locator('#problem').fill(final);
  assert.equal(await p.locator('#ocr-reviewed').isChecked(),false,
   'second correction must invalidate earlier review');
  await p.locator('#ocr-reviewed').check();
  await shot(p,width,'parent-corrected-before-save');
  await p.locator('#save-btn').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
  const before=await snapshot(p);
  assert.equal(before.rows.length,1);
  assert.equal(before.photos.length,1);
  assert.equal(before.rows[0].problemText,final);
  assert.equal(before.rows[0].ocrStatus,'browser_ocr_reviewed');
  const id=before.rows[0].id;
  assert.equal(String(before.photos[0].id),String(id));
  const photoHash=sha(Buffer.from(before.photos[0].bytes));
  const oldPhotoBytes=before.photos[0].bytes.length;
  assert.ok(oldPhotoBytes>0);
  await shot(p,width,'parent-after-save');
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('#nav-records').click();
  await p.locator('#records-list button[data-record]').first().click();
  assert.equal(await p.locator('#detail-text').textContent(),final);
  await p.locator('#detail-edit').click();
  assert.equal(await p.locator('#problem').inputValue(),final);
  assert.equal(await p.locator('#ocr-reviewed').isChecked(),true);
  const memo='W03 가상 부모 전용 메모 '+width+' 절대 아이 노출 금지';
  await p.locator('#memo').fill(memo);
  await p.locator('#save-btn').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
  const saved=await snapshot(p);
  assert.equal(saved.rows.length,1,'edit created a duplicate record');
  assert.equal(saved.rows[0].id,id,'record UUID changed during edit');
  assert.equal(saved.rows[0].problemText,final,'edit overwrote OCR correction');
  assert.equal(saved.rows[0].memo,memo);
  assert.equal(saved.rows[0].ocrStatus,'browser_ocr_reviewed');
  assert.equal(saved.photos.length,1);
  assert.equal(sha(Buffer.from(saved.photos[0].bytes)),photoHash);
  await p.locator('#v218-child-mode').click();
  const hidden=await p.evaluate(marker=>{
   const text=document.body.textContent||'';
   const values=[...document.querySelectorAll('input,textarea')].map(e=>e.value||'');
   return {body:text.includes(marker),value:values.some(x=>x.includes(marker)),
    mode:document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed')};
  },memo);
  assert.deepEqual(hidden,{body:false,value:false,mode:'true'});
  await shot(p,width,'child-no-parent-memo');
  await p.locator('#v218-parent-mode').click();
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('#nav-records').click();
  await p.locator('#records-list button[data-record]').first().click();
  assert.equal(await p.locator('#detail-text').textContent(),final);
  assert.equal(await p.locator('#detail-memo').textContent(),memo);
  const last=await snapshot(p);
  assert.deepEqual(last,saved,'reload changed saved record/photo bytes');
  const caseResult={width,ocrCorrected:final,recordId:id,originalPhotoSha256:photoHash,
    originalPhotoBytes:oldPhotoBytes,reviewResetAfterEdit:true,
    explicitReviewSaved:true,savedCount:1,photoCount:1,
    idStable:true,photoBytesStable:true,childMemoDOM:false,reloadExact:true};
  report.cases.push(caseResult);
  console.log('W03_P0_CASE='+JSON.stringify({...caseResult,recordId:'SYNTHETIC_REDACTED'}));
  await ctx.close();
 }
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.external,[]);
 report.status='PASS_SYNTHETIC_W03_EDIT_PERSIST_AUTH_BLOCK';
}catch(err){
 report.status='FAIL_OR_NT';report.errors.push(String(err?.stack||err));
 console.error('W03_P0_FAILURE='+String(err?.stack||err));process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log('W03_P0_RESULT='+JSON.stringify({status:report.status,cases:report.cases.length,
  shots:report.shots.length,errors:report.errors,auth:report.realFamilyAuth,
  safeToRestore:report.safeToRestore}));
}