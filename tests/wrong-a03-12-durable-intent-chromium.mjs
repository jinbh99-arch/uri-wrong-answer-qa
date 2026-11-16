// A-03-12 ONLY: newly developed atomic durable create receipt after reload,
// tab reopen, sibling tab and precommit abort. Synthetic browser/IDB only.
// Do not rerun A-03-9, A-03-10 or old A-03-11 blocking fixtures.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const EXPECTED_BLOB='2e0508c45c02e44a930fa6584e254af6076dee55';
const DB='uriaimath-github-qa-v224-only',PENDING='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-12';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const originalHtml=readFileSync('index.html');
const proof={status:'STARTED',baseDev:DEV,qaBlob:blob(originalHtml),cases:{},screenshots:[],outside:[],pageErrors:[],
  syntheticOnly:true,realServerAck:false,realOCR:false,realFamilyAuth:false,safeToRestore:false,
  oldSuitesRerun:false,devChanged:false,prodChanged:false};
mkdirSync(DIR,{recursive:true});
let browser,preview;
async function ledger(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(dbName);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos','settings'],'readonly'),
     rows=tx.objectStore('mistakes').getAll(),
     photoKeys=tx.objectStore('photos').getAllKeys(),
     photoBlobs=tx.objectStore('photos').getAll(),
     marker=tx.objectStore('settings').get('wrongA012PendingCreateV1');
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(photoKeys.result.map(async(id,i)=>({
      id,type:photoBlobs.result[i].type,bytes:Array.from(new Uint8Array(await photoBlobs.result[i].arrayBuffer()))
    })));
    db.close();
    resolve({records:rows.result.sort((a,b)=>a.id.localeCompare(b.id)),
      photos:photos.sort((a,b)=>a.id.localeCompare(b.id)),
      marker:marker.result||null});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function setupPage(ctx,width=320){
 const page=await ctx.newPage();
 page.on('pageerror',e=>proof.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))proof.outside.push(url);
  return route.abort();
 });
 await page.setViewportSize({width,height:width===320?760:844});
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 return page;
}
async function screenshot(page,label,width){
 await page.setViewportSize({width,height:width===320?760:844});
 const dims=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.w+2,'mobile overflow: '+JSON.stringify(dims));
 const path=DIR+'/'+label+'-'+width+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 proof.screenshots.push(path);
}
async function fill(page,text,memo,photo=true){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(text);
 await page.locator('#memo').fill(memo);
 if(photo){
  await page.locator('#take-photo').setInputFiles({name:'synthetic-a0312.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
 }
}
async function injectReadback(page){
 await page.evaluate(()=>{
  const old=IDBDatabase.prototype.transaction,state={armed:true,called:0};window.__a0312Read=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const names=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&names.length===1&&names[0]==='mistakes'){
    state.armed=false;state.called++;
    throw Error('A0312_SYNTHETIC_AFTER_COMMIT_ACK_LOST_ONCE');
   }
   return old.call(this,stores,mode,...rest);
  };
 });
}
async function createUnknown(page,text,memo){
 await fill(page,text,memo,true);
 await injectReadback(page);
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:18000});
 assert.equal(await page.evaluate(()=>window.__a0312Read.called),1);
 const rows=await ledger(page);
 assert.equal(rows.records.length,1);
 assert.equal(rows.photos.length,1);
 assert.ok(rows.marker?.id);
 assert.equal(rows.records[0].id,rows.marker.id);
 assert.equal(rows.photos[0].id,rows.marker.id);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 return rows;
}
async function assertPendingBlocked(page,old){
 await page.locator('#nav-add').click();
 await page.waitForFunction(()=>document.querySelector('#save-btn')?.disabled===true,null,{timeout:10000});
 const before=await ledger(page);
 assert.equal(before.marker.id,old.marker.id);
 assert.deepEqual(before.records,old.records);
 assert.deepEqual(before.photos,old.photos);
 await page.locator('#mistake-form').evaluate(f=>f.requestSubmit());
 const after=await ledger(page);
 assert.deepEqual(after.records,old.records);
 assert.deepEqual(after.photos,old.photos);
 return after;
}
async function verifyViaList(page,old){
 // Only after an independent read of the real receipt's exact committed ID.
 await page.locator('#nav-records').click();
 const dialog=page.locator('#confirm-dialog[open]');
 if(await dialog.count())await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>{
  const node=document.querySelector('#records-count');
  return node?.textContent?.includes('이전 등록의 실제 ID를 확인했습니다.');
 },null,{timeout:16000});
 const l=await ledger(page);
 assert.equal(l.marker,null);
 assert.deepEqual(l.records,old.records);
 assert.deepEqual(l.photos,old.photos);
 return l;
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0312-synthetic-qa',password},acceptDownloads:false,viewport:{width:320,height:760}});
 try{proof.cases[name]=await fn(ctx);proof.cases[name].status='PASS';console.log('A0312_'+name+'_PASS')}
 catch(err){proof.cases[name]={status:'FAIL',error:String(err),stack:String(err?.stack||'').slice(0,2200)};proof.status='FAIL';
  console.error('A0312_'+name+'_FAIL '+String(err))}
 finally{await ctx.close()}
}
async function caseReload(ctx){
 const page=await setupPage(ctx);
 const first=await createUnknown(page,'A0312 합성 과학: 태양 행성 분류','A0312 동일 의도 가상 메모');
 await screenshot(page,'01-pending-before-reload',320);
 await page.reload({waitUntil:'domcontentloaded'});
 await assertPendingBlocked(page,first);
 await screenshot(page,'02-reload-pending-locked',390);
 await verifyViaList(page,first);
 await screenshot(page,'03-list-id-confirmed',320);
 // Only a DISTINCT new intent is allowed after exact record confirmation.
 await page.locator('#nav-add').click();
 assert.equal(await page.locator('#save-btn').isDisabled(),false);
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('A0312 별도 의도: 날씨 관찰');
 await page.locator('#memo').fill('A0312 신규 의도 메모');
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:15000});
 const after=await ledger(page);
 assert.equal(after.records.length,2);
 assert.equal(after.photos.length,1);
 assert.equal(after.marker,null);
 assert.deepEqual(after.records.find(r=>r.id===first.records[0].id),first.records[0]);
 assert.deepEqual(after.photos[0],first.photos[0]);
 return {reloadLocked:true,markerId:first.marker.id,verifiedListClears:true,
  uniqueIndependentIntentAfterConfirm:true,photosPreserved:true};
}
async function caseReopen(ctx){
 let page=await setupPage(ctx);
 const first=await createUnknown(page,'A0312 합성 과학: 별자리 관찰','A0312 탭 닫은 뒤 재개');
 await page.close();
 page=await setupPage(ctx);
 await assertPendingBlocked(page,first);
 await screenshot(page,'04-tab-reopen-locked',390);
 await verifyViaList(page,first);
 assert.equal((await ledger(page)).records.length,1);
 return {pendingPersistedAcrossTabClose:true,receiptConfirmedWithoutReplay:true};
}
async function caseSibling(ctx){
 const a=await setupPage(ctx),b=await setupPage(ctx);
 const text='A0312 합성 과학: 물의 상태',memo='A0312 서로 다른 탭에서 같은 등록 의도';
 await fill(b,text,memo,true);
 const first=await createUnknown(a,text,memo);
 await b.locator('#save-btn').click();
 await b.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 const err=await b.locator('#form-error').innerText();
 assert.match(err,/다른 탭 또는 이전 실행/);
 const after=await ledger(b);
 assert.deepEqual(after.records,first.records);
 assert.deepEqual(after.photos,first.photos);
 assert.equal(after.marker.id,first.marker.id);
 assert.equal(await b.locator('#save-btn').isDisabled(),true);
 await screenshot(b,'05-sibling-tab-conflict-blocked',320);
 await verifyViaList(b,first);
 return {crossTabAtomicPendingGuard:true,secondDuplicatePrevented:true,receiptConsistent:true};
}
async function caseAbort(ctx){
 const page=await setupPage(ctx);
 await fill(page,'A0312 합성 과학: 식물 성장','A0312 원자적 실패 주입',true);
 await page.evaluate(()=>{
  const orig=IDBObjectStore.prototype.put;
  const state={armed:true,hits:0};window.__a0312Abort=state;
  IDBObjectStore.prototype.put=function(...args){
   if(this.name==='mistakes'&&state.armed){
    state.armed=false;state.hits++;
    IDBObjectStore.prototype.put=orig;
    throw Error('A0312_SYNTHETIC_PRECOMMIT_RECORD_PUT_FAIL');
   }
   return orig.apply(this,args);
  };
 });
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:12000});
 assert.equal(await page.evaluate(()=>window.__a0312Abort.hits),1);
 const failed=await ledger(page);
 assert.equal(failed.records.length,0);
 assert.equal(failed.photos.length,0);
 assert.equal(failed.marker,null,'IDB abort must roll back receipt atomically');
 await screenshot(page,'06-atomic-tx-abort-no-receipt',320);
 await page.locator('#mistake-form').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000});
 const after=await ledger(page);
 assert.equal(after.records.length,1);
 assert.equal(after.photos.length,1);
 assert.equal(after.marker,null);
 await screenshot(page,'07-after-atomic-retry',390);
 return {precommitAbortRolledBackRowPhotoAndReceipt:true,normalRetryAfterAbort:true,
  afterRetryRecords:1,afterRetryPhotos:1};
}
try{
 assert.equal(blob(originalHtml),EXPECTED_BLOB,'Only the exact A03-12 candidate source may be tested');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0312-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 for(const [name,fn] of [['reload',caseReload],['reopen',caseReopen],['sibling',caseSibling],['atomicAbort',caseAbort]])await run(name,fn,password);
 assert.deepEqual(proof.outside,[]);
 assert.deepEqual(proof.pageErrors,[]);
 if(Object.values(proof.cases).some(c=>c.status!=='PASS'))throw Error('A0312_CASE_FAILURE');
 proof.status='PASS_ISOLATED_DURABLE_RECEIPT_SCOPED';
}catch(e){proof.status='FAIL';proof.error=String(e);process.exitCode=1;console.error('A0312_RESULT_FAIL '+String(e))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 proof.sourceByteExactAfterRun=sha(readFileSync('index.html'))===sha(originalHtml);
 writeFileSync(DIR+'/a03-12-result.json',JSON.stringify(proof,null,2));
 console.log('A0312_RESULT='+JSON.stringify({status:proof.status,cases:Object.fromEntries(Object.entries(proof.cases).map(([k,v])=>[k,v.status])),
  captures:proof.screenshots.length,external:proof.outside.length,errors:proof.pageErrors.length,
  sourceByteExact:proof.sourceByteExactAfterRun}));
}
