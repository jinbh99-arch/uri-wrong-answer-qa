// QA89 / 02-W7: intentionally red safety regression for the RAW photo-only
// same-size/same-MIME write occurring after SHA256 and before IDB readwrite.
// No actual user, operational DB or source application modifications.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV=process.env.WRONG_QA89_DEV_SHA;
assert.match(DEV||'',/^[0-9a-f]{40}$/);
const path='qa-proof/qa89';mkdirSync(path,{recursive:true});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
let browser,preview,screens=0;const errors=[],external=[];
async function shot(page,tag){
 const file=path+'/'+String(++screens).padStart(2,'0')+'-'+tag+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled'});
 console.log('QA89_PNG='+file);
}
async function snapshot(page){
 return page.evaluate(async()=>{
  const db=window.__qa89db;
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const q=(store,method)=>new Promise((ok,no)=>{const r=tx.objectStore(store)[method]();
   r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const [rows,ids,photos,pids,setting,sids]=await Promise.all([
   q('mistakes','getAll'),q('mistakes','getAllKeys'),
   q('photos','getAll'),q('photos','getAllKeys'),
   q('settings','getAll'),q('settings','getAllKeys')]);
  return {rows:ids.map((id,i)=>({id,value:rows[i]})),
   photos:await Promise.all(pids.map(async(id,i)=>({
    id,type:photos[i].type,size:photos[i].size,
    bytes:[...new Uint8Array(await photos[i].arrayBuffer())]
   }))),settings:sids.map((id,i)=>({id,value:setting[i]}))};
 });
}
async function panel(page,title,notes){
 await page.evaluate(({title,notes})=>{
  document.querySelector('#qa89-evidence')?.remove();
  const box=document.createElement('section');box.id='qa89-evidence';
  box.style.cssText='background:white;color:#20202b;border:2px solid #444;padding:15px;margin:12px;overflow-wrap:anywhere;font:16px/1.6 sans-serif';
  const heading=document.createElement('h2');heading.textContent=title;box.append(heading);
  for(const note of notes){const p=document.createElement('p');p.textContent=note;box.append(p)}
  document.body.prepend(box);
 },{title,notes});
}
try{
 const username='qa89-synthetic-only',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const u=route.request().url();
  if(u===preview.url&&route.request().resourceType()==='document'){
   const response=await route.fetch(),html=await response.text();
   const seam=' return v22RestoreOnlyIfUnchanged(items,images,p,baseline,targetDb,announce);';
   const marker='// ===== v0.4 optional OCR + local persistence navigation test =====';
   assert.equal(html.split(seam).length,2);
   assert.equal(html.split(marker).length,2);
   const hooks="window.__qa89guards=Object.freeze({"+
     "baseline:d=>v22CaptureRestoreBaseline(d),"+
     "photo:d=>v23CapturePhotoFingerprints(d),"+
     "restore:(items,images,p,b,f,d)=>v23RestoreWithPhotoCheck(items,images,p,b,f,d,false)"+
     "});\n";
   const replaced=html.replace(seam,
    ' if(window.__qa89Gate) await window.__qa89Gate();\n'+seam)
     .replace(marker,hooks+marker);
   return route.fulfill({response,body:replaced,contentType:'text/html; charset=utf-8'});
  }
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))external.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 const dbName='wrong-qa89-only-'+randomBytes(6).toString('hex');
 await page.evaluate(async dbName=>{
  const req=indexedDB.open(dbName,1);
  const db=await new Promise((ok,no)=>{
   req.onupgradeneeded=()=>{for(const n of ['mistakes','photos','settings'])req.result.createObjectStore(n)};
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  });
  window.__qa89db=db;window.__qa89dbName=dbName;
  const t=db.transaction(['mistakes','photos','settings'],'readwrite');
  const rec=t.objectStore('mistakes'),photos=t.objectStore('photos');
  rec.put({id:'qa89-photo',problemText:'가상 최초 문항',hasPhoto:true,checkHistory:[]},'qa89-photo');
  photos.put(new Blob([new Uint8Array([12,34,56,78])],{type:'image/png'}),'qa89-photo');
  t.objectStore('settings').put({nickname:'가상',grade:3,subject:'math'},'profile');
  await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)});
 },dbName);
 const original=await snapshot(page);
 assert.equal(original.rows.length,1);assert.equal(original.photos.length,1);
 const beforeMark=await page.evaluate(async()=>({
  baseline:await window.__qa89guards.baseline(window.__qa89db),
  photo:await window.__qa89guards.photo(window.__qa89db)
 }));
 // Start real v23 chain and PAUSE after it finishes hashing real photo bytes
 // but before v22 opens the transactional compare/write.
 await page.evaluate(mark=>{
  window.__qa89Paused=false;
  window.__qa89Gate=()=>new Promise(ok=>{
   window.__qa89Paused=true;window.__qa89Release=ok;
  });
  window.__qa89Result=window.__qa89guards.restore(
   [{id:'qa89-restored',problemText:'가상 복원본',hasPhoto:true}],
   {'qa89-restored':new Blob([new Uint8Array([99,98,97,96])],{type:'image/png'})},
   {nickname:'복원가족',grade:4},mark.baseline,mark.photo,window.__qa89db
  ).then(()=>({ok:true}),e=>({ok:false,name:e?.name,
   code:e?.code||null,error:String(e?.message||e)}));
 },beforeMark);
 await page.waitForFunction(()=>window.__qa89Paused===true,{timeout:12000});
 // Simulate an independent tab's RAW IDB photo-only write: same ID, type, size,
 // strictly different contents; record and settings are left byte-for-byte same.
 await page.evaluate(async()=>{
  const db=window.__qa89db,t=db.transaction('photos','readwrite');
  t.objectStore('photos').put(new Blob([new Uint8Array([78,56,34,12])],{type:'image/png'}),'qa89-photo');
  await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)});
 });
 const changed=await snapshot(page);
 assert.deepEqual(changed.rows,original.rows,'the other tab must not touch the record metadata');
 assert.deepEqual(changed.settings,original.settings,'no settings update');
 assert.equal(changed.photos[0].size,original.photos[0].size);
 assert.equal(changed.photos[0].type,original.photos[0].type);
 assert.notDeepEqual(changed.photos[0].bytes,original.photos[0].bytes);
 const changedPhotoHash=hash(changed.photos);
 await panel(page,'QA89 사진만 변경된 실제 경합 — 복원 직전',[
   '지문 계산 완료 · 트랜잭션 전 독립 사진 변경',
   '사진 ID, 크기 4바이트, 형식 image/png 동일',
   '원장 및 프로필은 변경 없음',
   '보호 기대: 변경 감지 후 복원 거부, 최신 사진 보존']);
 await shot(page,'photo-only-same-metadata-before-restore');
 await page.evaluate(()=>{window.__qa89Release();delete window.__qa89Release;});
 const result=await page.evaluate(()=>window.__qa89Result);
 const after=await snapshot(page);
 const protectedCorrectly=!result.ok&&hash(after)===hash(changed);
 const recordWasReplaced=after.rows.length===1&&after.rows[0].id==='qa89-restored';
 const photoWasReplaced=after.photos.length===1&&after.photos[0].id==='qa89-restored';
 const raceExposed=result.ok&&recordWasReplaced&&photoWasReplaced;
 await panel(page,'QA89 후지문·전트랜잭션 사진 단독 경합',[
  '기준 SHA: '+DEV,
  '독립 변경: 같은 ID·동일 크기·동일 MIME의 사진 바이트만 교체',
  '복원 결과: '+(result.ok?'트랜잭션 성공(동시 사진 변경 감지 실패)':'거부 '+(result.code||result.name)),
  '가족 실인증/암호화/운영복원: 검증하지 않음',
  'safeToRestore:false 유지',
  protectedCorrectly?'보호 결과: PASS — 최신 사진 보존':
  raceExposed?'보호 결과: FAIL — 동시 변경된 사진이 복원으로 덮어써짐':
  '보호 결과: 추가 조사 필요'
 ]);
 await shot(page,'actual-guard-result');
 const report={devSha:DEV,status:protectedCorrectly?'PROTECTION_PASS':raceExposed?'SAFETY_DEFECT_REPRODUCED':'INCONCLUSIVE',
  tested:'same-size-same-MIME-photo-only-write-after-SHA256-before-IDB-readwrite',
  actualAppGuards:true,photoBytesBefore:original.photos[0].bytes,
  photoBytesConcurrent:changed.photos[0].bytes,
  concurrentPhotoSha256:changedPhotoHash,
  result,protectedCorrectly,raceExposed,recordWasReplaced,photoWasReplaced,
  originalRows:original.rows.length,concurrentRows:changed.rows.length,afterRows:after.rows.length,
  photosUnchangedAfterRace:hash(changed.photos)===hash(after.photos),
  errors,external,safeToRestore:false,productionChanged:false,screens};
 writeFileSync(path+'/qa89-finding.json',JSON.stringify(report,null,2));
 console.log('QA89_FINDING='+JSON.stringify(report));
 assert.deepEqual(errors,[],'unexpected page errors');
 assert.deepEqual(external,[],'unexpected external requests');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 await page.evaluate(async()=>{
  const db=window.__qa89db,name=window.__qa89dbName;db.close();delete window.__qa89db;
  await new Promise((ok,no)=>{
   const r=indexedDB.deleteDatabase(name);
   r.onsuccess=ok;r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('ephemeral DB cleanup blocked'));
  });
 });
 console.log('QA89_CLEANUP=ephemeral-test-database-deleted');
 if(!protectedCorrectly){
  console.error(raceExposed?
   'QA89_SAFETY_REGRESSION: actual app does not protect same-metadata photo-only race':
   'QA89_INCONCLUSIVE: behavior was not safely proved');
  process.exitCode=1;
 }
 await ctx.close();
}catch(e){console.error('QA89_FATAL='+String(e?.stack||e).slice(0,1700));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
