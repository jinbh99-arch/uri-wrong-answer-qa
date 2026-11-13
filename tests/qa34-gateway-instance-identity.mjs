import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA GATEWAY INSTANCE',s)};
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 const familyKey='qa-instance-reuse',password='QA-ONLY-INSTANCE-REUSE-2026';
 const register=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({familyKey,password})});
 assert.equal(register.status,201);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 const port=new URL(gate.baseUrl).port;
 await page.locator('#qa34-port').fill(port);
 await page.locator('#qa34-family').fill(familyKey);
 await page.locator('#qa34-password').fill(password);
 await page.locator('#qa34-login').click();
 await page.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 const originalInstance=await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-gateway-instance-v1'));
 assert.match(originalInstance,/^[a-f0-9]{48}$/);
 pass('서버의 실제 192비트 인스턴스 ID가 최초 로그인 뒤 브라우저에 귀속');
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA 인스턴스 교체 전 기록 보존');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const before=await page.evaluate(async()=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
  return new Promise((ok,no)=>{q.onsuccess=()=>{db.close();ok(q.result)};q.onerror=()=>no(q.error)});
 });
 assert.equal(before.length,1);
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-logout').click();
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 let loginRequests=0;
 await page.route('**/qa/login',async route=>{
  loginRequests++;
  const response=await route.fetch();
  const json=await response.json();
  await route.fulfill({response,json:{...json,gatewayInstanceId:'f'.repeat(48)}});
 });
 const reenter=async()=>{
  await page.locator('#qa34-reenter-port').fill(port);
  await page.locator('#qa34-reenter-family').fill(familyKey);
  await page.locator('#qa34-reenter-password').fill(password);
  await page.evaluate(()=>document.querySelector('#qa34-reenter-status').textContent='');
  await page.locator('#qa34-family-reenter button').click();
 };
 await reenter();
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('시험 서버가 재시작·교체되어'));
 assert.equal(loginRequests,1);
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(await page.locator('#qa-main').evaluate(e=>e.inert),true);
 pass('같은 포트·가족·비밀번호지만 교체된 서버 ID는 로그인 응답 뒤 화면 열기 차단');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 await reenter();
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('시험 서버가 재시작·교체되어'));
 assert.equal(loginRequests,2);
 pass('새로고침 뒤에도 교체 서버의 가짜 동일 포트 신뢰 금지');
 const after=await page.evaluate(async()=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
  return new Promise((ok,no)=>{q.onsuccess=()=>{db.close();ok(q.result)};q.onerror=()=>no(q.error)});
 });
 assert.deepEqual(after,before);
 assert.equal(await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-gateway-instance-v1')),originalInstance);
 pass('거부 후에도 기존 오답 ID/원본 데이터·서버 인스턴스 표식 불변');
 await page.unroute('**/qa/login');
 await reenter();
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
 assert.deepEqual(await page.evaluate(async()=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
  return new Promise((ok,no)=>{q.onsuccess=()=>{db.close();ok(q.result)};q.onerror=()=>no(q.error)});
 }),before);
 pass('원본 인스턴스가 응답하면 같은 가상 가족 재로그인 및 기록 유지');
 assert.deepEqual(errors,[]);pass('브라우저 스크립트 예외 0');
 console.log('WRONG_GATEWAY_INSTANCE_RESULT='+JSON.stringify({status:'PASS',checks,syntheticOnly:true,realChromium:true,originalRecordsPreserved:1,productionAuth:false,safeToRestore:false,deployment:false}));
 await context.close();
}catch(e){console.error('WRONG_GATEWAY_INSTANCE_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e.stack).slice(0,900),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
