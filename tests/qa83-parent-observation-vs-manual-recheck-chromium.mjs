// QA83 (NEW): distinguish two genuine parent retry observations from one future
// manual recheck note on one synthetic wrong-answer record. QA74-82 are not rerun.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA83_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const DB='uriaimath-github-qa-v224-only',PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const problem='QA83 하나의 가상 과학 오답: 그림자는 어디에 생길까';
const parentMemo='QA83 합성 학부모 원본 비공개 메모';
const recheck='QA83 학부모 다음 확인 질문 — 광원 반대 방향을 말해볼래?';
let preview,browser,checks=0,shots=0;
const proof='qa-proof/qa83';mkdirSync(proof,{recursive:true});
const pass=label=>{checks++;console.log('PASS QA83 '+label)};
async function shot(page,name){
 const path=proof+'/'+String(++shots).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA83_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll(),keys=tx.objectStore('photos').getAllKeys(),
    blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const pics=await Promise.all(keys.result.map(async(id,i)=>({
     id,bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer())),
     mime:blobs.result[i].type
    })));
    db.close();resolve({rows:rows.result,pics});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function checkUi(page){
 return page.evaluate(()=>{
  const a=document.querySelector('#wrong-parent-retry-comparison');
  const history=document.querySelector('#check-history');
  const next=document.querySelector('#wrong008-last-manual-note');
  const text=(e)=>e?.textContent||'';
  return {comparison:text(a),history:text(history),future:text(next),
   parentReviewCount:document.querySelectorAll('#v25-learning-flow .v230-parent-review').length};
 });
}
try{
 const username='qa83-fake-local',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outside=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('blob:')&&!u.startsWith('data:'))outside.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(problem);
 await page.locator('#student-answer').fill('QA83 아이의 최초 생각');
 await page.locator('#memo').fill(parentMemo);
 await page.locator('#take-photo').setInputFiles({name:'qa83-fake-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 const original=await snapshot(page);
 assert.equal(original.rows.length,1);assert.equal(original.pics.length,1);
 assert.equal(original.rows[0].id,original.pics[0].id);
 const id=original.rows[0].id,photo=original.pics[0];
 pass('same synthetic record and photo origin');

 for(const [index,review] of [[1,'needs_help'],[2,'explained']]){
  await page.locator('#v218-child-mode').click();
  await page.locator('#v230-answer').fill('QA83 아이 재풀이 '+index+'회');
  await page.locator('#v230-explanation').fill('QA83 아이가 직접 설명 '+index+'회');
  await page.locator('#v230-save').click();
  await page.waitForFunction(count=>document.querySelector('#v25-learning-flow')?.textContent?.includes('일반 재풀이 기록 '+count+'회'),index,{timeout:15000});
  await page.locator('#v218-parent-mode').click();
  await page.locator('#v230-review').selectOption(review);
  await page.locator('#v230-review-save').click();
  await page.waitForFunction(value=>document.querySelector('#v230-review')?.value===value,review,{timeout:15000});
 }
 const beforeNote=await snapshot(page);
 assert.equal(beforeNote.rows.length,1);assert.equal(beforeNote.rows[0].id,id);
 assert.equal(beforeNote.rows[0].generalRetryHistory.length,2);
 assert.deepEqual(beforeNote.rows[0].generalRetryHistory.map(x=>x.review),['needs_help','explained']);
 assert.equal(beforeNote.rows[0].checkHistory.length,0);
 assert.deepEqual(beforeNote.pics[0],photo);
 let ui=await checkUi(page);
 assert.match(ui.comparison,/처음 재풀이/);
 assert.match(ui.comparison,/가장 최근 재풀이/);
 assert.match(ui.comparison,/도움이 필요/);
 assert.match(ui.comparison,/스스로 설명/);
 await shot(page,'parent-two-retry-observations-before-recheck');
 pass('two distinct human observations correctly separated in parent comparison');

 const future=new Date(Date.now()+12*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(future);
 await page.locator('#wrong008-next-question').fill(recheck);
 await shot(page,'manual-recheck-input-before-save');
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(date=>
  (document.querySelector('#wrong008-last-manual-note')?.textContent||'').includes(date)||
  (document.querySelector('#wrong008-note-status')?.textContent||'').includes('실패'),
  future,{timeout:15000});
 ui=await checkUi(page);
 console.log('QA83_AFTER_MANUAL_NOTE='+JSON.stringify(ui).slice(0,1000));
 const after=await snapshot(page);
 assert.equal(after.rows.length,1);assert.equal(after.rows[0].id,id);
 assert.equal(after.rows[0].generalRetryHistory.length,2);
 assert.deepEqual(after.rows[0].generalRetryHistory.map(x=>x.review),['needs_help','explained']);
 assert.equal(after.rows[0].checkHistory.length,1);
 assert.equal(after.rows[0].checkHistory[0].status,'not_checked');
 assert.match(after.rows[0].checkHistory[0].memo,/^다음 확인 메모:/);
 assert.ok(after.rows[0].checkHistory[0].memo.includes(recheck));
 assert.deepEqual(after.pics[0],photo);
 assert.match(ui.future,/상태: 아직 확인 전으로 기록됨/);
 assert.ok(!ui.future.includes('완료로 자동'));
 assert.match(ui.history,/다음 확인 수동 메모/);
 assert.ok(!ui.history.includes('스스로 설명했음')&&!ui.history.includes('도움이 필요했음'));
 assert.match(ui.comparison,/처음 재풀이/);
 assert.match(ui.comparison,/가장 최근 재풀이/);
 await shot(page,'manual-recheck-saved-not-observation');
 pass('future note status still NOT_CHECKED; no conflation with two completed parent retry reviews');

 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 ui=await checkUi(page);
 assert.match(ui.future,/상태: 아직 확인 전으로 기록됨/);
 assert.match(ui.comparison,/처음 재풀이/);
 assert.match(ui.comparison,/가장 최근 재풀이/);
 assert.match(ui.history,/다음 확인 수동 메모/);
 const reentered=await snapshot(page);
 assert.deepEqual(reentered,after,'read-only parent re-entry mutated original history or photo');
 await shot(page,'parent-history-reentry-retains-distinction');
 pass('parent detail reentry still distinguishes two reviews versus one manual future note');

 assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 console.log('QA83_RESULT='+JSON.stringify({status:'PASS',checks,shots,width:320,
  sameRecord:true,reviewCount:2,manualFutureNoteCount:1,futureNoteStillUnconfirmed:true,
  originalPhotoUnchanged:true,localSyntheticOnly:true,safeToRestore:false,
  familyAuthVerified:false,actualOCRVerified:false,operationalIsolationVerified:false}));
 writeFileSync(proof+'/qa83-result.json',JSON.stringify({sourceDevSha:SHA,checks,shots,
  reviewStatuses:after.rows[0].generalRetryHistory.map(x=>x.review),
  nextManualStatus:after.rows[0].checkHistory[0].status,
  originalPhotoUnchanged:true,safeToRestore:false},null,2));
 await ctx.close();
}catch(error){
 console.error('QA83_RESULT='+JSON.stringify({status:'FAIL',checks,shots,error:String(error),stack:String(error?.stack).slice(0,1200),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
