import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4173/';
const DB = 'uriaimath-github-qa-v224-only';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=', 'base64');
const evidence = [];
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({acceptDownloads:true, viewport:{width:390,height:844}});
const a = await context.newPage();
const pageErrors=[];
a.on('pageerror', e=>pageErrors.push(String(e)));
function pass(name,details=''){evidence.push({name,status:'pass',details});console.log('PASS',name,details);}
async function inDb(page,store,key) {
  return await page.evaluate(async ({name,store,key}) => {
    const db = await new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    try {
      const tx=db.transaction([store],'readonly'),req=tx.objectStore(store).get(key);
      const val=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      if(val instanceof Blob){const ab=await val.arrayBuffer();return {kind:'blob',bytes:Array.from(new Uint8Array(ab)),type:val.type};}
      return val;
    } finally {db.close();}
  }, {name:DB,store,key});
}
async function count(page,n){
  await page.locator('#nav-records').click();
  await page.waitForFunction(expected=>document.querySelector('#records-count')?.textContent?.includes('전체 '+expected+'건'),n);
}
async function openRecord(page,needle){
  await count(page,1);
  await page.locator('#records-list button.item').filter({hasText:needle}).first().click();
  await page.locator('#detail-memo').waitFor();
}
try {
  await a.goto(BASE,{waitUntil:'domcontentloaded'});
  await a.locator('#nav-add').click();
  await a.locator('#choose-photo').setInputFiles({name:'synthetic-1px.png',mimeType:'image/png',buffer:png});
  await a.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
  await a.locator('#problem').fill('QA 합성 분수문항: 1/2+1/3은?');
  await a.locator('#student-answer').fill('2/5');
  await a.locator('#memo').fill('QA: 초기 메모');
  await a.locator('#concept').selectOption('math.fraction.add.diff_den');
  await a.locator('#save-btn').click();
  await a.waitForFunction(()=>document.querySelector('#v13-save-state')?.textContent?.includes('확인')||document.querySelector('#form-error')?.classList.contains('hide')===false,{timeout:20000});
  assert.equal(await a.locator('#form-error').isVisible(),false,'가상 사진 저장 오류');
  await count(a,1);
  const createdId=await a.locator('#records-list button.item').first().getAttribute('data-record');
  assert.ok(createdId);
  const beforeRecord=await inDb(a,'mistakes',createdId);
  const beforePhoto=await inDb(a,'photos',createdId);
  assert.equal(beforeRecord.hasPhoto,true);
  assert.equal(beforePhoto.kind,'blob');
  assert.ok(beforePhoto.bytes.length>10);
  pass('가상 사진 포함 UI 등록 및 IndexedDB 재읽기', '기록 1, 사진 '+beforePhoto.bytes.length+' bytes');

  await a.locator('#nav-settings').click();
  const [download] = await Promise.all([a.waitForEvent('download',{timeout:25000}),a.locator('#export-json').click()]);
  const path=await download.path();
  assert.ok(path,'다운로드된 JSON 파일 경로 없음');
  const data=JSON.parse(await readFile(path,'utf8'));
  assert.equal(data.format,'uriaimath-offline-backup-v02');
  assert.equal(data.records.length,1);
  assert.equal(Object.keys(data.photos).length,1);
  assert.ok(data.integrity && data.integrity.scheme==='v18-json-payload');
  pass('실제 UI JSON 다운로드','기록 1·사진 1·무결성 서명필드 존재');

  await a.locator('#v18-verify-file').setInputFiles(path);
  await a.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('구조 검사 통과'),null,{timeout:20000});
  pass('다운로드한 JSON 파일 독립 재업로드 검사');

  await a.locator('#clear-all').click();
  await a.locator('#confirm-dialog[open]').waitFor();
  await a.locator('#dlg-ok').click();
  await count(a,0);
  pass('합성 기록 전용 일괄 삭제');

  await a.locator('#nav-settings').click();
  await a.locator('#import-file').setInputFiles(path);
  await a.locator('#confirm-dialog[open]').waitFor({timeout:30000});
  await a.locator('#dlg-ok').click();
  await count(a,1);
  const afterRecord=await inDb(a,'mistakes',createdId);
  const afterPhoto=await inDb(a,'photos',createdId);
  assert.equal(afterRecord.problemText,beforeRecord.problemText);
  assert.equal(afterRecord.studentAnswer,beforeRecord.studentAnswer);
  assert.equal(afterRecord.memo,beforeRecord.memo);
  assert.deepEqual(afterPhoto.bytes,beforePhoto.bytes);
  pass('실제 앱 UI JSON 파일 복원과 사진 바이트 동일성','기록 1·사진 동일');

  await openRecord(a,'QA 합성 분수문항');
  await a.locator('#detail-edit').click();
  await a.locator('#memo').fill('A가 덮어쓰려는 과거 메모');
  const b=await context.newPage();
  b.on('pageerror',e=>pageErrors.push(String(e)));
  await b.goto(BASE,{waitUntil:'domcontentloaded'});
  await openRecord(b,'QA 합성 분수문항');
  await b.locator('#detail-edit').click();
  await b.locator('#memo').fill('B가 먼저 저장한 최신 메모');
  await b.locator('#save-btn').click();
  await b.waitForFunction(()=>document.querySelector('#v13-save-state')?.textContent?.includes('확인')||document.querySelector('#form-error')?.classList.contains('hide')===false,{timeout:20000});
  assert.equal(await b.locator('#form-error').isVisible(),false,'B 수정 저장 실패');
  await a.locator('#save-btn').click();
  await a.waitForFunction(()=>document.querySelector('#form-error') && !document.querySelector('#form-error').classList.contains('hide'),null,{timeout:20000});
  const msg=await a.locator('#form-error').innerText();
  assert.match(msg,/다른 탭|다른 화면|덮어쓰기|먼저 저장/);
  const latest=await inDb(b,'mistakes',createdId);
  assert.equal(latest.memo,'B가 먼저 저장한 최신 메모');
  const photoStill=await inDb(b,'photos',createdId);
  assert.deepEqual(photoStill.bytes,beforePhoto.bytes);
  pass('실제 크로미움 두 탭 편집 충돌 방지','이전 탭 저장 차단·B 메모와 사진 유지');
  await b.close();

  await a.reload();
  await a.locator('#nav-settings').click();
  await a.locator('#clear-all').click();
  await a.locator('#confirm-dialog[open]').waitFor();
  await a.locator('#dlg-ok').click();
  await count(a,0);
  pass('합성 기록 사후 정리', 'QA 저장소 0건');

  assert.deepEqual(pageErrors,[], '페이지 JavaScript 예외');
  pass('페이지 오류 없음');
  console.log('QA_E2E_RESULT='+JSON.stringify({status:'PASS',tests:evidence}));
} catch(err) {
  console.error('QA_E2E_RESULT='+JSON.stringify({status:'FAIL',passed:evidence,error:String(err),pageErrors}));
  try{await a.screenshot({path:'qa-e2e-failure.png',fullPage:true})}catch{}
  process.exitCode=1;
} finally {
  await browser.close();
}