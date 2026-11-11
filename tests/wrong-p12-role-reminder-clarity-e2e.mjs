// WRONG-P12: no product changes by default. Inspect genuine A v1.4
// role toggle warning and manual next-confirmation note at 390/320 Chromium.
// This is a single targeted UI trust check, NOT the P11 full learning loop.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
if(process.env.WRONG_P12_SYNTHETIC_A_ONLY!=='1')
 throw Error('P12_LOCAL_A_SYNTHETIC_FLAG_REQUIRED');

const original=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original]))
 .digest('hex');
assert.equal(gitBlob,'58754380d6fa764256100963d1a9da5d11873d19');
const modulePaths={
 '/scripts/qa-inapp-sync-bridge.mjs':'../scripts/qa-inapp-sync-bridge.mjs',
 '/scripts/qa47-live-auth-lab.mjs':'../scripts/qa47-live-auth-lab.mjs'
};
const moduleBytes=Object.fromEntries(Object.entries(modulePaths)
 .map(([path,file])=>[path,readFileSync(new URL(file,import.meta.url))]));
const evidence={task:'WRONG-P12 original A mode/reminder misinterpretation evidence',
 baseP11:'45de0202a0529ea8c47dfbd30aeb6ddac4d46cdf',
 aOriginalBlob:gitBlob,actualA:true,productChanges:0,syntheticOnly:true,
 realAuthentication:false,realConsent:false,realNotifications:false,
 restorationPerformed:false,safeToRestore:false,
 modeViews:[],noteViews:[],screenshots:[],checks:[],
 suggestions:[],externalRequests:0};
const dir='test-results/wrong-p12';
function pass(label){evidence.checks.push(label);
 console.log('PASS WRONG_P12_CLARITY '+evidence.checks.length+' '+label)}
