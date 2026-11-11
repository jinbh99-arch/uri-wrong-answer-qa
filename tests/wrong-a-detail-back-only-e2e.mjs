// Synthetic-only one-D user task. A original record/photo/child explanation/guardian observation.
// Tests ONLY the isolated original A detail "← 목록으로" focus/scroll enhancement.
// No P13-P18, no History API, no real family auth, no restore, no external HTTP.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

if(process.env.WRONG_A_BACK_LOCAL_ONLY!=='1')throw Error('LOCAL_SYNTHETIC_ONLY_REQUIRED');
const A='c7d413f311df5bc983bc63f18027ac18b0445f27';
const before=execFileSync('git',['show',A+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const text=after.toString('utf8');
assert.ok(text.includes('WRONG-A-ONLY-INAPP-BACK'));
assert.ok(!before.includes('WRONG-A-ONLY-INAPP-BACK'));
for(const p of ['wrong-p13-first-action','wrong-p17-filter-wrap','WRONG-P19 QA only','history.pushState']){
 assert.equal(text.includes(p),before.toString().includes(p),'no new '+p+' dependency');
}
const path='test-results/wrong-a-detail-back-only';
mkdirSync(path,{recursive:true});
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const question='가상 국어 D · 이유를 다시 말하기 (실사진 금지)';
const explanation='가상 D 아이가 문장의 까닭을 자기 말로 설명했습니다.';
const observation='가상 D 부모 관찰: 아이의 직접 설명을 들었습니다.';
const evidence={sourceA:A,candidateSha:process.env.GITHUB_SHA||'local',
  syntheticOnly:true,conditions:[],events:[],screenshots:[],externalHTTP:0,
  safeToRestore:false,realFamilyAuth:false,restorePerformed:false};
function pass(message){evidence.events.push(message);console.log('PASS WRONG_A_BACK_ONLY '+evidence.events.length+' '+message)}
async function storage(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   function read(store,method){
    return new Promise((ok,no)=>{const r=tx.objectStore(store)[method]();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
   }
   const [rows,keys,blobs]=await Promise.all([read('mistakes','getAll'),read('photos','getAllKeys'),read('photos','getAll')]);
   const photos=[];
   for(let i=0;i<blobs.length;i++){
    const data=await blobs[i].arrayBuffer();
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
    photos.push({id:String(keys[i]),mime:blobs[i].type,size:data.byteLength,
     sha256:Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('')});
   }
   return {rows,photos};
  }finally{db.close()}
 });
}
async function snap(page,name){
 await page.screenshot({path:path+'/'+name+'.png',fullPage:false});
 evidence.screenshots.push(name+'.png');
}
async function rect(page){
 return page.evaluate(()=>{
  const back=document.querySelector('#page-detail [data-route="records"]');
  const r=back?.getBoundingClientRect();
  return {route:document.querySelector('#page-detail')?.classList.contains('hide')?'other':'detail',
    x:r?.x,y:r?.y,width:r?.width,height:r?.height,bottom:r?.bottom,right:r?.right,
    viewportW:innerWidth,viewportH:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
    focus:document.activeElement===back,scrollY:scrollY};
 });
}
let server,browser,context;
try{
 server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const files={'/scripts/qa-inapp-sync-bridge.mjs':'../scripts/qa-inapp-sync-bridge.mjs',
    '/scripts/qa47-live-auth-lab.mjs':'../scripts/qa47-live-auth-lab.mjs'};
  if(req.method==='GET'&&['/','/index.html'].includes(pathname)){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(after);
  }
  if(req.method==='GET'&&Object.hasOwn(files,pathname)){
   const bytes=readFileSync(new URL(files[pathname],import.meta.url));
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});return res.end(bytes);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',hasTouch:true,isMobile:true});
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==origin){evidence.externalHTTP++;return route.abort()}
  return route.continue();
 });
 const page=await context.newPage();
 await page.goto(origin+'/');
 await page.locator('#nav-add').waitFor();
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(question);
 await page.locator('#choose-photo').setInputFiles({name:'synthetic-d-1px.png',mimeType:'image/png',buffer:tinyPng});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 let saved=await storage(page);
 assert.equal(saved.rows.length,1);assert.equal(saved.photos.length,1);
 const id=saved.rows[0].id;assert.equal(saved.photos[0].id,id);
 pass('A user path: create one synthetic D and save exactly one photo');
 async function open(){
  await page.locator('#nav-records').click();
  await page.locator('#records-list [data-record="'+id+'"]').click();
  await page.locator('#detail-image img').waitFor();
  assert.equal(await page.locator('#detail-text').innerText(),question);
 }
 await open();
 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill('가상 D 아이가 문장의 까닭을 확인했습니다.');
 await page.locator('#v230-explanation').fill(explanation);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'));
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review:visible').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(async recordId=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise(ok=>req.onsuccess=()=>ok(req.result));
  try{const tx=db.transaction('mistakes','readonly');const q=tx.objectStore('mistakes').get(recordId);
    const r=await new Promise(ok=>q.onsuccess=()=>ok(q.result));
    return r?.generalRetryHistory?.at(-1)?.review==='explained';
  }finally{db.close()}
 },id);
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill(observation);
 await page.locator('#check-save').click();
 await page.waitForFunction(s=>document.querySelector('#check-history')?.textContent?.includes(s),observation);
 const fixed=await storage(page);
 assert.equal(fixed.rows[0].id,id);
 assert.equal(fixed.rows[0].checkHistory?.length,1);
 assert.equal(fixed.rows[0].generalRetryHistory?.at(-1)?.explanation,explanation);
 assert.equal(fixed.rows[0].generalRetryHistory?.at(-1)?.review,'explained');
 pass('A D child explanation and guardian observation saved, full IndexedDB baseline frozen');
 for(const spec of [{w:320,h:720,z:1},{w:320,h:720,z:2},{w:390,h:844,z:1},{w:390,h:844,z:2}]){
  const label=spec.w+'-'+spec.z;
  await page.setViewportSize({width:spec.w,height:spec.h});
  await page.evaluate(z=>document.body.style.zoom=z===2?'2':'',spec.z);
  await page.locator('#v218-parent-mode').click();
  await open();
  await page.waitForTimeout(90); // allow one post-navigation animation frame
  let box=await rect(page);
  assert.equal(box.route,'detail');
  assert.ok(box.y>=0&&box.bottom<=box.viewportH&&box.x>=0&&box.right<=box.viewportW,
    'existing back in first viewport '+label+' '+JSON.stringify(box));
  assert.equal(box.overflow,0,'no horizontal overflow '+label);
  if(spec.z===2)assert.equal(box.focus,true,'200pct existing back focus '+label);
  await snap(page,label+'-detail-back-visible');
  const back=page.locator('#page-detail [data-route="records"]');
  // Tab traversal returns to this same existing button. No new CTA inserted.
  await back.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.matches('#page-detail [data-route="records"]')),true,
    'Tab back reaches same button '+label);
  await page.keyboard.press('Enter');
  await page.locator('#page-records:not(.hide)').waitFor();
  assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
  await open();
  await page.waitForTimeout(90);
  box=await rect(page);
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  await page.locator('#page-records:not(.hide)').waitFor();
  assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
  await open();
  await page.locator('#detail-image img').waitFor();
  assert.equal(await page.locator('#v230-review').inputValue(),'explained');
  assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanation));
  assert.ok((await page.locator('#check-history').innerText()).includes(observation));
  assert.deepEqual(await storage(page),fixed,'original D/photo/retry/review unchanged '+label);
  await snap(page,label+'-same-D-after-back');
  evidence.conditions.push({width:spec.w,height:spec.h,zoom:spec.z,backInFirstViewport:true,
   tabEnter:true,touch:true,recordId:id,samePhotoSHA:true,sameChildExplanation:true,sameParentObservation:true});
  pass(label+' keyboard Tab+Enter, touch, same D/photo/parent observation intact');
 }
 assert.equal(evidence.externalHTTP,0);
 evidence.status='PASS';evidence.final={recordId:id,photoSHA:fixed.photos[0].sha256,conditions:4};
 writeFileSync(path+'/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_A_BACK_ONLY_RESULT='+JSON.stringify({status:'PASS',conditions:4,checks:evidence.events.length,
  screenshots:evidence.screenshots.length,syntheticOnly:true,noRecordLoss:true,
  originalA:A,safeToRestore:false,externalHTTP:0}));
}catch(error){
 evidence.status='FAIL';evidence.error=String(error);evidence.stack=String(error.stack||'').slice(0,3000);
 writeFileSync(path+'/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_A_BACK_ONLY_RESULT='+JSON.stringify({status:'FAIL',error:String(error),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
