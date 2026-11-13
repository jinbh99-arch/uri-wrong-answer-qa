// New QA boundary only: two open same-origin tabs must respond to family bind and logout.
// This is a visual safety cover for synthetic localhost data, not real authorization.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const A='qa-multitab-alpha',B='qa-multitab-bravo';
const SECRET_A='QA-SYNTHETIC-MULTITAB-A-2026',SECRET_B='QA-SYNTHETIC-MULTITAB-B-2026';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser;const checks=[];
function pass(message){checks.push(message);console.log('PASS QA34 MULTITAB',message)}
async function register(id,password){
 const r=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({familyKey:id,password})});
 assert.equal(r.status,201,'synthetic registration '+id);
}
async function stored(page){return page.evaluate(async dbName=>{
 const req=indexedDB.open(dbName),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const read=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [records,keys,images,profile]=await Promise.all([
   read(tx.objectStore('mistakes').getAll()),read(tx.objectStore('photos').getAllKeys()),
   read(tx.objectStore('photos').getAll()),read(tx.objectStore('settings').get('profile'))]);
  return {records:records.sort((a,b)=>String(a.id).localeCompare(String(b.id))),profile,
   photos:await Promise.all(keys.map(async(key,i)=>({key,type:images[i].type,
    bytes:Array.from(new Uint8Array(await images[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function openTab(context){const page=await context.newPage();
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-sync-bridge:visible').waitFor({timeout:20000});
 return page;
}
async function unlock(page,id,password,port){
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(id);
 await page.locator('#qa34-reenter-password').fill(password);
 await page.locator('#qa34-family-reenter button[type="submit"]').click();
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 await register(A,SECRET_A);await register(B,SECRET_B);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const tabA=await openTab(context),tabB=await openTab(context);
 const errors=[];tabA.on('pageerror',e=>errors.push('A '+e));tabB.on('pageerror',e=>errors.push('B '+e));
 assert.equal(await tabB.locator('#qa34-family-privacy-cover').count(),0,'before binding B tab is unlocked');
 const port=new URL(gate.baseUrl).port;
 await tabA.locator('#qa34-port').fill(port);
 await tabA.locator('#qa34-family').fill(A);
 await tabA.locator('#qa34-password').fill(SECRET_A);
 await tabA.locator('#qa34-login').click();
 await tabA.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor({timeout:15000});
 await tabB.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:15000});
 assert.equal(await tabB.locator('#qa-main').evaluate(el=>el.inert),true);
 pass('이미 열린 두 번째 탭은 A 가상 가족 로그인 순간 저장소 소유 식별로 즉시 잠김');
 await tabA.locator('#nav-add').click();
 await tabA.locator('#problem').fill('QA A 가상 사진 문제');
 await tabA.locator('#choose-photo').setInputFiles({name:'fake-a.png',mimeType:'image/png',buffer:PNG});
 await tabA.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await tabA.locator('#save-btn').click();
 await tabA.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const records=(await stored(tabA)).records;
 assert.equal(records.length,1);
 await tabA.locator('#nav-records').click();
 await tabA.locator('#records-list button[data-record="'+records[0].id+'"]').click();
 await tabA.locator('#v230-answer:visible').waitFor();
 await tabA.locator('#v218-child-mode').click();
 await tabA.locator('#wrong002-retry').click();
 await tabA.locator('#v230-answer').fill('QA 가상 답');
 await tabA.locator('#v230-explanation').fill('QA 가상 아이의 설명');
 await tabA.locator('#v230-save').click();
 await tabA.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await tabA.locator('#v218-parent-mode').click();
 await tabA.locator('#v230-review').selectOption('needs_help');
 await tabA.locator('#v230-review-save').click();
 await tabA.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const before=await stored(tabA);
 assert.equal(before.photos.length,1);
 assert.equal(before.records[0].generalRetryHistory[0].review,'needs_help');
 assert.deepEqual(await stored(tabB),before);
 pass('A의 합성 오답 ID·사진 바이트·학생 설명·부모 관찰을 두 탭 동일 저장소에서 확인');
 await unlock(tabB,A,SECRET_A,port);
 await tabB.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:20000});
 assert.equal(await tabB.locator('#qa-main').evaluate(el=>el.inert),false);
 assert.deepEqual(await stored(tabB),before);
 pass('두 번째 탭도 같은 가상 가족 자격 확인 후에만 화면 열림');
 await tabA.locator('#nav-settings').click();
 await tabA.locator('#qa34-logout').click();
 await tabA.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:16000});
 await tabB.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:16000});
 assert.equal(await tabB.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await stored(tabA),before);
 assert.deepEqual(await stored(tabB),before);
 pass('A가 한 탭에서 로그아웃하면 다른 활성 탭까지 즉시 가림, 오답·사진·관찰 불변');
 await unlock(tabB,B,SECRET_B,port);
 await tabB.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답'),null,{timeout:10000});
 assert.equal(await tabB.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.deepEqual(await stored(tabB),before);
 pass('다른 가상 B 가족으로 재로그인 차단, 원본 저장소 불변');
 await unlock(tabB,A,SECRET_A,port);
 await tabB.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:20000});
 assert.deepEqual(await stored(tabB),before);
 assert.equal(await tabA.locator('#qa34-family-privacy-cover').isVisible(),true,'other logged-out tab stays locked');
 pass('A만 재로그인으로 접근 복구; 다른 로그아웃 탭은 계속 잠금');
 assert.deepEqual(errors,[]);
 console.log('WRONG_QA34_MULTITAB_RESULT='+JSON.stringify({status:'PASS',checks:checks.length,
  sameOriginTabs:2,realChromium:true,syntheticOnly:true,localPrivacyCoverNotAuthentication:true,
  realFamilies:0,safeToRestore:false,deployment:false}));
 await context.close();
}catch(err){console.error('WRONG_QA34_MULTITAB_RESULT='+JSON.stringify({status:'FAIL',
 checks:checks.length,error:String(err),stack:String(err?.stack).slice(0,1200),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
