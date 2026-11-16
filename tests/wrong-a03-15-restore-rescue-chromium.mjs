// A-03-15: ONLY previously unverified backup/restore + malformed receipt
// boundaries of final A-03-12 QA blob. Synthetic only, no product/dev edits.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
 HTML_BLOB='ec1e45430445beb82fe23e4c98ee76eac402c3a9',
 DB='uriaimath-github-qa-v224-only',MARKER='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-15';
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
 await page.locator('#take-photo').setInputFiles({name:'a0315-one-pixel.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:13000});
}
async function create(page,problem,memo,ackLost=false){
 await fill(page,problem,memo);
 if(ackLost)await page.evaluate(()=>{
  const old=IDBDatabase.prototype.transaction,state={armed:true,hits:0};window.__a0315Ack=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const keys=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&keys.length===1&&keys[0]==='mistakes'){
    state.armed=false;state.hits++;
    throw Error('A0315_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
   }
   return old.call(this,stores,mode,...rest);
  };
 });
 await page.locator('#save-btn').click();
 if(ackLost){
  await page.locator('#form-error:not(.hide)').waitFor({timeout:18000});
  assert.equal(await page.evaluate(()=>window.__a0315Ack.hits),1);
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
 out.exportEarlyDiagnostic={pre,post};console.log('A0315_EXPORT_EARLY='+JSON.stringify({pre,post}));
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

async function normalRestore(ctx){
 const page=await setup(ctx);
 const first=await create(page,'A0315 합성 수학 외 과학 문제: 달 관찰','A0315 가상 보호자 메모');
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0315 가상 보호자 관찰 이력 백업 원본');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0315 가상 보호자 관찰 이력'),null,{timeout:15000});
 const original=await ledger(page);
 assert.equal(original.records.length,1);
 assert.equal(original.photos.length,1);
 assert.equal(original.records[0].checkHistory.length,1);
 assert.equal(marker(original),null);
 const backup=await validatedExport(page,1);
 assert.equal(backup.records.length,1);
 assert.equal(backup.records[0].id,original.records[0].id);
 await screen(page,'01-validated-backup-320',320);
 const extra=await create(page,'A0315 별도 가상 과학 문제: 전자석','A0315 복원으로 대체되는 다른 원장');
 assert.equal(extra.records.length,2);assert.equal(extra.photos.length,2);assert.equal(marker(extra),null);
 const other=extra.records.find(x=>x.id!==original.records[0].id);
 assert.ok(other);
 await screen(page,'02-before-restore-two-390',390);
 await go(page,'settings');
 await page.locator('#import-file').setInputFiles({name:'a0315-synthetic-validated-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForFunction(()=>document.querySelector('#confirm-dialog')?.open===true||
  document.querySelector('#v18-verify-result')?.textContent?.includes('⛔'),null,{timeout:27000});
 const beforeConfirm=await page.evaluate(()=>({
  open:document.querySelector('#confirm-dialog')?.open,
  verify:document.querySelector('#v18-verify-result')?.textContent,
  toast:document.querySelector('#toast')?.textContent
 }));
 out.restorePreflight=beforeConfirm;
 if(!beforeConfirm.open)throw Error('REAL_RESTORE_PREFLIGHT_DENIED '+JSON.stringify(beforeConfirm));
 assert.match(beforeConfirm.verify,/복원 전 검사|독립 시험/);
 await screen(page,'03-real-restore-confirmation-320',320);
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('복원 후 재읽기 확인')||
   document.querySelector('#v18-verify-result')?.textContent?.includes('⚠️ 복원 트랜잭션은 완료'),null,{timeout:20000});
 const status=await page.evaluate(()=>({
  toast:document.querySelector('#toast')?.textContent,
  verify:document.querySelector('#v18-verify-result')?.textContent,
  homeVisible:!document.querySelector('#page-home')?.classList.contains('hide')
 }));
 out.restorePostcommit=status;
 assert.match(status.toast,/복원 후 재읽기 확인/,'Restore must verify after committed IDB data');
 const after=await ledger(page);
 assert.equal(after.records.length,1);assert.equal(after.photos.length,1);
 assert.equal(marker(after),null);
 const restored=after.records[0],before=original.records[0];
 assert.equal(restored.id,before.id);
 assert.equal(restored.problemText,before.problemText);
 assert.equal(restored.memo,before.memo);
 assert.equal(restored.subject,before.subject);
 assert.deepEqual(restored.checkHistory,before.checkHistory);
 for(const k of ['practiceHistory','generalRetryHistory','prerequisiteChecks','followupHistory','studyPlan','createdAt']){
  if(before[k]!==undefined)assert.deepEqual(restored[k],before[k],'Restore '+k);
 }
 assert.deepEqual(after.photos[0],original.photos[0]);
 assert.ok(!after.records.some(x=>x.id===other.id));
 assert.ok(!after.photos.some(x=>x.id===other.id));
 await screen(page,'04-real-restore-verified-390',390);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:14000});
 const reloaded=await ledger(page);
 assert.deepEqual(reloaded,after,'Restored data must persist across reload');
 await screen(page,'05-restored-after-reload-320',320);
 return {status:'PASS',sourceRecords:1,sourcePhotos:1,sourceHistory:1,preRestoreRecords:2,
  restoredRecords:1,restoredPhotos:1,removedUnbackedId:true,exactPhotoSha256:digest(Buffer.from(after.photos[0].bytes)),
  parentHistoryPreserved:true,reloadDurable:true,postcommitVerification:true,restoreBaselineSerial:true};
}
async function corruptedReceiptRescue(ctx){
 const page=await setup(ctx);
 const seeded=await create(page,'A0315 합성 과학 문제: 물 순환','A0315 손상 장부 원본 보관용');
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0315 가상 보호자 보존 이력');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0315 가상 보호자'),null,{timeout:15000});
 const healthy=await ledger(page);
 assert.equal(healthy.records.length,1);assert.equal(healthy.photos.length,1);
 const poison={id:'m-a0315-nonexistent-row',v:1,at:1731774000000};
 await page.evaluate(({dbName,key,value})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['settings'],'readwrite');
   tx.objectStore('settings').put(value,key);
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),{dbName:DB,key:MARKER,value:poison});
 const before=await ledger(page);
 assert.deepEqual(marker(before),poison);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 assert.equal(await page.locator('#v220-rescue-panel').isVisible(),true);
 assert.deepEqual(await ledger(page),before);
 await screen(page,'06-corrupt-receipt-raw-rescue-320',320);
 const downloadPromise=page.waitForEvent('download',{timeout:15000});
 await page.locator('#v221-rescue-current').click();
 const download=await downloadPromise;
 const raw=JSON.parse(readFileSync(await download.path(),'utf8'));
 assert.equal(raw.format,'uriaimath-current-raw-evidence-v01');
 assert.equal(raw.restorableByApp,false);
 assert.equal(raw.summary.records,1);
 assert.equal(raw.summary.photos,1);
 assert.equal(raw.stores.mistakes.values.length,1);
 assert.equal(raw.stores.mistakes.values[0].id,healthy.records[0].id);
 assert.deepEqual(raw.stores.mistakes.values[0].checkHistory,healthy.records[0].checkHistory);
 const markerIndex=raw.stores.settings.keys.indexOf(MARKER);
 assert.ok(markerIndex>=0,'Raw export must preserve the unknown receipt');
 assert.deepEqual(raw.stores.settings.values[markerIndex],poison);
 assert.equal(raw.stores.photos.length,1);
 const one=raw.stores.photos[0];
 assert.equal(one.key,healthy.photos[0].id);
 const match=String(one.dataUrl).match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
 assert.ok(match,'raw photo must retain lossless base64 bytes');
 assert.equal(match[1],healthy.photos[0].type);
 assert.deepEqual([...Buffer.from(match[2],'base64')],healthy.photos[0].bytes);
 assert.ok(raw.integrity?.digest);
 assert.match(await page.locator('#v221-rescue-status').innerText(),/원본 다운로드 요청/);
 assert.deepEqual(await ledger(page),before,'Raw rescue must be read-only and preserve malformed marker');
 await screen(page,'07-exported-raw-byte-exact-390',390);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 assert.deepEqual(await ledger(page),before,'Reload must not repair or delete corrupted receipt');
 return {status:'PASS',rawEvidenceSavedAsNonRestorable:true,rawReceiptPreserved:true,
  malformedIdNoAutoRepair:true,historyPreserved:true,photoSha256:digest(Buffer.from(healthy.photos[0].bytes)),
  exactBytesExported:true,readOnlyNoMutation:true,storageStillFailClosed:true};
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0315-synthetic-qa',password},acceptDownloads:true});
 try{out.scenarios[name]=await fn(ctx);console.log('A0315_'+name+'_PASS')}
 catch(e){out.scenarios[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2500)};
  process.exitCode=1;console.error('A0315_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
try{
 assert.equal(gitblob(initialHtml),HTML_BLOB,'Exact final A-03-12 QA app blob required');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0315-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 const filter=process.env.A0315_CASE||'all';
 if(filter==='all'||filter==='normalRestore')await run('normalRestore',normalRestore,password);
 if(filter==='all'||filter==='corruptRawRescue')await run('corruptRawRescue',corruptedReceiptRescue,password);
 assert.deepEqual(out.external,[]);
 assert.deepEqual(out.pageErrors,[]);
 if(Object.values(out.scenarios).some(x=>x.status!=='PASS'))throw Error('A0315_SCENARIO_FAILURE');
 out.result='PASS_ISOLATED_NEW_RESTORE_OR_RAW_RESCUE_ONLY';
}catch(err){out.result='FAIL';out.error=String(err);process.exitCode=1;console.error('A0315_TEST_ERROR '+String(err))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 out.sourceByteExact=gitblob(readFileSync('index.html'))===HTML_BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A0315_RESULT='+JSON.stringify({status:out.result,cases:Object.fromEntries(Object.entries(out.scenarios).map(([k,v])=>[k,v.status])),
  screenshots:out.screenshots.length,external:out.external.length,pageErrors:out.pageErrors.length,
  originalAppUnchanged:out.sourceByteExact}));
}
