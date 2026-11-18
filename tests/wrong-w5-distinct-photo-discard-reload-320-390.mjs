// W5/QA86 new coverage: distinct photo A vs staged replacement B, BOTH 320/390.
// W5 / QA85 old path: staged replacement photo and private text are explicitly
// discarded, then a hard reload and parent->child->parent record re-entry must
// preserve pre-existing IndexedDB record/photo bytes. QA79 did not reload.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA85_DEV_SHA;
const EXPECTED_DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(SHA,EXPECTED_DEV,'Pinned current dev commit is required');
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const DB='uriaimath-github-qa-v224-only';
// Both are genuine 4x4 PNGs, deliberately different colored pixels and file SHA256.
const PNG_A=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGMUiVrFAANMDEgANwcANx4BICKd+I8AAAAASUVORK5CYII=','base64');
const PNG_B=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGN8367IAANMDEgANwcAUVABn2Zq2LgAAAAASUVORK5CYII=','base64');
const aInputSha=hash(PNG_A),bInputSha=hash(PNG_B);
assert.equal(aInputSha,'0c74eac51649a3bcbbd9564aa25776d08a300ff7d4193534657bc8bbc6ab4a83');
assert.equal(bInputSha,'b7cde7c3340183bf5044c6f58efa9425bcfe1ef541c04bbb5a16081bada20cc1');
assert.notEqual(aInputSha,bInputSha,'photo A and B must be distinguishable');
const storedProblem='QA85 원본 가상 사진 문제';
const storedMemo='QA85 보존되어야 하는 저장된 가상 학부모 메모';
const discardedProblem='QA85 저장하지 않고 폐기한 새 사진 문제';
const discardedMemo='QA85 저장하지 않고 폐기한 학부모 원본 초안';
const proof='qa-proof/w5-distinct';mkdirSync(proof,{recursive:true});
let preview,browser,checks=0,shots=0,activeWidth=0;
const widthResults={},screenshots=[],pageErrors=[],externalRequests=[];
const pass=s=>{checks++;console.log('PASS W5 '+activeWidth+' '+s)};
async function shot(page,name){
 const path=proof+'/'+activeWidth+'-'+String(++shots).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 screenshots.push(path);console.log('W5_SCREENSHOT='+path);
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
 for(const width of [320,390]){
 activeWidth=width;
 const initialChecks=checks;
 const ctx=await browser.newContext({viewport:{width,height:width===320?760:844},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outbound=[];
 page.on('pageerror',e=>{errors.push(String(e));pageErrors.push(String(e));});
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:')){outbound.push(url);externalRequests.push(url);}
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(storedProblem);
 await page.locator('#memo').fill(storedMemo);
 await page.locator('#take-photo').setInputFiles({name:'qa85-saved-original.png',mimeType:'image/png',buffer:PNG_A});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const before=await snapshot(page);
 assert.equal(before.rows.length,1);assert.equal(before.pics.length,1);
 assert.equal(before.rows[0].id,before.pics[0].id);
 assert.equal(before.rows[0].problemText,storedProblem);
 assert.equal(before.rows[0].memo,storedMemo);
 const originalPhotoSha=hash(Buffer.from(before.pics[0].bytes));
 const originalPhotoBytes=before.pics[0].bytes.length;
 assert.ok(originalPhotoBytes>0);
 pass('saved original record id and original photo SHA256 baseline captured');

 await page.locator('#detail-edit').click();
 await page.locator('#v13-old-photo img').waitFor({timeout:15000});
 await page.locator('#problem').fill(discardedProblem);
 await page.locator('#memo').fill(discardedMemo);
 await page.locator('#take-photo').setInputFiles({name:'qa85-staged-replacement.png',mimeType:'image/png',buffer:PNG_B});
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
 // Independently read selected new B bytes, not only the stored A bytes.
 const stagedBytes=await page.locator('#take-photo').evaluate(async(el)=>
   Array.from(new Uint8Array(await el.files[0].arrayBuffer())));
 assert.equal(hash(Buffer.from(stagedBytes)),bInputSha,'B staged photo input differs or corrupted');
 const stagedPixel=await page.locator('#crop-canvas').evaluate(canvas=>
   Array.from(canvas.getContext('2d').getImageData(0,0,1,1).data));
 assert.deepEqual(stagedPixel,[239,135,33,255],'B pixels must differ from saved A');
 assert.notEqual(aInputSha,bInputSha);

 await shot(page,'unsaved-edit-staged-before-discard');
 pass('unsaved staged replacement and parent memo exist only in edit form');

 await page.locator('#nav-records').click();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
 const afterDiscard=await snapshot(page);
 assert.deepEqual(afterDiscard,before,'explicit discard changed saved ledger/photo');
 assert.equal(hash(Buffer.from(afterDiscard.pics[0].bytes)),originalPhotoSha,'discard overwrote stored A photo');
 assert.equal(afterDiscard.pics[0].id,before.rows[0].id,'photo ID no longer matches A record');
 pass('explicit discard leaves saved record and photo byte-identical');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const afterReload=await snapshot(page);
 assert.deepEqual(afterReload,before,'hard reload changed saved ledger or photo bytes');
 assert.equal(hash(Buffer.from(afterReload.pics[0].bytes)),originalPhotoSha,'reload overwrote stored A photo');
 assert.ok((await page.locator('#detail-memo').textContent()).includes(storedMemo));
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
 assert.equal(hash(Buffer.from(afterReturn.pics[0].bytes)),originalPhotoSha,'mode cycle changed stored A photo');
 await shot(page,'parent-return-after-reload');
 assert.deepEqual(errors,[]);
 assert.deepEqual(outbound,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=width+3);
 pass('parent return, full ledger/photo bytes and current viewport browser integrity unchanged');
 widthResults[width]={status:'PASS',checks:checks-initialChecks,photoId:before.rows[0].id,
  originalPhotoSha256:originalPhotoSha,originalPhotoBytes,
  originalInputSha256:aInputSha,replacementInputSha256:bInputSha,
  replacementPixelRGBA:stagedPixel,unchangedAfterDiscard:true,unchangedAfterReload:true,
  unchangedAfterParentChildParent:true,childDraftHidden:true};
 await ctx.close();
 }
 assert.equal(checks,12);
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(externalRequests,[]);
 const result={sourceDevSha:SHA,status:'PASS',checks,shots,
  widths:widthResults,photoInputsDistinct:true,
  originalInputSha256:aInputSha,replacementInputSha256:bInputSha,
  syntheticOnly:true,realFamilyAuthentication:false,realPhotosVerified:false,
  operationalIsolationVerified:false,safeToRestore:false,
  screenshots,pageErrors,externalRequests};
 console.log('W5_DISTINCT_RESULT='+JSON.stringify(result));
 writeFileSync(proof+'/result.json',JSON.stringify(result,null,2));
}catch(e){
 console.error('W5_DISTINCT_RESULT='+JSON.stringify({status:'FAIL',checks,shots,widthResults,error:String(e),
  stack:String(e?.stack).slice(0,1250),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
