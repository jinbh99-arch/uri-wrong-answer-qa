// A-03-6 ONLY: photo conversion rejection & committed-create re-entry, synthetic UI.
// Independent of A03-3/5; no older suites, prod services, family data, or restore.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_A036_DEV_SHA;
const PHASE=process.env.WRONG_A036_PHASE||'baseline';
assert.match(SHA||'',/^[0-9a-f]{40}$/);
assert.ok(['baseline','fixed'].includes(PHASE));
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const DB='uriaimath-github-qa-v224-only';
const DIR='qa-proof/wrong-a03-6/'+PHASE;
const MEMO='A036 합성 보호자 전용 메모(아동 개인정보 없음)';
const TEXT_A='A036 합성 국어 문제: 중심 문장 찾기';
const TEXT_B='A036 합성 과학 문제: 그림자 변화 설명';
mkdirSync(DIR,{recursive:true});
let preview,browser,shotCount=0;
const outcomes={},errors=[],outside=[];
async function shot(page,label){
 const path=DIR+'/'+String(++shotCount).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('A036_PNG='+path);
}
async function ledger(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll();
   const keys=tx.objectStore('photos').getAllKeys();
   const blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(keys.result.map(async(id,i)=>({
     id,type:blobs.result[i].type,
     bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
    })));
    db.close();
    resolve({records:rows.result.sort((a,b)=>a.id.localeCompare(b.id)),
     photos:photos.sort((a,b)=>a.id.localeCompare(b.id))});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function setup(ctx,width){
 const page=await ctx.newPage();
 const pageErrors=[];page.on('pageerror',e=>{
  const msg=String(e);errors.push(msg);pageErrors.push(msg);
 });
 await page.route('**/*',r=>{
  const u=r.request().url();
  if(u.startsWith(preview.url))return r.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))outside.push(u);
  return r.abort();
 });
 await page.setViewportSize({width,height:760});
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(SHA));
 assert.equal((await ledger(page)).records.length,0);
 return {page,pageErrors};
}
async function fill(page,txt){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption(txt===TEXT_A?'korean':'science');
 await page.locator('#problem').fill(txt);
 await page.locator('#memo').fill(MEMO);
 await page.locator('#take-photo').setInputFiles({name:'a036-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
}
async function injectPhotoRejectOnce(page){
 await page.evaluate(()=>{
  // photoBlob is closed over inside the app IIFE. Its canvas drawing API
  // is the actual rejection seam: throwing in a Promise executor rejects it.
  const original=CanvasRenderingContext2D.prototype.drawImage;
  window.__a036Photo={called:0};
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
   window.__a036Photo.called++;
   CanvasRenderingContext2D.prototype.drawImage=original;
   throw Error('A036_SYNTHETIC_PHOTO_CONVERSION_REJECT_ONCE');
  };
 });
}
async function injectReadbackOnce(page){
 await page.evaluate(()=>{
  const old=IDBDatabase.prototype.transaction;
  const a={fired:0,armed:true};window.__a036Read=a;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const names=Array.isArray(stores)?stores:[stores];
   if(a.armed&&mode==='readonly'&&names.length===1&&names[0]==='mistakes'){
    a.armed=false;a.fired++;throw Error('A036_SYNTHETIC_AFTER_COMMIT_ACK_LOST');
   }
   return old.call(this,stores,mode,...rest);
  };
 });
}
async function flags(page){
 return page.evaluate(()=>({
  saveDisabled:document.querySelector('#save-btn').disabled,
  formVisible:!document.querySelector('#page-add').classList.contains('hide'),
  error:document.querySelector('#form-error').textContent,
  status:document.querySelector('#v13-save-state').textContent
 }));
}
async function entryCaseA(ctx){
 const {page,pageErrors}=await setup(ctx,320);
 await fill(page,TEXT_A);
 const before=await ledger(page);
 await injectPhotoRejectOnce(page);
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>window.__a036Photo?.called===1,null,{timeout:12000});
 await page.waitForTimeout(230);
 const rejected=await flags(page);
 const atFailure=await ledger(page);
 assert.deepEqual(atFailure,before,'photo conversion rejection MUST NOT write rows/photos');
 await shot(page,'A-photo-conversion-reject-320');
 // Retry with same prepared image; the injected rejection has already restored photoBlob.
 await page.locator('#mistake-form').evaluate(x=>x.requestSubmit());
 await page.waitForTimeout(900);
 const retried=await ledger(page),afterRetry=await flags(page);
 const rescued=retried.records.length===1&&retried.photos.length===1&&
  retried.records[0].id===retried.photos[0].id;
 const locked=!rescued&&retried.records.length===0;
 await shot(page,'A-normal-retry-320');
 await page.setViewportSize({width:390,height:844});
 await shot(page,'A-normal-retry-390');
 outcomes.A={rejected,retriedState:afterRetry,locked,firstLedger:atFailure,
  finalIds:retried.records.map(r=>r.id),photoBytes:retried.photos.map(x=>x.bytes.length),
  caughtInjection:pageErrors.filter(x=>x.includes('A036_SYNTHETIC_PHOTO_CONVERSION_REJECT_ONCE'))};
 assert.equal(rescued,true,'second normal submit must save exactly one record/photo');
 assert.equal(retried.records[0].problemText,TEXT_A);
 assert.equal(retried.records[0].memo,MEMO);
 assert.equal(retried.photos[0].bytes.length>0,true);
 assert.equal(pageErrors.filter(x=>!x.includes('A036_SYNTHETIC_PHOTO_CONVERSION_REJECT_ONCE')).length,0);
 await page.close();
}
async function entryCaseB(ctx){
 const {page,pageErrors}=await setup(ctx,320);
 await fill(page,TEXT_B);
 await injectReadbackOnce(page);
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 assert.match(await page.locator('#form-error').innerText(),/저장 동작은 실행됐으나 저장 후 확인에 실패/);
 assert.equal(await page.evaluate(()=>window.__a036Read.fired),1);
 const first=await ledger(page),beforeLeave=await flags(page);
 assert.equal(first.records.length,1);
 assert.equal(first.photos.length,1);
 assert.equal(first.records[0].id,first.photos[0].id);
 assert.equal(first.records[0].problemText,TEXT_B);
 assert.equal(first.records[0].memo,MEMO);
 await shot(page,'B-committed-ack-unknown-320');
 // Never click the records list before returning. The same unfinished intent
 // must not be reissued under a fresh ID after home -> add.
 await page.locator('#nav-home').click();
 const dlg=page.locator('#confirm-dialog[open]');
 if(await dlg.count())await page.locator('#dlg-ok').click();
 await page.locator('#nav-add').click();
 const reentry=await flags(page);
 // This deliberately does not inspect the saved record list.
 // If the form reset made another create possible, reenact the SAME user intent.
 if(!reentry.saveDisabled){
  await page.locator('#wrong007-grade').selectOption('3');
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(TEXT_B);
  await page.locator('#memo').fill(MEMO);
  await page.locator('#take-photo').setInputFiles({name:'a036-same-synthetic.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
 }
 await page.locator('#mistake-form').evaluate(x=>x.requestSubmit());
 await page.waitForTimeout(1100);
 const after=await ledger(page),afterFlags=await flags(page);
 await shot(page,'B-menu-reentry-before-list-320');
 await page.setViewportSize({width:390,height:844});
 await shot(page,'B-menu-reentry-before-list-390');
 const dims=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.w+2,'390px horizontal overrun');
 outcomes.B={firstId:first.records[0].id,beforeLeave,reentry,afterFlags,
  finalIds:after.records.map(r=>r.id),
  photoBytesPreserved:JSON.stringify(after.photos)===JSON.stringify(first.photos),
  actualReadbackInjected:true,readonlyFails:1,menuReentryWithoutList:true};
 assert.deepEqual(after.records,first.records,'no new ID or overwrite before checking records list');
 assert.deepEqual(after.photos,first.photos,'original photo blob bytes must remain identical');
 assert.equal(beforeLeave.saveDisabled,true,'unconfirmed form should be locked');
 assert.equal(reentry.saveDisabled,true,'the lock must persist without list inspection');
 assert.deepEqual(pageErrors,[]);
 await page.close();
}
try{
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username:'a036-synthetic-qa-only',password});
 browser=await chromium.launch({headless:true});
 // Distinct browser contexts ensure case A's error cannot affect case B's ledger.
 for(const [name,fn] of [['A',entryCaseA],['B',entryCaseB]]){
  const ctx=await browser.newContext({viewport:{width:320,height:760},
   httpCredentials:{username:'a036-synthetic-qa-only',password},acceptDownloads:false});
  try{await fn(ctx);console.log('A036_'+name+'_PASS')}
  catch(e){
   outcomes[name]={...(outcomes[name]||{}),error:String(e),stack:String(e?.stack||'').slice(0,1300)};
   process.exitCode=1;console.error('A036_'+name+'_FAIL '+String(e));
  }finally{await ctx.close()}
 }
 const output={phase:PHASE,status:process.exitCode?'FAIL':'PASS',devSha:SHA,
  boundaries:['photo reject busy','committed readback lost then home/add'],
  outcomes,shotCount,errors,outside,syntheticPhoto:true,actualOCR:false,
  actualAuth:false,actualServerAck:false,safeToRestore:false,
  priorSuitesRepeated:false,prodChanged:false,restoreExecuted:false};
 writeFileSync(DIR+'/a03-6-result.json',JSON.stringify(output,null,2));
 console.log('A036_RESULT='+JSON.stringify({status:output.status,phase:PHASE,
  A:outcomes.A?.error||'PASS',B:outcomes.B?.error||'PASS',shotCount,outside:outside.length}));
 assert.deepEqual(outside,[],'no external network allowed');
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 console.log('A036_LOCAL_EPHEMERAL_PREVIEW_STOPPED');
}
