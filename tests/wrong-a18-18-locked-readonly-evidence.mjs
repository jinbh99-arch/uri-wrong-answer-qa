// A18-18 delta only: protected stored synthetic photo + retry + parent history + unknown pending.
// Verify locked add/retry advice navigates to read-only evidence WITHOUT export, overwrite or delete.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',APP='7047f4643f7ebae5677fc9b9e2799659c4cbf578';
const DB='uriaimath-github-qa-v224-only',PENDING='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a18-18';
const IMAGE=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
function hashGitBlob(bytes){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')}
assert.equal(hashGitBlob(readFileSync('index.html')),APP,'QA app unexpected blob');
mkdirSync(DIR,{recursive:true});
const result={status:'RUNNING',widths:{},screenshots:[],external:[],pageErrors:[],realFamily:false,destructiveActions:0,realBackupCompleted:false};
async function seed(page) {
 await page.evaluate(({name,bytes,pending})=>new Promise((resolve,reject)=>{
  const request=indexedDB.open(name);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction(['mistakes','photos','settings'],'readwrite'),id='a1818-science-synthetic';
   tx.objectStore('mistakes').put({
    id,subject:'science',gradeAtEntry:3,problemText:'가상의 자석 문제',studentAnswer:'가상 첫 답',
    childNickname:'QA 아이',hasPhoto:true,createdAt:'2026-11-17T03:00:00Z',updatedAt:'2026-11-17T03:10:00Z',
    memo:'합성 기록',conceptId:'',studyPlan:null,practiceHistory:[],followupHistory:[],prerequisiteChecks:[],
    generalRetryHistory:[{at:'2026-11-17T03:05:00Z',answer:'다시 풀어 본 합성 답',explanation:'실험을 관찰함',review:'not_checked'}],
    checkHistory:[{at:'2026-11-17T03:08:00Z',status:'explained',memo:'부모 합성 관찰 1회',by:'parent_observation'}]
   },id);
   tx.objectStore('photos').put(new Blob([Uint8Array.from(bytes)],{type:'image/png'}),id);
   tx.objectStore('settings').put({nickname:'QA 가상 부모',grade:3,subject:'math'},'profile');
   tx.objectStore('settings').put({synthetic:true,unknownSchema:true},pending);
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),{name:DB,bytes:Array.from(IMAGE),pending:PENDING});
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const request=indexedDB.open(name);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction(['mistakes','photos','settings'],'readonly'),snapshot={};
   const stores=['mistakes','photos','settings'];
   const tasks=stores.map(storeName=>{
    const store=tx.objectStore(storeName);
    return {name:storeName,keys:store.getAllKeys(),values:store.getAll()};
   });
   tx.oncomplete=async()=>{
    try{
     for(const task of tasks){
      snapshot[task.name]={keys:task.keys.result,values:task.name==='photos'
       ?await Promise.all(task.values.result.map(async b=>({type:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})))
       :task.values.result};
     }
     db.close();resolve(snapshot);
    }catch(err){db.close();reject(err)}
   };tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }),DB);
}
async function snap(page,width,which){const file=DIR+'/a18-18-'+width+'-'+which+'.png';await page.screenshot({path:file,fullPage:true,animations:'disabled'});result.screenshots.push(file)}
let browser,preview;
try{
 const auth={username:'wrong-a18-18-qa',password:randomBytes(18).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?780:850},httpCredentials:auth,acceptDownloads:true});
  const page=await ctx.newPage();let downloads=0,writeCalls=0;
  page.on('download',()=>downloads++);
  page.on('pageerror',err=>result.pageErrors.push(String(err)));
  await page.route('**/*',route=>{const url=route.request().url();
    if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
    result.external.push(url);return route.abort()});
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:17000});
  await seed(page);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장 차단:'),null,{timeout:17000});
  const before=await snapshot(page);
  assert.equal(before.mistakes.values.length,1);
  assert.equal(before.mistakes.values[0].generalRetryHistory.length,1);
  assert.equal(before.mistakes.values[0].checkHistory.length,1);
  assert.equal(before.photos.values[0].bytes.length,IMAGE.length);
  assert.ok(before.settings.keys.includes(PENDING));
  await page.evaluate(()=>{
   const prev=IDBDatabase.prototype.transaction;window.__a1818writes=[];window.__a1818Restore=()=>{
    IDBDatabase.prototype.transaction=prev;
   };
   IDBDatabase.prototype.transaction=function(stores,mode,...args){
    if(mode==='readwrite')window.__a1818writes.push(Array.isArray(stores)?stores:[stores]);
    return prev.call(this,stores,mode,...args);
   };
  });
  await page.locator('#nav-add').click();
  const addGuide=page.locator('#a18-18-locked-add');
  assert.ok(await addGuide.isVisible(),'locked add advice missing');
  assert.ok((await addGuide.innerText()).includes('새 오답·재풀이 저장을 보류'));
  assert.ok((await addGuide.innerText()).includes('복원용 백업이 아닙니다'));
  await snap(page,width,'01-locked-add');
  await addGuide.locator('button').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v220-rescue-title','view evidence did not focus rescue title');
  assert.ok(await page.locator('#v220-rescue-panel').isVisible(),'existing read-only evidence panel hidden');
  assert.equal(await page.locator('#v221-rescue-status').innerText(),'미실시 · 현재 저장소를 변경하지 않습니다.');
  assert.equal(downloads,0,'navigation unexpectedly downloaded original');
  await snap(page,width,'02-evidence-only');
  // An already existing synthetic record must remain inspectable in locked storage.
  await page.locator('#nav-records').click();
  const record=page.locator('[data-record="a1818-science-synthetic"]').first();
  assert.ok(await record.isVisible(),'locked saved record inaccessible');
  await record.click();
  await page.locator('#a18-18-locked-retry').waitFor({state:'visible',timeout:14000});
  const retryGuide=page.locator('#a18-18-locked-retry');
  assert.ok((await retryGuide.innerText()).includes('원본 보관은 읽기 전용 시도'));
  await page.locator('#v230-answer').fill('잠금 상태에서는 저장되면 안 되는 합성 답');
  await page.locator('#v230-save').click();
  assert.ok((await page.locator('#v230-status').innerText()).includes('저장하지 않았습니다'),'retry did not fail closed');
  await retryGuide.locator('button').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v220-rescue-title');
  assert.equal(downloads,0,'retry advice triggered file export');
  assert.equal(await page.locator('#v221-rescue-status').innerText(),'미실시 · 현재 저장소를 변경하지 않습니다.');
  await snap(page,width,'03-retry-locked');
  const writes=await page.evaluate(()=>{const writes=window.__a1818writes.slice();window.__a1818Restore();return writes});
  assert.deepEqual(writes,[],'locked UX opened a readwrite transaction');
  assert.deepEqual(await snapshot(page),before,'locked UX changed original IDB bytes or history');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장 차단:'),null,{timeout:17000});
  assert.deepEqual(await snapshot(page),before,'reload altered original synthetic data');
  assert.equal(downloads,0);
  const geometry=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(geometry.scroll<=geometry.inner+2,'mobile body overflow '+JSON.stringify(geometry));
  result.widths[String(width)]={status:'PASS',syntheticRecords:1,photoBytes:IMAGE.length,retriesPreserved:1,parentObservationsPreserved:1,
    pendingPreserved:true,sourceStoreUnchanged:true,destructiveWrites:0,downloads:0,guideLinks:2,
    originalEvidenceNotAutoExported:true,reloadPreserved:true};
  await ctx.close();
 }
 assert.deepEqual(result.external,[]);assert.deepEqual(result.pageErrors,[]);
 result.status='PASS_LOCKED_READ_ONLY_GUIDANCE_FULL_IDB_UNCHANGED';
}catch(err){result.status='FAIL';result.error=String(err);result.stack=String(err?.stack||'').slice(0,2500);console.error('A1818_FAIL '+String(err));process.exitCode=1}
finally{
 await browser?.close();await preview?.close();
 result.appSourceUnchanged=hashGitBlob(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(result,null,2));
 console.log('A1818_RESULT='+JSON.stringify({status:result.status,widths:result.widths,screenshots:result.screenshots.length,
  externalRequests:result.external.length,pageErrors:result.pageErrors.length,appSourceUnchanged:result.appSourceUnchanged,error:result.error}));
}
