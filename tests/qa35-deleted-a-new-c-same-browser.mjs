// QA35 new browser boundary only. After the real synthetic family A is deleted
// by another valid session, its name cannot be re-registered in the same
// gateway and new family C must not unlock A's locally retained photos,
// child explanations and parent observations in the SAME browser profile.
// No real family data/authentication or production restoration guarantees.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const APP='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const A='qa-35-browser-old-a',C='qa-35-browser-new-c',B='qa-35-browser-unrelated-b';
const PASSWORD_A='QA35-OLD-SYNTHETIC-FAMILY-PASSWORD-2026';
const PASSWORD_C='QA35-NEW-SYNTHETIC-FAMILY-PASSWORD-2026';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,gate,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA35 SAME BROWSER C',s)};
async function call(path,method='GET',body,token,revision){
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const r=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
async function register(key,password){
 const r=await call('/qa/register','POST',{familyKey:key,password});
 return r;
}
async function token(key,password){
 const r=await call('/qa/login','POST',{familyKey:key,password});
 assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;
}
async function open(context,expectCovered=false){
 const p=await context.newPage();await p.goto(APP,{waitUntil:'domcontentloaded'});
 if(expectCovered){
  // The privacy overlay correctly intercepts the underlying navigation.
  await p.locator('#qa34-family-privacy-cover:visible').waitFor();
 }else{
  await p.locator('#nav-settings').click();
  await p.locator('#qa34-sync-bridge:visible').waitFor();
 }
 return p;
}
async function login(p,port,key,password){
 await p.locator('#qa34-port').fill(port);
 await p.locator('#qa34-family').fill(key);
 await p.locator('#qa34-password').fill(password);
 await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor({timeout:18000});
}
async function reenter(p,port,key,password){
 await p.locator('#qa34-reenter-port').fill(port);
 await p.locator('#qa34-reenter-family').fill(key);
 await p.locator('#qa34-reenter-password').fill(password);
 await p.evaluate(()=>{document.querySelector('#qa34-reenter-status').textContent='';});
 await p.locator('#qa34-family-reenter button').click();
}
async function local(p){
 return p.evaluate(async dbName=>{
  const req=indexedDB.open(dbName),db=await new Promise((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const get=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
  try{
   const tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const [rows,photoKeys,photoBlobs,profile]=await Promise.all([
    get(tx.objectStore('mistakes').getAll()),
    get(tx.objectStore('photos').getAllKeys()),
    get(tx.objectStore('photos').getAll()),
    get(tx.objectStore('settings').get('profile'))]);
   return {rows:rows.sort((x,y)=>x.id.localeCompare(y.id)),profile,
    photos:await Promise.all(photoKeys.map(async(id,i)=>({
     id,mime:photoBlobs[i].type,
     bytes:Array.from(new Uint8Array(await photoBlobs[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 assert.equal((await register(A,PASSWORD_A)).status,201);
 assert.equal((await register(B,PASSWORD_A)).status,201);
 const aDeleteToken=await token(A,PASSWORD_A),bToken=await token(B,PASSWORD_A);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await open(context),errors=[],toC=[];
 page.on('pageerror',e=>errors.push('A '+e.message));
 page.on('request',req=>{
  if(req.url().startsWith(gate.baseUrl+'/qa/login')&&req.postData()?.includes(C))toC.push(req.url());
 });
 const port=new URL(gate.baseUrl).port;
 await login(page,port,A,PASSWORD_A);
 assert.equal(await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-family-v1')),A);
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('삭제 전 가상 A가 저장한 사진 문제');
 await page.locator('#choose-photo').setInputFiles({name:'a-only.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const row=(await local(page)).rows[0];
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record="'+row.id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();
 await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill('가상 아이 A의 답');
 await page.locator('#v230-explanation').fill('가상 아이 A만 쓴 상세 이유');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review-save')?.disabled===false);
 const original=await local(page);
 assert.equal(original.rows.length,1);
 assert.equal(original.photos.length,1);
 assert.equal(original.rows[0].generalRetryHistory[0].review,'needs_help');
 assert.equal(original.rows[0].generalRetryHistory[0].explanation,'가상 아이 A만 쓴 상세 이유');
 pass('동일 브라우저 프로필 A에 가상 오답·사진 바이트·아이 설명·부모 관찰 저장');

 const deleted=await call('/qa/family','DELETE',{
  familyKey:A,password:PASSWORD_A,approved:true,confirmation:'DELETE_SYNTHETIC_FAMILY'
 },aDeleteToken,0);
 assert.equal(deleted.status,200,JSON.stringify(deleted.body));
 assert.equal(deleted.body.deleted,true);
 assert.equal((await register(A,PASSWORD_A)).status,409);
 const reReg=await register(A,PASSWORD_C);
 assert.equal(reReg.status,409);
 assert.equal(reReg.body.error,'DELETED_FAMILY_KEY_RESERVED_IN_GATEWAY');
 assert.equal((await register(C,PASSWORD_C)).status,201);
 assert.equal((await call('/qa/snapshot','GET',undefined,aDeleteToken)).status,401);
 pass('서버 A 삭제·동일 이름 구/새 비밀번호 재등록 409, 별도 신규 C 등록 201');

 await page.locator('#nav-settings').click();
 await page.locator('#qa34-logout').click();
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 await reenter(page,port,C,PASSWORD_C);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답'),null,{timeout:10000});
 assert.equal(await page.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.equal(toC.length,0,'C credentials reached gateway from A-bound browser');
 assert.deepEqual(await local(page),original);
 assert.equal(await page.evaluate(()=>localStorage.getItem('qa34-synthetic-local-family-v1')),A);
 pass('A 로컬 로그아웃→같은 브라우저 C 연결은 네트워크 요청 전 거부·기록 화면 가림·A 원본 불변');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#qa34-family-privacy-cover:visible').waitFor();
 assert.equal(await page.locator('#qa-main').evaluate(el=>el.inert),true);
 await reenter(page,port,C,PASSWORD_C);
 await page.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답'));
 assert.equal(toC.length,0);
 assert.deepEqual(await local(page),original);
 pass('기존 브라우저 새로고침 뒤에도 C 재연결 거부·A 사진/관찰 로컬 원본 유지');

 const otherTab=await open(context,true);
 otherTab.on('pageerror',e=>errors.push('A2 '+e.message));
 await otherTab.locator('#qa34-family-privacy-cover:visible').waitFor();
 await reenter(otherTab,port,C,PASSWORD_C);
 await otherTab.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('다른 가상 가족의 오답'));
 assert.equal(await otherTab.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await local(otherTab),original);
 assert.equal(toC.length,0);
 pass('동일 브라우저 새 탭에서도 C에 이전 A 로컬 사진·관찰 재노출 없음');

 const separate=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const cPage=await open(separate);
 cPage.on('pageerror',e=>errors.push('C '+e.message));
 await login(cPage,port,C,PASSWORD_C);
 const empty=await local(cPage);
 assert.equal(empty.rows.length,0);assert.equal(empty.photos.length,0);
 const cT=await token(C,PASSWORD_C);
 const cServer=await call('/qa/snapshot','GET',undefined,cT);
 assert.equal(cServer.status,200);
 assert.equal(cServer.body.revision,0);
 assert.equal(cServer.body.snapshot,null);
 assert.equal((await call('/qa/snapshot','GET',undefined,bToken)).status,200);
 assert.deepEqual(await local(page),original);
 pass('독립 브라우저 C는 원장/사진 0건으로 정상 연결, B 서버 연결 유지, A 기록 혼입 없음');

 assert.deepEqual(errors,[]);
 pass('실제 Chromium A/C 프로필·같은 브라우저 2탭 JS 오류 0');
 console.log('WRONG_QA35_DELETED_A_C_BROWSER_RESULT='+JSON.stringify({status:'PASS',
  checks,chromium:true,localTabs:2,profiles:2,
  oldPhotoBytesPreserved:true,childExplanationAndParentReviewPreserved:true,
  crossFamilyLoginRequests:toC.length,realFamilyAuth:false,
  permanentErase:false,safeToRestore:false,deployment:false}));
 await separate.close();await context.close();
}catch(err){
 console.error('WRONG_QA35_DELETED_A_C_BROWSER_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1200),
  safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
