// QA15 G02 — full synthetic CRUD and stale edit/delete protections in two actual Chromium tabs.
// Public isolated QA only; no real child records, photos or operating Netlify service.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const a=await context.newPage(),errs=[],passed=[];
a.on('pageerror',e=>errs.push(String(e)));
let b;
function pass(name){passed.push(name);console.log('PASS QA15',name)}
async function snapshot(p=a){
 return p.evaluate(async name=>{
  const request=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{request.onsuccess=()=>res(request.result);request.onerror=()=>rej(request.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const req1=tx.objectStore('mistakes').getAll(),req2=tx.objectStore('photos').getAllKeys(),req3=tx.objectStore('photos').getAll();
   const got=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   const [rows,keys,blobs]=await Promise.all([got(req1),got(req2),got(req3)]);
   return {rows,photos:await Promise.all(keys.map(async(key,i)=>[key,{type:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))}]))};
  }finally{db.close()}
 },DB);
}
async function openRecord(p,needle){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').filter({hasText:needle}).first().click();
 await p.locator('#detail-delete').waitFor();
}
async function confirmDelete(p){
 await p.locator('#detail-delete').click();
 await p.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await p.locator('#dlg-ok').click();
}
try{
 await a.goto(BASE,{waitUntil:'domcontentloaded'});
 await a.locator('#nav-add').click();
 await a.locator('#choose-photo').setInputFiles({name:'qa15-synthetic.png',mimeType:'image/png',buffer:PNG});
 await a.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await a.locator('#problem').fill('QA15 가상 오답: A/B 동시 수정과 삭제');
 await a.locator('#student-answer').fill('가상 초기 답변');
 await a.locator('#memo').fill('최초');
 await a.locator('#save-btn').click();
 await a.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 let before=await snapshot();
 assert.equal(before.rows.length,1);
 assert.equal(before.photos.length,1);
 const id=before.rows[0].id,photoBefore=before.photos[0];
 assert.equal(photoBefore[0],id);
 pass('실제 UI 합성 오답/사진 신규 등록과 영구 저장');
 await a.reload();
 await openRecord(a,'QA15 가상 오답');
 assert.match(await a.locator('#detail-text').textContent(),/QA15/);
 assert.equal(await a.locator('#detail-memo').textContent(),'최초');
 pass('새로고침 후 상세 열람, 사진 저장');
 await a.locator('#detail-delete').click();
 await a.locator('#confirm-dialog[open]').waitFor();
 await a.locator('#dlg-cancel').click();
 assert.deepEqual(await snapshot(),before,'Cancellation must not delete');
 pass('삭제 확인창 취소 → 문항·사진 보존');
 b=await context.newPage();b.on('pageerror',e=>errs.push(String(e)));
 await b.goto(BASE,{waitUntil:'domcontentloaded'});
 await openRecord(b,'QA15 가상 오답');
 await b.locator('#detail-edit').click();
 await b.locator('#memo').fill('B 먼저 저장한 최신 메모');
 await b.locator('#save-btn').click();
 await b.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const bSaved=await snapshot(b);
 assert.equal(bSaved.rows[0].memo,'B 먼저 저장한 최신 메모');
 assert.deepEqual(bSaved.photos[0],photoBefore);
 pass('B의 사진 없는 텍스트 수정 후 기존 사진 바이트 유지');
 await confirmDelete(a);
 const afterStaleDelete=await snapshot(b);
 assert.equal(afterStaleDelete.rows.length,1,'A stale delete removed B record');
 assert.equal(afterStaleDelete.rows[0].memo,'B 먼저 저장한 최신 메모');
 assert.deepEqual(afterStaleDelete.photos[0],photoBefore);
 pass('A의 오래된 상세화면 삭제 차단 및 최신 기록/사진 보존');
 await a.reload();
 await openRecord(a,'QA15 가상 오답');
 await a.locator('#detail-edit').click();
 await a.locator('#memo').fill('A 오래된 수정 후 재생성 시도');
 await b.reload();
 await openRecord(b,'QA15 가상 오답');
 await confirmDelete(b);
 await b.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 0건'),null,{timeout:20000});
 assert.deepEqual((await snapshot(b)).photos,[],'Normal delete left orphan photo');
 pass('B 정상 삭제로 오답과 사진 함께 삭제');
 await a.locator('#save-btn').click();
 await a.waitForFunction(()=>!document.querySelector('#form-error')?.classList.contains('hide'),null,{timeout:20000});
 assert.match(await a.locator('#form-error').innerText(),/다른 탭|다른 화면|수정|삭제|덮어쓰기/);
 assert.deepEqual((await snapshot()).rows,[],'Stale edit resurrected deleted record');
 assert.deepEqual((await snapshot()).photos,[],'Stale edit resurrected deleted image');
 pass('B 삭제 후 A의 오래된 편집/재생성 차단');
 await a.reload();
 await a.locator('#nav-add').click();
 await a.locator('#problem').fill('QA15 두 번째 합성 문항, 사진 없음');
 await a.locator('#memo').fill('사진 없음');
 await a.locator('#save-btn').click();
 await a.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const plain=await snapshot();
 assert.equal(plain.rows.length,1);
 assert.equal(plain.photos.length,0);
 pass('사진 없이 신규 문항 저장');
 await openRecord(a,'QA15 두 번째');
 await confirmDelete(a);
 await a.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 0건'),null,{timeout:20000});
 assert.equal((await snapshot()).rows.length,0);
 assert.equal((await snapshot()).photos.length,0);
 pass('정상 사진 없는 문항 삭제 및 테스트 데이터 0건');
 assert.deepEqual(errs,[]);
 pass('실제 Chromium 브라우저 예외 없음');
 console.log('QA_G02_CRUD_RESULT='+JSON.stringify({status:'PASS',checks:passed.length,passed}));
}catch(err){
 console.error('QA_G02_CRUD_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),errs}));
 try{await a.screenshot({path:'qa15-crud-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
