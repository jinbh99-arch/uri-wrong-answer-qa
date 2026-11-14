// WRONG QA63: brand-new parent stage integration, real synthetic Chromium.
// Verify separately saved parent check + later child retry; no real data/auth.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA63 CHROMIUM '+s)};
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(dbName);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photoIds:photos.result})};
  };
 }),DB);
}
async function run(width){
 const context=await browser.newContext({viewport:{width,height:780}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const title='QA63 가상 다른 시점 부모 관찰 '+width;
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(title);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').filter({hasText:title}).click();
  await page.locator('#check-status').selectOption('needs_help');
  await page.locator('#check-memo').fill('가상 이전 부모 관찰: 도형 설명 도움 필요');
  await page.locator('#check-save').click();
  await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('가상 이전 부모 관찰'),null,{timeout:18000});
  await page.locator('#v230-answer').fill('가상 재풀이');
  await page.locator('#v230-explanation').fill('가상의 아이가 문장으로 풀이를 설명');
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:18000});
  await page.locator('#nav-records').click();
  const stage=page.locator('#records-list [data-record-stage]');
  await stage.waitFor();
  assert.equal(await stage.count(),1);
  const label=await stage.textContent();
  assert.match(label,/② 이번 아이 설명 · 이번 재풀이 부모 확인 전/);
  assert.match(label,/별도 부모 관찰 이력: 도움 필요/);
  assert.match(label,/이번 아이 재풀이에 대한 판단인지 확인 전/);
  pass(width+'px saved parent needs-help and later unreviewed child retry both correctly visible');
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  assert.equal(before.rows[0].checkHistory.length,1);
  assert.equal(before.rows[0].generalRetryHistory.length,1);
  assert.equal(before.rows[0].generalRetryHistory[0].review,'not_checked');
  pass(width+'px actual saved parent check and latest child retry remain separate records');
  await page.locator('#v218-child-mode').click();
  assert.equal(await stage.isVisible(),false);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await stage.isVisible(),true);
  pass(width+'px historical parent status never appears in child view');
  const widthUsed=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(widthUsed<=width+3,'horizontal page overflow: '+widthUsed);
  pass(width+'px parent two-context status wraps without sideways overflow');
  await page.locator('#records-list button[data-record]').click();
  await page.locator('#check-history').waitFor();
  assert.match(await page.locator('#check-history').textContent(),/가상 이전 부모 관찰/);
  await page.locator('#nav-records').click();
  assert.deepEqual(await snapshot(page),before);
  assert.deepEqual(errors,[]);
  pass(width+'px original parent observation retained and no navigation writes/JS errors');
 }finally{await context.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])await run(width);
 console.log('WRONG_QA63_BROWSER_RESULT='+JSON.stringify({status:'PASS',checks,
 viewports:[320,390],kind:'actual Chromium synthetic local parent+retry integration',
 realFamilies:0,realPhones:false,safeToRestore:false,deployed:false}));
}catch(e){
 console.error('WRONG_QA63_BROWSER_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1500),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
