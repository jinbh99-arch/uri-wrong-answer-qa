// New QA-only race: delayed synthetic login/pull replies must NOT unlock a tab after sibling logout.
// Real Chromium (two same-origin tabs), fake family accounts/photos only. UI cover is not real auth.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const FAMILY='qa-async-household',PASSWORD='QA-ASYNC-SYNTHETIC-FAMILY-2026';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA34 ASYNC',s)};
async function state(page){return page.evaluate(async name=>{
 const req=indexedDB.open(name),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const read=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,keys,blobs,profile]=await Promise.all([
   read(tx.objectStore('mistakes').getAll()),read(tx.objectStore('photos').getAllKeys()),
   read(tx.objectStore('photos').getAll()),read(tx.objectStore('settings').get('profile'))]);
  return {rows:rows.sort((a,b)=>String(a.id).localeCompare(String(b.id))),profile,
   photos:await Promise.all(keys.map(async (id,i)=>({id,type:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function openTab(ctx){
 const page=await ctx.newPage();
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-sync-bridge:visible').waitFor();
 return page;
}
async function fromCover(page,port){
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(FAMILY);
 await page.locator('#qa34-reenter-password').fill(PASSWORD);
 await page.locator('#qa34-family-reenter button').click();
}
async function validRelogin(page,port){
 await fromCover(page,port);
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
}
async function holdResponse(page,method,path){
 let release,ready;
 const entered=new Promise(resolve=>{ready=resolve});
 const unblock=new Promise(resolve=>{release=resolve});
 const matcher='**'+path;
 const routeHandler=async route=>{
  if(route.request().method()!==method)return route.continue();
  const response=await route.fetch();
  assert.equal(response.status(),200,'delayed synthetic server reply');
  ready();
  await unblock;
  await route.fulfill({response});
 };
 await page.route(matcher,routeHandler);
 return {entered,release,stop:()=>page.unroute(matcher,routeHandler)};
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 const reg=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});
 assert.equal(reg.status,201);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const A=await openTab(ctx),B=await openTab(ctx),errors=[];
 for(const [name,p] of [['A',A],['B',B]])p.on('pageerror',e=>errors.push(name+': '+String(e)));
 const port=new URL(gate.baseUrl).port;
 await A.locator('#qa34-port').fill(port);await A.locator('#qa34-family').fill(FAMILY);
 await A.locator('#qa34-password').fill(PASSWORD);await A.locator('#qa34-login').click();
 await A.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await A.locator('#nav-add').click();
 await A.locator('#problem').fill('QA 비동기 전환 가상 사진 문제');
 await A.locator('#choose-photo').setInputFiles({name:'only-synthetic.png',mimeType:'image/png',buffer:PNG});
 await A.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await A.locator('#save-btn').click();await A.locator('#v09-save-confirm:not(.hide)').waitFor();
 const id=(await state(A)).rows[0].id;
 await A.locator('#nav-records').click();
 await A.locator('#records-list button[data-record="'+id+'"]').click();
 await A.locator('#v230-answer:visible').waitFor();
 await A.locator('#v218-child-mode').click();await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('가상 답');
 await A.locator('#v230-explanation').fill('처음 계산에서 한 부분을 놓쳤어요');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await A.locator('#v218-parent-mode').click();
 await A.locator('#v230-review').selectOption('needs_help');await A.locator('#v230-review-save').click();
 await A.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const before=await state(A);
 assert.equal(before.rows.length,1);assert.equal(before.photos.length,1);
 assert.equal(before.rows[0].generalRetryHistory[0].review,'needs_help');
 pass('가상 가족 A 사진 원본·아이 설명·부모 관찰 로컬 원본 확보');

 // New race 1: tab B has a successful login HTTP response pending while A logs out.
 const delayedLogin=await holdResponse(B,'POST','/qa/login');
 await B.locator('#qa34-reenter-port').fill(port);
 await B.locator('#qa34-reenter-family').fill(FAMILY);
 await B.locator('#qa34-reenter-password').fill(PASSWORD);
 await B.locator('#qa34-family-reenter button').click();
 await delayedLogin.entered;
 await A.locator('#nav-settings').click();await A.locator('#qa34-logout').click();
 await A.locator('#qa34-family-privacy-cover:visible').waitFor();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 delayedLogin.release();
 await B.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('이전 로그인 응답을 폐기'),null,{timeout:15000});
 await delayedLogin.stop();
 assert.equal(await B.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await state(B),before);
 pass('A 로그아웃 이후 B에 늦게 도착한 정상 로그인 200을 폐기, 화면 잠금·원본 바이트 유지');

 // Legitimate fresh family login succeeds after the race, preserving all original data.
 await validRelogin(A,port);await validRelogin(B,port);
 assert.deepEqual(await state(B),before);
 pass('가상 가족 A의 새 자격 확인만 허용; 이전 비동기 요청의 결과를 재사용하지 않음');

 // Give B a real, validated synthetic remote backup to make late GET a destructive-import hazard.
 await A.locator('#qa34-synthetic').check();
 const [download]=await Promise.all([
  A.waitForEvent('download',{timeout:25000}),A.locator('#qa34-upload').click()
 ]);
 assert.ok(download.suggestedFilename().endsWith('.json'));
 await A.waitForFunction(()=>document.querySelector('#qa34-status')?.textContent?.includes('서버 개정번호 1에 저장'),null,{timeout:25000});
 assert.deepEqual(await state(A),before);
 pass('실제 제품 백업 검사 뒤 원본 사진·관찰 포함 가상 원격 스냅샷 생성(원본 불변)');

 // New race 2: an authorized GET arrives AFTER another tab logged out.
 await B.evaluate(()=>{globalThis.__qaAsyncImportEvents=0;
  document.querySelector('#import-file').addEventListener('change',()=>globalThis.__qaAsyncImportEvents++)});
 const delayedPull=await holdResponse(B,'GET','/qa/snapshot');
 await B.locator('#qa34-pull').click();
 await delayedPull.entered;
 await A.locator('#qa34-logout').click();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 delayedPull.release();
 await B.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('로그아웃 이후 도착한 응답을 폐기'),null,{timeout:15000});
 await delayedPull.stop();
 assert.equal(await B.evaluate(()=>globalThis.__qaAsyncImportEvents),0,'late GET triggered import-file change');
 assert.equal(await B.locator('#confirm-dialog[open]').count(),0,'late GET reached destructive restore dialog');
 assert.equal(await B.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await state(B),before);
 pass('가상 원격 백업 GET 200 지연 중 A 로그아웃: B 복원 입력·확인창 0, 사진·관찰 바이트 불변');
 assert.deepEqual(errors,[]);
 pass('두 탭 실제 Chromium 페이지 오류 0');
 console.log('WRONG_QA34_STALE_REPLY_RESULT='+JSON.stringify({status:'PASS',checks,
  actualBrowser:true,contexts:1,tabs:2,syntheticOnly:true,realFamilyAuth:false,
  originalPhotoBytesPreserved:1,childParentHistoryPreserved:true,safeToRestore:false,deploy:false}));
 await ctx.close();
}catch(err){console.error('WRONG_QA34_STALE_REPLY_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(err),stack:String(err?.stack).slice(0,1200),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