async function screenshot(page,name,locator){
 const path=dir+'/'+name+'.png';
 if(locator)await locator.screenshot({path});
 else await page.screenshot({path,fullPage:false});
 evidence.screenshots.push(name+'.png');
}
async function measure(page,stage){
 const d=await page.evaluate(()=>{
  const css=id=>{
   const n=document.querySelector(id);
   if(!n)return null;
   const r=n.getBoundingClientRect(),style=getComputedStyle(n);
   return {text:n.innerText?.trim()||n.textContent?.trim()||'',
    fontSize:style.fontSize,color:style.color,background:style.backgroundColor,
    display:style.display,visibility:style.visibility,
    bbox:{x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),
      height:+r.height.toFixed(1)},visible:!!(r.width&&r.height&&
       style.display!=='none'&&style.visibility!=='hidden')};
  };
  return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   parentPressed:document.querySelector('#v218-parent-mode')?.getAttribute('aria-pressed'),
   childPressed:document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed'),
   group:css('.v218-mode-switch'),roleNote:css('.v218-mode-note'),
   parentToggle:css('#v218-parent-mode'),childToggle:css('#v218-child-mode'),
   banner:css('#storage-banner'),
   dateHeading:css('#wrong008-next-review h3'),
   dateExplanation:css('#wrong008-next-review > p.small'),
   dateControl:css('#wrong008-next-date'),
   dateButton:css('#wrong008-save-note'),
   dateStatus:css('#wrong008-last-manual-note')};
 });
 assert.ok(d.scrollWidth<=d.viewport+2,'mobile horizontal overflow');
 if(!d.roleNote?.visible)throw Error('ROLE_WARNING_NOT_VISIBLE');
 assert.ok(d.roleNote.text.includes('기기 안의 보기 모드만 변경'));
 assert.ok(d.roleNote.text.includes('계정·비밀번호 보호가 아닙니다'));
 assert.ok(d.roleNote.bbox.y>=d.group.bbox.y);
 assert.ok(d.roleNote.bbox.y<d.group.bbox.y+d.group.bbox.height);
 evidence.modeViews.push({stage,...d});
 return d;
}
async function readA(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,fail)=>{req.onsuccess=()=>ok(req.result);
   req.onerror=()=>fail(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const get=(store,method)=>new Promise((ok,fail)=>{
    const r=tx.objectStore(store)[method]();
    r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});
   const [rows,photoKeys]=await Promise.all([
    get('mistakes','getAll'),get('photos','getAllKeys')]);
   return {rows,photoKeys};
  }finally{db.close()}
 });
}
let browser,context,server;
try{
 mkdirSync(dir,{recursive:true});
 server=createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(req.method==='GET'&&u.pathname==='/'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store'});return res.end(original)
  }
  if(req.method==='GET'&&Object.hasOwn(moduleBytes,u.pathname)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8',
    'cache-control':'no-store'});return res.end(moduleBytes[u.pathname])
  }
  res.writeHead(404);res.end('NOT_FOUND')
 });
 await new Promise((ok,fail)=>{server.once('error',fail);
  server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
 await context.route('**/*',route=>{
  const u=route.request().url();
  if(/^https?:/.test(u)&&new URL(u).origin!==origin){
   evidence.externalRequests++;return route.abort()
  }
  return route.continue();
 });
 const page=await context.newPage();
 const response=await page.goto(origin+'/');
 assert.equal(response.status(),200);
 await page.locator('#v218-parent-mode').waitFor();
 const initial=await measure(page,'parent-home-390');
 assert.equal(initial.parentPressed,'true');
 assert.ok(initial.banner.text.includes('브라우저'));
 assert.equal(await page.locator('[src*="a-parent-read-bridge"]').count(),0);
 await screenshot(page,'01-parent-mode-390');
 pass('actual original A 390 parent toggle has adjacent role-is-presentation-only/no-auth notice; no bridge');

 await page.setViewportSize({width:320,height:760});
 await page.locator('#v218-child-mode').click();
 const child=await measure(page,'child-home-320');
 assert.equal(child.childPressed,'true');
 await screenshot(page,'02-child-mode-320');
 pass('real 320 child toggle preserves adjacent no-password/no-account warning without horizontal overflow');

 await page.locator('#v218-parent-mode').click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill('가상 국어: 민수가 비를 피하려고 우산을 쓴 까닭은?');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const registered=await readA(page);
 assert.equal(registered.rows.length,1);
 assert.equal(registered.photoKeys.length,0);
 const id=registered.rows[0].id;
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill('비를 맞지 않기 위해서예요.');
 await page.locator('#v230-explanation').fill('이유와 행동을 이어 읽었어요.');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'));
 const before=await readA(page);
 assert.equal(before.rows[0].generalRetryHistory.length,1);
 assert.equal(before.rows[0].checkHistory.length,0);
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong008-next-review:visible').waitFor();
 pass('one real A local Korean record reaches reminder UI only after actual child retry, no fake P7 event');

 const panel=page.locator('#wrong008-next-review');
 const h=await panel.locator('h3').innerText();
 const explanation=await panel.locator('p.small').first().innerText();
 const instruction=await page.locator('#wrong008-note-status').innerText();
 const button=await page.locator('#wrong008-save-note').innerText();
 assert.ok(h.includes('다음에 다시 확인할 날짜를 메모하기'));
 assert.ok(explanation.includes('자동 알림·일정 예약·완료 판정은 없습니다'));
 assert.ok(button.includes('확인 전 상태로 메모 저장'));
 assert.ok(instruction.includes('확인 전 상태'));
 await panel.scrollIntoViewIfNeeded();
 const panelMeasure=await measure(page,'parent-recheck-panel-390');
 assert.ok(panelMeasure.dateHeading?.visible);
 assert.ok(panelMeasure.dateControl?.visible);
 assert.ok(panelMeasure.dateButton?.visible);
 assert.ok(panelMeasure.dateExplanation?.visible);
 assert.ok(panelMeasure.dateExplanation.bbox.y < panelMeasure.dateButton.bbox.y,
  'missing alert disclaimer before save would be a P1');
 evidence.noteViews.push({stage:'before-save',heading:h,explanation,instruction,button,
  noteFont:panelMeasure.dateExplanation.fontSize,
  distanceFromHeadingToExplanation:Math.round(panelMeasure.dateExplanation.bbox.y-panelMeasure.dateHeading.bbox.y),
  descriptionBeforeSubmit:true,buttonExplicitlyMemo:true});
 await screenshot(page,'03-parent-date-form-390',panel);
 pass('the real date form says manual memo, explicitly no alarm/scheduling/autocomplete, above save control');

 const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(date);
 await page.locator('#wrong008-next-question').fill('다음에는 글의 까닭을 말해보기');
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),date);
 const after=await readA(page);
 assert.equal(after.rows.length,1);
 assert.equal(after.rows[0].id,id);
 assert.equal(after.rows[0].generalRetryHistory.length,1);
 assert.equal(after.rows[0].checkHistory.length,1);
 assert.equal(after.rows[0].checkHistory[0].status,'not_checked');
 assert.ok(after.rows[0].checkHistory[0].memo.includes('아직 확인 전/자동 알림 없음'));
 assert.deepEqual(after.photoKeys,before.photoKeys);
 const uiStatus=await page.locator('#wrong008-last-manual-note').innerText();
 assert.ok(uiStatus.includes('아직 확인 전'));
 evidence.noteViews.push({stage:'after-save',date,status:uiStatus,
  storedStatus:after.rows[0].checkHistory[0].status,
  recordedBy:after.rows[0].checkHistory[0].by});
 await screenshot(page,'04-parent-date-memo-saved-390',panel);
 pass('manual date is persisted as not_checked explicit free text, never an alarm or completed observation');

 await page.reload();
 await page.locator('#nav-records').waitFor();
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#wrong008-last-manual-note:visible').waitFor();
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(date));
 const revisited=await readA(page);
 assert.deepEqual(revisited,after);
 assert.equal(await page.locator('#wrong-p8-restored-read').count(),0);
 await screenshot(page,'05-parent-revisited-memo-390',page.locator('#wrong008-next-review'));
 pass('A manual note still says pending after refresh/revisit; no identity, family or remote restore added');

 const parentNote=await page.locator('.v218-mode-note').innerText();
 assert.ok(parentNote.includes('계정·비밀번호 보호가 아닙니다'));
 assert.equal(createHash('sha1')
  .update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original])).digest('hex'),
  gitBlob);
 assert.equal(evidence.externalRequests,0);
 evidence.recordId=id;evidence.originOnly=true;
 evidence.assessment={
  parentRoleAuthMisinterpretation:'existing adjacent notice explicitly says screen-only and not account/password protected',
  childRoleAuthMisinterpretation:'same adjacent notice at 320px',
  reminderScheduleMisinterpretation:'no auto alarms/scheduling/completion written before control',
  notePendingAfterRefresh:true,
  measuredNoHorizontalOverflow:true,
  actualHumanComprehension:'NOT MEASURED',
  functionalGap:'identity, consent and actual reminders are not implemented',
  developerConclusion:'NO PROVEN misleading label at tested controls; NO A-derived UI modification',
  recommendation:'do not add redundant disclaimers; request human comprehension test before product decision'
 };
 evidence.result='PASS';evidence.checkCount=evidence.checks.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P12_CLARITY_RESULT='+JSON.stringify({
  status:'PASS',checks:evidence.checkCount,png:evidence.screenshots.length,
  originalA:true,productChanges:0,noMisleadingLabelFound:true,
  actualParentAuth:false,actualReminder:false,safeToRestore:false}));
}catch(error){
 evidence.result='FAIL';evidence.error=String(error);
 evidence.stack=String(error?.stack||'').slice(0,2200);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P12_CLARITY_RESULT='+JSON.stringify({
  status:'FAIL',checks:evidence.checks.length,error:String(error),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));
}
