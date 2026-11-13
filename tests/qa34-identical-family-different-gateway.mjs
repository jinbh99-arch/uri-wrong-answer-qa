// QA34 NEW boundary: identical synthetic family ID registered at two DIFFERENT
// loopback gateways must never unlock/download/upload another gateway's photos.
// This is synthetic UI isolation, NOT actual family authentication or encryption.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const APP='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only',FAMILY='qa-identical-family',
 PASSWORD='QA-SYNTHETIC-COLLISION-2026-ONLY';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gateA,gateB,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG GATEWAY IDENTITY',s)};
async function register(gate){const r=await fetch(gate.baseUrl+'/qa/register',{method:'POST',
 headers:{'content-type':'application/json'},body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});
 assert.equal(r.status,201)}
async function localState(page){return page.evaluate(async name=>{
 const request=indexedDB.open(name),db=await new Promise((ok,no)=>{request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,keys,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
  return {rows:rows.sort((a,b)=>String(a.id).localeCompare(String(b.id))),profile,
   photos:await Promise.all(keys.map(async(id,i)=>({id,mime:blobs[i].type,
    bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function openApp(context){
 const p=await context.newPage();
 await p.goto(APP,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa34-sync-bridge:visible').waitFor();
 return p;
}
async function login(p,port){
 await p.locator('#qa34-port').fill(port);
 await p.locator('#qa34-family').fill(FAMILY);
 await p.locator('#qa34-password').fill(PASSWORD);
 await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor({timeout:14000});
}
async function reenter(p,port){
 await p.locator('#qa34-reenter-port').fill(port);
 await p.locator('#qa34-reenter-family').fill(FAMILY);
 await p.locator('#qa34-reenter-password').fill(PASSWORD);
 await p.locator('#qa34-family-reenter button').click();
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gateA=await createIsolatedQaFamilyGateway();
 gateB=await createIsolatedQaFamilyGateway();
 assert.notEqual(gateA.baseUrl,gateB.baseUrl);
 await register(gateA);await register(gateB);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await openApp(ctx),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const portA=new URL(gateA.baseUrl).port,portB=new URL(gateB.baseUrl).port;
 await login(page,portA);
 assert.equal(await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-gateway-v1')),gateA.baseUrl);
 pass('같은 이름·비밀번호 가상 가족을 가진 별도 서버 2개 중 A에 최초 브라우저 귀속');
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA 서버 A만 가진 사진 문제');
 await page.locator('#choose-photo').setInputFiles({name:'fake-a.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const row=(await localState(page)).rows[0];
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill('가상 답');
 await page.locator('#v230-explanation').fill('문장을 다시 읽어 보았어요');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const original=await localState(page);
 assert.equal(original.rows.length,1);assert.equal(original.photos.length,1);
 assert.equal(original.rows[0].generalRetryHistory[0].review,'needs_help');
 pass('A의 오답 ID·사진 원본 바이트·학생 설명·학부모 관찰 기록 확정');
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-logout').click();
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 // Count cross-server requests, even a login, so rejection must happen before B access.
 let toB=0;
 await page.route('**/qa/login',route=>{
  if(route.request().url().startsWith(gateB.baseUrl))toB++;
  return route.continue();
 });
 await reenter(page,portB);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 시험 서버의 기록과 섞을 수 없습니다'),null,{timeout:12000});
 assert.equal(toB,0,'attempted server B login despite local gateway binding');
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await localState(page),original);
 pass('같은 가족 ID/비밀번호지만 다른 서버 B 접속 사전 차단, B 네트워크 요청 0·A 원본 불변');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 await reenter(page,portB);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 시험 서버의 기록과 섞을 수 없습니다'));
 assert.deepEqual(await localState(page),original);
 pass('새로고침 후에도 B의 동일 이름 서버 접근 차단 및 기존 사진·관찰 보존');

 // A legacy profile with a family marker but missing gateway proof MUST fail closed.
 await page.evaluate(()=>localStorage.removeItem('qa34-synthetic-local-gateway-v1'));
 await reenter(page,portA);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 시험 서버의 기록과 섞을 수 없습니다'));
 assert.deepEqual(await localState(page),original);
 pass('이전 버전처럼 서버 식별이 없는 가족 표식은 안전하게 접근 거절(불완전 증명 거부)');
 await page.evaluate(base=>localStorage.setItem('qa34-synthetic-local-gateway-v1',base),gateA.baseUrl);
 await reenter(page,portA);
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:17000});
 assert.deepEqual(await localState(page),original);
 pass('원래 가상 서버 A에 정상 재접속하면 사진·부모 관찰까지 동일하게 복구');

 // Fresh separate browser profile can join B normally without importing A's records.
 const independent=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const b=await openApp(independent);
 await login(b,portB);
 const stateB=await localState(b);
 assert.equal(stateB.rows.length,0);assert.equal(stateB.photos.length,0);
 assert.equal(await b.evaluate(()=>localStorage.getItem('qa34-synthetic-local-gateway-v1')),gateB.baseUrl);
 pass('독립 브라우저 프로필은 B 서버 정상 연결, A 기록/사진 0건');
 assert.deepEqual(errors,[]);
 console.log('WRONG_QA34_GATEWAY_IDENTITY_RESULT='+JSON.stringify({status:'PASS',checks,
  realChromium:true,syntheticGateways:2,sameFamilyName:true,photoBytesPreserved:1,
  guardianReviewPreserved:true,networkToSecondGatewayBlocked:toB===0,
  productionAuth:false,realFamilies:0,safeToRestore:false,deployment:false}));
 await independent.close();await ctx.close();
}catch(e){console.error('WRONG_QA34_GATEWAY_IDENTITY_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(e),stack:String(e?.stack).slice(0,1600),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gateA)await gateA.shutdown();if(gateB)await gateB.shutdown()}
