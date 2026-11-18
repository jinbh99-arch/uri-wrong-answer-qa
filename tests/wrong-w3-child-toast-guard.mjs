// W3 child presentation mode: synthetic parent-toast RED (existing behavior)
// vs QA-only reversible GREEN, with blocked-draft warning preserved.
// Do not equate a display-mode toggle to actual family access control.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const mode=process.argv[2];
assert.ok(['red','green'].includes(mode),'mode must be red or green');
const root='qa-proof/w3-child-toast/'+mode;
mkdirSync(root,{recursive:true});
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const report={mode,sourceDevSha:DEV,appBlob:gitBlob(readFileSync('index.html')),
  screenshots:[],widths:{},pageErrors:[],externalRequests:[],realFamilyData:false,
  actualFamilyAuthVerified:false,physicalPhoneVerified:false,
  parentToastSynthetic:true,toastViaActualPhotoUI:true,status:'IN_PROGRESS'};
let preview,browser;
try{
 const auth={username:'w3-toast-synthetic',password:randomBytes(24).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:width===320?800:850},
    httpCredentials:auth,acceptDownloads:false});
  const page=await context.newPage();
  page.on('pageerror',err=>report.pageErrors.push(String(err)));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(preview.url)||url.startsWith('blob:')||url.startsWith('data:'))
      return route.continue();
    report.externalRequests.push(url);
    return route.abort();
  });
  const response=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.locator('#v218-child-mode').waitFor({state:'visible'});
  // Reproduce the parent's real image-selection and image-removal UI events.
  // This app's notify() is module/local scope, not a window global function.
  // Only an artificial 1px PNG is used, with no personal information or saves.
  await page.locator('#nav-add').click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
  await page.locator('#take-photo').setInputFiles({name:'w3-toast-synthetic.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
  await page.locator('#remove-photo').click();
  const msg='이번 사진 선택만 취소했습니다.';
  assert.equal(await page.locator('#toast').isVisible(),true,'real parent UI toast prerequisite');
  assert.equal(await page.locator('#toast').textContent(),msg);
  await page.locator('#v218-child-mode').click();
  const child=await page.evaluate(()=>({
    child:document.body.classList.contains('v218-child'),
    pressed:document.getElementById('v218-child-mode').getAttribute('aria-pressed'),
    toastVisible:!document.getElementById('toast').classList.contains('hide'),
    toastText:document.getElementById('toast').textContent,
    route:document.querySelector('main')?.querySelector(':not(.hide)')?.id||''
  }));
  assert.equal(child.child,true,'mode should actually switch');
  assert.equal(child.pressed,'true');
  if(mode==='red'){
    assert.equal(child.toastVisible,true,'expected old toast to persist in child view');
    assert.equal(child.toastText,msg,'expected old parent notification text');
  }else{
    assert.equal(child.toastVisible,false,'old parent toast must be hidden');
    assert.equal(child.toastText,'','old parent toast DOM text must be cleared');
  }
  const shot1=root+'/'+width+'-child-after-parent-toast.png';
  await page.screenshot({path:shot1,fullPage:true,animations:'disabled'});
  report.screenshots.push(shot1);

  // Blocking an actual unsaved draft must NOT suppress its error warning.
  await page.locator('#v218-parent-mode').click();
  await page.locator('#nav-add').click();
  await page.locator('#problem').fill('W3 합성 저장하지 않은 부모 오답');
  await page.locator('#v218-child-mode').click();
  const blocked=await page.evaluate(()=>({
    parent:!document.body.classList.contains('v218-child'),
    parentPressed:document.getElementById('v218-parent-mode').getAttribute('aria-pressed'),
    toastVisible:!document.getElementById('toast').classList.contains('hide'),
    toastText:document.getElementById('toast').textContent,
    problem:document.getElementById('problem').value
  }));
  assert.equal(blocked.parent,true,'dirty draft must block child mode');
  assert.equal(blocked.parentPressed,'true');
  assert.equal(blocked.toastVisible,true,'blocked switch warning must stay visible');
  assert.ok(blocked.toastText.includes('입력 중인 오답'),'guard feedback must be preserved');
  assert.equal(blocked.problem,'W3 합성 저장하지 않은 부모 오답');
  const shot2=root+'/'+width+'-blocked-dirty-parent-warning.png';
  await page.screenshot({path:shot2,fullPage:true,animations:'disabled'});
  report.screenshots.push(shot2);

  const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(scroll<=width+3, 'horizontal layout overflow: '+scroll);
  report.widths[width]={child,blocked,scrollWidth:scroll,status:'PASS'};
  await context.close();
 }
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.externalRequests,[]);
 report.status=mode==='red'?'EXPECTED_BASELINE_TOAST_LEAK':'PASS_QA_ONLY_TOAST_SCRUB';
}catch(e){report.status='FAIL';report.error=String(e);report.stack=String(e?.stack||'').slice(0,1500);process.exitCode=1;
 console.error('W3_TOAST_FAIL '+String(e));
}finally{
 await browser?.close();await preview?.close();
 writeFileSync(root+'/result.json',JSON.stringify(report,null,2));
 console.log('W3_TOAST_RESULT='+JSON.stringify({status:report.status,mode,appBlob:report.appBlob,
  widths:report.widths,png:report.screenshots.length,
  errors:report.pageErrors.length,external:report.externalRequests.length,error:report.error}));
}
