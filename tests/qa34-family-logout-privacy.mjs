// QA-only real Chromium: synthetic family A/B on the SAME browser and same origin.
// Cover is presentation privacy, not server authentication or cryptographic protection.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const A='qa-family-alpha',B='qa-family-bravo',PASS_A='SYNTHETIC-A-SECRET-2026-ONLY',PASS_B='SYNTHETIC-B-SECRET-2026-ONLY';
const DB='uriaimath-github-qa-v224-only',BASE='http://127.0.0.1:4173/';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gateway,browser,steps=[];
function pass(s){steps.push(s);console.log('PASS QA34 FAMILY SWITCH',s)}
async function snapshot(page){return page.evaluate(async name=>{
 const q=indexedDB.open(name),db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,keys,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))
  ]);
  return {records:rows.sort((a,b)=>String(a.id).localeCompare(String(b.id))),profile,
   photos:await Promise.all(keys.map(async(k,i)=>({id:k,type:blobs[i].type,
    bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function register(familyKey,password){
 const response=await fetch(gateway.baseUrl+'/qa/register',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({familyKey,password})});
 assert.equal(response.status,201);
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gateway=await createIsolatedQaFamilyGateway();
 await register(A,PASS_A);await register(B,PASS_B);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-sync-bridge:visible').waitFor({timeout:15000});
 const port=new URL(gateway.baseUrl).port;
 await page.locator('#qa34-port').fill(port);
 await page.locator('#qa34-family').fill(A);
 await page.locator('#qa34-password').fill(PASS_A);
 await page.locator('#qa34-login').click();
 await page.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('가상 A의 사진 오답 — 실제 아동 정보 없음');
 await page.locator('#choose-photo').setInputFiles({name:'fake-A.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const row=(await snapshot(page)).records[0];
 assert.ok(row&&row.hasPhoto);
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();
 await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill('QA A 가상 답');
 await page.locator('#v230-explanation').fill('QA A 학생이 말로 설명한 오답 이유');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const before=await snapshot(page);
 assert.equal(before.records.length,1);
 assert.equal(before.photos.length,1);
 assert.equal(before.records[0].generalRetryHistory[0].review,'needs_help');
 pass('A 가상 가족 오답·원본 사진 바이트·부모 관찰 기록 저장');
 await page.locator('#nav-settings').click();
 await page.locator('#qa34-logout').click();
 await page.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:15000});
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await snapshot(page),before);
 pass('로그아웃 때 메인 오답 화면 inert + 가림 표시, IndexedDB 기록·사진·부모 관찰 불변');
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(B);
 await page.locator('#qa34-reenter-password').fill(PASS_B);
 await page.locator('#qa34-family-reenter button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답·사진·관찰이 남아'),null,{timeout:12000});
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await snapshot(page),before);
 pass('같은 브라우저 B 로그인 차단, A 오답·원본 사진·관찰 불변');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:15000});
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await snapshot(page),before);
 pass('같은 브라우저 새로고침에도 가림 유지, 데이터 불변');
 await page.locator('#qa34-reenter-port').fill(port);
 await page.locator('#qa34-reenter-family').fill(A);
 await page.locator('#qa34-reenter-password').fill(PASS_A);
 await page.locator('#qa34-family-reenter button[type="submit"]').click();
 await page.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'));
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),false);
 assert.deepEqual(await snapshot(page),before);
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 assert.equal((await snapshot(page)).records[0].generalRetryHistory[0].review,'needs_help');
 pass('A의 올바른 가상 서버 비밀번호 재로그인 후 기록·사진·부모 관찰 정상 회수');
 assert.deepEqual(errors,[]);
 pass('자바스크립트 페이지 오류 0');
 console.log('WRONG_QA34_FAMILY_SWITCH_RESULT='+JSON.stringify({status:'PASS',checks:steps.length,
  sameBrowser:true,realChromium:true,realChildren:0,realFamilyAuth:false,
  localViewCoverNotSecurity:true,operationalDeployment:false,safeToRestore:false}));
 await context.close();
}catch(err){
 console.error('WRONG_QA34_FAMILY_SWITCH_RESULT='+JSON.stringify({status:'FAIL',checks:steps.length,
  error:String(err),stack:String(err?.stack).slice(0,1200),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gateway)await gateway.shutdown();
}
