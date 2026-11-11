// WRONG-P13: genuine A DOM before & isolated A-derived CTA candidate after.
// The test navigates original A ID/photo/fields, NO P7 ledger or QA bridge.
// Use only synthetic 1px pixel and localhost with NO operating restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P13_SYNTHETIC_A_ONLY!=='1')throw Error('P13_SYNTHETIC_LOCAL_FLAG_REQUIRED');
const baseSha='11743ddc3d95821a47aa20b712325d252230cabb';
const original=execFileSync('git',['show',baseSha+':index.html'],{maxBuffer:8*1024*1024});
const candidate=readFileSync(new URL('../index.html',import.meta.url));
const gitSha=bytes=>createHash('sha1').update(
 Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(gitSha(original),'58754380d6fa764256100963d1a9da5d11873d19');
assert.notEqual(gitSha(candidate),gitSha(original));
assert.ok(candidate.includes('wrong-p13-first-action'));
assert.equal(original.includes('wrong-p13-first-action'),false);
const modules={
 '/scripts/qa-inapp-sync-bridge.mjs':readFileSync(new URL('../scripts/qa-inapp-sync-bridge.mjs',import.meta.url)),
 '/scripts/qa47-live-auth-lab.mjs':readFileSync(new URL('../scripts/qa47-live-auth-lab.mjs',import.meta.url))
};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const question='가상 국어: 민수가 비 오는 날 우산을 쓴 까닭은?';
const answer='비가 왔기 때문입니다.';
const explanation='처음에는 그림만 봤어요. 다시 문제 문장에서 행동의 이유를 찾아봤어요.';
const parentMemo='아이의 설명을 직접 듣고 원인을 함께 확인했습니다.';
const dir='test-results/wrong-p13';
const ev={task:'WRONG-P13 A original first action CTA vs P12',
 baseP12:baseSha,baselineBlob:gitSha(original),
 candidateBlob:gitSha(candidate),syntheticOnly:true,
 originalAProductUnmodifiedAtCommit:true,isolatedCandidateOnly:true,
 safeToRestore:false,restorePerformed:false,actualGuardianAuth:false,
 actualChildAuth:false,realFamily:false,
 screenshots:[],checks:[],baseline:[],after:[],mutations:[],
 externalRequests:0};
function pass(s){ev.checks.push(s);console.log('PASS WRONG_P13_CTA '+ev.checks.length+' '+s)}
async function screenshot(page,name){
 const p=dir+'/'+name+'.png';await page.screenshot({path:p,fullPage:false});
 ev.screenshots.push(name+'.png')
}
async function local(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const get=(store,method)=>new Promise((ok,no)=>{
    const q=tx.objectStore(store)[method]();
    q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
   const [rows,ids,blobs]=await Promise.all([
    get('mistakes','getAll'),get('photos','getAllKeys'),get('photos','getAll')]);
   const photos=[];
   for(let i=0;i<blobs.length;i++){
    const b=blobs[i],v=await b.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',v);
    photos.push({id:String(ids[i]),bytes:v.byteLength,mime:b.type,
     sha256:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')});
   }
   return {rows,photos};
  }finally{db.close()}
 });
}
function unchangedAnchor(before,after){
 assert.equal(after.rows.length,1);assert.equal(before.rows.length,1);
 const a=before.rows[0],b=after.rows[0];
 for(const p of ['id','subject','gradeAtEntry','problemText','hasPhoto','studentAnswer','memo','createdAt'])
  assert.deepEqual(b[p],a[p],'wrong-p13 anchor '+p);
 assert.deepEqual(after.photos,before.photos,'photo SHA/bytes must stay identical');
}
async function ctaGeometry(page,name){
 const obj=await page.evaluate(()=>{
  const c=document.querySelector('#wrong-p13-first-action');
  const b=document.querySelector('#wrong-p13-go'),note=document.querySelector('.v218-mode-note');
  if(!c||!b||!note)return null;
  const r=b.getBoundingClientRect(),cr=c.getBoundingClientRect();
  return {viewport:innerWidth,viewportHeight:innerHeight,
   scrollWidth:document.documentElement.scrollWidth,
   buttonText:b.innerText.trim(),disabled:b.disabled,
   ariaPressedParent:document.querySelector('#v218-parent-mode')?.getAttribute('aria-pressed'),
   ariaPressedChild:document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed'),
   notice:note.textContent,context:document.querySelector('#wrong-p13-context')?.textContent,
   visible:!c.classList.contains('hide')&&cr.width>0&&cr.height>0,
   button:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),
           height:Math.round(r.height),bottom:Math.round(r.bottom)},
   panelTop:Math.round(cr.top),panelBottom:Math.round(cr.bottom)};
 });
 assert.ok(obj,'P13 first action must be genuine A DOM element');
 assert.equal(obj.scrollWidth,obj.viewport,'no mobile horizontal overflow');
 assert.ok(obj.visible);
 assert.ok(obj.button.y>=0&&obj.button.bottom<=obj.viewportHeight,
  'CTA must be discoverable fully in FIRST viewport '+JSON.stringify(obj));
 assert.ok(obj.button.height>=44,'touch target >=44px');
 assert.ok(obj.notice.includes('계정·비밀번호 보호가 아닙니다'));
 ev.after.push({stage:name,...obj});return obj;
}
async function open(page,id){
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 await page.locator('#v230-answer:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),question);
}
let server,browser,context;
try{
 mkdirSync(dir,{recursive:true});
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&(p==='/baseline'||p==='/candidate')){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   return res.end(p==='/baseline'?original:candidate);
  }
  if(req.method==='GET'&&Object.hasOwn(modules,p)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
   return res.end(modules[p]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==origin){
   ev.externalRequests++;return route.abort()
  }
  return route.continue()
 });
 const page=await context.newPage();
 assert.equal((await page.goto(origin+'/baseline')).status(),200);
 await page.locator('#nav-add').waitFor();
 assert.equal(await page.locator('#wrong-p13-go').count(),0);
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(question);
 await page.locator('#choose-photo').setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const created=await local(page);
 assert.equal(created.rows.length,1);assert.equal(created.photos.length,1);
 const id=created.rows[0].id;
 assert.equal(created.rows[0].subject,'korean');
 assert.equal(created.photos[0].id,id);
 assert.match(created.photos[0].sha256,/^[0-9a-f]{64}$/);
 await open(page,id);
 await page.setViewportSize({width:320,height:720});
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-home').click();
 await screenshot(page,'01-before-original-child-320');
 assert.equal(await page.locator('#wrong-p13-go').count(),0);
 ev.baseline.push({view:'originalAChild320',ctaPresent:false});
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#v230-answer').fill(answer);
 await page.locator('#v230-explanation').fill(explanation);
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'));
 const afterChild=await local(page);
 unchangedAnchor(created,afterChild);
 assert.equal(afterChild.rows[0].generalRetryHistory.length,1);
 assert.equal(afterChild.rows[0].generalRetryHistory[0].explanation,explanation);
 assert.equal(afterChild.rows[0].generalRetryHistory[0].review,'not_checked');
 assert.equal(afterChild.rows[0].checkHistory.length,0);
 await page.setViewportSize({width:390,height:844});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-home').click();
 await screenshot(page,'02-before-original-parent-390');
 assert.equal(await page.locator('#wrong-p13-go').count(),0);
 ev.baseline.push({view:'originalAParent390',ctaPresent:false,
   registeredId:id,childExplanationAvailable:true,parentActualObservationCount:0});
 pass('original pinned A baseline: record/photo created by A UI, child explanation saved, no first-viewport role-specific CTA');

 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#wrong-p13-go:visible').waitFor();
 const parent=await ctaGeometry(page,'parentFirst390');
 assert.equal(parent.ariaPressedParent,'true');
 assert.equal(parent.buttonText,'👀 아이 설명 보고 관찰하기');
 assert.equal(parent.disabled,false);
 assert.ok(parent.context.includes(question.slice(0,23)));
 const beforeParentClick=await local(page);
 assert.deepEqual(beforeParentClick,afterChild);
 assert.equal(beforeParentClick.rows[0].checkHistory.length,0);
 assert.equal(beforeParentClick.rows[0].generalRetryHistory[0].review,'not_checked');
 await screenshot(page,'03-after-parent-first-390');
 pass('parent first 390 viewport shows one 48px action for original unobserved child explanation, no premature writes');

 await page.locator('#wrong-p13-go').click();
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 await page.locator('#v230-review:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),question);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanation));
 assert.equal(await page.locator('#v230-review').inputValue(),'not_checked');
 assert.equal(await page.locator('#wrong-p13-first-action').isVisible(),false);
 const afterParentClick=await local(page);
 assert.deepEqual(afterParentClick,beforeParentClick,
  'mere parent CTA must not create guardian observation or rewrite retry');
 await screenshot(page,'04-after-parent-deeplink-390');
 pass('parent click deep-links same original A record/photo, child explanation and manual review selector; automatic guardian writes ZERO');

 await page.locator('#v230-review').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await page.waitForFunction(async id=>{
  const r=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise(ok=>r.onsuccess=()=>ok(r.result));
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').get(id);
   const row=await new Promise(ok=>q.onsuccess=()=>ok(q.result));
   return row?.generalRetryHistory?.[0]?.review==='explained'&&
    Boolean(row.generalRetryHistory[0].reviewedAt)
  }finally{db.close()}
 },id);
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill(parentMemo);
 await page.locator('#check-save').click();
 await page.waitForFunction(note=>document.querySelector('#check-history')?.textContent?.includes(note),parentMemo);
 const parentSaved=await local(page);
 unchangedAnchor(created,parentSaved);
 assert.equal(parentSaved.rows[0].generalRetryHistory.length,1);
 assert.equal(parentSaved.rows[0].generalRetryHistory[0].review,'explained');
 assert.equal(parentSaved.rows[0].checkHistory.length,1);
 assert.equal(parentSaved.rows[0].checkHistory[0].memo,parentMemo);
 ev.mutations.push({stage:'parentDirectExplicitActions',explicitReview:'explained',
  explicitlyAddedCheckHistory:1,autoAddedCheckHistoryBeforeClick:0});
 pass('after explicit original A parent review+observation saves, child text and photo remain; no new storage path');

 await page.setViewportSize({width:320,height:720});
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-home').click();
 await page.locator('#wrong-p13-go:visible').waitFor();
 const child=await ctaGeometry(page,'childFirst320');
 assert.equal(child.buttonText,'✏️ 이번 오답 다시 풀기');
 assert.equal(child.disabled,false);
 assert.equal(child.ariaPressedChild,'true');
 assert.ok(child.context.includes(question.slice(0,23)));
 await screenshot(page,'05-after-child-first-320');
 const beforeChildClick=await local(page);
 assert.deepEqual(beforeChildClick,parentSaved);
 pass('child first 320 viewport shows one role-specific 48px retry CTA with correct previously saved A record');

 await page.locator('#wrong-p13-go').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),question);
 const focused=await page.evaluate(()=>document.activeElement?.id);
 assert.equal(focused,'v230-answer');
 const afterChildClick=await local(page);
 assert.deepEqual(afterChildClick,parentSaved,
  'child navigation should not auto-add retries or erase parent observation');
 await screenshot(page,'06-after-child-deeplink-320');
 pass('child CTA focuses actual A retry input with same ID/photo and existing saved parent observation unchanged');

 await page.locator('#nav-home').click();
 await page.reload();
 await page.locator('#wrong-p13-go:visible').waitFor();
 const reload=await ctaGeometry(page,'afterReload390Parent');
 assert.equal(reload.buttonText,'👀 아이 설명 보고 관찰하기');
 assert.deepEqual(await local(page),parentSaved);
 await screenshot(page,'07-after-reload-parent-390');
 pass('reload restores existing local original A record and parent CTA, no migrated restored ledger');

 // Fresh synthetic browser profile: hide follow-up CTA when there is no saved A ID,
 // leaving original first registration entrypoint intact.
 const blank=await browser.newContext({viewport:{width:320,height:720},locale:'ko-KR'});
 const blankPage=await blank.newPage();await blankPage.goto(origin+'/candidate');
 await blankPage.locator('#nav-add').waitFor();
 assert.equal(await blankPage.locator('#wrong-p13-first-action').isVisible(),false);
 assert.equal(await blankPage.locator('#v08-home-add').isVisible(),true);
 await screenshot(blankPage,'08-after-empty-start-320');
 await blank.close();
 pass('empty synthetic A profile shows original registration not a phantom retry/guardian action');

 assert.equal(sha(execFileSync('git',['show',baseSha+':index.html'],{maxBuffer:8*1024*1024})),sha(original));
 assert.equal(ev.externalRequests,0);
 ev.aRecordId=id;
 ev.photo=created.photos[0];ev.changeSummary={
  onlyAHomeNavigationCandidate:true,existingAStorageFieldsOnly:true,
  parentAutoObservationCount:0,childAutoRetryCount:0,
  parentExplicitCheckHistoryCount:1,allPhotoShaIdentical:true};
 ev.result='PASS';ev.checkCount=ev.checks.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P13_CTA_RESULT='+JSON.stringify({status:'PASS',
  checks:ev.checkCount,shots:ev.screenshots.length,
  parentFirstViewport:true,childFirstViewport:true,
  originalIdPhoto:true,readsOriginalAFields:true,
  autoParentWrites:0,safeToRestore:false}));
}catch(error){
 ev.result='FAIL';ev.error=String(error);
 ev.stack=String(error?.stack||'').slice(0,3000);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P13_CTA_RESULT='+JSON.stringify({status:'FAIL',
  checks:ev.checks.length,error:String(error),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
