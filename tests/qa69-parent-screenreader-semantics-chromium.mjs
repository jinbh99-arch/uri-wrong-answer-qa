// QA69: independent 360px Chromium accessibility-tree semantics for parent observation.
// Uses existing QA66 loopback server without repeating QA66/QA67/QA68 assertions.
// Synthetic records only. No external hosting, credentials, storage, or child data.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA69_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const username='qa69-local',password=randomBytes(24).toString('hex');
let preview,browser,checks=0;
const pass=(s)=>{checks++;console.log('PASS WRONG QA69 '+s)};
const controls=[
 ['#v230-answer','textbox','아이의 재풀이 답'],
 ['#v230-explanation','textbox','아이가 설명한 이유'],
 ['#check-status','combobox','부모 관찰 상태'],
 ['#check-memo','textbox','부모 관찰 메모']
];
async function axName(locator,role){
 const snap=(await locator.ariaSnapshot()).split('\n')[0];
 // First line from Playwright's actual Chromium accessibility tree.
 const hit=snap.match(/^\s*-\s*([a-z][\w-]*)\s+"([^"]+)"/i);
 return {role:hit?.[1]||'',name:hit?.[2]?.trim()||'',sample:snap.slice(0,130)};
}
try{
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:360,height:790},httpCredentials:{username,password},
  acceptDownloads:false});
 const page=await ctx.newPage(),external=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(preview.url))return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA69 가상 과학 문제: 광원과 그림자');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').filter({hasText:'QA69 가상 과학 문제'}).click();
 await page.locator('#detail-text').waitFor();
 let inspected=[];
 for(const [selector,role,purpose] of controls){
  const l=page.locator(selector);
  assert.equal(await l.count(),1,'missing '+selector);
  const a=await axName(l,role);
  inspected.push({selector,purpose,role:a.role,hasName:!!a.name});
  assert.equal(a.role,role,'expected role '+role+' for '+selector+': '+a.sample);
  assert.ok(a.name.length>=2,'missing accessible name for '+purpose+' '+selector);
 }
 pass('four initial parent controls expose correct Chromium accessible roles and names');
 await page.locator('#v230-answer').fill('가상 아이 답: 오른쪽');
 await page.locator('#v230-explanation').fill('가상 아이 설명: 광원 반대편에 그림자');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:15000});
 // The manual next-check editor is mounted after the first saved retry.
 for(const [selector,role,purpose] of [
  ['#wrong008-next-question','textbox','다음 확인 질문'],
  ['#wrong008-save-note','button','다음 확인 저장']
 ]){
  const l=page.locator(selector);
  assert.equal(await l.count(),1,'missing after saved retry '+selector);
  const a=await axName(l,role);
  inspected.push({selector,purpose,role:a.role,hasName:!!a.name});
  assert.equal(a.role,role,'expected role '+role+' for '+selector+': '+a.sample);
  assert.ok(a.name.length>=2,'missing accessible name for '+purpose+' '+selector);
 }
 pass('two deferred manual next-check controls mounted with accessible names after saved retry');
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill('가상 부모 관찰: 그림으로 다시 설명함');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('가상 부모 관찰'),null,{timeout:15000});
 const history=await page.locator('#check-history').ariaSnapshot();
 assert.ok(history.includes('가상 부모 관찰'),'saved parent note absent from accessible DOM');
 pass('saved fictional parent observation remains present in accessibility-tree snapshot');
 const selected=page.locator('#check-status');
 const selectedA=await selected.ariaSnapshot();
 assert.ok(selectedA.includes('도움')||selectedA.includes('needs_help'),
  'selected parent state is not exposed to assistive technology');
 pass('selected parent observation state is readable from Chromium accessibility tree');
 await page.locator('#v218-child-mode').click();
 const hidden=['#check-status','#check-memo','#wrong008-next-question','#wrong008-save-note'];
 const visibleInChild=[];
 for(const selector of hidden)if(await page.locator(selector).isVisible())visibleInChild.push(selector);
 assert.deepEqual(visibleInChild,[],'parent-only controls visible in child mode');
 pass('parent-specific observation and next-check controls absent from child visible screen');
 await page.locator('#v218-parent-mode').click();
 assert.equal(await page.locator('#check-memo').isVisible(),true);
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 pass('parent controls restored, no external request or browser JavaScript exception');
 console.log('WRONG_QA69_RESULT='+JSON.stringify({status:'PASS',checks,sourceDevSha:SHA,
  kind:'real Chromium accessibility-tree semantic and parent/child separation',
  inspectedControls:inspected,syntheticOnly:true,realScreenReaderHardware:false,
  externalAccessVerified:false,productionStorageIsolationVerified:false,
  safeToRestore:false,deployed:false}));
 await ctx.close();
}catch(e){
 console.error('WRONG_QA69_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),
  stack:String(e?.stack).slice(0,850),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
