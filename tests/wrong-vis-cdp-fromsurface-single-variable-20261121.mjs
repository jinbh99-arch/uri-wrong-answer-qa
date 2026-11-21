// 00Q-02-VIS, one NEW isolated CI: CDP fromSurface false vs true.
// No old VIS/ACK test rerun, no product change, no family credentials/data.
import assert from 'node:assert/strict';
import { randomBytes,createHash } from 'node:crypto';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { startWrongQa66Preview } from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
assert.equal(process.env.WRONG_VIS_FROM_SURFACE_DEV_SHA,DEV);
const OUT='qa-proof/vis-cdp-fromsurface-single-variable';
mkdirSync(OUT,{recursive:true});
const proof={contract:'VIS_CDP_FROM_SURFACE_ONLY',sourceDevSha:DEV,
  nativeZoom:2,playwrightImmediateExisting:'FAIL_NOT_RERUN',
  syntheticOnly:true,actualFamilyAuthentication:'BLOCK',safeToRestore:false,
  cases:[],errors:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function colors(page,buffer){
 return page.evaluate(async b64=>{
  const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const bmp=await createImageBitmap(new Blob([u],{type:'image/png'}));
  const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bmp,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
  const unique=new Set(),stride=Math.max(1,Math.floor(c.width*c.height/4096));
  for(let i=0;i<c.width*c.height;i+=stride){
   const p=i*4;unique.add((data[p]<<24)|(data[p+1]<<16)|(data[p+2]<<8)|data[p+3]);
  }
  bmp.close();return unique.size;
 },buffer.toString('base64'));
}
async function geometry(page){
 return page.evaluate(()=>({
  innerWidth,innerHeight,scrollY,devicePixelRatio,
  visualWidth:visualViewport?.width??null,visualScale:visualViewport?.scale??null,
  topWarning:(()=>{const e=document.querySelector('#wrong-ack-top-warning'),r=e?.getBoundingClientRect();return {text:e?.textContent?.slice(0,100),top:r?.top,bottom:r?.bottom}})(),
  formError:(()=>{const e=document.querySelector('#form-error'),r=e?.getBoundingClientRect();return {text:e?.textContent?.slice(0,100),top:r?.top,bottom:r?.bottom}})()
 }));
}
let preview,context,root;
try{
 const user='vis-single-var-'+randomBytes(4).toString('hex');
 const pass=randomBytes(22).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:user,password:pass});
 root=mkdtempSync(join(tmpdir(),'wrong-vis-one-'));
 writeFileSync(join(root,'manifest.json'),JSON.stringify({
  manifest_version:3,name:'isolated-native-zoom-vis',version:'1.0',permissions:['tabs'],
  host_permissions:['http://127.0.0.1/*'],background:{service_worker:'background.js'}
 }));
 writeFileSync(join(root,'background.js'),"chrome.runtime.onInstalled.addListener(()=>{});");
 for(const width of [320,390]){
  context=await chromium.launchPersistentContext(join(root,'profile-'+width),{
   channel:'chromium',headless:false,viewport:{width:width*2,height:940},
   deviceScaleFactor:1,
   args:['--disable-extensions-except='+root,'--load-extension='+root],
   httpCredentials:{username:user,password:pass},acceptDownloads:false
  });
  const worker=context.serviceWorkers()[0]||
   await context.waitForEvent('serviceworker',{timeout:15000});
  const page=await context.newPage(),external=[],jsErrors=[];
  page.on('pageerror',e=>jsErrors.push(String(e)));
  await page.setViewportSize({width:width*2,height:940});
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url===preview.url&&route.request().resourceType()==='document'){
    const response=await route.fetch(),html=await response.text();
    const match="const verifiedRecord=await readOne('mistakes',id);";
    assert.equal(html.split(match).length,2,'READBACK_INJECTION_ANCHOR_NOT_UNIQUE');
    const replacement="const verifiedRecord=await (window.__qaAckFailReadbackOnce ? "+
      "((window.__qaAckFailReadbackOnce=false),Promise.reject(new Error('SYNTHETIC_READBACK_FAILURE')))"+
      " : readOne('mistakes',id));";
    return route.fulfill({response,body:html.replace(match,replacement),
     contentType:'text/html; charset=utf-8'});
   }
   if(url.startsWith(preview.url)||url.startsWith('blob:')||url.startsWith('data:'))
    return route.continue();
   external.push(url);return route.abort();
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  const zoom=await worker.evaluate(async target=>{
   const tab=(await chrome.tabs.query({})).find(t=>t.url===target);
   if(!tab?.id)throw Error('NO_NATIVE_ZOOM_TAB');
   await chrome.tabs.setZoom(tab.id,2);
   return chrome.tabs.getZoom(tab.id);
  },page.url());
  assert.equal(zoom,2);
  await page.waitForFunction(w=>innerWidth===w,width);
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill('가상 스크린샷 문제 '+width);
  await page.locator('#memo').fill('가상 메모 '+width);
  const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
  await page.locator('#take-photo').setInputFiles({
   name:'fake-one-pixel.png',mimeType:'image/png',buffer:PNG
  });
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.evaluate(()=>{window.__qaAckFailReadbackOnce=true});
  await page.locator('#save-btn').click();
  await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('중복 등록하지 말고'),null,{timeout:15000});
  assert.equal(await page.locator('#wrong-ack-top-warning').getAttribute('role'),'note');
  // Hold the same app state; only CDP fromSurface parameter changes.
  await page.bringToFront();
  await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
  const before=await geometry(page);
  const session=await context.newCDPSession(page);
  await session.send('Page.enable');
  const layout=await session.send('Page.getLayoutMetrics');
  const shots={};
  for(const fromSurface of [false,true]){
   const raw=await session.send('Page.captureScreenshot',{
    format:'png',fromSurface,captureBeyondViewport:false
   });
   const buffer=Buffer.from(raw.data,'base64');
   const key=String(fromSurface),label=width+'-fromSurface-'+key;
   writeFileSync(OUT+'/'+label+'.png',buffer);
   shots[key]={sha256:hash(buffer),bytes:buffer.length,
    width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),
    distinctSampledColors:await colors(page,buffer)};
  }
  await session.detach();
  const after=await geometry(page);
  // Freeze expectation: there was no scroll/layout/DOM text change between captures.
  assert.deepEqual(after,before,'APP_STATE_CHANGED_BETWEEN_CAPTURE_SURFACES');
  assert.equal(jsErrors.length,0);
  assert.equal(external.length,0);
  proof.cases.push({width,nativeZoom:zoom,geometry:before,
   layout:{cssLayoutViewport:layout.cssLayoutViewport,cssVisualViewport:layout.cssVisualViewport},
   captures:shots,jsErrors,external});
  console.log('VIS_CDP_SINGLE_CASE='+JSON.stringify({width,shots,geometry:before}));
  await context.close();context=null;
 }
 proof.status=proof.cases.every(c=>c.captures.false.distinctSampledColors>=8&&
  c.captures.true.distinctSampledColors>=8)?'CDP_BOTH_SURFACES_VALID_VIS_STILL_BLOCK':
  'CDP_SURFACE_DIFFERENCE_OR_FAILURE_VIS_BLOCK';
 console.log('VIS_CDP_SINGLE_FINAL='+JSON.stringify({status:proof.status,widths:proof.cases.map(c=>c.width)}));
}catch(e){
 proof.status='FAILED_CAPTURE_OR_HARNESS';proof.errors.push(String(e?.stack||e));
 console.error('VIS_CDP_SINGLE_FAIL='+String(e?.stack||e));process.exitCode=1;
}finally{
 writeFileSync(OUT+'/result.json',JSON.stringify(proof,null,2)+'\n');
 if(context)await context.close();
 if(preview)await preview.close();
 if(root)rmSync(root,{recursive:true,force:true});
}
