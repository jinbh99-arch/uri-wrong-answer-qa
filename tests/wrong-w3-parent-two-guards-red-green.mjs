// W3 new isolated QA incremental scope only:
// RED original vs GREEN W3 exact reversible toast scrub.
// Test previously untested dirty parent "observation memo" and "next recheck question" guards.
// Save only non-personal synthetic records in ephemeral Chromium local IDB.
// Do not claim view toggle is family authentication; no product/dev/main edits.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const DB='uriaimath-github-qa-v224-only';
const variant=process.argv[2];
assert.ok(['red','green'].includes(variant),'must be red or green');
const out='qa-proof/w3-two-guards/'+variant;mkdirSync(out,{recursive:true});
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const report={status:'IN_PROGRESS',variant,devSha:DEV,appGitBlob:gitBlob(readFileSync('index.html')),
 widths:{},screenshots:[],pageErrors:[],offHostRequests:[],
 syntheticOnly:true,actualFamilyAuthenticationVerified:false,physicalPhoneVerified:false,
 actualOCRVerified:false,productionChanged:false,safeToRestore:false};
let preview,browser;
async function screenshot(page,width,label){
 const path=out+'/'+width+'-'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 report.screenshots.push(path);
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const photos=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{const result={rows:rows.result,photoKeys:photos.result};db.close();resolve(result)};
  };
 }),DB);
}
async function state(page,inputSelector){
 return page.evaluate(sel=>({
   isParent:!document.body.classList.contains('v218-child'),
   parentPressed:document.getElementById('v218-parent-mode')?.getAttribute('aria-pressed'),
   childPressed:document.getElementById('v218-child-mode')?.getAttribute('aria-pressed'),
   toastVisible:!document.getElementById('toast')?.classList.contains('hide'),
   toastText:document.getElementById('toast')?.textContent,
   inputValue:document.querySelector(sel)?.value||'',
   scrollWidth:document.documentElement.scrollWidth
 }),inputSelector);
}
try{
 const username='w3-guard-synthetic',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username,password});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({
   viewport:{width,height:width===320?800:850},
   httpCredentials:{username,password},acceptDownloads:false
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
   report.offHostRequests.push(url);return route.abort();
  });
  const r=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(r?.status(),200,'ephemeral preview GET200');
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  const problem='W3 가상 과학 오답 '+width+' - 식물과 빛';
  await page.locator('#problem').fill(problem);
  await page.locator('#memo').fill('가상 학부모 저장 메모 - 실이름 없음');
  await page.locator('#save-btn').click();
  await page.locator('#page-detail:not(.hide)').waitFor({timeout:14000});
  await page.waitForFunction(p=>document.querySelector('#detail-text')?.textContent?.includes(p),problem,{timeout:14000});
  await page.locator('#check-memo').waitFor({state:'visible'});
  const initial=await snapshot(page);
  assert.equal(initial.rows.length,1,'exactly one original synthetic record');
  assert.equal(initial.photoKeys.length,0,'no real or synthetic photos stored');

  // First novel path: unsaved parent observation draft must block child mode.
  const observation='W3 가상 미저장 부모 관찰 - 꽃이 자라는 방법을 다시 물어보기';
  await page.locator('#check-memo').fill(observation);
  await page.locator('#v218-child-mode').click();
  const blockedObservation=await state(page,'#check-memo');
  assert.equal(blockedObservation.isParent,true,'observation draft must prevent mode switch');
  assert.equal(blockedObservation.parentPressed,'true');
  assert.equal(blockedObservation.childPressed,'false');
  assert.equal(blockedObservation.inputValue,observation,'observation draft was lost');
  assert.equal(blockedObservation.toastVisible,true,'guard explanation must remain visible');
  assert.ok(blockedObservation.toastText.includes('저장하지 않은 부모 관찰 메모'),'wrong observation warning');
  assert.deepEqual(await snapshot(page),initial,'observation block mutated saved record');
  await screenshot(page,width,'01-observation-guard-visible');

  // Clear unsaved memo (not a save) to reach nonmath generic retry flow.
  await page.locator('#check-memo').fill('');
  await page.locator('#v230-answer').waitFor({state:'visible'});
  await page.locator('#v230-answer').fill('W3 가상 과학 재풀이 답');
  await page.locator('#v230-explanation').fill('합성 기록 · 이전 답을 다시 관찰함');
  await page.locator('#v230-save').click();
  await page.locator('#wrong008-next-question').waitFor({state:'visible',timeout:14000});
  const withRetry=await snapshot(page);
  assert.equal(withRetry.rows.length,1,'generic retry should not create second mistake');
  assert.equal(withRetry.rows[0].generalRetryHistory?.length,1,'one synthetic retry saved');

  // Second novel guard: nonmath next-check question must remain unsaved and
  // stay in parent mode with feedback, under both original and QA-only patch.
  const nextQuestion='W3 가상 미저장 학부모 재확인 질문 - 무엇이 달라졌을까요?';
  await page.locator('#wrong008-next-question').fill(nextQuestion);
  await page.locator('#v218-child-mode').click();
  const blockedQuestion=await state(page,'#wrong008-next-question');
  assert.equal(blockedQuestion.isParent,true,'unsaved next question must prevent mode switch');
  assert.equal(blockedQuestion.parentPressed,'true');
  assert.equal(blockedQuestion.childPressed,'false');
  assert.equal(blockedQuestion.inputValue,nextQuestion,'next question was lost');
  assert.equal(blockedQuestion.toastVisible,true,'blocked question must show explanation');
  assert.ok(blockedQuestion.toastText.includes('저장하지 않은 부모 재확인 질문'),'wrong question warning');
  assert.deepEqual(await snapshot(page),withRetry,'question block mutated stored record');
  await screenshot(page,width,'02-next-question-guard-visible');

  // Clear the non-persisted question and ACTUALLY enter child view. The very
  // recent parent-only guard warning should not survive in child view GREEN.
  await page.locator('#wrong008-next-question').fill('');
  await page.locator('#v218-child-mode').click();
  const child=await state(page,'#wrong008-next-question');
  assert.equal(child.isParent,false,'cleared draft should permit child transition');
  assert.equal(child.parentPressed,'false');
  assert.equal(child.childPressed,'true');
  if(variant==='red'){
   assert.equal(child.toastVisible,true,'unfixed parent question warning should remain visible in child');
   assert.ok(child.toastText.includes('저장하지 않은 부모 재확인 질문'),
     'old parent warning must be reproduced verbatim');
  }else{
   assert.equal(child.toastVisible,false,'GREEN must hide stale parent warning in child');
   assert.equal(child.toastText,'','GREEN must empty parent warning in child DOM');
  }
  assert.deepEqual(await snapshot(page),withRetry,'child transition changed stored ledger');
  await screenshot(page,width,'03-child-after-clearing-guard');
  assert.ok(child.scrollWidth<=width+3,'horizontal layout overflow');
  report.widths[width]={
   status:'PASS',blockedObservation,blockedQuestion,child,
   originalRecordPreserved:true,retryRecordPreserved:true,
   priorParentWarningScrubbedInChild:variant==='green'
  };
  await ctx.close();
  console.log('W3_GUARDS_PASS '+variant+' width='+width);
 }
 assert.deepEqual(report.pageErrors,[],'unexpected browser JS error');
 assert.deepEqual(report.offHostRequests,[],'unexpected external network');
 report.status=variant==='red'?'PASS_BASELINE_PARENT_WARNING_LEAK_REPRODUCED':
   'PASS_PATCH_PRESERVES_BOTH_GUARDS_AND_CLEARS_CHILD_WARNING';
}catch(e){
 report.status='FAIL';report.error=String(e);
 report.stack=String(e?.stack||'').slice(0,1800);
 process.exitCode=1;console.error('W3_GUARDS_FAIL '+String(e));
}finally{
 await browser?.close();await preview?.close();
 writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 console.log('W3_GUARDS_RESULT='+JSON.stringify({variant,status:report.status,appGitBlob:report.appGitBlob,
  widths:Object.keys(report.widths),screenshots:report.screenshots.length,
  pageErrors:report.pageErrors.length,external:report.offHostRequests.length,error:report.error}));
}
