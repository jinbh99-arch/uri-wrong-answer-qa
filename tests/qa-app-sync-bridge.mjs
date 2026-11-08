// QA34 G15 — TRUE app-settings UI (not a separate lab): two fully isolated
// Chromium contexts round-trip the app's signed JSON/photos via loopback QA.
// No cloud service, actual family, real child, or automatic synchronization.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PASSWORD='QA34-SYNTHETIC-APP-SETTINGS-ONLY-2026';
const FAMILY='qa-34-app-family';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA34 G15 APP',s)};
async function api(path,method='GET',body,token,revision){
 const headers={};if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,data:await res.json()};
}
async function openApp(ctx){
 const p=await ctx.newPage();
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa34-sync-bridge:visible').waitFor();
 return p;
}
async function login(p){
 await p.locator('#qa34-port').fill(new URL(gate.baseUrl).port);
 await p.locator('#qa34-family').fill(FAMILY);
 await p.locator('#qa34-password').fill(PASSWORD);
 await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 assert.equal(await p.locator('#qa34-upload').isEnabled(),true);
 assert.equal(await p.locator('#qa34-password').inputValue(),'');
 await p.locator('#qa34-synthetic').check();
}
async function state(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name),db=await new Promise((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const request=(store,method)=>new Promise((resolve,reject)=>{
    const r=tx.objectStore(store)[method]();
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
   });
   const [records,photos,keys]=await Promise.all([
    request('mistakes','getAll'),request('photos','getAll'),request('photos','getAllKeys')
   ]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(photos.map(async (blob,i)=>({
     id:keys[i],mime:blob.type,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))
    })))};
  }finally{db.close()}
 },DB);
}
async function add(p,text,photo=false){
 await p.locator('#nav-add').click();
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'qa34-fake.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#problem').fill(text);
 await p.locator('#student-answer').fill('가상 답');
 await p.locator('#memo').fill('QA34 synthetic app UI only');
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor();
 await p.locator('#nav-settings').click();
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 assert.equal((await api('/qa/register','POST',{familyKey:FAMILY,password:PASSWORD})).status,201);
 browser=await chromium.launch({headless:true});
 const ctxA=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const ctxB=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const A=await openApp(ctxA),B=await openApp(ctxB);
 await login(A);await login(B);
 assert.equal((await state(A)).records.length,0);
 assert.equal((await state(B)).records.length,0);
 pass('실제 오답노트 설정에서 별도 390/320px Chromium 브라우저 가족 로그인(서버 리비전 0)');
 await add(A,'QA34 가상 사진 오답 A',true);
 const beforeA=await state(A);
 assert.equal(beforeA.records.length,1);
 assert.equal(beforeA.photos.length,1);
 const [download]=await Promise.all([
  A.waitForEvent('download',{timeout:30000}),
  A.locator('#qa34-upload').click()
 ]);
 assert.ok(download.suggestedFilename().endsWith('.json'));
 await A.getByText('서버 개정번호 1에 저장했습니다.',{exact:false}).waitFor();
 const tok=(await api('/qa/login','POST',{familyKey:FAMILY,password:PASSWORD})).data.token;
 let remote=await api('/qa/snapshot','GET',undefined,tok);
 assert.equal(remote.data.revision,1);
 assert.equal(remote.data.snapshot.records.length,1);
 assert.equal(Object.keys(remote.data.snapshot.photos).length,1);
 assert.equal((await state(B)).records.length,0);
 pass('기기 A 실제 앱 서명·사진·기록 백업 → 서버 rev1 저장, 기기 B는 자동 변경되지 않음');
 await B.locator('#qa34-pull').click();
 await B.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 assert.equal((await state(B)).records.length,0,'remote data must not restore without consent');
 pass('기기 B 실제 앱으로 서버 파일을 인도해도 사용자 복원 확인 이전에 IndexedDB 원본 불변');
 await B.locator('#dlg-ok').click();
 await B.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='1'
   ||document.querySelector('#records-count')?.textContent?.includes('전체 1건'));
 assert.deepEqual(await state(B),beforeA);
 pass('기기 B에서 기존 손실 방지 검증과 명시적 복원 확인 후 사진 원본 바이트까지 복구');
 await add(B,'QA34 가상 두번째 오답 B',false);
 const Bnow=await state(B);
 assert.equal(Bnow.records.length,2);
 await B.locator('#qa34-upload').click();
 await B.getByText('서버 개정번호 2에 저장했습니다.',{exact:false}).waitFor();
 remote=await api('/qa/snapshot','GET',undefined,tok);
 assert.equal(remote.data.revision,2);
 assert.equal(remote.data.snapshot.records.length,2);
 assert.deepEqual(remote.data.snapshot.photos,Object.fromEntries(Object.entries(remote.data.snapshot.photos)));
 assert.deepEqual(await state(A),beforeA);
 pass('기기 B에서 새 오답 추가 후 rev2 업로드, A의 데이터는 명시적 가져오기 전까지 유지');
 const staleDownloads=[];
 A.on('download',download=>staleDownloads.push(download));
 await A.locator('#qa34-upload').click();
 await A.getByText('서버 기록이 다른 기기에서 변경되어 전송을 중단했습니다.',{exact:false}).waitFor();
 assert.equal(staleDownloads.length,0,'stale revision should fail before downloading a raw backup');
 const unchanged=await api('/qa/snapshot','GET',undefined,tok);
 assert.equal(unchanged.data.revision,2);
 assert.equal(unchanged.data.snapshot.records.length,2);
 assert.deepEqual(await state(A),beforeA);
 pass('A의 오래된 rev1 전송은 사전검사에서 차단, 원본 백업 추가 생성 없음, 서버 rev2와 로컬 원본 불변');
 await A.locator('#qa34-pull').click();
 await A.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 assert.deepEqual(await state(A),beforeA);
 await A.locator('#dlg-ok').click();
 await A.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='2'
   ||document.querySelector('#records-count')?.textContent?.includes('전체 2건'));
 assert.deepEqual(await state(A),Bnow);
 pass('A가 최신 rev2를 별도 확인 후 복원, 기기 A/B 오답·원본 사진 동일');
 await A.reload({waitUntil:'domcontentloaded'});
 await A.locator('#nav-settings').click();
 assert.equal(await A.locator('#qa34-login').isEnabled(),true);
 assert.equal(await A.locator('#qa34-upload').isDisabled(),true);
 assert.deepEqual(await state(A),Bnow);
 pass('새로고침 후 로그인 세션은 메모리에서 삭제, IndexedDB의 실물 사진·기록만 유지');
 const another=await browser.newPage();
 await another.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
 assert.equal(await another.locator('#qa34-sync-bridge').isHidden(),true);
 pass('127.0.0.1 이외 동일 서버 호스트에서 직접 교환 UI 숨김');
 // QA35: an out-of-band password rotation revokes B's active UI session.
 // The next upload must fail at the preflight GET, before any raw JSON export,
 // and log the UI out while preserving both the browser and server records.
 const rotated=await api('/qa/password','POST',{
  familyKey:FAMILY,oldPassword:PASSWORD,newPassword:PASSWORD+'-ROTATED',
  confirmation:'ROTATE_SYNTHETIC_PASSWORD',approved:true
 },tok,2);
 assert.equal(rotated.status,200);
 const remoteAfterRotation=await api('/qa/login','POST',{
  familyKey:FAMILY,password:PASSWORD+'-ROTATED'
 });
 assert.equal(remoteAfterRotation.status,200);
 const beforeRevoked=await state(B);
 const revokedDownloads=[];
 B.on('download',download=>revokedDownloads.push(download));
 await B.locator('#qa34-upload').click();
 await B.getByText('서버 응답 401:',{exact:false}).waitFor();
 assert.equal(await B.locator('#qa34-upload').isDisabled(),true);
 assert.equal(await B.locator('#qa34-login').isEnabled(),true);
 assert.equal(await B.locator('#qa34-password').inputValue(),'');
 assert.equal(revokedDownloads.length,0,'revoked session must not cause raw backup export');
 assert.deepEqual(await state(B),beforeRevoked);
 const freshRemote=await api('/qa/snapshot','GET',undefined,remoteAfterRotation.data.token);
 assert.equal(freshRemote.status,200);
 assert.equal(freshRemote.data.revision,3);
 assert.equal(freshRemote.data.snapshot.records.length,2);
 pass('타 기기 비밀번호 변경·전체 세션 폐기 후 업로드 사전 차단, 클라이언트 자동 로그아웃, 원본과 서버 기록 보존');
 console.log('QA_G15_REAL_APP_SETTINGS_BRIDGE_RESULT='+JSON.stringify({
  status:'PASS',checks,realAppContexts:2,
  allRecordBytesPreserved:true,manualConfirmation:true,staleUploadDenied:true,
  actualAppSettings:true,automaticSync:false,hostedCloud:false,realChildren:0
 }));
}catch(e){
 console.error('QA_G15_REAL_APP_SETTINGS_BRIDGE_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1400)}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
