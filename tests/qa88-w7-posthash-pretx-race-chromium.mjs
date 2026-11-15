// QA88 W7: new post-photo-digest, pre-IndexedDB-write window race.
// The only app instrumentation is an ephemeral hook in the localhost HTTP response;
// INDEX.HTML IN GIT AND ALL USER/OPERATIONAL DATABASES ARE UNCHANGED.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA88_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const out='qa-proof/qa88';
mkdirSync(out,{recursive:true});
let preview,browser,checks=0,screens=0;
const pass=s=>{checks++;console.log('QA88_PASS '+s)};
async function screenshot(page,name){
 const p=out+'/'+String(++screens).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path:p,fullPage:true,animations:'disabled'});
 console.log('QA88_PNG '+p);
}
async function mountDb(page,name){
 await page.evaluate(async (name)=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((ok,no)=>{
   req.onupgradeneeded=()=>{
    for(const key of ['mistakes','photos','settings'])req.result.createObjectStore(key);
   };
   req.onsuccess=()=>ok(req.result);
   req.onerror=()=>no(req.error);
  });
  window.__qa88db=db;window.__qa88name=name;window.__qa88Paused=false;
  const tx=db.transaction(['mistakes','photos','settings'],'readwrite');
  tx.objectStore('mistakes').put({id:'qa88-a',problemText:'원본 가상 A',hasPhoto:true,checkHistory:[]},'qa88-a');
  tx.objectStore('mistakes').put({id:'qa88-b',problemText:'원본 가상 B',hasPhoto:true,checkHistory:[]},'qa88-b');
  tx.objectStore('photos').put(new Blob([new Uint8Array([11,12,13,14])],{type:'image/png'}),'qa88-a');
  tx.objectStore('photos').put(new Blob([new Uint8Array([21,22,23,24])],{type:'image/png'}),'qa88-b');
  tx.objectStore('settings').put({nickname:'가상',grade:3,subject:'math'},'profile');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error)});
 },name);
}
async function snap(page){
 return page.evaluate(async()=>{
  const db=window.__qa88db;
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const req=(store,method)=>new Promise((ok,no)=>{
   const r=tx.objectStore(store)[method]();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
  });
  const [keys,rows,pkeys,photos,skeys,settings]=await Promise.all([
   req('mistakes','getAllKeys'),req('mistakes','getAll'),
   req('photos','getAllKeys'),req('photos','getAll'),
   req('settings','getAllKeys'),req('settings','getAll')]);
  return {records:keys.map((id,i)=>({id,value:rows[i]})),
   photos:await Promise.all(pkeys.map(async(id,i)=>({id,type:photos[i].type,
    bytes:[...new Uint8Array(await photos[i].arrayBuffer())]}))),
   settings:skeys.map((id,i)=>({id,value:settings[i]}))};
 });
}
async function baseline(page){return page.evaluate(async()=>({
 rows:await window.__qa88guards.baseline(window.__qa88db),
 photos:await window.__qa88guards.fingerprint(window.__qa88db)
}));}
async function startRestore(page,mark){
 await page.evaluate(mark=>{
  window.__qa88Paused=false;
  window.__qa88Checkpoint=()=>new Promise(ok=>{
   window.__qa88Paused=true;window.__qa88Proceed=ok;
  });
  window.__qa88Restore=window.__qa88guards.restore(
   [{id:'qa88-incoming',problemText:'가상 복원 파일',hasPhoto:true}],
   {'qa88-incoming':new Blob([new Uint8Array([33,34,35,36])],{type:'image/png'})},
   {nickname:'복원본',grade:4},mark.rows,mark.photos,window.__qa88db
  ).then(()=>({ok:true}),e=>({ok:false,code:e?.code||null,
    name:e?.name||null,error:String(e?.message||e)}));
 },mark);
 await page.waitForFunction(()=>window.__qa88Paused===true,{timeout:12000});
}
async function proceed(page){
 await page.evaluate(()=>{window.__qa88Proceed();window.__qa88Proceed=null;});
 return page.evaluate(()=>window.__qa88Restore);
}
async function modifyRecord(page){
 await page.evaluate(async()=>{
  const db=window.__qa88db,tx=db.transaction('mistakes','readwrite');
  const req=tx.objectStore('mistakes').get('qa88-a');
  const row=await new Promise((ok,no)=>{
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  });
  tx.objectStore('mistakes').put({...row,problemText:'타 탭이 지문 검사 후 저장한 최신 문항'},'qa88-a');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)});
 });
}
async function cleanup(page){
 await page.evaluate(async()=>{
  const db=window.__qa88db,name=window.__qa88name;
  db.close();
  delete window.__qa88db;
  await new Promise((ok,no)=>{const r=indexedDB.deleteDatabase(name);
    r.onsuccess=ok;r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('ephemeral cleanup blocked'));
  });
 });
}
async function proof(page,heading,items){
 await page.evaluate(({heading,items})=>{
  document.querySelector('#qa88-evidence')?.remove();
  const p=document.createElement('section');p.id='qa88-evidence';
  p.style.cssText='background:white;border:2px solid #335;padding:14px;margin:14px;color:#223;overflow-wrap:anywhere;line-height:1.5;';
  const h=document.createElement('h2');h.textContent=heading;p.append(h);
  for(const item of items){const el=document.createElement('p');el.textContent=item;p.append(el)}
  document.body.prepend(p);
 },{heading,items});
}
const hex=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
try{
 const username='qa88-synthetic-only',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password}});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const u=route.request().url();
  if(u===preview.url&&route.request().resourceType()==='document'){
   const response=await route.fetch(),html=await response.text();
   const seam=' return v22RestoreOnlyIfUnchanged(items,images,p,baseline,targetDb,announce);';
   assert.equal(html.split(seam).length,2,'unique post-fingerprint/pre-IDB transaction seam');
   const marker='// ===== v0.4 optional OCR + local persistence navigation test =====';
   assert.equal(html.split(marker).length,2,'unique local hook insertion seam');
   const instrumented=html.replace(seam,
     ' if(window.__qa88Checkpoint) await window.__qa88Checkpoint();\n'+seam);
   const hooks="window.__qa88guards=Object.freeze({"+
    "baseline:(db)=>v22CaptureRestoreBaseline(db),"+
    "fingerprint:(db)=>v23CapturePhotoFingerprints(db),"+
    "restore:(rows,photos,p,b,f,db)=>v23RestoreWithPhotoCheck(rows,photos,p,b,f,db,false)"+
    "});\n";
   return route.fulfill({response,body:instrumented.replace(marker,hooks+marker),
    contentType:'text/html; charset=utf-8'});
  }
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))external.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(SHA));
 assert.equal(await page.evaluate(()=>typeof window.__qa88guards.restore),'function');
 pass('actual dev restore guard loaded; only localhost response instrumented');

 // Case A: a concurrent record write AFTER latest photo hash, BEFORE IDB readwrite.
 const firstName='wrong-qa88-a-'+randomBytes(5).toString('hex');
 await mountDb(page,firstName);
 const initial=await snap(page),initialSha=hex(initial),mark=await baseline(page);
 await startRestore(page,mark);
 await modifyRecord(page);
 const changed=await snap(page);
 assert.notEqual(hex(changed),initialSha,'race writer must actually change the source record');
 assert.deepEqual(changed.photos,initial.photos,'sibling changes only one record');
 const result=await proceed(page);
 assert.equal(result.ok,false,'restore incorrectly overwrote a concurrent record');
 assert.equal(result.code,'V22_RESTORE_CHANGED');
 assert.deepEqual(await snap(page),changed,
  'post-fingerprint concurrent record update or photos lost after restore abort');
 pass('post-digest pre-transaction concurrent record update prevents destructive restore');
 await proof(page,'QA88 경합 A: 최신 원장 변경 보호',[
  '실제 복원 가드: V22_RESTORE_CHANGED',
  '사진 지문 완료 후 다른 탭의 원장 변경 → 복원 중단',
  '원장 2건·사진 2개 및 바이트 동일 · 시험 전용 DB']);
 await screenshot(page,'posthash-concurrent-record-rejected');
 await cleanup(page);
 pass('first synthetic IndexedDB removed, no original app data touched');

 // Case B: tab storage connection ends after fingerprint; transaction cannot begin.
 const secondName='wrong-qa88-b-'+randomBytes(5).toString('hex');
 await mountDb(page,secondName);
 const beforeCancel=await snap(page),mark2=await baseline(page);
 await startRestore(page,mark2);
 await page.evaluate(()=>{window.__qa88db.close();});
 const canceled=await proceed(page);
 assert.equal(canceled.ok,false,'closed database unexpectedly committed restore');
 assert.match(canceled.name+' '+canceled.error,/InvalidStateError|closing|closed|closing/i);
 await page.evaluate(async()=>{
  const req=indexedDB.open(window.__qa88name,1);
  window.__qa88db=await new Promise((ok,no)=>{
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  });
 });
 assert.deepEqual(await snap(page),beforeCancel,
  'connection close during post-fingerprint gap altered saved photos or rows');
 pass('post-digest storage-connection shutdown rejects restore and preserves all bytes');
 await proof(page,'QA88 경합 B: 저장소 종료 후 복원 차단',[
  '사진 지문 계산 후 저장소 연결 종료',
  '복원용 쓰기 트랜잭션 시작 실패 · 기존 원장/사진 불변',
  '시험 전용 DB 삭제 예정 · 실제 취소 UI 테스트 아님']);
 await screenshot(page,'posthash-db-connection-closed');
 await cleanup(page);
 pass('second synthetic IndexedDB removed, real family data and storage untouched');
 assert.deepEqual(errors,[],'unexpected browser script errors');
 assert.deepEqual(external,[],'unexpected external network requests');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('Chromium320 browser console/network/overflow clean');
 const report={status:'PASS',checks,screens,sourceDevSha:SHA,
  path:'post-photo-fingerprint-before-idb-write',
  concurrentRecordProtected:true,closedDbProtected:true,
  bothSyntheticDbDeleted:true,realAppHtmlUnchanged:true,
  realFamilyAuthVerified:false,safeToRestore:false,
  encryptedRestoreVerified:false,uncoordinatedSameMetadataPhotoRaceVerified:false};
 writeFileSync(out+'/qa88-result.json',JSON.stringify(report,null,2));
 console.log('QA88_RESULT='+JSON.stringify(report));
 await ctx.close();
}catch(e){
 console.error('QA88_RESULT='+JSON.stringify({status:'FAIL',checks,screens,
  error:String(e),stack:String(e?.stack).slice(0,1000),
  safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
