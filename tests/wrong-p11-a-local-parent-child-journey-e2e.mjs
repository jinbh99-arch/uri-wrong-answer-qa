// WRONG-P11: original, unmodified A v1.4 ONLY. Parent register + photo,
// child local retry/explanation, parent observation, recheck, reload/revisit.
// NO P8/P10 bridge, mock restored ledger, DB migration, real account or child.
// This test captures PRODUCT GAPS instead of inventing a replacement feature.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P11_SYNTHETIC_LOCAL_A_ONLY!=='1')
 throw Error('P11_ORIGINAL_A_SYNTHETIC_GATE_REQUIRED');
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const aBytes=read('index.html');
const blobSha=()=>createHash('sha1').update(
 Buffer.concat([Buffer.from('blob '+aBytes.length+'\0'),aBytes])).digest('hex');
assert.equal(blobSha(),'58754380d6fa764256100963d1a9da5d11873d19',
 'A original blob must match approved v1.4 SHA exactly');
const modules={
 '/scripts/qa-inapp-sync-bridge.mjs':read('scripts/qa-inapp-sync-bridge.mjs'),
 '/scripts/qa47-live-auth-lab.mjs':read('scripts/qa47-live-auth-lab.mjs')
};
const question='가상 국어: 민수가 비 오는 날 우산을 쓴 까닭은?';
const photo=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const answer1='비가 왔기 때문이에요.';
const self1='그림을 먼저 봤는데, 글 속 까닭을 찾아야 한다는 것을 알았어요.';
const answer2='비에 젖지 않으려고 우산을 썼어요.';
const self2='비가 오는 상황과 우산을 쓴 행동의 이유를 연결했어요.';
const recheckNote='아이에게 까닭을 자기 말로 다시 설명해 보라고 묻기';
const parentMemo='첫 재풀이 설명을 직접 듣고 이야기했음';
const recheckObserved='며칠 뒤 재확인: 이유와 행동을 연결했는지 다시 들어봄';
const evidence={task:'WRONG-P11 genuine A v1.4 local user-value journey',
 source:'unchanged A index.html',indexGitBlob:blobSha(),
 baseP10:'d2d9bf95690dcdc38249305f8ce23d0849413250',
 syntheticOnly:true,actualA:true,addedAUi:false,usedP10Bridge:false,
 readOnlyRestoredLedgerUsed:false,realGuardianAuth:false,realChildAuth:false,
 realConsent:false,restorePerformed:false,safeToRestore:false,
 steps:[],states:[],screenshots:[],productLimitations:[],externalRequests:0,
 viewportMeasurements:[]};
