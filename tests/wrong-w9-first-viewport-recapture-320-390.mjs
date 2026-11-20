// WRONG W9 viewport-origin follow-up: Chrome native zoom 200%, new evidence only.
// Synthetic localhost QA only. No app/prod mutation and no CI replay.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(process.env.WRONG_W9_DEV_SHA,DEV);
const OUT='qa-proof/w9-first-viewport-origin';
mkdirSync(OUT,{recursive:true});
const report={
  contract:'W9_FIRST_VIEWPORT_ORIGIN_A_ISOLATED',status:'IN_PROGRESS',devSha:DEV,
  appBlob:'250aff5b0a46490488b64f7b96a83c940d2d6c71',
  synthetic:true,actualFamily:false,actualPhone:false,screenReader:false,
  appModified:false,safeToRestore:false,scenarios:{},screenshots:[],
  externalRequests:[],pageErrors:[],captureErrors:[]
};
const pngInfo=(b)=>({width:b.readUInt32BE(16),height:b.readUInt32BE(20),
  sha256:createHash('sha256').update(b).digest('hex')});
function save(name,b){
  const file=OUT+'/'+name+'.png';writeFileSync(file,b);
  const info={name,file,...pngInfo(b)};report.screenshots.push(info);return info;
}
async function state(page) {
  return page.evaluate(()=>{
    const main=document.querySelector('main#qa-main');
    const banner=document.querySelector('#storage-banner');
    const rect=el=>el?el.getBoundingClientRect().toJSON():null;
    const range=document.createRange();
    if(banner)range.selectNodeContents(banner);
    const lines=banner?Array.from(range.getClientRects()).map(x=>({
      x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom
    })):[];
    const inViewport=lines.filter(x=>x.height>0&&x.width>0&&x.right>0&&
      x.x<innerWidth&&x.bottom>0&&x.y<innerHeight);
    const first=inViewport[0]||null;
    const cx=first?Math.min(innerWidth-1,Math.max(1,first.x+Math.min(15,first.width/2))):innerWidth/2;
    const cy=first?Math.min(innerHeight-1,Math.max(1,first.y+first.height/2)):15;
    const hit=document.elementFromPoint(cx,cy);
    const computed=banner?getComputedStyle(banner):null;
    return {
      href:location.href,hash:location.hash,scrollX,scrollY,
      innerWidth,innerHeight,dpr:devicePixelRatio,scrollHeight:document.documentElement.scrollHeight,
      scrollWidth:document.documentElement.scrollWidth,visualViewport:{
        offsetTop:visualViewport?.offsetTop??null,pageTop:visualViewport?.pageTop??null,
        height:visualViewport?.height??null,scale:visualViewport?.scale??null
      },focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id},
      main:rect(main),banner:rect(banner),
      bannerText:(banner?.textContent||'').trim().slice(0,180),
      bannerLines:lines,visibleBannerLine:first,
      hit:{x:cx,y:cy,tag:hit?.tagName||'',id:hit?.id||'',
        isInMain:!!(main&&hit&&main.contains(hit))},
      bannerDisplay:computed?.display,bannerVisibility:computed?.visibility,
      bannerOpacity:computed?.opacity,
      browserScreen:{width:screen.width,height:screen.height}
    };
  });
}
async function ledger(page){
  return page.evaluate(async()=>{
    if(!indexedDB.databases)return {supported:false};
    const defs=await indexedDB.databases();
    const items=[];
    for(const x of defs){
      if(!x.name)continue;
      const db=await new Promise((ok,no)=>{
        const rq=indexedDB.open(x.name);
        rq.onsuccess=()=>ok(rq.result);rq.onerror=()=>no(rq.error);
      });
      const stores=Array.from(db.objectStoreNames),counts={};
      for(const name of stores) {
        counts[name]=await new Promise((ok,no)=>{
          const t=db.transaction(name,'readonly');const rq=t.objectStore(name).count();
          rq.onsuccess=()=>ok(rq.result);rq.onerror=()=>no(rq.error);
        });
      }
      items.push({name:x.name,version:x.version,counts});db.close();
    }
    return {supported:true,items};
  });
}
let context,preview,dir;
try {
  const auth={username:'w9-first-viewport-synth',password:randomBytes(24).toString('hex')};
  preview=await startWrongQa66Preview({devSha:DEV,...auth});
  dir=mkdtempSync(join(tmpdir(),'wrong-w9-origin-'));
  writeFileSync(join(dir,'manifest.json'),JSON.stringify({
    manifest_version:3,name:'W9 ephemeral isolated viewport evidence',version:'1.0.0',
    permissions:['tabs','<all_urls>'],host_permissions:['http://127.0.0.1/*'],
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
  for(const width of [320,390]) {
    const page=await context.newPage();
    await page.setViewportSize({width:width*2,height:940});
    page.on('pageerror',e=>report.pageErrors.push(String(e)));
    await page.route('**/*',route=>{
      const u=route.request().url();
      if(u.startsWith(preview.url)||u.startsWith('blob:')||u.startsWith('data:'))
        return route.continue();
      report.externalRequests.push(u);return route.abort();
    });
    const response=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(DEV));
    await page.waitForTimeout(450);
    const beforeLedger=await ledger(page);
    const native=await worker.evaluate(async({url})=>{
      const tabs=await chrome.tabs.query({});
      const tab=tabs.find(t=>t.url===url);
      if(!tab?.id)throw Error('synthetic app tab not found');
      await chrome.tabs.setZoom(tab.id,1);
      const before=await chrome.tabs.getZoom(tab.id);
      await chrome.tabs.setZoom(tab.id,2);
      const after=await chrome.tabs.getZoom(tab.id);
      return {before,after,tabId:tab.id,windowId:tab.windowId};
    },{url:page.url()});
    assert.deepEqual([native.before,native.after],[1,2]);
    await page.waitForFunction(x=>innerWidth===x,width,{timeout:10000});
    await page.bringToFront();
    assert.equal((await state(page)).focus.tag,'BODY');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.qa16-skip').evaluate(el=>el===document.activeElement),true);
    const firstTab=await state(page);
    save(width+'-before-enter-playwright',await page.screenshot({
      fullPage:false,scale:'css',animations:'disabled'
    }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>location.hash==='#qa-main',{timeout:10000});
    const after=await state(page);
    assert.equal(after.focus.id,'qa-main');
    assert.ok(Math.abs(after.main.top)<4,'main must be at CSS viewport top');
    assert.equal(after.innerWidth,width);
    assert.ok(after.scrollWidth<=width+3,'unexpected horizontal overflow');
    // Assert DOM-visible text, but NOT screenshot-visible text here.
    assert.ok(after.visibleBannerLine,'main text must intersect actual CSS viewport');
    assert.ok(after.hit.isInMain,'elementFromPoint must hit real main content');
    const playwrightCapture=save(width+'-after-enter-playwright',await page.screenshot({
      fullPage:false,scale:'css',animations:'disabled'
    }));
    const cdp=await context.newCDPSession(page);
    const layout=await cdp.send('Page.getLayoutMetrics');
    await cdp.send('Page.enable');
    const captures={};
    for(const fromSurface of [true,false]){
      const label=fromSurface?'compositor':'view';
      try{
        const raw=await cdp.send('Page.captureScreenshot',{
          format:'png',fromSurface,captureBeyondViewport:false
        });
        captures[label]=save(width+'-after-enter-cdp-'+label,
          Buffer.from(raw.data,'base64'));
      }catch(e){
        report.captureErrors.push({width,method:'cdp-'+label,error:String(e)});
        captures[label]={error:String(e)};
      }
    }
    await cdp.detach();
    // chrome.tabs.captureVisibleTab reads the currently visible native tab,
    // rather than Playwright's Page.screenshot() pipeline.
    let browserCapture;
    try {
      const data=await worker.evaluate(async({windowId})=>{
        return await chrome.tabs.captureVisibleTab(windowId,{format:'png'});
      },{windowId:native.windowId});
      browserCapture=save(width+'-after-enter-browser-tab',Buffer.from(
        data.substring(data.indexOf(',')+1),'base64'));
    }catch(e){
      report.captureErrors.push({width,method:'browser-tab',error:String(e)});
      browserCapture={error:String(e)};
    }
    const afterLedger=await ledger(page);
    assert.deepEqual(afterLedger,beforeLedger,'synthetic IDB ledger changed');
    report.scenarios[width]={
      status:'DOM_PASS_SCREENSHOT_CROSSCHECK_REQUIRED',
      native,firstTab,after,layout,
      beforeLedger,afterLedger,
      capture:{playwright:playwrightCapture,cdp:captures,browserTab:browserCapture}
    };
    console.log('W9_ORIGIN_WIDTH='+JSON.stringify({
      width,zoom:native.after,scrollY:after.scrollY,mainTop:after.main.top,
      firstTextTop:after.visibleBannerLine.y,firstTextHit:after.hit.isInMain,
      captureSizes:{playwright:playwrightCapture,cdp:captures,browserTab:browserCapture},
      dbUnchanged:true
    }));
    await page.close();
  }
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.externalRequests,[]);
  report.status='DOM_PASS_IMAGE_INDEPENDENT_REVIEW_PENDING';
} catch(e){
  report.status='FAIL';report.error=String(e);report.stack=String(e.stack||'').slice(0,2000);
  console.error('W9_ORIGIN_FAIL '+String(e));process.exitCode=1;
} finally {
  await context?.close();await preview?.close();
  if(dir)rmSync(dir,{recursive:true,force:true});
  writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));
  console.log('W9_ORIGIN_FINAL='+JSON.stringify({
    status:report.status,widths:Object.keys(report.scenarios),
    screenshots:report.screenshots.length,
    captureErrors:report.captureErrors,pageErrors:report.pageErrors,
    externalRequests:report.externalRequests
  }));
}
