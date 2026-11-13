// New boundary only: real Chromium, two tabs, delayed localhost GET/PUT after logout.
// Synthetic data only. Never claim production family isolation.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const APP='http://127.0.0.1:4173/',FAMILY='qa-http-race-2026',PASSWORD='QA-HTTP-RACE-SYNTHETIC-2026',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,n=0;const pass=s=>{n++;console.log('PASS WRONG DELAYED HTTP',s)};
async function snapshot(p){return p.evaluate(async name=>{
 const req=indexedDB.open(name),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{const tx=db.transaction(['mistakes','photos','settings'],'readonly');
 const [rows,keys,blobs,profile]=await Promise.all([get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
 return {rows,profile,photos:await Promise.all(keys.map(async(id,i)=>({id,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function open(ctx){const p=await ctx.newPage();await p.goto(APP,{waitUntil:'domcontentloaded'});await p.locator('#nav-settings').click();await p.locator('#qa34-sync-bridge:visible').waitFor();return p}
async function login(p,port,reenter=false){if(reenter){await p.locator('#qa34-reenter-port').fill(port);await p.locator('#qa34-reenter-family').fill(FAMILY);await p.locator('#qa34-reenter-password').fill(PASSWORD);await p.locator('#qa34-family-reenter button').click();await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000})}
else{await p.locator('#qa34-port').fill(port);await p.locator('#qa34-family').fill(FAMILY);await p.locator('#qa34-password').fill(PASSWORD);await p.locator('#qa34-login').click();await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor()}}
async function hold(p,method){let release,started;const waiting=new Promise(r=>started=r),barrier=new Promise(r=>release=r);
 await p.route('**/qa/snapshot',async route=>{if(route.request().method()!==method)return route.continue();await p.unroute('**/qa/snapshot');started();await barrier;try{await route.continue()}catch{}});
 return {waiting,release:()=>release()}}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';gate=await createIsolatedQaFamilyGateway();
 const registered=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});assert.equal(registered.status,201);
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const a=await open(ctx),b=await open(ctx),errors=[];a.on('pageerror',e=>errors.push(String(e)));b.on('pageerror',e=>errors.push(String(e)));
 const port=new URL(gate.baseUrl).port;await login(a,port);await b.locator('#qa34-family-privacy-cover:visible').waitFor();await login(b,port,true);
 await b.locator('#nav-add').click();await b.locator('#problem').fill('가상 GET PUT 지연 확인');
 await b.locator('#choose-photo').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:PNG});
 await b.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await b.locator('#save-btn').click();await b.locator('#v09-save-confirm:not(.hide)').waitFor();
 const row=(await snapshot(b)).rows[0];await b.locator('#nav-records').click();await b.locator('#records-list button[data-record="'+row.id+'"]').click();
 await b.locator('#v230-answer:visible').waitFor();await b.locator('#v218-child-mode').click();await b.locator('#wrong002-retry').click();
 await b.locator('#v230-answer').fill('가상 답');await b.locator('#v230-explanation').fill('아이의 합성 설명');await b.locator('#v230-save').click();
 await b.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await b.locator('#v218-parent-mode').click();await b.locator('#v230-review').selectOption('needs_help');await b.locator('#v230-review-save').click();
 await b.waitForFunction(()=>document.querySelector('#v230-review-save')?.disabled===false);
 const before=await snapshot(b);assert.equal(before.photos.length,1);assert.equal(before.rows[0].generalRetryHistory[0].review,'needs_help');pass('합성 오답·사진 바이트·아이 설명·부모 관찰 원본 확정');
 await b.locator('#nav-settings').click();await b.locator('#qa34-synthetic').check();
 // First upload to create an actual remote snapshot and revision 1.
 await b.locator('#qa34-upload').click();await b.locator('#wrong-backup-confirm:not([hidden])').waitFor();
 await b.locator('#wrong-backup-continue').click();
 await b.waitForFunction(()=>document.querySelector('#qa34-status')?.textContent?.includes('서버 개정번호 1에 저장'),null,{timeout:24000});
 const remoteBefore=await fetch(gate.baseUrl+'/qa/snapshot',{headers:{Authorization:'Bearer '+await b.evaluate(()=>document.querySelector('#qa34-token')?.value||'')}}).catch(()=>null);
 pass('실제 가상 원격 PUT 확정 후 GET/PUT 지연 경계 준비');
 const delayedGet=await hold(b,'GET');await b.locator('#qa34-pull').click();await delayedGet.waiting;
 await a.locator('#qa34-logout').click();await b.locator('#qa34-family-privacy-cover:visible').waitFor();
 delayedGet.release();await b.waitForTimeout(200);
 assert.equal(await b.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.deepEqual(await snapshot(b),before);assert.equal(await b.locator('#import-file').inputValue(),'');
 pass('지연 GET 중 다른 탭 로그아웃: 복원 파일 선택 0, 잠금·사진·관찰 보존');
 await login(b,port,true);
 const delayedPut=await hold(b,'PUT');await b.locator('#qa34-upload').click();await b.locator('#wrong-backup-confirm:not([hidden])').waitFor();await b.locator('#wrong-backup-continue').click();
 await delayedPut.waiting;
 await a.locator('#qa34-reenter-port').fill(port);await a.locator('#qa34-reenter-family').fill(FAMILY);await a.locator('#qa34-reenter-password').fill(PASSWORD);await a.locator('#qa34-family-reenter button').click();
 await a.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
 await a.locator('#qa34-logout').click();await b.locator('#qa34-family-privacy-cover:visible').waitFor();
 delayedPut.release();await b.waitForTimeout(250);
 assert.equal(await b.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.deepEqual(await snapshot(b),before);assert.equal(await b.locator('#import-file').inputValue(),'');
 pass('지연 PUT 중 다른 탭 로그아웃: 로컬 복원/재전송 0, 사진·관찰 원본 보존');
 await login(b,port,true);assert.deepEqual(await snapshot(b),before);
 pass('같은 가족 재로그인 뒤 원본 그대로, 복원 선택 파일 없음');
 assert.deepEqual(errors,[]);pass('Chromium 두 탭 JS 오류 0');
 console.log('WRONG_DELAYED_HTTP_RESULT='+JSON.stringify({status:'PASS',checks:n,tabs:2,syntheticOnly:true,photoPreserved:true,parentReviewPreserved:true,safeToRestore:false,deploy:false}));
 await ctx.close();
}catch(e){console.error('WRONG_DELAYED_HTTP_RESULT='+JSON.stringify({status:'FAIL',checks:n,error:String(e),stack:String(e?.stack).slice(0,1200),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
