// WRONG-P17 targeted E2E: four real original A local records, not P13/P11 reruns.
// Compare P13 first-record/observed fallback against P14 timestamp-state CTA.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P17_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P17_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='4a099ceb381f96a5f0727a3fefc5a286078ec159';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(before.includes('wrongP15Stage'));
 assert.ok(!before.includes('WRONG-P17: same read-only'));

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

const dir='test-results/wrong-p17';
const ev={task:'WRONG-P17 multi-record A local first-action CTA selection',
  baseP16:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P17_STATE_FILTER '+ev.validations.length+' '+label)}
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
 for(const label of ['A','B','C','D',...moreLabels])ids[label]=(await add(page,label)).id;
 assert.equal(new Set(Object.values(ids)).size,16);
 const fresh=await local(page);
 assert.equal(fresh.rows.length,16);assert.equal(fresh.photos.length,16);
 for(const row of fresh.rows)assert.equal(row.hasPhoto,true);
 const order=[...fresh.rows].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 assert.equal(order.at(-1).id,ids.E12,'E12 newest A-record by actual createdAt');
 state(fresh,'sixteen-registered-photo-bearing-A-records',{ids});
 pass('original A UI registers 16 unique synthetic Korean records/photos and dated IDs, no synthetic DB injection');

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
 pass('16 A states: no explanation A, pending B/D, reviewed C, 12 plain new records; all photos SHA unchanged');



 // Use the actual A manual-date form; a completed parent observation does
 // not turn a date memo into a scheduled or completed action.
 await open(page,ids.C);
 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong008-next-review:visible').waitFor();
 const future=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(future);
 await page.locator('#wrong008-next-question').fill('글의 이유를 다음에 말로 다시 확인');
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(d=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(d),future);
 const seeded=await local(page);
 immutable(fresh,seeded);
 const c=seeded.rows.find(r=>r.id===ids.C);
 assert.equal(c.generalRetryHistory.at(-1).review,'explained');
 assert.equal(c.checkHistory.length,2);
 assert.equal(c.checkHistory.at(-1).status,'not_checked');
 assert.ok(c.checkHistory.at(-1).memo.includes('자동 알림 없음'));
 assert.equal(seeded.rows.find(r=>r.id===ids.B).generalRetryHistory.at(-1).review,'not_checked');
 assert.equal(seeded.rows.find(r=>r.id===ids.D).generalRetryHistory.at(-1).review,'not_checked');
 state(seeded,'seeded-16-with-parent-pending-and-completed-and-manual-date',{manualDate:future});
 pass('16 A records with B/D pending, C observed plus pending manual date; save only explicitly through original A');


 // BEFORE: parent 16 records; existing text/subject/photo filters cannot
 // query actual latest generalRetryHistory review or manual checkHistory memo.
 async function snap(name){await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});ev.screenshots.push(name+'.png')}
 async function listMeasurement(stage,targetId){
  return page.evaluate(id=>{
   const list=[...document.querySelectorAll('#records-list > button[data-record]')];
   const visible=list.filter(el=>el.getClientRects().length>0);
   const el=document.querySelector('#records-list > [data-record="'+id+'"]');
   const r=el?.getBoundingClientRect();
   const filter=document.querySelector('#wrong-p17-state-filter');
   const f=filter?.getBoundingClientRect();
   return {mode:document.body.classList.contains('v218-child')?'child':'parent',
     viewport:innerWidth,height:innerHeight,scrollY,
     horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
     DOMCount:list.length,visibleCount:visible.length,
     visibleIds:visible.map(el=>el.dataset.record),targetPresent:!!el,
     targetVisible:!!r&&r.width>0&&r.height>0,
     targetDocumentY:r?r.y+scrollY:null,
     filterPresent:!!filter,filterValue:filter?.value||null,
     filterVisible:!!f&&f.width>0&&f.height>0,
     resultCount:document.querySelector('#records-count')?.textContent?.trim(),
     stageTexts:visible.map(el=>el.querySelector('[data-wrong-p15-stage]')?.textContent?.trim()||'')};
  },targetId);
 }
 async function findC(stage){
  await page.locator('#records-list > [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
  const m=await listMeasurement(stage,ids.C);
  ev.measurements.push({stage,...m});
  return m;
 }
 await page.setViewportSize({width:320,height:720});
 await page.locator('#nav-home').click();
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-records').click();
 const base320=await findC('P16-before-parent-320-list-C');
 assert.equal(base320.visibleCount,16);
 assert.equal(base320.filterPresent,false);
 assert.equal(base320.horizontalOverflow,0);
 await snap('01-before-parent-C-320');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 const base390=await findC('P16-before-parent-390-list-C');
 assert.equal(base390.visibleCount,16);
 assert.equal(base390.filterPresent,false);
 await snap('02-before-parent-C-390');
 ev.evidenceBefore={base320,base390};
 pass('P16 baseline 16 genuine A record ID target C requires large scroll at 320/390 and has no state filter');

 // Attempt the prior A free text filter with *actual* review/memo content
 // deliberately absent from question titles/notes: both yield zero cards.
 await page.locator('#search').fill('다음 확인 메모: '+future);
 const oldSearch=await listMeasurement('P16-search-manual-checkHistory',ids.C);
 assert.equal(oldSearch.visibleCount,0);
 await snap('03-before-existing-search-misses-manual-status-390');
 await page.locator('#search').fill('부모 관찰 전');
 const oldPending=await listMeasurement('P16-search-retry-review-status',ids.B);
 assert.equal(oldPending.visibleCount,0);
 await page.locator('#search').fill('');
 ev.evidenceBefore.oldSearch={manualVisibleCount:oldSearch.visibleCount,
  pendingVisibleCount:oldPending.visibleCount};
 assert.deepEqual(await local(page),seeded);
 pass('P16 text search cannot find child retry review state nor checkHistory manual reminder (0 matching cards)');

 // AFTER: original saved A data and images remain at same localhost origin.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#nav-records').click();
 const all=await listMeasurement('P17-default-all',ids.C);
 assert.equal(all.visibleCount,16);
 assert.equal(all.filterValue,'all');
 assert.equal(all.horizontalOverflow,0);
 assert.equal(all.filterVisible,true);
 await snap('04-after-parent-default-all-390');
 pass('P17 defaults to all 16 original A cards, old subject/text/photo filters and sorting untouched');

 // One parent select, no new model labels, no hidden or saved user choices.
 await page.locator('#wrong-p17-state-filter').selectOption('manual');
 const manual390=await listMeasurement('P17-manual-only-390',ids.C);
 assert.deepEqual(manual390.visibleIds,[ids.C]);
 assert.ok(manual390.stageTexts[0].includes(future));
 assert.ok(manual390.stageTexts[0].includes('알림·예약·완료 아님'));
 assert.ok(manual390.resultCount.includes('부모 상태 필터 1건'));
 await page.locator('#records-list > [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 const targetManual390=await listMeasurement('P17-manual-C-after-scroll-390',ids.C);
 await snap('05-after-parent-manual-only-390');
 await page.setViewportSize({width:320,height:720});
 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 const manual320=await listMeasurement('P17-manual-only-320',ids.C);
 assert.deepEqual(manual320.visibleIds,[ids.C]);
 assert.equal(manual320.horizontalOverflow,0);
 await page.locator('#records-list > [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 const targetManual320=await listMeasurement('P17-manual-C-after-scroll-320',ids.C);
 await snap('06-after-parent-manual-only-320');
 assert.ok(base320.scrollY-targetManual320.scrollY>=300,
  '320 manual target must save >300px real scroll');
 assert.ok(base390.scrollY-targetManual390.scrollY>=300,
  '390 manual target must save >300px real scroll');
 ev.evidenceAfter={manual390,targetManual390,manual320,targetManual320,
   scrollSaved320:base320.scrollY-targetManual320.scrollY,
   scrollSaved390:base390.scrollY-targetManual390.scrollY};
 assert.deepEqual(await local(page),seeded);
 pass('manual-date parent filter shows only C original A record and saves scroll at 320 and 390 with DB read-only');

 // Click the real record from filtered view, retaining A photo and saved
 // manual-date not_checked and child explanation/parent observation.
 await page.locator('#records-list > [data-record="'+ids.C+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.C));
 await page.locator('#wrong008-next-review:visible').waitFor();
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 await page.locator('#wrong008-next-review').scrollIntoViewIfNeeded();
 await snap('07-after-C-original-A-manual-detail-320');
 assert.deepEqual(await local(page),seeded);
 pass('manual filtered C card opens original A exact ID/photo/explanation and pending non-alarm note, no automatic writes');

 await page.locator('#nav-records').click();
 await page.locator('#wrong-p17-state-filter').selectOption('pending');
 const pending320=await listMeasurement('P17-pending-only-320',ids.B);
 assert.equal(pending320.visibleCount,2);
 assert.deepEqual([...pending320.visibleIds].sort(),[ids.B,ids.D].sort());
 assert.ok(!pending320.visibleIds.includes(ids.C));
 await snap('08-after-parent-pending-two-320');
 await page.setViewportSize({width:390,height:844});
 const pending390=await listMeasurement('P17-pending-only-390',ids.B);
 assert.deepEqual([...pending390.visibleIds].sort(),[ids.B,ids.D].sort());
 await snap('09-after-parent-pending-two-390');
 ev.evidenceAfter.pending320=pending320;ev.evidenceAfter.pending390=pending390;
 assert.deepEqual(await local(page),seeded);
 pass('pending parent view accurately shows only B/D latest explicit child explanations not_checked, excludes C reviewed');

 // Existing subject and text filters must compose, with no false automatic
 // claim of learning priority nor record reordering.
 await page.locator('#search').fill('가상 국어');
 const broad=await listMeasurement('P17-pending-plus-broad-existing-search',ids.B);
 assert.deepEqual([...broad.visibleIds].sort(),[ids.B,ids.D].sort());
 await page.locator('#wrong007-filter-subject').selectOption('math');
 assert.equal((await listMeasurement('P17-pending-plus-math-subject-empty',ids.B)).visibleCount,0);
 await page.locator('#wrong007-filter-subject').selectOption('korean');
 assert.deepEqual([...(await listMeasurement('P17-pending-plus-korean-subject',ids.B)).visibleIds].sort(),[ids.B,ids.D].sort());
 await page.locator('#v11-filter-status').selectOption('text_ready');
 assert.deepEqual([...(await listMeasurement('P17-pending-plus-text-ready',ids.B)).visibleIds].sort(),[ids.B,ids.D].sort());
 await page.locator('#v11-filter-status').selectOption('all');
 await page.locator('#search').fill(questions.B.slice(0,12));
 const combined=await listMeasurement('P17-pending-plus-existing-question-search',ids.B);
 assert.deepEqual(combined.visibleIds,[ids.B]);
 await page.locator('#search').fill('없는 문장 98765');
 const noMatch=await listMeasurement('P17-pending-plus-no-results',ids.B);
 assert.equal(noMatch.visibleCount,0);
 assert.equal(await page.locator('#wrong-p17-empty').count(),1);
 await page.locator('#search').fill('');
 await page.locator('#wrong-p17-state-filter').selectOption('all');
 const restored=await listMeasurement('P17-all-recovered-390',ids.C);
 assert.equal(restored.visibleCount,16);
 assert.equal(await page.locator('#wrong-p17-empty').count(),0);
 await snap('10-after-existing-search-composes-and-restores-all-390');
 ev.evidenceAfter.combined=combined;ev.evidenceAfter.noMatch=noMatch;
 pass('existing free text combines with new read-only state filter, empty filter is explicit, whole list restores');

 // Child-mode switch while parent filter currently active must not leave
 // child with a secret parent filter; mode is NOT actual authentication.
 await page.locator('#wrong-p17-state-filter').selectOption('manual');
 assert.deepEqual((await listMeasurement('parent-active-manual',ids.C)).visibleIds,[ids.C]);
 await page.locator('#v218-child-mode').click();
 const child=await listMeasurement('P17-child-while-hidden-parent-filter',ids.C);
 assert.equal(child.visibleCount,16);
 assert.equal(child.filterVisible,false);
 const childStageVisible=await page.evaluate(()=>[...document.querySelectorAll('#records-list [data-wrong-p15-stage]')]
  .filter(n=>n.getClientRects().length>0).length);
 assert.equal(childStageVisible,0);
 await page.setViewportSize({width:320,height:720});
 await snap('11-after-child-does-not-inherit-hidden-filter-320');
 await page.locator('#v218-parent-mode').click();
 const parentReturned=await listMeasurement('P17-parent-return-manual',ids.C);
 assert.equal(parentReturned.visibleCount,1);
 await snap('12-after-parent-filter-restored-320');
 ev.evidenceAfter.child=child;ev.evidenceAfter.parentReturned=parentReturned;
 assert.deepEqual(await local(page),seeded);
 pass('child 320 returns to full 16-card list, hides parent stages and hidden filter while parent keeps local view selection');

 await page.reload();
 await page.locator('#nav-records').waitFor();
 await page.locator('#nav-records').click();
 const reload=await listMeasurement('P17-reload-default-all-320',ids.C);
 assert.equal(reload.filterValue,'all');
 assert.equal(reload.visibleCount,16);
 assert.equal(await page.locator('#wrong-p13-go').getAttribute('data-record-id'),ids.D);
 const last=await local(page);
 assert.deepEqual(last,seeded);
 assert.equal(ev.externalHttp,0);
 await snap('13-after-reload-default-all-320');
 ev.evidenceAfter.afterReload=reload;
 ev.evidenceAfter.noWrites=0;ev.evidenceAfter.photoHashesIntact=true;
 ev.evidenceAfter.recordIdIntegrity=true;ev.evidenceAfter.safeToRestore=false;
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P17_FILTER_RESULT='+JSON.stringify({
  status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
  records:16,photos:16,parentManualMatch:1,parentPendingMatch:2,
  scrollSaved320:ev.evidenceAfter.scrollSaved320,
  scrollSaved390:ev.evidenceAfter.scrollSaved390,
  restoredAll:16,childAll:16,externalRequests:0,
  writesOnFilter:0,safeToRestore:false}));
}catch(error){
 ev.result='FAIL';ev.error=String(error);
 ev.stack=String(error?.stack||'').slice(0,3500);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P17_FILTER_RESULT='+JSON.stringify({
  status:'FAIL',checks:ev.validations.length,error:String(error),
  safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
