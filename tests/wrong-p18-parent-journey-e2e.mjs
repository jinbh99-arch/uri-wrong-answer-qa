// WRONG-P18 targeted A guardian integrated journey across sixteen actual synthetic records.
// Reuse P17 seeding helpers, but validate new combined user task, not old P17 filter tests.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P18_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P18_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='74599175a099bd38e742a1ce727bc4e517934938';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after),'P18 minimally relocates first-screen status filter after P1 evidence');
assert.ok(after.includes('WRONG-P18 verified 320x720 P1'));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(before.includes('wrongP15Stage'));
 assert.ok(!before.includes('WRONG-P18: same read-only'));

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

const dir='test-results/wrong-p18';
const ev={task:'WRONG-P18 multi-record A local first-action CTA selection',
  baseP17:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P18_PARENT_JOURNEY '+ev.validations.length+' '+label)}
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



 // P18 INTEGRATED USER TASK, not a repeat of the P17 filter-only test.
 // Track human click path and first-screen discoverability before any P18 patch.
 let userClicks=0;
 const stepClick=async(locator)=>{await locator.click();userClicks++};
 async function screen(name){
  await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});
  ev.screenshots.push(name+'.png');
 }
 async function probe(name){
  const data=await page.evaluate(()=>{
   const select=document.querySelector('#wrong-p17-state-filter');
   const rect=select?.getBoundingClientRect(), mode=document.body.classList.contains('v218-child')?'child':'parent';
   const opts=[...document.querySelectorAll('#records-list > [data-record]')];
   return {mode,viewportWidth:innerWidth,viewportHeight:innerHeight,
    overflow:document.documentElement.scrollWidth-innerWidth,
    scrollY:scrollY,filterValue:select?.value,filterRect:rect&&{
      x:rect.x,y:rect.y,bottom:rect.bottom,height:rect.height,
      width:rect.width},
    filterVisible:!!rect&&rect.width>0&&rect.height>0&&getComputedStyle(select).display!=='none',
    cardsTotal:opts.length,
    visibleIds:opts.filter(el=>el.getClientRects().length>0).map(e=>e.dataset.record),
    safeRoleNote:document.querySelector('.v218-mode-note')?.textContent,
    dateDisclaimer:document.querySelector('#wrong-p17-filter-wrap .small')?.textContent};
  });
  ev.measurements.push({stage:name,clicks:userClicks,...data});
  assert.ok(data.overflow<=1,name+' must have no horizontal overflow');
  return data;
 }
 await page.locator('#toast.hide').waitFor({timeout:6000});
 const first={};
 for(const [width,height] of [[390,844],[320,720]]){
  await page.setViewportSize({width,height});
  await stepClick(page.locator('#nav-home'));
  await stepClick(page.locator('#nav-records'));
  const e=await probe('first parent '+width);
  assert.equal(e.mode,'parent');
  assert.equal(e.filterValue,'all');
  assert.equal(e.visibleIds.length,16);
  assert.ok(e.filterVisible);
  first[width]=e;
  await screen('01-first-parent-'+width);
 }
 assert.ok(first[320].filterRect.bottom>720,'first existing 320 CTA must be below fold: actual P1');
 // Same browser origin/IndexedDB but changed isolated candidate A product.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#nav-home').waitFor();
 const afterFirst={};
 for(const [width,height] of [[390,844],[320,720]]){
  await page.setViewportSize({width,height});
  await stepClick(page.locator('#nav-home'));
  await stepClick(page.locator('#nav-records'));
  const e=await probe('after P18 first parent '+width);
  assert.equal(e.filterValue,'all');
  assert.equal(e.visibleIds.length,16);
  assert.ok(e.filterRect.y>=0&&e.filterRect.bottom<=height,
   'P18 parent select must be inside first viewport on '+width+' '+JSON.stringify(e.filterRect));
  afterFirst[width]=e;
  await screen('01a-after-first-parent-'+width);
 }
 ev.integrated={first,afterFirst,P17BaselineSourceUnmodified:true,
  P18OnlySelectorRelocated:true,baselineFirstViewportP1:true};
 assert.deepEqual(await local(page),seeded);
 pass('P17 first 320 filter below fold; P18 original same control moved fully into 320/390 first viewport with 16 records preserved');

 // Actual parent task: home > list > pending filter > D (exact original A ID)
 // and read child's explanation. Before deliberate observation no A writes.
 await page.setViewportSize({width:320,height:720});
 await stepClick(page.locator('#nav-home'));
 await stepClick(page.locator('#nav-records'));
 await page.locator('#wrong-p17-state-filter').selectOption('pending');userClicks++;
 const pending=await probe('320-pending-2');
 assert.deepEqual([...pending.visibleIds].sort(),[ids.B,ids.D].sort());
 assert.ok(pending.dateDisclaimer.includes('날짜 메모는 알림·예약·완료가 아니며'));
 await screen('02-pending-two-320');
 const beforeOpening=await local(page);
 assert.deepEqual(beforeOpening,seeded);
 await stepClick(page.locator('#records-list > [data-record="'+ids.D+'"]'));
 await page.locator('#wrong-p0-child-reason-readonly:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 assert.equal(await page.locator('#v230-review').inputValue(),'not_checked');
 assert.deepEqual(await local(page),seeded,'navigation + explanation must not auto-observe');
 await page.locator('#wrong-p0-child-reason-readonly').scrollIntoViewIfNeeded();
 await screen('03-read-D-child-explanation-320');
 ev.integrated.firstPendingSelectedId=ids.D;
 ev.integrated.clicksToReadChildExplanation=userClicks;
 pass('home→parent pending filter→D ID/photo/child explanation readable; automatic observation & photo writes zero');

 // Original A manual guardian observation buttons, not any QA bridge.
 await page.locator('#v230-review').selectOption('explained');userClicks++;
 await stepClick(page.locator('#v230-review-save'));
 await waitReview(page,ids.D,'explained');
 const afterExplicitRetryReview=await local(page);
 assert.equal(afterExplicitRetryReview.rows.find(r=>r.id===ids.D).generalRetryHistory.at(-1).review,'explained');
 assert.equal(afterExplicitRetryReview.rows.find(r=>r.id===ids.B).generalRetryHistory.at(-1).review,'not_checked');
 assert.equal(afterExplicitRetryReview.rows.find(r=>r.id===ids.C).checkHistory.at(-1).status,'not_checked');
 // Existing parent checkHistory explicitly saved separately.
 await page.locator('#check-status').selectOption('explained');userClicks++;
 await page.locator('#check-memo').fill('D 학부모 통합동선 관찰: 실제 아이 설명을 들었음');
 await stepClick(page.locator('#check-save'));
 await page.waitForFunction(note=>document.querySelector('#check-history')?.textContent?.includes(note),'D 학부모 통합동선 관찰: 실제 아이 설명을 들었음');
 const afterManualD=await local(page);
 immutable(fresh,afterManualD);
 assert.equal(afterManualD.rows.find(r=>r.id===ids.D).checkHistory.length,1);
 assert.equal(afterManualD.rows.find(r=>r.id===ids.D).generalRetryHistory.at(-1).review,'explained');
 assert.equal(afterManualD.rows.find(r=>r.id===ids.B).generalRetryHistory.at(-1).review,'not_checked');
 await screen('04-explicit-D-parent-observed-320');
 state(afterManualD,'D-parent-review-and-observation-explicit-only');
 pass('original parent select/save buttons alone changed D review+checkHistory exactly; C manual pending and B unaffected');

 // Same filter remains chosen while returning; D must disappear and only B
 // is still pending. No phantom parent observational completion.
 await stepClick(page.locator('#nav-records'));
 const pendingAfter=await probe('after-D-observed-pending-B-only');
 assert.deepEqual(pendingAfter.visibleIds,[ids.B]);
 assert.equal(pendingAfter.filterValue,'pending');
 assert.deepEqual(await local(page),afterManualD);
 await screen('05-pending-filter-excludes-D-now-320');
 pass('pending filter after explicitly reviewing D updates only B, no wrong record and no hidden DB writes');

 // Parent then intentionally selects the MANUAL status rather than pretending
 // automatic calendar/push/verified recheck. C stays not_checked.
 await page.locator('#wrong-p17-state-filter').selectOption('manual');userClicks++;
 const manual=await probe('manual C only');
 assert.deepEqual(manual.visibleIds,[ids.C]);
 await screen('06-manual-filter-C-only-320');
 await stepClick(page.locator('#records-list > [data-record="'+ids.C+'"]'));
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 await page.locator('#wrong008-next-review:visible').waitFor();
 const note=await page.locator('#wrong008-last-manual-note').innerText();
 assert.ok(note.includes(future));
 assert.ok(note.includes('아직 확인 전'));
 assert.ok((await page.locator('#wrong008-next-review').innerText()).includes('자동 알림·일정 예약·완료 판정은 없습니다'));
 const currentC=(await local(page)).rows.find(r=>r.id===ids.C);
 assert.equal(currentC.checkHistory.at(-1).status,'not_checked');
 assert.ok(currentC.checkHistory.at(-1).memo.includes('자동 알림 없음'));
 await page.locator('#wrong008-last-manual-note').scrollIntoViewIfNeeded();
 await screen('07-C-original-manual-not-automatic-320');
 assert.deepEqual(await local(page),afterManualD);
 ev.integrated.manualDateRead=future;
 ev.integrated.clicksToManualDate=userClicks;
 pass('C original date note read by parent via manual filter, stays not_checked; NO alarm/auto-complete or changes');

 // Cross-width reference: 390 parent direct status filter and C detail must
 // work using the same local records without errors or losing saved notes.
 await page.setViewportSize({width:390,height:844});
 await stepClick(page.locator('#nav-records'));
 const manual390=await probe('parent-manual-C-390');
 assert.deepEqual(manual390.visibleIds,[ids.C]);
 await screen('08-parent-manual-C-390');
 await stepClick(page.locator('#records-list > [data-record="'+ids.C+'"]'));
 await page.locator('#wrong008-last-manual-note').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 assert.deepEqual(await local(page),afterManualD);
 pass('parent 390 repeats same C ID/manual state without extra writes or photo corruption');

 // Role toggle: child must see all records, never inherit hidden parent
 // 'manual only' list. Mode ≠ authentication / data isolation.
 await stepClick(page.locator('#v218-child-mode'));
 await stepClick(page.locator('#nav-records'));
 const child390=await probe('child390-after-manual-parent-filter');
 assert.equal(child390.visibleIds.length,16);
 assert.equal(child390.filterVisible,false);
 assert.ok(child390.safeRoleNote.includes('계정·비밀번호 보호가 아닙니다'));
 assert.equal(await page.locator('#records-list [data-wrong-p15-stage]:visible').count(),0);
 await screen('09-child390-full-list-parent-stages-hidden');
 await page.setViewportSize({width:320,height:720});
 const child320=await probe('child320-after-manual-parent-filter');
 assert.equal(child320.visibleIds.length,16);
 assert.equal(child320.filterVisible,false);
 await screen('10-child320-full-list-parent-stages-hidden');
 assert.deepEqual(await local(page),afterManualD);
 pass('child at 320/390 shows all A 16 original records, hides parent filter/stages, no silent filtering');

 await page.reload();
 await page.locator('#nav-records').click();
 const reloaded=await probe('after-refresh-parent-default');
 assert.equal(reloaded.filterValue,'all');
 assert.equal(reloaded.visibleIds.length,16);
 assert.deepEqual(await local(page),afterManualD);
 assert.equal(ev.externalHttp,0);
 await screen('11-reload-full-list-and-stored-observation-320');
 ev.integrated.clicksTotalUserActions=userClicks;
 ev.integrated.afterExplicitD=afterManualD.rows.find(r=>r.id===ids.D);
 ev.integrated.CPendingDateStillNotChecked=true;
 ev.integrated.photosUnchanged=afterManualD.photos;
 ev.integrated.childAllUnfiltered=true;
 ev.integrated.actualGuardianAuthentication=false;
 ev.integrated.actualReminder=false;
 ev.integrated.noAutoWrites=true;
 ev.integrated.physicalPhoneTested=false;
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P18_PARENT_JOURNEY_RESULT='+JSON.stringify({
  status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
  records:16,photos:16,parentFoundD:true,parentObservedExplicitly:true,
  manualCStillNotChecked:true,childUnfiltered:true,
  autoWrites:0,externalHTTP:0,productEdits:1,safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);
 ev.stack=String(e?.stack||'').slice(0,2500);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P18_PARENT_JOURNEY_RESULT='+JSON.stringify({
  status:'FAIL',checks:ev.validations.length,error:String(e),
  safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
