// W3/QA84 NEW synthetic race: OCR started while editing record A resolves after
// that draft was discarded and a different photo record B is being edited.
// QA78 checked child-mode discard and same-draft image swap, NOT cross-record edits.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

// 390-only fresh gap test based on previous 320 synthetic QA84; do not replay its CI.
// Run against exactly the pinned current dev source, with fake offline OCR and records.
const SHA=process.env.WRONG_QA84_DEV_SHA;
const EXPECTED_DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(SHA,EXPECTED_DEV,'wrong source commit; must use fixed current dev snapshot');
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const late='QA84 폐기된 A 사진의 지연 OCR 비공개 문구';
const nameA='QA84 가상 오답 A 원본 문장';
const nameB='QA84 가상 오답 B 원본 문장';
const proof='qa-proof/w3-ocr-390';
mkdirSync(proof,{recursive:true});
let preview,browser,checks=0,shots=0;
const pass=msg=>{checks++;console.log('PASS QA84 '+msg)};
async function shot(page,name){
 const path=proof+'/'+String(++shots).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA84_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
    rows=tx.objectStore('mistakes').getAll(),
    keys=tx.objectStore('photos').getAllKeys(),
    blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(keys.result.map(async(id,i)=>({
     id,mime:blobs.result[i].type,
     bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));
    db.close();resolve({rows:rows.result,photos});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
try{
 const username='qa84-fake-local',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))external.push(url);
  return route.abort();
 });
 await page.addInitScript(()=>{
  const q={pending:[],started:0,terminated:0};
  q.release=text=>{
   const p=q.pending.shift();if(!p)throw Error('NO_PENDING_FAKE_OCR');
   p.resolve({data:{text}});
  };
  window.__qa84=q;
  window.Tesseract={createWorker:async()=>({
   recognize:()=>{q.started++;return new Promise((resolve,reject)=>q.pending.push({resolve,reject}))},
   terminate:async()=>{q.terminated++}
  })};
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 async function add(name){
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(name);
  await page.locator('#take-photo').setInputFiles({name:'qa84-fake.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 }
 await add(nameA);
 await add(nameB);
 const original=await snapshot(page);
 assert.equal(original.rows.length,2);
 assert.equal(original.photos.length,2);
 const a=original.rows.find(x=>x.problemText===nameA);
 const b=original.rows.find(x=>x.problemText===nameB);
 assert.ok(a?.id&&b?.id&&a.id!==b.id);
 assert.deepEqual(new Set(original.photos.map(x=>x.id)),new Set([a.id,b.id]));
 pass('two separate saved records and photo byte baselines');

 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+a.id+'"]').click();
 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor({timeout:15000});
 await page.locator('#take-photo').setInputFiles({name:'qa84-discarded-a.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#ocr-run').click();
 await page.locator('#dlg-ok').click(); // fake offline worker, user confirms OCR attempt
 await page.waitForFunction(()=>window.__qa84.started===1,{timeout:15000});
 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click(); // explicit discard of A draft
 await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
 pass('discarded A photo edit while OCR completion remains pending');

 await page.locator('#records-list button[data-record="'+b.id+'"]').click();
 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor({timeout:15000});
 assert.equal(await page.locator('#problem').inputValue(),nameB);
 await page.evaluate(text=>window.__qa84.release(text),late);
 await page.waitForFunction(()=>window.__qa84.terminated===1,{timeout:15000});
 const bEdit=await page.evaluate(text=>({
  problem:document.querySelector('#problem')?.value,
  ocr:document.querySelector('#ocr-preview')?.value,
  bodyContains:document.body.textContent.includes(text),
  inputContains:document.querySelector('#problem')?.value.includes(text)
 }),late);
 assert.equal(bEdit.problem,nameB,'stale A worker changed B edit form');
 assert.equal(bEdit.ocr,'','stale OCR appeared in B editor');
 assert.equal(bEdit.bodyContains,false,'stale A OCR leaked into B parent DOM');
 assert.equal(bEdit.inputContains,false);
 await shot(page,'parent-b-edit-after-late-a-ocr');
 pass('late A OCR does not corrupt record B edit or parent DOM');

 await page.locator('#nav-records').click();
 await page.locator('#v218-child-mode').click();
 await page.waitForFunction(()=>document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed')==='true');
 const child=await page.evaluate(text=>({
  inDOM:document.body.textContent.includes(text),
  inVisible:document.body.innerText.includes(text),
  hiddenOCR:document.querySelector('#ocr-preview')?.value.includes(text)||
   document.querySelector('#problem')?.value.includes(text),
  photoPixels:(document.querySelector('#crop-canvas')?.width||0)*
   (document.querySelector('#crop-canvas')?.height||0),
  fileCount:document.querySelector('#take-photo')?.files.length||0
 }),late);
 assert.deepEqual(child,{inDOM:false,inVisible:false,hiddenOCR:false,photoPixels:0,fileCount:0});
 await shot(page,'child-after-cross-record-stale-worker');
 pass('child visible and hidden DOM and image canvas remain clear after cross-record OCR');

 const after=await snapshot(page);
 assert.deepEqual(after,original,'cross-record OCR changed original ledger or photo bytes');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=393);
 pass('two records and two photos byte-identical; 390px and browser integrity');
 console.log('W3_390_RESULT='+JSON.stringify({status:'PASS',checks,shots,width:390,
  crossRecordStaleOCRBlocked:true,childDOMClear:true,savedPhotosUnchanged:true,
  syntheticOnly:true,safeToRestore:false,familyAuthenticationVerified:false,
  actualOCRVerified:false,externalDeploymentVerified:false}));
 writeFileSync(proof+'/qa84-result.json',JSON.stringify({sourceDevSha:SHA,status:'PASS',checks,shots,
  crossRecordStaleOCRBlocked:true,childDOMClear:true,savedPhotosUnchanged:true,safeToRestore:false},null,2));
 await ctx.close();
}catch(e){
 console.error('W3_390_RESULT='+JSON.stringify({status:'FAIL',checks,shots,error:String(e),
  stack:String(e?.stack).slice(0,1200),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
