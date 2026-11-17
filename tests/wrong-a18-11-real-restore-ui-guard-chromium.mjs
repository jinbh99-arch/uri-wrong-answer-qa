import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
// New A18-11 restore entrypoint only. No previous PASS regression suite replay.
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const BLOB='7a30edb28ff1a84167e36d667e57bf5c5b93d180';
const DB='uriaimath-github-qa-v224-only',KEY='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a18-11';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const original=readFileSync('index.html');mkdirSync(DIR,{recursive:true});
const out={result:'RUNNING',sourceBlob:gitblob(original),devSha:DEV,syntheticOnly:true,realFamily:false,
 safeToRestore:false,external:[],pageErrors:[],screenshots:[],widths:{},existingPassRepeated:false};
let browser,preview;
async function ledger(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(dbName);
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const d=r.result,t=d.transaction(['mistakes','photos','settings'],'readonly');
   const m=t.objectStore('mistakes'),p=t.objectStore('photos'),s=t.objectStore('settings');
   const mr=m.getAll(),mk=m.getAllKeys(),pr=p.getAll(),pk=p.getAllKeys(),sr=s.getAll(),sk=s.getAllKeys();
   t.onerror=()=>{d.close();reject(t.error)};
   t.oncomplete=async()=>{try{
    const photos=await Promise.all(pr.result.map(async(b,i)=>({id:pk.result[i],type:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    d.close();resolve({records:mk.result.map((key,i)=>({key,value:mr.result[i]})),photos,settings:sk.result.map((key,i)=>({key,value:sr.result[i]}))});
   }catch(e){d.close();reject(e)}};
  };
 }),DB);
}
async function seed(page){
 await page.evaluate(({name,key,bytes})=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(name);
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const d=r.result,t=d.transaction(['mistakes','photos','settings'],'readwrite');
   const id='a18-11-qa-synthetic-01';
   t.objectStore('mistakes').put({
    id,gradeAtEntry:3,subject:'science',problemText:'A18-11 가상 과학 오답',reason:'unknown',memo:'가상 학부모 메모',studentAnswer:'연습',
    hasPhoto:true,createdAt:'2026-11-17T00:00:00Z',updatedAt:'2026-11-17T00:00:00Z',
    checkHistory:[{at:'2026-11-17T00:00:00Z',status:'explained',memo:'가상 부모 관찰',by:'parent_observation'}]
   },id);
   t.objectStore('photos').put(new Blob([Uint8Array.from(bytes)],{type:'image/png'}),id);
   t.objectStore('settings').put({id:'a18-11-unknown-pending',at:1731774000000,v:1},key);
   t.onerror=()=>{d.close();reject(t.error)};t.oncomplete=()=>{d.close();resolve()};
  };
 }),{name:DB,key:KEY,bytes:Array.from(PNG)});
}
async function check(page,width,baseline){
 await page.setViewportSize({width,height:width===320?760:844});
 await page.locator('#nav-settings').click();
 await page.waitForFunction(()=>!document.querySelector('#page-settings')?.classList.contains('hide'),null,{timeout:12000});
 const notice=page.locator('#a18-10-restore-block');
 assert.ok(await notice.isVisible());
 assert.match(await notice.innerText(),/복원|A→B→A/);
 assert.equal(await page.locator('#import-json').isDisabled(),true);
 assert.equal(await page.locator('#import-file').isDisabled(),true);
 assert.equal(await page.locator('#export-json').isEnabled(),true);
 const result=await page.evaluate(()=>{
  const button=document.getElementById('import-json'),input=document.getElementById('import-file');
  let clicked=0; input.addEventListener('click',()=>clicked++);
  button.click();
  const dt=new DataTransfer(),sample='{"format":"uriaimath-offline-backup-v02","records":[],"photos":{},"profile":{"nickname":"QA","grade":3,"subject":"math"}}';
  dt.items.add(new File([sample],'a1811-fake-backup.json',{type:'application/json'}));
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));
  const afterEvent=input.files.length;
  if(typeof input.onchange!=='function')throw Error('Final restore guard missing');
  input.onchange({target:input,preventDefault(){},stopImmediatePropagation(){}});
  return {clicked,afterEvent,afterHandler:input.files.length,
   warning:document.getElementById('a18-10-restore-block').textContent,
   finalGuard:!!document.getElementById('wrong-a18-11-final-restore-guard')};
 });
 assert.equal(result.clicked,0);assert.equal(result.afterEvent,0);assert.equal(result.afterHandler,0);
 assert.equal(result.finalGuard,true);assert.match(result.warning,/⛔ 복원 차단 유지/);
 assert.deepEqual(await ledger(page),baseline,'restore handler touched old mistakes, photo or parent history');
 const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.width+2,'mobile overflow '+JSON.stringify(dims));
 const path=DIR+'/a18-11-restore-guard-'+width+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});out.screenshots.push(path);
 out.widths[String(width)]={status:'PASS',inputDisabled:true,buttonDisabled:true,forcedFileRejected:true,originalLedgerPreserved:true};
}
try{
 assert.equal(gitblob(original),BLOB,'unexpected QA app blob');
 const password=randomBytes(22).toString('hex'),user='a18-11-synthetic';
 preview=await startWrongQa66Preview({devSha:DEV,username:user,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({httpCredentials:{username:user,password},acceptDownloads:true});
 const page=await ctx.newPage();
 page.on('pageerror',e=>out.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))out.external.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:16000});
 await seed(page);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결')||document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:16000});
 const before=await ledger(page);
 assert.equal(before.records.length,1);assert.equal(before.photos.length,1);
 assert.equal(before.records[0].value.checkHistory.length,1);
 assert.equal(before.settings.find(x=>x.key===KEY)?.value.id,'a18-11-unknown-pending');
 await check(page,320,before);await check(page,390,before);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForTimeout(300);assert.deepEqual(await ledger(page),before);
 assert.deepEqual(out.external,[]);assert.deepEqual(out.pageErrors,[]);
 out.result='PASS_ISOLATED_RESTORE_ENTRY_FAIL_CLOSED_ONLY';
 await ctx.close();
}catch(e){out.result='FAIL';out.error=String(e);out.stack=String(e?.stack||'').slice(0,2000);process.exitCode=1;console.error('A1811_FAIL '+String(e))}
finally{
 await browser?.close();await preview?.close();
 out.sourceUnchanged=gitblob(readFileSync('index.html'))===BLOB;
 writeFileSync(DIR+'/result.json',JSON.stringify(out,null,2));
 console.log('A1811_RESULT='+JSON.stringify({result:out.result,widths:out.widths,screenshots:out.screenshots.length,external:out.external.length,pageErrors:out.pageErrors.length,appBytesUnchanged:out.sourceUnchanged,error:out.error}));
}
