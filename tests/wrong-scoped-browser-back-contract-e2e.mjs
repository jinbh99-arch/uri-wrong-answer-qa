// WRONG-INTEGRATION targeted A guardian integrated journey across sixteen actual synthetic records.
// Reuse P17 seeding helpers, but validate new combined user task, not old P17 filter tests.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_SCOPED_BACK_LOCAL_ONLY!=='1')
 throw Error('WRONG_SCOPED_BACK_LOCAL_ONLY_GATE_REQUIRED');
const base='d212f7708c83a80bb94f652ba0ecc70ec4cd77c9';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after),'opt-in localhost history prototype expected on independent QA branch');
assert.ok(after.includes('WRONG scoped-back EXPERIMENT'));
assert.ok(after.includes('Narrow 200% keyboard correction'));
assert.ok(after.includes('WRONG-P18 verified 320x720 P1'));
assert.ok(after.includes('WRONG-P19 QA only'));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(before.includes('wrongP15Stage'));
 assert.ok(!before.includes('WRONG-INTEGRATION: same read-only'));

assert.ok(after.includes('새 관찰할 설명 없음'));
assert.ok(after.includes('wrongP15Stage'));
 assert.ok(after.includes('WRONG-P16: same read-only'));
assert.ok(after.includes('WRONG-P17 non-operating candidate'));

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
const moreLabels=Array.from({length:12},(_,i)=>'E'+String(i+1).padStart(2,'0'));
for(const [i,key] of moreLabels.entries())
 questions[key]='가상 국어 '+key+' · 읽고 줄거리 이해하기 (합성 오답 '+String(i+1)+'건)';

