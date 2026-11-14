// QA72: new parent invalid observation-time guidance, keyboard action -> original detail.
// Distinct from QA71 chronological sort. Fictional-only loopback IndexedDB; no deploy.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA72_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only',msg='QA72 가상 부모 메모: 직접 관찰한 상황';
let preview,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA72 '+s)};
async function recordsAndPhotos(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const records=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({records:records.result,photos:photos.result})};
  };
 }),DB);
}
try{
 const username='qa72-fake-parent',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:360,height:770},acceptDownloads:false,
  httpCredentials:{username,password}});
 const page=await ctx.newPage(),external=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA72 가상 문제: 그림자의 위치');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').filter({hasText:'QA72 가상 문제'}).click();
 await page.locator('#detail-text').waitFor();
 await page.locator('#v230-answer').fill('가상 아이 답');
 await page.locator('#v230-explanation').fill('가상 아이 설명');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:15000});
 await page.evaluate(()=>{
  const RealDate=Date;window.__qa72realDate=RealDate;
  window.Date=class FakeFutureDate extends RealDate{
   constructor(...v){super(...(v.length?v:[RealDate.now()+86400000]))}
   static now(){return RealDate.now()+86400000}
  };
 });
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill(msg);
 await page.locator('#check-save').click();
 await page.waitForFunction(text=>document.querySelector('#check-history')?.textContent?.includes(text),msg,{timeout:15000});
 // Undo fictional clock without rewriting local records.
 await page.evaluate(()=>{window.Date=window.__qa72realDate});
 const before=await recordsAndPhotos(page);
 assert.equal(before.records.length,1);
 assert.deepEqual(before.photos,[]);
 assert.ok(Date.parse(before.records[0].checkHistory.at(-1).at)>Date.now()+80000000);
 pass('fictional child retry and future-dated parent note saved using ordinary UI');

 await page.locator('#nav-home').click();
 const item=page.locator('#wrong-parent-needs-help-queue button[data-record]');
 await item.waitFor();
 assert.equal(await item.count(),1);
 assert.match(await item.locator('.wrong-parent-observation-age').innerText(),/관찰일 확인 불가/);
 const next=item.locator('.wrong-parent-time-next-action');
 assert.equal(await next.count(),1,'missing inline next action on invalid date');
 assert.match(await next.innerText(),/눌러.*원문.*확인/);
 const accessible=await item.ariaSnapshot();
 assert.ok(accessible.includes('날짜 확인 필요')&&accessible.includes('원문 관찰'),
  'guidance must belong to accessible queue button name');
 pass('invalid parent time presents one concrete original-record action in browser/AX tree');

 await item.focus();
 await page.keyboard.press('Enter');
 await page.locator('#detail-text').waitFor();
 assert.equal(await page.locator('#page-detail').isVisible(),true);
 assert.ok((await page.locator('#check-history').innerText()).includes(msg));
 pass('keyboard Enter follows original fictional record and its saved parent observation');

 const after=await recordsAndPhotos(page);
 assert.deepEqual(after,before,'navigation/guidance must not rewrite parent observations');
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(scroll<=363,'360px overflow '+scroll);
 pass('zero record/photo mutations, external requests, JS errors or 360px overflow');
 console.log('WRONG_QA72_RESULT='+JSON.stringify({status:'PASS',checks,
  sourceDevSha:SHA,realChromium:true,viewport:360,syntheticOnly:true,
  operationalAccessVerified:false,operationalIsolationVerified:false,
  safeToRestore:false,deployed:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA72_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),
  stack:String(e?.stack).slice(0,900),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
