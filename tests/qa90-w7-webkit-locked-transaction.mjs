// QA90 W7: independent WebKit 390px regression for QA-only locked photo SHA restore.
// This is NOT a second QA89 run; stress-tests WebKit IDB keepalive and error rollback.
// The injected interface changes ONLY the ephemeral localhost HTML response.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {webkit} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA90_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const dir='qa-proof/qa90';mkdirSync(dir,{recursive:true});
const sha=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
let server,browser,checks=0,screens=0;
const pass=s=>{checks++;console.log('QA90_PASS '+s)};
async function screenshot(page,tag){
 const file=dir+'/'+String(++screens).padStart(2,'0')+'-'+tag+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled'});
 console.log('QA90_PNG '+file);
}
async function snap(page){
 return page.evaluate(async()=>{
  const db=window.__qa90db;
  const tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const req=(name,what)=>new Promise((ok,no)=>{
   const r=tx.objectStore(name)[what]();
   r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const [mk,mv,pk,pv,sk,sv]=await Promise.all([
   req('mistakes','getAllKeys'),req('mistakes','getAll'),
   req('photos','getAllKeys'),req('photos','getAll'),
   req('settings','getAllKeys'),req('settings','getAll')
  ]);
  return {
   mistakes:mk.map((k,i)=>[k,mv[i]]),
   photos:await Promise.all(pk.map(async(k,i)=>[k,pv[i].type,
      [...new Uint8Array(await pv[i].arrayBuffer())]])),
   settings:sk.map((k,i)=>[k,sv[i]])
  };
 });
}
async function mark(page){
 return page.evaluate(async()=>({
  s:await window.__qa90g.snapshot(window.__qa90db),
  p:await window.__qa90g.photos(window.__qa90db)
 }));
}
async function act(page,m,uncloneable=false){
 return page.evaluate(async({m,uncloneable})=>{
  const rec1={id:'qa90-new-1',hasPhoto:true,problemText:'새 문항 1'};
  const rec2={id:'qa90-new-2',hasPhoto:true,problemText:'새 문항 2'};
  if(uncloneable)rec2.invalid=()=>{};
  try{
   await window.__qa90g.restore([rec1,rec2],{
    'qa90-new-1':new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'}),
    'qa90-new-2':new Blob([new Uint8Array([5,6,7,8])],{type:'image/png'})
   },{nickname:'새 부모',grade:5},m.s,m.p,window.__qa90db);
   return {ok:true};
  }catch(e){return {ok:false,code:e?.code||null,name:e?.name||null,message:String(e?.message||e).slice(0,180)}}
 },{m,uncloneable});
}
async function note(page,headline,lines){
 await page.evaluate(({headline,lines})=>{
  document.querySelector('#qa90-notes')?.remove();
  const p=document.createElement('section');p.id='qa90-notes';
  p.style.cssText='border:2px solid #343d5a;background:#fff;color:#152038;padding:18px;margin:12px;overflow-wrap:anywhere;font:16px/1.5 sans-serif';
  const h=document.createElement('h2');h.textContent=headline;p.append(h);
  for(const s of lines){const n=document.createElement('p');n.textContent=s;p.append(n)}
  document.body.prepend(p);
 },{headline,lines});
}
try{
 const username='qa90-webkit-synthetic',password=randomBytes(24).toString('hex');
 server=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await webkit.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},
  httpCredentials:{username,password}});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url===server.url&&route.request().resourceType()==='document'){
   const r=await route.fetch(),html=await r.text();
   const marker='// ===== v0.4 optional OCR + local persistence navigation test =====';
   assert.equal(html.split(marker).length,2,'one app hook insertion point');
   const hooks="window.__qa90g=Object.freeze({"+
    "snapshot:d=>v22CaptureRestoreBaseline(d),"+
    "photos:d=>v23CapturePhotoFingerprints(d),"+
    "restore:(items,pics,p,s,ph,d)=>v23RestoreWithPhotoCheck(items,pics,p,s,ph,d,false)"+
    "});\n";
   return route.fulfill({response:r,body:html.replace(marker,hooks+marker),
    contentType:'text/html; charset=utf-8'});
  }
  if(url.startsWith(server.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))external.push(url);
  return route.abort();
 });
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 assert.match(await page.locator('#wrong-qa66-preview-meta').innerText(),new RegExp(SHA));
 assert.equal(await page.evaluate(()=>typeof window.__qa90g.restore),'function');
 const dbName='wrong-qa90-webkit-'+randomBytes(7).toString('hex');
 const init=await page.evaluate(async name=>{
  let stage='open-request';
  try{
   if(!indexedDB)return {ok:false,stage,detail:'indexedDB missing'};
   const r=indexedDB.open(name,1);
   const db=await new Promise((ok,no)=>{
    r.onupgradeneeded=()=>{stage='create-stores';for(const k of ['mistakes','photos','settings'])r.result.createObjectStore(k)};
    r.onsuccess=()=>ok(r.result);
    r.onerror=()=>no(Error('IDB_OPEN_ERROR '+String(r.error?.name||'null')+' '+String(r.error?.message||'')));
    r.onblocked=()=>no(Error('IDB_OPEN_BLOCKED'));
   });
   window.__qa90db=db;window.__qa90name=name;
   stage='seed-readwrite';
   const t=db.transaction(['mistakes','photos','settings'],'readwrite');
   const requestErrors=[];
   function monitor(request,what){
    request.addEventListener('error',event=>{
     requestErrors.push({what,name:request.error?.name||'null',message:request.error?.message||'',target:event.target?.constructor?.name||''});
    });
   }
   monitor(t.objectStore('mistakes').put({id:'qa90-old',problemText:'가상 WebKit 원본',hasPhoto:true},'qa90-old'),'mistakes-put');
   stage='seed-blob';
   monitor(t.objectStore('photos').put(new Blob([new Uint8Array(256*1024).fill(43)],{type:'image/png'}),'qa90-old'),'photos-256KiB-put');
   stage='seed-settings';
   monitor(t.objectStore('settings').put({nickname:'원래',grade:3,subject:'math'},'profile'),'settings-put');
   stage='seed-commit';
   await new Promise((ok,no)=>{
    t.oncomplete=ok;
    t.onerror=event=>no(Error('IDB_SEED_ERROR '+JSON.stringify({
     txError:t.error?.name||'null',targetError:event.target?.error?.name||'null',
     requestErrors,isSecureContext,origin:location.origin,hasIndexedDb:!!indexedDB
    })));
    t.onabort=event=>no(Error('IDB_SEED_ABORT '+JSON.stringify({
     txError:t.error?.name||'null',targetError:event.target?.error?.name||'null',
     requestErrors
    })));
   });
   return {ok:true,stage:'seed-complete',stores:[...db.objectStoreNames]};
  }catch(e){return {ok:false,stage,name:e?.name||'unknown',detail:String(e?.message||e)}}
 },dbName);
 console.log('QA90_INIT='+JSON.stringify(init));
 assert.equal(init.ok,true,'WebKit synthetic DB setup failed: '+JSON.stringify(init));
 const initial=await snap(page);
 assert.equal(initial.photos[0][2].length,262144);
 pass('WebKit 390px has actual app guards and private 256KiB photo source');
 // New regression: SHA256 read keeps live readwrite lock during large 256KiB digest.
 const m1=await mark(page),first=await act(page,m1,true);
 assert.equal(first.ok,false);
 assert.match(first.message+' '+first.name,/clone|function|object|DataCloneError/i);
 assert.equal(sha(await snap(page)),sha(initial));
 pass('WebKit midtransaction DataCloneError abort preserves 256KiB photo and all settings');
 await note(page,'QA90 WebKit 원자성 검증',[
  '실제 앱 단일 readwrite 트랜잭션에서 사진 SHA-256 수행',
  '256KiB 합성 사진 + 두 번째 복원 레코드 DataCloneError',
  '기존 원장/사진/설정 모두 보존']);
 await screenshot(page,'webkit-atomic-abort-256kib');
 // Unexpected/new settings must abort before erasing unknown future data.
 await page.evaluate(async()=>{
  const t=window.__qa90db.transaction('settings','readwrite');
  t.objectStore('settings').put({future:'protected'},'future-mark');
  await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)});
 });
 const unknown=await snap(page),m2=await mark(page);
 const second=await act(page,m2);
 assert.equal(second.ok,false);
 assert.match(second.message,/알 수 없는 사용자 설정/);
 assert.equal(sha(await snap(page)),sha(unknown));
 pass('WebKit unknown setting rejects without a destructive restore');
 // Remove only test future setting before a valid restore.
 await page.evaluate(async()=>{
  const t=window.__qa90db.transaction('settings','readwrite');
  t.objectStore('settings').delete('future-mark');
  await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)});
 });
 const m3=await mark(page),third=await act(page,m3);
 assert.deepEqual(third,{ok:true});
 const final=await snap(page);
 assert.deepEqual(final.mistakes.map(x=>x[0]),['qa90-new-1','qa90-new-2']);
 assert.deepEqual(final.photos.map(x=>x[0]),['qa90-new-1','qa90-new-2']);
 assert.equal(final.settings.find(x=>x[0]==='profile')?.[1]?.nickname,'새 부모');
 pass('WebKit normal two-photo restore commits both records and profile with no active-tx errors');
 await note(page,'QA90 WebKit 정상 복원 회귀',[
  '원자적 복원: 가상 오답 2건·사진 2장·프로필 새 부모',
  '앞선 DataCloneError·미지원 설정 차단 후 정상 기능 유지',
  '운영 DB 및 실제 가족 자료 변경하지 않음']);
 await screenshot(page,'webkit-valid-restore');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=393);
 pass('WebKit 390px has no page errors/external requests/horizontal overflow');
 await page.evaluate(async()=>{
  const db=window.__qa90db,name=window.__qa90name;db.close();delete window.__qa90db;
  await new Promise((ok,no)=>{
   const r=indexedDB.deleteDatabase(name);
   r.onsuccess=ok;r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('QA90 cleanup blocked'));
  });
 });
 pass('ephemeral WebKit test DB deleted');
 const report={status:'PASS',checks,screens,sourceSha:SHA,engine:'webkit',
  imageBytes:262144,midTxAbortPreserved:true,unknownSettingPreserved:true,
  healthyRestoreSucceeded:true,
  actualFamilyAuthVerified:false,realEncryptedRestoreVerified:false,
  safeToRestore:false,publicDeploymentModified:false};
 writeFileSync(dir+'/qa90-webkit-result.json',JSON.stringify(report,null,2));
 console.log('QA90_RESULT='+JSON.stringify(report));
 await ctx.close();
}catch(err){process.exitCode=1;
 console.error('QA90_RESULT='+JSON.stringify({status:'FAIL',checks,screens,
  error:String(err),stack:String(err?.stack).slice(0,1500),safeToRestore:false}));
}finally{if(browser)await browser.close();if(server)await server.close()}
