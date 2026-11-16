// A-03-16: ONLY previously unverified backup/restore + malformed receipt
// boundaries of final A-03-12 QA blob. Synthetic only, no product/dev edits.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
 HTML_BLOB='b6abcd44e223ce7379d2182b683674f50473a303',
 DB='uriaimath-github-qa-v224-only',MARKER='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-16';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const digest=b=>createHash('sha256').update(b).digest('hex');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const initialHtml=readFileSync('index.html');
const out={result:'RUNNING',sourceBlob:gitblob(initialHtml),devSha:DEV,scenarios:{},
 screenshots:[],external:[],pageErrors:[],syntheticOnly:true,realOCR:false,realServerAck:false,
 realFamilyAuth:false,realMobile:false,safeToRestore:false,productDevChanged:false,
 oldSuitesRepeated:false};mkdirSync(DIR,{recursive:true});
let browser,preview;

async function ledger(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const d=open.result,tx=d.transaction(['mistakes','photos','settings'],'readonly'),
    r=tx.objectStore('mistakes').getAll(),p=tx.objectStore('photos').getAll(),
    k=tx.objectStore('photos').getAllKeys(),sk=tx.objectStore('settings').getAllKeys(),
    sv=tx.objectStore('settings').getAll();
   tx.onerror=()=>{d.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(k.result.map(async(key,i)=>({
     id:key,type:p.result[i].type,bytes:Array.from(new Uint8Array(await p.result[i].arrayBuffer()))
    })));
    d.close();resolve({
     records:r.result.sort((a,b)=>String(a.id).localeCompare(String(b.id))),
     photos:photos.sort((a,b)=>String(a.id).localeCompare(String(b.id))),
     settings:sk.result.map((key,i)=>({key,value:sv.result[i]})).sort((a,b)=>String(a.key).localeCompare(String(b.key)))
    });
   }catch(e){d.close();reject(e)}};
  };
 }),DB);
}
const marker=snapshot=>snapshot.settings.find(x=>x.key===MARKER)?.value??null;
async function screen(page,name,w){
 await page.setViewportSize({width:w,height:w===320?760:844});
 const dims=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.w+2,'mobile overflow '+JSON.stringify(dims));
 const path=DIR+'/'+name+'-'+w+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 out.screenshots.push(path);
}
async function setup(ctx){
 const page=await ctx.newPage();
 page.on('pageerror',e=>out.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))out.external.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:13000});
 return page;
}
async function go(page,nav){
 await page.locator('#nav-'+nav).click();
 if(await page.locator('#confirm-dialog[open]').count())await page.locator('#dlg-ok').click();
 await page.waitForFunction(n=>!document.querySelector('#page-'+n)?.classList.contains('hide'),nav,{timeout:14000});
}
async function fill(page,problem,memo){
 await go(page,'add');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(problem);
 await page.locator('#memo').fill(memo);
 await page.locator('#take-photo').setInputFiles({name:'a0316-one-pixel.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:13000});
}
async function create(page,problem,memo,ackLost=false){
 await fill(page,problem,memo);
 if(ackLost)await page.evaluate(()=>{
  const old=IDBDatabase.prototype.transaction,state={armed:true,hits:0};window.__a0316Ack=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const keys=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&keys.length===1&&keys[0]==='mistakes'){
    state.armed=false;state.hits++;
    throw Error('A0316_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
   }
   return old.call(this,stores,mode,...rest);
  };
 });
 await page.locator('#save-btn').click();
 if(ackLost){
  await page.locator('#form-error:not(.hide)').waitFor({timeout:18000});
  assert.equal(await page.evaluate(()=>window.__a0316Ack.hits),1);
  assert.equal(await page.locator('#save-btn').isDisabled(),true);
 }else{
  await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000});
 }
 return ledger(page);
}
async function validatedExport(page,expectedRows){
 await go(page,'settings');
 const downloadPromise=page.waitForEvent('download',{timeout:15000});
 const pre=await page.evaluate(()=>{const b=document.querySelector('#export-json');return {handler:typeof b?.onclick,disabled:b?.disabled,connected:b?.isConnected,route:document.querySelector('#page-settings')?.className}});
 await page.locator('#export-json').click();
 await page.locator('#wrong-backup-confirm:not([hidden])').waitFor({timeout:10000});
 await page.locator('#wrong-backup-continue').click();
 await page.waitForTimeout(300);
 const post=await page.evaluate(()=>({handler:typeof document.querySelector('#export-json')?.onclick,
  disabled:document.querySelector('#export-json')?.disabled,
  status:document.querySelector('#v07-backup-result')?.textContent,
  toast:document.querySelector('#toast')?.textContent}));
 out.exportEarlyDiagnostic={pre,post};console.log('A0316_EXPORT_EARLY='+JSON.stringify({pre,post}));
 let download;
 try{download=await downloadPromise}
 catch(e){
  const debug=await page.evaluate(()=>({
   origin:location.origin,
   status:document.querySelector('#v07-backup-result')?.textContent,
   toast:document.querySelector('#toast')?.textContent,
   storage:document.querySelector('#storage-state')?.textContent,
   route:document.querySelector('#page-settings')?.className
  }));
  out.exportDebug=debug;
  throw Error('VALIDATED_UI_EXPORT_NOT_DELIVERED '+JSON.stringify(debug));
 }
 const backup=JSON.parse(readFileSync(await download.path(),'utf8'));
 assert.equal(backup.format,'uriaimath-offline-backup-v02');
 assert.equal(backup.records.length,expectedRows);
 assert.equal(Object.keys(backup.photos||{}).length,expectedRows);
 assert.match(await page.locator('#v07-backup-result').innerText(),/전체 백업 생성 및 자체 검사 통과/);
 return backup;
}


