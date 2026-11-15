// QA87 / W7 NEW synthetic rollback probe of the ACTUAL app's v23/v22
// atomic IndexedDB restore guard, isolated named test DB only.
// It does not use a real account, production IndexedDB, or restore user data.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA87_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const dir='qa-proof/qa87';mkdirSync(dir,{recursive:true});
let preview,browser,checks=0,shots=0;
const pass=t=>{checks++;console.log('PASS QA87 '+t)};
async function shot(page,name){
 const path=dir+'/'+String(++shots).padStart(2,'0')+'-'+name+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 console.log('QA87_SCREENSHOT='+path);
}
async function snapshot(page){
 return page.evaluate(async()=>{
  const db=window.__qa87db,tx=db.transaction(['mistakes','photos','settings'],'readonly');
  const req=(name,method)=>new Promise((ok,no)=>{
   const x=tx.objectStore(name)[method]();x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error);
  });
  const [r,rids,p,pids,s,sids]=await Promise.all([
   req('mistakes','getAll'),req('mistakes','getAllKeys'),
   req('photos','getAll'),req('photos','getAllKeys'),
   req('settings','getAll'),req('settings','getAllKeys')]);
  const photos=await Promise.all(p.map(async(b,i)=>({
   id:pids[i],mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))
  })));
  return {rows:rids.map((id,i)=>({id,value:r[i]})),
   photos,settings:sids.map((id,i)=>({id,value:s[i]}))};
 });
}
function digest(obj){return createHash('sha256').update(JSON.stringify(obj)).digest('hex')}
async function marks(page){
 return page.evaluate(async()=>({
  base:await v22CaptureRestoreBaseline(window.__qa87db),
  photos:await v23CapturePhotoFingerprints(window.__qa87db)
 }));
}
async function restoreAttempt(page,mark,uncloneable=false){
 return page.evaluate(async({mark,uncloneable})=>{
  const db=window.__qa87db;
  const one={id:'qa87-staged-one',problemText:'QA87 staged replacement A',hasPhoto:true};
  const two={id:'qa87-staged-two',problemText:'QA87 staged replacement B',hasPhoto:true};
  if(uncloneable)two.notCloneable=()=>{};
  const items=[one,two],imgs={
   [one.id]:new Blob([new Uint8Array([7,8,9])],{type:'image/png'}),
   [two.id]:new Blob([new Uint8Array([9,8,7])],{type:'image/png'})
  };
  try{
   await v23RestoreWithPhotoCheck(items,imgs,{nickname:'가상 부모',grade:3},
    mark.base,mark.photos,db,false);
   return {ok:true};
  }catch(error){return {ok:false,code:error?.code||null,
    name:error?.name||null,message:String(error?.message||error).slice(0,180)}}
 },{mark,uncloneable});
}
async function setPhoto(page,bytes){
 return page.evaluate(async data=>{
  const db=window.__qa87db,tx=db.transaction('photos','readwrite');
  tx.objectStore('photos').put(new Blob([new Uint8Array(data)],{type:'image/png'}),'qa87-a');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error)});
 },bytes);
}
async function writeValue(page,store,key,value){
 return page.evaluate(async({store,key,value})=>{
  const db=window.__qa87db,tx=db.transaction(store,'readwrite');
  tx.objectStore(store).put(value,key);
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error)});
 },{store,key,value});
}
async function proof(page,heading,lines){
 await page.evaluate(({heading,lines})=>{
  document.querySelector('#qa87-proof')?.remove();
  const panel=document.createElement('section');panel.id='qa87-proof';panel.setAttribute('role','status');
  panel.style.cssText='background:white;color:#132238;border:2px solid #334;padding:16px;margin:10px;overflow-wrap:anywhere;font:16px/1.6 sans-serif';
  const h=document.createElement('h2');h.textContent=heading;panel.append(h);
  for(const text of lines){const p=document.createElement('p');p.textContent=text;panel.append(p)}
  document.body.prepend(panel);
 },{heading,lines});
}
try{
 const username='qa87-temporary-local',password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username,password},acceptDownloads:false});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))external.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 const seeded=await page.evaluate(async()=>{
  assertRestoreFns();
  const name='wrong-qa87-synthetic-'+crypto.randomUUID();
  const req=indexedDB.open(name,1);
  const db=await new Promise((ok,no)=>{
   req.onupgradeneeded=()=>{
    for(const n of ['mistakes','photos','settings'])req.result.createObjectStore(n);
   };
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  });
  window.__qa87db=db;window.__qa87name=name;
  const tx=db.transaction(['mistakes','photos','settings'],'readwrite');
  tx.objectStore('mistakes').put({id:'qa87-a',problemText:'가상 A 원본',hasPhoto:true,checkHistory:[{at:'2026-11-14T12:00:00Z',status:'needs_help'}]},'qa87-a');
  tx.objectStore('mistakes').put({id:'qa87-b',problemText:'가상 B 원본',hasPhoto:true,checkHistory:[]},'qa87-b');
  tx.objectStore('photos').put(new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'}),'qa87-a');
  tx.objectStore('photos').put(new Blob([new Uint8Array([5,6,7,8])],{type:'image/png'}),'qa87-b');
  tx.objectStore('settings').put({nickname:'가상 부모',grade:3,subject:'math'},'profile');
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error)});
  return {testDb:true,stores:[...db.objectStoreNames]};
  function assertRestoreFns(){
   if(typeof v22CaptureRestoreBaseline!=='function'||
      typeof v23CapturePhotoFingerprints!=='function'||
      typeof v23RestoreWithPhotoCheck!=='function')
    throw Error('Actual app guard functions unavailable');
  }
 });
 assert.deepEqual(seeded.stores,['mistakes','photos','settings']);
 const first=await snapshot(page);
 assert.equal(first.rows.length,2);assert.equal(first.photos.length,2);
 const firstHash=digest(first);
 pass('two isolated synthetic records/photos/settings and actual app guard are ready');

 // CASE 1: photo-only change with IDENTICAL size/type must abort v23 before write.
 let m=await marks(page);
 await setPhoto(page,[9,9,9,9]);
 const changedPhoto=await snapshot(page);
 let a=await restoreAttempt(page,m);
 assert.equal(a.ok,false);assert.equal(a.code,'V22_RESTORE_CHANGED');
 assert.deepEqual(await snapshot(page),changedPhoto);
 assert.notEqual(digest(changedPhoto),firstHash);
 pass('same-size/type photo byte change rejects before any backup restore writes');
 await proof(page,'QA87 합성 원자 복원 차단: 사진 바이트 변경',[
  '상태: V22_RESTORE_CHANGED · 원장 2건 유지',
  '사진 크기와 MIME이 같아도 SHA-256 지문 변경을 감지',
  '실가족 저장소 또는 복원 파일 사용 0']);
 await shot(page,'photo-byte-conflict-before-write');

 // CASE 2: record modified by sibling writer AFTER state snapshot.
 m=await marks(page);
 const current=await snapshot(page);
 const changed={...current.rows.find(x=>x.id==='qa87-b').value,problemText:'가상 B 동시 갱신'};
 await writeValue(page,'mistakes','qa87-b',changed);
 const changedLedger=await snapshot(page);
 a=await restoreAttempt(page,m);
 assert.equal(a.ok,false);assert.equal(a.code,'V22_RESTORE_CHANGED');
 assert.deepEqual(await snapshot(page),changedLedger);
 pass('concurrent record write detected by guarded IndexedDB readwrite transaction');

 // CASE 3: midtransaction DataCloneError after clear is queued -> all stores rollback.
 m=await marks(page);
 const beforeAbort=await snapshot(page);
 a=await restoreAttempt(page,m,true);
 assert.equal(a.ok,false,'uncloneable staged record unexpectedly committed');
 assert.ok(a.name==='DataCloneError'||/clone|object|function/i.test(a.message));
 assert.deepEqual(await snapshot(page),beforeAbort,
  'partial staged record/photo or settings persisted after aborted transaction');
 pass('mid-transaction invalid record aborts and rolls back both records/photos/settings');

 // CASE 4: unknown future settings should fail closed before any destructive clear.
 await writeValue(page,'settings','future-encrypted-flag',{protected:true});
 m=await marks(page);
 const beforeUnknown=await snapshot(page);
 a=await restoreAttempt(page,m);
 assert.equal(a.ok,false);
 assert.match(a.message,/알 수 없는 사용자 설정/);
 assert.deepEqual(await snapshot(page),beforeUnknown);
 pass('unknown settings field refuses destructive restore and preserves bytes');

 await proof(page,'QA87 실제 앱 복원 가드 · 가상 IndexedDB 4종 실패 주입',[
  '사진 동형 바이트 변경 차단 PASS',
  '동시 원장 갱신 차단 PASS',
  '중간 쓰기 예외 원자 롤백 PASS',
  '새 설정 필드 손실 방지 PASS',
  '실제 복원 실행·가족 인증·외부 DB: 미검증',
  'safeToRestore:false · 코드·운영 데이터 변경 0']);
 await shot(page,'guard-4-failclosed-synthetic-result');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('no JavaScript errors, external requests or 320px overflow');
 await page.evaluate(async()=>{
  const db=window.__qa87db,name=window.__qa87name;
  db.close();delete window.__qa87db;delete window.__qa87name;
  await new Promise((ok,no)=>{
   const r=indexedDB.deleteDatabase(name);
   r.onsuccess=ok;r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('QA87 cleanup blocked'));
  });
 });
 pass('ephemeral QA-only IndexedDB deleted after evidence capture');
 console.log('QA87_RESULT='+JSON.stringify({status:'PASS',checks,shots,
  realChromium:true,viewport:320,actualAppGuardFunctions:true,
  alteredPhotoSameMetadataBlocked:true,concurrentRecordBlocked:true,
  midTransactionAbortAtomic:true,unknownSettingsBlocked:true,
  originalSyntheticStorageOnly:true,productionDataTouched:false,
  actualRestoreApproved:false,safeToRestore:false,realFamilyAuthVerified:false}));
 writeFileSync(dir+'/qa87-result.json',JSON.stringify({sourceDevSha:SHA,status:'PASS',checks,shots,
  testTypes:['photo-content-conflict','concurrent-ledger-update','midtransaction-dataclone-abort','future-settings'],
  ephemeralDbDeleted:true,safeToRestore:false},null,2));
 await ctx.close();
}catch(e){
 console.error('QA87_RESULT='+JSON.stringify({status:'FAIL',checks,shots,error:String(e),
  stack:String(e?.stack).slice(0,1300),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
