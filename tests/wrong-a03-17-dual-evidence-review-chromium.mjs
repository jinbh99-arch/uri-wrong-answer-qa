// A-03-17: ONLY previously unverified backup/restore + malformed receipt
// boundaries of final A-03-12 QA blob. Synthetic only, no product/dev edits.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
 HTML_BLOB='f8361d6176d1ab54501fb6d701d4bfb04eb46b1b',
 DB='uriaimath-github-qa-v224-only',MARKER='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-17';
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
    throw Error('A0317_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
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
 out.exportEarlyDiagnostic={pre,post};console.log('A0317_EXPORT_EARLY='+JSON.stringify({pre,post}));
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
 const initial=await create(page,'A0317 합성 과학: 관찰 기록','가상 학부모 기록 원본 두 개 대조');
 assert.equal(initial.records.length,1);assert.equal(initial.photos.length,1);
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0317 가상 학부모 이력 원문 보존');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0317 가상'),null,{timeout:14000});
 const bad={id:'m-a0317-missing-pending-id',at:1731774000000,v:1};
 await page.evaluate(({name,key,value})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{const d=req.result,tx=d.transaction('settings','readwrite');tx.objectStore('settings').put(value,key);
   tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}}}),{name:DB,key:MARKER,value:bad});
 const poisoned=await ledger(page);
 assert.deepEqual(marker(poisoned),bad);
 assert.equal(poisoned.records[0].checkHistory.length,1);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:17000});
 assert.equal(await page.locator('#wrong-a0317-verify').isVisible(),true);
 async function rawExport(){
  const p=page.waitForEvent('download',{timeout:17000});
  await page.locator('#v221-rescue-current').click();
  const downloaded=await p;
  const rawText=readFileSync(await downloaded.path(),'utf8');
  const parsed=JSON.parse(rawText);
  assert.equal(parsed.summary.records,1);
  assert.equal(parsed.summary.photos,1);
  assert.equal(parsed.integrity.algorithm,'SHA-256');
  return {rawText,parsed};
 }
 const a=await rawExport();
 await page.waitForTimeout(1300);
 const b=await rawExport();
 assert.notEqual(a.parsed.integrity.digest,b.parsed.integrity.digest,'two independent timestamped exports must differ');
 async function selectPair(x,y){
  await page.locator('#wrong-a0317-file-a').setInputFiles({name:'a0317-file-a.json',mimeType:'application/json',buffer:Buffer.from(x)});
  await page.locator('#wrong-a0317-file-b').setInputFiles({name:'a0317-file-b.json',mimeType:'application/json',buffer:Buffer.from(y)});
  await page.locator('#wrong-a0317-verify').click();
 }
 await selectPair(a.rawText,b.rawText);
 await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('두 원본 SHA-256 개별 일치'),null,{timeout:25000});
 const pass=await page.locator('#wrong-a0317-result').innerText();
 assert.match(pass,/손상 장부 ID 누락/);
 assert.match(pass,/데이터 변경0/);
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'01-two-distinct-valid-raw-locked',320);
 // Copying the same backup into two file selectors is not separate evidence.
 await selectPair(a.rawText,a.rawText);
 await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('두 파일의 SHA-256이 같습니다'),null,{timeout:18000});
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'02-duplicate-file-refused',390);
 // Tamper with original photo data without updating its SHA-256.
 const altered=JSON.parse(b.rawText);
 const data=altered.stores.photos[0].dataUrl;
 altered.stores.photos[0].dataUrl=data.slice(0,-6)+(data.at(-6)==='A'?'B':'A')+data.slice(-5);
 await selectPair(a.rawText,JSON.stringify(altered));
 await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('SHA-256 불일치'),null,{timeout:18000});
 assert.deepEqual(await ledger(page),poisoned);
 await screen(page,'03-photo-tamper-refused',320);
 // Independently signed latest export differs from old export (the receipt is kept).
 await page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{const d=req.result,tx=d.transaction('settings','readwrite');
   tx.objectStore('settings').put({phase:'A0317_SYNTHETIC_NEW_SETTING',v:1},'a0317-independent-setting');
   tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}}}),DB);
 const current=await ledger(page);
 const newest=await rawExport();
 await selectPair(a.rawText,newest.rawText);
 await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('두 원본의 기록·사진·설정이 달라'),null,{timeout:21000});
 assert.deepEqual(await ledger(page),current);
 await screen(page,'04-two-different-snapshots-refused',390);
 // Both old exports match one another but must not match current storage.
 await selectPair(a.rawText,b.rawText);
 await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('현재 저장소가 다릅니다'),null,{timeout:18000});
 assert.deepEqual(await ledger(page),current);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 const last=await ledger(page);
 assert.deepEqual(last,current);
 assert.deepEqual(last.records,poisoned.records);
 assert.deepEqual(last.photos,poisoned.photos);
 assert.deepEqual(marker(last),bad);
 await go(page,'add');
 await page.waitForTimeout(180);
 assert.equal(await page.locator('#save-btn').isDisabled(),true,'corrupt pending still blocks new writes');
 return {status:'PASS',twoDistinctExportsValidated:true,duplicateFileRejected:true,
  tamperedPhotoRejected:true,stalePairRejected:true,differentSnapshotPairRejected:true,
  originalPhotoBytesAndParentHistoryPreserved:true,receiptStillBlocked:true,
  noRepairOrAutomaticUnlock:true};
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0316-synthetic-qa',password},acceptDownloads:true});
 try{out.scenarios[name]=await fn(ctx);console.log('A0317_'+name+'_PASS')}
 catch(e){out.scenarios[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2500)};
  process.exitCode=1;console.error('A0317_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
try{
 assert.equal(gitblob(initialHtml),HTML_BLOB,'Only the exact new A-03-17 QA app may be tested');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0316-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 await run('twoEvidenceManualReview',caseOnlyNewCompare,password);
 assert.deepEqual(out.external,[]);
 assert.deepEqual(out.pageErrors,[]);
 if(Object.values(out.scenarios).some(x=>x.status!=='PASS'))throw Error('A0317_FAILURE');
 out.result='PASS_ISOLATED_DUAL_EVIDENCE_MANUAL_REVIEW_ONLY';
}catch(e){out.result='FAIL';out.error=String(e);process.exitCode=1;console.error('A0317_INVALID '+String(e))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 out.sourceByteExact=gitblob(readFileSync('index.html'))===HTML_BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A0317_RESULT='+JSON.stringify({result:out.result,cases:Object.fromEntries(Object.entries(out.scenarios).map(([k,v])=>[k,v.status])),
  screenshots:out.screenshots.length,network:out.external.length,pageErrors:out.pageErrors.length,appBytesUnchanged:out.sourceByteExact}));
}