async function caseOnlyNewCompare(ctx){
 const page=await setup(ctx);
 const healthy=await create(page,'A0316 합성 과학: 우주 관찰과 수학 정리','가상 학부모 미확정 등록 비교');
 assert.equal(healthy.records.length,1);assert.equal(healthy.photos.length,1);
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0316 가상 학부모 관찰 이력 1건');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0316 가상'),null,{timeout:14000});
 const beforePoison=await ledger(page);
 assert.equal(beforePoison.records[0].checkHistory.length,1);
 const bad={id:'m-a0316-missing-committed-id',at:1731774000000,v:1};
 await page.evaluate(({name,key,value})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('settings','readwrite');
   tx.objectStore('settings').put(value,key);
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),{name:DB,key:MARKER,value:bad});
 const poisoned=await ledger(page);
 assert.deepEqual(marker(poisoned),bad);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:15000});
 assert.equal(await page.locator('#v220-rescue-panel').isVisible(),true);
 assert.equal(await page.locator('#wrong-a0316-verify').isVisible(),true);
 await screen(page,'01-corrupt-verified-original-320',320);
 const downloadPromise=page.waitForEvent('download',{timeout:17000});
 await page.locator('#v221-rescue-current').click();
 const downloaded=await downloadPromise;
 const rawText=readFileSync(await downloaded.path(),'utf8');
 const raw=JSON.parse(rawText);
 assert.equal(raw.integrity.algorithm,'SHA-256');
 assert.deepEqual(raw.stores.settings.values[raw.stores.settings.keys.indexOf(MARKER)],bad);
 assert.equal(raw.summary.records,1);assert.equal(raw.summary.photos,1);
 // Select real previously downloaded byte-for-byte raw file, no network upload.
 await page.locator('#wrong-a0316-file').setInputFiles({
  name:'a0316-verified-raw.json',mimeType:'application/json',buffer:Buffer.from(rawText)
 });
 await page.locator('#wrong-a0316-verify').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-a0316-result')?.textContent?.includes('파일 SHA-256·현재 전체 원장/사진/설정 2회 대조 일치'),null,{timeout:22000});
 const matched=await page.locator('#wrong-a0316-result').innerText();
 assert.match(matched,/손상된 장부 ID/);
 assert.match(matched,/자동 복구·삭제는 수행하지 않았습니다/);
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'02-file-equal-journal-still-blocked-390',390);
 // Corrupt one photo base64 character without recomputing the signed checksum.
 const altered=JSON.parse(rawText);
 assert.ok(altered.stores.photos[0].dataUrl.includes('base64,'));
 const oldData=altered.stores.photos[0].dataUrl;
 altered.stores.photos[0].dataUrl=oldData.slice(0,-6)+(oldData.at(-6)==='A'?'B':'A')+oldData.slice(-5);
 await page.locator('#wrong-a0316-file').setInputFiles({
  name:'a0316-altered-photo.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(altered))
 });
 await page.locator('#wrong-a0316-verify').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-a0316-result')?.textContent?.includes('SHA-256 검사값이 일치하지 않습니다'),null,{timeout:17000});
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'03-file-tamper-denied-320',320);
 // Original downloaded file is correctly signed but now STALE versus the IDB;
 // setting-only mutation must be detected, and no repair/unlock attempted.
 await page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('settings','readwrite');
   tx.objectStore('settings').put({nonce:'A0316_TEST_ONLY',phase:'checked',at:'2026-11-16T15:27:10Z'},'v04-reentry-marker');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),DB);
 const now=await ledger(page);
 assert.equal(now.records.length,1);assert.equal(now.photos.length,1);
 await page.locator('#wrong-a0316-file').setInputFiles({
  name:'a0316-stale-raw.json',mimeType:'application/json',buffer:Buffer.from(rawText)
 });
 await page.locator('#wrong-a0316-verify').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-a0316-result')?.textContent?.includes('기록·사진·설정 내용이 다릅니다'),null,{timeout:17000});
 assert.deepEqual(await ledger(page),now);
 await screen(page,'04-signed-but-stale-390',390);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 const final=await ledger(page);
 assert.deepEqual(final,now);
 assert.deepEqual(final.records,poisoned.records);
 assert.deepEqual(final.photos,poisoned.photos);
 assert.deepEqual(marker(final),bad);
 return {status:'PASS',validRawFileSha256Matched:true,photoBytesCompared:true,historyPreserved:true,
  missingReceiptIdDiagnosedWithoutAutoUnlock:true,alteredPhotoRejected:true,signedButStaleRejected:true,
  readOnlyCompareAndFailedCasesPreservedLedger:true,receiptStillFailsClosedAfterReload:true};
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0316-synthetic-qa',password},acceptDownloads:true});
 try{out.scenarios[name]=await fn(ctx);console.log('A0316_'+name+'_PASS')}
 catch(e){out.scenarios[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2500)};
  process.exitCode=1;console.error('A0316_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
try{
 assert.equal(gitblob(initialHtml),HTML_BLOB,'Only the exact new A-03-16 QA app may be tested');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0316-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 await run('rawEvidenceDoubleRead',caseOnlyNewCompare,password);
 assert.deepEqual(out.external,[]);
 assert.deepEqual(out.pageErrors,[]);
 if(Object.values(out.scenarios).some(x=>x.status!=='PASS'))throw Error('A0316_FAILURE');
 out.result='PASS_ISOLATED_NONDESTRUCTIVE_EVIDENCE_COMPARE_ONLY';
}catch(e){out.result='FAIL';out.error=String(e);process.exitCode=1;console.error('A0316_INVALID '+String(e))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 out.sourceByteExact=gitblob(readFileSync('index.html'))===HTML_BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A0316_RESULT='+JSON.stringify({result:out.result,cases:Object.fromEntries(Object.entries(out.scenarios).map(([k,v])=>[k,v.status])),
  screenshots:out.screenshots.length,network:out.external.length,pageErrors:out.pageErrors.length,appBytesUnchanged:out.sourceByteExact}));
}
