// WRONG A-02: ONLY new local storage acknowledgment-uncertainty and duplicate-retry path.
// No A-01 OCR journey / old QA78/84/85/92 rerun. Synthetic record, localhost Chromium.
// Simulates a post-transaction IndexedDB reread rejection: this is NOT HTTP/server ACK.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_A02_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/,'pinned dev ref required');
const OUT='qa-proof/wrong-a02';
mkdirSync(OUT,{recursive:true});
const DB='uriaimath-github-qa-v224-only';
const title='A02 합성 국어 오답: 친구의 생각을 문장으로 설명하기';
const secret='A02 부모만 보는 비공개 참고 메모: 관계를 파악하기 어려워함';
const answer='A02 아이가 다시 쓴 대답: 친구도 같은 상황에서 다른 의견을 가질 수 있다';
const explanation='A02 아이 설명: 글에 나온 친구의 말을 다시 찾아봤어요';
const questions=[];
const errors=[],external=[];
let preview,browser,screens=0,checks=0;
const pass=s=>{checks++;console.log('WRONG_A02_PASS '+checks+' '+s)};
async function shot(page,name){
 const file=OUT+'/'+String(++screens).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path:file,animations:'disabled',fullPage:true,timeout:25000});
 console.log('WRONG_A02_SHOT='+file);
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(name);o.onerror=()=>reject(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const req=tx.objectStore('mistakes').getAll(),photokeys=tx.objectStore('photos').getAllKeys();
   tx.oncomplete=()=>{db.close();resolve({rows:req.result,photoKeys:photokeys.result})};
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.onabort=()=>{db.close();reject(tx.error)};
  };
 }),DB);
}
async function failNextCommittedRead(page){
 // The real app's CAS write uses READWRITE on mistakes+photos.
 // Inject a single synchronous failure ONLY for its next READONLY single
 // 'mistakes' transaction after the successful commit, without touching data.
 const state=await page.evaluate(()=>{
  if(!window.__a02Ack){
   const original=IDBDatabase.prototype.transaction;
   window.__a02Ack={armed:false,fired:0,reads:0};
   IDBDatabase.prototype.transaction=function(stores,mode,...extra){
    const names=Array.isArray(stores)?stores:[stores];
    if(mode==='readonly'&&names.length===1&&names[0]==='mistakes'&&window.__a02Ack.armed){
     window.__a02Ack.armed=false;
     window.__a02Ack.fired++;
     throw Error('QA_A02_SYNTHETIC_POST_COMMIT_READBACK_LOST');
    }
    if(mode==='readonly'&&names.length===1&&names[0]==='mistakes')
     window.__a02Ack.reads++;
    return original.call(this,stores,mode,...extra);
   };
  }
  window.__a02Ack.armed=true;
  return {fired:window.__a02Ack.fired};
 });
 return state.fired;
}
try{
 const username='wrong-a02-local-only',password=randomBytes(25).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('blob:')&&!u.startsWith('data:'))external.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.match(await page.locator('#wrong-qa66-preview-meta').innerText(),new RegExp(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(title);
 await page.locator('#memo').fill(secret);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const before=await snapshot(page);
 assert.equal(before.rows.length,1);
 assert.deepEqual(before.photoKeys,[]);
 const id=before.rows[0].id;
 assert.equal(before.rows[0].memo,secret);
 assert.deepEqual(before.rows[0].generalRetryHistory,[]);
 pass('one immutable baseline local ID, no photo, parent-only note');

 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill(answer);
 await page.locator('#v230-explanation').fill(explanation);
 const beforeRetryFailure=await failNextCommittedRead(page);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-status')?.textContent?.includes('재읽기 확인에 실패'),null,{timeout:18000});
 assert.equal(await page.evaluate(()=>window.__a02Ack.fired),beforeRetryFailure+1);
 const afterAmbig=await snapshot(page);
 assert.equal(afterAmbig.rows.length,1);
 assert.equal(afterAmbig.rows[0].generalRetryHistory.length,1,
  'committed but readback-unknown retry never vanishes or multiplies');
 assert.equal(afterAmbig.rows[0].generalRetryHistory[0].answer,answer);
 assert.equal(afterAmbig.rows[0].generalRetryHistory[0].explanation,explanation);
 assert.equal(afterAmbig.rows[0].generalRetryHistory[0].review,'not_checked');
 assert.equal(afterAmbig.rows[0].memo,secret);
 assert.equal(await page.locator('#v230-save').isEnabled(),true);
 pass('synthetic lost local readback AFTER committed retry; UI warns ambiguous persistence');
 await shot(page,'01-child-retry-ack-unknown-320');

 // A person may press Save again despite the warning. CAS should reject the
 // stale view, without creating a second retry or rewriting original record.
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-status')?.textContent?.includes('다른 탭에서 기록이 변경'),null,{timeout:18000});
 const afterRetry=await snapshot(page);
 assert.deepEqual(afterRetry,afterAmbig);
 pass('blind duplicate retry is rejected with stale CAS; attempt count stays exactly 1');
 await shot(page,'02-child-second-save-safe-320');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+id+'"]').click();
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').waitFor({timeout:18000});
 assert.equal(await page.locator('#v230-review').inputValue(),'not_checked');
 assert.equal((await snapshot(page)).rows[0].generalRetryHistory.length,1);
 pass('reload from durable ledger resolves ambiguous retry; parent can observe same attempt');

 await page.locator('#v230-review').selectOption('needs_help');
 const beforeReviewFailure=await failNextCommittedRead(page);
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review-status')?.textContent?.includes('재읽기를 확인하지 못'),null,{timeout:18000});
 assert.equal(await page.evaluate(()=>window.__a02Ack.fired),beforeReviewFailure+1);
 const afterReview=await snapshot(page);
 assert.equal(afterReview.rows.length,1);
 assert.equal(afterReview.rows[0].generalRetryHistory.length,1);
 const last=afterReview.rows[0].generalRetryHistory[0];
 assert.equal(last.answer,answer);
 assert.equal(last.explanation,explanation);
 assert.equal(last.review,'needs_help');
 assert.ok(last.reviewedAt);
 assert.equal(afterReview.rows[0].memo,secret);
 pass('parent observation committed once despite synthetic loss of local readback');
 await shot(page,'03-parent-observation-ack-unknown-320');

 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review-status')?.textContent?.includes('다른 탭에서 수정'),null,{timeout:18000});
 const afterParentRetry=await snapshot(page);
 assert.deepEqual(afterParentRetry,afterReview);
 pass('duplicate parent observation rejected; original review timestamp preserved');

 await page.locator('#v218-child-mode').click();
 const childAudit=await page.evaluate(secret=>({
  parentMemoText:(document.body.textContent||'').includes(secret),
  parentMemoInput:document.querySelector('#memo')?.value?.includes(secret)||false,
  parentObservationControl:!!document.querySelector('#v230-review-save'),
  visibleProblem:document.querySelector('#detail-text')?.textContent||''
 }),secret);
 assert.deepEqual(childAudit,{
  parentMemoText:false,parentMemoInput:false,
  parentObservationControl:false,visibleProblem:title
 });
 await shot(page,'04-child-after-unknown-parent-review-320');
 const childLedger=await snapshot(page);
 assert.deepEqual(childLedger,afterReview);
 pass('child DOM excludes private parent memo/review controls; ledger unaffected by mode change');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+id+'"]').click();
 const stable=await snapshot(page);
 assert.deepEqual(stable,afterReview);
 assert.equal(stable.rows[0].generalRetryHistory.length,1);
 const dims320=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
 assert.ok(dims320.s<=dims320.w+2);
 await page.setViewportSize({width:390,height:844});
 const dims390=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
 assert.ok(dims390.s<=dims390.w+2);
 await shot(page,'05-saved-single-retry-review-after-reload-390');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 pass('reload after two lost readbacks: same record and one retry/review, no JS/net/320-390 overflow');
 const result={
  status:'PASS',devSha:SHA,checks,screens,
  newCase:'IndexedDB post-commit local reread uncertainty + blind retry CAS twice',
  realApp:true,localOnly:true,realServerAck:false,actualOCR:false,
  duplicateChildAttempts:0,duplicateParentObservation:0,
  photoKeys:stable.photoKeys.length,rows:stable.rows.length,
  parentMemoHiddenFromChildDom:true,blindRetryBlocked:true,
  reloadPreserved:true,widths:[320,390],externalRequests:external.length,
  jsErrors:errors.length,safeToRestore:false,realFamilyAuth:false,productionChanged:false,
  existingQAReplayed:false
 };
 writeFileSync(OUT+'/wrong-a02-result.json',JSON.stringify(result,null,2));
 console.log('WRONG_A02_RESULT='+JSON.stringify(result));
 await ctx.close();
}catch(e){
 process.exitCode=1;
 const result={status:'FAIL',devSha:SHA,checks,screens,
  error:String(e),stack:String(e?.stack||'').slice(0,1350),errors,external,
  realServerAck:false,safeToRestore:false,productionChanged:false};
 writeFileSync(OUT+'/wrong-a02-failure.json',JSON.stringify(result,null,2));
 console.error('WRONG_A02_RESULT='+JSON.stringify(result));
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 console.log('WRONG_A02_EPHEMERAL_PREVIEW_CLOSED');
}
