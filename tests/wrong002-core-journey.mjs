// WRONG-002: same actual app, one connected user journey per mobile viewport.
// Synthetic records only, no cloud Auth, Netlify, or real children.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
let checks=0;
async function check(width){
 const context=await browser.newContext({viewport:{width,height:850},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#nav-add').click();
  await page.locator('#problem').fill('WRONG-002 가상 자연수 덧셈 문제: 4 + 3 = ?');
  await page.locator('#student-answer').fill('6 (가상 오답)');
  await page.locator('#concept').selectOption('math.natural.addition');
  await page.locator('#save-btn').click();
  await page.locator('#wrong002-state').waitFor({timeout:25000});
  assert.match(await page.locator('#v09-save-confirm').innerText(),/저장소/);
  assert.match(await page.locator('#wrong002-state').innerText(),/다시 푼 기록 0회/);
  checks++;
  await page.locator('#wrong002-retry').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v230-answer');
  await page.locator('#v230-answer').fill('7');
  await page.locator('#v230-explanation').fill('가상의 4개와 3개를 더했음');
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
  checks++;
  await page.locator('#wrong002-plan').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v05-plan-date');
  await page.locator('#v05-plan-date').fill('2026-11-12');
  await page.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('2026-11-12'),null,{timeout:25000});
  checks++;
  await page.locator('#wrong002-outcome').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v06-review-outcome');
  await page.locator('#v06-review-outcome').selectOption('explained');
  await page.locator('#v06-review-memo').fill('가상 학부모 관찰: 스스로 설명함');
  await page.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
  checks++;
  await page.locator('#wrong002-report').click();
  assert.equal(await page.locator('#page-home').isVisible(),true);
  assert.equal(await page.locator('#v227-parent-report').isVisible(),true);
  checks++;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav-records').click();
  await page.locator('#records-list button.item').filter({hasText:'WRONG-002 가상'}).first().click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
  assert.match(await page.locator('#wrong002-state').innerText(),/다시 푼 기록 1회/);
  checks++;
  await page.locator('#v218-child-mode').click();
  assert.equal(await page.locator('#wrong002-retry').isVisible(),true);
  for(const id of ['#wrong002-plan','#wrong002-outcome','#wrong002-report','#v05-followup','#v06-review-cycle']){
    assert.equal(await page.locator(id).isVisible(),false,id+' visible in child presentation mode');
  }
  checks++;
  assert.deepEqual(errors,[], 'browser errors');
  console.log('PASS WRONG002',width+'px', 'saved -> retry -> parent plan -> observation -> report -> reload -> child view');
 }finally{await context.close()}
}
try{for(const width of [320,390])await check(width);console.log('WRONG002_JOURNEY_QA_RESULT='+JSON.stringify({status:'PASS',checks,views:2,realStudents:0,productionApproved:false}))}
finally{await browser.close()}
