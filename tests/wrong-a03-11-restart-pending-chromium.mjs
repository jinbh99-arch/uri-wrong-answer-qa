// A-03-11 only: reproduce the NEW volatile-pending-ID failure on reload/reopen.
// FAIL-to-prove-safety => BLOCK. PASS only means the blocking failure was reproduced.
// This is a localhost-gated, disposable Chromium IDB; no prod/dev app edits.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const APP_BLOB='174e49b0ffb3875dd61f18919e34d5d6ceb06f65';
const DB='uriaimath-github-qa-v224-only';
const DIR='qa-proof/wrong-a03-11';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const sha256=x=>createHash('sha256').update(x).digest('hex');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const html=readFileSync('index.html');
const evidence={status:'RUNNING',featureSafe:false,devSha:DEV,
 indexBlob:gitblob(html),branch:'qa/wrong-a03-11-restart-pending-20261116-2105',
 cases:{},screenshots:[],outsideRequests:[],pageErrors:[],parentLedgerPreserved:true,
 syntheticOnly:true,realOCR:false,realServerAck:false,realFamilyAuth:false,realPhone:false,
 safeToRestore:false,priorPassedSuitesRepeated:false,devChanged:false,appChanged:false};
mkdirSync(DIR,{recursive:true});
let browser,preview,context;
async function ledger(page){
 return page.evaluate(dbname=>new Promise((res,rej)=>{
  const req=indexedDB.open(dbname);
  req.onerror=()=>rej(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
   rr=tx.objectStore('mistakes').getAll(),
   kk=tx.objectStore('photos').getAllKeys(),
   pp=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();rej(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(kk.result.map(async(id,i)=>({
      id,type:pp.result[i].type,bytes:Array.from(new Uint8Array(await pp.result[i].arrayBuffer()))
    })));
    db.close();
    res({records:rr.result.sort((a,b)=>String(a.id).localeCompare(String(b.id))),
      photos:photos.sort((a,b)=>String(a.id).localeCompare(String(b.id)))});
   }catch(e){db.close();rej(e)}};
  };
 }),DB);
}
async function screen(page,name,width){
 await page.setViewportSize({width,height:width===320?760:844});
 const dimensions=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.w+2,'horizontal overflow at '+width);
 const path=DIR+'/'+name+'-'+width+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 evidence.screenshots.push({path,...dimensions});
}
async function openPage(){
 const page=await context.newPage();
 page.on('pageerror',e=>evidence.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))evidence.outsideRequests.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 return page;
}
async function fill(page,txt,memo){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(txt);
 await page.locator('#memo').fill(memo);
 await page.locator('#take-photo').setInputFiles({name:'a0311-synthetic.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
}
async function injectAckLoss(page){
 await page.evaluate(()=>{
  const prior=IDBDatabase.prototype.transaction,control={armed:true,hits:0};window.__a0311Ack=control;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){
   const ss=Array.isArray(names)?names:[names];
   if(control.armed&&mode==='readonly'&&ss.length===1&&ss[0]==='mistakes'){
    control.armed=false;control.hits++;
    throw Error('A0311_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
   }
   return prior.call(this,names,mode,...rest);
  };
 });
}
async function seedUncertain(page,txt,memo){
 await fill(page,txt,memo);
 await injectAckLoss(page);
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:18000});
 assert.equal(await page.evaluate(()=>window.__a0311Ack.hits),1);
 assert.match(await page.locator('#form-error').innerText(),/저장 동작은 실행됐으나 저장 후 확인에 실패/);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 const first=await ledger(page);
 assert.equal(first.records.length,1);
 assert.equal(first.photos.length,1);
 assert.equal(first.records[0].problemText,txt);
 assert.equal(first.records[0].memo,memo);
 assert.equal(first.photos[0].id,first.records[0].id);
 return first;
}
async function repeatIntent(page,txt,memo){
 await fill(page,txt,memo);
 const unlocked=!await page.locator('#save-btn').isDisabled();
 // The new page has no volatile pending ID and incorrectly enables save.
 assert.equal(unlocked,true,'A0311 expected unsafe fresh page to permit same intent');
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:18000});
 return ledger(page);
}
function compareDup(first,after,txt,memo){
 assert.equal(after.records.length,2,'same synthetic intent replay must produce a second row to prove BLOCK');
 assert.equal(after.photos.length,2);
 const candidates=after.records.filter(r=>r.problemText===txt&&r.memo===memo);
 assert.equal(candidates.length,2,'two IDs for one deliberately replayed intent');
 assert.equal(new Set(candidates.map(r=>r.id)).size,2);
 assert.deepEqual(after.records.find(r=>r.id===first.records[0].id),first.records[0],
  'original committed row must remain byte-for-byte unchanged');
 assert.deepEqual(after.photos.find(p=>p.id===first.photos[0].id),first.photos[0],
  'original photo bytes must remain unchanged');
 return {firstId:first.records[0].id,secondId:candidates.find(r=>r.id!==first.records[0].id).id,
  originalPhotoSha256:sha256(Buffer.from(first.photos[0].bytes)),
  distinctIds:2,replayedSameIntent:true,originalRecordPreserved:true,originalPhotoPreserved:true};
}
async function freshContext(){
 if(context)await context.close();
 context=await browser.newContext({httpCredentials:{username:'a0311-synthetic-qa',password:evidence._password},acceptDownloads:false});
}
async function caseReload(){
 await freshContext();
 const page=await openPage(),txt='A0311 합성 동일 의도: 태양계 행성 분류',memo='A0311 가상 보호자 메모 (개인정보 없음)';
 assert.equal((await ledger(page)).records.length,0);
 const first=await seedUncertain(page,txt,memo);
 await screen(page,'01-ack-unknown-locked',320);
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal((await ledger(page)).records.length,1);
 await screen(page,'02-after-reload-home',320);
 const after=await repeatIntent(page,txt,memo);
 const proof=compareDup(first,after,txt,memo);
 await screen(page,'03-replayed-intent',390);
 await page.close();
 return {status:'BLOCKED_PENDING_ID_LOST_ON_RELOAD',
  pendingBeforeReloadLocked:true,pendingAfterReloadNotRestored:true,...proof};
}
async function caseReopen(){
 await freshContext();
 let page=await openPage();
 const txt='A0311 합성 동일 의도: 별자리 관찰 기록',memo='A0311 동일 입력 재개 (합성)';
 const first=await seedUncertain(page,txt,memo);
 await screen(page,'04-before-tab-close',320);
 await page.close();
 // SAME browser context and same origin preserve IDB; only in-memory state dies.
 page=await openPage();
 assert.equal((await ledger(page)).records.length,1);
 const after=await repeatIntent(page,txt,memo);
 const proof=compareDup(first,after,txt,memo);
 await screen(page,'05-reopen-replayed-intent',390);
 await page.close();
 return {status:'BLOCKED_PENDING_ID_LOST_ON_TAB_REOPEN',sameOriginIDBContinues:true,...proof};
}
async function caseSiblingTab(){
 await freshContext();
 const one=await openPage(),two=await openPage();
 const txt='A0311 합성 동일 의도: 사계절 변화',memo='A0311 동일 사용자 의도를 다른 탭에서 재시도';
 const first=await seedUncertain(one,txt,memo);
 assert.equal(await one.locator('#save-btn').isDisabled(),true);
 // Different tab is loaded before the first commit; simulates same user
 // moving from uncertain A to existing B and repeating the SAME intent.
 const after=await repeatIntent(two,txt,memo);
 const proof=compareDup(first,after,txt,memo);
 await screen(two,'06-other-tab-replayed-intent',390);
 await one.close();await two.close();
 return {status:'BLOCKED_PENDING_ID_NOT_SHARED_ACROSS_TABS',
  distinctIndependentIntentsAreNotAssumedDuplicate:true,...proof};
}
try{
 assert.equal(gitblob(html),APP_BLOB,'must use exact fixed A03-10 QA product blob');
 evidence._password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0311-synthetic-qa',password:evidence._password});
 browser=await chromium.launch({headless:true});
 for(const [key,fn] of [['reload',caseReload],['tabReopen',caseReopen],['siblingTab',caseSiblingTab]]){
  try{evidence.cases[key]=await fn();console.log('A0311_'+key+'_BLOCK_REPRODUCED')}
  catch(e){evidence.cases[key]={status:'TEST_FAILED',error:String(e),stack:String(e?.stack||'').slice(0,1800)};
    process.exitCode=1;console.error('A0311_'+key+'_ERROR '+String(e))}
 }
 assert.deepEqual(evidence.pageErrors,[]);
 assert.deepEqual(evidence.outsideRequests,[]);
 if(Object.values(evidence.cases).some(c=>!c.status?.startsWith('BLOCKED_')))throw Error('UNEXPECTED_NOT_ALL_RISK_PROOFS_REPRODUCED');
 evidence.status='BLOCKED_PENDING_ID_NOT_DURABLE';
 evidence.featureSafe=false; // CI success means the FAIL/BLOCK was proven.
}catch(e){
 evidence.status='TEST_INVALID';evidence.error=String(e);
 process.exitCode=1;console.error('A0311_TEST_INVALID '+String(e));
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(preview)await preview.close();
 delete evidence._password;
 evidence.appByteExactAfterRun=sha256(readFileSync('index.html'))===sha256(html);
 evidence.parentLedgerPreserved=Object.values(evidence.cases).every(x=>x.originalRecordPreserved&&x.originalPhotoPreserved);
 writeFileSync(DIR+'/a03-11-restart-result.json',JSON.stringify(evidence,null,2));
 console.log('A0311_RESULT='+JSON.stringify({status:evidence.status,featureSafe:evidence.featureSafe,
   cases:Object.fromEntries(Object.entries(evidence.cases).map(([k,v])=>[k,v.status])),
   captures:evidence.screenshots.length,outside:evidence.outsideRequests.length,errors:evidence.pageErrors.length,
   originalRecordPhotosPreserved:evidence.parentLedgerPreserved,appUnchanged:evidence.appByteExactAfterRun}));
}
