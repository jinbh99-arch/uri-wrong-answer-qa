// QA27 - two ISOLATED Chromium browser storage contexts, real app JSON backup
// from device A -> loopback encrypted snapshot gateway -> device B -> edit/add ->
// gateway -> device A. QA test-only manual transport; no cloud auto-sync.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readFile} from 'node:fs/promises';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const temp=mkdtempSync(join(tmpdir(),'qa27-device-')),dir=join(temp,'gateway.enc');
let gateway,browser,checks=0,errors=[];
const pass=(s)=>{checks++;console.log('PASS QA27 G15',s)};
const dataUrl=()=>gateway.baseUrl;
async function api(path,method='GET',data,token,revision){
 const headers={};
 if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 if(data!==undefined)headers['content-type']='application/json';
 const res=await fetch(dataUrl()+path,{method,headers,
  body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 return {status:res.status,json:await res.json(),etag:res.headers.get('etag')};
}
async function signIn(){
 const res=await api('/qa/login','POST',{familyKey:'qa-browser-family',password:'SYNTHETIC-NEVER-USE-REAL-LOGIN-2026'});
 assert.equal(res.status,200);
 return res.json.token;
}
async function state(page){
 return page.evaluate(async name=>{
  const o=indexedDB.open(name),db=await new Promise((ok,bad)=>{o.onsuccess=()=>ok(o.result);o.onerror=()=>bad(o.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const q=(s,m)=>new Promise((ok,bad)=>{const req=tx.objectStore(s)[m]();req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
   const [rows,keys,photos]=await Promise.all([q('mistakes','getAll'),q('photos','getAllKeys'),q('photos','getAll')]);
   return {rows:rows.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(keys.map(async (id,i)=>[id,{type:photos[i].type,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))}]))};
  }finally{db.close()}
 },DB);
}
async function exportBackup(page){
 await page.locator('#nav-settings').click();
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#export-json').click()]);
 const p=await download.path();
 const parsed=JSON.parse(await readFile(p,'utf8'));
 assert.equal(parsed.format,'uriaimath-offline-backup-v02');
 return parsed;
}
async function importBackup(page,doc){
 await page.locator('#nav-settings').click();
 await page.locator('#import-file').setInputFiles({
  name:'QA27-SYNTHETIC-ONLY.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(doc))
 });
 await page.locator('#confirm-dialog[open]').waitFor({timeout:35000});
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(count=>document.querySelector('#home-count')?.textContent===String(count)
  ||document.querySelector('#records-count')?.textContent?.includes('전체 '+count+'건'),doc.records.length,{timeout:30000});
}
async function add(page,problem,withPhoto=false){
 await page.locator('#nav-add').click();
 if(withPhoto){
  await page.locator('#choose-photo').setInputFiles({name:'qa27-fake.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 }
 await page.locator('#problem').fill(problem);
 await page.locator('#student-answer').fill('가상 답');
 await page.locator('#memo').fill('QA27 synthetic data only');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 process.env.QA_DURABLE_TEST_ONLY='1';
 const key=randomBytes(32).toString('hex');
 gateway=await createIsolatedQaFamilyGateway({durablePath:dir,encryptionKey:key});
 assert.equal((await api('/qa/register','POST',{familyKey:'qa-browser-family',password:'SYNTHETIC-NEVER-USE-REAL-LOGIN-2026'})).status,201);
 const tokenA=await signIn();
 browser=await chromium.launch({headless:true});
 // Separate browser contexts intentionally share neither IndexedDB nor cookies.
 const contextA=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const contextB=await browser.newContext({viewport:{width:320,height:750},acceptDownloads:true});
 const A=await contextA.newPage(),B=await contextB.newPage();
 for(const page of [A,B]){page.on('pageerror',e=>errors.push(String(e)));await page.goto(BASE,{waitUntil:'domcontentloaded'});}
 assert.equal((await state(A)).rows.length,0);
 assert.equal((await state(B)).rows.length,0);
 pass('390px와 320px 별도 Chromium 브라우저 저장소를 분리해 시작');
 await add(A,'QA27 가상 사진 문제 A',true);
 const beforeA=await state(A);
 assert.equal(beforeA.rows.length,1);
 assert.equal(beforeA.photos.length,1);
 const fullA=await exportBackup(A);
 assert.equal(fullA.records.length,1);
 assert.equal(Object.keys(fullA.photos).length,1);
 const put=await api('/qa/snapshot','PUT',fullA,tokenA,0);
 assert.equal(put.status,200,'App-produced backup rejected by G15 gateway: '+JSON.stringify(put.json));
 assert.equal(put.json.revision,1);
 assert.equal((await state(B)).rows.length,0);
 pass('실제 오답노트 A의 사진 포함 전체 JSON → 암호화 게이트웨이 리비전 1 업로드, B는 미변경');
 await gateway.shutdown();gateway=null;
 gateway=await createIsolatedQaFamilyGateway({durablePath:dir,encryptionKey:key});
 assert.equal((await api('/qa/snapshot','GET',undefined,tokenA)).status,401);
 const tokenB=await signIn();
 const get=await api('/qa/snapshot','GET',undefined,tokenB);
 assert.equal(get.status,200);
 assert.deepEqual(get.json.snapshot,fullA);
 await importBackup(B,get.json.snapshot);
 assert.deepEqual(await state(B),beforeA);
 pass('서버 재시작 후 다른 브라우저 B가 새로 로그인해 A의 사진 원본 바이트·기록을 복원');
 await add(B,'QA27 가상 두번째 문제 B');
 const stateB=await state(B);
 assert.equal(stateB.rows.length,2);
 const fullB=await exportBackup(B);
 assert.equal(fullB.records.length,2);
 assert.deepEqual(fullB.photos,fullA.photos);
 assert.equal((await api('/qa/snapshot','PUT',fullB,tokenB,0)).status,409);
 const putB=await api('/qa/snapshot','PUT',fullB,tokenB,1);
 assert.equal(putB.status,200,'B append-only backup rejected: '+JSON.stringify(putB.json));
 assert.equal(putB.json.revision,2);
 pass('B에서 새 문제 추가, 오래된 버전 쓰기 409 차단, 원본 사진 유지하며 최신본 2 저장');
 const aFresh=await signIn();
 const latest=await api('/qa/snapshot','GET',undefined,aFresh);
 assert.equal(latest.json.revision,2);
 await importBackup(A,latest.json.snapshot);
 assert.deepEqual(await state(A),stateB);
 await A.reload({waitUntil:'domcontentloaded'});
 assert.deepEqual(await state(A),stateB);
 assert.equal((await state(B)).rows.length,2);
 pass('A로 새로운 합성 오답 2개·사진을 안전하게 복원, 새로고침 후 보존');
 const unauthorized=await api('/qa/snapshot','GET');
 assert.equal(unauthorized.status,401);
 assert.deepEqual(errors,[]);
 pass('인증 없는 스냅샷 차단·두 독립 브라우저 오류 0');
 console.log('QA_G15_CROSS_CONTEXT_RESULT='+JSON.stringify({status:'PASS',checks,
  browserContexts:2,manualBackupTransport:true,actualWebAppRoundTrip:true,
  encryptedBackendRestart:true,realHostedCloud:false,autoSync:false,childrenRecords:0}));
}catch(err){
 console.error('QA_G15_CROSS_CONTEXT_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1200),errors}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gateway)await gateway.shutdown();
 rmSync(temp,{recursive:true,force:true});
}
