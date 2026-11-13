import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const FAMILY='qa-real-http-logout',PASSWORD='QA-REAL-HTTP-LOGOUT-2026-SYNTHETIC';
let releaseAck,ackReached;const ackHeld=new Promise(resolve=>ackReached=resolve);
const ackGate=new Promise(resolve=>releaseAck=resolve);
let gateway,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG REAL HTTP LOGOUT',s)};
async function open(ctx){const p=await ctx.newPage();await p.goto('http://127.0.0.1:4173/');
 await p.locator('#nav-settings').click();return p}
async function login(p,port,reenter=false){
 if(reenter){
  await p.locator('#qa34-reenter-port').fill(port);
  await p.locator('#qa34-reenter-family').fill(FAMILY);
  await p.locator('#qa34-reenter-password').fill(PASSWORD);
  await p.locator('#qa34-family-reenter button').click();
  await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
 }else{
  await p.locator('#qa34-port').fill(port);await p.locator('#qa34-family').fill(FAMILY);
  await p.locator('#qa34-password').fill(PASSWORD);await p.locator('#qa34-login').click();
  await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 }
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gateway=await createIsolatedQaFamilyGateway({holdLogoutAck:()=>{
  ackReached();return ackGate;
 }});
 const reg=await fetch(gateway.baseUrl+'/qa/register',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});
 assert.equal(reg.status,201);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const A=await open(ctx),B=await open(ctx),errors=[];
 A.on('pageerror',e=>errors.push(String(e)));B.on('pageerror',e=>errors.push(String(e)));
 const port=new URL(gateway.baseUrl).port;
 await login(A,port);await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await login(B,port,true);
 pass('동일 브라우저 가상 가족 A/B 탭 연결 완료');
 await B.locator('#nav-add').click();
 await B.locator('#problem').fill('가상 사진과 학부모 관찰 보호 화면');
 await B.locator('#choose-photo').setInputFiles({name:'qa-only.png',mimeType:'image/png',
  buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64')});
 await B.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await B.locator('#save-btn').click();await B.locator('#v09-save-confirm:not(.hide)').waitFor();
 const before=await B.evaluate(async()=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const tx=db.transaction(['mistakes','photos'],'readonly');
  const get=x=>new Promise((ok,no)=>{x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error)});
  const rows=await get(tx.objectStore('mistakes').getAll());
  const photos=await get(tx.objectStore('photos').getAll());
  const bytes=await Promise.all(photos.map(async p=>Array.from(new Uint8Array(await p.arrayBuffer()))));
  db.close();return {rows,bytes};
 });
 assert.equal(before.rows.length,1);assert.equal(before.bytes.length,1);
 pass('사진 바이트·오답 원본을 저장해 무손실 기준 확보');
 await A.locator('#qa34-logout').click();
 await ackHeld; // Actual localhost HTTP request has reached gateway; ACK remains held.
 await A.locator('#qa34-family-privacy-cover:visible').waitFor();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await B.locator('#qa-main').evaluate(e=>e.inert),true);
 assert.equal(await A.locator('#qa34-logout').isDisabled(),true);
 pass('실제 localhost HTTP 로그아웃 ACK 미도착에도 두 탭 즉시 잠금');
 await login(B,port,true);
 const statusBefore=await B.locator('#qa34-status').textContent();
 assert.ok(statusBefore.includes('로그인 완료'));
 releaseAck();
 await A.waitForTimeout(200);
 assert.equal(await B.locator('#qa34-family-privacy-cover').count(),0);
 assert.equal(await A.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.ok((await B.locator('#qa34-status').textContent()).includes('로그인 완료'));
 const after=await B.evaluate(async()=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const tx=db.transaction(['mistakes','photos'],'readonly');
  const get=x=>new Promise((ok,no)=>{x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error)});
  const rows=await get(tx.objectStore('mistakes').getAll());
  const photos=await get(tx.objectStore('photos').getAll());
  const bytes=await Promise.all(photos.map(async p=>Array.from(new Uint8Array(await p.arrayBuffer()))));
  db.close();return {rows,bytes};
 });
 assert.deepEqual(after,before);
 pass('늦은 실제 HTTP ACK가 재로그인 B를 잠그지 않으며 사진·오답 무손실');
 assert.deepEqual(errors,[]);pass('브라우저 JS 오류 0');
 console.log('WRONG_REAL_HTTP_LOGOUT_RESULT='+JSON.stringify({status:'PASS',checks,
  actualLoopbackHttp:true,ackDelayed:true,tabs:2,photoBytesPreserved:true,
  realFamilyAuth:false,safeToRestore:false,deployment:false}));
 await ctx.close();
}catch(e){releaseAck?.();console.error('WRONG_REAL_HTTP_LOGOUT_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e.stack).slice(0,1300)}));process.exitCode=1}
finally{releaseAck?.();if(browser)await browser.close();if(gateway)await gateway.shutdown()}
