// WRONG A18-21: synthetic failed parent memo save -> attempted navigation.
// RED before QA app correction; GREEN only if original written memo is not silently lost.
// Real user timing, physical phones, family images and recovery are NOT tested.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const DIR='qa-proof/wrong-a18-21',DB='uriaimath-github-qa-v224-only';
const LEGACY_QA_APP='f3f0d3c2dffce09ed7af613238aa7f8a92708c35';
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
mkdirSync(DIR,{recursive:true});
const proof={status:'RUNNING',baselineApp:gitBlob(readFileSync('index.html'))===LEGACY_QA_APP,
 widths:{},screenshots:[],externalRequests:[],pageErrors:[],
 realFamilyData:false,destructiveWrites:false,realParentTimingMeasured:false};
let preview,browser;
async function ledger(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const records=tx.objectStore('mistakes').getAll();
   const photos=tx.objectStore('photos').getAll(),keys=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{const buffers=await Promise.all(photos.result.map(async b=>({type:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    db.close();resolve({records:records.result,photos:buffers,keys:keys.result});}
    catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
async function snap(page,width,name){
 const file=DIR+'/'+width+'-'+name+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled'});proof.screenshots.push(file);
}
try{
 const auth={username:'wrong-a18-21',password:randomBytes(18).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?800:850},
    httpCredentials:auth,acceptDownloads:false});
  const page=await ctx.newPage();
  page.on('pageerror',e=>proof.pageErrors.push(String(e)));
  await page.route('**/*',r=>{
   const url=r.request().url();
   if(url.startsWith(preview.url)||url.startsWith('blob:')||url.startsWith('data:'))return r.continue();
   proof.externalRequests.push(url);return r.abort();
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:18000});
  await page.locator('#nav-add').click();
  const b64=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;
   const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,200,100);
   g.fillStyle='#111';g.font='14px sans-serif';g.fillText('QA 18-21 synthetic',8,50);
   return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#choose-photo').setInputFiles({
   name:'synthetic-a18-21.png',mimeType:'image/png',buffer:Buffer.from(b64,'base64')});
  await page.locator('#photo-wrap').waitFor({state:'visible'});
  await page.locator('#problem').fill('메모 실패 후 목록 이동 시 임시 작성내용 보호 (합성)');
  await page.locator('#student-answer').fill('가상 오답');
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#wrong007-grade').selectOption('3');
  await page.locator('#save-btn').click();
  await page.locator('#page-detail').waitFor({state:'visible',timeout:18000});
  await page.waitForFunction(()=>document.querySelector('#v09-save-confirm:not(.hide)')?.textContent?.includes('브라우저 저장소'));
  const original=await ledger(page);
  assert.equal(original.records.length,1);assert.equal(original.photos.length,1);
  const memo='저장 실패 후에도 지켜야 하는 학부모의 가상 관찰 메모 18-21';
  await page.locator('#check-status').selectOption('needs_help');
  await page.locator('#check-memo').fill(memo);
  await page.evaluate(()=>{
   const base=IDBDatabase.prototype.transaction;
   let injected=0;
   window.__a1821Restore=()=>{IDBDatabase.prototype.transaction=base;return injected};
   IDBDatabase.prototype.transaction=function(stores,mode,...args){
    const names=Array.isArray(stores)?stores:[stores];
    if(mode==='readwrite'&&names.includes('mistakes')&&injected++===0)
      throw new DOMException('A1821_SYNTHETIC_FAILURE','AbortError');
    return base.call(this,stores,mode,...args);
   };
  });
  await page.locator('#check-save').click();
  await page.waitForFunction(()=>document.querySelector('#toast:not(.hide)')?.textContent?.includes('확인 기록 저장에 실패했습니다.'),null,{timeout:14000});
  assert.equal(await page.evaluate(()=>window.__a1821Restore()),1);
  assert.equal(await page.locator('#check-memo').inputValue(),memo);
  assert.deepEqual(await ledger(page),original,'failure changed original mistake/photo bytes');
  await snap(page,width,'01-synthetic-save-failed');
  await page.locator('#nav-records').click();
  await snap(page,width,'02-after-attempted-navigation');
  // This fails RED on an app that silently discards the typed memo.
  const stillDetail=await page.locator('#page-detail').isVisible();
  const memoPreserved=stillDetail?await page.locator('#check-memo').inputValue()===memo:false;
  const warning=await page.locator('#toast').innerText();
  const afterNav=await ledger(page);
  proof.widths[width]={status:'OBSERVED',stillDetail,memoPreserved,warning,
    photoBytes:original.photos[0].bytes.length,ledgerUnchanged:JSON.stringify(afterNav)===JSON.stringify(original)};
  assert.deepEqual(afterNav,original,'navigation after failed save changed photo/record');
  assert.ok(stillDetail&&memoPreserved,'A18-21 DEFECT: failed parent memo silently lost by navigation');
  assert.ok(warning.includes('저장하지 않은')&&warning.includes('메모'),
    'user is not told why draft navigation is blocked');
  await page.locator('#check-save').click();
  await page.waitForFunction(expected=>
    document.querySelector('#page-detail:not(.hide) #check-history')?.innerText?.includes(expected),
    memo,{timeout:18000});
  const saved=await ledger(page);
  assert.equal(saved.records[0].checkHistory?.length,1);
  assert.deepEqual(saved.photos,original.photos);
  await snap(page,width,'03-success');
  await page.locator('#nav-records').click();
  assert.ok(await page.locator('#page-records').isVisible(),
    'navigation should work after successful save');
  await page.locator('#records-list [data-record]').first().click();
  await page.waitForFunction(expected=>
    document.querySelector('#page-detail:not(.hide) #check-history')?.innerText?.includes(expected),memo);
  const final=await ledger(page);
  assert.equal(final.records[0].checkHistory.length,1);
  assert.deepEqual(final.photos,original.photos);
  proof.widths[width].status='PASS';
  await snap(page,width,'04-reentry');
  await ctx.close();
 }
 assert.deepEqual(proof.externalRequests,[]);
 assert.deepEqual(proof.pageErrors,[]);
 proof.status='PASS_A1821_FAILED_PARENT_DRAFT_NAV_GUARD';
}catch(err){proof.status='FAIL_A1821_DRAFT_NAV';proof.error=String(err);
 proof.stack=String(err?.stack||'').slice(0,2000);process.exitCode=1;
 console.error('A1821_FAIL '+String(err));}
finally{
 await browser?.close();await preview?.close();
 proof.appBlob=gitBlob(readFileSync('index.html'));
 writeFileSync(DIR+'/result.json',JSON.stringify(proof,null,2));
 console.log('A1821_RESULT='+JSON.stringify({status:proof.status,widths:proof.widths,
   png:proof.screenshots.length,external:proof.externalRequests.length,
   pageErrors:proof.pageErrors.length,appBlob:proof.appBlob,error:proof.error}));
}