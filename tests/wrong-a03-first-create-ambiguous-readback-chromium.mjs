// WRONG A-03-2: new-record create after IndexedDB commit but unreadable ACK.
// BASELINE phase proves whether blind resubmit creates a different ID/photo record.
// FIXED phase asserts local idempotence guard, no silent success, and bytes intact.
// Deliberately excludes old QA78/84/85/92, A01 OCR and A02 retry/review paths.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_A03_DEV_SHA,PHASE=process.env.WRONG_A03_PHASE||'baseline';
assert.match(SHA||'',/^[0-9a-f]{40}$/);
assert.ok(['baseline','fixed'].includes(PHASE));
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const TEXT='A03 가상 신규 문제: 한 문장에서 중심 생각을 찾아보세요';
const MEMO='A03 학부모 전용 비공개 메모 — 실제 아동 정보 없음';
const DIR='qa-proof/wrong-a03/'+PHASE;mkdirSync(DIR,{recursive:true});
const DB='uriaimath-github-qa-v224-only';
let preview,browser,checks=0,screens=0;const errors=[],outside=[];
function pass(msg){checks++;console.log('WRONG_A03_PASS '+PHASE+' '+checks+' '+msg)}
async function shot(p,name){
 const file=DIR+'/'+String(++screens).padStart(2,'0')+'-'+name+'.png';
 await p.screenshot({path:file,fullPage:true,animations:'disabled'});
 console.log('WRONG_A03_SHOT='+file);
}
async function snap(p){
 return p.evaluate(name=>new Promise((ok,bad)=>{
  const req=indexedDB.open(name);req.onerror=()=>bad(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const r=tx.objectStore('mistakes').getAll(),k=tx.objectStore('photos').getAllKeys(),b=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();bad(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const photos=await Promise.all(k.result.map(async(id,i)=>({
      id,mime:b.result[i].type,bytes:Array.from(new Uint8Array(await b.result[i].arrayBuffer()))
     })));db.close();ok({records:r.result,photos})
    }catch(e){db.close();bad(e)}
   };
  };
 }),DB);
}
async function onePostCommitReadFailure(p){
 return p.evaluate(()=>{
  if(!window.__a03){
   window.__a03={armed:false,fired:0,readonly:0};
   const original=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(stores,mode,...other){
    const list=Array.isArray(stores)?stores:[stores];
    if(window.__a03.armed&&mode==='readonly'&&list.length===1&&list[0]==='mistakes'){
     window.__a03.armed=false;window.__a03.fired++;
     throw Error('QA_A03_AFTER_COMMIT_READBACK_UNAVAILABLE');
    }
    if(mode==='readonly'&&list.length===1&&list[0]==='mistakes')window.__a03.readonly++;
    return original.call(this,stores,mode,...other);
   };
  }
  window.__a03.armed=true;return window.__a03.fired;
 });
}
try{
 const username='wrong-a03-fictional-parent',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
   httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))outside.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 assert.equal((await snap(page)).records.length,0);
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(TEXT);
 await page.locator('#memo').fill(MEMO);
 await page.locator('#take-photo').setInputFiles({name:'a03-pixel-fake.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:18000});
 const fired=await onePostCommitReadFailure(page);
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 assert.match(await page.locator('#form-error').innerText(),/저장 동작은 실행됐으나 저장 후 확인에 실패/);
 assert.equal(await page.evaluate(()=>window.__a03.fired),fired+1);
 const first=await snap(page);
 assert.equal(first.records.length,1);
 assert.equal(first.photos.length,1);
 const r=first.records[0],pic=first.photos[0];
 assert.equal(r.id,pic.id);assert.equal(r.problemText,TEXT);assert.equal(r.memo,MEMO);
 assert.equal(r.subject,'korean');
 assert.ok(pic.bytes.length>0);
 assert.equal(await page.locator('#problem').inputValue(),TEXT,'input lost on ambiguous readback');
 pass('first create definitely committed 1 ID+1 photo, but GUI correctly says result unknown');
 await shot(page,'01-created-but-unconfirmed-320');

 // Same-form blind resubmit is a distinct threat from redoing an existing
 // child retry: baseline is expected to reveal two new random IDs.
 if(PHASE==='baseline'){
  assert.equal(await page.locator('#save-btn').isEnabled(),true,'baseline button behavior changed');
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
  const duplicated=await snap(page);
  assert.equal(duplicated.records.length,2,'baseline threat: two new IDs expected');
  assert.equal(duplicated.photos.length,2,'baseline threat: two new photos expected');
  assert.notEqual(duplicated.records[0].id,duplicated.records[1].id);
  for(const v of duplicated.records){assert.equal(v.problemText,TEXT);assert.equal(v.memo,MEMO)}
  assert.deepEqual(duplicated.photos[0].bytes,duplicated.photos[1].bytes);
  assert.deepEqual(duplicated.photos[0].bytes,pic.bytes);
  pass('baseline REPRODUCED: same-form second click creates duplicate distinct IDs/photos');
  await shot(page,'02-baseline-duplicate-two-ids-320');
 }else{
  assert.equal(await page.locator('#save-btn').isDisabled(),true,
    'after persisted-unconfirmed create, the same form should not allow blind create');
  assert.match(await page.locator('#form-error').innerText(),/중복|목록|확인/);
  const stable=await snap(page);assert.deepEqual(stable,first);
  pass('fixed UI prevents blind resubmit; new ID and photo are unchanged');
  await shot(page,'02-fixed-resubmit-disabled-320');
 }
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 const afterReload=await snap(page);
 assert.equal(afterReload.records.length,PHASE==='baseline'?2:1);
 assert.equal(afterReload.photos.length,PHASE==='baseline'?2:1);
 assert.ok(afterReload.records.some(v=>v.id===r.id));
 assert.deepEqual(afterReload.photos.find(v=>v.id===r.id),pic);
 if(PHASE==='fixed'){
  await page.locator('#records-list button[data-record="'+r.id+'"]').click();
  await page.locator('#detail-text').waitFor();
  assert.equal(await page.locator('#detail-text').innerText(),TEXT);
  await page.locator('#v218-child-mode').click();
  const leak=await page.evaluate(secret=>({
   text:document.body.textContent.includes(secret),
   input:document.querySelector('#memo')?.value.includes(secret)||false
  }),MEMO);
  assert.deepEqual(leak,{text:false,input:false});
  pass('after reload, one record/photo survives; child DOM has no private parent memo');
 }
 await page.setViewportSize({width:390,height:844});
 await shot(page,'03-reloaded-records-390');
 const horizontal=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(horizontal.scroll<=horizontal.viewport+2);
 assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
 pass('new 320/390 no overrun, browser errors0, external network0');
 const result={status:'PASS',phase:PHASE,devSha:SHA,checks,screens,
  browser:'actual Chromium real app, temporary local storage',mockPhoto:true,actualOCR:false,
  firstCommitActuallySucceeded:true,postCommitReadbackSimulatedLost:true,
  sameFormResubmitDuplicated:PHASE==='baseline',finalRecordCount:afterReload.records.length,
  originalPhotoBytesPreserved:true,realFamilyAuth:false,safeToRestore:false,
  previousA01A02OlderQARepeated:false,productionChanged:false};
 writeFileSync(DIR+'/wrong-a03-result.json',JSON.stringify(result,null,2));
 console.log('WRONG_A03_RESULT='+JSON.stringify(result));
 await ctx.close();
}catch(e){
 process.exitCode=1;
 const result={status:'FAIL',phase:PHASE,checks,screens,error:String(e),
  stack:String(e?.stack||'').slice(0,1550),errors,outside,
  safeToRestore:false,productionChanged:false};
 writeFileSync(DIR+'/wrong-a03-failure.json',JSON.stringify(result,null,2));
 console.error('WRONG_A03_RESULT='+JSON.stringify(result));
}finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 console.log('WRONG_A03_EPHEMERAL_PREVIEW_STOPPED');
}