// QA37 NEW UI only: actual localhost Chromium 320/390px parent memo preview.
// Synthetic text and independent browser contexts, no real families/backup.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const APP='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
function pass(message){checks++;console.log('PASS WRONG QA37 NOTE BROWSER',message)}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const r=tx.objectStore('mistakes').getAll(),p=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:r.result,photoKeys:p.result})}
  };
 }),DB)
}
async function check(width){
 const ctx=await browser.newContext({viewport:{width,height:780}});
 const other=await browser.newContext({viewport:{width,height:780}});
 const page=await ctx.newPage(),second=await other.newPage(),errors=[];
 page.on('pageerror',err=>errors.push('A '+String(err)));
 second.on('pageerror',err=>errors.push('B '+String(err)));
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.locator('#nav-add').click();
  await page.locator('#problem').fill('가상 아이의 확인 메모 시험 문제 '+width);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:14000});
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#check-status').selectOption('needs_help');
  const note='첫 질문에서는 분모가 왜 같은지 물어보기 '+('다음에는 그림을 직접 보여 주며 질문 '.repeat(6))+' <b>가상 텍스트</b>';
  await page.locator('#check-memo').fill(note);
  await page.locator('#check-save').click();
  await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('도움이 필요'),null,{timeout:12000});
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  await page.locator('#nav-home').click();
  const item=page.locator('#wrong-parent-needs-help-queue button[data-record]');
  await item.waitFor();
  assert.equal(await item.count(),1);
  const preview=item.locator('.wrong-parent-note-preview');
  assert.ok((await preview.textContent()).startsWith('최근 부모 확인 메모: 첫 질문에서는 분모가 왜 같은지'));
  assert.ok((await preview.textContent()).includes('<b>가상 텍스트</b>'));
  const display=await preview.evaluate(el=>({
   width:el.clientWidth,contentWidth:el.scrollWidth,
   whiteSpace:getComputedStyle(el).whiteSpace,
   overflow:getComputedStyle(el).overflow,
   textOverflow:getComputedStyle(el).textOverflow,
   htmlChildren:el.children.length
  }));
  assert.equal(display.whiteSpace,'nowrap');
  assert.equal(display.overflow,'hidden');
  assert.equal(display.textOverflow,'ellipsis');
  assert.equal(display.htmlChildren,0,'untrusted memo was parsed as HTML');
  assert.ok(display.contentWidth>display.width,'long memo must actually elide');
  const rootWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(rootWidth<=width+2,'one-line note caused horizontal overflow at '+width);
  assert.deepEqual(await snapshot(page),before);
  pass(width+'px: 부모 홈에서 실제 메모 한 줄 말줄임, 악성 유사 HTML은 텍스트, 원본 기록 불변');

  await item.click();
  await page.locator('#detail-text').waitFor();
  assert.ok((await page.locator('#detail-text').textContent()).includes('가상 아이의 확인 메모'));
  await page.locator('#check-status').selectOption('needs_help');
  await page.locator('#check-memo').fill('이제 곱셈식을 먼저 설명해 달라고 질문');
  await page.locator('#check-save').click();
  await page.waitForFunction(()=>document.querySelector('#check-history')?.querySelectorAll('.tagline').length===2,
   null,{timeout:12000});
  await page.locator('#nav-home').click();
  assert.equal(await page.locator('#wrong-parent-needs-help-queue .wrong-parent-note-preview').textContent(),
   '최근 부모 확인 메모: 이제 곱셈식을 먼저 설명해 달라고 질문');
  pass(width+'px: 동일 문제의 실제 최신 부모 메모로 즉시 갱신, 예전 긴 메모 미표시');

  // A later real parent review of a generic retry WITHOUT its own note
  // must never reuse an older detailed-check memo as if it were current.
  await page.locator('#wrong-parent-needs-help-queue button[data-record]').click();
  await page.locator('#v230-answer').fill('다시 푼 가상 답');
  await page.locator('#v230-explanation').fill('가상 아이가 적은 다시 푼 이유');
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),
   null,{timeout:14000});
  await page.locator('#v230-review').selectOption('needs_help');
  await page.locator('#v230-review-save').click();
  await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&
    !document.querySelector('#v230-review-save')?.disabled,null,{timeout:14000});
  const afterReview=await snapshot(page);
  await page.locator('#nav-home').click();
  assert.equal(await page.locator('#wrong-parent-needs-help-queue .wrong-parent-note-preview').textContent(),
   '최근 관찰 메모 없음 · 원문에서 확인');
  assert.deepEqual(await snapshot(page),afterReview);
  pass(width+'px: 재풀이의 더 최근 메모 없는 부모 관찰은 예전 메모를 사용하지 않음');

  await page.locator('#v218-child-mode').click();
  assert.equal(await page.locator('#wrong-parent-needs-help-queue').isVisible(),false);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await page.locator('#wrong-parent-needs-help-queue').isVisible(),true);
  assert.deepEqual(await snapshot(page),afterReview);
  pass(width+'px: 아이 화면에서 부모 메모 비노출, 부모 복귀해도 IndexedDB 원본 그대로');

  await second.goto(APP,{waitUntil:'domcontentloaded'});
  const unrelated=await snapshot(second);
  assert.equal(unrelated.rows.length,0);
  assert.equal(await second.locator('#wrong-parent-needs-help-queue button[data-record]').count(),0);
  assert.deepEqual(errors,[]);
  pass(width+'px: 독립 브라우저에 A의 오답/메모 0건, JS 오류 0');
 }finally{await ctx.close();await other.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const w of [320,390])await check(w);
 console.log('WRONG_QA37_NOTE_CHROMIUM_RESULT='+JSON.stringify({status:'PASS',
  checks,viewports:[320,390],parentOnly:true,noStaleMemo:true,oneLine:true,
  readOnlyPreview:true,realFamilyAuth:false,safeToRestore:false,deployment:false}));
}catch(error){
 console.error('WRONG_QA37_NOTE_CHROMIUM_RESULT='+JSON.stringify({status:'FAIL',
  checks,error:String(error),stack:String(error?.stack).slice(0,1200),
  safeToRestore:false}));process.exitCode=1;
}finally{if(browser)await browser.close()}
