// NEW actual Chromium boundary: a synthetic server deletes family A while its
// local browser still has an active token and PHOTO/parent observations.
// Foreground must lock BEFORE a delayed GET reply; 401 keeps old data covered.
// Valid family B and temporary network errors must NOT erase records.
// Synthetic localhost only. No real family-auth, storage or deletion claim.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const APP='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const A='qa-foreground-deleted-a',B='qa-foreground-valid-b',C='qa-foreground-new-c';
const PA='QA-FOREGROUND-A-SYNTHETIC-NOT-REAL-2026',PB='QA-FOREGROUND-B-SYNTHETIC-NOT-REAL-2026';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG FOREGROUND REVOKE',s)};
async function call(path,method='GET',data,token,revision){
 const headers={'cache-control':'no-store'};
 if(data!==undefined)headers['content-type']='application/json';
 if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:res.status,data:await res.json()};
}
async function register(name,password){assert.equal((await call('/qa/register','POST',{familyKey:name,password})).status,201)}
async function token(name,password){const result=await call('/qa/login','POST',{familyKey:name,password});
 assert.equal(result.status,200,JSON.stringify(result.data));return result.data.token}
async function open(context){
 const p=await context.newPage();
 await p.goto(APP,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa34-sync-bridge:visible').waitFor();
 return p;
}
async function login(p,port,name,password){
 await p.locator('#qa34-port').fill(port);
 await p.locator('#qa34-family').fill(name);
 await p.locator('#qa34-password').fill(password);
 await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor({timeout:18000});
}
async function local(p){return p.evaluate(async dbName=>{
 const req=indexedDB.open(dbName),db=await new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 const get=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,ids,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
  return {rows,profile,photos:await Promise.all(ids.map(async(id,i)=>({
   id,mime:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 await register(A,PA);await register(B,PB);
 const aDelete=await token(A,PA),bToken=await token(B,PB);
 browser=await chromium.launch({headless:true});
 const ctxA=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const ctxB=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const page=await open(ctxA),b=await open(ctxB),errors=[];
 page.on('pageerror',e=>errors.push('A: '+String(e)));
 b.on('pageerror',e=>errors.push('B: '+String(e)));
 const port=new URL(gate.baseUrl).port;
 await login(page,port,A,PA);await login(b,port,B,PB);
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('원격 삭제 전 A의 합성 사진 문제');
 await page.locator('#choose-photo').setInputFiles({name:'synthetic-a.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const row=(await local(page)).rows[0];
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill('가상의 아이 답');
 await page.locator('#v230-explanation').fill('가상 A 아이가 이유를 상세히 설명');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review-save')?.disabled===false);
 const original=await local(page);
 assert.equal(original.rows.length,1);assert.equal(original.photos.length,1);
 assert.equal(original.rows[0].generalRetryHistory[0].review,'needs_help');
 pass('서로 다른 A/B 실제 브라우저에서 A 사진·아이 설명·보호자 관찰 바이트 기록 확정');

 // First, valid A token: delay its HTTP GET to prove the overlay is installed
 // synchronously rather than after the server reply.
 await page.locator('#nav-settings').click();
 let release,seen;
 const reached=new Promise(r=>seen=r),held=new Promise(r=>release=r);
 await page.route('**/qa/snapshot',async route=>{
  if(route.request().method()!=='GET')return route.continue();
  await page.unroute('**/qa/snapshot');
  seen();await held;try{await route.continue()}catch{}
 });
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:9000});
 await reached;
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#qa34-foreground-retry').isVisible(),true);
 assert.deepEqual(await local(page),original);
 pass('정상 A 포커스 복귀: HTTP GET 응답을 의도적으로 보류해도 가림을 먼저 표시, 원본 불변');
 release();
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:14000});
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),false);
 assert.deepEqual(await local(page),original);
 pass('유효한 A 서버 GET 200 확인 뒤에만 화면 재개방, 사진·관찰 무변경');

 const deleted=await call('/qa/family','DELETE',{
  familyKey:A,password:PA,approved:true,confirmation:'DELETE_SYNTHETIC_FAMILY'
 },aDelete,0);
 assert.equal(deleted.status,200,JSON.stringify(deleted.data));
 assert.equal((await call('/qa/snapshot','GET',undefined,aDelete)).status,401);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 await page.waitForFunction(()=>document.querySelector('#qa34-foreground-retry')?.hidden===true,null,{timeout:14000});
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#qa34-status').getAttribute('data-error'),'true');
 assert.deepEqual(await local(page),original);
 assert.equal(await b.locator('#qa34-family-privacy-cover').count(),0);
 assert.equal((await call('/qa/snapshot','GET',undefined,bToken)).status,200);
 pass('원격에서 A 삭제 후 기존 A 열린 탭의 포커스 복귀는 401·가림 유지, B 유지·로컬 사진/관찰 보존');

 const registerAgain=await call('/qa/register','POST',{familyKey:A,password:PB});
 assert.equal(registerAgain.status,409);
 assert.equal((await call('/qa/register','POST',{familyKey:C,password:PB})).status,201);
 let requestsC=0;
 await page.route('**/qa/login',route=>{
  if(route.request().postData()?.includes(C))requestsC++;
  return route.continue();
 });
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(C);
 await page.locator('#qa34-reenter-password').fill(PB);
 await page.locator('#qa34-family-reenter button').click();
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답'),null,{timeout:12000});
 assert.equal(requestsC,0);
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await local(page),original);
 pass('A 원격 삭제 뒤 신규 C를 기존 브라우저에 연결해도 로그인 요청 0·A 기록은 가림 유지');

 // Network failure for a STILL-VALID family B must leave B's local view
 // locked, retain its token/records, and offer a successful manual retry.
 await b.route('**/qa/snapshot',async route=>{
  if(route.request().method()!=='GET')return route.continue();
  await b.unroute('**/qa/snapshot');await route.abort('failed');
 });
 const beforeB=await local(b);
 await b.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await b.locator('#qa34-family-privacy-cover:visible').waitFor();
 await b.waitForFunction(()=>document.querySelector('#qa34-status')?.textContent?.includes('서버 재확인 실패'),null,{timeout:14000});
 assert.equal(await b.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.equal(await b.locator('#qa34-foreground-retry').isEnabled(),true);
 assert.deepEqual(await local(b),beforeB);
 pass('정상 가족 B의 일시 연결 실패를 인증 철회로 오인하지 않고 화면 가림·원본 유지·재확인 안내');
 await b.locator('#qa34-foreground-retry').click();
 await b.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:14000});
 assert.equal(await b.locator('#qa-main').evaluate(el=>el.inert),false);
 assert.deepEqual(await local(b),beforeB);
 assert.equal((await call('/qa/snapshot','GET',undefined,bToken)).status,200);
 pass('B 네트워크 복구 후 사용자가 직접 재확인하면 GET 200에만 정상 개방, 데이터 무변경');

 assert.deepEqual(errors,[]);
 pass('실제 Chromium 390px A·320px B JS 예외 0');
 console.log('WRONG_QA35_FOREGROUND_REVOKE_RESULT='+JSON.stringify({
  status:'PASS',checks,realChromium:true,syntheticFamilies:3,
  immediateLockBeforeResponse:true,remoteDelete401Locks:true,
  bTransientNetworkRetry:true,photosAndReviewsPreserved:true,
  productionAuth:false,realChildren:0,safeToRestore:false,deployed:false}));
 await ctxA.close();await ctxB.close();
}catch(err){
 console.error('WRONG_QA35_FOREGROUND_REVOKE_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1600),
  safeToRestore:false}));process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
