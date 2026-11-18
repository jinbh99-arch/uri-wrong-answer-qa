// W9 new delta: after prior Chrome-native 200% 320/390 QA success,
// verify ACTUAL first Tab skip-link activation and DOM text geometry separately
// from potentially cropped Playwright screenshots. QA-only. No product changes.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV=process.env.WRONG_W9_DEV_SHA;
assert.equal(DEV,'3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b');
const output='qa-proof/w9-skiplink-native200';
mkdirSync(output,{recursive:true});
const report={sourceDevSha:DEV,status:'IN_PROGRESS',scenarios:{},
 screenshots:[],pageErrors:[],externalRequests:[],
 actualPhone:false,screenReader:false,manualChromeMenu:false,deviceDprCaptureNotProven:true,
 safeToRestore:false,productModified:false};
let preview,context,dir;
const pngWidth=b=>b.readUInt32BE(16),pngHeight=b=>b.readUInt32BE(20);
async function take(page,name,opts={}){
 const p=output+'/'+name+'.png';
 const b=await page.screenshot({path:p,animations:'disabled',...opts});
 report.screenshots.push({name,pngWidth:pngWidth(b),pngHeight:pngHeight(b),path:p});
}
async function metrics(page){
 return page.evaluate(()=>{
  const keys=['.qa16-skip','.hero-title','.hero-text','.brand','.header-badge','main#qa-main'];
  const els=Object.fromEntries(keys.map(selector=>{
   const el=document.querySelector(selector);
   const r=el?.getBoundingClientRect(),c=el?getComputedStyle(el):null;
   const range=document.createRange();
   if(el)range.selectNodeContents(el);
   const boxes=el?Array.from(range.getClientRects()).map(x=>({
     left:+x.left.toFixed(2),right:+x.right.toFixed(2),
     top:+x.top.toFixed(2),bottom:+x.bottom.toFixed(2),
     width:+x.width.toFixed(2)
   })):[];
   return [selector,{exists:!!el,text:(el?.textContent||'').trim().slice(0,200),
    focus:el===document.activeElement,cssDisplay:c?.display,visibility:c?.visibility,
    overflowX:c?.overflowX,whiteSpace:c?.whiteSpace,
    scrollWidth:el?.scrollWidth??null,clientWidth:el?.clientWidth??null,
    rect:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null,
    rangeFragments:boxes,
    fragmentsOutsideViewport:boxes.filter(x=>x.right>innerWidth+3||x.left< -3),
    elementOutsideViewport:!!r&&(r.right>innerWidth+3||r.left< -3)}];
  }));
  return {cssInnerWidth:innerWidth,cssInnerHeight:innerHeight,devicePixelRatio,
   visualViewportScale:visualViewport?.scale,
   documentScrollWidth:document.documentElement.scrollWidth,
   htmlZoom:document.documentElement.style.zoom||'',
   bodyZoom:document.body.style.zoom||'',
   focused:{id:document.activeElement?.id||'',tag:document.activeElement?.tagName||'',
     className:document.activeElement?.className||''},
   hash:location.hash,scrollY,els};
 });
}
try{
 const auth={username:'w9-skiplink-synthetic',password:randomBytes(24).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 dir=mkdtempSync(join(tmpdir(),'wrong-w9-skip-'));
 writeFileSync(join(dir,'manifest.json'),JSON.stringify({
  manifest_version:3,name:'W9 isolated native zoom skip-link',version:'1.0.0',
  permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
  background:{service_worker:'background.js'}
 }));
 writeFileSync(join(dir,'background.js'),"chrome.runtime.onInstalled.addListener(()=>{});");
 context=await chromium.launchPersistentContext(join(dir,'profile'),{
  channel:'chromium',headless:true,viewport:{width:640,height:940},
  deviceScaleFactor:1,httpCredentials:auth,
  args:['--disable-extensions-except='+dir,'--load-extension='+dir]
 });
 const worker=context.serviceWorkers()[0]||
  await context.waitForEvent('serviceworker',{timeout:15000});
 assert.ok(worker.url().startsWith('chrome-extension://'));
 for(const width of [320,390]){
  const page=await context.newPage();
  await page.setViewportSize({width:width*2,height:940});
  page.on('pageerror',err=>report.pageErrors.push(String(err)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('blob:')||url.startsWith('data:'))
     return route.continue();
   report.externalRequests.push(url);return route.abort();
  });
  const response=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(DEV));
  const native=await worker.evaluate(async({url})=>{
   const tabs=await chrome.tabs.query({}),t=tabs.find(x=>x.url===url);
   if(!t?.id)throw Error('native browser tab not discovered');
   await chrome.tabs.setZoom(t.id,1);
   const before=await chrome.tabs.getZoom(t.id);
   await chrome.tabs.setZoom(t.id,2);
   const after=await chrome.tabs.getZoom(t.id);
   return {before,after,tabId:t.id};
  },{url:page.url()});
  assert.equal(native.before,1);assert.equal(native.after,2);
  await page.waitForFunction(n=>innerWidth===n,width,{timeout:10000});
  await page.bringToFront();
  const beforeTab=await metrics(page);
  assert.equal(beforeTab.focused.tag,'BODY','natural first Tab must begin from body');
  await page.keyboard.press('Tab');
  const focused=await metrics(page);
  const link=page.locator('.qa16-skip');
  assert.equal(await link.evaluate(x=>x===document.activeElement),true,
    'first Tab must reach the accessible skip link');
  assert.equal(await link.getAttribute('href'),'#qa-main');
  assert.equal(focused.els['.qa16-skip'].visibility,'visible');
  assert.ok(!focused.els['.qa16-skip'].elementOutsideViewport,
    'focused skip link rectangle outside CSS viewport');
  assert.equal(focused.els['.qa16-skip'].fragmentsOutsideViewport.length,0,
    'focused skip link text glyph geometry outside CSS viewport');
  assert.ok(focused.documentScrollWidth<=width+3,
    'document overflows horizontally at native zoom 200%');
  await take(page,width+'-firsttab-page-viewport',{fullPage:false,scale:'css'});
  await take(page,width+'-firsttab-link-element',{fullPage:false,clip:{
   x:Math.max(0,focused.els['.qa16-skip'].rect.left),
   y:Math.max(0,focused.els['.qa16-skip'].rect.top),
   width:Math.min(width,focused.els['.qa16-skip'].rect.width),
   height:Math.min(focused.cssInnerHeight,focused.els['.qa16-skip'].rect.height)
  }});
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>location.hash==='#qa-main',{timeout:10000});
  const afterEnter=await metrics(page);
  const main=await page.locator('#qa-main').evaluate(el=>({
   focus:el===document.activeElement,
   tabIndex:el.tabIndex,rect:el.getBoundingClientRect().toJSON(),
   targetExists:!!el
  }));
  assert.equal(afterEnter.hash,'#qa-main','Enter must jump to real main target');
  assert.equal(main.tabIndex,-1,'main target must be programmatically focusable');
  assert.equal(main.focus,true,'skip activation must transfer focus to main');
  await take(page,width+'-after-skip-enter',{fullPage:false,scale:'css'});
  const capture=report.screenshots.filter(x=>x.name.startsWith(width+'-'));
  report.scenarios[width]={status:'PASS',physicalViewportWidth:width*2,native,
   beforeTab,focused,afterEnter,main,capture,
   textRectWarnings:Object.entries(focused.els).filter(([k,v])=>v.fragmentsOutsideViewport.length>0)
     .map(([key,v])=>({key,rects:v.fragmentsOutsideViewport})),
   screenshotCropCannotBeProvenFromPNG:true};
  console.log('W9_SKIP_200_RESULT_WIDTH='+JSON.stringify({
   width,status:'PASS',nativeZoom:native.after,
   cssWidth:focused.cssInnerWidth,skipRight:focused.els['.qa16-skip'].rect.right,
   skipGlyphOut:focused.els['.qa16-skip'].fragmentsOutsideViewport.length,
   mainFocused:main.focus,hash:afterEnter.hash,
   textGeometryWarnings:report.scenarios[width].textRectWarnings.length
  }));
  await page.close();
 }
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);
 report.status='PASS_W9_SKIP_TARGET_NATIVE200_320_390';
}catch(e){report.status='FAIL';report.error=String(e);
 report.stack=String(e?.stack||'').slice(0,1500);
 console.error('W9_SKIP_FAIL '+String(e));process.exitCode=1;
}finally{
 await context?.close();await preview?.close();
 if(dir)rmSync(dir,{recursive:true,force:true});
 writeFileSync(output+'/result.json',JSON.stringify(report,null,2));
 console.log('W9_SKIP_RESULT='+JSON.stringify({status:report.status,
  widths:Object.keys(report.scenarios),screenshots:report.screenshots.length,
  pageErrors:report.pageErrors.length,externalRequests:report.externalRequests.length,
  error:report.error}));
 console.log('W9_SKIP_EPHEMERAL_PROFILE_CLEANED');
}
