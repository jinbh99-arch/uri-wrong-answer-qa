// WRONG QA54: NEW dev P17/P18/P19 actual Chromium only. Synthetic local data.
// Tests browser list filters at 320/390px + CSS 200% and in-app return.
// No production, account, photo, auth, backup, or real family data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const APP='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG DEV QA54 CHROMIUM '+s)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photoIds:photos.result})};
  };
 }),DB);
}
async function addRecord(page,title){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#nav-records').click();
 await page.locator('#wrong-dev-p17-filter').selectOption('all');
 const row=page.locator('#records-list button[data-record]').filter({hasText:title});
 await row.waitFor();
 assert.equal(await row.count(),1);
 await row.click();
 await page.locator('#detail-text').waitFor();
 return row;
}
async function retry(page,title){
 await page.locator('#v230-answer').fill('가상 아이의 풀이: '+title);
 await page.locator('#v230-explanation').fill('가상 아이가 문제 조건을 다시 읽은 과정 '+title);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:20000});
}
async function run(width){
 const ctx=await browser.newContext({viewport:{width,height:780},acceptDownloads:false});
 const other=await browser.newContext({viewport:{width,height:780}});
 const page=await ctx.newPage(),guest=await other.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 guest.on('pageerror',e=>errors.push('unrelated '+String(e)));
 const a='QA54 가상 설명 미관찰 '+width,b='QA54 가상 수동 확인 예정 '+width;
 const today=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await addRecord(page,a);
  await retry(page,a);
  await page.locator('#nav-records').click();
  await addRecord(page,b);
  await retry(page,b);
  await page.locator('#v230-review').selectOption('needs_help');
  await page.locator('#v230-review-save').click();
  await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&
    !document.querySelector('#v230-review-save')?.disabled,null,{timeout:17000});
  await page.locator('#wrong008-next-date').fill(today);
  await page.locator('#wrong008-next-question').fill('가상 아이에게 다시 설명 부탁하기');
  await page.locator('#wrong008-save-note').click();
  await page.waitForFunction(day=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),today,{timeout:18000});
  await page.locator('#nav-records').click();
  const sel=page.locator('#wrong-dev-p17-filter');
  const list=page.locator('#records-list button[data-record]');
  assert.equal(await list.count(),2);
  assert.equal(await sel.isVisible(),true);
  assert.ok((await sel.boundingBox()).width>0);
  assert.deepEqual(await sel.locator('option').evaluateAll(os=>os.map(o=>o.value)),['all','pending','manual']);
  pass(width+'px saved actual child explanation + parent manual follow-up, one accessible select');

  const before=await snapshot(page);
  assert.equal(before.rows.length,2);
  assert.equal(before.photoIds.length,0);
  await sel.selectOption('pending');
  assert.equal(await list.filter({visible:true}).count(),1);
  assert.ok((await list.filter({visible:true}).textContent()).includes(a));
  pass(width+'px saved unreviewed child explanation only (real browser filtering)');

  await sel.selectOption('manual');
  assert.equal(await list.filter({visible:true}).count(),1);
  assert.ok((await list.filter({visible:true}).textContent()).includes(b));
  await page.locator('#wrong007-filter-subject').selectOption('math');
  assert.equal(await list.filter({visible:true}).count(),0);
  await page.locator('#wrong007-filter-subject').selectOption('science');
  assert.equal(await list.filter({visible:true}).count(),1);
  pass(width+'px manual-date vs pending and subject filter composed');

  await page.locator('#v218-child-mode').click();
  assert.equal(await sel.isVisible(),false);
  assert.equal(await list.filter({visible:true}).count(),2);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await list.filter({visible:true}).count(),1);
  assert.equal(await sel.inputValue(),'manual');
  pass(width+'px parent-only filter blocked in child mode; parent restores selection');

  const viewportWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(viewportWidth<=width+3,'normal mobile horizontal overflow '+width+' -> '+viewportWidth);
  pass(width+'px list normal zoom no horizontal overflow');
  // Browser 200% text/zoom simulation; check real click navigation and return.
  await page.evaluate(()=>{document.documentElement.style.zoom='2'});
  await sel.selectOption('pending');
  assert.equal(await list.filter({visible:true}).count(),1);
  const target=list.filter({visible:true}).first();
  await target.scrollIntoViewIfNeeded();
  assert.ok((await target.boundingBox()).width>0);
  await target.click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(a));
  const back=page.locator('#page-detail [data-route="records"]');
  await back.click();
  assert.equal(await sel.inputValue(),'pending');
  assert.equal(await list.filter({visible:true}).count(),1);
  const zoomWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  console.log('WRONG_QA54_ZOOM_METRIC='+JSON.stringify({width,zoom:200,documentWidth:zoomWidth,overflow:Math.max(0,zoomWidth-width)}));
  pass(width+'px zoom 200% filter actionable, correct existing record and original back return');
  await page.evaluate(()=>{document.documentElement.style.zoom='1'});
  assert.deepEqual(await snapshot(page),before,'filtering and navigation must not write family records');
  pass(width+'px real IndexedDB rows + photo keys identical after all filter actions');

  await guest.goto(APP,{waitUntil:'domcontentloaded'});
  const g=await snapshot(guest);
  assert.equal(g.rows.length,0);
  assert.equal(g.photoIds.length,0);
  // App starts on home, where record-list controls are correctly hidden.
  await guest.locator('#nav-records').click();
  assert.equal(await guest.locator('#wrong-dev-p17-filter').isVisible(),true);
  assert.deepEqual(errors,[]);
  pass(width+'px unrelated isolated browser empty, no JavaScript exception');
 }finally{await ctx.close();await other.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])await run(width);
 console.log('WRONG_DEV_QA54_BROWSER_RESULT='+JSON.stringify({status:'PASS',checks,
 chromiumViewports:[320,390],zoom200:true,syntheticLocalOnly:true,
 DBWritesByFilter:0,physicalPhones:0,productionAuth:false,safeToRestore:false,deployed:false}));
}catch(error){
 console.error('WRONG_DEV_QA54_BROWSER_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1600),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
