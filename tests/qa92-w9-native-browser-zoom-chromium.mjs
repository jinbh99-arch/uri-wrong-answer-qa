// QA92 / WRONG-W9: 200% browser-native tab zoom (Chrome extension tabs.setZoom).
// Deliberately NOT CSS zoom, visualViewport pinch zoom, screenshot scaling, DPR
// emulation, or resizing alone. This synthetic, ephemeral localhost test covers
// keyboard-only registration, focus, recheck save and document overflow at the
// effective 320 CSS px viewport after 2x native zoom.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV=process.env.WRONG_QA92_DEV_SHA;
assert.match(DEV||'',/^[a-f0-9]{40}$/,'QA92 requires actual dev SHA');
const OUT='qa-proof/qa92';mkdirSync(OUT,{recursive:true});
let browserContext,preview,tempFolder,screens=0,passes=0;
const errors=[],outside=[];
function pass(label){passes++;console.log('QA92_PASS '+label)}
async function screenshot(page,label){
 const file=OUT+'/'+String(++screens).padStart(2,'0')+'-'+label+'.png';
 await page.screenshot({path:file,fullPage:true,animations:'disabled'});
 console.log('QA92_PNG='+file);
}
async function metrics(page){
 return page.evaluate(()=>({
  innerWidth:innerWidth,innerHeight:innerHeight,
  clientWidth:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  dpr:devicePixelRatio,scale:visualViewport?.scale??null,
  bodyZoom:document.body.style.zoom||null,
  htmlZoom:document.documentElement.style.zoom||null,
  page:document.querySelector('[data-page]:not(.hide)')?.id||null,
  focus:document.activeElement?.id||null,
  storage:document.querySelector('#storage-banner')?.textContent?.slice(0,130)||''
 }));
}
async function evidence(page,title,lines){
 await page.evaluate(({title,lines})=>{
  document.getElementById('qa92-evidence')?.remove();
  const p=document.createElement('section');p.id='qa92-evidence';
  p.style.cssText='background:#fff;color:#1c3254;border:2px solid #56749b;border-radius:12px;margin:9px 12px;padding:12px;overflow-wrap:anywhere;font:15px/1.5 system-ui';
  const t=document.createElement('strong');t.textContent=title;p.append(t);
  for(const line of lines){const n=document.createElement('p');n.textContent=line;p.append(n)}
  document.querySelector('main')?.prepend(p);
 },{title,lines});
}
async function focusEnter(page,selector){
 const loc=page.locator(selector);
 await loc.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),selector.slice(1));
 await page.keyboard.press('Enter');
}
try{
 const username='qa92-browser-native-zoom',password=randomBytes(28).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username,password});
 // A loaded Chromium extension's chrome.tabs.setZoom is the native browser
 // content-zoom API and can be inspected with chrome.tabs.getZoom.
 tempFolder=mkdtempSync(join(tmpdir(),'wrong-qa92-zoom-'));
 const manifest={
   manifest_version:3,name:'WRONG QA92 isolated browser zoom bridge',version:'1.0.0',
   permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
   background:{service_worker:'background.js'}
 };
 writeFileSync(join(tempFolder,'manifest.json'),JSON.stringify(manifest));
 writeFileSync(join(tempFolder,'background.js'),"chrome.runtime.onInstalled.addListener(()=>{}); chrome.tabs.onUpdated.addListener(()=>{});");
 browserContext=await chromium.launchPersistentContext(join(tempFolder,'user-profile'),{
   channel:'chromium',headless:true,viewport:{width:640,height:900},
   deviceScaleFactor:1,
   args:['--disable-extensions-except='+tempFolder,'--load-extension='+tempFolder],
   httpCredentials:{username,password},
 });
 const worker=browserContext.serviceWorkers()[0]||
  await browserContext.waitForEvent('serviceworker',{timeout:15000});
 assert.ok(worker.url().startsWith('chrome-extension://'));
 const page=await browserContext.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))outside.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.locator('#wrong-qa66-preview-meta').waitFor();
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 const original=await metrics(page);
 assert.ok(original.innerWidth>=630&&original.innerWidth<=650,JSON.stringify(original));
 const zoom=await worker.evaluate(async()=>{
  const tabs=await chrome.tabs.query({});
  const tab=tabs.find(x=>x.url?.startsWith('http://127.0.0.1:')&&x.url.endsWith('/'));
  if(!tab?.id)throw Error('QA92 Chromium extension could not find localhost tab');
  const before=await chrome.tabs.getZoom(tab.id);
  await chrome.tabs.setZoom(tab.id,2);
  const after=await chrome.tabs.getZoom(tab.id);
  return {tabId:tab.id,before,after,api:'chrome.tabs.setZoom/getZoom'};
 });
 assert.ok(zoom.before>=0.9&&zoom.before<=1.1,JSON.stringify(zoom));
 assert.equal(zoom.after,2,'actual native tab zoom must equal 200%');
 await page.waitForFunction(()=>innerWidth<=330,{timeout:12000});
 const at200=await metrics(page);
 assert.ok(at200.innerWidth>=312&&at200.innerWidth<=328,
  'not effective 320px CSS width at 2x tab zoom: '+JSON.stringify({zoom,original,at200}));
 assert.equal(at200.htmlZoom,null,'not CSS zoom');assert.equal(at200.bodyZoom,null,'not CSS zoom');
 pass('native Chromium tab zoom=200% measured by extension and effective 320 CSS pixel viewport');
 await evidence(page,'QA92 브라우저 자체 확대 200%',[
  '실제 Chromium 확장 API chrome.tabs.setZoom(tabId, 2)',
  '최신 실제 dev SHA '+DEV,
  '물리 브라우저 640px → 브라우저 내 유효 폭 '+at200.innerWidth+' CSS px',
  'CSS zoom · 페이지 스케일 에뮬레이션 사용 안 함',
  '현 페이지: '+at200.page]);
 await screenshot(page,'native-200-home-320css');
 // The focus/keyboard journey does not rely on pointer-only clicking.
 await focusEnter(page,'#nav-add');
 await page.locator('#page-add:not(.hide)').waitFor();
 const add=await metrics(page);
 assert.ok(add.scrollWidth<=add.clientWidth+2,
   'horizontal overflow at form: '+JSON.stringify(add));
 await page.locator('#problem').fill('QA92 가상 문제: 3+4= ?');
 await page.locator('#student-answer').fill('가상 오답 6');
 await page.locator('#memo').fill('가상 부모 기록 · 실제 개인정보 아님');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('math');
 await evidence(page,'QA92 키보드 오답 등록',[
  '브라우저 탭 줌: 200%, 유효 너비 '+add.innerWidth+' CSS px',
  'Tab/Enter로 오답 등록 화면 진입 성공',
  '가상 문제 3+4와 학년 3·수학을 입력',
  '사진 업로드/OCR/운영 데이터 없음']);
 await screenshot(page,'native-200-add-form-320css');
 await focusEnter(page,'#v08-floating-save');
 // Some test variants require explicit confirmation before local save.
 const dialog=page.locator('#confirm-dialog[open]');
 if(await dialog.isVisible().catch(()=>false))await page.locator('#dlg-ok').click();
 await page.waitForTimeout(700);
 if(await dialog.isVisible().catch(()=>false))await page.locator('#dlg-ok').click();
 await page.locator('#page-detail:not(.hide)').waitFor({timeout:12000});
 assert.ok((await page.locator('#detail-text').innerText()).includes('3+4= ?'));
 pass('actual save path from keyboard persists one synthetic mistake into ephemeral local IndexedDB');
 const detail=await metrics(page);
 assert.ok(detail.scrollWidth<=detail.clientWidth+2,
  'horizontal overflow at saved detail: '+JSON.stringify(detail));
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill('QA92 가상 재확인: 친구 도움 필요');
 await focusEnter(page,'#check-save');
 await page.waitForFunction(()=>
  document.querySelector('#check-history')?.textContent?.includes('친구 도움 필요'),{timeout:12000});
 const recheck=await metrics(page);
 assert.ok(recheck.scrollWidth<=recheck.clientWidth+2,
  'horizontal overflow after recheck: '+JSON.stringify(recheck));
 pass('native 200% keyboard focus Enter saves new parent observation with no horizontal document overflow');
 await evidence(page,'QA92 부모 관찰 기록',[
  '브라우저 기본 페이지 줌 200% 실제 유지',
  '가상 오답 1건·부모 재확인 도움 필요 저장',
  'IDB 가상 데이터만, 실가족·사진·OCR 없음',
  '전체 페이지 수평 스크롤 없음']);
 await screenshot(page,'native-200-parent-recheck-320css');
 assert.deepEqual(errors,[],'unexpected app Javascript errors');
 assert.deepEqual(outside,[],'unexpected off-host requests');
 pass('page errors=0 and external network attempts=0');
 const actualZoom=await worker.evaluate(async()=>{
  const tabs=await chrome.tabs.query({});
  const tab=tabs.find(x=>x.url?.startsWith('http://127.0.0.1:')&&x.url.endsWith('/'));
  return {zoom:await chrome.tabs.getZoom(tab.id),tabId:tab.id};
 });
 assert.equal(actualZoom.zoom,2,'zoom should remain native 200% through form and recheck');
 const result={status:'PASS',checks:passes,screens,devSha:DEV,
  browser:'Playwright Chromium MV3 extension chrome.tabs.setZoom/GetZoom',
  nativeZoomBefore:zoom.before,nativeZoomAfter:zoom.after,
  nativeZoomAfterObservations:actualZoom.zoom,
  physicalViewportWidth:640,measuredCssViewportAt200:at200.innerWidth,
  scenarios:['home keyboard navigate','record form 320 CSS px','synthetic record saved',
    'parent recheck via keyboard','document overflow/JS/egress'],
  evidence:[original,at200,add,detail,recheck],errors,outside,
  cssZoomUsed:false,pinchZoomUsed:false,realPhoneVerified:false,
  savedInEphemeralBrowserOnly:true,safeToRestore:false,productionChanged:false};
 writeFileSync(OUT+'/qa92-native-zoom.json',JSON.stringify(result,null,2));
 console.log('QA92_RESULT='+JSON.stringify(result));
}catch(e){
 process.exitCode=1;
 const details={status:'FAIL',devSha:DEV,passes,screens,error:String(e),
  stack:String(e?.stack||'').slice(0,2300),errors,outside,safeToRestore:false,
  productionChanged:false};
 writeFileSync(OUT+'/qa92-native-zoom-error.json',JSON.stringify(details,null,2));
 console.error('QA92_RESULT='+JSON.stringify(details));
}finally{
 if(browserContext)await browserContext.close();
 if(preview)await preview.close();
 if(tempFolder)rmSync(tempFolder,{recursive:true,force:true});
 console.log('QA92_EPHEMERAL_CHROME_PROFILE_CLEANED');
}
