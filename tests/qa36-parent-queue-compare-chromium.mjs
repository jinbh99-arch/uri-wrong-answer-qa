// QA36: real localhost Chromium 320/390px for the selected parent queue and
// read-only first/latest child-explanation comparison. Synthetic photos/text
// only, no auth, no real family, no production restore or deployment.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const APP='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA36 PARENT CHROMIUM',s)};
async function snapshot(p){return p.evaluate(async name=>{
 const req=indexedDB.open(name),db=await new Promise((ok,no)=>{
  req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,ids,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
  return {rows,profile,photos:await Promise.all(ids.map(async(id,i)=>({
   id,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function run(width){
 const parentCtx=await browser.newContext({viewport:{width,height:780},acceptDownloads:true});
 const unrelatedCtx=await browser.newContext({viewport:{width,height:780},acceptDownloads:true});
 const p=await parentCtx.newPage(),b=await unrelatedCtx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push('A '+String(e)));b.on('pageerror',e=>errors.push('B '+String(e)));
 try{
  await p.goto(APP,{waitUntil:'domcontentloaded'});
  await p.locator('#nav-add').click();
  await p.locator('#wrong007-subject').selectOption('science');
  await p.locator('#problem').fill('QA36 가상 아이 A의 사진과 원인 설명 기록 '+width);
  await p.locator('#choose-photo').setInputFiles({name:'qa36-a.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await p.locator('#save-btn').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:22000});
  await p.locator('#nav-records').click();
  const buttons=p.locator('#records-list button[data-record]');
  await buttons.first().waitFor();
  assert.equal(await buttons.count(),1);
  await buttons.first().click();
  await p.locator('#check-status').selectOption('needs_help');
  await p.locator('#check-save').click();
  await p.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('도움이 필요'),null,{timeout:12000});
  await p.locator('#nav-home').click();
  const queue=p.locator('#wrong-parent-needs-help-queue');
  await queue.locator('button[data-record]').first().waitFor();
  assert.equal(await queue.locator('button[data-record]').count(),1);
  const firstRow=(await snapshot(p)).rows[0];
  const initialPhoto=(await snapshot(p)).photos;
  assert.equal(initialPhoto.length,1);
  assert.equal(firstRow.checkHistory.at(-1).status,'needs_help');
  const homeWidth=await p.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(homeWidth<=width+2,'parent list horizontal overflow at '+width+': '+homeWidth);
  pass(width+'px: 부모 도움 필요 목록 1건이 홈에서 첫 기록에 연결·사진 바이트 보존');

  // The queue's delegated data-record navigation must go to the original
  // record rather than creating another copy or generating a diagnosis.
  await queue.locator('button[data-record]').first().click();
  await p.locator('#detail-text').waitFor();
  assert.ok((await p.locator('#detail-text').textContent()).includes('QA36 가상 아이 A'));
  await p.locator('#v230-answer').fill('처음 다시 푼 답 '+width);
  await p.locator('#v230-explanation').fill('처음에는 조건을 놓쳤어요 '+width);
  await p.locator('#v230-save').click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:20000});
  await p.locator('#v230-review').selectOption('explained');
  await p.locator('#v230-review-save').click();
  await p.waitForFunction(()=>document.querySelector('#v230-review')?.value==='explained'&&!document.querySelector('#v230-review-save')?.disabled,null,{timeout:17000});
  await p.locator('#nav-home').click();
  assert.equal(await p.locator('#wrong-parent-needs-help-queue button[data-record]').count(),0,
   'new parent explained review must supersede older checkHistory needs_help');
  pass(width+'px: 일반 재풀이 부모의 최근 설명함 관찰이 옛 도움 필요를 해제');

  await p.locator('#nav-records').click();
  await p.locator('#records-list button[data-record]').first().click();
  await p.locator('#v230-answer').fill('두 번째로 다시 푼 답 '+width);
  await p.locator('#v230-explanation').fill('이번에는 조건을 읽고 다시 설명했어요 '+width);
  await p.locator('#v230-save').click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 2회'),null,{timeout:20000});
  await p.locator('#v230-review').selectOption('needs_help');
  await p.locator('#v230-review-save').click();
  await p.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled,null,{timeout:17000});
  const card=p.locator('#wrong-parent-retry-comparison');
  await card.waitFor();
  assert.equal(await card.locator('.v230-compare-side').count(),2);
  const texts=await card.locator('.v230-compare-side').allTextContents();
  assert.ok(texts[0].includes('처음에는 조건을 놓쳤어요 '+width));
  assert.ok(texts[1].includes('이번에는 조건을 읽고 다시 설명했어요 '+width));
  assert.ok((await card.textContent()).includes('이해도 향상이나 오답 원인을 증명하지는'));
  const detailWidth=await p.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(detailWidth<=width+2,'explanation card horizontal overflow '+detailWidth);
  const afterSave=await snapshot(p);
  assert.equal(afterSave.rows.length,1);
  assert.deepEqual(afterSave.photos,initialPhoto);
  assert.equal(afterSave.rows[0].generalRetryHistory.length,2);
  pass(width+'px: 사진 원본·두 아이 설명·학부모 관찰 그대로, 부모 전용 처음/최근 비교 카드 두 칸 표시');

  await p.locator('#nav-home').click();
  assert.equal(await p.locator('#wrong-parent-needs-help-queue button[data-record]').count(),1,
   'latest needs_help must return to queue');
  const immutable=await snapshot(p);
  await p.locator('#v218-child-mode').click();
  assert.equal(await p.locator('#wrong-parent-needs-help-queue').isVisible(),false);
  await p.locator('#nav-records').click();
  await p.locator('#records-list button[data-record]').first().click();
  assert.equal(await p.locator('#wrong-parent-retry-comparison').isVisible(),false);
  await p.locator('#v218-parent-mode').click();
  assert.equal(await p.locator('#wrong-parent-retry-comparison').isVisible(),true);
  assert.deepEqual(await snapshot(p),immutable,'only looking at queue/card must never mutate local IDB');
  pass(width+'px: 아이 화면에는 부모 목록/비교 카드 비노출, 부모 복귀와 읽기 전용 원장 무변경');

  await b.goto(APP,{waitUntil:'domcontentloaded'});
  assert.equal((await snapshot(b)).rows.length,0);
  assert.equal((await snapshot(b)).photos.length,0);
  assert.equal(await b.locator('#wrong-parent-needs-help-queue button[data-record]').count(),0);
  assert.deepEqual(errors,[]);
  pass(width+'px: 다른 독립 합성 가족 브라우저에 A 사진·관찰·설명 0건, JS 오류 0');
 }finally{await parentCtx.close();await unrelatedCtx.close()}
}
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])await run(width);
 console.log('WRONG_QA36_PARENT_CHROMIUM_RESULT='+JSON.stringify({
  status:'PASS',checks,viewports:[320,390],realChromium:true,
  latestParentObservationBothStores:true,originalPhotoPreserved:true,
  parentOnly:true,readOnlyCompare:true,isolatedBrowserContexts:true,
  realFamilyAuth:false,safeToRestore:false,deployed:false}));
}catch(err){
 console.error('WRONG_QA36_PARENT_CHROMIUM_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1500),
  safeToRestore:false}));process.exitCode=1;
}finally{if(browser)await browser.close()}