function pass(description){
 evidence.steps.push(description);
 console.log('PASS WRONG_P11_A_JOURNEY '+evidence.steps.length+' '+description);
}
function snap(name,record,meta={}){
 evidence.states.push({stage:name,recordId:record?.records?.[0]?.id||null,
  count:record?.records?.length||0,retries:record?.records?.[0]?.generalRetryHistory?.length||0,
  checkHistory:record?.records?.[0]?.checkHistory?.length||0,
  retryValues:(record?.records?.[0]?.generalRetryHistory||[]).map(x=>({
   answer:x.answer,explanation:x.explanation,review:x.review,
   reviewedAtPresent:!!x.reviewedAt})),
  observedValues:(record?.records?.[0]?.checkHistory||[]).map(x=>({
   status:x.status,memo:x.memo,by:x.by})),
  photo:(record?.photos||[])[0],...meta});
}
async function readA(page){
 return page.evaluate(async()=>{
  const request=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((yes,no)=>{request.onsuccess=()=>yes(request.result);
   request.onerror=()=>no(request.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const query=(table,method)=>new Promise((yes,no)=>{
    const req=tx.objectStore(table)[method]();
    req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error);
   });
   const [records,keys,photos]=await Promise.all([
    query('mistakes','getAll'),query('photos','getAllKeys'),query('photos','getAll')]);
   const digests=[];
   for(let n=0;n<photos.length;n++){
    const b=photos[n];if(!(b instanceof Blob))throw Error('A_STORED_PHOTO_IS_NOT_BLOB');
    const array=await b.arrayBuffer();
    const raw=new Uint8Array(await crypto.subtle.digest('SHA-256',array));
    const sha256=[...raw].map(x=>x.toString(16).padStart(2,'0')).join('');
    digests.push({id:String(keys[n]),bytes:array.byteLength,mime:b.type,sha256});
   }
   return {records,photos:digests};
  }finally{db.close()}
 });
}
function checkPhoto(a,b){
 assert.equal(a.records.length,1);
 assert.equal(a.records[0].id,b.records[0].id);
 assert.equal(a.records[0].problemText,b.records[0].problemText);
 assert.equal(a.records[0].subject,b.records[0].subject);
 assert.equal(a.records[0].gradeAtEntry,b.records[0].gradeAtEntry);
 assert.equal(a.records[0].hasPhoto,true);
 assert.deepEqual(a.photos,b.photos,'A stored photo bytes and sha must NEVER change on retries or parent observations');
}
async function openRecord(page,id){
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 await page.locator('#wrong002-retry:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),question);
 assert.equal(await page.locator('#wrong-p8-restored-read').count(),0);
 assert.equal(await page.locator('#wrong-p10-read-summary').count(),0);
}
async function screenshot(page,label){
 const path='test-results/wrong-p11/'+label+'.png';
 await page.screenshot({path,fullPage:true});
 evidence.screenshots.push(label+'.png');
 evidence.viewportMeasurements.push(await page.evaluate(()=>({
  width:innerWidth,contentWidth:document.documentElement.scrollWidth,
  childMode:document.body.classList.contains('v218-child'),
  path:location.pathname
 })));
}
function onlyChanged(expected,actual,allowed){
 const keys=new Set([...Object.keys(expected),...Object.keys(actual)]);
 for(const k of keys)if(!allowed.includes(k))
  assert.deepEqual(actual[k],expected[k],
   'Unexpected mutation outside known A history metadata: '+k);
}
let server,browser,context;
try{
 mkdirSync('test-results/wrong-p11',{recursive:true});
 server=createServer((req,res)=>{
  const route=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&route==='/'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store'});return res.end(aBytes);
  }
  if(req.method==='GET'&&Object.hasOwn(modules,route)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8',
    'cache-control':'no-store'});return res.end(modules[route]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
 await context.route('**/*',route=>{
  const u=route.request().url();
  if(/^https?:/.test(u)&&new URL(u).origin!==origin){
   evidence.externalRequests++;return route.abort();
  }
  return route.continue();
 });
 const page=await context.newPage();
 const response=await page.goto(origin+'/');
 assert.equal(response.status(),200);
 await page.locator('#nav-add').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('우리아이 오답노트'));
 assert.equal(await page.locator('script[src*="p8"]').count(),0);
 pass('exact original A v1.4 Git blob served as-only; no QA bridge or synthetic restored ledger');

 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(question);
 await page.locator('#choose-photo').setInputFiles({
  name:'ONLY_SYNTHETIC_PIXEL.png',mimeType:'image/png',buffer:photo});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const created=await readA(page);
 assert.equal(created.records.length,1);assert.equal(created.photos.length,1);
 const row=created.records[0],id=row.id;
 assert.equal(row.problemText,question);assert.equal(row.subject,'korean');
 assert.equal(Number(row.gradeAtEntry),3);assert.equal(row.hasPhoto,true);
 assert.deepEqual(row.generalRetryHistory||[],[]);
 assert.deepEqual(row.checkHistory||[],[]);
 assert.equal(created.photos[0].id,id);
 assert.match(created.photos[0].sha256,/^[a-f0-9]{64}$/);
 snap('registration-390',created);
 await openRecord(page,id);
 await screenshot(page,'01-parent-original-390');
 pass('parent actual registration UI creates one A-indexedDB record + real synthetic-photo Blob SHA, zero retries');

 await page.setViewportSize({width:320,height:760});
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#check-save').isVisible(),false);
 assert.equal(await page.locator('#v230-review-save').count(),0);
 assert.equal(await page.locator('#v230-answer').isVisible(),true);
 await page.locator('#wrong002-retry').click();
 await page.locator('#v230-answer').fill(answer1);
 await page.locator('#v230-explanation').fill(self1);
 await screenshot(page,'02-child-first-retry-input-320');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'));
 const tried=await readA(page);
 checkPhoto(tried,created);assert.equal(tried.records[0].generalRetryHistory.length,1);
 assert.equal(tried.records[0].generalRetryHistory[0].answer,answer1);
 assert.equal(tried.records[0].generalRetryHistory[0].explanation,self1);
 assert.equal(tried.records[0].generalRetryHistory[0].review,'not_checked');
 assert.equal(tried.records[0].checkHistory.length,0);
 onlyChanged(row,tried.records[0],['updatedAt','generalRetryHistory']);
 snap('child-retry-1-320',tried);
 await page.locator('.v230-history summary').click();
 assert.ok((await page.locator('.v230-history').innerText()).includes(self1));
 await screenshot(page,'03-child-stored-retry-320');
 pass('child 320px A original form saves own answer/explanation, first saved-history readable; parent controls hidden');

 await page.setViewportSize({width:390,height:844});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#v230-review:visible').selectOption('explained');
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(self1));
 await screenshot(page,'04-parent-reads-child-explanation-390');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='explained');
 const reviewed=await readA(page);
 checkPhoto(reviewed,created);
 assert.equal(reviewed.records[0].generalRetryHistory.length,1);
 assert.equal(reviewed.records[0].generalRetryHistory[0].review,'explained');
 assert.ok(reviewed.records[0].generalRetryHistory[0].reviewedAt);
 assert.equal(reviewed.records[0].generalRetryHistory[0].explanation,self1);
 snap('parent-reviewed-child-retry-390',reviewed);
 pass('parent original A reads child self-explanation and explicitly marks latest retry explained; no automatic judgement');

 await page.locator('#check-status:visible').selectOption('explained');
 await page.locator('#check-memo').fill(parentMemo);
 await page.locator('#check-save').click();
 await page.waitForFunction(m=>document.querySelector('#check-history')?.textContent?.includes(m),parentMemo);
 const observed=await readA(page);
 checkPhoto(observed,created);
 assert.equal(observed.records[0].generalRetryHistory.length,1);
 assert.equal(observed.records[0].checkHistory.length,1);
 assert.equal(observed.records[0].checkHistory[0].status,'explained');
 assert.equal(observed.records[0].checkHistory[0].memo,parentMemo);
 assert.equal(observed.records[0].checkHistory[0].by,'parent_observation');
 snap('parent-observation-390',observed);
 await screenshot(page,'05-parent-saved-observation-390');
 pass('separate explicit parent checkHistory observation saved in same A record, original photo/child text intact');

 const due=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date:visible').fill(due);
 await page.locator('#wrong008-next-question').fill(recheckNote);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),due);
 const planned=await readA(page);
 checkPhoto(planned,created);
 assert.equal(planned.records[0].checkHistory.length,2);
 assert.equal(planned.records[0].checkHistory[1].status,'not_checked');
 assert.ok(planned.records[0].checkHistory[1].memo.includes('다음 확인 메모: '+due));
 assert.ok(planned.records[0].checkHistory[1].memo.includes(recheckNote));
 assert.equal(planned.records[0].generalRetryHistory.length,1);
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes('아직 확인 전'));
 snap('parent-manual-next-date-390',planned,{due});
 await screenshot(page,'06-parent-manual-recheck-date-390');
 pass('next-date is only original A human-readable not_checked manual memo, NOT completed observation/alarm');

 await page.reload();await page.locator('#nav-records').waitFor();
 await openRecord(page,id);
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(due));
 assert.ok((await page.locator('.v230-history summary').innerText()).includes('1회'));
 assert.ok((await page.locator('#check-history').innerText()).includes(parentMemo));
 assert.ok((await page.locator('#check-history').innerText()).includes('다음 확인 수동 메모'));
 await page.locator('.v230-history summary').click();
 const reloadedHistory=await page.locator('.v230-history').innerText();
 assert.ok(reloadedHistory.includes(answer1)&&reloadedHistory.includes(self1));
 const reopened=await readA(page);
 assert.deepEqual(reopened,planned);
 await screenshot(page,'07-parent-reopen-after-reload-390');
 pass('reload/revisit same original A record restores child answer+explanation, parent review, observation and pending recheck note');

 await page.setViewportSize({width:320,height:760});
 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill(answer2);
 await page.locator('#v230-explanation').fill(self2);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('2회'));
 const retried=await readA(page);
 checkPhoto(retried,created);
 assert.equal(retried.records[0].generalRetryHistory.length,2);
 assert.equal(retried.records[0].generalRetryHistory[1].answer,answer2);
 assert.equal(retried.records[0].generalRetryHistory[1].explanation,self2);
 assert.equal(retried.records[0].generalRetryHistory[1].review,'not_checked');
 assert.equal(retried.records[0].generalRetryHistory[0].review,'explained');
 assert.deepEqual(retried.records[0].checkHistory,planned.records[0].checkHistory);
 snap('child-retry-2-after-revisit-320',retried);
 await screenshot(page,'08-child-second-retry-320');
 pass('new self-explanation on same original ID appends second retry; first review + date memo + photo survive');

 await page.setViewportSize({width:390,height:844});
 await page.locator('#v218-parent-mode').click();
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(self2));
 await page.locator('#v230-review').selectOption('needs_help');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help');
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill(recheckObserved);
 await page.locator('#check-save').click();
 await page.waitForFunction(s=>document.querySelector('#check-history')?.textContent?.includes(s),recheckObserved);
 const completed=await readA(page);
 checkPhoto(completed,created);
 assert.equal(completed.records[0].generalRetryHistory.length,2);
 assert.deepEqual(completed.records[0].generalRetryHistory.map(x=>x.review),['explained','needs_help']);
 assert.equal(completed.records[0].checkHistory.length,3);
 assert.deepEqual(completed.records[0].checkHistory.map(x=>x.status),
  ['explained','not_checked','needs_help']);
 assert.ok(completed.records[0].checkHistory[2].memo.includes(recheckObserved));
 const allStatuses=await page.locator('#wrong002-state').innerText();
 // The manual date memo must not be counted as an observed outcome.
 assert.ok(allStatuses.includes('다시 푼 기록 2회'));
 assert.ok(allStatuses.includes('학부모 관찰 2회'));
 snap('parent-rechecked-after-second-retry-390',completed);
 await screenshot(page,'09-parent-recheck-outcome-390');
 pass('parent separately observes again after new child attempt; manual future date not mistaken for actual observation');

 await page.reload();
 await openRecord(page,id);
 const final=await readA(page);
 assert.deepEqual(final,completed);
 const history=page.locator('.v230-history');
 await history.locator('summary').click();
 const txt=await history.innerText();
 assert.ok(txt.includes(self1)&&txt.includes(self2));
 assert.ok(txt.includes('스스로 설명했다고 관찰')&&txt.includes('도움이 필요했다고 관찰'));
 assert.ok((await page.locator('#check-history').innerText()).includes(recheckObserved));
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(due));
 assert.equal(await page.locator('#wrong-p8-restored-read').count(),0);
 assert.equal(evidence.externalRequests,0);
 assert.equal(blobSha(),'58754380d6fa764256100963d1a9da5d11873d19');
 evidence.recordId=id;evidence.initialPhoto=created.photos[0];
 snap('final-reload-390',final);
 await screenshot(page,'10-final-reload-parent-390');
 pass('repeat reload keeps A ID/photo SHA, both explanations and two explicit parent outcomes; no foreign HTTP, UI injection or A changes');

 evidence.productLimitations=[
  'Child / parent mode only toggles CSS display; no authenticated family/guardian access control.',
  'Recheck date is free-text checkHistory not_checked memo, not reminder, scheduler, or completed follow-up.',
  'General retry and latest parent review are stored in same A local record, not distinct B2/B3 signed ledgers, request IDs or server CAS.',
  'Parent v230 review overwrites review field of latest retry only; child-attempt-to-parent-observation is not independent immutable event ledger.',
  'This local-only path has no real photo migration, consent, family account, cloud sync, or operating restore.',
  'The CSS role toggle can be changed on same device; device-separated actual multiuser workflows are not implemented in this path.',
  'No automatic education outcome inference; answers, reasons and parent observation remain manual.'
 ];
 evidence.result='PASS';evidence.checkCount=evidence.steps.length;
 evidence.mobileOverflow=evidence.viewportMeasurements.filter(v=>v.contentWidth>v.width);
 writeFileSync('test-results/wrong-p11/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P11_A_JOURNEY_RESULT='+JSON.stringify({
  status:'PASS',checks:evidence.checkCount,png:evidence.screenshots.length,
  originalA:true,recordIdStable:true,photoShaStable:true,
  childRetries:2,parentActualObservations:2,manualRecheckOnly:true,
  reloadPersisted:true,safeToRestore:false}));
}catch(err){
 evidence.result='FAIL';evidence.error=String(err);evidence.stack=String(err?.stack||'').slice(0,2500);
 mkdirSync('test-results/wrong-p11',{recursive:true});
 writeFileSync('test-results/wrong-p11/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P11_A_JOURNEY_RESULT='+JSON.stringify({
  status:'FAIL',checks:evidence.steps.length,error:String(err),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((yes,no)=>server.close(e=>e?no(e):yes()));
}
