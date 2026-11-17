// A-03-18-6: ONLY previously unverified backup/restore + malformed receipt
// boundaries of final A-03-12 QA blob. Synthetic only, no product/dev edits.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',
 HTML_BLOB='ef15e271ca7f9495e604255a8152bc6c9c9220a1',
 DB='uriaimath-github-qa-v224-only',MARKER='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a03-18-7';
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
    throw Error('A187_SYNTHETIC_COMMITTED_ACK_LOST_ONCE');
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
 out.exportEarlyDiagnostic={pre,post};console.log('A187_EXPORT_EARLY='+JSON.stringify({pre,post}));
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
 const initial=await create(page,'A18-6 합성 오답: 기억과 변화','A18-6 가상 학부모 관찰');
 assert.equal(initial.records.length,1);assert.equal(initial.photos.length,1);
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A18-6 가상 보호자 확인 기록 보존');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A18-6 가상'),null,{timeout:14000});
 const pending={id:'a186-missing-pending-receipt',at:1731774000000,v:1};
 const testKey='a18-6-untracked-setting';
 const A={message:'A',testOnly:true};
 const B={message:'B',testOnly:true};
 await page.evaluate(({name,marker,key,pending,A})=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(name);open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const d=open.result,tx=d.transaction('settings','readwrite');
   tx.objectStore('settings').put(pending,marker);tx.objectStore('settings').put(A,key);
   tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}}
 }),{name:DB,marker:MARKER,key:testKey,pending,A});
 const sealed=await ledger(page);
 assert.deepEqual(marker(sealed),pending);
 assert.equal(sealed.records[0].checkHistory.length,1);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:17000});
 async function rawExport(){
  const promise=page.waitForEvent('download',{timeout:17000});
  await page.locator('#v221-rescue-current').click();
  const dl=await promise;
  const content=readFileSync(await dl.path(),'utf8');
  const parsed=JSON.parse(content);
  assert.equal(parsed.integrity.algorithm,'SHA-256');
  assert.deepEqual(parsed.stores.settings.values[parsed.stores.settings.keys.indexOf(MARKER)],pending);
  assert.equal(parsed.summary.records,1);assert.equal(parsed.summary.photos,1);
  return {content,parsed};
 }
 const first=await rawExport();
 await page.waitForTimeout(1300);
 const second=await rawExport();
 assert.notEqual(first.parsed.integrity.digest,second.parsed.integrity.digest);
 await page.locator('#wrong-a0317-file-a').setInputFiles({
  name:'synthetic-aba-original-a.json',mimeType:'application/json',buffer:Buffer.from(first.content)
 });
 await page.locator('#wrong-a0317-file-b').setInputFiles({
  name:'synthetic-aba-original-b.json',mimeType:'application/json',buffer:Buffer.from(second.content)
 });
 let snapshots=[];
 for(const width of [320,390]){
  await page.setViewportSize({width,height:width===320?760:844});
  const installed=await page.evaluate(({name,key,A,B})=>{
   // The app is deliberately sealed inside an IIFE. Instrument the real
   // FileReader path used by v221ReadCurrentEvidence, not an invented global.
   const originalRead=FileReader.prototype.readAsDataURL;
   let reads=0;
   window.__a186Log=[];
   const write=next=>new Promise((resolve,reject)=>{
    const open=indexedDB.open(name);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const d=open.result,tx=d.transaction('settings','readwrite');
     tx.objectStore('settings').put(next,key);
     tx.oncomplete=()=>{d.close();window.__a186Log.push(next.message);resolve()};
     tx.onerror=()=>{d.close();reject(tx.error)};};
   });
   FileReader.prototype.readAsDataURL=function(blob){
    reads++;
    const turn=reads,realOnload=this.onload;
    this.onload=async function(event){
     if(turn===1){
      window.__a186Log.push('snapshot1-photo-read');
      await write(B);await write(A);
     }else if(turn===2)window.__a186Log.push('snapshot2-photo-read');
     return realOnload.call(this,event);
    };
    return originalRead.call(this,blob);
   };
   return typeof FileReader.prototype.readAsDataURL==='function';
  },{name:DB,key:testKey,A,B});
  assert.equal(installed,true);
  await page.locator('#wrong-a0317-verify').click();
  await page.waitForFunction(()=>document.querySelector('#wrong-a0317-result')?.textContent?.includes('두 원본 SHA-256 개별 일치'),null,{timeout:22000});
  const msg=await page.locator('#wrong-a0317-result').innerText();
  assert.match(msg,/손상 장부 ID 누락/);
  assert.match(msg,/⚠️ 읽기 전용 두 시점의 내용만 일치했습니다/);
  assert.match(msg,/복구 안전 판정은 보류하며 잠금을 해제하지 않습니다/);
  const detail=await page.evaluate(()=>({sequence:window.__a186Log,comparison:document.querySelector('#wrong-a0317-result').innerText}));
  assert.deepEqual(detail.sequence,['snapshot1-photo-read','B','A','snapshot2-photo-read']);
  assert.deepEqual(await ledger(page),sealed,'real photo bytes, parent history, receipt and settings untouched after ABA');
  await screen(page,'A18-6-REAL-UI-ABA-FALSE-EQUALITY',width);
  snapshots.push({width,sequence:detail.sequence,displayedContentMatchWithExplicitWarning:true,
   ledgerUnchanged:true,receiptStillCorrupt:true});
 }
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:14000});
 assert.deepEqual(await ledger(page),sealed);
 await go(page,'add');
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 out.newEvidence=snapshots;
 return {status:'PASS',classification:'ABA_UNDETECTED_BY_A17_CONTENT_ONLY_CHECK',
  uiABAChangeNotDetectedButWarningShown:true,oldPhotoBytesAndParentHistoryPreserved:true,
  noUnlockOrDuplicateCreate:true,syntheticWriteInjected:true,notRealRecovery:true};
}
async function run(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0316-synthetic-qa',password},acceptDownloads:true});
 try{out.scenarios[name]=await fn(ctx);console.log('A187_'+name+'_PASS')}
 catch(e){out.scenarios[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2500)};
  process.exitCode=1;console.error('A187_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
try{
 assert.equal(gitblob(initialHtml),HTML_BLOB,'Only the exact new A-03-17 QA app may be tested');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0316-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 await run('uiABAInjected',caseOnlyNewCompare,password);
 assert.deepEqual(out.external,[]);
 assert.deepEqual(out.pageErrors,[]);
 if(Object.values(out.scenarios).some(x=>x.status!=='PASS'))throw Error('A187_FAILURE');
 out.result='PASS_ISOLATED_ABA_DISCLOSURE_WARNING_ONLY';
}catch(e){out.result='FAIL';out.error=String(e);process.exitCode=1;console.error('A187_INVALID '+String(e))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 out.sourceByteExact=gitblob(readFileSync('index.html'))===HTML_BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A187_RESULT='+JSON.stringify({result:out.result,cases:Object.fromEntries(Object.entries(out.scenarios).map(([k,v])=>[k,v.status])),
  screenshots:out.screenshots.length,network:out.external.length,pageErrors:out.pageErrors.length,appBytesUnchanged:out.sourceByteExact}));
}
