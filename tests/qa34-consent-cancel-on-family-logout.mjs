// New synthetic QA boundary only: logout while plaintext backup, restore consent,
// or photo-inclusive export digest is pending must not expose/download/overwrite.
// Same-origin Chromium tabs; no real accounts, children, cloud storage or deployment.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const FAMILY='qa-consent-race',PASSWORD='QA-SYNTHETIC-CONSENT-2026-ONLY';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA34 CONSENT',s)};
async function state(p){return p.evaluate(async name=>{
 const req=indexedDB.open(name),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 try{const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const [rows,keys,blobs,profile]=await Promise.all([
   get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),
   get(tx.objectStore('photos').getAll()),get(tx.objectStore('settings').get('profile'))]);
  return {rows:rows.sort((a,b)=>String(a.id).localeCompare(String(b.id))),profile,
   photos:await Promise.all(keys.map(async (id,i)=>({id,type:blobs[i].type,
    bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function openTab(ctx){
 const p=await ctx.newPage();
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa34-sync-bridge:visible').waitFor({timeout:18000});
 return p;
}
async function regularLogin(p,port){
 await p.locator('#qa34-port').fill(port);
 await p.locator('#qa34-family').fill(FAMILY);
 await p.locator('#qa34-password').fill(PASSWORD);
 await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor({timeout:15000});
}
async function reenter(p,port){
 await p.locator('#qa34-reenter-port').fill(port);
 await p.locator('#qa34-reenter-family').fill(FAMILY);
 await p.locator('#qa34-reenter-password').fill(PASSWORD);
 await p.locator('#qa34-family-reenter button').click();
 await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'),null,{timeout:18000});
}
async function logout(p){
 await p.locator('#nav-settings').click();
 await p.locator('#qa34-logout').click();
 await p.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:16000});
}
async function add(p,title,photo){
 await p.locator('#nav-add').click();
 await p.locator('#problem').fill(title);
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'qa-fake.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await p.locator('#nav-settings').click();
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 const reg=await fetch(gate.baseUrl+'/qa/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({familyKey:FAMILY,password:PASSWORD})});
 assert.equal(reg.status,201);
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const A=await openTab(ctx),B=await openTab(ctx),errors=[],bDownloads=[];
 for(const [name,p] of [['A',A],['B',B]])p.on('pageerror',e=>errors.push(name+': '+String(e)));
 B.on('download',d=>bDownloads.push(d.suggestedFilename()));
 const port=new URL(gate.baseUrl).port;
 await regularLogin(A,port);
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await reenter(B,port);
 await add(A,'QA 가상 A 사진/관찰 백업 대상',true);
 const id=(await state(A)).rows[0].id;
 await A.locator('#nav-records').click();
 await A.locator('#records-list button[data-record="'+id+'"]').click();
 await A.locator('#v230-answer:visible').waitFor();
 await A.locator('#v218-child-mode').click();await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('QA 가상 아이 답');
 await A.locator('#v230-explanation').fill('QA 가상 아이가 처음에 이유를 잘못 설명함');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await A.locator('#v218-parent-mode').click();
 await A.locator('#v230-review').selectOption('needs_help');
 await A.locator('#v230-review-save').click();
 await A.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help'&&!document.querySelector('#v230-review-save')?.disabled);
 const original=await state(A);
 assert.equal(original.rows.length,1);assert.equal(original.photos.length,1);
 assert.equal(original.rows[0].generalRetryHistory[0].review,'needs_help');
 pass('가상 원본 오답 ID·사진 바이트·학생 설명·학부모 관찰 확보');

 // Boundary 1: B has opened plaintext-backup consent; A logs out.
 await B.locator('#qa34-synthetic').check();
 await B.locator('#qa34-upload').click();
 await B.locator('#wrong-backup-confirm:not([hidden])').waitFor({timeout:15000});
 assert.equal(await B.locator('#wrong-backup-confirm').isVisible(),true);
 await logout(A);
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await B.locator('#wrong-backup-confirm').isVisible(),false,
  'outstanding plaintext-backup consent survived sibling logout');
 assert.equal(bDownloads.length,0,'download occurred before consent');
 assert.deepEqual(await state(B),original);
 pass('로그아웃 전 열려 있던 비암호 사진 포함 백업 동의창 취소; 다운로드 0, 기록 불변');

 await reenter(A,port);await reenter(B,port);
 assert.equal(await B.locator('#wrong-backup-confirm').isVisible(),false);
 // Put original photo/observation in the synthetic remote service via actual export.
 await A.locator('#qa34-synthetic').check();
 await A.locator('#qa34-upload').click();
 await A.locator('#wrong-backup-confirm:not([hidden])').waitFor({timeout:12000});
 const downloaded=A.waitForEvent('download',{timeout:28000});
 await A.locator('#wrong-backup-continue').click();
 const full=await downloaded;
 assert.ok(full.suggestedFilename().endsWith('.json'));
 await A.waitForFunction(()=>document.querySelector('#qa34-status')?.textContent?.includes('서버 개정번호 1에 저장'),null,{timeout:25000});
 assert.deepEqual(await state(A),original);
 pass('정상 동의로 합성 서버에만 사진·관찰 백업 생성 후 로컬 원본 보존');

 // Boundary 2: B has additional UNSYNCED local data when remote restore dialog opens.
 await add(B,'QA 가족 B탭에서 추가한 미전송 가상 오답',false);
 const withLocalOnly=await state(B);
 assert.equal(withLocalOnly.rows.length,2);
 await B.locator('#qa34-pull').click();
 await B.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 await logout(A);
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await B.locator('#confirm-dialog[open]').count(),0,
  'destructive restore confirmation survived sibling logout');
 assert.deepEqual(await state(B),withLocalOnly,'restore after cancelled dialog lost unsent row/photo');
 pass('사진·관찰 원격 복원 동의창 자동 취소, 추가 미전송 오답·사진 원본 불변');

 await reenter(A,port);await reenter(B,port);
 assert.equal(await B.locator('#confirm-dialog[open]').count(),0);
 // Boundary 3: after explicit consent, delay the PHOTO EXPORT hash until A logs out.
 const install=await B.evaluate(()=>{
  const subtle=crypto.subtle,real=subtle.digest.bind(subtle);
  let first=true;
  Object.defineProperty(subtle,'digest',{configurable:true,value:function(...args){
   if(!first)return real(...args);
   first=false;globalThis.__qaDigestHeld=true;
   return new Promise((resolve,reject)=>{
    globalThis.__qaDigestResume=()=>real(...args).then(resolve,reject);
   });
  }});
  return Object.prototype.hasOwnProperty.call(subtle,'digest');
 });
 assert.equal(install,true,'synthetic crypto digest interception unavailable');
 await B.locator('#export-json').click();
 await B.locator('#wrong-backup-confirm:not([hidden])').waitFor();
 await B.locator('#wrong-backup-continue').click();
 await B.waitForFunction(()=>globalThis.__qaDigestHeld===true,null,{timeout:18000});
 await logout(A);
 await B.locator('#qa34-family-privacy-cover:visible').waitFor();
 await B.evaluate(()=>globalThis.__qaDigestResume());
 await B.waitForFunction(()=>document.querySelector('#v07-backup-result')?.textContent?.includes('백업 생성 중단'),null,{timeout:18000});
 assert.equal(bDownloads.length,0,'late hash completion triggered plaintext photo download');
 assert.deepEqual(await state(B),withLocalOnly);
 pass('SHA-256 지연 중 가족 로그아웃: 해시 완료 뒤에도 사진 포함 평문 백업 다운로드 0, 원본 불변');
 assert.deepEqual(errors,[]);
 pass('실제 Chromium 2탭 페이지 오류 0');
 console.log('WRONG_QA34_CONSENT_LOGOUT_RESULT='+JSON.stringify({status:'PASS',checks,
  actualBrowser:true,tabs:2,recordIdsPreserved:2,photoBytesPreserved:1,
  guardianObservationsPreserved:true,syntheticOnly:true,realFamilyAuth:false,
  safeToRestore:false,deployed:false}));
 await ctx.close();
}catch(e){console.error('WRONG_QA34_CONSENT_LOGOUT_RESULT='+JSON.stringify({
 status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1400),
 safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
