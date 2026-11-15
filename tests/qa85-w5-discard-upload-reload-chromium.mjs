// W5 / QA85 NEW path: staged replacement photo and private text are explicitly
// discarded, then a hard reload and parent->child->parent record re-entry must
// preserve pre-existing IndexedDB record/photo bytes. QA79 did not reload.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA85_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const storedProblem='QA85 원본 가상 사진 문제';
const storedMemo='QA85 보존되어야 하는 저장된 가상 학부모 메모';
const discardedProblem='QA85 저장하지 않고 폐기한 새 사진 문제';
const discardedMemo='QA85 저장하지 않고 폐기한 학부모 원본 초안';
const proof='qa-proof/qa85';mkdirSync(proof,{recursive:true});
let preview,browser,checks=0,shots=0;
const pass=s=>{checks++;console.log('PASS QA85 '+s)};
async function shot(page,name){
 const path=proof+'/'+String(++shots).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA85_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const keys=tx.objectStore('photos').getAllKeys();
   const blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const pics=await Promise.all(keys.result.map(async(id,i)=>({
     id,mime:blobs.result[i].type,bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));
    db.close();resolve({rows:rows.result,pics});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
try{
 const username='qa85-synthetic',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))outbound.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(storedProblem);
 await page.locator('#memo').fill(storedMemo);
 await page.locator('#take-photo').setInputFiles({name:'qa85-saved-original.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const before=await snapshot(page);
 assert.equal(before.rows.length,1);assert.equal(before.pics.length,1);
 assert.equal(before.rows[0].id,before.pics[0].id);
 assert.equal(before.rows[0].problemText,storedProblem);
 assert.equal(before.rows[0].memo,storedMemo);
 pass('saved original record id and original photo bytes captured');

 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor({timeout:15000});
 await page.locator('#problem').fill(discardedProblem);
 await page.locator('#memo').fill(discardedMemo);
 await page.locator('#take-photo').setInputFiles({name:'qa85-staged-replacement.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 const staged=await page.evaluate(()=>({
  problem:document.querySelector('#problem')?.value,
  memo:document.querySelector('#memo')?.value,
  fileCount:document.querySelector('#take-photo')?.files.length||0,
  pixels:(document.querySelector('#crop-canvas')?.width||0)*
   (document.querySelector('#crop-canvas')?.height||0)
 }));
 assert.equal(staged.problem,discardedProblem);
 assert.equal(staged.memo,discardedMemo);
 assert.equal(staged.fileCount,1);
 assert.ok(staged.pixels>0);
 await shot(page,'unsaved-edit-staged-before-discard');
 pass('unsaved staged replacement and parent memo exist only in edit form');

 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
 const afterDiscard=await snapshot(page);
 assert.deepEqual(afterDiscard,before,'explicit discard changed saved ledger/photo');
 pass('explicit discard leaves saved record and photo byte-identical');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const afterReload=await snapshot(page);
 assert.deepEqual(afterReload,before,'hard reload changed saved ledger or photo bytes');
 assert.ok((await page.locator('#detail-memo').textContent()).includes(storedMemo));
 assert.ok((await page.locator('#detail-problem').textContent()).includes(storedProblem));
 pass('hard reload and parent detail reentry restore original memo/problem/photo');

 await page.locator('#v218-child-mode').click();
 await page.waitForFunction(()=>document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed')==='true');
 const child=await page.evaluate(data=>({
  discardedInDOM:document.body.textContent.includes(data.discardedProblem)||
   document.body.textContent.includes(data.discardedMemo),
  discardedInFields:['problem','memo','ocr-preview'].some(id=>
   (document.getElementById(id)?.value||'').includes('QA85 저장하지 않고 폐기한')),
  cropPixels:(document.getElementById('crop-canvas')?.width||0)*
   (document.getElementById('crop-canvas')?.height||0),
  fileCount:document.querySelector('#take-photo')?.files.length||0,
  parentMemoInDOM:document.body.textContent.includes(data.storedMemo),
  visiblePhoto:!!document.querySelector('#detail-image img')?.getClientRects().length
 }),{discardedProblem,discardedMemo,storedMemo});
 assert.deepEqual(child,{discardedInDOM:false,discardedInFields:false,cropPixels:0,
  fileCount:0,parentMemoInDOM:false,visiblePhoto:true});
 await shot(page,'child-after-hard-reload');
 pass('child reentry has saved photo but no discarded draft or hidden parent memo');

 await page.locator('#v218-parent-mode').click();
 await page.waitForFunction(memo=>document.querySelector('#detail-memo')?.textContent?.includes(memo),
  storedMemo,{timeout:15000});
 const afterReturn=await snapshot(page);
 assert.deepEqual(afterReturn,before,'parent->child->parent mutated saved photo or ledger');
 await shot(page,'parent-return-after-reload');
 assert.deepEqual(errors,[]);
 assert.deepEqual(outbound,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('parent return, full ledger/photo bytes and 320px browser integrity unchanged');
 console.log('QA85_RESULT='+JSON.stringify({status:'PASS',checks,shots,viewport:320,
  savedRecordUnchanged:true,savedPhotoBytesUnchanged:true,
  discardedDraftHiddenDOMClear:true,hardReloadReentry:true,
  safeToRestore:false,syntheticOnly:true,realFamilyAuthentication:false,
  realPhotosVerified:false,operationalIsolationVerified:false}));
 writeFileSync(proof+'/qa85-result.json',JSON.stringify({sourceDevSha:SHA,status:'PASS',checks,shots,
  savedPhotoBytesUnchanged:true,discardedDraftHiddenDOMClear:true,
  hardReloadReentry:true,safeToRestore:false},null,2));
 await ctx.close();
}catch(e){
 console.error('QA85_RESULT='+JSON.stringify({status:'FAIL',checks,shots,error:String(e),
  stack:String(e?.stack).slice(0,1250),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
