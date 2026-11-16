// WRONG A-03-3: NEW multi-tab first-create competition and rapid submit.
 // Uses the A-03 QA candidate index.html; DOES NOT replay A-03-2 baseline/fixed
 // or A01/A02/QA78/84/85/92. Synthetic photo, local Chromium, never real data.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_A033_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const A='A033 가상 사회 오답 A: 우리 동네의 행정 시설';
const B='A033 가상 국어 오답 B: 글의 순서';
const C='A033 가상 과학 오답 C: 빛과 그림자';
const MEMO_A='A033 가상 보호자 A의 비공개 관찰 메모';
const MEMO_B='A033 가상 보호자 B의 비공개 관찰 메모';
const dir='qa-proof/wrong-a03-3';mkdirSync(dir,{recursive:true});
let browser,preview,checks=0,shots=0;const errors=[],outside=[];
function pass(s){checks++;console.log('WRONG_A033_PASS '+checks+' '+s)}
async function shot(p,label){
 const f=dir+'/'+String(++shots).padStart(2,'0')+'-'+label+'.png';
 await p.screenshot({path:f,fullPage:true,animations:'disabled'});
 console.log('WRONG_A033_SHOT='+f);
}
async function store(page){
 return page.evaluate(name=>new Promise((ok,bad)=>{
  const o=indexedDB.open(name);o.onerror=()=>bad(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const r=tx.objectStore('mistakes').getAll(),k=tx.objectStore('photos').getAllKeys(),b=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();bad(tx.error)};
   tx.oncomplete=async()=>{try{
    const p=await Promise.all(k.result.map(async(id,i)=>({
     id,mime:b.result[i].type,bytes:Array.from(new Uint8Array(await b.result[i].arrayBuffer()))
    })));db.close();ok({records:r.result.sort((x,y)=>x.id.localeCompare(y.id)),photos:p.sort((x,y)=>x.id.localeCompare(y.id))})
   }catch(e){db.close();bad(e)}};
  };
 }),DB);
}
async function injectPostCommitReadbackOnce(p){
 return p.evaluate(()=>{
  const state={armed:true,fired:0};window.__a033Readback=state;
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const list=Array.isArray(stores)?stores:[stores];
   if(state.armed && mode==='readonly' && list.length===1 && list[0]==='mistakes'){
    state.armed=false;state.fired++;
    throw Error('A033_ONE_SHOT_AFTER_COMMIT_READBACK_FAILURE');
   }
   return original.call(this,stores,mode,...rest);
  };
 });
}
async function fill(page,subject,title,memo){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption(subject);
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(title);
 await page.locator('#memo').fill(memo);
 await page.locator('#take-photo').setInputFiles({name:'a033-1px-fake.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
}
try{
 const username='a033-local-synthetic',password=randomBytes(25).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const pA=await ctx.newPage(),pB=await ctx.newPage();
 for(const p of [pA,pB]){
  p.on('pageerror',e=>errors.push(String(e)));
  await p.route('**/*',route=>{
   const u=route.request().url();
   if(u.startsWith(preview.url))return route.continue();
   if(!u.startsWith('data:')&&!u.startsWith('blob:'))outside.push(u);
   return route.abort();
  });
 }
 await Promise.all([pA.goto(preview.url,{waitUntil:'domcontentloaded'}),
  pB.goto(preview.url,{waitUntil:'domcontentloaded'})]);
 assert.equal((await store(pA)).records.length,0);
 await fill(pA,'social',A,MEMO_A);
 await fill(pB,'korean',B,MEMO_B);
 pass('two real tabs share one ephemeral IDB, each with unsaved different draft+photo');

 // A's transaction DOES commit but the following readonly readback is lost;
 // B's distinct legitimate create races from a tab whose in-memory list was
 // originally empty. Different drafts should create TWO records, never overwrite.
 await injectPostCommitReadbackOnce(pA);
 await Promise.all([pA.locator('#save-btn').click(),pB.locator('#save-btn').click()]);
 await Promise.all([
  pA.locator('#form-error:not(.hide)').waitFor({timeout:16000}),
  pB.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000})
 ]);
 assert.match(await pA.locator('#form-error').innerText(),/저장 후 확인에 실패/);
 assert.equal(await pA.locator('#save-btn').isDisabled(),true);
 assert.equal(await pA.evaluate(()=>window.__a033Readback.fired),1);
 const first=await store(pA);
 assert.equal(first.records.length,2,'two INTENTIONAL distinct draft registrations expected');
 assert.equal(first.photos.length,2);
 const rowA=first.records.find(r=>r.problemText===A);
 const rowB=first.records.find(r=>r.problemText===B);
 assert.ok(rowA?.id&&rowB?.id&&rowA.id!==rowB.id);
 assert.equal(rowA.memo,MEMO_A);assert.equal(rowB.memo,MEMO_B);
 assert.ok(first.photos.some(x=>x.id===rowA.id));
 assert.ok(first.photos.some(x=>x.id===rowB.id));
 pass('A uncertain + B separately successful creates two distinct correct IDs/photos; no overwrite');
 await shot(pA,'01-tab-a-ack-unknown-320');
 await shot(pB,'02-tab-b-distinct-success-320');

 // A may NOT blind-resubmit its unknown creation. B's separate success must
 // not clear A's local save lock or accidentally create an extra A record.
 await pA.evaluate(()=>document.querySelector('#mistake-form').requestSubmit());
 await pA.waitForTimeout(80);
 assert.deepEqual(await store(pA),first);
 assert.equal(await pA.locator('#save-btn').isDisabled(),true);
 pass('another tab write does not unlock an uncertain form or duplicate its original');

 // In tab A, explicit list inspection resolves the prior unknown state.
 // A dialog acknowledges discarding only the old local form, not the saved DB.
 await pA.locator('#nav-records').click();
 const dlg=pA.locator('#confirm-dialog[open]');
 if(await dlg.count())await pA.locator('#dlg-ok').click();
 // The other tab may have committed AFTER tab A's failed-readback
 // handler refreshed its own in-memory records. Measure this gap explicitly.
 const listBefore=await pA.locator('#records-list button[data-record]').evaluateAll(
  items=>items.map(e=>e.getAttribute('data-record')));
 const listStaleBeforeReload=!listBefore.includes(rowA.id)||!listBefore.includes(rowB.id);
 console.log('WRONG_A033_FIRST_TAB_LIST_FRESHNESS='+JSON.stringify({
  listStaleBeforeReload,visibleCount:listBefore.length,actualStored:(await store(pA)).records.length
 }));
 // Existing app already exposes a BroadcastChannel change warning and
 // 'load latest records' button. This explicit action, not a new code change
 // or automatic edit-form overwrite, is the intended conflict recovery path.
 const reloadButton=pA.locator('#v20-reload-records');
 if(listStaleBeforeReload){
  // An old in-memory list must have a visible cross-tab refresh affordance.
  await reloadButton.waitFor({state:'visible',timeout:6000});
  assert.equal(await pA.locator('#v20-multi-tab-warning').isVisible(),true);
  await reloadButton.click();
  await reloadButton.waitFor({state:'hidden',timeout:6000});
 }else{
  // The other commit was already seen by the first tab's own restoreState.
  // Do not demand an unnecessary refresh button when the list is fresh.
  assert.ok(listBefore.includes(rowA.id)&&listBefore.includes(rowB.id));
 }
 await pA.locator('#records-list button[data-record="'+rowA.id+'"]').waitFor({timeout:15000});
 await pA.locator('#records-list button[data-record="'+rowB.id+'"]').waitFor({timeout:15000});
 await pA.locator('#records-list button[data-record="'+rowA.id+'"]').waitFor({timeout:15000});
 await pA.locator('#records-list button[data-record="'+rowB.id+'"]').waitFor({timeout:15000});
 assert.deepEqual(await store(pA),first);
 pass('fresh OR stale+existing cross-tab reload button both reconcile two IDs with original bytes');
 await shot(pA,'03-tab-a-list-after-existing-refresh-button-320');

 // NEW difference: rapid synchronous requestSubmit x2 before any render.
 // Local busy guard must create exactly one C even with the second submit.
 await pA.locator('#nav-add').click();
 await pA.locator('#wrong007-subject').selectOption('science');
 await pA.locator('#problem').fill(C);
 await pA.evaluate(()=>{
  const f=document.querySelector('#mistake-form');f.requestSubmit();f.requestSubmit();
 });
 await pA.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
 const afterRapid=await store(pA);
 assert.equal(afterRapid.records.length,3,'double submit must add exactly one fresh C');
 assert.equal(afterRapid.records.filter(x=>x.problemText===C).length,1);
 assert.equal(afterRapid.photos.length,2);
 for(const old of [rowA,rowB]){
  assert.deepEqual(afterRapid.records.find(x=>x.id===old.id),old);
  assert.deepEqual(afterRapid.photos.find(x=>x.id===old.id),first.photos.find(x=>x.id===old.id));
 }
 pass('double form submit creates ONE new C and preserves both original IDs+photo bytes');
 await shot(pA,'04-rapid-double-submit-single-result-320');

 // Second tab refreshes persisted state; child DOM MUST hide parent memos.
 await pB.reload({waitUntil:'domcontentloaded'});
 await pB.locator('#v218-child-mode').click();
 await pB.locator('#nav-records').click();
 await pB.locator('#records-list button[data-record="'+rowA.id+'"]').click();
 await pB.locator('#detail-text').waitFor({timeout:15000});
 const audit=await pB.evaluate(({a,b})=>({
  memoA:(document.body.textContent||'').includes(a)||
   (document.querySelector('#memo')?.value||'').includes(a),
  memoB:(document.body.textContent||'').includes(b)||
   (document.querySelector('#memo')?.value||'').includes(b),
  question:document.querySelector('#detail-text')?.textContent
 }),{a:MEMO_A,b:MEMO_B});
 assert.deepEqual(audit,{memoA:false,memoB:false,question:A});
 assert.deepEqual(await store(pB),afterRapid);
 pass('second-tab re-entry child DOM hides BOTH parent notes and sees same durable ledger');

 await pB.setViewportSize({width:390,height:844});
 await shot(pB,'05-390-child-second-tab-private-removed');
 for(const p of [pA,pB]){
  const dims=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.w+2);
 }
 assert.deepEqual(errors,[]);
 assert.deepEqual(outside,[]);
 pass('320 and 390 no overflow, no external network, no JavaScript exceptions');

 const result={status:'PASS',candidateSha:SHA,checks,shots,
  twoRealTabs:true,simultaneousFirstCreate:true,
  postCommitReadbackInjected:true,listStaleBeforeReload,distinctIntentionalCreates:2,
  blindResubmitBlocked:true,rapidDoubleSubmitCount:1,
  distinctFinalRecords:3,photoBytesUnchanged:true,parentNotesAbsentInChildDom:true,
  localIndexedDBOnly:true,actualOCR:false,realFamilyAuth:false,
  actualServerAcknowledgment:false,safeToRestore:false,devOrDeploymentChanged:false,
  previousA032A01A02Qa78Qa84Qa85Qa92NotRepeated:true};
 writeFileSync(dir+'/wrong-a03-3-result.json',JSON.stringify(result,null,2));
 console.log('WRONG_A033_RESULT='+JSON.stringify(result));
 await ctx.close();
}catch(e){
 process.exitCode=1;
 const result={status:'FAIL',candidateSha:SHA,checks,shots,
  error:String(e),stack:String(e?.stack||'').slice(0,1400),
  errors,outside,safeToRestore:false};
 writeFileSync(dir+'/wrong-a03-3-failure.json',JSON.stringify(result,null,2));
 console.error('WRONG_A033_RESULT='+JSON.stringify(result));
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
}
