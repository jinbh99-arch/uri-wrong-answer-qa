// WRONG QA62: intentional history-DOM row mismatch in ACTUAL Chromium.
// Creates fictional local records and injects one display-only tagline row
// (not present in checkHistory) to expose legacy count-gated source IDs.
// Tests two saved source buttons and the unchanged return path at 320/390px.
// Nothing uses operational auth/DB, real photos, account or deployment.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA62 CHROMIUM '+s)};
async function snapshot(page){return page.evaluate(name=>new Promise((resolve,reject)=>{
 const req=indexedDB.open(name);
 req.onerror=()=>reject(req.error);
 req.onsuccess=()=>{
  const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
   rows=tx.objectStore('mistakes').getAll(),
   images=tx.objectStore('photos').getAllKeys();
  tx.onerror=()=>{db.close();reject(tx.error)};
  tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photoIds:images.result})};
 };
}),DB)}
async function scenario(width,kind){
 const context=await browser.newContext({viewport:{width,height:790}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 // The extra row is intentionally a tagline, which defeats all previous
 // 'visible tagged rows === saved checkHistory entries' anchor assignments.
 await page.addInitScript(()=>{
  const oldAppend=Element.prototype.append;
  const oldReplace=Element.prototype.replaceChildren;
  Element.prototype.replaceChildren=function(...nodes){
   if(this.id==='check-history')delete this.dataset.qaExtraTagline;
   return oldReplace.apply(this,nodes);
  };
  Element.prototype.append=function(...nodes){
   if(this.id==='check-history'&&!this.dataset.qaExtraTagline&&
      nodes.some(node=>node?.classList?.contains('tagline'))){
    this.dataset.qaExtraTagline='1';
    const noise=document.createElement('div');
    noise.className='tagline';noise.id='wrong-qa62-extra-tagline';
    noise.textContent='QA synthetic screen-only note, not an observation';
    oldAppend.call(this,noise);
   }
   return oldAppend.apply(this,nodes);
  };
 });
 const title='QA62 가상 관찰행 검증 '+kind+' '+width;
 const memo=kind==='question'?'학부모 질문: 왜 이렇게 답했나요?':'아이가 다시 설명할 때 그림이 필요함';
 try{
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(title);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').filter({hasText:title}).click();
  await page.locator('#check-status').selectOption('needs_help');
  await page.locator('#check-memo').fill(memo);
  await page.locator('#check-save').click();
  await page.waitForFunction(memo=>document.querySelector('#check-history')?.textContent?.includes(memo),memo,{timeout:20000});
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  assert.equal(before.rows[0].checkHistory.length,1);
  assert.equal(before.photoIds.length,0);
  const tagged=page.locator('#check-history > .tagline');
  assert.equal(await tagged.count(),2,'synthetic decorative row must break old equality');
  const exact=page.locator('#wrong-parent-time-check-0');
  assert.equal(await exact.count(),1);
  assert.ok((await exact.textContent()).includes(memo));
  pass(width+'px '+kind+' saved row has direct ID despite tagged row count 2 vs history 1');

  await page.locator('#nav-home').click();
  const jump=kind==='question'?page.locator('.wrong-parent-question-source-jump'):
   page.locator('.wrong-parent-memo-source-jump');
  await jump.waitFor({state:'visible'});
  await jump.click();
  await page.waitForFunction(()=>document.activeElement?.id==='wrong-parent-time-check-0',
   null,{timeout:12000});
  assert.ok((await page.locator('#wrong-parent-time-check-0').textContent()).includes(memo));
  const bounds=await page.locator('#wrong-parent-time-check-0').evaluate(el=>{
   const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,innerHeight};
  });
  console.log('WRONG_QA62_ANCHOR_METRIC='+JSON.stringify({width,kind,bounds,
   active:await page.evaluate(()=>document.activeElement?.id)}));
  assert.ok(bounds.top>=0&&bounds.bottom<=bounds.innerHeight,
   'source anchor must be visible in viewport');
  assert.equal(await page.locator('#check-history > .tagline').count(),2);
  pass(width+'px '+kind+' original saved parent row is focused and visible (not fake tagline)');

  const back=page.locator(kind==='question'?'#wrong-parent-question-back':'#wrong-parent-memo-back');
  await back.waitFor({state:'visible'});
  await back.click();
  await page.locator('#wrong-parent-needs-help-queue button[data-record]').waitFor();
  assert.equal(await page.locator('#page-home:visible').count(),1);
  pass(width+'px '+kind+' original parent help-queue return action still works');

  const after=await snapshot(page);
  assert.deepEqual(after,before,'source navigation must not mutate saved observations/photos');
  assert.deepEqual(errors,[]);
  pass(width+'px '+kind+' stored observation+photo indexes preserved; no JS errors');
 }finally{await context.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])for(const kind of ['question','memo'])
  await scenario(width,kind);
 console.log('WRONG_QA62_BROWSER_RESULT='+JSON.stringify({
  status:'PASS',checks,kind:'real Chromium synthetic misaligned screen history',
  viewports:[320,390],recordWritesByNavigation:0,operationalAuth:false,
  realFamilies:0,realPhones:false,safeToRestore:false,deployed:false}));
}catch(e){
 console.error('WRONG_QA62_BROWSER_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1600),
  safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
