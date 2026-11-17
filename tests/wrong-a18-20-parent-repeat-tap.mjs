// A18-20 focused NEW boundary: very rapid repeated parent-save activation.
// Synthetic local IndexedDB only; this is NOT actual parent timing evidence.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const APP='f3f0d3c2dffce09ed7af613238aa7f8a92708c35';
const DB='uriaimath-github-qa-v224-only', DIR='qa-proof/wrong-a18-20';
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
assert.equal(gitBlob(readFileSync('index.html')),APP,'QA source changed without review');
mkdirSync(DIR,{recursive:true});
const output={status:'RUNNING',widths:{},screenshots:[],externalRequests:[],pageErrors:[],
  scenario:'rapid dual parent save on the same visible button',syntheticOnly:true,
  actualParentThreeMinuteTiming:false,realFamilyData:false,destructiveOperations:false};
let preview,browser;
async function ledger(page) {
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const m=tx.objectStore('mistakes'),p=tx.objectStore('photos');
   const records=m.getAll(),recordKeys=m.getAllKeys(),photoKeys=p.getAllKeys(),photos=p.getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const raw=await Promise.all(photos.result.map(async b=>({
      mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    db.close();resolve({records:records.result,recordKeys:recordKeys.result,
      photoKeys:photoKeys.result,photos:raw});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function snap(page,width,label) {
 const path=DIR+'/'+width+'-'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 output.screenshots.push(path);
}
try{
 const auth={username:'wrong-a18-20',password:randomBytes(18).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({
    viewport:{width,height:width===320?800:850},httpCredentials:auth,acceptDownloads:false});
  const page=await context.newPage();
  page.on('pageerror',e=>output.pageErrors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))
    return route.continue();
   output.externalRequests.push(url);return route.abort();
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:18000});
  await page.locator('#nav-add').click();
  const png=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=180;canvas.height=110;
   const c=canvas.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,180,110);
   c.fillStyle='#222';c.font='16px sans-serif';c.fillText('QA double tap',8,50);
   return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#choose-photo').setInputFiles({
   name:'synthetic-repeat-tap.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('#photo-wrap').waitFor({state:'visible'});
  const problem='부모 저장 버튼을 연속으로 누르면 어떻게 될까요? (합성 QA)';
  await page.locator('#problem').fill(problem);
  await page.locator('#student-answer').fill('한 번만 저장되어야 합니다.');
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#wrong007-grade').selectOption('3');
  await page.locator('#save-btn').click();
  await page.locator('#page-detail').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#v09-save-confirm:not(.hide)')?.textContent?.includes('브라우저 저장소'));
  const before=await ledger(page);
  assert.equal(before.records.length,1);assert.equal(before.photos.length,1);
  const memo='연속 두 번 누르기 안전성 확인 (합성 학부모 메모)';
  await page.locator('#check-status').selectOption('explained');
  await page.locator('#check-memo').fill(memo);
  await snap(page,width,'01-before-repeat');
  // Two activation events in one browser task deliberately stress the asynchronous
  // handler. This is faster than typical tapping, NOT a human-usage speed claim.
  await page.locator('#check-save').evaluate(button=>{button.click();button.click()});
  await page.waitForFunction(expected=>
   document.querySelector('#check-history')?.innerText?.includes(expected),memo,{timeout:16000});
  await page.waitForTimeout(450); // allow any concurrent save completion/feedback to settle
  const after=await ledger(page);
  const count=after.records[0]?.checkHistory?.length||0;
  const body=(await page.locator('#check-history').innerText());
  const toast=(await page.locator('#toast').innerText()).trim();
  const originalPreserved=JSON.stringify(before.photos)===JSON.stringify(after.photos);
  await snap(page,width,'02-after-repeat');
  output.widths[width]={result:'OBSERVED',parentHistoryCount:count,
    exactMemoVisible:body.includes(memo),toast,photoBytes:before.photos[0].bytes.length,
    photoPreserved:originalPreserved,recordCount:after.records.length,
    uiSuccess:toast.includes('학부모 관찰 결과를 저장했습니다.'),
    uiFailure:toast.includes('저장에 실패했습니다.')};
  assert.equal(after.records.length,1,'double activation created extra wrong-answer record');
  assert.equal(count,1,'double parent activation duplicated parent observation');
  assert.ok(originalPreserved,'double activation changed original photo bytes');
  assert.equal(after.records[0].problemText,problem,'double activation mutated original problem');
  assert.ok(body.includes(memo),'saved parent memo not visible');
  assert.ok(toast.includes('학부모 관찰 결과를 저장했습니다.'),
    'final visible feedback contradicts successful stored parent observation');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.startsWith('저장소 연결'),null,{timeout:18000});
  await page.locator('#nav-records').click();
  await page.locator('#records-list [data-record]').first().click();
  await page.waitForFunction(expected=>document.querySelector('#check-history')?.innerText?.includes(expected),memo);
  const persisted=await ledger(page);
  assert.equal(persisted.records[0].checkHistory.length,1,'rapid tap saved duplicate after reload');
  assert.deepEqual(persisted.photos,before.photos,'photo bytes changed after reload');
  output.widths[width].status='PASS';
  await context.close();
 }
 assert.deepEqual(output.pageErrors,[]);assert.deepEqual(output.externalRequests,[]);
 output.status='PASS_A1820_REPEAT_PARENT_SAVE_SINGLE_OBSERVATION';
}catch(err){
 output.status='FAIL_A1820_REPEAT_PARENT_SAVE';
 output.error=String(err);output.stack=String(err?.stack||'').slice(0,2000);
 process.exitCode=1;console.error('A1820_FAIL '+String(err));
}finally{
 await browser?.close();await preview?.close();
 output.sourceUnchanged=gitBlob(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(output,null,2));
 console.log('A1820_RESULT='+JSON.stringify({status:output.status,widths:output.widths,
  png:output.screenshots.length,external:output.externalRequests.length,
  pageErrors:output.pageErrors.length,sourceUnchanged:output.sourceUnchanged,error:output.error}));
}