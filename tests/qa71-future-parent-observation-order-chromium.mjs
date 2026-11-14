// QA71: NEW actual Chromium regression for queue mismatch documented in #61 §9:
// future-stamped parent review must be displayed as '확인 불가' AND sorted last.
// Old QA61 was Node-only; do not rerun QA61, QA66-70 or modify product records.
// Loopback Basic gate, fully fictional local IndexedDB, no external API/photos.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA71_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only';
let browser,preview,checks=0;
const pass=label=>{checks++;console.log('PASS WRONG QA71 '+label)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(name);
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const records=tx.objectStore('mistakes').getAll();
   const photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({records:records.result,photos:photos.result})};
  };
 }),DB);
}
async function registerWithParent(page,title){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await page.locator('#nav-records').click();
 const row=page.locator('#records-list button[data-record]').filter({hasText:title});
 await row.waitFor();
 await row.click();
 await page.locator('#detail-text').waitFor();
 await page.locator('#v230-answer').fill('가상 답: 오른쪽');
 await page.locator('#v230-explanation').fill('가상 설명: 광원 반대쪽으로 그림자');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:18000});
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill('QA71 가상 부모 확인: 다른 방향도 설명 부탁');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('QA71 가상 부모 확인'),null,{timeout:18000});
}
async function order(page){
 return page.locator('#wrong-parent-needs-help-queue button[data-record]').evaluateAll(items=>
  items.map(el=>({id:el.dataset.record,age:el.querySelector('.wrong-parent-observation-age')?.textContent||''})));
}
try{
 const username='qa71-fake-only',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:360,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 const validTitle='QA71 가상 정상 관찰',futureTitle='QA71 가상 미래 관찰';
 await registerWithParent(page,validTitle);
 // Simulate the fictional device clock temporarily being one day ahead.
 // The product's normal parent save flow writes the future date; no IDB edit.
 await page.evaluate(()=>{
  const RealDate=Date;
  window.__wrongQa71RealDate=RealDate;
  const advance=86400000;
  window.Date=class FutureClock extends RealDate{
   constructor(...args){super(...(args.length?args:[RealDate.now()+advance]))}
   static now(){return RealDate.now()+advance}
  };
 });
 await registerWithParent(page,futureTitle);
 const before=await snapshot(page);
 assert.equal(before.records.length,2);
 assert.deepEqual(before.photos,[]);
 const valid=before.records.find(r=>r.problemText===validTitle);
 const future=before.records.find(r=>r.problemText===futureTitle);
 assert.ok(valid?.id&&future?.id);
 await page.locator('#nav-home').click();
 await page.locator('#wrong-parent-needs-help-queue button[data-record]').first().waitFor();
 assert.equal((await order(page))[0].id,future.id,'future observation should be first under advanced clock');
 pass('360px two fictional observations sorted under simulated future device clock');

 // Restore the fictional browser clock to actual time. The new parent
 // observation remains future-dated without any direct IndexedDB writes.
 await page.evaluate(()=>{
  if(typeof window.__wrongQa71RealDate!=='function')throw Error('missing original Date');
  window.Date=window.__wrongQa71RealDate;
 });
 const injected=await snapshot(page);
 assert.deepEqual(injected,before,'clock correction must not rewrite local family records');
 const futureReview=injected.records.find(r=>r.id===future.id)?.checkHistory
  ?.filter(c=>c?.status==='needs_help').at(-1);
 assert.ok(Date.parse(futureReview?.at||'')>Date.now()+80000000,
  'fictional future parent timestamp must be later than real clock');
 pass('same fictional records persisted while device clock returned to present');
 await page.locator('#nav-records').click();
 await page.locator('#nav-home').click();
 await page.locator('#wrong-parent-needs-help-queue button[data-record]').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-parent-needs-help-queue button[data-record]').length===2);
 const rows=await order(page);
 assert.deepEqual(rows.map(x=>x.id),[valid.id,future.id],
  'valid parent observation must outrank future, even if future was previously newest');
 assert.match(rows[1].age,/관찰일 확인 불가/);
 assert.ok(!rows[0].age.includes('확인 불가'));
 pass('REAL Chromium queue puts genuine reviewed parent first, future-stamped last with unknown-date label');

 const after=await snapshot(page);
 assert.deepEqual(after,injected,'rendering after clock correction must not rewrite saved records');
 assert.deepEqual(after.photos,[]);
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 pass('post-render records unchanged and no photo, external network, or JS errors');
 console.log('WRONG_QA71_RESULT='+JSON.stringify({status:'PASS',checks,syntheticOnly:true,
  realChromium:true,viewport:360,correctedProductCode:false,
  sourceDevSha:SHA,operationalSafetyVerified:false,realFamilyData:false,
  safeToRestore:false,deployed:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA71_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),
  stack:String(e?.stack).slice(0,1100),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
