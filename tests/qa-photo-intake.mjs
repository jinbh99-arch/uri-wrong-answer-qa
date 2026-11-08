// QA21 G01: bounded QA photo intake technical acceptance. Fake 1px PNG ONLY.
// Camera input is emulated file selection: not a real Android/iOS camera test.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only',PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
const p=await ctx.newPage(),checks=[],errors=[];
p.on('pageerror',e=>errors.push(String(e)));
const pass=(s)=>{checks.push(s);console.log('PASS QA21 G01 '+s)};
async function state(){
 return p.evaluate(async name=>{
  const o=indexedDB.open(name),db=await new Promise((ok,bad)=>{o.onsuccess=()=>ok(o.result);o.onerror=()=>bad(o.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const req=(store,kind)=>new Promise((ok,bad)=>{const q=tx.objectStore(store)[kind]();q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
   const [rows,keys,images]=await Promise.all([req('mistakes','getAll'),req('photos','getAllKeys'),req('photos','getAll')]);
   const photos=await Promise.all(keys.map(async (key,i)=>[key,{mime:images[i].type,bytes:Array.from(new Uint8Array(await images[i].arrayBuffer()))}]));
   return {rows,photos};
  }finally{db.close()}
 },DB);
}
try{
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-add').click();
 assert.equal(await p.locator('#take-photo').getAttribute('accept'),'image/*');
 assert.equal(await p.locator('#take-photo').getAttribute('capture'),'environment');
 assert.equal(await p.locator('#choose-photo').getAttribute('accept'),'image/*');
 assert.equal(await p.locator('#v08-direct-file').getAttribute('aria-label'),'문제 사진 직접 선택');
 pass('카메라 촬영·갤러리·직접 파일 선택 세 경로 및 접근성 이름 확인');
 for(const w of [320,390,768]){
  await p.setViewportSize({width:w,height:820});
  const size=await p.evaluate(()=>({window:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.window+2,'horizontal overflow at '+w);
 }
 pass('320·390·768px에서 사진 등록 영역 가로 넘침 없음');
 await p.locator('#v08-direct-file').setInputFiles({name:'not-an-image.bin',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});
 assert.equal(await p.locator('#ocr-run').isDisabled(),true);
 assert.equal((await state()).rows.length,0);
 assert.equal((await state()).photos.length,0);
 pass('이미지 아닌 MIME 거부, 저장소 무변경');
 await p.locator('#v08-direct-file').setInputFiles({name:'big-image.png',mimeType:'image/png',buffer:Buffer.alloc(8*1024*1024+1)});
 assert.equal(await p.locator('#ocr-run').isDisabled(),true);
 assert.equal((await state()).rows.length,0);
 pass('8MiB 초과 가상 이미지 차단');
 await p.locator('#take-photo').setInputFiles({name:'qa21-photo.png',mimeType:'image/png',buffer:PNG});
 await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 assert.equal(await p.locator('#ocr-run').isEnabled(),true);
 assert.equal(await p.locator('#ocr-reviewed').isChecked(),false);
 assert.equal((await state()).rows.length,0);
 pass('가상 카메라 선택 직후 미리보기, OCR 미검토 상태·자동저장 금지');
 await p.locator('#memo').fill('QA21 합성 사진만');
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const saved=await state();
 assert.equal(saved.rows.length,1);
 assert.equal(saved.photos.length,1);
 assert.equal(saved.rows[0].hasPhoto,true);
 assert.equal(saved.rows[0].problemText,'');
 assert.ok(saved.photos[0][1].bytes.length>20);
 const savedPhoto=structuredClone(saved.photos[0]);
 pass('문제 글자 없이 사진만 오답 저장, IndexedDB 이미지 바이트 검증');
 await p.reload({waitUntil:'domcontentloaded'});
 const reread=await state();
 assert.deepEqual(reread.photos,[savedPhoto]);
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').first().click();
 assert.equal(await p.locator('#page-detail').isVisible(),true);
 pass('새로고침 후 사진만 기록·바이트 유지, 상세 화면 진입');
 await p.locator('#nav-settings').click();
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.locator('#export-json').click()]);
 const backupPath=await download.path(),backup=JSON.parse(await readFile(backupPath,'utf8'));
 assert.equal(backup.records.length,1);
 assert.ok(backup.photos[saved.rows[0].id]);
 pass('전체 JSON 백업에 원본 사진 + 해당 기록 ID 동시 포함');
 await p.locator('#clear-all').click();
 await p.locator('#confirm-dialog[open]').waitFor();
 await p.locator('#dlg-ok').click();
 await p.locator('#page-home:visible').waitFor({timeout:20000});
 await p.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.equal((await state()).photos.length,0);
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles(backupPath);
 await p.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 await p.locator('#dlg-ok').click();
 await p.locator('#nav-records').click();
 await p.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 1건'),null,{timeout:25000});
 assert.deepEqual(await state(),saved,'Photo-only restore changed stored bytes');
 pass('사진만 기록 전체 삭제→실제 UI 복원→기록·사진 바이트 완전 동일');
 await p.locator('#nav-settings').click();
 await p.locator('#clear-all').click();await p.locator('#confirm-dialog[open]').waitFor();
 await p.locator('#dlg-ok').click();await p.locator('#page-home:visible').waitFor({timeout:20000});
 await p.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.equal((await state()).rows.length,0);
 assert.equal((await state()).photos.length,0);
 assert.deepEqual(errors,[]);
 pass('가상 사진·기록 0건으로 정리, 페이지 오류 없음');
 console.log('QA21_G01_RESULT='+JSON.stringify({status:'PASS',checks:checks.length,details:checks,limit:'fake camera file; no physical camera access, permissions, or long-term storage proof'}));
}catch(err){
 console.error('QA21_G01_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1000),errors}));
 try{await p.screenshot({path:'qa21-photo-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
