// QA55: compare old P13/P14/P18/P19 user journeys with CURRENT dev in
// real headless Chromium. Synthetic localhost only, no persistent app writes
// except explicitly-created disposable fictional records for browser testing.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA55 '+s)};
async function stored(page){return page.evaluate(dbName=>new Promise((resolve,reject)=>{
 const req=indexedDB.open(dbName);
 req.onerror=()=>reject(req.error);
 req.onsuccess=()=>{
  const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
   rows=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
  tx.onerror=()=>{db.close();reject(tx.error)};
  tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photos:photos.result})};
 }
}),DB)}
async function register(page,title,retry){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#nav-records').click();
 const row=page.locator('#records-list button[data-record]').filter({hasText:title});
 await row.waitFor();await row.click();
 await page.locator('#detail-text').waitFor();
 if(retry){
  await page.locator('#v230-answer').fill('가상 풀이 '+title);
  await page.locator('#v230-explanation').fill('조건을 말로 설명한 기록 '+title);
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:18000});
 }
}
async function area(page,selector){
 return page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return {
  top:Math.round(b.top),bottom:Math.round(b.bottom),height:Math.round(b.height),
  visible:b.top>=0&&b.bottom<=innerHeight,focus:document.activeElement?.id,
  scrollY:Math.round(scrollY),innerHeight,zoom:document.documentElement.style.zoom||'1'
 }});
}
async function exercise(width){
 const ctx=await browser.newContext({viewport:{width,height:720}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 const a='QA55 첫째 오답 '+width,b='QA55 둘째 오답 '+width,c='QA55 마지막 등록만 한 오답 '+width;
 try{
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await register(page,a,true);
  await page.waitForTimeout(60);
  await register(page,b,true);
  await register(page,c,false);
  const prior=await stored(page);
  assert.equal(prior.rows.length,3);
  assert.equal(prior.photos.length,0);
  pass(width+'px fictional original records A/B pending, C newest created, no real photos');
  await page.locator('#nav-home').click();
  const qa9=page.locator('#qa9-next-open');
  await qa9.waitFor();
  const selected=await qa9.getAttribute('data-record');
  const expected=prior.rows.find(r=>r.problemText===b)?.id;
  assert.equal(selected,expected,'P14 parent priority must use newest saved pending explanation, not C last created');
  assert.match(await qa9.textContent(),/아이 설명 보고 부모가 관찰하기/);
  pass(width+'px P13/P14 parent one CTA prioritizes latest review-needed B over newest C');
  await qa9.click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(b));
  console.log('WRONG_QA55_P13_PARENT_FOCUS='+JSON.stringify({width,
   reason:await area(page,'#v230-review'),currentFocus:await page.evaluate(()=>document.activeElement?.id)}));
  pass(width+'px P13 parent first click goes to saved original B detail');

  await page.locator('#nav-home').click();
  await page.locator('#v218-child-mode').click();
  const child=page.locator('#wrong-child-next-list button[data-wrong-child-pick]');
  await child.first().waitFor();
  assert.ok((await child.first().textContent()).includes(c),'Child neutral recency picks latest C');
  await child.first().click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(c));
  await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',null,{timeout:6500});
  pass(width+'px P14 child selects latest registered C and focuses actual retry answer');

  await page.locator('#v218-parent-mode').click();
  await page.locator('#nav-home').click();
  await page.evaluate(()=>{document.documentElement.style.zoom='2'});
  await page.locator('#nav-records').click();
  await page.locator('#wrong-dev-p17-filter').waitFor();
  await page.waitForTimeout(100);
  const filterBefore=await area(page,'#wrong-dev-p17-filter');
  console.log('WRONG_QA55_P19_RECORD_ENTRY='+JSON.stringify({width,filterBefore}));
  // No immediate failure: report evidence before selecting P19 behavior as missing.
  assert.ok((await page.locator('#records-list button[data-record]').count())===3);
  await page.locator('#wrong-dev-p17-filter').selectOption('pending');
  assert.equal(await page.locator('#records-list button[data-record]:visible').count(),2);
  const target=page.locator('#records-list button[data-record]:visible').filter({hasText:b});
  await target.click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(b));
  console.log('WRONG_QA55_P19_DETAIL='+JSON.stringify({width,back:await area(page,'#page-detail [data-route=records]')}));
  await page.locator('#page-detail [data-route=records]').click();
  assert.equal(await page.locator('#wrong-dev-p17-filter').inputValue(),'pending');
  assert.equal(await page.locator('#records-list button[data-record]:visible').count(),2);
  const filterAfter=await area(page,'#wrong-dev-p17-filter');
  console.log('WRONG_QA55_P19_RECORD_RETURN='+JSON.stringify({width,filterAfter}));
  pass(width+'px P18/P19 200% source -> records returns correct two pending and retains selection');
  await page.evaluate(()=>{document.documentElement.style.zoom='1'});
  assert.deepEqual(await stored(page),prior);
  assert.deepEqual(errors,[]);
  pass(width+'px P13/P14/P18/P19 navigation leaves synthetic IndexedDB unchanged and has no JS errors');
 }finally{await ctx.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const w of [320,390])await exercise(w);
 console.log('WRONG_QA55_RESULT='+JSON.stringify({status:'PASS',checks,type:'actual Chromium 320/390px and CSS zoom 200',release:false,
  realChildren:0,realAuth:false,realPhone:false,originalRecordsPreserved:true,safeToRestore:false}));
}catch(error){
 console.error('WRONG_QA55_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1500),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
