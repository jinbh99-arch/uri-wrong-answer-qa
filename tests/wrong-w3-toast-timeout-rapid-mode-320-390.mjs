// W3 NEW temporal boundary: clearing a parent-only toast on child transition
// must also cancel its 3.4-second timeout; rapid mode changes must not re-expose it.
// SYNTHETIC loopback only. No production DB, real photos, external requests, or restores.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const APP_BLOB='6ff6cf1c2cfeef3706381a68fc105feab8258b04';
const sha=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
assert.equal(sha(readFileSync('index.html')),APP_BLOB);
const DIR='qa-proof/w3-toast-timeout';
mkdirSync(DIR,{recursive:true});
const report={status:'IN_PROGRESS',devSha:DEV,appBlob:APP_BLOB,checks:0,widths:{},
  pageErrors:[],externalRequests:[],screenshots:[],syntheticOnly:true,
  realFamilyAuth:false,realDevice:false,productionMutation:false,safeToRestore:false};
let preview,browser;
function check(label,w){report.checks++;console.log('W3_TIMEOUT_PASS '+w+' '+label)}
async function shot(page,w,name){
 const path=DIR+'/'+w+'-'+name+'.png';
 await page.screenshot({path,animations:'disabled',fullPage:false});report.screenshots.push(path);
}
async function ledger(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
    a=tx.objectStore('mistakes').count(),b=tx.objectStore('photos').count();
   tx.oncomplete=()=>{db.close();resolve({mistakes:a.result,photos:b.result})};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 }));
}
async function parentToast(page){
 await page.locator('#v218-parent-mode').click();
 // Inject only an ephemeral parent notification into the real notify() path.
 // The photo-remove button is intentionally hidden without a photo; trying to
 // click it was a TEST SETUP error in CI 44636194747, not a product failure.
 await page.evaluate(()=>notify('W3 합성 부모 임시 알림 — 저장 없음'));
 assert.match(await page.locator('#toast').textContent(),/W3 합성 부모 임시 알림/);
 assert.equal(await page.locator('#toast').isVisible(),true);
}
async function childClean(page,label){
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#toast').textContent(),'');
 assert.equal(await page.locator('#toast').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('v218-child')),true);
}
try{
 const auth={username:'w3-time-fake',password:randomBytes(24).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 assert.equal(preview.host,'127.0.0.1');
 browser=await chromium.launch({headless:true});
 for(const w of [320,390]){
  const context=await browser.newContext({viewport:{width:w,height:w===320?800:850},
    httpCredentials:auth,acceptDownloads:false});
  const page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.route('**/*',r=>{
   const u=r.request().url();
   if(u.startsWith(preview.url)||u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
   report.externalRequests.push(u);return r.abort();
  });
  const resp=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(resp?.status(),200);
  const initial=await ledger(page);assert.deepEqual(initial,{mistakes:0,photos:0});
  await parentToast(page);check('parent-toast-visible',w);
  await shot(page,w,'parent-warning');
  await childClean(page,'first');check('switch-removes-toast-text-and-visibility',w);
  await shot(page,w,'child-cleared');
  // The original toast timeout was 3400ms; this is NEW temporal coverage.
  await page.waitForTimeout(3650);
  assert.equal(await page.locator('#toast').textContent(),'');
  assert.equal(await page.locator('#toast').isVisible(),false);
  check('after-original-timeout-no-parent-warning',w);
  // NEW rapid parent<->child switch with a fresh toast.
  await parentToast(page);
  await childClean(page,'second');
  await page.waitForTimeout(100);
  await page.locator('#v218-parent-mode').click();
  await parentToast(page);
  await childClean(page,'third');
  assert.equal(await page.locator('#toast').textContent(),'');
  assert.equal(await page.locator('#toast').isVisible(),false);
  check('rapid-repeat-does-not-restore-warning',w);
  assert.deepEqual(await ledger(page),initial);
  await shot(page,w,'rapid-child-clean');
  check('synthetic-ledger-unchanged',w);
  report.widths[w]={status:'PASS',parentAlerts:3,childTransitions:3,
    originalTimeoutMs:3400,observedAfterMs:3650,originalLedger:initial};
  await context.close();
 }
 assert.equal(report.checks,10);
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.externalRequests,[]);
 report.status='PASS_W3_TEMPORAL_BOUNDARY';
}catch(e){
 report.status='FAIL';report.error=String(e);
 report.stack=String(e?.stack||'').slice(0,1300);
 process.exitCode=1;console.error('W3_TIMEOUT_FAIL '+String(e));
}finally{
 await browser?.close();await preview?.close();
 writeFileSync(DIR+'/result.json',JSON.stringify(report,null,2));
 console.log('W3_TIMEOUT_RESULT '+JSON.stringify({status:report.status,
  checks:report.checks,shots:report.screenshots.length,error:report.error}));
}
