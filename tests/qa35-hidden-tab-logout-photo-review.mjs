// New real Chromium regression: a synthetic A browser tab must lock its
// locally retained photo, child explanation and guardian review as soon as
// the tab becomes hidden. A later externally deleted server A cannot reopen
// that view; unchanged A may explicitly re-login. Only 127.0.0.1 synthetic.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';

const APP='http://127.0.0.1:4173/',FAMILY='qa-hidden-family-a',B='qa-hidden-family-b';
const PASSWORD='QA35-TAB-VISIBILITY-NOT-REAL-PASSWORD-2026',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,gate,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG TAB HIDDEN LOCK',s)};
async function api(path,method='GET',body,token,revision){
 const headers={};if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const response=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function local(page){
 return page.evaluate(async name=>{
  const request=indexedDB.open(name),db=await new Promise((resolve,reject)=>{
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error)});
  const get=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  try{
   const tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const [records,ids,blobs,profile]=await Promise.all([
    get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
    get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),profile,
    photos:await Promise.all(ids.map(async(id,i)=>({
     id,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
async function open(context){
 const page=await context.newPage();
 await page.goto(APP,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-sync-bridge:visible').waitFor();
 return page;
}
async function relog(page,port,family,password){
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(family);
 await page.locator('#qa34-reenter-password').fill(password);
 await page.locator('#qa34-family-reenter button').click();
}
async function background(context,page){
 const other=await context.newPage();
 await other.goto('about:blank');
 await other.bringToFront();
 // In headless Chromium, bringing another tab forward need not flip
 // document.hidden. Drive only that browser event seam deterministically;
 // the QA app, IndexedDB, network and DOM remain the actual Chromium objects.
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.equal(await page.evaluate(()=>document.querySelector('#qa34-logout')?.disabled),true);
 assert.deepEqual(await local(page),reference);
 await page.bringToFront();
 await page.evaluate(()=>{
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 await other.close();
}
let reference;
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 assert.equal((await api('/qa/register','POST',{familyKey:FAMILY,password:PASSWORD})).status,201);
 assert.equal((await api('/qa/register','POST',{familyKey:B,password:PASSWORD})).status,201);
 const external=await api('/qa/login','POST',{familyKey:FAMILY,password:PASSWORD});
 assert.equal(external.status,200);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await open(ctx),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const port=new URL(gate.baseUrl).port;
 await page.locator('#qa34-port').fill(port);
 await page.locator('#qa34-family').fill(FAMILY);
 await page.locator('#qa34-password').fill(PASSWORD);
 await page.locator('#qa34-login').click();
 await page.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('합성 사진 오답 - 다른 탭 배경 보호');
 await page.locator('#choose-photo').setInputFiles({name:'qa-only.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const row=(await local(page)).records[0];
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill('아이의 합성 답');
 await page.locator('#v230-explanation').fill('아이의 합성 설명을 보호');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review-save')?.disabled===false);
 reference=await local(page);
 assert.equal(reference.records.length,1);
 assert.equal(reference.photos.length,1);
 assert.equal(reference.records[0].generalRetryHistory[0].review,'needs_help');
 pass('A 가상 사진 실제 바이트·아이 설명·부모 관찰 IndexedDB 원본 확보');

 await background(ctx,page);
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-family-v1')),FAMILY);
 pass('A 탭 숨김 즉시 휘발 세션 제거·전체 화면 잠금, 저장된 사진/관찰 불변');

 await relog(page,port,FAMILY,PASSWORD);
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
 assert.deepEqual(await local(page),reference);
 pass('삭제되지 않은 동일 가상 가족은 명시적 로그인으로만 화면 재개방·원본 보존');

 await background(ctx,page);
 assert.deepEqual(await local(page),reference);
 pass('두 번째 숨김에서도 사진·부모 관찰 잠금, 자동 복귀 없음');

 // Delete the family while its last browser tab is already hidden/locked.
 const deleted=await api('/qa/family','DELETE',{
  familyKey:FAMILY,password:PASSWORD,approved:true,confirmation:'DELETE_SYNTHETIC_FAMILY'
 },external.data.token,0);
 assert.equal(deleted.status,200,JSON.stringify(deleted.data));
 assert.equal((await api('/qa/snapshot','GET',undefined,external.data.token)).status,401);
 await relog(page,port,FAMILY,PASSWORD);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('서버 응답 401'),null,{timeout:16000});
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await local(page),reference);
 pass('다른 세션에서 A 삭제 후 재로그인 401·화면 계속 잠금, 기존 사진/설명/관찰 무변경');

 assert.equal((await api('/qa/register','POST',{familyKey:FAMILY,password:PASSWORD})).status,409);
 const separate=await browser.newContext({viewport:{width:390,height:844}});
 const independent=await open(separate);
 independent.on('pageerror',e=>errors.push(String(e)));
 await independent.locator('#qa34-port').fill(port);
 await independent.locator('#qa34-family').fill(B);
 await independent.locator('#qa34-password').fill(PASSWORD);
 await independent.locator('#qa34-login').click();
 await independent.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 const bData=await local(independent);
 assert.equal(bData.records.length,0);
 assert.equal(bData.photos.length,0);
 assert.deepEqual(await local(page),reference);
 pass('가상 가족 B 독립 브라우저는 기존 A 사진/설명/관찰 0건, A 잠금 유지');

 assert.deepEqual(errors,[]);
 pass('두 브라우저 JS 오류 0');
 console.log('WRONG_QA35_HIDDEN_TAB_LOCK_RESULT='+JSON.stringify({
  status:'PASS',checks,realChromium:true,syntheticOnly:true,
  originalPhotoBytesPreserved:true,parentReviewPreserved:true,
  lockedBeforeRemoteDelete:true,explicitReloginRequired:true,
  foregroundRemoteDeleteDetection:false,realFamilyAuth:false,
  safeToRestore:false,deployment:false}));
 await separate.close();await ctx.close();
}catch(error){
 console.error('WRONG_QA35_HIDDEN_TAB_LOCK_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1250),
  safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
