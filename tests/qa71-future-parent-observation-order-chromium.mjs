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
 await page.waitForTimeout(35);
 await registerWithParent(page,futureTitle);
 const before=await snapshot(page);
 assert.equal(before.records.length,2);
 assert.deepEqual(before.photos,[]);
 const valid=before.records.find(r=>r.problemText===validTitle);
 const future=before.records.find(r=>r.problemText===futureTitle);
 assert.ok(valid?.id&&future?.id);
 await page.locator('#nav-home').click();
 await page.locator('#wrong-parent-needs-help-queue button[data-record]').first().waitFor();
 assert.equal((await order(page))[0].id,future.id,'newer valid observation should be first before future mutation');
 pass('360px two fictional parent observations initially sorted by valid recency');

 // Change exactly ONE fictional parent observation timestamp, never real data.
 // The test simulates malformed future source evidence without app UI writes.
 const stored=await page.evaluate(async({dbName,recordId})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
   const get=store.get(recordId);
   get.onerror=()=>reject(get.error);
   get.onsuccess=()=>{
    const r=get.result;
    if(!r){reject(Error('synthetic record not found'));return}
    const reviews=(r.checkHistory||[]).filter(x=>x?.status==='needs_help');
    if(reviews.length!==1){reject(Error('unexpected count of fictional parent reviews'));return}
    reviews[0].at=new Date(Date.now()+86400000).toISOString();
    store.put(r);
   };
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve(true)};
  };
 }),{dbName:DB,recordId:future.id});
 assert.equal(stored,true);
 const injected=await snapshot(page);
 assert.equal(injected.records.length,2);
 assert.deepEqual(injected.photos,[]);
 const sameValid=injected.records.find(r=>r.id===valid.id);
 assert.deepEqual(sameValid,valid,'other genuine observation must not be modified');
 pass('single fictional future timestamp injection leaves other record and photos unchanged');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#wrong-parent-needs-help-queue button[data-record]').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('#wrong-parent-needs-help-queue button[data-record]').length===2);
 const rows=await order(page);
 assert.deepEqual(rows.map(x=>x.id),[valid.id,future.id],
  'valid parent observation must outrank future, even if future was previously newest');
 assert.match(rows[1].age,/관찰일 확인 불가/);
 assert.ok(!rows[0].age.includes('확인 불가'));
 pass('REAL Chromium queue puts genuine reviewed parent first, future-stamped last with unknown-date label');

 const after=await snapshot(page);
 assert.deepEqual(after,injected,'render/reload/sort must not rewrite saved family records');
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
