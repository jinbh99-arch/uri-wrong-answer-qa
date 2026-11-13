import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const FAMILY='qa-delayed-401',PASSWORD='QA-HTTP-DELAYED-401-SYNTHETIC-2026';
let gate,browser,checks=0;const pass=s=>{checks++;console.log('PASS WRONG HTTP 401',s)};
const app='http://127.0.0.1:4173/';
async function open(ctx){const p=await ctx.newPage();await p.goto(app);await p.locator('#nav-settings').click();return p}
async function login(p,port,reenter=false){
 if(reenter){await p.locator('#qa34-reenter-port').fill(port);await p.locator('#qa34-reenter-family').fill(FAMILY);
 await p.locator('#qa34-reenter-password').fill(PASSWORD);await p.locator('#qa34-family-reenter button').click();
 await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:12000});}
 else{await p.locator('#qa34-port').fill(port);await p.locator('#qa34-family').fill(FAMILY);
 await p.locator('#qa34-password').fill(PASSWORD);await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();}
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';gate=await createIsolatedQaFamilyGateway();
 const reg=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});assert.equal(reg.status,201);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const A=await open(ctx),B=await open(ctx),errors=[];
 A.on('pageerror',e=>errors.push(String(e)));B.on('pageerror',e=>errors.push(String(e)));
 const port=new URL(gate.baseUrl).port;
 await login(A,port);await B.locator('#qa34-family-privacy-cover:visible').waitFor();await login(B,port,true);
 pass('가상 가족 같은 브라우저 두 탭 로그인');
 let release,intercepted;
 const hit=new Promise(resolve=>intercepted=resolve);
 await B.route('**/qa/snapshot',async route=>{
  B.unroute('**/qa/snapshot');
  await new Promise(resolve=>{release=resolve;intercepted()});
  await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'expired-old-A'})});
 });
 await B.locator('#qa34-pull').click();
 await hit;
 assert.equal(await B.locator('#qa34-pull').isDisabled(),true);
 pass('구세대 요청의 실제 HTTP 응답을 보류');
 await A.locator('#qa34-logout').click();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await B.locator('#qa34-reenter-family').isEnabled(),true);
 await login(B,port,true);
 assert.equal(await B.locator('#qa34-family-privacy-cover').count(),0);
 assert.equal(await B.locator('#qa34-pull').isEnabled(),true);
 pass('타 탭 로그아웃 직후 구세대 응답이 보류 중이어도 새 로그인 성공');
 release();
 await B.waitForTimeout(300);
 assert.equal(await B.locator('#qa34-family-privacy-cover').count(),0);
 assert.equal(await B.locator('#qa34-pull').isEnabled(),true);
 assert.ok((await B.locator('#qa34-status').textContent()).includes('로그인 완료'));
 pass('구세대 지연 HTTP 401이 새 가족 세션·화면·상태를 변경하지 않음');
 await B.route('**/qa/snapshot',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"current-expired"}'}));
 await B.locator('#qa34-pull').click();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await B.locator('#qa34-pull').isDisabled(),true);
 pass('현재 세션 실제 HTTP 401은 잠금·세션 종료');
 assert.deepEqual(errors,[]);pass('브라우저 JS 오류 0');
 console.log('WRONG_DELAYED_HTTP_401_RESULT='+JSON.stringify({status:'PASS',checks,realChromium:true,
 syntheticOnly:true,stale401Rejected:true,current401Locks:true,realAuth:false,safeToRestore:false}));
 await ctx.close();
}catch(e){console.error('WRONG_DELAYED_HTTP_401_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e.stack).slice(0,1300),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
