// A18-19: NEW UI feedback regression — synthetic photo→retry success→parent forced failure→exact memo display→reload.
 // The CI execution time is NOT parent 3-minute usability evidence.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',APP='f3f0d3c2dffce09ed7af613238aa7f8a92708c35';
const DB='uriaimath-github-qa-v224-only',DIR='qa-proof/wrong-a18-19';
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
assert.equal(gitBlob(readFileSync('index.html')),APP);
mkdirSync(DIR,{recursive:true});
const data={status:'RUNNING',screenshots:[],widths:{},externalRequests:[],pageErrors:[],
 realParentTimeMeasured:false,familyDataUsed:false,destructiveDeleteOrRestore:false};
let preview,browser;
async function readLedger(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(name);o.onerror=()=>reject(o.error);o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const m=tx.objectStore('mistakes'),p=tx.objectStore('photos');
   const records=m.getAll(),keys=m.getAllKeys(),photokeys=p.getAllKeys(),photos=p.getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const imageBytes=await Promise.all(photos.result.map(async b=>({type:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    db.close();resolve({keys:keys.result,records:records.result,photoKeys:photokeys.result,photos:imageBytes});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
function recordIsPersisted(ledger){return ledger.records.length===1 && ledger.photos.length===1 && ledger.photoKeys[0]===ledger.keys[0] && ledger.photos[0].bytes.length>50}
async function screenshot(page,width,step){const path=DIR+'/parent-'+width+'-'+step+'.png';await page.screenshot({path,fullPage:true,animations:'disabled'});data.screenshots.push(path)}
try{
 const auth={username:'wrong-a18-19',password:randomBytes(18).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?800:850},httpCredentials:auth,acceptDownloads:false});
  const page=await ctx.newPage();
  page.on('pageerror',e=>data.pageErrors.push(String(e)));
  await page.route('**/*',r=>{
   const url=r.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))return r.continue();
   data.externalRequests.push(url);return r.abort();
  });
  const clock=Date.now();
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:18000});
  await page.locator('#nav-add').click();
  assert.ok(await page.locator('#mistake-form').isVisible(),'add form missing');
  // A generated private synthetic PNG; no camera access, user image or OCR.
  const imageB64=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=240;c.height=140;
   const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,240,140);
   x.fillStyle='#222222';x.font='24px sans-serif';x.fillText('QA 2 + 3 = ?',12,74);
   return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#choose-photo').setInputFiles({name:'synthetic-qa-math.png',mimeType:'image/png',buffer:Buffer.from(imageB64,'base64')});
  await page.locator('#photo-wrap').waitFor({state:'visible',timeout:12000});
  await page.locator('#problem').fill('자석의 같은 극 두 개를 가까이 하면 어떻게 될까요?');
  await page.locator('#student-answer').fill('서로 붙는다 (가상 오답)');
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#wrong007-grade').selectOption('3');
  await page.locator('#save-btn').click();
  await page.locator('#page-detail').waitFor({state:'visible',timeout:18000});
  await page.waitForFunction(()=>document.querySelector('#v09-save-confirm:not(.hide)')?.textContent?.includes('브라우저 저장소'));
  const registered=await readLedger(page);
  assert.ok(recordIsPersisted(registered),'actual app mistake/photo not saved');
  assert.equal(registered.records[0].subject,'science');
  assert.equal(registered.records[0].problemText,'자석의 같은 극 두 개를 가까이 하면 어떻게 될까요?');
  const originalBytes=registered.photos[0].bytes;
  await screenshot(page,width,'01-registered');
  await page.locator('#wrong002-retry').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v230-answer','retry CTA did not focus actual answer');
  await page.locator('#v230-answer').fill('같은 극끼리는 서로 밀어낸다');
  await page.locator('#v230-explanation').fill('자석 실험의 결과를 다시 관찰했습니다. (합성)');
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-journey')?.innerText?.includes('1회')||document.body.innerText.includes('재풀이 1회'),null,{timeout:15000});
  assert.ok(await page.locator('#page-detail').isVisible(),'retry must return to visible detail');
  assert.ok((await page.locator('#wrong002-journey').innerText()).includes('1회'),'retry count not visible in actual journey');
  const retried=await readLedger(page);
  assert.equal(retried.records[0].generalRetryHistory?.length,1,'generic retry not persisted');
  assert.deepEqual(retried.photos[0].bytes,originalBytes,'photo modified by retry');
  await screenshot(page,width,'02-retried');
  // New A18-19 boundary: injected ONE-SHOT failure in a synthetic parent observation write.
  // Verify visible failure feedback and no ledger change; this is NOT evidence of a real app fault.
  const memo='아이가 관찰 결과를 스스로 설명함 (QA 가상)';
  await page.locator('#check-status').selectOption('explained');
  await page.locator('#check-memo').fill(memo);
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    let rejected=0;
    window.__a1819RestoreTransaction=()=>{IDBDatabase.prototype.transaction=original;return rejected};
    IDBDatabase.prototype.transaction=function(stores,mode,...args){
      const names=Array.isArray(stores)?stores:[stores];
      if(mode==='readwrite'&&names.includes('mistakes')&&rejected++===0)
        throw new DOMException('A1819_SYNTHETIC_DENIED_WRITE','AbortError');
      return original.call(this,stores,mode,...args);
    };
  });
  await page.locator('#check-save').click();
  await page.waitForFunction(()=>document.querySelector('#toast:not(.hide)')?.textContent?.includes('확인 기록 저장에 실패했습니다.'),null,{timeout:12000});
  assert.ok(await page.locator('#toast').isVisible(),'parent failed-write feedback not shown');
  const forcedRejected=await page.evaluate(()=>window.__a1819RestoreTransaction());
  assert.equal(forcedRejected,1,'synthetic parent write rejection not exercised exactly once');
  const afterFailedParent=await readLedger(page);
  assert.deepEqual(afterFailedParent,retried,'forced parent write failure changed real QA record or photo');
  assert.equal(afterFailedParent.records[0].checkHistory?.length||0,0,'parent observation persisted despite failed write');
  await screenshot(page,width,'03-parent-failure');

  // Retry the same parent observation normally, without interceptors.
  await page.locator('#check-save').click();
  await page.waitForFunction(expected=>
    document.querySelector('#toast:not(.hide)')?.textContent?.includes('학부모 관찰 결과를 저장했습니다.')&&
    document.querySelector('#page-detail:not(.hide) #check-history')?.innerText?.includes(expected)
  ,memo,{timeout:16000});
  assert.ok(await page.locator('#page-detail').isVisible(),'parent observation must remain on visible detail');
  const shownMemo=await page.locator('#check-history').innerText();
  assert.ok(shownMemo.includes(memo),'precise newly saved parent memo missing from visible history');
  await screenshot(page,width,'04-parent-success');
  const checked=await readLedger(page);
  assert.equal(checked.records[0].checkHistory?.length,1,'parent observation not persisted');
  assert.equal(checked.records[0].generalRetryHistory?.length,1,'retry history lost after parent observation');
  assert.deepEqual(checked.photos[0].bytes,originalBytes,'photo overwritten by parent observation');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:17000});
  await page.locator('#nav-records').click();
  assert.ok(await page.locator('#records-list').isVisible(),'records not visible after reload');
  const savedEntry=page.locator('#records-list [data-record]').first();
  await savedEntry.waitFor({state:'visible',timeout:16000});
  await savedEntry.click();
  await page.waitForFunction(expected=>document.querySelector('#page-detail:not(.hide) #check-history')?.innerText?.includes(expected),memo,{timeout:16000});
  assert.ok((await page.locator('#check-history').innerText()).includes(memo),'parent memo absent after reload and detail reopen');
  const reentry=await readLedger(page);
  assert.deepEqual(reentry.records,checked.records,'full record not identical after reload');
  assert.deepEqual(reentry.photos,checked.photos,'full photo bytes changed after reload');
  await screenshot(page,width,'05-reloaded-memo');
  const automatedElapsedMs=Date.now()-clock;
  data.widths[String(width)]={status:'PASS',steps:['synthetic photo+mistake','retry UI confirmed','parent injected write-failure warning','parent exact memo visible','reload + reopen memo'],
    photoBytes:originalBytes.length,recordCount:reentry.records.length,retryCount:reentry.records[0].generalRetryHistory.length,
    parentCheckCount:reentry.records[0].checkHistory.length,photoPreserved:true,reentryPreserved:true,
    injectedParentWriteFailure:true,failedWriteLedgerUnchanged:true,parentFailureToastVisible:true,parentSuccessToastVisible:true,exactMemoVisibleAfterReload:true,
    automatedElapsedMs,parentsThreeMinuteTiming:'NOT_TESTED'};
  await ctx.close();
 }
 assert.deepEqual(data.externalRequests,[]);assert.deepEqual(data.pageErrors,[]);
 data.status='PASS_A1819_PARENT_EXACT_VISIBLE_AND_FAIL_SUCCESS_FEEDBACK';
}catch(e){data.status='FAIL';data.error=String(e);data.stack=String(e?.stack||'').slice(0,2500);process.exitCode=1;console.error('A1819_FAIL '+String(e))}
finally{
 await browser?.close();await preview?.close();
 data.sourceUnchanged=gitBlob(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(data,null,2));
 console.log('A1819_RESULT='+JSON.stringify({status:data.status,widths:data.widths,screenshots:data.screenshots.length,
  externalRequests:data.externalRequests.length,pageErrors:data.pageErrors.length,sourceUnchanged:data.sourceUnchanged,error:data.error}));
}