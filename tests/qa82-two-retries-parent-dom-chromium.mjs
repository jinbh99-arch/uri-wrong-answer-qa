// QA82: only NEW two-retry accumulation on ONE synthetic wrong answer.
// Existing passed QA74-79 and QA81 are NOT rerun. No external hosting/actual accounts.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA82_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const memo='QA82 부모 비공개 원본 메모 두 번 재풀이';
const firstAnswer='QA82 아이 첫 번째 답 빛 반대방향';
const secondAnswer='QA82 아이 두 번째 답 왼쪽 그림자';
let browser,preview,checks=0,shots=0;
const proof='qa-proof/qa82';mkdirSync(proof,{recursive:true});
const pass=label=>{checks++;console.log('PASS QA82 '+label)};
async function capture(page,label){
 const path=proof+'/'+String(++shots).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA82_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(dbName);r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const keys=tx.objectStore('photos').getAllKeys();
   const blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const pics=await Promise.all(keys.result.map(async(id,i)=>({
      id,mime:blobs.result[i].type,
      bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
     })));
     db.close();resolve({rows:rows.result,pics});
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
async function childAudit(page){
 return page.evaluate(data=>{
  // Search all actual UI text nodes, including hidden DOM, but NOT inline
  // JavaScript source (body.textContent includes SCRIPT and makes a false leak).
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let uiText='',node;
  while((node=walker.nextNode())){
   if(!node.parentElement?.closest('script,style,noscript,template'))uiText+=node.nodeValue||'';
  }
  const visible=document.body.innerText||'';
  const allValues=[...document.querySelectorAll('input,textarea,select')].map(el=>String(el.value||''));
  const has=value=>uiText.includes(value)||visible.includes(value)||allValues.some(x=>x.includes(value));
  const hits=[...document.querySelectorAll('body *')]
   .filter(el=>!el.closest('script,style,noscript,template')&&el.children.length===0&&/(학부모 확인:|학부모 관찰:)/.test(el.textContent||''))
   .slice(0,12).map(el=>({
    tag:el.tagName,id:el.id,classes:typeof el.className==='string'?el.className:'',
    parent:el.parentElement?.id||'',text:(el.textContent||'').slice(0,200)
   }));
  const attempts=[...document.querySelectorAll('#v25-learning-flow .v230-attempt')];
  return {
   parentMemoLeak:has(data.memo),
   parentObservationTextLeak:uiText.includes('학부모 확인:')||uiText.includes('학부모 관찰:'),observationHitNodes:hits,
   parentComparisonPanelPresent:!!document.querySelector('#wrong-parent-retry-comparison'),
   parentReviewPanelPresent:!!document.querySelector('#v25-learning-flow .v230-parent-review'),
   nextReviewPanelPresent:!!document.querySelector('#wrong008-next-review'),
   parentMemoEditorLeak:allValues.some(v=>v.includes(data.memo)),
   retries:attempts.length,
   childFirstVisible:has(data.firstAnswer),childSecondVisible:has(data.secondAnswer),
   imageVisible:!!document.querySelector('#detail-image img')?.getClientRects().length
  };
 },{memo,firstAnswer,secondAnswer});
}
const leakFree=a=>!a.parentMemoLeak&&
 !a.parentObservationTextLeak&&!a.parentComparisonPanelPresent&&
 !a.parentReviewPanelPresent&&!a.nextReviewPanelPresent&&!a.parentMemoEditorLeak;
try{
 const username='qa82-fake-local',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},deviceScaleFactor:1,
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outside=[],audits=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))outside.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA82 동일 가상 과학 오답: 그림자가 생기는 방향');
 await page.locator('#student-answer').fill('QA82 아이 최초 가상 답');
 await page.locator('#memo').fill(memo);
 await page.locator('#take-photo').setInputFiles({
  name:'qa82-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 const start=await snapshot(page);
 assert.equal(start.rows.length,1);assert.equal(start.pics.length,1);
 assert.equal(start.rows[0].id,start.pics[0].id);
 assert.equal(start.rows[0].memo,memo);
 const originalId=start.rows[0].id,originalPhoto=start.pics[0];
 pass('same one fictional science record and original 1px photo captured');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#v230-answer').fill(firstAnswer);
 await page.locator('#v230-explanation').fill('QA82 첫 풀이 설명: 빛 반대쪽');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v25-learning-flow')?.textContent?.includes('일반 재풀이 기록 1회'),null,{timeout:15000});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help');
 const afterFirst=await snapshot(page);
 assert.equal(afterFirst.rows.length,1);
 assert.equal(afterFirst.rows[0].id,originalId);
 assert.equal(afterFirst.rows[0].generalRetryHistory.length,1);
 assert.equal(afterFirst.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.deepEqual(afterFirst.pics[0],originalPhoto);
 pass('first child retry and first private parent observation stored under original ID');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#v230-answer').fill(secondAnswer);
 await page.locator('#v230-explanation').fill('QA82 두 번째 설명: 광원 반대에 그림자가 생겨요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v25-learning-flow')?.textContent?.includes('일반 재풀이 기록 2회'),null,{timeout:15000});
 await page.locator('#v218-parent-mode').click();
 // The prior check-history observation is preserved; the second retry gets its
 // own independent v230 parent review, without assuming same-day check-save
 // should append a second checkHistory row.
 await page.locator('#v230-review').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='explained');
 const fixed=await snapshot(page);
 assert.equal(fixed.rows.length,1);assert.equal(fixed.rows[0].id,originalId);
 assert.equal(fixed.rows[0].generalRetryHistory.length,2);
 assert.equal(fixed.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.equal(fixed.rows[0].generalRetryHistory[1].review,'explained');
 assert.deepEqual(fixed.pics[0],originalPhoto);
 assert.ok(await page.locator('#wrong-parent-retry-comparison').count());
 await capture(page,'parent-two-retries-two-private-observations');
 pass('two independently reviewed attempts tied to one preserved parent record');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 const first=await childAudit(page);audits.push({step:'child-direct',...first});
 console.log('QA82_CHILD_AUDIT_DIRECT='+JSON.stringify(first));
 await capture(page,'child-two-retries-before-dom-verdict');
 assert.equal(leakFree(first),true,'parent-only texts/panels retained in child DOM after two retries');
 assert.equal(first.retries,2,'two child retry history items not visible');
 assert.equal(first.childFirstVisible,true);assert.equal(first.childSecondVisible,true);
 assert.equal(first.imageVisible,true);
 await capture(page,'child-two-retries-hidden-dom-clean');
 pass('child mode hides first and last parent verdict while preserving both child attempts/photo');

 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-image img').waitFor({timeout:15000});
 const reopened=await childAudit(page);audits.push({step:'child-reentry',...reopened});
 console.log('QA82_CHILD_AUDIT_REENTRY='+JSON.stringify(reopened));
 assert.equal(leakFree(reopened),true,'parent-only texts/panels reintroduced on child record reentry');
 assert.equal(reopened.retries,2);
 assert.equal(reopened.imageVisible,true);
 await capture(page,'child-reentry-two-retries-hidden-dom-clean');
 pass('child re-entry does not regenerate first/last private parent observations');

 await page.locator('#v218-parent-mode').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-parent-retry-comparison')!==null,null,{timeout:15000});
 const after=await snapshot(page);
 assert.deepEqual(after,fixed,'switching modes mutates saved retries or photo bytes');
 await capture(page,'parent-return-two-retries-preserved');
 pass('parent restores both private observations and original saved record/photograph unchanged');

 assert.deepEqual(errors,[],'JavaScript errors');
 assert.deepEqual(outside,[],'unexpected external network');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323,'320px overflow');
 pass('320px viewport safe, local-only, no JS/HTTP errors');
 writeFileSync(proof+'/child-hidden-dom-audit.json',JSON.stringify({
  kind:'synthetic-only',sourceDevSha:SHA,checks,shots,audits,
  sameRecord:true,originalPhotoBytesUnchanged:true,safeToRestore:false,
  realFamilyAuthentication:false,realOCR:false,operationalIsolation:false
 },null,2));
 console.log('QA82_RESULT='+JSON.stringify({
  status:'PASS',checks,shots,sourceDevSha:SHA,width:320,
  retryCount:2,parentRetryReviews:2,privateParentNotes:0,hiddenDomAudits:audits.length,
  sameRecordId:true,photoUnchanged:true,realChromium:true,
  safeToRestore:false,realAuth:false,realOCR:false,externalIsolationVerified:false
 }));
 await ctx.close();
}catch(error){
 console.error('QA82_RESULT='+JSON.stringify({status:'FAIL',checks,shots,
  error:String(error),stack:String(error?.stack).slice(0,1600),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
}