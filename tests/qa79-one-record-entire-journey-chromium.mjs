// QA79 integrated single-record journey, 320px browser screenshots; synthetic only.
// Baseline exposes a NEW hidden parent-review status path; fixed phase proves repair.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA79_DEV_SHA,PHASE=process.env.WRONG_QA79_PHASE;
assert.match(SHA||'',/^[a-f0-9]{40}$/);assert.ok(['baseline','fixed'].includes(PHASE));
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const memo='QA79 가상 부모 비공개 원본 메모 · 그림자';
const question='QA79 가상 부모 재확인 질문 · 반대 방향 그림자';
const explanation='QA79 아이만 작성한 가상 설명 · 빛 반대쪽';
const privateReview='학부모 확인: 도움이 필요했다고 관찰';
let preview,browser,checks=0,shots=0;
const dir='qa-proof/qa79/'+PHASE;mkdirSync(dir,{recursive:true});
function pass(label){checks++;console.log('PASS WRONG QA79 '+PHASE+' '+label)}
async function shot(page,label,fullPage=true){
 shots++;
 const path=dir+'/'+String(shots).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path,fullPage,animations:'disabled'});
 console.log('QA79_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const ids=tx.objectStore('photos').getAllKeys();
   const blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{const pics=await Promise.all(ids.result.map(async(id,i)=>({
     id,mime:blobs.result[i].type,
     bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));db.close();resolve({rows:rows.result,pics})}
    catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
async function childAudit(page){
 return page.evaluate(data=>{
  const text=document.body.textContent||'';
  return {
   parentMemo:text.includes(data.memo),parentQuestion:text.includes(data.question),
   parentStatus:text.includes(data.privateReview),
   parentReviewPanel:!!document.querySelector('#v25-learning-flow .v230-parent-review'),
   parentNextPanel:!!document.querySelector('#wrong008-next-review'),
   editMemo:!!document.querySelector('#memo')?.value?.includes(data.memo),
   childExplanation:text.includes(data.explanation),
   photoShown:!!document.querySelector('#detail-image img')?.getClientRects().length
  };
 },{memo,question,privateReview,explanation});
}
try{
 const username='qa79-fake-parent',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),outside=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))outside.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 pass('01 parent enters protected synthetic-only local preview');await shot(page,'parent-entry',false);

 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA79 같은 가상 과학 오답: 광원이 있으면 그림자는 어디에?');
 await page.locator('#student-answer').fill('QA79 아이가 처음 적은 가상답: 빛 방향');
 await page.locator('#memo').fill(memo);
 await page.locator('#take-photo').setInputFiles({name:'qa79-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 pass('02 parent enters single fictional photo and private note');await shot(page,'parent-registration');

 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const start=await snapshot(page);
 assert.equal(start.rows.length,1);assert.equal(start.pics.length,1);
 assert.equal(start.rows[0].id,start.pics[0].id);
 assert.equal(start.rows[0].memo,memo);
 const id=start.rows[0].id,photo=start.pics[0];
 pass('03 saved parent registration matches original photo bytes/record ID');await shot(page,'parent-record-saved');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 assert.equal((await childAudit(page)).parentMemo,false);
 await page.locator('#v230-answer').fill('QA79 아이 다시 푼 가상답: 왼쪽');
 await page.locator('#v230-explanation').fill(explanation);
 pass('04 child explains and edits the SAME record');await shot(page,'child-explains');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v25-learning-flow')?.textContent?.includes('일반 재풀이 기록 1회'),null,{timeout:15000});
 const afterChild=await snapshot(page);
 assert.equal(afterChild.rows.length,1);assert.equal(afterChild.rows[0].id,id);
 assert.equal(afterChild.rows[0].generalRetryHistory.length,1);
 assert.equal(afterChild.rows[0].generalRetryHistory[0].explanation,explanation);
 assert.deepEqual(afterChild.pics[0],photo);
 pass('05 child retry saved without replacing original photo/record');await shot(page,'child-retry-saved');

 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').waitFor({timeout:15000});
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&
  document.querySelector('#v25-learning-flow')?.textContent?.includes('도움이 필요했다고 관찰'),null,{timeout:15000});
 const observed=await snapshot(page);
 assert.equal(observed.rows.length,1);assert.equal(observed.rows[0].id,id);
 assert.equal(observed.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.deepEqual(observed.pics[0],photo);
 pass('06 parent records observation as observation, not automated judgment');await shot(page,'parent-observation');

 const day=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(day);
 await page.locator('#wrong008-next-question').fill(question);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(x=>document.querySelector('#check-history')?.textContent?.includes(x),question,{timeout:15000});
 const verified=await snapshot(page);
 assert.equal(verified.rows.length,1);assert.equal(verified.rows[0].id,id);
 assert.equal(verified.rows[0].checkHistory.length,1);
 assert.equal(verified.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.deepEqual(verified.pics[0],photo);
 pass('07 parent follow-up question/history stay on same record');await shot(page,'parent-followup-history');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 let leak=await childAudit(page);
 console.log('WRONG_QA79_CHILD_AUDIT_FIRST='+JSON.stringify(leak));
 assert.equal(leak.parentMemo,false);assert.equal(leak.parentQuestion,false);
 assert.equal(leak.editMemo,false);assert.equal(leak.parentNextPanel,false);
 assert.equal(leak.photoShown,true);assert.equal(leak.childExplanation,true);
 await shot(page,'child-after-parent',true);
 if(PHASE==='baseline'){
  assert.equal(leak.parentStatus,true,'expected new hidden parent review leakage is absent');
  assert.equal(leak.parentReviewPanel,true,'expected review panel residue is absent');
  pass('08 baseline confirms new parent-observation hidden DOM residue');
 }else{
  assert.equal(leak.parentStatus,false,'parent status leaked in child DOM');
  assert.equal(leak.parentReviewPanel,false,'parent review form leaked in child DOM');
  pass('08 child retains answer/photo, not parent observation or question in DOM');
 }

 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-image img').waitFor();
 leak=await childAudit(page);
 console.log('WRONG_QA79_CHILD_AUDIT_REENTRY='+JSON.stringify(leak));
 assert.equal(leak.parentMemo,false);assert.equal(leak.parentQuestion,false);
 assert.equal(leak.parentNextPanel,false);assert.equal(leak.photoShown,true);
 if(PHASE==='fixed'){
  assert.equal(leak.parentStatus,false);assert.equal(leak.parentReviewPanel,false);
 }
 pass('09 child record reentry checked for parent hidden DOM');await shot(page,'child-reentry');

 await page.locator('#v218-parent-mode').click();
 await page.waitForFunction(x=>document.querySelector('#check-history')?.textContent?.includes(x),question,{timeout:15000});
 assert.equal(await page.locator('#v230-review').inputValue(),'needs_help');
 assert.ok((await page.locator('#detail-memo').textContent()).includes(memo));
 const final=await snapshot(page);
 assert.deepEqual(final,verified,'mode changes must not mutate record, photo or history');
 assert.equal(final.rows[0].id,id);assert.deepEqual(final.pics[0],photo);
 pass('10 parent return restores exact memo, observation, recheck history and photo');await shot(page,'parent-returns');

 assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('11 no JS errors, external network or 320px overflow');
 console.log('WRONG_QA79_RESULT='+JSON.stringify({status:'PASS',phase:PHASE,checks,shots,devSha:SHA,
  sameRecordId:id,originalPhotoBytesUnchanged:true,actualChromium:true,width:320,
  parentDOMPrivacy:PHASE==='baseline'?'LEAK_REPRODUCED':'FIXED',safeToRestore:false,
  realFamilyAuthentication:false,actualOCR:false,operationalStorageIsolation:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA79_RESULT='+JSON.stringify({status:'FAIL',phase:PHASE,checks,shots,
  error:String(e),stack:String(e?.stack).slice(0,1000),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
