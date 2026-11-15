// QA89 W7: new post-photo-digest, pre-IndexedDB-write window race.
// The only app instrumentation is an ephemeral hook in the localhost HTTP response;
// INDEX.HTML IN GIT AND ALL USER/OPERATIONAL DATABASES ARE UNCHANGED.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA89_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const out='qa-proof/qa89';
mkdirSync(out,{recursive:true});
let preview,browser,checks=0,screens=0;
const pass=s=>{checks++;console.log('QA89_PASS '+s)};
async function screenshot(page,name){
 const p=out+'/'+String(++screens).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path:p,fullPage:true,animations:'disabled'});
 console.log('QA89_PNG '+p);
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
  window.__qa89db=db;window.__qa89name=name;window.__qa89Paused=false;
  const tx=db.transaction(['mistakes','photos','settings'],'readwrite');
  tx.objectStore('mistakes').put({id:'qa89-a',problemText:'원본 가상 A',hasPhoto:true,checkHistory:[]},'qa89-a');
  tx.objectStore('mistakes').put({id:'qa89-b',problemText:'원본 가상 B',hasPhoto:true,checkHistory:[]},'qa89-b');
  tx.objectStore('photos').put(new Blob([new Uint8Array([11,12,13,14])],{type:'image/png'}),'qa89-a');
  tx.objectStore('photos').put(new Blob([new Uint8Array([21,22,23,24])],{type:'image/png'}),'qa89-b');
  tx.objectStore('settings').put({nickname:'가상',grade:3,subject:'math'},'profile');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error)});
 },name);
}
async function snap(page){
 return page.evaluate(async()=>{
  const db=window.__qa89db;
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
 rows:await window.__qa89guards.baseline(window.__qa89db),
 photos:await window.__qa89guards.fingerprint(window.__qa89db)
}));}
async function startRestore(page,mark){
 await page.evaluate(mark=>{
  window.__qa89Paused=false;
  window.__qa89Checkpoint=()=>new Promise(ok=>{
   window.__qa89Paused=true;window.__qa89Proceed=ok;
  });
  window.__qa89Restore=window.__qa89guards.restore(
   [{id:'qa89-incoming',problemText:'가상 복원 파일',hasPhoto:true}],
   {'qa89-incoming':new Blob([new Uint8Array([33,34,35,36])],{type:'image/png'})},
   {nickname:'복원본',grade:4},mark.rows,mark.photos,window.__qa89db
  ).then(()=>({ok:true}),e=>({ok:false,code:e?.code||null,
    name:e?.name||null,error:String(e?.message||e)}));
 },mark);
 await page.waitForFunction(()=>window.__qa89Paused===true,{timeout:12000});
}
async function proceed(page){
 await page.evaluate(()=>{window.__qa89Proceed();window.__qa89Proceed=null;});
 return page.evaluate(()=>window.__qa89Restore);
}
async function modifyPhotoOnly(page){
 await page.evaluate(async()=>{
  const db=window.__qa89db,tx=db.transaction('photos','readwrite');
  const old=await new Promise((ok,no)=>{const r=tx.objectStore('photos').get('qa89-a');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const before=new Uint8Array(await old.arrayBuffer());
  const after=Uint8Array.from(before);after[0]^=0x5a;
  if(after.length!==before.length)throw Error('photo length changed');
  tx.objectStore('photos').put(new Blob([after],{type:old.type}),'qa89-a');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)});
 });
}
async function cleanup(page){
 await page.evaluate(async()=>{
  const db=window.__qa89db,name=window.__qa89name;
  db.close();
  delete window.__qa89db;
  await new Promise((ok,no)=>{const r=indexedDB.deleteDatabase(name);
    r.onsuccess=ok;r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('ephemeral cleanup blocked'));
  });
 });
}
async function proof(page,heading,items){
 await page.evaluate(({heading,items})=>{
  document.querySelector('#qa89-evidence')?.remove();
  const p=document.createElement('section');p.id='qa89-evidence';
  p.style.cssText='background:white;border:2px solid #335;padding:14px;margin:14px;color:#223;overflow-wrap:anywhere;line-height:1.5;';
  const h=document.createElement('h2');h.textContent=heading;p.append(h);
  for(const item of items){const el=document.createElement('p');el.textContent=item;p.append(el)}
  document.body.prepend(p);
 },{heading,items});
}
const hex=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
try{
 const username='qa89-synthetic-only',password=randomBytes(24).toString('hex');
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
     ' if(window.__qa89Checkpoint) await window.__qa89Checkpoint();\n'+seam);
   const hooks="window.__qa89guards=Object.freeze({"+
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
 assert.equal(await page.evaluate(()=>typeof window.__qa89guards.restore),'function');
 pass('actual dev restore guard loaded; only localhost response instrumented');

 // New W7 path: identical MIME/byte length, photo-only write after digest.
 const firstName='wrong-qa89-photo-'+randomBytes(5).toString('hex');
 await mountDb(page,firstName);
 const initial=await snap(page),initialSha=hex(initial),mark=await baseline(page);
 await startRestore(page,mark);
 await modifyPhotoOnly(page);
 const changed=await snap(page);
 assert.notEqual(hex(changed),initialSha,'photo-only race writer must change bytes');
 assert.deepEqual(changed.records,initial.records,'record metadata must be identical');
 assert.equal(changed.photos[0].bytes.length,initial.photos[0].bytes.length);
 assert.equal(changed.photos[0].type,initial.photos[0].type);
 const result=await proceed(page);
 assert.equal(result.ok,false,'unsafe restore overwrote same-size photo-only update');
 assert.equal(result.code,'V22_RESTORE_CHANGED','photo-only race must be rejected');
 assert.deepEqual(await snap(page),changed,'photo-only race must preserve latest photo and records');
 pass('same-size same-MIME photo-only concurrent update rejected with all bytes preserved');
 await proof(page,'QA89 W7: 사진만 동형 변경 경합',[
  '사진 지문 완료 후 동일 크기·동일 MIME 사진 바이트만 변경',
  '원장 메타 동일 · 복원 거절 · 최신 사진과 원장 보존',
  '시험 전용 IndexedDB · 실제 가족/복원 기능 검증 아님']);
 await screenshot(page,'photo-only-same-size-race');
 await cleanup(page);
 pass('ephemeral synthetic DB deleted');
 assert.deepEqual(errors,[],'unexpected browser script errors');
 assert.deepEqual(external,[],'unexpected external network requests');
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('Chromium320 browser console/network/overflow clean');
 const report={status:'PASS',checks,screens,sourceDevSha:SHA,
  path:'same-size-photo-only-posthash-pretransaction',
  sameSizePhotoOnlyRaceProtected:true,
  syntheticDbDeleted:true,realAppHtmlUnchanged:true,
  realFamilyAuthVerified:false,safeToRestore:false,
  encryptedRestoreVerified:false,uncoordinatedSameMetadataPhotoRaceVerified:true};
 writeFileSync(out+'/qa89-result.json',JSON.stringify(report,null,2));
 console.log('QA89_RESULT='+JSON.stringify(report));
 await ctx.close();
}catch(e){
 console.error('QA89_RESULT='+JSON.stringify({status:'FAIL',checks,screens,
  error:String(e),stack:String(e?.stack).slice(0,1000),
  safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
