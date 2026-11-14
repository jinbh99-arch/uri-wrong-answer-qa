// WRONG QA59: actual CURRENT dev equivalence for prior P15, P16,
// first-use and original in-app back. Never import old experimental code.
// Synthetic localhost, disposable math-free typed problem and parent events.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/wrong-dev-record-stage/);
assert.match(html,/data-route="records">← 목록으로/);
assert.match(html,/guide\.id='wrong003-first-visit'/);
assert.match(html,/guide\.classList\.toggle\('hide',records\.length!==0\)/);
assert.match(html,/wrongAOnlyNavigateBase=navigate/);
assert.doesNotMatch(html,/wrongScopedDetailOnly|wrongHistoryQa/);
const BASE='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
let checks=0,browser;
const pass=name=>{checks++;console.log('PASS WRONG QA59 '+name)};
async function stored(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(dbName);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rec=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:rec.result,photoIds:photos.result})};
  };
 }),DB);
}
async function inView(page,selector){
 return page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();
  return {top:r.top,bottom:r.bottom,height:innerHeight,visible:r.top>=0&&r.bottom<=innerHeight};
 });
}
async function exercise(width){
 const context=await browser.newContext({viewport:{width,height:780}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 const title='QA59 가상 첫 오답 설명 '+width;
 const next=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const initialHistory=await page.evaluate(()=>history.length);
  assert.equal((await stored(page)).rows.length,0);
  const first=page.locator('#wrong003-first-visit');
  await first.waitFor();
  assert.equal(await first.isVisible(),true);
  assert.equal(await page.locator('#wrong003-text-start').isVisible(),true);
  pass(width+'px v1 first-use parent guidance when no saved records');

  await page.locator('#v218-child-mode').click();
  assert.equal(await first.isVisible(),false);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await first.isVisible(),true);
  pass(width+'px first-use guidance is parent-only; child is not asked to edit');

  await page.locator('#wrong003-text-start').click();
  await page.locator('#page-add:visible').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'problem');
  assert.equal((await stored(page)).rows.length,0);
  pass(width+'px first-use action directly focuses original text field with no premature save');

  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(title);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
  await page.locator('#nav-home').click();
  assert.equal(await first.isVisible(),false);
  pass(width+'px first-use prompt hides after first saved record');

  await page.locator('#nav-records').click();
  const stage=page.locator('#records-list [data-record-stage]');
  await stage.waitFor();
  assert.equal(await stage.count(),1);
  assert.match(await stage.textContent(),/① 아이 재풀이 기록 전/);
  assert.match(await stage.textContent(),/알림·예약·완료 아님/);
  const list=page.locator('#records-list button[data-record]');
  assert.equal(await list.count(),1);
  pass(width+'px P15 original saved pre-retry stage, distinct from any reminder');

  await page.locator('#v218-child-mode').click();
  assert.equal(await stage.isVisible(),false);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await stage.isVisible(),true);
  pass(width+'px P15/P16 stage never shows in child list');

  await list.first().click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(title));
  await page.locator('#v230-answer').fill('가상 아이 재풀이 7');
  await page.locator('#v230-explanation').fill('가상의 아이가 문장을 소리 내어 읽었음');
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:20000});
  await page.locator('#nav-records').click();
  assert.match(await stage.textContent(),/② 아이 설명 기록 · 부모 관찰 전/);
  pass(width+'px P15/P16 stage advances only after actually saved child explanation');

  await list.first().click();
  await page.locator('#v230-review').selectOption('needs_help');
  await page.locator('#v230-review-save').click();
  await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help',null,{timeout:18000});
  await page.locator('#wrong008-next-date').fill(next);
  await page.locator('#wrong008-next-question').fill('가상 다음 확인 질문');
  await page.locator('#wrong008-save-note').click();
  await page.waitForFunction(day=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),next,{timeout:20000});
  await page.locator('#nav-records').click();
  assert.match(await stage.textContent(),/③ 부모 관찰 기록 있음/);
  assert.ok((await stage.textContent()).includes(next));
  assert.match(await stage.textContent(),/수동 메모\(알림·예약·완료 아님\)/);
  assert.equal(await stage.isVisible(),true);
  const size=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(size<=width+3,'P16 list horizontal overflow at '+width+' px: '+size);
  pass(width+'px P16 compact observed stage and valid manual date, zero horizontal overflow');

  const afterSaved=await stored(page);
  assert.equal(afterSaved.rows.length,1);
  assert.equal(afterSaved.photoIds.length,0);
  await page.evaluate(()=>{document.documentElement.style.zoom='2'});
  const row=list.first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes(title));
  const back=page.locator('#page-detail [data-route="records"]');
  await page.waitForFunction(()=>{
   const b=document.querySelector('#page-detail [data-route="records"]')?.getBoundingClientRect();
   return b&&b.top>=0&&b.bottom<=innerHeight;
  },null,{timeout:3000});
  assert.equal((await inView(page,'#page-detail [data-route="records"]')).visible,true);
  pass(width+'px v1 actual original in-app back control visible after 200% detail navigation');

  await back.click();
  const filter=page.locator('#wrong-dev-p17-filter');
  await page.waitForFunction(()=>{
   const el=document.getElementById('wrong-dev-p17-filter');
   if(!el)return false;const b=el.getBoundingClientRect();
   return b.top>=0&&b.bottom<=innerHeight;
  },null,{timeout:3000});
  assert.equal((await inView(page,'#wrong-dev-p17-filter')).visible,true);
  assert.equal(await filter.inputValue(),'all');
  assert.match(await stage.textContent(),/③ 부모 관찰 기록 있음/);
  pass(width+'px v1 in-app back returns to original list with saved stage and filter');

  assert.equal(await page.evaluate(()=>history.length),initialHistory);
  assert.deepEqual(await stored(page),afterSaved);
  assert.deepEqual(errors,[]);
  pass(width+'px browser History experimental pushState absent; original records unchanged');
 }finally{await context.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])await exercise(width);
 console.log('WRONG_QA59_RESULT='+JSON.stringify({
  status:'PASS',checks,source:'dev',kind:'new real Chromium 320/390 + zoom 200 synthetic browser journeys',
  decisions:{p15:'equivalent',p16:'equivalent',scopedBrowserBack:'excluded_QA_only',
   v1FirstUse:'equivalent',v1InAppBack:'equivalent'},
  realPhones:false,realChildren:0,realAuth:false,safeToRestore:false,deployed:false
 }));
}catch(err){
 console.error('WRONG_QA59_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1600),
  safeToRestore:false
 }));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
