import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
const page=await context.newPage();
let checks=0;
const problems=[];
page.on('pageerror',error=>problems.push(String(error)));
const pass=(message)=>{checks++;console.log('PASS QA10',message)};
async function rows(p=page){
 return await p.evaluate(async name=>{
  const request=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{request.onsuccess=()=>res(request.result);request.onerror=()=>rej(request.error)});
  try{
   const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   return await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
  }finally{db.close()}
 },DB);
}
async function photo(p,id){
 return await p.evaluate(async ({name,id})=>{
  const req=indexedDB.open(name),db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const q=db.transaction('photos','readonly').objectStore('photos').get(id);
   const value=await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
   if(!(value instanceof Blob))return null;
   return {type:value.type,bytes:Array.from(new Uint8Array(await value.arrayBuffer()))};
  }finally{db.close()}
 },{name:DB,id});
}
async function selectRecord(p,text){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').filter({hasText:text}).first().click();
 await p.locator('#detail-text').waitFor();
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('시범 문제: 다음 삼각형의 직각을 찾아 설명하세요.');
 await page.locator('#student-answer').fill('모르겠어요');
 await page.locator('#memo').fill('QA10 가상 수학 문항');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 assert.equal(await page.locator('.v230-general').isVisible(),true);
 assert.equal(await page.locator('#v230-save').isVisible(),true);
 pass('지원하지 않던 일반 문제에서 재풀이 입력 화면 생성');

 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v230-save').isVisible(),true);
 await page.locator('#v230-answer').fill('직각은 90도인 각이에요.');
 await page.locator('#v230-explanation').fill('정사각형 모서리와 비교했어요.');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'),null,{timeout:20000});
 const first=(await rows()).find(r=>r.problemText.startsWith('시범 문제:'));
 assert.ok(first);
 assert.equal(first.generalRetryHistory.length,1);
 assert.equal(first.generalRetryHistory[0].answer,'직각은 90도인 각이에요.');
 assert.equal(first.generalRetryHistory[0].review,'not_checked');
 assert.equal(await page.locator('.v230-parent-review').isVisible(),false);
 pass('아이 화면 일반 답·설명 IndexedDB 저장 및 부모 관리 버튼 숨김');

 await page.reload();
 await selectRecord(page,'시범 문제:');
 assert.equal(await page.locator('.v230-history summary').count(),1);
 await page.locator('.v230-history summary').click();
 assert.match(await page.locator('.v230-history').innerText(),/직각은 90도/);
 pass('새로고침 후 일반 재풀이 이력 유지');

 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='explained'&&
  document.querySelector('.v230-history')?.textContent?.includes('스스로 설명'),null,{timeout:20000});
 const reviewed=(await rows()).find(r=>r.id===first.id);
 assert.equal(reviewed.generalRetryHistory[0].review,'explained');
 assert.ok(reviewed.generalRetryHistory[0].reviewedAt);
 pass('학부모 관찰을 수동 확인으로 추가, 자동 채점 없음');

 await page.locator('#detail-edit').click();
 await page.locator('#memo').fill('QA10 편집 후에도 기존 재풀이 유지');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const edited=(await rows()).find(r=>r.id===first.id);
 assert.deepEqual(edited.generalRetryHistory,reviewed.generalRetryHistory);
 pass('기존 기록을 수정해도 재풀이·학부모 관찰 이력이 유지됨');

 await page.locator('#nav-add').click();
 await page.locator('#choose-photo').setInputFiles({name:'qa10-synthetic.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await page.locator('#memo').fill('사진만 등록하는 QA10 합성 자료');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const photoRecord=(await rows()).find(r=>r.memo.includes('사진만 등록하는'));
 assert.ok(photoRecord&&photoRecord.hasPhoto);
 const photoBefore=await photo(page,photoRecord.id);
 assert.ok(photoBefore&&photoBefore.bytes.length>10);
 assert.equal(await page.locator('.v230-general').isVisible(),true);
 await page.locator('#v230-answer').fill('사진을 보고 다시 풀었습니다.');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'),null,{timeout:20000});
 const photoAfter=await photo(page,photoRecord.id);
 assert.deepEqual(photoAfter,photoBefore);
 assert.equal((await rows()).find(r=>r.id===photoRecord.id).generalRetryHistory.length,1);
 pass('사진만 있는 오답도 재풀이 저장 가능, 사진 바이트 동일');

 // Two real Chromium tabs must not overwrite a newer attempt.
 const other=await context.newPage();
 other.on('pageerror',error=>problems.push(String(error)));
 await other.goto(BASE,{waitUntil:'domcontentloaded'});
 await selectRecord(other,'시범 문제:');
 await selectRecord(page,'시범 문제:');
 await page.locator('#v230-answer').fill('A의 오래된 초안');
 await other.locator('#v230-answer').fill('B가 먼저 저장');
 await other.locator('#v230-save').click();
 await other.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('2회'),null,{timeout:20000});
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-status')?.textContent?.includes('다른 탭'),null,{timeout:20000});
 const afterConflict=(await rows(other)).find(r=>r.id===first.id);
 assert.equal(afterConflict.generalRetryHistory.length,2);
 assert.equal(afterConflict.generalRetryHistory[1].answer,'B가 먼저 저장');
 assert.deepEqual(await photo(page,photoRecord.id),photoBefore);
 pass('두 탭 동시 재풀이에서 오래된 입력 차단과 사진 보존');
 await other.close();

 await page.reload();
 await page.locator('#nav-settings').click();
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:30000}),page.locator('#export-json').click()
 ]);
 const path=await download.path();
 const json=JSON.parse(await readFile(path,'utf8'));
 assert.equal(json.format,'uriaimath-offline-backup-v02');
 assert.equal(json.records.length,2);
 assert.ok(json.records.find(r=>r.id===first.id).generalRetryHistory.length===2);
 assert.ok(json.records.find(r=>r.id===photoRecord.id).generalRetryHistory.length===1);
 assert.ok(json.photos[photoRecord.id]);
 pass('일반 재풀이와 합성 사진을 포함한 JSON 전체 백업 생성');

 // Even a recomputed checksum must not authorize an invalid manual review value.
 const changed=structuredClone(json);
 changed.records.find(r=>r.id===first.id).generalRetryHistory[0].review='auto_grading_pass';
 const without=structuredClone(changed);delete without.integrity;
 changed.integrity.digest=createHash('sha256').update(JSON.stringify(without)).digest('hex');
 await page.locator('#v18-verify-file').setInputFiles({
  name:'qa10-invalid-general.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))
 });
 await page.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('검사 실패'),null,{timeout:20000});
 assert.deepEqual((await rows()).find(r=>r.id===first.id).generalRetryHistory,afterConflict.generalRetryHistory);
 pass('무결성 값을 다시 만든 잘못된 자동 채점 기록도 복원 전 차단');

 await page.locator('#v18-verify-file').setInputFiles(path);
 await page.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('복원 호환 사전검사 통과'),null,{timeout:20000});
 pass('정상 v2.30 JSON 백업의 사전 복원 호환검사');

 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise(resolve=>{req.onsuccess=()=>resolve(req.result)});
  const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
  const count=await new Promise(resolve=>{q.onsuccess=()=>resolve(q.result)});
  db.close();return count===0;
 },DB,{timeout:20000});
 await page.locator('#nav-settings').click();
 await page.locator('#import-file').setInputFiles(path);
 await page.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 2건') ||
  document.querySelector('#home-count')?.textContent==='2',null,{timeout:30000});
 const restored=await rows();
 assert.equal(restored.length,2);
 assert.deepEqual(restored.find(r=>r.id===first.id).generalRetryHistory,afterConflict.generalRetryHistory);
 assert.deepEqual(restored.find(r=>r.id===photoRecord.id).generalRetryHistory,
  json.records.find(r=>r.id===photoRecord.id).generalRetryHistory);
 assert.deepEqual(await photo(page,photoRecord.id),photoBefore);
 pass('앱 실제 가져오기 UI에서 일반 재풀이·부모 관찰·원본 사진 복원 후 동일성');

 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(async name=>{
  const req=indexedDB.open(name);
  const database=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const q=database.transaction('mistakes','readonly').objectStore('mistakes').count();
   return await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result===0);q.onerror=()=>rej(q.error)});
  }finally{database.close()}
 },DB,{timeout:20000});
 assert.equal((await rows()).length,0);
 pass('시험용 로컬 데이터 정리 및 기존 기록 0건 확인');
 assert.deepEqual(problems,[]);
 pass('브라우저 페이지 JavaScript 오류 없음');
 console.log('QA10_RESULT='+JSON.stringify({status:'PASS',checks}));
}catch(err){
 console.error('QA10_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(err),pageErrors:problems}));
 try{await page.screenshot({path:'qa-general-retry-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
