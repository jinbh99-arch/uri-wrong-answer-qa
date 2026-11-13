import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const FAMILY='qa-delivered-stale',PASSWORD='QA-DELIVERED-RESPONSE-2026-SYNTHETIC';
const app='http://127.0.0.1:4173/';
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG DELIVERED STALE',s)};
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
 pass('동일 브라우저 두 탭의 합성 가족 세션 준비');
 await B.evaluate(()=>{
  const real=window.fetch.bind(window);
  window.__staleDelivered={count:0,delivered:0};
  window.fetch=(url,opts)=>{
   if(String(url).endsWith('/qa/snapshot')&&opts?.method==='GET'&&window.__staleDelivered.count<2){
    const id=++window.__staleDelivered.count;
    return new Promise(resolve=>{
     window.__staleDelivered['release'+id]=(status)=>{
      window.__staleDelivered.delivered++;
      resolve(new Response(JSON.stringify(status===401?{error:'expired old session'}:
       {revision:999,snapshot:{records:[{id:'stale-record'}],photos:{}}}),
       {status,headers:{'content-type':'application/json'}}));
     };
    });
   }
   return real(url,opts);
  };
 });
 for(const status of [401,200]){
  await B.locator('#qa34-pull').click();
  await B.waitForFunction(n=>window.__staleDelivered.count>=n,status===401?1:2);
  await A.locator('#qa34-logout').click();
  await B.locator('#qa34-family-privacy-cover:visible').waitFor();
  await login(B,port,true);
  const before=await B.locator('#qa34-revision').textContent();
  assert.ok(before.includes('서버 개정번호 0'));
  await B.evaluate(n=>window.__staleDelivered['release'+n](n===1?401:200),status===401?1:2);
  await B.waitForFunction(n=>window.__staleDelivered.delivered>=n,status===401?1:2);
  await B.waitForTimeout(100);
  assert.equal(await B.locator('#qa34-family-privacy-cover').count(),0);
  assert.equal(await B.locator('#qa34-revision').textContent(),before);
  assert.ok((await B.locator('#qa34-status').textContent()).includes('로그인 완료'));
  assert.equal(await B.locator('#qa34-pull').isEnabled(),true);
  pass('브라우저 fetch Promise로 취소 없이 전달된 구세대 '+status+' 응답이 새 세션·개정번호·화면을 변경하지 않음');
  if(status===401){
   // A's earlier logout also ended its own session; re-enter before next iteration.
   await login(A,port,true);
  }
 }
 await B.route('**/qa/snapshot',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"current-expired"}'}));
 await B.locator('#qa34-pull').click();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 pass('현행 세션 HTTP 401은 여전히 정상 잠금');
 assert.deepEqual(errors,[]);pass('브라우저 JS 오류 0');
 console.log('WRONG_DELIVERED_STALE_RESULT='+JSON.stringify({status:'PASS',checks,
  deliveredOld401:true,deliveredOld200:true,realChromium:true,syntheticFetchResponse:true,
  actualNetworkDelivery:false,realAuth:false,safeToRestore:false,deployment:false}));
 await ctx.close();
}catch(e){console.error('WRONG_DELIVERED_STALE_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(e),stack:String(e.stack).slice(0,1300),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
