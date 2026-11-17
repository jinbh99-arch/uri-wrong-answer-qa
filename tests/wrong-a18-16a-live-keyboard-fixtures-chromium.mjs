// A18-16a: real app independent clean/locked IndexedDB storage state.
 // Keyboard Tab + persistent screen reader live region, NO destructive click.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const APP='f3f0d3c2dffce09ed7af613238aa7f8a92708c35',DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const DB='uriaimath-github-qa-v224-only',DIR='qa-proof/wrong-a18-16a';
function hashGitBlob(content){return createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex')}
assert.equal(hashGitBlob(readFileSync('index.html')),APP);
mkdirSync(DIR,{recursive:true});
const output={result:'RUNNING',widths:{},testCases:[],screenReaderHardware:'NOT_TESTED',safeToRestore:false,externalRequests:[],pageErrors:[],photosUsed:'SYNTHETIC_ONLY',noDestructiveClick:true};
let preview,browser;
async function seed(page,locked){
 await page.evaluate(({name,locked})=>new Promise((resolve,reject)=>{
   const r=indexedDB.open(name);r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('settings','readwrite');
    const store=tx.objectStore('settings');
    store.put({nickname:'QA 가상 보호자',grade:3,subject:'math'},'profile');
    if(locked)store.put({sample:true,receipt:'SYNTHETIC_UNKNOWN_PENDING'},'wrongA012PendingCreateV1');
    tx.onerror=()=>{db.close();reject(tx.error)};
    tx.oncomplete=()=>{db.close();resolve()};
   };
 }),{name:DB,locked});
}
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const r=indexedDB.open(name);r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['mistakes','photos','settings'],'readonly'),out={};
   for(const storeName of ['mistakes','photos','settings']){
    const store=tx.objectStore(storeName),keys=store.getAllKeys(),vals=store.getAll();
    keys.onsuccess=()=>{out[storeName+'Keys']=keys.result};
    vals.onsuccess=()=>{out[storeName+'Values']=vals.result};
   }
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const photoValues=await Promise.all(out.photosValues.map(async b=>Array.from(new Uint8Array(await b.arrayBuffer()))));
     out.photosValues=photoValues;db.close();resolve(out);
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
try{
 const auth={username:'wrong-a18-16a-qa',password:randomBytes(18).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390])for(const locked of [false,true]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?780:860},httpCredentials:auth});
  const page=await ctx.newPage();
  page.on('pageerror',e=>output.pageErrors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
   output.externalRequests.push(url);return route.abort();
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:16000});
  await seed(page,locked);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(expected=>{
   const s=document.getElementById('storage-state')?.textContent||'';
   return expected?s.startsWith('저장 차단:'):s.startsWith('저장소 연결:');
  },locked,{timeout:16000});
  await page.locator('#nav-settings').click();
  const before=await snapshot(page);
  assert.deepEqual(before.settingsKeys.sort(),locked?['profile','wrongA012PendingCreateV1']:['profile']);
  const field=page.locator('#profile-form button[type="submit"]');
  await field.focus();await page.keyboard.press('Tab');
  const pre=await page.evaluate(()=>{
   const b=document.getElementById('clear-all'),live=document.getElementById('a18-16-clear-live');
   const style=getComputedStyle(b),liveStyle=getComputedStyle(live),outline=getComputedStyle(b).outlineStyle;
   return {
    name:b.textContent.trim(),role:b.getAttribute('role')||b.tagName.toLowerCase(),disabled:b.disabled,
    focusId:document.activeElement?.id,outline,outlineWidth:style.outlineWidth,
    focusElementVisible:!!b.getClientRects().length,liveRole:live.getAttribute('role'),
    live:live.getAttribute('aria-live'),atomic:live.getAttribute('aria-atomic'),
    liveVisible:!!live.getClientRects().length&&liveStyle.display!=='none',
    liveTextBefore:live.textContent,storageText:document.getElementById('storage-state')?.textContent
   };
  });
  assert.equal(pre.role,'button');assert.ok(pre.name.includes('기록과 사진 삭제'));
  assert.equal(pre.disabled,false);assert.equal(pre.focusId,'clear-all','real keyboard Tab did not focus clear-all');
  assert.notEqual(pre.outline,'none','focus visible ring missing');
  assert.equal(pre.liveRole,'status');assert.equal(pre.live,'polite');assert.equal(pre.atomic,'true');
  assert.equal(pre.liveVisible,true);assert.equal(pre.liveTextBefore,'');
  const announce=await page.evaluate(async()=>{
   const live=document.getElementById('a18-16-clear-live');
   const mutations=[];
   const obs=new MutationObserver(events=>mutations.push(...events.map(x=>({type:x.type,text:live.textContent}))));
   obs.observe(live,{childList:true,subtree:true,characterData:true});
   const warning=window.__wrongA1816ReadOnlyAnnounce();
   await new Promise(resolve=>requestAnimationFrame(resolve));obs.disconnect();
   return {warning,text:live.textContent,mutations,
    ariaLive:live.getAttribute('aria-live'),ariaAtomic:live.getAttribute('aria-atomic'),
    toast:document.getElementById('toast').textContent,
    dialogsOpen:document.getElementById('confirm-dialog').open,
    stillFocused:document.activeElement?.id};
  });
  assert.ok(announce.mutations.length,'live warning DOM update not observed');
  assert.equal(announce.text,announce.warning);assert.equal(announce.toast,announce.warning);
  assert.ok(announce.warning.includes('전체 삭제는 복원 안전성 검증 전까지 보류됩니다'));
  assert.equal(announce.warning.includes('안전 점검이 끝나기 전에는'),locked);
  assert.equal(announce.dialogsOpen,false);assert.equal(announce.stillFocused,'clear-all');
  assert.deepEqual(await snapshot(page),before,'read-only notification mutated real app IDB');
  const filepath=DIR+'/clear-a11y-'+width+'-'+(locked?'locked':'clean')+'.png';
  await page.screenshot({path:filepath,animations:'disabled',fullPage:true});
  output.testCases.push({width,state:locked?'locked':'clean',result:'PASS',focus:'keyboard-tab',status:locked?'저장 차단':'저장소 연결',
   warningLength:announce.warning.length,liveMutationCount:announce.mutations.length,role:pre.role,
   outlineWidth:pre.outlineWidth,photoOrDataChanged:false,destructiveClick:false,screenshot:filepath});
  await ctx.close();
 }
 assert.deepEqual(output.externalRequests,[]);assert.deepEqual(output.pageErrors,[]);
 output.result='PASS_CLEAN_AND_LOCKED_LIVE_STATUS_KEYBOARD_NO_DELETE';
}catch(e){output.result='FAIL';output.error=String(e);output.stack=String(e?.stack||'').slice(0,2200);process.exitCode=1;console.error('A1816A_FAIL '+String(e))}
finally{
 await browser?.close();await preview?.close();
 output.appSourceUnchanged=hashGitBlob(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(output,null,2));
 console.log('A1816A_RESULT='+JSON.stringify({result:output.result,scenarios:output.testCases.length,views:[...new Set(output.testCases.map(x=>x.width))],
   liveEvents:output.testCases.reduce((s,x)=>s+x.liveMutationCount,0),screenshots:output.testCases.length,
   externalRequests:output.externalRequests.length,pageErrors:output.pageErrors.length,appSourceUnchanged:output.appSourceUnchanged,error:output.error}));
}