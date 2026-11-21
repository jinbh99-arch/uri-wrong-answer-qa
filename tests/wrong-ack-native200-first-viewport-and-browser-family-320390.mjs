// WRONG ACK follow-up: isolated native 200% zoom + first viewport + keyboard
// + two independent browser data containers, NOT actual family authentication.
// Runs once on the existing ACK-only QA branch. Never modifies dev or real data.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const PATCHED='63e31915875a79a2ebcf21d7c722daa9f8deeb98';
assert.equal(process.env.WRONG_ACK_DEV_SHA,DEV);
const OUT='qa-proof/ack-followup-native200-family-browser';
mkdirSync(OUT,{recursive:true});
const report={contract:'WRONG_ACK_FAMILY_BROWSER_AND_FIRST_VIEWPORT_NATIVE200',
 devSha:DEV,qaAppBlob:PATCHED,synthetic:true,
 actualFamilyAuthentication:'NOT_IMPLEMENTED_NOT_TESTED',
 browserContextIsolation:'TESTED_NOT_EQUIVALENT_TO_FAMILY_AUTH',
 actualPhone:'N/T',actualOperatingDB:'NOT_USED',safeToRestore:false,
 screenshotOrigin:'PLAYWRIGHT_PLUS_CDP',cases:[],screenshots:[],errors:[],
 externalRequests:[],jsErrors:[],nativeZoom:'chrome.tabs.setZoom/getZoom'};
const img=(buf)=>({sha256:createHash('sha256').update(buf).digest('hex'),
 width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)});
