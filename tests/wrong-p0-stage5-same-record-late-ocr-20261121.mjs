// Stage 5 NEW delta: same-record manual text and stale synthetic OCR, 320/390.
// Approved corrected harness one run only: #82 #7062893616/#7062900528; prior CI44902695088 stopped before browser.
// W03 and QA84 prior accepted tests must NOT be rerun. No real OCR/family data.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startWrongQa66Preview } from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(process.env.WRONG_STAGE5_DEV_SHA,DEV);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const DB='uriaimath-github-qa-v224-only';
const dir='qa-proof/wrong-p0-stage5-late-ocr';
mkdirSync(dir,{recursive:true});
const result={contract:'SAME_RECORD_LATE_OCR_DELTA',baseline:DEV,syntheticOnly:true,
 realOCR:'N/T',familyAuth:'BLOCK',safeToRestore:false,cases:[],errors:[]};
let preview,browser;
async function snap(page){
 return page.evaluate(dbname=>new Promise((yes,no)=>{
  const open=indexedDB.open(dbname);
  open.onerror=()=>no(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const a=tx.objectStore('mistakes').getAll();
   const k=tx.objectStore('photos').getAllKeys();
   const b=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();no(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const photos=await Promise.all(k.result.map(async(id,i)=>({
      id,bytes:Array.from(new Uint8Array(await b.result[i].arrayBuffer()))
     })));
     db.close();yes({rows:a.result,photos});
    }catch(e){db.close();no(e)}
   };
  };
 }),DB);
}
try{
 const username='stage5-synthetic',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username,password});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:900},
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
    const next=q.pending.shift();
    if(!next)throw Error('NO_PENDING_MOCK_OCR');
    next({data:{text}});
   };
   window.__stage5=q;
   window.Tesseract={createWorker:async()=>({
    recognize:()=>{q.started++;return new Promise(ok=>q.pending.push(ok))},
    terminate:async()=>{q.terminated++}
   })};
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(DEV));
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill('가상 원본 문장');
  await page.locator('#take-photo').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
  const original=await snap(page);
  assert.equal(original.rows.length,1);
  assert.equal(original.photos.length,1);
  const id=original.rows[0].id;
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record="'+id+'"]').click();
  await page.locator('#detail-edit').click();
  await page.locator('#v13-old-photo img').waitFor({timeout:15000});
  await page.locator('#take-photo').setInputFiles({name:'unsaved-ocr.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#ocr-run').click();
  await page.locator('#dlg-ok').click();
  await page.waitForFunction(()=>window.__stage5.started===1,{timeout:15000});
  const edited='부모 직접 수정한 최종 초안 '+width;
  await page.locator('#problem').fill(edited);
  await page.locator('#ocr-turn').selectOption('90');
  const old='늦게 온 이전 OCR 데이터 '+width;
  await page.evaluate(t=>window.__stage5.release(t),old);
  await page.waitForFunction(()=>window.__stage5.terminated===1,{timeout:15000});
  assert.equal(await page.locator('#problem').inputValue(),edited);
  assert.equal(await page.locator('#ocr-preview').inputValue(),'');
  assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
  assert.equal(await page.evaluate(t=>document.body.textContent.includes(t),old),false);
  assert.deepEqual(await snap(page),original);
  // Second worker starts after first has terminated; no concurrent reverse-order claim.
  await page.locator('#ocr-run').click();
  await page.locator('#dlg-ok').click();
  await page.waitForFunction(()=>window.__stage5.started===2,{timeout:15000});
  const next='새로운 OCR 미확정 후보 '+width;
  await page.evaluate(t=>window.__stage5.release(t),next);
  await page.waitForFunction(()=>window.__stage5.terminated===2,{timeout:15000});
  assert.equal(await page.locator('#ocr-preview').inputValue(),next);
  assert.equal(await page.locator('#problem').inputValue(),edited);
  assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
  assert.deepEqual(await snap(page),original);
  await page.screenshot({path:dir+'/'+width+'-parent.png',fullPage:false});
  await page.locator('#nav-records').click();
  await page.locator('#dlg-ok').click();
  await page.waitForFunction(()=>!document.querySelector('#page-records')?.classList.contains('hide'));
  await page.locator('#v218-child-mode').click();
  const child=await page.evaluate(texts=>({
   exposed:texts.some(t=>document.body.textContent.includes(t)||
    document.querySelector('#problem')?.value?.includes(t)||
    document.querySelector('#ocr-preview')?.value?.includes(t)),
   pixels:(document.querySelector('#crop-canvas')?.width||0)*
    (document.querySelector('#crop-canvas')?.height||0),
   fileCount:document.querySelector('#take-photo')?.files?.length||0
  }),[edited,old,next]);
  assert.deepEqual(child,{exposed:false,pixels:0,fileCount:0});
  assert.deepEqual(await snap(page),original);
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  assert.ok(await page.evaluate(w=>document.documentElement.scrollWidth<=w+3,width));
  result.cases.push({width,staleOldDiscarded:true,parentTextNotOverwritten:true,
   nextOCRPreviewOnly:true,reviewNotAutoGranted:true,photosAndRecordUnchanged:true,
   childDraftResidueZero:true});
  await ctx.close();
 }
 result.status='PASS_SYNTHETIC_ONLY_AUTH_BLOCK';
 console.log('STAGE5_RESULT='+JSON.stringify(result));
}catch(e){
 result.status='FAIL_OR_ENV_BLOCK';result.errors.push(String(e));
 console.error('STAGE5_RESULT='+JSON.stringify(result));process.exitCode=1;
}finally{
 writeFileSync(dir+'/result.json',JSON.stringify(result,null,2)+'\n');
 if(browser)await browser.close();
 if(preview)await preview.close();
}
