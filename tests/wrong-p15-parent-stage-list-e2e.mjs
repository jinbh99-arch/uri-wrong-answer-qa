// WRONG-P15 targeted E2E: four real original A local records, not P13/P11 reruns.
// Compare P13 first-record/observed fallback against P14 timestamp-state CTA.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P15_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P15_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='ffcaffbdaeee589d3b73bd028b867af4a8d237ed';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after));
assert.ok(before.includes('wrong-p13-first-action'));
assert.equal(before.includes('wrongP15Stage'),false);
assert.ok(after.includes('새 관찰할 설명 없음'));
assert.ok(after.includes('wrongP15Stage'));
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
const dir='test-results/wrong-p15';
const ev={task:'WRONG-P15 multi-record A local first-action CTA selection',
  baseP14:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P15_STAGES '+ev.validations.length+' '+label)}
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


 // Add one MANUAL desired revisit note using original A, after explicit parent
 // observation C; this is NOT calendar scheduling, a push or completed check.
 await open(page,ids.C);
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong008-next-review:visible').waitFor();
 const future=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(future);
 await page.locator('#wrong008-next-question').fill('이유를 한 문장으로 다시 말해 보기');
 const priorDateClick=await local(page);
 assert.equal(priorDateClick.rows.find(r=>r.id===ids.C).checkHistory.length,1);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),future);
 const prepared=await local(page);
 immutable(fresh,prepared);
 assert.equal(prepared.rows.find(r=>r.id===ids.C).checkHistory.length,2);
 assert.equal(prepared.rows.find(r=>r.id===ids.C).checkHistory.at(-1).status,'not_checked');
 assert.ok(prepared.rows.find(r=>r.id===ids.C).checkHistory.at(-1).memo.includes('자동 알림 없음'));
 state(prepared,'prepared-C-explicit-observation-plus-manual-next-date',{manualDesiredDate:future});
 pass('original A user inputs one manual C next-check memo: status not_checked, no reminder/complete; 4 original photos preserved');

 // Baseline before P15: A list only reports a total observed count, no per
 // record child explanation, outstanding parent review or pending manual date.
 await page.locator('#nav-home').click();
 await page.setViewportSize({width:390,height:844});
 await snap(page,'01-before-parent-home-390');
 const beforeHomepage=await local(page);
 assert.deepEqual(beforeHomepage,prepared);
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 const baseList=await page.evaluate(ids=>{
  return {width:innerWidth,height:innerHeight,scrollY,
   scrollWidth:document.documentElement.scrollWidth,
   cards:[...document.querySelectorAll('#records-list .item')].map(b=>({
      recordId:b.dataset.record,text:b.textContent.trim(),
      stageCount:b.querySelectorAll('[data-wrong-p15-stage]').length
   })), manualDayLabelCount:[...document.querySelectorAll('#records-list .item')]
     .filter(b=>b.textContent.includes('다음 확인 날짜')).length};
 },ids);
 assert.equal(baseList.cards.length,4);
 assert.ok(baseList.cards.every(x=>x.stageCount===0));
 assert.ok(baseList.cards.every(x=>!x.text.includes(future)),'baseline list hides manual memo date');
 ev.evidenceBefore={firstHomeToListClicks:1,stageInList:false,
  baselineList:baseList,manualCDateNotVisibleAtList:true};
 await snap(page,'02-before-parent-list-390');
 pass('P14 baseline actual parent list hides C manual-date and A/B/D stage: must open record to discover state');
 await page.locator('#records-list [data-record="'+ids.C+'"]').click();
 await page.locator('#wrong008-next-review:visible').waitFor();
 const baseDetail=await page.evaluate(()=>{
  const el=document.querySelector('#wrong008-next-review');
  return {height:innerHeight,scrollY,top:el?.getBoundingClientRect().top};
 });
 await page.locator('#wrong008-last-manual-note').scrollIntoViewIfNeeded();
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 ev.evidenceBefore.detailForC={clicksFromHome:2,scrollY:await page.evaluate(()=>scrollY),
  detailBeforeScroll:baseDetail,manualDateVisibleAfterOpening:true};
 await snap(page,'03-before-C-detail-requires-opening-and-scroll-390');
 assert.deepEqual(await local(page),prepared);
 pass('baseline C manual memo requires opening specific A ID and scrolling detail; navigation writes zero');

 // AFTER P15: same origin and 4 authentic A photos and IndexedDB records,
 // ONLY the existing records-list card footer exposes current stage.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#nav-home').click();
 await snap(page,'04-after-parent-home-390');
 const ctaP14Before=await page.locator('#wrong-p13-go').getAttribute('data-record-id');
 assert.equal(ctaP14Before,ids.D,'P14 latest unobserved D first action unchanged');
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 async function readList(){
  return page.evaluate(()=>{
   const cards=[...document.querySelectorAll('#records-list [data-record]')];
   return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
    scrollY,items:cards.map(card=>{
     const st=card.querySelector('[data-wrong-p15-stage]');
     const r=st?.getBoundingClientRect();
     return {id:card.dataset.record,stage:st?.textContent?.trim()||null,
       stageVisible:st?!!(r.width&&r.height&&getComputedStyle(st).display!=='none'):false,
       stageId:st?.dataset.wrongP15Stage||null,
       cardTitle:card.querySelector('strong')?.textContent,
       position:r?{y:+r.y.toFixed(1),height:+r.height.toFixed(1)}:null};
    })};
  });
 }
 const p390=await readList();
 assert.equal(p390.items.length,4);
 assert.ok(p390.scrollWidth<=390,'no horizontal overflow 390');
 const byId=new Map(p390.items.map(x=>[x.id,x]));
 assert.ok(byId.get(ids.A).stage.includes('아이 재풀이·설명 전'));
 for(const k of ['B','D']){
  assert.ok(byId.get(ids[k]).stage.includes('아이 설명 있음 · 부모 관찰 전'));
  assert.ok(byId.get(ids[k]).stage.includes('다음 확인 날짜 메모 없음'));
 }
 assert.ok(byId.get(ids.C).stage.includes('부모 관찰 기록 있음'));
 assert.ok(byId.get(ids.C).stage.includes(future));
 assert.ok(byId.get(ids.C).stage.includes('수동 메모 (알림·완료 아님)'));
 assert.ok(p390.items.every(x=>x.stageVisible&&x.stageId===x.id));
 ev.evidenceAfter={parent390:p390,firstHomeToListClicks:1,
  CManualDateDiscoverableWithoutDetailOpen:true,stageTargetIdsCorrect:true,
  P14ParentFirstCtaStillD:true};
 await snap(page,'05-after-parent-list-390');
 assert.deepEqual(await local(page),prepared,'reading stage list must not change stored A records');
 pass('parent 390 lists A no retry/B+D pending/C observed+manual date with exact same existing A IDs; DB writes zero');

 await page.setViewportSize({width:320,height:720});
 await page.locator('#records-list [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 const p320=await readList();
 assert.ok(p320.scrollWidth<=320,'no horizontal overflow 320');
 assert.ok(p320.items.every(x=>x.stageVisible));
 assert.ok(p320.items.find(x=>x.id===ids.C).stage.includes(future));
 ev.evidenceAfter.parent320=p320;
 await snap(page,'06-after-parent-list-320');
 pass('parent 320 list preserves 4 stage labels and manual-not-alarm warning without horizontal overflow');
 // Jump from exactly labeled C row to the original A detailed manual note.
 await page.locator('#records-list [data-record="'+ids.C+'"]').click();
 await page.locator('#detail-image img').waitFor();
 await page.locator('#wrong008-next-review:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 assert.ok((await page.locator('#wrong008-next-review').innerText()).includes('자동 알림·일정 예약·완료 판정은 없습니다'));
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.C));
 await page.locator('#wrong008-next-review').scrollIntoViewIfNeeded();
 await snap(page,'07-after-C-manual-date-original-detail-320');
 assert.deepEqual(await local(page),prepared,'open C detail cannot create new observation or mark memo done');
 pass('C stage card opens genuine A C photo/explanation/original manual-date form; before explicit write exact IndexedDB unchanged');

 // P14 parent CTA selection and child screen hiding remain untouched.
 await page.locator('#nav-home').click();
 const selected=await page.locator('#wrong-p13-go').getAttribute('data-record-id');
 assert.equal(selected,ids.D);
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-records').click();
 const childList=await readList();
 assert.ok(childList.items.every(x=>!x.stageVisible));
 await snap(page,'08-after-child-list-320-stage-parent-only');
 assert.deepEqual(await local(page),prepared);
 pass('child 320 retains original item navigation, P15 parent stage details hidden, no retries/observations added');
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-home').click();
 await page.reload();
 await page.locator('#nav-records').waitFor();
 await page.locator('#nav-records').click();
 const reloaded=await readList();
 assert.ok(reloaded.items.find(x=>x.id===ids.C).stage.includes(future));
 const unchanged=await local(page);
 assert.deepEqual(unchanged,prepared);
 assert.equal(ev.externalHttp,0);
 state(unchanged,'after-reload-P15-stages-still-present-and-original-A-storage-unchanged');
 await snap(page,'09-after-reload-stage-retained-320');
 pass('manual note remains pending after reload, P15 stage read-only, all 4 A record IDs/photos SHA unchanged; outbound requests 0');

 ev.evidenceAfter.child320=childList;
 ev.evidenceAfter.afterReload=reloaded;
 ev.evidenceAfter.noAutomaticParentOrChildSave=true;
 ev.evidenceAfter.manualNoteStatus='not_checked';
 ev.evidenceAfter.photoHashesIdentical=true;
 ev.evidenceAfter.detailOpensCorrectOriginalAId=true;
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P15_STAGE_RESULT='+JSON.stringify({
  status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
  records:4,photos:4,oldStageVisible:0,newStageVisible:4,
  parentScrollForCStateWithoutDetail:true,autoWrites:0,
  safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);
 ev.stack=String(e?.stack||'').slice(0,2500);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P15_STAGE_RESULT='+JSON.stringify({
  status:'FAIL',checks:ev.validations.length,error:String(e),
  safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
