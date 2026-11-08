// QA16 G13 — public isolated QA only, simulated mobile camera and offline OCR.
// Verifies accessibility navigation, five responsive widths, opt-out, fallback and persistence.
// Does NOT test physical iOS/Android camera permissions, OCR accuracy, or external OCR delivery.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await ctx.addInitScript(()=>{
  window.__qa16WorkerCalls=0;
  Object.defineProperty(window,'Tesseract',{configurable:true,value:{createWorker:async()=>{
    window.__qa16WorkerCalls++;
    throw Error('QA16 intentional OCR/offline test failure');
  }}});
});
const page=await ctx.newPage(),exceptions=[],passed=[];
page.on('pageerror',err=>exceptions.push(String(err)));
const pass=msg=>{passed.push(msg);console.log('PASS QA16',msg)};
async function countDB(){
 return await page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const records=tx.objectStore('mistakes').getAll();
   const keys=tx.objectStore('photos').getAllKeys();
   const [rows,photos]=await Promise.all([records,keys].map(r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})));
   return {rows,photos};
  }finally{db.close()}
 });
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 // Keyboard skip is first, visible only on focus and points at the real main landmark.
 const skip=page.locator('.qa16-skip');
 assert.equal(await skip.count(),1);
 await page.keyboard.press('Tab');
 assert.equal(await skip.evaluate(el=>document.activeElement===el),true,'First tab must reach skip link');
 assert.ok((await skip.boundingBox())?.y>=0,'Focused skip must become visible');
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('#qa-main').evaluate(el=>document.activeElement===el),true,'Skip link must move keyboard focus into main');
 pass('키보드 첫 Tab → 본문 바로가기 표시 → Enter로 main 초점 이동');
 await page.locator('#nav-concepts').focus();
 await page.keyboard.press('Enter');
 await page.locator('#page-concepts:visible').waitFor();
 assert.equal(await page.locator('#nav-concepts').getAttribute('aria-current'),'page');
 pass('메뉴 키보드 Enter 경로와 aria-current 반영');
 for (const width of [320,360,390,768,1024]){
  await page.setViewportSize({width,height:844});
  for(const [id,section] of [['nav-home','page-home'],['nav-add','page-add'],['nav-records','page-records'],['nav-concepts','page-concepts'],['nav-settings','page-settings']]){
   await page.locator('#'+id).click();
   await page.locator('#'+section+':visible').waitFor({timeout:10000});
   const dim=await page.evaluate(()=>({screen:innerWidth,content:document.documentElement.scrollWidth}));
   assert.ok(dim.content<=dim.screen+2, width+'px '+id+' horizontal overflow '+JSON.stringify(dim));
  }
  const start=page.locator('#nav-home');
  await start.click();
  const btn=page.locator('#v08-home-add');
  const box=await btn.boundingBox();
  assert.ok(box?.width>=140&&box?.height>=38,'Main action target too small at '+width);
  assert.ok(box.x>=-1&&box.x+box.width<=width+2,'Main action off screen '+width);
 }
 pass('320·360·390·768·1024px × 주요 5개 화면 가로 잘림 없음, 핵심 CTA 크기/위치');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#nav-add').click();
 const labeled=await page.locator('label[for="problem"]').count();
 assert.equal(labeled,1);
 assert.equal(await page.locator('#v08-direct-file').getAttribute('aria-label'),'문제 사진 직접 선택');
 assert.equal(await page.locator('#ocr-status').getAttribute('role'),'status');
 assert.equal(await page.locator('#form-error').getAttribute('role'),'alert');
 pass('수동 입력·사진 직접 선택에 이름, OCR 상태/오류 알림 역할 확인');
 assert.equal(await page.locator('#take-photo').getAttribute('capture'),'environment');
 assert.equal(await page.locator('#ocr-run').isDisabled(),true);
 await page.locator('#problem').fill('QA16 가상 문제: 3+4의 계산 원리를 설명하시오');
 await page.locator('#student-answer').fill('7');
 await page.locator('#v08-direct-file').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:10000});
 assert.equal(await page.locator('#ocr-run').isEnabled(),true);
 assert.equal(await page.evaluate(()=>window.__qa16WorkerCalls),0);
 pass('합성 사진 선택까지만으로 OCR 호출/원격 처리 시작하지 않음');
 await page.locator('#ocr-run').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-cancel').click();
 assert.equal(await page.evaluate(()=>window.__qa16WorkerCalls),0);
 assert.equal(await page.locator('#problem').inputValue(),'QA16 가상 문제: 3+4의 계산 원리를 설명하시오');
 pass('OCR 동의 취소 시 기존 수기 입력 보존·OCR 실행 없음');
 await page.locator('#ocr-run').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>document.querySelector('#ocr-status')?.textContent?.includes('인식 실패'),null,{timeout:15000});
 assert.equal(await page.locator('#problem').inputValue(),'QA16 가상 문제: 3+4의 계산 원리를 설명하시오');
 assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
 assert.equal(await page.locator('#ocr-apply').isDisabled(),true);
 assert.ok((await page.evaluate(()=>window.__qa16WorkerCalls))>=1);
 pass('OCR 의도적 실패 → 기존 수기 문제 보존, 검토/자동채점 승인 없음');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 let stored=await countDB();
 assert.equal(stored.rows.length,1);
 assert.equal(stored.photos.length,1);
 assert.equal(stored.rows[0].problemText,'QA16 가상 문제: 3+4의 계산 원리를 설명하시오');
 assert.notEqual(stored.rows[0].ocrStatus,'browser_ocr_reviewed');
 pass('OCR 실패해도 사진+수기 답안 저장, OCR 검증완료 오표기 금지');
 await page.reload({waitUntil:'domcontentloaded'});
 stored=await countDB();
 assert.equal(stored.rows.length,1);
 assert.equal(stored.photos.length,1);
 pass('새로고침 후 수기 문제·사진 보존');
 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home:visible').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 stored=await countDB();
 assert.equal(stored.rows.length,0);
 assert.equal(stored.photos.length,0);
 assert.deepEqual(exceptions,[]);
 pass('격리 가상 자료 0건 정리 및 브라우저 오류 없음');
 console.log('QA_G13_MOBILE_RESULT='+JSON.stringify({status:'PASS',checks:passed.length,viewports:5,screenRoutes:25,passed,
  limitation:'Emulation/OCR test double; NOT physical device, OCR accuracy, or education review'}));
}catch(err){
 console.error('QA_G13_MOBILE_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),exceptions}));
 try{await page.screenshot({path:'qa16-mobile-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
