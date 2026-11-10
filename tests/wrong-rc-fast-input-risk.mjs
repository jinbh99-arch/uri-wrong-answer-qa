// WRONG-RC-FAST: synthetic-only deterministic repro of stale retry controls during photo-read.
// No production accounts/real photographs. Delays ONLY an IndexedDB photo completion callback.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser;
async function stored(page){
 return page.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((yes,no)=>{req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error)});
  try{
   const tx=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   return await new Promise((yes,no)=>{tx.onsuccess=()=>yes(tx.result);tx.onerror=()=>no(tx.error)});
  }finally{db.close()}
 },DB);
}
async function add(page,title,{photo=false}={}){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(title);
 if(photo){
  await page.locator('#choose-photo').setInputFiles({name:'fast-risk-synthetic.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const r=(await stored(page)).find(x=>x.problemText===title);
 assert.ok(r,'new record not saved: '+title);return r.id;
}
try{
 browser=await chromium.launch({headless:true});
 const page=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
 const jsErrors=[];page.on('pageerror',e=>jsErrors.push(String(e)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const idA=await add(page,'가상 빠른입력 A');
 const idB=await add(page,'가상 빠른입력 B (사진 첨부)',{photo:true});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+idA+'"]').click();
 await page.locator('#wrong008-next-review').waitFor({state:'attached',timeout:25000});
 assert.equal(await page.locator('#v230-answer').isVisible(),true);
 await page.locator('#nav-records').click();

 // The app starts rendering B synchronously but awaits photo IndexedDB read.
 // Hold B's ONLY photo read callback to make the normally short window visible.
 await page.evaluate(id=>{
  const old=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get=function(key){
   const req=old.apply(this,arguments);
   if(this.name!=='photos'||key!==id)return req;
   return new Proxy(req,{
    get(target,prop){return Reflect.get(target,prop,target)},
    set(target,prop,value){
     if(prop==='onsuccess'&&typeof value==='function'){
      target.onsuccess=e=>setTimeout(()=>value.call(target,e),1200);
      return true;
     }
     return Reflect.set(target,prop,value,target);
    }
   });
  };
 },idB);
 await page.locator('#records-list button[data-record="'+idB+'"]').click();
 await page.locator('#wrong007-record-context').waitFor({state:'visible'});
 const pending=await page.evaluate(()=>({
   currentText:document.querySelector('#detail-text')?.textContent,
   staleRetryVisible:!!document.querySelector('#v230-answer')?.getClientRects().length,
   staleSaveVisible:!!document.querySelector('#v230-save')?.getClientRects().length,
   state:document.querySelector('#wrong002-state')?.textContent,
   loadingNote:document.querySelector('#v25-learning-flow')?.textContent?.slice(0,120)
 }));
 console.log('WRONG_RC_FAST_INPUT_PENDING='+JSON.stringify(pending));
 // User must never be able to type into a previous record's active form while B loads.
 assert.equal(pending.staleRetryVisible,false,'previous record retry textarea remains interactive during B photo loading');
 assert.equal(pending.staleSaveVisible,false,'previous record save action remains interactive during B photo loading');
 await page.locator('#wrong008-next-review').waitFor({state:'attached',timeout:25000});
 await page.locator('#v230-answer').fill('가상 B 답안');
 await page.locator('#v230-save').click();
 await page.waitForFunction(id=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),idB,{timeout:15000});
 const records=await stored(page),a=records.find(x=>x.id===idA),b=records.find(x=>x.id===idB);
 assert.equal(a.generalRetryHistory.length,0);
 assert.equal(b.generalRetryHistory.length,1);
 assert.equal(b.generalRetryHistory[0].answer,'가상 B 답안');
 assert.deepEqual(jsErrors,[]);
 console.log('WRONG_RC_FAST_INPUT_RESULT='+JSON.stringify({status:'PASS',noStaleInput:true,recordAUnchanged:true,recordBCorrect:true,syntheticOnly:true,realUsers:0}));
}catch(e){
 console.error('WRONG_RC_FAST_INPUT_RESULT='+JSON.stringify({status:'FAIL',error:String(e),stack:String(e?.stack).slice(0,2000)}));
 process.exitCode=1;
}finally{await browser?.close()}
