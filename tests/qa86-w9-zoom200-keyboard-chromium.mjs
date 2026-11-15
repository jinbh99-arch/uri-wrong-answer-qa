// W9 / QA86 NEW: 320px Chromium with 200% CSS visual zoom simulation
// and real keyboard Enter/Space/Tab control of registration and recheck.
// QA68 tested only 360px native parent filter, not this user path.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA86_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const problem='QA86 synthetic keyboard wrong answer at 200 percent zoom';
const question='QA86 synthetic parent recheck question from keyboard';
const proof='qa-proof/qa86';mkdirSync(proof,{recursive:true});
let preview,browser,checks=0,shots=0;
const pass=s=>{checks++;console.log('PASS QA86 '+s)};
async function shot(page,label){
 const path=proof+'/'+String(++shots).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA86_SCREENSHOT='+path);
}
async function zoomData(page){
 return page.evaluate(()=>({
  zoom:Number(getComputedStyle(document.documentElement).zoom),
  outerWidth:document.documentElement.scrollWidth,
  clientWidth:document.documentElement.clientWidth,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  focused:document.activeElement?.id||''
 }));
}
try{
 const username='qa86-local-keyboard',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('blob:')&&!u.startsWith('data:'))outbound.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.evaluate(()=>{document.documentElement.style.zoom='200%'});
 const initial=await zoomData(page);
 console.log('QA86_ZOOM_INITIAL='+JSON.stringify(initial));
 assert.equal(initial.zoom,2);
 pass('live Chromium document zoom 200% and physical viewport 320px');

 await page.locator('#nav-add').focus();
 assert.equal(await page.locator('#nav-add').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Tab');
 assert.notEqual((await zoomData(page)).focused,'nav-add','Tab must leave focused control');
 await page.locator('#nav-add').focus();
 await page.keyboard.press('Enter');
 await page.locator('#page-add:not(.hide)').waitFor({timeout:12000});
 pass('Tab and Enter traverse/open registration without pointer');

 await page.locator('#wrong007-subject').selectOption('science'); // test fixture
 await page.locator('#problem').focus();
 await page.keyboard.insertText(problem);
 assert.equal(await page.locator('#problem').inputValue(),problem);
 await page.locator('#save-btn').focus();
 assert.equal(await page.locator('#save-btn').evaluate(el=>document.activeElement===el),true);
 await page.keyboard.press('Enter');
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#detail-image').waitFor({state:'attached'});
 await shot(page,'keyboard-registration-at-zoom200');
 pass('200% zoom keyboard enters and saves synthetic wrong answer');

 const future=new Date(Date.now()+11*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').focus();
 assert.equal(await page.locator('#wrong008-next-date').evaluate(el=>el===document.activeElement),true);
 await page.locator('#wrong008-next-date').fill(future); // deterministic date fixture
 await page.locator('#wrong008-next-question').focus();
 await page.keyboard.insertText(question);
 assert.equal(await page.locator('#wrong008-next-question').inputValue(),question);
 await page.locator('#wrong008-save-note').focus();
 await page.keyboard.press('Space');
 await page.waitForFunction(date=>
  (document.querySelector('#wrong008-last-manual-note')?.textContent||'').includes(date),future,{timeout:15000});
 assert.match(await page.locator('#wrong008-last-manual-note').textContent(),/상태: 아직 확인 전으로 기록됨/);
 await shot(page,'keyboard-future-question-zoom200');
 pass('keyboard Space saves next manual recheck without falsely marking observed');

 await page.locator('#nav-records').focus();
 await page.keyboard.press('Enter');
 const rec=page.locator('#records-list button[data-record]').first();
 await rec.waitFor({timeout:15000});
 await rec.focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>(
  document.querySelector('#wrong008-last-manual-note')?.textContent||''
 ).includes('상태: 아직 확인 전으로 기록됨'),null,{timeout:15000});
 assert.match(await page.locator('#wrong008-last-manual-note').textContent(),/아직 확인 전/);
 pass('keyboard reentry keeps future question distinguishable');

 await page.locator('#v218-child-mode').focus();
 await page.keyboard.press('Space');
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 const child=await page.evaluate(q=>({
  futureText:document.body.textContent.includes(q),
  futureField:(document.querySelector('#wrong008-next-question')?.value||'').includes(q)
 }),question);
 assert.deepEqual(child,{futureText:false,futureField:false});
 await page.locator('#v218-parent-mode').focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 await shot(page,'keyboard-child-parent-mode-zoom200');
 pass('keyboard toggles modes without parent recheck prompt in child DOM');

 const zoom=await zoomData(page);
 console.log('QA86_ZOOM_FINAL='+JSON.stringify(zoom));
 assert.ok(zoom.overflow<=3,'200% zoom horizontal overflow '+zoom.overflow);
 assert.deepEqual(errors,[]);
 assert.deepEqual(outbound,[]);
 pass('200% visual-zoom reflow has no horizontal overflow or JS/network errors');
 console.log('QA86_RESULT='+JSON.stringify({status:'PASS',checks,shots,width:320,
  cssZoomPercent:200,realChromium:true,keyNavigation:true,
  keyboardRegistration:true,keyboardFutureRecheck:true,
  actualBrowserMenuZoomVerified:false,physicalDeviceVerified:false,
  safeToRestore:false,syntheticOnly:true,familyAuthVerified:false}));
 writeFileSync(proof+'/qa86-result.json',JSON.stringify({sourceDevSha:SHA,status:'PASS',
  checks,shots,cssZoomPercent:200,actualBrowserMenuZoomVerified:false,
  safeToRestore:false},null,2));
 await ctx.close();
}catch(e){
 console.error('QA86_RESULT='+JSON.stringify({status:'FAIL',checks,shots,error:String(e),
  stack:String(e?.stack).slice(0,1400),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