function save(name,bytes){
 const file=OUT+'/'+name+'.png';
 writeFileSync(file,bytes);
 const item={name,file,...img(bytes)};report.screenshots.push(item);return item;
}
async function screen(page,label,ctx){
 const playwright=save(label+'-playwright',await page.screenshot({
  fullPage:false,scale:'css',animations:'disabled'}));
 let cdp=null,error=null;
 try{
  const session=await ctx.newCDPSession(page);
  await session.send('Page.enable');
  const x=await session.send('Page.captureScreenshot',{
    format:'png',fromSurface:true,captureBeyondViewport:false});
  cdp=save(label+'-cdp',Buffer.from(x.data,'base64'));
  await session.detach();
 }catch(e){error=String(e)}
 return {playwright,cdp,error};
}
async function ledger(page){
 return page.evaluate(async()=>{
  const request=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{
   request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)});
  const stores=['mistakes','photos'];
  for(const s of stores)if(!db.objectStoreNames.contains(s))throw Error('MISSING_STORE_'+s);
  const tx=db.transaction(stores,'readonly');
  const ask=(store,method)=>new Promise((ok,no)=>{
   const x=tx.objectStore(store)[method]();
   x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error)});
  const [records,ids,photos,photoIds]=await Promise.all([
    ask('mistakes','getAll'),ask('mistakes','getAllKeys'),
    ask('photos','getAll'),ask('photos','getAllKeys')]);
  const images=await Promise.all(photos.map(async(b,i)=>({
    id:String(photoIds[i]),type:b.type,
    bytes:Array.from(new Uint8Array(await b.arrayBuffer()))
  })));
  db.close();
  return {records:records.map(x=>({
     id:x.id,problemText:x.problemText,memo:x.memo,hasPhoto:x.hasPhoto,
     childNickname:x.childNickname})),
   ids:ids.map(String),photos:images};
 });
}
function readable(snapshot){
 return {count:snapshot.records.length,ids:snapshot.ids,
  photoCount:snapshot.photos.length,
  photos:snapshot.photos.map(p=>({id:p.id,type:p.type,bytes:p.bytes.length,
   sha256:createHash('sha256').update(Buffer.from(p.bytes)).digest('hex')}))};
}
async function warningState(page){
 return page.evaluate(()=>{
  const e=document.querySelector('#form-error'),r=e.getBoundingClientRect();
  const style=getComputedStyle(e);
  const visible=!e.classList.contains('hide')&&style.display!=='none'&&
    style.visibility!=='hidden'&&r.width>0&&r.height>0&&
    r.left<innerWidth&&r.right>0&&r.top<innerHeight&&r.bottom>0;
  return {text:(e.textContent||'').slice(0,300),role:e.getAttribute('role'),
    ariaLive:e.getAttribute('aria-live'),
    rect:{x:r.x,y:r.y,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
    visible,scrollY,innerWidth,innerHeight,
    scrollWidth:document.documentElement.scrollWidth,
    activeId:document.activeElement?.id||null};
 });
}
async function privateMemo(page,memo){
 return page.evaluate(t=>({
   childActive:document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed')==='true',
   body:(document.body.textContent||'').includes(t),
   input:(document.querySelector('#memo')?.value||'').includes(t),
   detail:(document.querySelector('#detail-memo')?.textContent||'').includes(t)
 }),memo);
}
async function guardRoute(page,url){
 page.on('pageerror',e=>report.jsErrors.push(String(e)));
 await page.route('**/*',async route=>{
  const u=route.request().url();
  if(u===url&&route.request().resourceType()==='document'){
   const response=await route.fetch(),html=await response.text();
   const needle="const verifiedRecord=await readOne('mistakes',id);";
   assert.equal(html.split(needle).length,2);
   const patched="const verifiedRecord=await (window.__qaAckFailReadbackOnce ? "+
      "((window.__qaAckFailReadbackOnce=false),Promise.reject(new Error('SYNTHETIC_POST_COMMIT_READBACK_FAIL')))"+
      " : readOne('mistakes',id));";
   return route.fulfill({response,body:html.replace(needle,patched),
      contentType:'text/html; charset=utf-8'});
  }
  if(u.startsWith(url)||u.startsWith('blob:')||u.startsWith('data:'))return route.continue();
  report.externalRequests.push(u);return route.abort();
 });
}
async function enterFormByKeyboard(page){
 await page.bringToFront();
 assert.equal((await page.evaluate(()=>document.activeElement?.tagName)),'BODY');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('.qa16-skip').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>location.hash==='#qa-main');
 const afterSkip=await page.evaluate(()=>({focus:document.activeElement?.id,scrollY}));
 assert.equal(afterSkip.focus,'qa-main','first Tab/Enter must follow skip link');
 await page.locator('#nav-add').click();
 await page.locator('#page-add:not(.hide)').waitFor();
 return afterSkip;
}
async function addForm(page,label,memo){
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('가상 A/B 오답 '+label);
 await page.locator('#student-answer').fill('가상 아이의 답');
 await page.locator('#memo').fill(memo);
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
 await page.locator('#take-photo').setInputFiles({
   name:'synthetic-1px.png',mimeType:'image/png',buffer:tiny});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
}
async function saveByTabEnter(page){
 // From a real form select, move via natural Tab order to submit, then Enter.
 await page.locator('#reason').focus();
 const focusOrder=[];
 for(let n=0;n<15;n++){
  await page.keyboard.press('Tab');
  const id=await page.evaluate(()=>document.activeElement?.id||'');
  focusOrder.push(id||'(unnamed)');
  if(id==='save-btn')break;
 }
 assert.equal(focusOrder.at(-1),'save-btn','keyboard Tab did not reach submit');
 await page.keyboard.press('Enter');
 return focusOrder;
}
async function showChild(page,memo){
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#v218-child-mode').click();
 const state=await privateMemo(page,memo);
 assert.equal(state.childActive,true,'child role not actually active');
 assert.equal(state.body,false,'parent memo in child visible/hidden text');
 assert.equal(state.input,false,'parent memo in child input DOM');
 assert.equal(state.detail,false,'parent memo in child detail DOM');
 return state;
}
let preview,aContext,bBrowser,tempDir;
try{
 const username='ack-family-browser-qa',password=randomBytes(28).toString('hex');
 const credentials={username,password};
 preview=await startWrongQa66Preview({devSha:DEV,...credentials});
 tempDir=mkdtempSync(join(tmpdir(),'ack200-'));
 writeFileSync(join(tempDir,'manifest.json'),JSON.stringify({
  manifest_version:3,name:'ACK native zoom QA bridge',version:'1.0',
  permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
  background:{service_worker:'background.js'}}));
 writeFileSync(join(tempDir,'background.js'),"chrome.runtime.onInstalled.addListener(()=>{}); chrome.tabs.onUpdated.addListener(()=>{});");
 aContext=await chromium.launchPersistentContext(join(tempDir,'profile-A'),{
  channel:'chromium',headless:true,viewport:{width:640,height:920},
  deviceScaleFactor:1,args:['--disable-extensions-except='+tempDir,'--load-extension='+tempDir],
  httpCredentials:credentials,acceptDownloads:false});
 const worker=aContext.serviceWorkers()[0]||
  await aContext.waitForEvent('serviceworker',{timeout:15000});
 bBrowser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const a=await aContext.newPage();
  await a.setViewportSize({width:width*2,height:940});
  const bContext=await bBrowser.newContext({
   viewport:{width,height:850},httpCredentials:credentials,acceptDownloads:false});
  const b=await bContext.newPage();
  try{
   await guardRoute(a,preview.url);await guardRoute(b,preview.url);
   await a.goto(preview.url,{waitUntil:'domcontentloaded'});
   const zoom=await worker.evaluate(async({target})=>{
    const tabs=await chrome.tabs.query({});
    const tab=tabs.find(x=>x.url===target);
    if(!tab?.id)throw Error('ACK_ZOOM_TAB_NOT_FOUND');
    await chrome.tabs.setZoom(tab.id,1);
    const before=await chrome.tabs.getZoom(tab.id);
    await chrome.tabs.setZoom(tab.id,2);
    return {before,after:await chrome.tabs.getZoom(tab.id)};
   },{target:a.url()});
   assert.deepEqual([zoom.before,zoom.after],[1,2]);
   await a.waitForFunction(w=>innerWidth===w,width);
   const keyboard=await enterFormByKeyboard(a);
   const memoA='A 전용 가상 부모 메모 '+width;
   await addForm(a,'A-'+width,memoA);
   const base=readable(await ledger(a));assert.equal(base.count,0);
   await a.evaluate(()=>{window.__qaAckFailReadbackOnce=true});
   const tabOrder=await saveByTabEnter(a);
   await a.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('중복 등록하지 말고'),null,{timeout:15000});
   const atFailure=await warningState(a);
   const immediate=await screen(a,width+'-ack-immediate-native200',aContext);
   // The initial viewport means scrollY 0, independent of auto-scroll to save.
   await a.evaluate(()=>scrollTo(0,0));await a.waitForTimeout(100);
   const atTop=await warningState(a);
   const firstViewport=await screen(a,width+'-ack-scroll0-native200',aContext);
   // Re-submit must not mint a second UUID after readback failure.
   await a.locator('#save-btn').click();
   await a.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('재등록을 차단'));
   const aBefore=readable(await ledger(a));
   assert.equal(aBefore.count,1);assert.equal(aBefore.photoCount,1);
   await b.goto(preview.url,{waitUntil:'domcontentloaded'});
   const bBefore=readable(await ledger(b));
   assert.equal(bBefore.count,0,'fresh browser B must not read browser A');
   const memoB='B 전용 가상 부모 메모 '+width;
   await b.locator('#nav-add').click();await addForm(b,'B-'+width,memoB);
   await b.locator('#save-btn').click();
   await b.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
   const bAfter=readable(await ledger(b)),aAfter=readable(await ledger(a));
   assert.equal(bAfter.count,1);assert.equal(bAfter.photoCount,1);
   assert.deepEqual(aAfter,aBefore,'browser A ledger mutated by B');
   assert.notEqual(aBefore.ids[0],bAfter.ids[0],'browser IDs coincidentally duplicated');
   const childB=await showChild(b,memoB);
   const childA=await showChild(a,memoA);
   const aAfterChild=readable(await ledger(a)),bAfterChild=readable(await ledger(b));
   assert.deepEqual(aAfterChild,aBefore);
   assert.deepEqual(bAfterChild,bAfter);
   const childShot=await screen(a,width+'-A-child-native200',aContext);
   // Same profile, same localhost origin shares IDB: an actual family
   // authentication layer is NOT present. Never call this family separation.
   const sameProfile=await aContext.newPage();
   await guardRoute(sameProfile,preview.url);
   await sameProfile.goto(preview.url,{waitUntil:'domcontentloaded'});
   const sameProfileLedger=readable(await ledger(sameProfile));
   assert.equal(sameProfileLedger.count,1,'same-profile IDB access proves no family boundary');
   await sameProfile.close();
   const after=await a.evaluate(()=>({
    innerWidth,scrollWidth:document.documentElement.scrollWidth,
    nativeZoomCss:document.body.style.zoom||null,
    active:document.activeElement?.id||''
   }));
   assert.equal(after.innerWidth,width);
   assert.equal(after.nativeZoomCss,null,'CSS zoom is not native zoom');
   assert.ok(after.scrollWidth<=width+3);
   assert.ok(atFailure.rect.height>0&&atFailure.role==='alert');
   const item={width,zoom,keyboard,tabOrder,atFailure,atTop,
      firstViewportVisibleAtScroll0:atTop.visible,
      warningVisibleImmediatelyAfterEnter:atFailure.visible,
      firstViewportStatus:atTop.visible?'PASS':'FAIL_WARNING_BELOW_FIRST_VIEWPORT',
      immediate,firstViewport,childShot,
      browserContainers:{A:aBefore,B:bAfter,freshB:bBefore,
       sameOriginSameProfileLedger:sameProfileLedger,
       separateBrowserContainers:true,
       actualFamilyAuthentication:'NOT_IMPLEMENTED'},
      childA,childB,after,
      appSourceChanged:false};
   report.cases.push(item);
   console.log('ACK_FOLLOWUP_CASE='+JSON.stringify({
    width,zoom:zoom.after,warningScrollY:atFailure.scrollY,
    immediateVisible:atFailure.visible,topVisible:atTop.visible,
    warningTopAtScroll0:atTop.rect.top,firstViewportHeight:atTop.innerHeight,
    A:aBefore.count,B:bAfter.count,freshB:bBefore.count,
    sameBrowserProfileShowsA:sameProfileLedger.count,childMemo:false}));
  }finally{
   await bContext.close();await a.close();
  }
 }
 assert.equal(report.jsErrors.length,0,'JS errors detected');
 assert.equal(report.externalRequests.length,0,'external network attempted');
 report.status=report.cases.every(x=>x.firstViewportVisibleAtScroll0&&x.warningVisibleImmediatelyAfterEnter)?
  'SYNTHETIC_PASS_WITH_PRODUCT_FAMILY_AUTH_BLOCK':'PARTIAL_WARNING_VIEWPORT_OR_AUTH_BLOCK';
 report.productFamilyAuth='BLOCK_NOT_IMPLEMENTED';
 report.actualAuthentication='N/T';
 report.firstViewportAtScroll0Pass=report.cases.filter(x=>x.firstViewportVisibleAtScroll0).length;
 report.total=report.cases.length;
}catch(e){
 report.status='HARNESS_OR_CONTRACT_FAIL';report.errors.push(String(e?.stack||e));
 console.error('ACK_FOLLOWUP_FAILURE='+String(e?.stack||e));process.exitCode=1;
}finally{
 if(bBrowser)await bBrowser.close();
 if(aContext)await aContext.close();
 if(preview)await preview.close();
 if(tempDir)rmSync(tempDir,{recursive:true,force:true});
 report.pngCount=report.screenshots.length;
 writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log('ACK_FOLLOWUP_FINAL='+JSON.stringify({
  status:report.status,caseCount:report.cases.length,firstViewportAtScroll0Pass:report.firstViewportAtScroll0Pass,
  screenshotCount:report.pngCount,errors:report.errors,
  actualFamilyAuthentication:report.actualFamilyAuthentication}));
}