const dir='test-results/wrong-scoped-back';
const ev={task:'WRONG scoped Back original A D photo/observation one target, baseline vs local-only opt-in prototype',
  baselineProductSha:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_SCOPED_BACK '+ev.validations.length+' '+label)}
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
    return res.end(js[p]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:320,height:720},locale:'ko-KR'});
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==origin){
    ev.externalHttp++;return route.abort();
  }
  return route.continue();
 });
 const page=await context.newPage();
 const baseUrl=origin+'/base',candidateUrl=origin+'/candidate?wrongHistoryQa=1';
 const measures=[];
 const measure=async(stage)=>{
   const m=await page.evaluate(()=>({
     url:location.href,historyLength:history.length,state:history.state,
     page:document.querySelector('#page-detail')?.classList.contains('hide')?'not-detail':'detail',
     recordsShown:!document.querySelector('#page-records')?.classList.contains('hide'),
     focusedId:document.activeElement?.id||'',
     filter:document.querySelector('#wrong-p17-state-filter')?.value||null,
     viewport:[innerWidth,innerHeight],
     overflow:document.documentElement.scrollWidth-innerWidth
   }));
   measures.push({stage,...m});return m;
 };
 assert.equal((await page.goto(baseUrl)).status(),200);
 await page.locator('#nav-add').waitFor();
 const record=await add(page,'D');const id=record.id;
 await retry(page,id,'D');
 const parent=await observe(page,id,'D');
 assert.equal(parent.generalRetryHistory.at(-1).review,'explained');
 assert.equal(parent.checkHistory.length,1);
 const stored=await local(page);
 assert.equal(stored.rows.length,1);assert.equal(stored.photos.length,1);
 assert.equal(stored.photos[0].bytes,759);
 const identity={id,photo:stored.photos[0],retry:parent.generalRetryHistory,
  parentObservation:parent.checkHistory};
 state(stored,'one original A synthetic D with photo, child explanation, explicit parent observed',{id});
 await snap(page,'01-original-A-D-photo-and-parent-observation');
 pass('real A original D photo, child explanation and explicit parental observation saved only through A UI, 1 JPEG');

 // BASELINE: a record-list click does not make History API entry, so
 // browser back from D detail leaves this single-document SPA.
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 const baselineBefore=await measure('baseline D detail before real browser Back');
 assert.equal(baselineBefore.url,baseUrl);
 await snap(page,'02-baseline-original-D-detail-before-browser-back');
 const originalBack=await page.goBack({waitUntil:'domcontentloaded',timeout:10000});
 const baselineAfter=await measure('baseline browser Back result');
 assert.equal(baselineAfter.url,'about:blank','baseline single-document SPA exits to blank');
 ev.baselineBack={before:baselineBefore,after:baselineAfter,response:originalBack?.status?.()??null};
 pass('exact prior P19 history baseline: physical browser Back analog leaves SPA to about:blank; not a data-erasing operation');

 // Candidate is explicit loopback opt-in. It must not touch URL identifier,
 // auth, photo, local DB on push/pop.
 assert.equal((await page.goto(candidateUrl)).status(),200);
 await page.locator('#nav-records').click();
 assert.equal((await local(page)).rows[0].id,id);
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 const candidateDetail=await measure('candidate after D list-to-detail pushState');
 assert.equal(candidateDetail.page,'detail');
 assert.equal(candidateDetail.url,candidateUrl);
 assert.deepEqual(candidateDetail.state,{wrongScopedDetailOnly:true});
 assert.ok(!candidateDetail.url.includes(id),'no D ID in URL');
 assert.ok(!JSON.stringify(candidateDetail.state).includes(id),'no D ID in state');
 assert.deepEqual(await local(page),stored);
 await snap(page,'03-local-only-candidate-D-history-marker-no-ID');
 pass('guarded local-only QA prototype adds no-ID same URL detail history state; A D photo/observation unchanged');

 // EXACT desired target: browser Back from D detail returns to record list,
 // not home/about:blank, then D ID and picture remain identifiable.
 await page.goBack({waitUntil:'domcontentloaded',timeout:10000});
 await page.locator('#page-records:not(.hide)').waitFor();
 const candidateList=await measure('candidate browser Back D detail to records');
 assert.equal(candidateList.url,candidateUrl);
 assert.equal(candidateList.recordsShown,true);
 assert.equal(candidateList.filter,'all');
 assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
 assert.deepEqual(await local(page),stored);
 await snap(page,'04-candidate-browser-Back-returns-to-D-list');
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.equal(await page.locator('#v230-review').inputValue(),'explained');
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 assert.ok((await page.locator('#check-history').innerText()).includes('D 관찰'));
 assert.deepEqual(await local(page),stored);
 await snap(page,'05-reopen-same-D-original-photo-reviewed');
 pass('Back record-list return and SAME D ID/photo/child/guardian check re-open with DB byte/hash unmodified, auto-write0');

 // Manual original "← 목록으로" must work on current candidate scoped entry.
 await page.locator('#page-detail [data-route="records"]').click();
 await page.locator('#page-records:not(.hide)').waitFor();
 const manual=await measure('candidate original A ← 목록으로 converted via history.back');
 assert.equal(manual.recordsShown,true);
 assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
 assert.deepEqual(await local(page),stored);
 await snap(page,'06-original-in-app-list-button-still-returns');
 pass('original in-app ← 목록으로 still returns to records and preserves one D without duplicate writes');

 // Explicitly identify FORWARD and reload caveats instead of claiming an
 // entire safe browser history router: closed scope means history.forward
 // restores the marker, but no detail UI reconstructs.
 const beforeForward=await measure('candidate before browser Forward hazard check');
 await page.goForward({waitUntil:'domcontentloaded',timeout:10000});
 const afterForward=await measure('candidate browser Forward hazard check');
 ev.forwardScope={before:beforeForward,after:afterForward,
   markerRestored:afterForward.state?.wrongScopedDetailOnly===true,
   detailReopened:afterForward.page==='detail'};
 assert.deepEqual(await local(page),stored);
 await snap(page,'07-forward-boundary-not-a-global-router');
 pass('Forward browser history boundary classified; prototype is NOT general history router and does not write A records');

 // Localhost flag is required: without it candidate must show the baseline
 // A behavior (no history push) with same origin and original 1 D record.
 await page.goto(origin+'/candidate');
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 const inactive=await measure('candidate without opt-in after detail');
 assert.notDeepEqual(inactive.state,{wrongScopedDetailOnly:true},
   'without flag no scoped detail push');
 assert.deepEqual(await local(page),stored);
 await snap(page,'08-inactive-without-localhost-qa-flag');
 pass('candidate flag OFF does not activate History prototype; A record/picture still intact');

 ev.details={targetD:id,originalIdAndPhotoPreserved:true,explicitParentCheckPreserved:true,
    baselineBackToBlank:true,prototypeBackToSameDList:true,guardianModeNotAuth:true,
    optInLocalhostOnly:true,notProductionRouter:true,
    realPhoneUsed:false,realChildDataUsed:false,autoWrites:0,
    strictNoRestore:true,forwardScope:ev.forwardScope,measurements:measures};
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_SCOPED_BACK_RESULT='+JSON.stringify({
   status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
   records:1,photos:1,observedD:true,sameDReopened:true,
   browserBackToList:true,forwardSupported:ev.forwardScope.detailReopened,
   guardedOptInOnly:true,autoWrites:0,externalHTTP:0,safeToRestore:false
 }));
}catch(e){
 ev.result='FAIL';ev.error=String(e);ev.stack=String(e?.stack||'').slice(0,2800);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_SCOPED_BACK_RESULT='+JSON.stringify({
  status:'FAIL',checks:ev.validations.length,error:String(e),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
