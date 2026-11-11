// WRONG-INTEGRATION targeted A guardian integrated journey across sixteen actual synthetic records.
// Reuse P17 seeding helpers, but validate new combined user task, not old P17 filter tests.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_INTEGRATION_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('WRONG_INTEGRATION_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='2f4e47260c385620c95672034fcb7f49702d5dd4';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.equal(gitBlob(before),gitBlob(after),'use EXACT P19 product HTML with zero edits');
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

const dir='test-results/wrong-integration-p19';
const ev={task:'WRONG-INTEGRATION multi-record A local first-action CTA selection',
  p19ProductSha:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_INTEGRATED_P19 '+ev.validations.length+' '+label)}
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




 // ONE NEW INTEGRATED SESSION ON EXACT ORIGINAL P19 product HTML.
 // P11-P19 individual tests are not being rerun; only the missing junction
 // of finding the SAME observed D through "all" after D leaves pending.
 const clickCount={nav:0,filter:0,record:0,manualSave:0};
 const shot=async(name)=>{await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});ev.screenshots.push(name+'.png')};
 const visibleIds=async()=>page.evaluate(()=>
  [...document.querySelectorAll('#records-list > [data-record]')]
   .filter(n=>n.getClientRects().length>0).map(n=>n.dataset.record));
 const measure=async(stage)=>{const r=await page.evaluate(()=>{
  const measured=(query)=>{const e=document.querySelector(query),p=e?.getBoundingClientRect();return {
    exists:!!e,text:e?.textContent?.trim().slice(0,80)||'',focused:e===document.activeElement,
    rect:p?{y:p.y,bottom:p.bottom,x:p.x,right:p.right,width:p.width,height:p.height}:null,
    visible:!!p&&p.height>0&&p.width>0&&getComputedStyle(e).display!=='none'
  }};
  return {url:location.href,width:innerWidth,height:innerHeight,zoom:document.body.style.zoom||'',
   scrollY:scrollY,overflow:document.documentElement.scrollWidth-innerWidth,
   focused:{id:document.activeElement?.id,tag:document.activeElement?.tagName,
     label:document.activeElement?.getAttribute('aria-label')||'',
     text:document.activeElement?.textContent?.trim().slice(0,48)||''},
   nodes:{filter:measured('#wrong-p17-state-filter'),label:measured('#wrong-p17-filter-wrap label'),
     navRecords:measured('#nav-records'),newRecord:measured('#page-records > .row [data-route="add"]'),
     parentMode:measured('#v218-parent-mode'),childMode:measured('#v218-child-mode')},
   manualAlarmWarning:document.querySelector('#wrong-p17-filter-wrap .small')?.textContent?.trim()};
 });ev.measurements.push({stage,...r});return r};
 await page.setViewportSize({width:320,height:720});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-home').click();clickCount.nav++;
 await page.locator('#nav-records').click();clickCount.nav++;
 assert.equal((await visibleIds()).length,16);
 assert.equal(await page.locator('#wrong-p17-state-filter').inputValue(),'all');
 const first=await measure('320 parent first list');
 await shot('01-parent-320-list-first');
 assert.equal(first.overflow,0);
 assert.deepEqual(await local(page),seeded);
 pass('original P19 320 parent entry: 16 A IDs and original local photos, no auto write');

 await page.locator('#wrong-p17-state-filter').selectOption('pending');clickCount.filter++;
 assert.deepEqual([...(await visibleIds())].sort(),[ids.B,ids.D].sort());
 await shot('02-parent-320-B-D-pending');
 await page.locator('#records-list > [data-record="'+ids.D+'"]').click();clickCount.record++;
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 const beforeObservation=await local(page);
 assert.deepEqual(beforeObservation,seeded);
 assert.equal(beforeObservation.rows.find(r=>r.id===ids.D).generalRetryHistory.at(-1).review,'not_checked');
 await page.locator('#wrong-p0-child-reason-readonly').scrollIntoViewIfNeeded();
 await shot('03-original-D-photo-explanation-before-observation');
 pass('correct D ID/photo and saved child explanation opened from pending; before parent save no DB changes');

 // Explicit observation is the ONLY intentional mutation.
 await page.locator('#v230-review').selectOption('explained');clickCount.manualSave++;
 await page.locator('#v230-review-save').click();clickCount.manualSave++;
 await waitReview(page,ids.D,'explained');
 await page.locator('#check-status').selectOption('explained');clickCount.manualSave++;
 await page.locator('#check-memo').fill('가상 보호자 D 오답: 아이 설명 직접 관찰 후 저장');
 await page.locator('#check-save').click();clickCount.manualSave++;
 await page.waitForFunction(x=>document.querySelector('#check-history')?.textContent?.includes(x),'가상 보호자 D 오답: 아이 설명 직접 관찰 후 저장');
 const afterExplicit=await local(page);
 immutable(fresh,afterExplicit);
 const finalD=afterExplicit.rows.find(r=>r.id===ids.D);
 assert.equal(finalD.generalRetryHistory.length,1);
 assert.equal(finalD.generalRetryHistory[0].review,'explained');
 assert.ok(finalD.generalRetryHistory[0].reviewedAt);
 assert.equal(finalD.checkHistory.length,1);
 assert.equal(afterExplicit.rows.find(r=>r.id===ids.B).generalRetryHistory.at(-1).review,'not_checked');
 assert.deepEqual(afterExplicit.rows.find(r=>r.id===ids.C),seeded.rows.find(r=>r.id===ids.C));
 for(const rec of seeded.rows.filter(r=>r.id!==ids.D))
  assert.deepEqual(afterExplicit.rows.find(r=>r.id===rec.id),rec,'only explicit observed D record may change');
 state(afterExplicit,'same-session-D-explicit-parent-reviewed-only');
 await shot('04-D-explicitly-observed-saved');
 pass('only D A record review and checkHistory changed by ORIGINAL explicit parent save; photos and other 15 records immutable');

 // The missing junction: observed D disappeared from pending. Parent must
 // discover SAME ID through "all", then re-open it to inspect original photo,
 // historical check and completed review, NOT confuse missing row with loss.
 await page.locator('#nav-records').click();clickCount.nav++;
 const onlyB=await visibleIds();
 assert.deepEqual(onlyB,[ids.B]);
 assert.ok(!onlyB.includes(ids.D));
 await shot('05-parent-pending-D-correctly-excluded');
 await page.locator('#wrong-p17-state-filter').selectOption('all');clickCount.filter++;
 assert.equal((await visibleIds()).length,16);
 const focusD=page.locator('#records-list > [data-record="'+ids.D+'"]');
 assert.equal(await focusD.count(),1);
 await focusD.scrollIntoViewIfNeeded();
 await shot('06-all-sixteen-rediscover-original-D-ID');
 await focusD.click();clickCount.record++;
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.D);
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
 assert.equal(await page.locator('#v230-review').inputValue(),'explained');
 assert.ok((await page.locator('#check-history').innerText()).includes('가상 보호자 D 오답'));
 const rediscovered=await local(page);
 assert.deepEqual(rediscovered,afterExplicit,'rediscovery read only, no double observation or photo edit');
 await page.locator('#check-history').scrollIntoViewIfNeeded();
 await shot('07-SAME-D-photo-explanation-review-reopened');
 pass('critical P19 one-session link: observed D vanished from pending but exact SAME D ID/photo/review/check reopens under all; wrong ID0, auto write0');

 // C intentionally scheduled only as a human memo, never a notification.
 await page.locator('#nav-records').click();clickCount.nav++;
 await page.locator('#wrong-p17-state-filter').selectOption('manual');clickCount.filter++;
 assert.deepEqual(await visibleIds(),[ids.C]);
 await page.locator('#records-list > [data-record="'+ids.C+'"]').click();clickCount.record++;
 await page.locator('#detail-image img').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 await page.locator('#wrong008-next-review:visible').waitFor();
 const cMemo=await page.locator('#wrong008-last-manual-note').innerText();
 assert.ok(cMemo.includes(future));
 assert.ok((await page.locator('#wrong008-next-review').innerText()).includes('자동 알림·일정 예약·완료 판정은 없습니다'));
 assert.equal((await local(page)).rows.find(r=>r.id===ids.C).checkHistory.at(-1).status,'not_checked');
 assert.deepEqual(await local(page),afterExplicit);
 await page.locator('#wrong008-last-manual-note').scrollIntoViewIfNeeded();
 await shot('08-C-date-not-checked-not-auto-scheduled');
 pass('same session exact C ID/photo, manual date still not_checked, non-alert/non-completion text and no write');

 // 390 viewport and zoom200 sample: if app auto-scrolls the selected page,
 // it must not silently save or hide all child records. Capture focus and
 // browser navigation behavior as ACCESSIBILITY EVIDENCE, not full WCAG or OS.
 await page.setViewportSize({width:390,height:844});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-records').click();clickCount.nav++;
 assert.deepEqual(await visibleIds(),[ids.C]);
 await shot('09-390-parent-manual-state');
 await page.evaluate(()=>document.body.style.zoom='2');
 await page.locator('#nav-home').click();clickCount.nav++;
 await page.locator('#nav-records').click();clickCount.nav++;
 await page.waitForTimeout(120); // P19 already uses one requestAnimationFrame
 const afterZoom=await measure('390 zoom2 after nav-records click focus and safe-area');
 assert.equal(afterZoom.overflow,0);
 assert.ok(afterZoom.nodes.filter.rect.y>=0&&afterZoom.nodes.filter.rect.bottom<=844);
 await shot('10-parent-390-zoom200-focus-after-menu');
 await page.keyboard.press('Tab');
 const nextTab=await measure('390 zoom2 after one keyboard TAB');
 await shot('11-parent-390-zoom200-after-keyboard-TAB');
 ev.accessibility={afterZoom,nextTab,actualAssistiveTechTested:false,
  actualOSZoomTested:false};
 assert.deepEqual(await local(page),afterExplicit);
 pass('390 CSS200 P19 original menu autofocus/keyboard TAB and safe horizontal geometry captured without automatic write');

 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-records').click();clickCount.nav++;
 assert.equal((await visibleIds()).length,16);
 const childLabels=await page.locator('#records-list [data-wrong-p15-stage]:visible').count();
 assert.equal(childLabels,0);
 const childMode=await measure('390 zoom2 child list original 16 record IDs');
 assert.ok(!childMode.nodes.filter.visible);
 await shot('12-child-390-all16-no-guardian-label');
 await page.setViewportSize({width:320,height:720});
 assert.equal((await visibleIds()).length,16);
 await shot('13-child-320-all16');
 assert.deepEqual(await local(page),afterExplicit);
 pass('child role mode after observed parent D and memo C sees all 16 IDs; parent-only stages hidden, not real authentication');

 await page.reload();
 await page.locator('#nav-records').click();clickCount.nav++;
 const afterReload=await local(page);
 assert.deepEqual(afterReload,afterExplicit);
 assert.equal(await page.locator('#wrong-p17-state-filter').inputValue(),'all');
 const restoredD=afterReload.rows.find(r=>r.id===ids.D);
 assert.equal(restoredD.generalRetryHistory.at(-1).review,'explained');
 assert.equal(restoredD.checkHistory.length,1);
 assert.equal(ev.externalHttp,0);
 await shot('14-reload-exact-D-preserved-320');
 pass('reload retains D explicit observation, 16 A IDs/photos and C pending date; parent status filter resets to all, external HTTP0');

 // Browser back from the SINGLE original P19 page is not internal SPA back:
 // record actual route (may leave same-origin UI) as documented limitation,
 // and re-enter exact same P19 HTML to assert no record/photo loss.
 const backBefore=await page.evaluate(()=>({url:location.href,historyLength:history.length}));
 const backResponse=await page.goBack({waitUntil:'domcontentloaded',timeout:10000}).catch(e=>({error:String(e)}));
 const backAfter=await page.evaluate(()=>({url:location.href,historyLength:history.length}));
 const returned=await page.goto(origin+'/base');
 assert.equal(returned.status(),200);
 await page.locator('#nav-records').click();
 assert.deepEqual(await local(page),afterExplicit);
 ev.backBehavior={before:backBefore,after:backAfter,goBackHTTP:backResponse?.status?.()||null,
  note:'SPA A client navigation does not necessarily create browser history entries; original P19 re-entry and local A storage independently checked'};
 pass('real browser Back and same-P19-URL re-entry recorded; all A data preserved; no assertion of in-app history semantics');

 ev.integration={
  exactProductSha:base,productCodeChanged:false,records:16,photos:16,
  targetD:ids.D,targetC:ids.C,manualDate:future,
  manualObservedD:true,DReopenedSameIdAndPhoto:true,
  DHistorySameAfterReopen:true,manualCNotChecked:true,
  childAllIds:true,photoHashesUnchanged:true,autoWritesOnRead:0,
  explicitWritesOnlyD:true,clickCount,realFamilyTested:false,
  safeToRestore:false,dbRestorePerformed:false,authImplemented:false};
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_INTEGRATED_P19_RESULT='+JSON.stringify({
  status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
  sameProductSha:base,records:16,photos:16,observedD:true,
  reopenedSameD:true,manualCNotChecked:true,childFull16:true,
  autoWrites:0,externalHTTP:0,codeChanges:0,safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);ev.stack=String(e?.stack||'').slice(0,4000);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_INTEGRATED_P19_RESULT='+JSON.stringify({
  status:'FAIL',checks:ev.validations.length,error:String(e),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
