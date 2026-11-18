// W9: two NEW browser-native tab-zoom 200% effective CSS widths (320,390).
// Fresh current-dev only, real Chrome MV3 chrome.tabs.setZoom/getZoom—not CSS zoom.
// First Tab is natural (no page element focus injection). Synthetic records/photo.
// Products/dev/PR/deployment must never be modified by this isolated QA.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV=process.env.WRONG_W9_DEV_SHA;
const EXPECTED='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(DEV,EXPECTED,'W9 must test pinned currently reviewed dev SHA');
const DB='uriaimath-github-qa-v224-only';
const PHOTO=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const h=bytes=>createHash('sha256').update(bytes).digest('hex');
const out='qa-proof/w9-native200';
mkdirSync(out,{recursive:true});
let preview,context,folder;
const report={sourceDevSha:DEV,status:'IN_PROGRESS',nativeZoomApi:'chrome.tabs.setZoom/getZoom',
 widths:{},checks:0,screenshots:[],pageErrors:[],externalRequests:[],photoFixtureSha256:h(PHOTO),
 actualPhysicalPhoneVerified:false,actualChromeMenuGestureVerified:false,
 actualFamilyAuthVerified:false,realUserPhotoVerified:false,
 productionChanged:false,safeToRestore:false};
async function shot(page,width,label){
 const name=out+'/'+width+'-'+String(report.screenshots.length+1).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path:name,fullPage:true,animations:'disabled'});
 report.screenshots.push(name);console.log('W9_NATIVE_PNG='+name);
}
function pass(width,label){
 report.checks++;console.log('W9_NATIVE_PASS '+width+' '+label);
}
async function snap(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
    rows=tx.objectStore('mistakes').getAll(),
    keys=tx.objectStore('photos').getAllKeys(),
    pics=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const photos=await Promise.all(keys.result.map(async(id,i)=>({
      id,type:pics.result[i].type,bytes:Array.from(new Uint8Array(await pics.result[i].arrayBuffer()))
     })));
     db.close();resolve({rows:rows.result,photos});
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
async function metrics(page){
 return page.evaluate(()=>({
  innerWidth:innerWidth,innerHeight:innerHeight,
  clientWidth:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  visualScale:visualViewport?.scale??null,
  cssHtmlZoom:document.documentElement.style.zoom||'',
  cssBodyZoom:document.body.style.zoom||'',
  focusId:document.activeElement?.id||'',
  activeTag:document.activeElement?.tagName||''
 }));
}
async function keyEnter(page,selector){
 const loc=page.locator(selector);
 await loc.focus();  // only AFTER natural first Tab is independently captured
 assert.equal(await loc.evaluate(el=>el===document.activeElement),true,'focus did not land on '+selector);
 await page.keyboard.press('Enter');
}
async function setNativeZoom(worker,page,amount){
 return worker.evaluate(async({url,amount})=>{
  const tabs=await chrome.tabs.query({});
  const tab=tabs.find(x=>x.url===url);
  if(!tab?.id)throw Error('local app tab not available to native Chrome zoom API');
  const before=await chrome.tabs.getZoom(tab.id);
  await chrome.tabs.setZoom(tab.id,amount);
  const after=await chrome.tabs.getZoom(tab.id);
  return {id:tab.id,before,after,api:'chrome.tabs.setZoom/getZoom'};
 },{url:page.url(),amount});
}
try{
 const auth={username:'w9-native-zoom-synthetic',password:randomBytes(26).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 folder=mkdtempSync(join(tmpdir(),'wrong-w9-native-zoom-'));
 writeFileSync(join(folder,'manifest.json'),JSON.stringify({
  manifest_version:3,name:'W9 ephemeral local native tab zoom',version:'1.0.0',
  permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
  background:{service_worker:'background.js'}
 }));
 writeFileSync(join(folder,'background.js'),"chrome.runtime.onInstalled.addListener(()=>{});");
 context=await chromium.launchPersistentContext(join(folder,'user-profile'),{
  channel:'chromium',headless:true,viewport:{width:640,height:900},deviceScaleFactor:1,
  httpCredentials:auth,
  args:['--disable-extensions-except='+folder,'--load-extension='+folder]
 });
 const worker=context.serviceWorkers()[0]||
  await context.waitForEvent('serviceworker',{timeout:15000});
 assert.ok(worker.url().startsWith('chrome-extension://'),'native zoom extension worker missing');
 for(const target of [320,390]){
  const page=await context.newPage();
  const physical=target*2;
  await page.setViewportSize({width:physical,height:940});
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
   report.externalRequests.push(url);return route.abort();
  });
  const result=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(result?.status(),200,'preview app HTTP 200 required');
  assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(DEV));
  const z1=await setNativeZoom(worker,page,1);
  assert.equal(z1.after,1);
  const at100=await metrics(page);
  assert.ok(Math.abs(at100.innerWidth-physical)<=3,'native 100% viewport wrong: '+JSON.stringify(at100));
  const zoom=await setNativeZoom(worker,page,2);
  assert.equal(zoom.after,2);
  await page.waitForFunction(w=>Math.abs(innerWidth-w)<=3,target,{timeout:15000});
  const at200=await metrics(page);
  assert.ok(Math.abs(at200.innerWidth-target)<=3,'native 200% viewport wrong: '+JSON.stringify(at200));
  assert.equal(at200.cssHtmlZoom,'','CSS zoom must not be used');
  assert.equal(at200.cssBodyZoom,'','CSS zoom must not be used');
  pass(target,'native Chrome tabs.setZoom confirmed 200%; CSS width '+at200.innerWidth);
  await page.bringToFront();
  // Native first Tab, before ANY locator.focus(), click(), or DOM focus.
  const beforeFirst=await page.evaluate(()=>({
   id:document.activeElement?.id||'',tag:document.activeElement?.tagName||''
  }));
  await page.keyboard.press('Tab');
  const first=await page.evaluate(()=>{
   const e=document.activeElement;
   const css=e?getComputedStyle(e):null;
   const r=e?.getBoundingClientRect();
   return {id:e?.id||'',tag:e?.tagName||'',
    focusVisible:e?.matches(':focus-visible')||false,
    display:css?.display,visibility:css?.visibility,
    rectWidth:r?.width||0,rectHeight:r?.height||0,
    withinViewport:!!r&&(r.bottom>0&&r.top<innerHeight),
    text:(e?.textContent||'').trim().slice(0,100)};
  });
  assert.ok(!['BODY','HTML'].includes(first.tag),'initial Tab did not focus interactive page element');
  assert.ok(first.rectWidth>0&&first.rectHeight>0,'initial Tab focused a dimensionless element');
  assert.equal(first.visibility,'visible','first Tab not visible');
  pass(target,'natural first Tab focus captured without artificial focus injection');
  await shot(page,target,'01-natural-first-tab-native200');

  await keyEnter(page,'#nav-add');
  await page.locator('#page-add:not(.hide)').waitFor({timeout:15000});
  const added=await metrics(page);
  assert.ok(added.scrollWidth<=added.clientWidth+3,'add form horizontal overflow '+JSON.stringify(added));
  await page.locator('#wrong007-subject').selectOption('math');
  await page.locator('#problem').focus();
  const originalProblem='W9 가상 오답 '+target+'px / 3+4= ?';
  await page.keyboard.insertText(originalProblem);
  await page.locator('#memo').focus();
  const parentMemo='W9 가상 부모 메모 '+target+' / 실사용자 정보 아님';
  await page.keyboard.insertText(parentMemo);
  await page.locator('#take-photo').setInputFiles({
   name:'w9-synthetic.png',mimeType:'image/png',buffer:PHOTO
  });
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
  await shot(page,target,'02-synthetic-photo-form-native200');
  await keyEnter(page,'#save-btn');
  await page.locator('#page-detail:not(.hide)').waitFor({timeout:15000});
  await page.locator('#detail-image img').waitFor({timeout:15000});
  const before=await snap(page);
  assert.equal(before.rows.length,1,'one saved synthetic record');
  assert.equal(before.photos.length,1,'one saved photo');
  assert.equal(before.rows[0].id,before.photos[0].id,'photo and record IDs differ');
  assert.equal(before.rows[0].problemText,originalProblem);
  assert.equal(before.rows[0].memo,parentMemo);
  const originalPhotoSha=h(Buffer.from(before.photos[0].bytes));
  pass(target,'keyboard registration and synthetic photo ID+SHA persisted');
  const observation='W9 가상 관찰 '+target+' / 다시 확인';
  await page.locator('#check-status').selectOption('needs_help');
  await page.locator('#check-memo').focus();
  await page.keyboard.insertText(observation);
  await keyEnter(page,'#check-save');
  await page.waitForFunction(v=>document.querySelector('#check-history')?.textContent?.includes(v),observation,{timeout:15000});
  const observed=await snap(page);
  assert.equal(observed.rows.length,1);
  assert.equal(observed.photos.length,1);
  assert.equal(h(Buffer.from(observed.photos[0].bytes)),originalPhotoSha);
  const detail=await metrics(page);
  assert.ok(detail.scrollWidth<=detail.clientWidth+3,'detail horizontal overflow '+JSON.stringify(detail));
  pass(target,'keyboard parent observation persisted, original photo SHA unchanged');
  await shot(page,target,'03-parent-observation-native200');
  await keyEnter(page,'#v218-child-mode');
  assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
  const child=await page.evaluate(({parentMemo,observation})=>({
   parentMemoInDOM:document.body.textContent.includes(parentMemo),
   observationInDOM:document.body.textContent.includes(observation),
   checkHistoryText:document.querySelector('#check-history')?.textContent||'',
   imageVisible:!!document.querySelector('#detail-image img')?.getClientRects().length
  }),{parentMemo,observation});
  assert.equal(child.parentMemoInDOM,false,'parent memo leaked into child DOM');
  assert.equal(child.observationInDOM,false,'parent observation leaked into child DOM');
  assert.equal(child.imageVisible,true,'saved photo not available to child');
  pass(target,'keyboard child presentation hides parent data and retains saved photo');
  await shot(page,target,'04-child-native200');
  await keyEnter(page,'#v218-parent-mode');
  assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
  const afterMode=await snap(page);
  assert.deepEqual(afterMode,observed,'mode switch mutated saved record or photo');
  const reload=await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(reload?.status(),200);
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#page-detail:not(.hide)').waitFor({timeout:15000});
  const afterReload=await snap(page);
  assert.deepEqual(afterReload,observed,'native zoom reload mutated saved record/photo');
  assert.equal(h(Buffer.from(afterReload.photos[0].bytes)),originalPhotoSha);
  const final=await metrics(page);
  assert.ok(final.scrollWidth<=final.clientWidth+3,'reentry horizontal overflow '+JSON.stringify(final));
  const nativeFinal=await setNativeZoom(worker,page,2);
  assert.equal(nativeFinal.after,2);
  pass(target,'parent reentry+reload retains record/photo bytes at native 200%');
  await shot(page,target,'05-parent-reload-native200');
  report.widths[target]={status:'PASS',physicalViewportWidth:physical,
   nativeZoomBefore:zoom.before,nativeZoomAfter:zoom.after,
   effectiveCssViewportWidth:at200.innerWidth,
   beforeFirst,firstTab:first,at100,at200,added,detail,final,child,
   savedRecordId:before.rows[0].id,photoByteCount:before.photos[0].bytes.length,
   photoSHA256:originalPhotoSha,modeAndReloadIDBExact:true};
  await page.close();
 }
 assert.equal(report.checks,12);
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.externalRequests,[]);
 report.status='PASS_W9_NATIVE_200_KEYBOARD_320_390';
}catch(e){
 report.status='FAIL';report.error=String(e);report.stack=String(e?.stack||'').slice(0,1800);
 console.error('W9_NATIVE_FAIL '+String(e));process.exitCode=1;
}finally{
 if(context)await context.close();
 if(preview)await preview.close();
 if(folder)rmSync(folder,{recursive:true,force:true});
 writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 console.log('W9_NATIVE_RESULT='+JSON.stringify({status:report.status,checks:report.checks,
  widths:report.widths,png:report.screenshots.length,errors:report.pageErrors.length,
  outside:report.externalRequests.length,error:report.error}));
 console.log('W9_NATIVE_EPHEMERAL_PROFILE_CLEANED');
}
