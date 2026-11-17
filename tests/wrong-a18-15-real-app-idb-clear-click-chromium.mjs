// A18-15 new boundary only: real isolated app core restore direct calls before write.
// Do NOT replay previous restore-button UI, A18-11, or real-family paths.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',APP='0ac7ac3a84f0bc198be93be6c27e603f16c0d2fb';
const DB='uriaimath-github-qa-v224-only',PENDING='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a18-15';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const blobSha=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const app=readFileSync('index.html');assert.equal(blobSha(app),APP,'QA blob changed');mkdirSync(DIR,{recursive:true});
const result={status:'RUNNING',dev:DEV,appBlob:APP,widths:{},errors:[],requests:[],screenshots:[],realFamily:false,safeToRestore:false,previousPassRepeated:false};
let browser,preview;
async function ledger(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const m=tx.objectStore('mistakes'),p=tx.objectStore('photos'),s=tx.objectStore('settings');
   const mr=m.getAll(),mk=m.getAllKeys(),pr=p.getAll(),pk=p.getAllKeys(),sr=s.getAll(),sk=s.getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(pr.result.map(async(b,i)=>({key:pk.result[i],size:b.size,mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    db.close();resolve({
     records:mk.result.map((key,i)=>({key,value:mr.result[i]})),
     photos,settings:sk.result.map((key,i)=>({key,value:sr.result[i]}))
    });
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function seed(page){
 await page.evaluate(({dbName,marker,bytes})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos','settings'],'readwrite'),id='wrong-a18-15-fake-photo-parent-01';
   tx.objectStore('mistakes').put({id,subject:'science',gradeAtEntry:3,problemText:'A18-15 합성 과학 오답',
    hasPhoto:true,memo:'가상 부모 기록',reason:'unknown',createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',
    checkHistory:[{at:'2026-11-17T01:00:00Z',status:'explained',memo:'합성 부모 관찰 1건',by:'parent_observation'}]},id);
   tx.objectStore('photos').put(new Blob([Uint8Array.from(bytes)],{type:'image/png'}),id);
   tx.objectStore('settings').put({id:'a18-13-damaged-pending-ledger',at:1731774000000,v:1},marker);
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve()};
  };
 }),{dbName:DB,marker:PENDING,bytes:Array.from(PNG)});
}
async function exercise(page,width,baseline){
 await page.setViewportSize({width,height:width===320?780:850});
 const before=await ledger(page);assert.deepEqual(before,baseline,'pre-click real IDB changed');
 const bytesBefore=Buffer.from(JSON.stringify(before),'utf8');
 const hashBefore=createHash('sha256').update(bytesBefore).digest('hex');
 let nativeDialogCount=0;
 const nativeDialog=async d=>{nativeDialogCount++;await d.dismiss()};
 page.on('dialog',nativeDialog);
 await page.evaluate(()=>{
  const previous=IDBDatabase.prototype.transaction;
  window.__a1815WriteCalls=[];
  window.__a1815RestoreTx=()=>{IDBDatabase.prototype.transaction=previous};
  IDBDatabase.prototype.transaction=function(stores,mode,...other){
   const names=Array.isArray(stores)?stores:[stores];
   if(mode==='readwrite'&&names.some(x=>['mistakes','photos','settings'].includes(x)))
    window.__a1815WriteCalls.push({mode,stores:names});
   return previous.call(this,stores,mode,...other);
  };
 });
 await page.locator('#clear-all').click();
 await page.waitForFunction(()=>document.body.innerText.includes('전체 삭제는 복원 안전성 검증 전까지 보류됩니다.'),null,{timeout:10000});
 const ui=await page.evaluate(()=>{
  const modal=document.querySelector('#confirm-dialog');
  const res={
   warning:document.body.innerText.includes('전체 삭제는 복원 안전성 검증 전까지 보류됩니다.'),
   openConfirm:!!modal?.open,
   confirmationHeading:document.querySelector('#dlg-title')?.textContent||'',
   primaryButtonVisible:!!document.querySelector('#clear-all')?.getClientRects().length,
   destructiveWriteCalls:window.__a1815WriteCalls.slice()
  };
  window.__a1815RestoreTx();
  return res;
 });
 page.off('dialog',nativeDialog);
 const after=await ledger(page);
 const bytesAfter=Buffer.from(JSON.stringify(after),'utf8'),hashAfter=createHash('sha256').update(bytesAfter).digest('hex');
 assert.equal(ui.warning,true,'in-app clear warning missing');
 assert.equal(ui.openConfirm,false,'native or custom confirmation must never open');
 assert.equal(nativeDialogCount,0,'native JS confirm should never display');
 assert.deepEqual(ui.destructiveWriteCalls,[],'blocked clear attempted destructive readwrite');
 assert.ok(bytesBefore.equals(bytesAfter),'real IDB snapshot full JSON bytes changed');
 assert.equal(hashBefore,hashAfter,'full IDB hash changed');
 assert.deepEqual(after.records,before.records,'app mistakes changed');
 assert.deepEqual(after.photos,before.photos,'real app photo Blob bytes changed');
 assert.deepEqual(after.settings,before.settings,'all settings including pending changed');
 assert.equal(after.records[0].value.checkHistory.length,1,'parent history missing');
 assert.equal(after.settings.find(x=>x.key===PENDING)?.value.id,'a18-15-damaged-pending-ledger');
 const dimensions=await page.evaluate(()=>({visible:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.visible+2,'mobile overflow '+JSON.stringify(dimensions));
 const path=DIR+'/wrong-a18-15-real-idb-clear-'+width+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 result.screenshots.push(path);
 result.widths[String(width)]={
  status:'PASS',realAppRecords:after.records.length,realAppPhotoBlobCount:after.photos.length,
  realPhotoBytes:after.photos.reduce((sum,p)=>sum+p.bytes.length,0),
  parentObservations:after.records[0].value.checkHistory.length,
  settingsCount:after.settings.length,
  pendingPreserved:true,fullIdbSha256Before:hashBefore,fullIdbSha256After:hashAfter,
  noConfirmation:true,nativeDialogCount,destructiveWrites:0,originalAppIndexedDbUnchanged:true
 };
}
try{
 const pw=randomBytes(22).toString('hex'),user='a18-13-qa-probe';
 preview=await startWrongQa66Preview({devSha:DEV,username:user,password:pw});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({httpCredentials:{username:user,password:pw},acceptDownloads:true});
 const page=await ctx.newPage();
 page.on('pageerror',e=>result.errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))result.requests.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:17000});
 await seed(page);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결')||document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:17000});
 const before=await ledger(page);
 assert.equal(before.records.length,1);assert.equal(before.photos.length,1);assert.equal(before.records[0].value.checkHistory.length,1);
 assert.equal(before.settings.find(x=>x.key===PENDING)?.value.id,'a18-13-damaged-pending-ledger');
 await page.locator('#nav-settings').click();
 await page.waitForFunction(()=>!document.querySelector('#page-settings')?.classList.contains('hide'));
 assert.ok(await page.locator('#clear-all').isVisible());
 await exercise(page,320,before);await exercise(page,390,before);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(400);
 assert.deepEqual(await ledger(page),before,'reload unexpectedly changed synthetic original');
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.requests,[]);
 result.status='PASS_ISOLATED_REAL_APP_FULL_IDB_BEFORE_AFTER_CLEAR_CLICK';
 await ctx.close();
}catch(err){result.status='FAIL';result.error=String(err);result.stack=String(err?.stack||'').slice(0,2800);process.exitCode=1;console.error('A1815_FAIL '+String(err))}
finally{
 await browser?.close();await preview?.close();
 result.appSourceUnchanged=blobSha(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(result,null,2));
 console.log('A1815_RESULT='+JSON.stringify({status:result.status,widths:result.widths,screenshots:result.screenshots.length,requests:result.requests.length,errors:result.errors.length,appSourceUnchanged:result.appSourceUnchanged,error:result.error}));
}
