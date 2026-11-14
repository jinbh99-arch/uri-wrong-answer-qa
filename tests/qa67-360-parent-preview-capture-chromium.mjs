// QA67: NEW 360px screenshot evidence of the actual DEV parent flow.
// Synthetic family only. Extends QA66 loopback infrastructure without re-running QA66.
// No public hosting, production API, real photos, or real child records.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA67_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const OUT='qa67-fictional-360-screenshots';
const DB='uriaimath-github-qa-v224-only';
const user='qa67-local-parent';
const password=randomBytes(32).toString('hex');
let browser,preview,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA67 '+s)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photoKeys:photos.result})};
  };
 }),DB);
}
async function screen(page,name){
 await page.screenshot({path:OUT+'/'+name+'.png',fullPage:false,animations:'disabled'});
}
try{
 preview=await startWrongQa66Preview({devSha:SHA,username:user,password});
 assert.equal(preview.host,'127.0.0.1');
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:1,
  httpCredentials:{username:user,password},acceptDownloads:false});
 const page=await ctx.newPage();
 const errors=[],outgoing=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))outgoing.push(url);
  return route.abort();
 });
 await mkdir(OUT,{recursive:true});
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 assert.equal((await snapshot(page)).rows.length,0);
 await screen(page,'01-empty-parent');
 pass('360px parent landing captured with explicit DEV source SHA and empty synthetic records');

 const title='QA67 가상 과학 오답: 그림자 방향';
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#nav-records').click();
 const row=page.locator('#records-list button[data-record]').filter({hasText:title});
 assert.equal(await row.count(),1);
 await row.click();
 await page.locator('#detail-text').waitFor();
 await page.locator('#v230-answer').fill('가상 아이 답: 오른쪽');
 await page.locator('#v230-explanation').fill('가상 아이 설명: 빛이 왼쪽에서 오면 그림자는 오른쪽에 생김');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:16000});
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill('가상 부모 관찰: 그림을 그려 다시 설명해 봄');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('가상 부모 관찰'),null,{timeout:16000});
 const day=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(day);
 await page.locator('#wrong008-next-question').fill('가상 재확인: 빛의 방향을 바꾸면 어떻게 되나요?');
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),day,{timeout:16000});
 await screen(page,'02-child-explanation-parent-observation');
 const original=await snapshot(page);
 assert.equal(original.rows.length,1);
 assert.equal(original.photoKeys.length,0);
 pass('360px actual child explanation, parent observation and next-check memo captured');

 await page.locator('#nav-records').click();
 await page.locator('#wrong-dev-p17-filter').selectOption('manual');
 assert.equal(await page.locator('#records-list button[data-record]:visible').count(),1);
 const normalWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(normalWidth<=363,'360px horizontal overflow: '+normalWidth);
 await screen(page,'03-parent-followup-records');
 pass('360px parent manual follow-up filter visible with no horizontal overflow');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-dev-p17-filter').isVisible(),false);
 await screen(page,'04-child-no-parent-filter');
 await page.locator('#v218-parent-mode').click();
 assert.equal(await page.locator('#wrong-dev-p17-filter').isVisible(),true);
 pass('child view hides parent-only follow-up filter; screenshot captured');

 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 const visible=page.locator('#records-list button[data-record]:visible').first();
 await visible.scrollIntoViewIfNeeded();
 await visible.click();
 await page.locator('#detail-text').waitFor();
 assert.ok((await page.locator('#detail-text').textContent()).includes(title));
 await screen(page,'05-parent-detail-200pct');
 await page.locator('#page-detail [data-route=records]').click();
 assert.equal(await page.locator('#wrong-dev-p17-filter').inputValue(),'manual');
 await page.evaluate(()=>{document.documentElement.style.zoom='1'});
 assert.deepEqual(await snapshot(page),original);
 assert.deepEqual(errors,[]);
 assert.deepEqual(outgoing,[]);
 pass('200% zoom details and return, data unchanged, no JS exceptions or external requests');
 await ctx.close();
 console.log('WRONG_QA67_RESULT='+JSON.stringify({status:'PASS',checks,screenshots:5,
  viewport:360,zoom200:true,sourceDevSha:SHA,fictionalOnly:true,
  hostedAccessVerified:false,operationalStorageSeparationVerified:false,
  safeToRestore:false,deployed:false}));
}catch(error){
 console.error('WRONG_QA67_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(error),
  stack:String(error?.stack).slice(0,1600),safeToRestore:false,deployed:false}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
}
