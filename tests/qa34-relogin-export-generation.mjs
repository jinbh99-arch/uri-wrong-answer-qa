// QA34 new race only: a stalled photo digest from a prior synthetic session
// must not disable or pollute a new backup after same-family relogin.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const FAMILY='qa-relogin-backup',PASSWORD='QA-RELOGIN-PHOTO-2026-SYNTHETIC';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,checks=0;const pass=s=>{checks++;console.log('PASS WRONG RELOGIN EXPORT',s)};
async function snapshot(p){return p.evaluate(async dbname=>{
 const req=indexedDB.open(dbname),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,keys,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
  return {rows,profile,photos:await Promise.all(keys.map(async(id,i)=>({id,mime:blobs[i].type,
   bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function open(ctx){
 const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();await p.locator('#qa34-sync-bridge:visible').waitFor();
 return p;
}
async function relogin(p,port){
 await p.locator('#qa34-reenter-port').fill(port);
 await p.locator('#qa34-reenter-family').fill(FAMILY);
 await p.locator('#qa34-reenter-password').fill(PASSWORD);
 await p.locator('#qa34-family-reenter button').click();
 await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:16000});
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 const registered=await fetch(gate.baseUrl+'/qa/register',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});
 assert.equal(registered.status,201);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const A=await open(ctx),B=await open(ctx),errors=[],bDownloads=[];
 A.on('pageerror',e=>errors.push('A '+String(e)));B.on('pageerror',e=>errors.push('B '+String(e)));
 B.on('download',d=>bDownloads.push(d.suggestedFilename()));
 const port=new URL(gate.baseUrl).port;
 await A.locator('#qa34-port').fill(port);
 await A.locator('#qa34-family').fill(FAMILY);
 await A.locator('#qa34-password').fill(PASSWORD);
 await A.locator('#qa34-login').click();
 await A.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await relogin(B,port);
 await B.locator('#nav-add').click();
 await B.locator('#problem').fill('QA 재로그인 사진 관찰 기록');
 await B.locator('#choose-photo').setInputFiles({name:'only-qa.png',mimeType:'image/png',buffer:PNG});
 await B.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await B.locator('#save-btn').click();
 await B.locator('#v09-save-confirm:not(.hide)').waitFor();
 const row=(await snapshot(B)).rows[0];
 await B.locator('#nav-records').click();
 await B.locator('#records-list button[data-record="'+row.id+'"]').click();
 await B.locator('#v230-answer:visible').waitFor();
 await B.locator('#v218-child-mode').click();await B.locator('#wrong002-retry').click();
 await B.locator('#v230-answer').fill('가상 아이 답');
 await B.locator('#v230-explanation').fill('처음 읽은 곳을 다시 확인했어요');
 await B.locator('#v230-save').click();
 await B.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await B.locator('#v218-parent-mode').click();
 await B.locator('#v230-review').selectOption('needs_help');await B.locator('#v230-review-save').click();
 await B.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const before=await snapshot(B);
 assert.equal(before.rows.length,1);assert.equal(before.photos.length,1);
 assert.equal(before.rows[0].generalRetryHistory[0].review,'needs_help');
 pass('가상 가족 사진 1장·아이 설명·부모 관찰 완전한 원본 확보');

 // Intercept the first SHA-256 only; later work is deliberately left unblocked.
 await B.evaluate(()=>{
  const target=crypto.subtle,real=target.digest.bind(target);let first=true;
  globalThis.__qaValidatedEvents=0;
  document.addEventListener('qa34:validated-synthetic-export',()=>globalThis.__qaValidatedEvents++);
  Object.defineProperty(target,'digest',{configurable:true,value:function(...args){
   if(!first)return real(...args);
   first=false;globalThis.__qaFirstDigestHeld=true;
   return new Promise((resolve,reject)=>{
    globalThis.__qaResumeFirstDigest=()=>real(...args).then(v=>{
     globalThis.__qaFirstDigestReleased=true;resolve(v)
    },reject);
   });
  }});
 });
 await B.locator('#nav-settings').click();
 await B.locator('#export-json').click();
 await B.locator('#wrong-backup-confirm:not([hidden])').waitFor();
 await B.locator('#wrong-backup-continue').click();
 await B.waitForFunction(()=>globalThis.__qaFirstDigestHeld===true,{},{timeout:16000});
 assert.equal(await B.locator('#export-json').isDisabled(),true);
 pass('첫 세션 사진 포함 백업의 SHA-256만 고의 지연, 저장소 원본 불변');

 await A.locator('#qa34-logout').click();
 await A.locator('#qa34-family-privacy-cover:visible').waitFor();
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await relogin(B,port);
 assert.equal(await B.locator('#export-json').isEnabled(),true,
  'previous digest still held after relogin should not disable new backup');
 assert.deepEqual(await snapshot(B),before);
 pass('다른 탭 로그아웃 후 같은 가상 가족 재로그인: 오래된 해시 미완료에도 백업 버튼 복구');

 await B.locator('#qa34-synthetic').check();
 await B.locator('#qa34-upload').click();
 await B.locator('#wrong-backup-confirm:not([hidden])').waitFor({timeout:10000});
 const freshDownload=B.waitForEvent('download',{timeout:23000});
 await B.locator('#wrong-backup-continue').click();
 const downloaded=await freshDownload;
 assert.ok(downloaded.suggestedFilename().endsWith('.json'));
 await B.waitForFunction(()=>document.querySelector('#qa34-status')?.textContent?.includes('서버 개정번호 1에 저장'),null,{timeout:22000});
 assert.equal(await B.evaluate(()=>globalThis.__qaValidatedEvents),1);
 assert.equal(bDownloads.length,1);
 assert.deepEqual(await snapshot(B),before);
 pass('재로그인 후 새로운 사진·관찰 백업이 정상 완료, 서명 데이터 이벤트/다운로드 각 정확히 1건');

 await B.evaluate(()=>globalThis.__qaResumeFirstDigest());
 await B.waitForFunction(()=>globalThis.__qaFirstDigestReleased===true,null,{timeout:10000});
 await B.waitForTimeout(150); // allow the retired async export to settle
 assert.equal(bDownloads.length,1,'old export downloaded a second plaintext photo file');
 assert.equal(await B.evaluate(()=>globalThis.__qaValidatedEvents),1,'old event listener leaked an export event');
 assert.equal(await B.locator('#export-json').isEnabled(),true);
 assert.ok((await B.locator('#v07-backup-result').textContent()).includes('자체 검사 통과'),
  'old export overwrote current successful UI status');
 assert.deepEqual(await snapshot(B),before);
 pass('이전 해시를 늦게 완료해도 추가 사진 다운로드/이벤트 0, 새 성공 상태·버튼·원본 유지');
 assert.deepEqual(errors,[]);
 pass('실제 브라우저 두 탭 스크립트 오류 0');
 console.log('WRONG_QA34_RELOGIN_GENERATION_RESULT='+JSON.stringify({status:'PASS',checks,
  tabs:2,realChromium:true,syntheticOnly:true,photoBytesPreserved:1,
  childExplanationParentReviewPreserved:true,realFamilyAuth:false,safeToRestore:false,deployment:false}));
 await ctx.close();
}catch(err){console.error('WRONG_QA34_RELOGIN_GENERATION_RESULT='+JSON.stringify({status:'FAIL',
 checks,error:String(err),stack:String(err?.stack).slice(0,1200),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
