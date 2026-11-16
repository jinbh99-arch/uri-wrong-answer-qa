// A-03-14: ONLY previously unverified backup/restore + malformed receipt
// boundaries of final A-03-12 QA blob. Synthetic only, no product/dev edits.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
 HTML_BLOB='ec1e45430445beb82fe23e4c98ee76eac402c3a9',
 DB='uriaimath-github-qa-v224-only',MARKER='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-14';
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
 await page.locator('#take-photo').setInputFiles({name:'a0314-one-pixel.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:13000});
}
async function create(page,problem,memo,ackLost=false){
 await fill(page,problem,memo);
 if(ackLost)await page.evaluate(()=>{
  const old=IDBDatabase.prototype.transaction,state={armed:true,hits:0};window.__a0314Ack=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const keys=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&keys.length===1&&keys[0]==='mistakes'){
    state.armed=false;state.hits++;
    throw Error('A0314_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
   }
   return old.call(this,stores,mode,...rest);
  };
 });
 await page.locator('#save-btn').click();
 if(ackLost){
  await page.locator('#form-error:not(.hide)').waitFor({timeout:18000});
  assert.equal(await page.evaluate(()=>window.__a0314Ack.hits),1);
  assert.equal(await page.locator('#save-btn').isDisabled(),true);
 }else{
  await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000});
 }
 return ledger(page);
}
async function validatedExport(page,expectedRows){
 await go(page,'settings');
 const downloadPromise=page.waitForEvent('download',{timeout:15000});
 await page.locator('#export-json').click();
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
async function pendingScenario(ctx){
 const page=await setup(ctx);
 let downloads=0;
 page.on('download',()=>downloads++);
 // The backup is produced by the actual UI before any receipt exists.
 const base=await create(page,'A0314 가상 과학: 물의 상태 설명','A0314 기존 기록 메모');
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0314 가상 보호자 관찰 이력 1건');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0314 가상 보호자'),null,{timeout:14000});
 const original=await ledger(page);
 assert.equal(original.records.length,1);assert.equal(original.records[0].checkHistory.length,1);
 const backup=await validatedExport(page,1);
 assert.equal(backup.records.length,1);
 assert.equal(backup.records[0].checkHistory.length,1);
 assert.equal(marker(original),null);
 await screen(page,'01-normal-backup-before-receipt',320);
 // A distinct second intent is committed, but its readback throws once.
 const pending=await create(page,'A0314 미확정 신규 과학: 달의 위상','A0314 영속 장부 테스트',true);
 assert.equal(pending.records.length,2);
 assert.equal(pending.photos.length,2);
 assert.equal(marker(pending).id,pending.records.find(x=>x.problemText.includes('달의 위상')).id);
 assert.deepEqual(pending.records.find(r=>r.id===original.records[0].id),original.records[0]);
 assert.deepEqual(pending.photos.find(p=>p.id===original.photos[0].id),original.photos[0]);
 await screen(page,'02-pending-receipt-before-export',320);
 await go(page,'settings');
 const beforeAttempts=downloads;
 await page.locator('#export-json').click();
 await page.waitForFunction(()=>document.querySelector('#v07-backup-result')?.textContent?.includes('전체 백업 생성 중단'),null,{timeout:14000});
 const blockedText=await page.locator('#v07-backup-result').innerText();
 assert.match(blockedText,/설정|복원/);
 assert.equal(downloads,beforeAttempts,'No plaintext backup download when receipt pending');
 assert.deepEqual(await ledger(page),pending);
 await screen(page,'03-backup-refused-pending',390);
 // Actual restore file is valid: we exported it with the app before pending.
 await page.locator('#import-file').setInputFiles({name:'a0314-valid-prepending-backup.json',
  mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 // The real UI requires confirmation; consent only in this isolated synthetic context.
 let dialogs=0;
 for(let i=0;i<8;i++){
  await page.waitForTimeout(400);
  const open=page.locator('#confirm-dialog[open]');
  if(await open.count()){
   dialogs++;await page.locator('#dlg-ok').click();
   await page.waitForTimeout(450);
  }else if(i>=3)break;
 }
 await page.waitForTimeout(550);
 const afterRestore=await ledger(page);
 assert.deepEqual(afterRestore,pending,'Pending record and photo must survive attempted destructive restore');
 assert.equal(marker(afterRestore).id,marker(pending).id);
 const resultText=await page.evaluate(()=>({
  toast:document.querySelector('#toast')?.textContent,
  v07:document.querySelector('#v07-backup-result')?.textContent,
  verify:document.querySelector('#v18-verify-result')?.textContent
 }));
 assert.ok(dialogs>0||/⛔|중단|실패|차단/.test(resultText.toast+' '+resultText.verify),
  'Importer must have attempted preflight or confirmation');
 await screen(page,'04-destructive-restore-denied-pending',390);
 // A full reload must not erase either the original or pending record/history.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:14000});
 assert.deepEqual(await ledger(page),pending);
 await go(page,'records');
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('이전 등록의 실제 ID를 확인했습니다.'),null,{timeout:14000});
 const cleared=await ledger(page);
 assert.equal(marker(cleared),null);
 assert.deepEqual(cleared.records,pending.records);
 assert.deepEqual(cleared.photos,pending.photos);
 await screen(page,'05-confirmed-list-releases-receipt',320);
 // Normal backup resumes after receipt confirmation and preserves TWO real rows.
 const afterBackup=await validatedExport(page,2);
 assert.equal(afterBackup.records.length,2);
 assert.equal(Object.keys(afterBackup.photos).length,2);
 assert.deepEqual(afterBackup.records.find(x=>x.id===original.records[0].id).checkHistory,
  original.records[0].checkHistory);
 await screen(page,'06-backup-resumed-after-confirm',390);
 return {status:'PASS',originalRows:1,pendingRows:2,originalHistory:1,backupWhilePendingBlocked:true,
  destructiveRestoreWhilePendingBlocked:true,sourceRowUnchanged:true,originalPhotoSha:digest(Buffer.from(original.photos[0].bytes)),
  snapshotSurvivedReload:true,confirmationClearsReceipt:true,validatedExportAfterConfirm:true,
  syntheticImporterConfirmations:dialogs};
}
async function malformedScenario(ctx){
 const page=await setup(ctx);
 const initial=await create(page,'A0314 합성 관찰: 산과 염기','A0314 백업 보호 검증');
 assert.equal(initial.records.length,1);assert.equal(initial.photos.length,1);
 await page.evaluate(name=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['settings'],'readwrite');
   tx.objectStore('settings').put({id:'m-a0314-missing-source',at:Date.now(),v:1},'wrongA012PendingCreateV1');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),DB);
 const poisoned=await ledger(page);
 assert.equal(poisoned.records.length,1);
 assert.equal(poisoned.photos.length,1);
 assert.ok(marker(poisoned)&&!poisoned.records.some(r=>r.id===marker(poisoned).id));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'07-malformed-receipt-fails-closed',320);
 const add=page.locator('#nav-add');
 await add.click();
 await page.locator('#problem').fill('A0314 오염된 확인장부 이후 신규 문제 차단');
 assert.equal(await page.locator('#save-btn').isDisabled(),true,'UI must disable save when unsafe settings receipt exists');
 await page.locator('#mistake-form').evaluate(f=>f.requestSubmit());
 await page.locator('#form-error:not(.hide)').waitFor({timeout:13000});
 assert.match(await page.locator('#form-error').innerText(),/저장소를 사용할 수 없습니다/);
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'08-malformed-receipt-no-write',390);
 return {status:'PASS_FAIL_CLOSED',unknownReceiptIdBlocked:true,oldRecordAndPhotoPreserved:true,
  noUnknownReceiptCleanup:true,normalSaveBlockedUntilRepair:true};
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0314-synthetic-qa',password},acceptDownloads:true});
 try{out.scenarios[name]=await fn(ctx);console.log('A0314_'+name+'_PASS')}
 catch(e){out.scenarios[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2100)};
  process.exitCode=1;console.error('A0314_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
try{
 assert.equal(gitblob(initialHtml),HTML_BLOB,'Requires exact final A03-12 product QA source');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0314-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 await run('backupRestorePending',pendingScenario,password);
 await run('malformedReceiptFailClosed',malformedScenario,password);
 assert.deepEqual(out.pageErrors,[]);
 assert.deepEqual(out.external,[]);
 if(Object.values(out.scenarios).some(x=>!String(x.status).startsWith('PASS')))
  throw Error('A0314_INCOMPLETE_OR_UNSAFE');
 out.result='PASS_ISOLATED_BACKUP_RESTORE_FAIL_CLOSED_ONLY';
}catch(err){out.result='FAIL';out.error=String(err);process.exitCode=1;console.error('A0314_TEST_FAIL '+String(err))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 out.sourceByteExact=gitblob(readFileSync('index.html'))===HTML_BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A0314_RESULT='+JSON.stringify({result:out.result,scenarios:Object.fromEntries(Object.entries(out.scenarios).map(([k,v])=>[k,v.status])),
  photos:out.screenshots.length,network:out.external.length,errors:out.pageErrors.length,sourceUnchanged:out.sourceByteExact}));
}
