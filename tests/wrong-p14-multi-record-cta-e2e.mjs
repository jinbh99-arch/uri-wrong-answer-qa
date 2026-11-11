// WRONG-P14 targeted E2E: four real original A local records, not P13/P11 reruns.
// Compare P13 first-record/observed fallback against P14 timestamp-state CTA.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P14_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P14_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='53f6fb6ffa1ba37db30b3bb9d63c40cf00049760';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(after.includes('새 관찰할 설명 없음'));
const js={
 '/scripts/qa-inapp-sync-bridge.mjs':readFileSync(new URL('../scripts/qa-inapp-sync-bridge.mjs',import.meta.url)),
 '/scripts/qa47-live-auth-lab.mjs':readFileSync(new URL('../scripts/qa47-live-auth-lab.mjs',import.meta.url))
};
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const questions={
 A:'가상 국어 A · 원인 문장 찾기 (설명 기록 없음)',
 B:'가상 국어 B · 문장의 핵심 이유를 설명하기 (미관찰)',
 C:'가상 국어 C · 문장과 행동 연결하기 (관찰 완료)',
 D:'가상 국어 D · 읽은 까닭을 다시 말하기 (가장 최근 등록·미관찰)'
};
const explanations={
 B:'B 아이가 책의 내용과 까닭을 자기 말로 설명했어요.',
 C:'C 아이가 행동과 까닭을 연결하여 자기 말로 설명했어요.',
 D:'D 아이가 핵심 문장을 다시 읽고 이유를 자기 말로 설명했어요.'
};
const dir='test-results/wrong-p14';
const ev={task:'WRONG-P14 multi-record A local first-action CTA selection',
  baseP13:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P14_MULTIRECORD '+ev.validations.length+' '+label)}
async function snap(page,name){
 await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});
 ev.screenshots.push(name+'.png');
}
async function local(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);
    req.onerror=()=>no(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const all=(store,method)=>new Promise((ok,no)=>{
    const q=tx.objectStore(store)[method]();
    q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
   const [rows,ids,blobs]=await Promise.all([
    all('mistakes','getAll'),all('photos','getAllKeys'),all('photos','getAll')]);
   const photos=[];
   for(let i=0;i<blobs.length;i++){
    const bytes=await blobs[i].arrayBuffer();
    const hashed=await crypto.subtle.digest('SHA-256',bytes);
    photos.push({id:String(ids[i]),bytes:bytes.byteLength,mime:blobs[i].type,
      sha256:[...new Uint8Array(hashed)].map(v=>v.toString(16).padStart(2,'0')).join('')});
   }
   return {rows,photos};
  }finally{db.close()}
 });
}
function immutable(initial,later){
 const key=['id','subject','gradeAtEntry','problemText','hasPhoto','createdAt'];
 assert.equal(initial.rows.length,later.rows.length);
 assert.deepEqual(later.photos,initial.photos,'all four original A photo byte/hash metadata immutable');
 for(const a of initial.rows){
  const b=later.rows.find(x=>x.id===a.id);assert.ok(b);
  for(const p of key)assert.deepEqual(b[p],a[p],a.id+': '+p+' unexpectedly changed');
 }
}
function state(data,name,map){
 ev.states.push({stage:name,recordCount:data.rows.length,
  photos:data.photos,rows:data.rows.map(r=>({
   label:Object.keys(questions).find(k=>r.problemText===questions[k]),id:r.id,
   createdAt:r.createdAt,updatedAt:r.updatedAt,
   lastRetryAt:r.generalRetryHistory?.at(-1)?.at||null,
   lastRetryReview:r.generalRetryHistory?.at(-1)?.review||null,
   childExplanation:r.generalRetryHistory?.at(-1)?.explanation||null,
   retryCount:r.generalRetryHistory?.length||0,
   checkCount:r.checkHistory?.length||0
  })),...map});
}
async function getRecord(page,label){
 const db=await local(page);return db.rows.find(x=>x.problemText===questions[label]);
}
async function add(page,label){
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(questions[label]);
 await page.locator('#choose-photo').setInputFiles({
   name:'synthetic-only-1px.png',mimeType:'image/png',buffer:photo});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const r=await getRecord(page,label);
 assert.equal(r.problemText,questions[label]);assert.equal(r.hasPhoto,true);
 await page.waitForTimeout(20); // A assigns local ISO timestamps; no policy decisions.
 return r;
}
async function open(page,id){
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 await page.locator('#v230-answer:visible').waitFor();
}
async function retry(page,id,label){
 await open(page,id);
 await page.locator('#v218-child-mode').click();
 await page.locator('#v230-answer').fill(label+'의 답은 글 속 행동을 다시 읽어 확인했어요.');
 await page.locator('#v230-explanation').fill(explanations[label]);
 await page.locator('#v230-save').click();
 await page.waitForFunction(id=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'),
  id);
 const r=await getRecord(page,label);
 assert.equal(r.generalRetryHistory?.length,1);
 assert.equal(r.generalRetryHistory[0].review,'not_checked');
 assert.equal(r.generalRetryHistory[0].explanation,explanations[label]);
 await page.waitForTimeout(20);
 return r;
}
async function waitReview(page,id,expected){
 await page.waitForFunction(async([id,expected])=>{
  const q=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise(ok=>q.onsuccess=()=>ok(q.result));
  try{
   const t=db.transaction('mistakes','readonly').objectStore('mistakes').get(id);
   const row=await new Promise(ok=>t.onsuccess=()=>ok(t.result));
   const attempt=row?.generalRetryHistory?.at(-1);
   return attempt?.review===expected&&Boolean(attempt.reviewedAt)
  }finally{db.close()}
 },[id,expected],{timeout:10000});
}
async function observe(page,id,label){
 await page.locator('#v218-parent-mode').click();
 // A already displays the latest retry's original parent-review controls.
 await page.locator('#v230-review:visible').selectOption('explained');
 await page.locator('#v230-review-save').click();
 await waitReview(page,id,'explained');
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill(label+' 관찰: 설명을 직접 들었습니다.');
 await page.locator('#check-save').click();
 await page.waitForFunction(s=>document.querySelector('#check-history')?.textContent?.includes(s),
  label+' 관찰: 설명을 직접 들었습니다.');
 return await getRecord(page,label);
}
async function geometry(page,label){
 const o=await page.evaluate(()=>{
  const b=document.querySelector('#wrong-p13-go');
  const r=b?.getBoundingClientRect();
  const wrap=document.querySelector('#wrong-p13-first-action');
  return {width:innerWidth,height:innerHeight,contentWidth:document.documentElement.scrollWidth,
    action:b?.textContent.trim(),disabled:b?.disabled,selectedRecord:b?.dataset.recordId,
    context:document.querySelector('#wrong-p13-context')?.textContent,
    parent:document.querySelector('#v218-parent-mode')?.getAttribute('aria-pressed'),
    child:document.querySelector('#v218-child-mode')?.getAttribute('aria-pressed'),
    shown:!!wrap&&!wrap.classList.contains('hide'),
    box:r?{y:+r.y.toFixed(1),bottom:+r.bottom.toFixed(1),height:+r.height.toFixed(1)}:null};
 });
 assert.ok(o.shown,'one home action appears');
 assert.ok(o.contentWidth<=o.width+1,'no horizontal scroll');
 assert.ok(o.box.y>=0&&o.box.bottom<=o.height,'CTA first viewport '+JSON.stringify(o));
 assert.ok(o.box.height>=44,'touch action minimum');
 ev.measurements.push({stage:label,...o});
 return o;
}
let server,browser,context;
try{
 mkdirSync(dir,{recursive:true});
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&(p==='/base'||p==='/candidate')){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   return res.end(p==='/base'?before:after);
  }
  if(req.method==='GET'&&Object.hasOwn(js,p)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
   return res.end(js[p])
  }
  res.writeHead(404);res.end('NOT_FOUND')
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
 await context.route('**/*',route=>{
  const u=route.request().url();
  if(/^https?:/.test(u)&&new URL(u).origin!==origin){
   ev.externalHttp++;return route.abort()}
  return route.continue()
 });
 const page=await context.newPage();
 assert.equal((await page.goto(origin+'/base')).status(),200);
 await page.locator('#nav-add').waitFor();
 const ids={};
 for(const label of ['A','B','C','D'])ids[label]=(await add(page,label)).id;
 assert.equal(new Set(Object.values(ids)).size,4);
 const fresh=await local(page);
 assert.equal(fresh.rows.length,4);assert.equal(fresh.photos.length,4);
 for(const row of fresh.rows)assert.equal(row.hasPhoto,true);
 const order=[...fresh.rows].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 assert.equal(order.at(-1).id,ids.D,'D is newest A-record by actual createdAt');
 state(fresh,'four-registered-photo-bearing-A-records',{ids});
 pass('real original A UI registers four distinct synthetic Korean mistakes/photos; D newest by saved createdAt');

 await retry(page,ids.B,'B');await retry(page,ids.C,'C');
 // C: parent observation completed, B still pending.
 const cReview=await observe(page,ids.C,'C');
 assert.equal(cReview.generalRetryHistory.at(-1).review,'explained');
 await retry(page,ids.D,'D');
 const mixed=await local(page);
 immutable(fresh,mixed);
 assert.equal(mixed.rows.find(r=>r.id===ids.A).generalRetryHistory?.length||0,0);
 assert.equal(mixed.rows.find(r=>r.id===ids.B).generalRetryHistory.at(-1).review,'not_checked');
 assert.equal(mixed.rows.find(r=>r.id===ids.C).generalRetryHistory.at(-1).review,'explained');
 assert.equal(mixed.rows.find(r=>r.id===ids.D).generalRetryHistory.at(-1).review,'not_checked');
 assert.ok(Date.parse(mixed.rows.find(r=>r.id===ids.D).generalRetryHistory[0].at)>
           Date.parse(mixed.rows.find(r=>r.id===ids.B).generalRetryHistory[0].at));
 state(mixed,'A-none-B-pending-C-reviewed-D-newer-pending');
 pass('real A states: no explanation A, pending B, reviewed C, newest pending D; all photos unchanged');

 // PRE: force child last-viewed old A, proving P13 chooses viewed instead of newest.
 await page.setViewportSize({width:320,height:720});
 await open(page,ids.A);
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-home').click();
 const preChild=await geometry(page,'P13-before-child-old-viewed-320');
 assert.ok(preChild.context.includes(questions.A.slice(0,34)));
 await snap(page,'01-before-child-old-320');
 await page.locator('#wrong-p13-go').click();
 await page.locator('#detail-text:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.A);
 ev.evidenceBefore.childTarget=ids.A;
 await page.locator('#v218-parent-mode').click();
 // PRE: parent can choose old pending B instead of newest D depending on array order.
 await open(page,ids.C);
 await page.locator('#nav-home').click();
 await page.setViewportSize({width:390,height:844});
 const preParent=await geometry(page,'P13-before-parent-390');
 await snap(page,'02-before-parent-mixed-390');
 ev.evidenceBefore.parentLabel=preParent.context;
 await page.locator('#wrong-p13-go').click();
 await page.locator('#detail-text:visible').waitFor();
 ev.evidenceBefore.parentTarget=Object.keys(questions)
   .find(k=>questions[k]===(await page.locator('#detail-text').innerText()));
 assert.deepEqual(await local(page),mixed,'reading baseline parent CTA does not mutate A records');
 pass('P13 original measured: child stale A selected, parent pending order directly observed; CTA click itself writes nothing');

 // AFTER: same origin, no new DB, only candidate A-derived home CTA code.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#wrong-p13-go:visible').waitFor();
 const parent390=await geometry(page,'P14-after-parent-newest-pending-390');
 assert.equal(parent390.selectedRecord,ids.D);
 assert.ok(parent390.context.includes('미관찰 재풀이 저장순'));
 assert.ok(parent390.context.includes(questions.D.slice(0,25)));
 assert.ok(parent390.action.includes('관찰 전인 아이 설명 보기'));
 assert.equal(parent390.disabled,false);
 await snap(page,'03-after-parent-newest-pending-390');
 await page.setViewportSize({width:320,height:720});
 const parent320=await geometry(page,'P14-after-parent-newest-pending-320');
 assert.equal(parent320.selectedRecord,ids.D);
 await snap(page,'04-after-parent-newest-pending-320');
 await page.setViewportSize({width:390,height:844});
 assert.deepEqual(await local(page),mixed);
 pass('P14 parents 320/390 get latest timestamped *unobserved* D (not older C/B), exact target exposed');

 const beforeParentClick=await local(page);
 await page.locator('#wrong-p13-go').click();
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 assert.equal(await page.locator('#v230-review').inputValue(),'not_checked');
 assert.deepEqual(await local(page),beforeParentClick,'parent CTA never auto-saves observation');
 await snap(page,'05-after-parent-click-D-390');
 pass('parent CTA opens ORIGINAL A D ID/photo/latest child explanation; before parent manual action observation 0');

 // Explicit parent actions only. Once D reviewed, B becomes only eligible.
 const dObserved=await observe(page,ids.D,'D');
 assert.equal(dObserved.generalRetryHistory.at(-1).review,'explained');
 await page.locator('#nav-home').click();
 const fallback=await geometry(page,'P14-after-D-reviewed-choose-B');
 assert.equal(fallback.selectedRecord,ids.B);
 assert.ok(fallback.context.includes(questions.B.slice(0,25)));
 await snap(page,'06-after-D-reviewed-next-pending-B-390');
 await page.locator('#wrong-p13-go').click();
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.B);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.B));
 const bObserved=await observe(page,ids.B,'B');
 assert.equal(bObserved.generalRetryHistory.at(-1).review,'explained');
 const allObserved=await local(page);
 immutable(fresh,allObserved);
 state(allObserved,'all-explained-attempts-reviewed-A-no-explanation');
 pass('only after explicit parent clicks, D then B observations persist; no synthetic backend, A photos unchanged');

 // With all available child explanations reviewed, P13 USED TO fall back to
 // the last observed explanation and misleadingly label it "관찰하기".
 await page.locator('#nav-home').click();
 const disabled=await geometry(page,'P14-after-all-reviewed-disabled-390');
 assert.equal(disabled.disabled,true);
 assert.equal(disabled.selectedRecord,'');
 assert.ok(disabled.action.includes('새 관찰할 설명 없음'));
 assert.ok(disabled.context.includes('이미 관찰했습니다'));
 await snap(page,'07-after-all-reviewed-parent-disabled-390');
 await page.setViewportSize({width:320,height:720});
 const disabled320=await geometry(page,'P14-parent-disabled-320');
 assert.equal(disabled320.disabled,true);
 await snap(page,'08-after-all-reviewed-parent-disabled-320');
 await page.evaluate(()=>document.querySelector('#wrong-p13-go')?.click());
 assert.deepEqual(await local(page),allObserved);
 pass('zero pending explanation: parent 390/320 CTA disabled, explicit no-new-observation text, click writes zero');

 // Again force last-viewed old A, then switch to child; P14 must offer newest
 // registration D, not A, and navigate to real A input while preserving 4 SHA.
 await open(page,ids.A);
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-home').click();
 const child320=await geometry(page,'P14-child-after-stale-A-viewed-320');
 assert.equal(child320.selectedRecord,ids.D);
 assert.ok(child320.action.includes('가장 최근 등록한 오답 다시 풀기'));
 assert.ok(child320.context.includes('최근 등록순'));
 await snap(page,'09-after-child-latest-320');
 await page.setViewportSize({width:390,height:844});
 const child390=await geometry(page,'P14-child-latest-390');
 assert.equal(child390.selectedRecord,ids.D);
 await snap(page,'10-after-child-latest-390');
 assert.deepEqual(await local(page),allObserved);
 await page.locator('#wrong-p13-go').click();
 await page.locator('#v230-answer:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 await page.waitForFunction(()=>document.activeElement?.id==='v230-answer',{},{timeout:5000});
 assert.deepEqual(await local(page),allObserved,'child deep-link does not append retries');
 await snap(page,'11-after-child-click-real-D-390');
 pass('child 320/390 selects latest A-created D even after visiting old A; real form focused; no automatic retry');

 await page.locator('#nav-home').click();
 await page.reload();
 await page.locator('#wrong-p13-go:visible').waitFor();
 const refreshed=await geometry(page,'P14-reload-parent-pending-none-390');
 assert.equal(refreshed.selectedRecord,'');
 assert.equal(refreshed.disabled,true);
 assert.deepEqual(await local(page),allObserved);
 await snap(page,'12-after-reload-no-fake-parent-observation-390');
 assert.equal(ev.externalHttp,0);
 ev.evidenceAfter={ids,childLatestRecord:ids.D,
   parentMostRecentPending:ids.D,parentNextAfterD:ids.B,
   parentAfterAllReviewed:null,autoParentWrites:0,autoChildWrites:0,
   photographSignatures:fresh.photos,finalHistoryStates:allObserved.rows.map(r=>({
    id:r.id,retries:r.generalRetryHistory?.length||0,
    latestReview:r.generalRetryHistory?.at(-1)?.review||null,
    checkCount:r.checkHistory?.length||0
   })),noStorageSchemaChange:true};
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P14_MULTIRECORD_RESULT='+JSON.stringify({
   status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
   records:4,photos:4,childLatest:true,parentLatestPending:true,
   parentNoPendingDisabled:true,parentPreclickWrites:0,
   safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);
 ev.stack=String(e?.stack||'').slice(0,2500);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P14_MULTIRECORD_RESULT='+JSON.stringify({
   status:'FAIL',checks:ev.validations.length,error:String(e),
   safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
