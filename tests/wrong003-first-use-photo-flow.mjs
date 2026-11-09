// WRONG-003: real existing app, first-time flow + photo-only record completion.
// Synthetic 1px PNG and locally isolated browser DB only. No real child/Netlify/Supabase.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
let checks=0;
async function snapshot(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const read=q=>new Promise((ok,bad)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
   const [rows,keys,blobs]=await Promise.all([
    read(tx.objectStore('mistakes').getAll()),read(tx.objectStore('photos').getAllKeys()),read(tx.objectStore('photos').getAll())]);
   return {rows,photos:await Promise.all(keys.map(async(k,i)=>[k,{mime:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))}]))};
  }finally{db.close()}
 },DB);
}
async function wipeOnePhoto(p,id){
 await p.evaluate(async ({name,id})=>{
  const req=indexedDB.open(name),db=await new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
  try{await new Promise((ok,bad)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);tx.onabort=()=>bad(tx.error)})}finally{db.close()}
 },{name:DB,id});
}
function done(name,width){checks++;console.log('PASS WRONG003 '+width+'px '+name)}
async function run(width){
 const ctx=await browser.newContext({viewport:{width,height:850},acceptDownloads:true});
 const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 try{
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.locator('#wrong003-first-visit:visible').waitFor({timeout:20000});
  await p.locator('#nav-records').click();
  assert.equal(await p.locator('#wrong003-empty-start').isVisible(),true);
  await p.locator('#wrong003-empty-start').click();
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'problem');
  done('빈 목록 → 첫 글자 등록 이동',width);

  await p.locator('#problem').fill('WRONG003 기존 별도 가상 오답: 6 + 2 = ?');
  await p.locator('#save-btn').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
  const first=await snapshot(p),other=first.rows[0];
  assert.equal(first.rows.length,1);assert.equal(first.photos.length,0);
  await p.locator('#nav-home').click();
  assert.equal(await p.locator('#wrong003-first-visit').isVisible(),false);
  done('빈 상태 졸업·다른 오답 기준값 보존',width);

  await p.locator('#v08-home-add').click();
  await p.locator('#choose-photo').setInputFiles({name:'wrong003-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:20000});
  assert.equal(await p.locator('#problem').inputValue(),'');
  await p.locator('#v08-photo-save').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
  const saved=await snapshot(p);
  assert.equal(saved.rows.length,2);assert.equal(saved.photos.length,1);
  const photoRow=saved.rows.find(x=>x.hasPhoto),photoPair=saved.photos[0];
  assert.ok(photoRow);assert.equal(photoRow.problemText,'');
  assert.equal(photoPair[0],photoRow.id);
  assert.deepEqual(saved.rows.find(x=>x.id===other.id),other);
  done('사진만 저장·별도 오답 비침범·원본 확보',width);

  await p.locator('#wrong003-complete-photo').waitFor({timeout:20000});
  assert.match(await p.locator('#wrong002-state').textContent(),/저장된 오답 1건/);
  await p.locator('#v218-child-mode').click();
  assert.equal(await p.locator('#wrong003-complete-photo').isVisible(),false);
  assert.equal(await p.locator('#wrong002-retry').isVisible(),true);
  await p.locator('#v218-parent-mode').click();
  await p.locator('#wrong003-complete-photo').click();
  assert.equal(await p.locator('#edit-id').inputValue(),photoRow.id);
  await p.locator('#wrong003-photo-edit-guide:visible').waitFor();
  await p.locator('#v13-old-photo img').waitFor({timeout:20000});
  await p.locator('#wrong003-view-existing').click();
  await p.locator('#wrong003-write-details').click();
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'problem');
  done('사진 보존 미리보기·부모/아이 화면 구분·같은 ID 수정',width);

  await p.locator('#problem').fill('WRONG003 사진에서 보호자가 보완한 가상 문제: 5 + 3 = ?');
  await p.locator('#student-answer').fill('가상 오답 7');
  await p.locator('#concept').selectOption('math.natural.addition');
  await p.locator('#save-btn').click();
  await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
  const edited=await snapshot(p);
  assert.equal(edited.rows.length,2);
  assert.equal(edited.rows.find(x=>x.id===photoRow.id).problemText,'WRONG003 사진에서 보호자가 보완한 가상 문제: 5 + 3 = ?');
  assert.deepEqual(edited.photos,[photoPair]);
  assert.deepEqual(edited.rows.find(x=>x.id===other.id),other);
  done('사진 바이트·기존 ID 유지하며 글자·개념 보완',width);

  await p.locator('#wrong002-retry').click();
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'v230-answer');
  await p.locator('#v230-answer').fill('8');
  await p.locator('#v230-save').click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
  await p.locator('#wrong002-plan').click();
  await p.locator('#v05-plan-date').fill('2026-11-13');
  await p.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('2026-11-13'),null,{timeout:25000});
  await p.locator('#wrong002-outcome').click();
  await p.locator('#v06-review-outcome').selectOption('explained');
  await p.locator('#v06-review-memo').fill('가상 학부모 관찰: 스스로 설명하기');
  await p.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
  await p.locator('#wrong002-report').click();
  assert.equal(await p.locator('#v227-parent-report').isVisible(),true);
  done('사진 오답의 재풀이→부모계획→관찰→보고서',width);

  const completed=await snapshot(p);
  assert.deepEqual(completed.photos,[photoPair]);
  assert.deepEqual(completed.rows.find(x=>x.id===other.id),other);
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('#nav-records').click();
  await p.locator('#records-list button.item').filter({hasText:'WRONG003 사진에서'}).first().click();
  await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
  const reread=await snapshot(p);
  assert.deepEqual(reread,completed);
  done('재접속 후 같은 ID와 전체 사진·복습 기록 완전 보존',width);

  // Synthetic damaged-photo simulation: do not partially write metadata over a missing photo.
  await wipeOnePhoto(p,photoRow.id);
  const missing=await snapshot(p);
  await p.locator('#detail-edit').click();
  await p.locator('#memo').fill('WRONG003 손상된 사진으로 잘못 수정 시도');
  await p.locator('#save-btn').click();
  await p.waitForFunction(()=>!document.querySelector('#form-error')?.classList.contains('hide'),null,{timeout:20000});
  assert.match(await p.locator('#form-error').innerText(),/기존 사진|사진을 읽을 수 없어/);
  assert.deepEqual((await snapshot(p)).rows,missing.rows);
  assert.deepEqual((await snapshot(p)).photos,missing.photos);
  done('기존 사진 누락 시 데이터 수정 사전 차단',width);

  assert.deepEqual(errors,[]);
  const dims=await p.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.viewport+2,'horizontal overflow on '+width);
  done('브라우저 예외 및 모바일 가로 넘침 없음',width);
 }finally{await ctx.close()}
}
try{
 for(const width of [320,390])await run(width);
 console.log('WRONG003_CORE_PHOTO_RESULT='+JSON.stringify({status:'PASS',checks,mobileViews:2,syntheticPhotos:true,realChildren:0,operatingDeployment:false,productionApproved:false}));
}catch(e){console.error('WRONG003_CORE_PHOTO_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,900)}));process.exitCode=1}
finally{await browser.close()}
