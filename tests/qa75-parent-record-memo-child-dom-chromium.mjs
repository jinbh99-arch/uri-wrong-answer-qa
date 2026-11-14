// QA75: New defect distinct from QA74 parent OBSERVATION queue/history:
// a stored RECORD-LEVEL parent memo remained in #detail-memo and #memo on child view.
// Fully fictional IndexedDB on loopback; this does not authenticate children or families.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA75_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const parentMemo='QA75 부모 전용 원본메모 ● 가상 그림자 관찰';
const childAnswer='QA75 아이의 가상 풀이 ● 빛 반대편';
const uncommitted='QA75 부모가 작성 중인 확인 메모 ● 저장 전';
let preview,browser,checks=0;
const pass=label=>{checks++;console.log('PASS WRONG QA75 '+label)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const records=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({records:records.result,photos:photos.result})};
  };
 }),DB);
}
async function domLeaks(page){
 return page.evaluate(text=>({
  visible:document.body.innerText.includes(text),
  domText:document.body.textContent.includes(text),
  savedEditValue:document.querySelector('#memo')?.value.includes(text)||false,
  detailText:document.querySelector('#detail-memo')?.textContent.includes(text)||false,
  detailHeadingVisible:!!document.querySelector('#detail-memo')?.previousElementSibling?.getClientRects().length
 }),parentMemo);
}
try{
 const user='qa75-fake-local',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username:user,password});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({
  viewport:{width:320,height:760},deviceScaleFactor:1,
  acceptDownloads:false,httpCredentials:{username:user,password}});
 const page=await context.newPage(),errors=[],outside=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  if(!route.request().url().startsWith('blob:')&&!route.request().url().startsWith('data:'))
   outside.push(route.request().url());
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA75 가상 오답: 빛과 그림자');
 await page.locator('#student-answer').fill(childAnswer);
 await page.locator('#memo').fill(parentMemo);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await page.locator('#detail-memo').waitFor();
 assert.ok((await page.locator('#detail-memo').textContent()).includes(parentMemo));
 assert.ok((await page.locator('#detail-student-answer').textContent()).includes(childAnswer));
 const original=await snapshot(page);
 assert.equal(original.records.length,1);
 assert.deepEqual(original.photos,[]);
 assert.equal(original.records[0].memo,parentMemo);
 pass('parent creates a fictional record with a separate private note and child answer');

 // An unfinished parent observation must not be lost by switching view.
 await page.locator('#check-memo').fill(uncommitted);
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#check-memo').inputValue(),uncommitted);
 pass('unsaved parent observation is retained: child-mode switch is blocked');

 await page.locator('#check-memo').fill('');
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 let leak=await domLeaks(page);
 assert.deepEqual(leak,{visible:false,domText:false,savedEditValue:false,
  detailText:false,detailHeadingVisible:false},
  'child-mode record detail/editor still retains the private parent note');
 assert.ok((await page.locator('#detail-student-answer').textContent()).includes(childAnswer),
  'child answer is accidentally erased by parent memo redaction');
 pass('child detail hides parent heading and removes private memo from DOM and edit form');

 await page.locator('#nav-home').click();
 leak=await domLeaks(page);
 assert.equal(leak.domText,false);
 assert.equal(leak.savedEditValue,false);
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-text').waitFor();
 leak=await domLeaks(page);
 assert.equal(leak.domText,false);
 assert.equal(leak.savedEditValue,false);
 assert.equal(leak.detailText,false);
 assert.equal(leak.detailHeadingVisible,false);
 pass('revisiting the original record while in child mode cannot regenerate parent memo');

 await page.locator('#v218-parent-mode').click();
 await page.waitForFunction(m=>document.querySelector('#detail-memo')?.textContent?.includes(m),
  parentMemo,{timeout:16000});
 assert.equal(await page.locator('#detail-memo').isVisible(),true);
 await page.locator('#detail-edit').click();
 assert.equal(await page.locator('#memo').inputValue(),parentMemo);
 // Preserve existing draft safety when editing the actual stored memo.
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#memo').inputValue(),parentMemo);
 pass('parent return restores original note and protects edit draft on mode-switch attempt');

 await page.locator('#cancel-edit').click();
 const after=await snapshot(page);
 assert.deepEqual(after,original,'screen-only privacy changes must not alter stored child/family record');
 assert.deepEqual(errors,[],'actual browser JS error');
 assert.deepEqual(outside,[],'external network requests');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323,
  '320px overflow');
 pass('saved record/photo unchanged, external requests/errors/overflow zero');
 console.log('WRONG_QA75_RESULT='+JSON.stringify({
  status:'PASS',checks,realChromium:true,viewport:320,syntheticOnly:true,
  privateMemoAbsentInChildDom:true,storedRecordImmutable:true,photosModified:false,
  sourceDevSha:SHA,viewModeIsAuthentication:false,operationalIsolationVerified:false,
  safeToRestore:false,deployed:false}));
 await context.close();
}catch(error){
 console.error('WRONG_QA75_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(error),stack:String(error?.stack).slice(0,1500),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
