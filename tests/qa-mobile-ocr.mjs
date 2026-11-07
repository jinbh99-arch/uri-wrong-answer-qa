import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:4173/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({headless:true});
const checks=[],errors=[];
function passed(name,details=''){checks.push({name,details});console.log('PASS MOBILE',name,details);}
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});
await context.addInitScript(()=>{
  // TEST DOUBLE — deliberately not a real OCR accuracy or third-party network test.
  Object.defineProperty(window,'Tesseract',{configurable:true,value:{createWorker:async (langs)=>{
    if(!Array.isArray(langs)||langs.join(',')!=='kor,eng')throw Error('Unexpected OCR language choice');
    return {recognize:async(blob)=>{
      if(!(blob instanceof Blob)||blob.size<=0)throw Error('Image blob missing');
      return {data:{text:'1/2 + 1/3 = ?'}};
    },terminate:async()=>{}};
  }}});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
async function openDbRead(store,key){
  return page.evaluate(async({store,key})=>{
    const req=indexedDB.open('uriaimath-github-qa-v224-only');
    const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
    const tx=db.transaction(store,'readonly');
    const q=tx.objectStore(store).get(key);
    try{return await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}finally{db.close()}
  },{store,key});
}
async function listRecords(count){
  await page.locator('#nav-records').click();
  await page.waitForFunction(n=>document.querySelector('#records-count')?.textContent?.includes('전체 '+n+'건'),count);
}
async function test390(){
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  assert.equal(horizontal,false,'390px 화면 가로 넘침');
  passed('390px 모바일 에뮬레이션 가로 넘침 없음');
  await page.locator('#nav-add').click();
  assert.equal(await page.locator('#take-photo').getAttribute('capture'),'environment');
  assert.equal(await page.locator('#take-photo').getAttribute('accept'),'image/*');
  await page.locator('#take-photo').setInputFiles({name:'test-photo.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:10000});
  assert.equal(await page.locator('#ocr-run').isEnabled(),true);
  passed('카메라 capture 속성·가상 사진 선택·미리보기', '실제 물리 카메라 동작 아님');
  await page.locator('#problem').fill('이전에 직접 입력한 문제를 지우면 안 됨');
  await page.locator('#ocr-run').click();
  await page.locator('#confirm-dialog[open]').waitFor();
  await page.locator('#dlg-ok').click();
  await page.waitForFunction(()=>document.querySelector('#ocr-preview')?.value==='1/2 + 1/3 = ?',null,{timeout:12000});
  assert.equal(await page.locator('#ocr-replace').isEnabled(),true);
  assert.equal(await page.locator('#ocr-reviewed').isDisabled(),true);
  await page.locator('#ocr-preview').fill('1/2 + 1/3 을 계산하세요.');
  await page.locator('#ocr-replace').click();
  await page.locator('#confirm-dialog[open]').waitFor();
  await page.locator('#dlg-cancel').click();
  assert.equal(await page.locator('#problem').inputValue(),'이전에 직접 입력한 문제를 지우면 안 됨');
  await page.locator('#ocr-replace').click();
  await page.locator('#confirm-dialog[open]').waitFor();
  await page.locator('#dlg-ok').click();
  assert.equal(await page.locator('#problem').inputValue(),'1/2 + 1/3 을 계산하세요.');
  assert.equal(await page.locator('#ocr-reviewed').isEnabled(),true);
  assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
  passed('동의 후 OCR mock 초안·부모 검토·교체 취소·승인', '인식률/외부 CDN 검증 아님');
  await page.locator('#student-answer').fill('2/5');
  await page.locator('#ocr-reviewed').check();
  await page.locator('#save-btn').click();
  await page.waitForFunction(()=>document.querySelector('#v13-save-state')?.textContent?.includes('확인'),null,{timeout:20000});
  await listRecords(1);
  const id=await page.locator('#records-list button.item').first().getAttribute('data-record');
  const rec=await openDbRead('mistakes',id);
  assert.equal(rec.ocrStatus,'browser_ocr_reviewed');
  assert.equal(rec.studentAnswer,'2/5');
  assert.equal(rec.hasPhoto,true);
  passed('OCR 초안 부모 확인 후 기록 저장','OCR 검토상태만 기록, 자동 진단 없음');

  // Editing with a new image must invalidate the previous OCR confirmation.
  await page.locator('#records-list button.item').first().click();
  await page.locator('#detail-edit').click();
  await page.locator('#choose-photo').setInputFiles({name:'new-photo.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
  const after=await openDbRead('mistakes',id);
  assert.notEqual(after.ocrStatus,'browser_ocr_reviewed','사진 변경 후 검증 완료로 남으면 안 됨');
  passed('사진 변경 시 이전 OCR 확인 상태 무효화','기존 기록 ID 유지');
  await page.locator('#nav-settings').click();
  await page.locator('#clear-all').click();
  await page.locator('#confirm-dialog[open]').waitFor();
  await page.locator('#dlg-ok').click();
  await listRecords(0);
  passed('합성 데이터 삭제 후 0건');
}
async function test320(){
  await page.setViewportSize({width:320,height:720});
  await page.locator('#nav-add').click();
  const wide=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  assert.equal(wide,false,'320px 화면 가로 넘침');
  // File size and MIME validation — no browser OCR or real photo upload.
  await page.locator('#v08-direct-file').setInputFiles({name:'invalid.bin',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});
  assert.equal(await page.locator('#ocr-run').isDisabled(),true);
  await page.locator('#v08-direct-file').setInputFiles({name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(8*1024*1024+1)});
  assert.equal(await page.locator('#ocr-run').isDisabled(),true);
  await page.locator('#v08-direct-file').setInputFiles({name:'valid.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:10000});
  assert.equal(await page.locator('#ocr-run').isEnabled(),true);
  passed('320px 모바일 에뮬레이션과 파일 MIME·8MB 제한','잘못된 첨부는 OCR 비활성화');
}
try{
  await test390();
  await test320();
  assert.deepEqual(errors,[]);
  passed('JS 페이지 예외 없음');
  console.log('QA_MOBILE_RESULT='+JSON.stringify({status:'PASS',checks}));
}catch(e){
  console.error('QA_MOBILE_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),pageErrors:errors}));
  try{await page.screenshot({path:'qa-mobile-failure.png',fullPage:true})}catch{}
  process.exitCode=1;
}finally{await browser.close()}
