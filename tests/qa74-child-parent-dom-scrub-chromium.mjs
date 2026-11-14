// QA74: new 320px parent-only DOM removal and safe reconstruction,
// narrow follow-up to QA73 proven parent memo residue; not an auth/isolation claim.
// Verifies hidden DOM is cleared on child modes and parent view rerenders from original.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA74_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const parentNote='QA74 가상 부모 전용 메모: 빛 방향 다시 확인';
const parentQuestion='QA74 가상 부모 전용 질문: 광원을 오른쪽으로 바꾸면?';
let browser,preview,checks=0;
const pass=msg=>{checks++;console.log('PASS WRONG QA74 '+msg)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(name);
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photos:photos.result})};
  };
 }),DB);
}
async function visibleText(page){return page.evaluate(()=>document.body.innerText)}
try{
 const username='qa74-local-fake',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA74 가상 과학 오답: 그림자의 방향');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').filter({hasText:'QA74 가상 과학 오답'}).click();
 await page.locator('#detail-text').waitFor();
 await page.locator('#v230-answer').fill('가상 아이 재풀이: 그림자는 왼쪽');
 await page.locator('#v230-explanation').fill('가상 아이 설명: 빛 반대쪽에 생겨요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:15000});
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill(parentNote);
 await page.locator('#check-save').click();
 await page.waitForFunction(note=>document.querySelector('#check-history')?.textContent?.includes(note),parentNote,{timeout:15000});
 const nextDate=new Date(Date.now()+12*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(nextDate);
 await page.locator('#wrong008-next-question').fill(parentQuestion);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),nextDate,{timeout:15000});
 const original=await snapshot(page);
 assert.equal(original.rows.length,1);
 assert.deepEqual(original.photos,[]);
 assert.ok((await page.locator('#check-history').innerText()).includes(parentNote));
 pass('320px fake mistake, child retry, parent observation and manual next check coexist in one record');

 await page.locator('#nav-home').click();
 const queue=page.locator('#wrong-parent-needs-help-queue');
 await queue.locator('button[data-record]').waitFor();
 assert.ok((await queue.innerText()).includes(parentNote));
 assert.ok(!(await queue.innerText()).includes(parentQuestion),
  'scheduled manual recheck must not masquerade as answered parent check question');
 pass('320px parent queue shows saved observation and separates future manual check from answered questions');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#home-observation-card').isVisible(),false,
  'parent summary visible in child mode');
 const childHome=await visibleText(page);
 assert.ok(!childHome.includes(parentNote),'parent memo visible on child home');
 assert.ok(!childHome.includes(parentQuestion),'parent question visible on child home');
 // Unlike QA73 (visibility only), assert no parent memo remains in the hidden
 // home queue DOM when the child is allowed to view the app.
 assert.ok(!(await page.evaluate(note=>document.body.textContent.includes(note),parentNote)),
  'parent note still present in child-home DOM after switch');
 pass('320px child-home DOM holds no private parent observation text');
 await page.locator('#nav-records').click();
 const listText=await visibleText(page);
 assert.ok(!listText.includes(parentNote),'parent memo visible on child records');
 assert.ok(!listText.includes(parentQuestion),'parent question visible on child records');
 pass('320px child home and record list do not visually expose parent-only entries');

 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-text').waitFor();
 const childDetail=await visibleText(page);
 assert.ok(!childDetail.includes(parentNote),'parent memo visibly leaks in child detail');
 assert.ok(!childDetail.includes(parentQuestion),'parent question visibly leaks in child detail');
 const childDom=await page.evaluate(({note,question})=>({
  note:document.body.textContent.includes(note),
  question:document.body.textContent.includes(question),
  history:document.querySelector('#check-history')?.textContent||'',
  queue:document.querySelector('#wrong-parent-needs-help-queue')?.textContent||''
 }),{note:parentNote,question:parentQuestion});
 assert.equal(childDom.note,false,'saved parent observation remains in child DOM');
 assert.equal(childDom.question,false,'scheduled parent question remains in child DOM');
 assert.ok(!childDom.history.includes(parentNote)&&!childDom.queue.includes(parentNote));
 pass('320px child-detail document excludes both fake parent note and manual check question');

 await page.locator('#v218-parent-mode').click();
 await page.waitForFunction(note=>document.querySelector('#check-history')?.textContent?.includes(note),
  parentNote,{timeout:15000});
 assert.ok((await visibleText(page)).includes(parentNote),'parent mode cannot restore saved observation');
 pass('parent mode regenerates the original observation from preserved local records');
 await page.locator('#nav-home').click();
 assert.ok((await page.locator('#wrong-parent-needs-help-queue').innerText()).includes(parentNote),
  'parent home queue not restored');
 await page.locator('#v218-child-mode').click();
 assert.ok(!(await page.evaluate(note=>document.body.textContent.includes(note),parentNote)),
  'parent home queue text still in DOM after return to child mode');
 pass('repeat parent→child switch clears home queue again');
 const after=await snapshot(page);
 assert.deepEqual(after,original,'view switching must never rewrite or delete fake record');
 assert.deepEqual(after.photos,[]);
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(width<=323,'320px overflow '+width);
 pass('parent re-entry restores observation without record loss or network/JS/overflow');
 console.log('WRONG_QA74_RESULT='+JSON.stringify({status:'PASS',checks,viewport:320,
  sourceDevSha:SHA,realChromium:true,fakeOnly:true,childDomPrivateTextAbsent:true,
  childViewIsAuthentication:false,serverFamilyIsolationVerified:false,
  realDeviceVerified:false,safeToRestore:false,deployed:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA74_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(e),stack:String(e?.stack).slice(0,950),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
