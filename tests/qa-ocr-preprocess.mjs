import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// QA8 checks synthetic browser pixels, NOT third-party OCR accuracy or a physical phone.
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
await context.addInitScript(()=>{
 Object.defineProperty(window,'Tesseract',{configurable:true,value:{createWorker:async()=>({
  recognize:async(blob)=>{
   if(window.__qa8Throw)throw Error('QA8 simulated offline OCR error');
   const bmp=await createImageBitmap(blob),c=document.createElement('canvas');
   c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);
   const pixel=Array.from(c.getContext('2d').getImageData(5,5,1,1).data);
   window.__qa8Last={width:bmp.width,height:bmp.height,pixel,type:blob.type};
   bmp.close();
   return {data:{text:'2/3 + 1/3 = ?'}};
  },terminate:async()=>{}
 })}});
});
const page=await context.newPage();
const errors=[],passes=[];
page.on('pageerror',e=>errors.push(String(e)));
function pass(label){passes.push(label);console.log('PASS QA8',label);}
async function runOcr(){
 await page.locator('#ocr-run').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>document.querySelector('#ocr-preview')?.value==='2/3 + 1/3 = ?',null,{timeout:12000});
 return page.evaluate(()=>window.__qa8Last);
}
async function dbStatus(){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,fail)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error)});
  const tx=db.transaction(['mistakes','photos'],'readonly');
  const all=tx.objectStore('mistakes').getAll();
  const rows=await new Promise((ok,fail)=>{all.onsuccess=()=>ok(all.result);all.onerror=()=>fail(all.error)});
  if(!rows.length){db.close();return {rows};}
  const photo=tx.objectStore('photos').get(rows[0].id);
  const blob=await new Promise((ok,fail)=>{photo.onsuccess=()=>ok(photo.result);photo.onerror=()=>fail(photo.error)});
  db.close();
  const bmp=await createImageBitmap(blob);
  const result={rows,width:bmp.width,height:bmp.height};bmp.close();return result;
 });
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 const photoUri=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=80;c.height=40;
  const x=c.getContext('2d');x.fillStyle='#da2020';x.fillRect(0,0,80,40);
  x.fillStyle='#ffffff';x.fillRect(50,0,30,40);
  return c.toDataURL('image/png');
 });
 await page.locator('#v08-direct-file').setInputFiles({name:'synthetic-80x40.png',mimeType:'image/png',buffer:Buffer.from(photoUri.split(',')[1],'base64')});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 const original=await runOcr();
 assert.equal(original.width,80);assert.equal(original.height,40);
 assert.notEqual(original.pixel[0],original.pixel[1]);
 pass('원본 색상 모드 · 합성 80×40 사진의 방향과 색상 유지');
 await page.locator('#ocr-apply').click();
 await page.locator('#ocr-reviewed').check();
 await page.locator('#ocr-turn').selectOption('90');
 assert.equal(await page.locator('#ocr-preview').inputValue(),'');
 assert.equal(await page.locator('#ocr-reviewed').isChecked(),false);
 assert.equal(await page.locator('#problem').inputValue(),'2/3 + 1/3 = ?');
 pass('보정 설정 변경 시 이전 인식·검토 확인 해제, 기존 입력 문제 보존');
 const clockwise=await runOcr();
 assert.equal(clockwise.width,40);assert.equal(clockwise.height,80);
 pass('시계 방향 90° OCR용 이미지 회전');
 await page.locator('#ocr-enhance').selectOption('gray');
 assert.equal(await page.locator('#ocr-preview').inputValue(),'');
 const contrasted=await runOcr();
 assert.equal(contrasted.width,40);assert.equal(contrasted.height,80);
 assert.equal(contrasted.pixel[0],contrasted.pixel[1]);
 assert.equal(contrasted.pixel[1],contrasted.pixel[2]);
 pass('OCR용 회색·대비 강화 (RGB 회색값 일치)');
 await page.locator('#ocr-turn').selectOption('270');
 const other=await runOcr();
 assert.equal(other.width,40);assert.equal(other.height,80);
 pass('반시계 방향 90° OCR용 이미지 회전');
 assert.equal((await dbStatus()).rows.length,0);
 pass('OCR·보정만으로 새 기록을 자동 생성하지 않음');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const stored=await dbStatus();
 assert.equal(stored.rows.length,1);
 assert.equal(stored.width,80);assert.equal(stored.height,40);
 assert.equal(stored.rows[0].ocrStatus,'browser_ocr_unconfirmed');
 pass('원본 사진 80×40 보존 · 교정 뒤 확인 없는 OCR은 미확인으로 저장');
 await page.locator('#nav-add').click();
 await page.locator('#v08-direct-file').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:Buffer.from(photoUri.split(',')[1],'base64')});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.evaluate(()=>window.__qa8Throw=true);
 await page.locator('#ocr-run').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(()=>document.querySelector('#ocr-status')?.textContent?.includes('인식 실패'),null,{timeout:12000});
 assert.equal(await page.locator('#ocr-apply').isDisabled(),true);
 await page.locator('#problem').fill('OCR 오류 후 직접 입력');
 assert.equal(await page.locator('#problem').inputValue(),'OCR 오류 후 직접 입력');
 assert.equal((await dbStatus()).rows.length,1);
 pass('OCR 실패 시 기존 기록 변경 없이 직접 입력 가능');
 assert.deepEqual(errors,[]);
 console.log('QA8_RESULT='+JSON.stringify({status:'PASS',count:passes.length,passes}));
}catch(e){
 console.error('QA8_RESULT='+JSON.stringify({status:'FAIL',count:passes.length,passes,error:String(e),pageErrors:errors}));
 try{await page.screenshot({path:'qa-ocr-preprocess-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close();}
