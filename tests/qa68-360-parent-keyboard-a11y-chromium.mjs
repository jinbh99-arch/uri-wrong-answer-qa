// QA68: 360px keyboard and accessible parent filter boundary.
// Synthetic in-memory only, uses QA66's existing loopback gate, no QA66/67 rerun.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA68_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
let preview,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA68 '+s)};
try{
 preview=await startWrongQa66Preview({devSha:SHA,username:'qa68-local',password:randomBytes(32).toString('hex')});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:360,height:740},
  httpCredentials:{username:'qa68-local',password:preview.password}});
 const page=await context.newPage(),external=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#wrong-dev-p17-filter').waitFor();
 const selector=page.locator('#wrong-dev-p17-filter');
 assert.equal(await selector.isVisible(),true);
 const accessible=await selector.evaluate(el=>{
  const label=document.querySelector('label[for="'+el.id+'"]');
  return {label:label?.textContent?.trim(),options:[...el.options].map(o=>({value:o.value,text:o.textContent.trim()})),
   parent:el.closest('.v218-parent-only')!==null};
 });
 assert.match(accessible.label||'',/학부모 확인 상태/);
 assert.deepEqual(accessible.options.map(o=>o.value),['all','pending','manual']);
 assert.equal(accessible.parent,true);
 pass('360px parent-only selector has explicit accessible label and 3 meaningful options');
 await selector.focus();
 assert.equal(await selector.evaluate(el=>document.activeElement===el),true);
 await page.keyboard.press('End');
 assert.equal(await selector.inputValue(),'manual');
 await page.keyboard.press('Home');
 assert.equal(await selector.inputValue(),'all');
 pass('360px native keyboard End/Home operates parent status filter without pointer');
 await page.locator('#v218-child-mode').click();
 assert.equal(await selector.isVisible(),false);
 assert.equal(await selector.evaluate(el=>el.getClientRects().length),0);
 await page.locator('#v218-parent-mode').click();
 assert.equal(await selector.isVisible(),true);
 pass('child mode removes parent filter from keyboard-visible layout and parent restores it');
 const before=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
  storage:Object.keys(localStorage).sort(),title:document.title}));
 assert.ok(before.scrollWidth<=363,'360px overflow '+before.scrollWidth);
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 pass('360px no horizontal overflow, external requests or script errors');
 console.log('WRONG_QA68_RESULT='+JSON.stringify({status:'PASS',checks,sourceDevSha:SHA,
  externalAccess:false,realFamilyData:false,operationalStorageVerified:false,
  safeToRestore:false,deployed:false}));
 await context.close();
}catch(e){console.error('WRONG_QA68_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(e),stack:String(e?.stack).slice(0,900),safeToRestore:false}));process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
