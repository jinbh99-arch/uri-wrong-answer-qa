// WRONG-P16 targeted E2E: four real original A local records, not P13/P11 reruns.
// Compare P13 first-record/observed fallback against P14 timestamp-state CTA.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P16_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P16_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='78500b590247cddb7fed95827f5069350141942e';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(before.includes('wrongP15Stage'));
 assert.ok(!before.includes('WRONG-P16: same read-only'));

assert.ok(after.includes('새 관찰할 설명 없음'));
assert.ok(after.includes('wrongP15Stage'));
 assert.ok(after.includes('WRONG-P16: same read-only'));

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

const dir='test-results/wrong-p16';
const ev={task:'WRONG-P16 multi-record A local first-action CTA selection',
  baseP15:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P16_COMPACT '+ev.validations.length+' '+label)}
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

 // Measure BEFORE on exactly same IDs, photos, histories, existing sort/filters.
 const measurements=[];
 async function inspectList(name,width,height){
  await page.setViewportSize({width,height});
  await page.locator('#nav-home').click();
  await page.locator('#v218-parent-mode').click();
  await page.locator('#nav-records').click();
  const probe=await page.evaluate(id=>{
   const card=document.querySelector('#records-list [data-record="'+id+'"]');
   const list=document.querySelector('#records-list');
   const root=list?.getBoundingClientRect(),c=card?.getBoundingClientRect();
   const stage=card?.querySelector('[data-wrong-p15-stage]');
   const r=stage?.getBoundingClientRect();
   const all=[...document.querySelectorAll('#records-list .item')];
   return {viewport:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
    rows:all.length,cardTotalHeight:all.reduce((n,e)=>n+e.getBoundingClientRect().height,0),
    firstTitle:all[0]?.querySelector('strong')?.textContent,
    selectedId:card?.dataset.record,selectionExists:!!card,
    documentCardY:c?c.y+scrollY:null,listY:root?root.y+scrollY:null,
    targetCardHeight:c?.height,targetStageHeight:r?.height,
    targetStageText:stage?.textContent||'',targetCardTitle:card?.querySelector('strong')?.textContent,
    statusFontSize:stage?getComputedStyle(stage).fontSize:null};
  },ids.C);
  assert.equal(probe.rows,16);
  assert.equal(probe.selectedId,ids.C);
  assert.ok(probe.overflow<=1);
  assert.ok(probe.targetStageText.includes(future));
  assert.ok(probe.targetStageText.includes('알림'));
  await page.locator('#records-list [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
  const scroll=await page.evaluate(()=>scrollY);
  const element=page.locator('#records-list [data-record="'+ids.C+'"]');
  const bounds=await element.boundingBox();
  assert.ok(bounds?.y>=0&&bounds.y+bounds.height<=height+1);
  measurements.push({stage:name,...probe,scrollToOldC:scroll,targetViewportBox:bounds});
  return measurements.at(-1);
 }
 async function screenshot(name){await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});ev.screenshots.push(name+'.png')}
 const old390=await inspectList('before-parent-390',390,844);
 await screenshot('01-before-parent-C-390');
 const old320=await inspectList('before-parent-320',320,720);
 await screenshot('02-before-parent-C-320');
 ev.evidenceBefore={old390,old320,target:ids.C,
  clickHomeToTarget:2,dateAtList:true,sourceHash:gitBlob(before)};
 assert.deepEqual(await local(page),seeded);
 pass('P15 old 16-card actual 390/320 height and scroll to old C measured; same ID/date visible, no DB writes');

 // The already safe P14 CTA is unrelated; P16 only touches the parent-list
 // read-only label. Keep state equal after replacing isolated candidate HTML.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#nav-home').waitFor();
 const new390=await inspectList('after-parent-390',390,844);
 await screenshot('03-after-parent-C-390');
 const new320=await inspectList('after-parent-320',320,720);
 await screenshot('04-after-parent-C-320');
 ev.evidenceAfter={new390,new320,deltaScroll390:old390.scrollToOldC-new390.scrollToOldC,
  deltaScroll320:old320.scrollToOldC-new320.scrollToOldC,
  deltaRowsHeight320:old320.cardTotalHeight-new320.cardTotalHeight,
  deltaRowsHeight390:old390.cardTotalHeight-new390.cardTotalHeight,
  oldDateFoundAtList:true,newDateFoundAtList:true};
 assert.ok(new320.cardTotalHeight<old320.cardTotalHeight,
  'compressing row labels must actually reduce total cards height on 320');
 assert.ok(new390.cardTotalHeight<old390.cardTotalHeight,
  'must reduce total cards height on 390');
 assert.ok(new320.documentCardY<old320.documentCardY-50,
  'target C must move up by measurable 50px at 320');
 assert.ok(new320.scrollToOldC<old320.scrollToOldC-50,
  '320 target C must require at least 50px less scroll');
 assert.ok(new390.scrollToOldC<old390.scrollToOldC-50,
  '390 target C must require at least 50px less scroll');
 assert.equal(new320.statusFontSize,'13px','do not shrink readable 13px');
 assert.ok(new320.targetStageText.includes('알림·예약·완료 아님'));
 assert.ok(new320.targetStageText.includes(future));
 assert.ok(new390.targetStageText.includes('부모 관찰 기록 있음'));
 assert.deepEqual(await local(page),seeded);
 pass('P16 same 16 IDs reduces 320+390 real scrolling and card height while retaining 13px text/manual-not-reminder');

 // No wrong record; target C must open original A detail/photo/explanation,
 // manual memo remains not_checked and no observation before explicit save.
 await page.locator('#records-list [data-record="'+ids.C+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 await page.locator('#detail-image img').waitFor();
 assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.C));
 await page.locator('#wrong008-next-review:visible').waitFor();
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 assert.ok((await page.locator('#wrong008-next-review').innerText()).includes('자동 알림·일정 예약·완료 판정은 없습니다'));
 await page.locator('#wrong008-next-review').scrollIntoViewIfNeeded();
 await screenshot('05-after-C-original-A-detail-320');
 assert.deepEqual(await local(page),seeded);
 pass('C target opens exact original A ID/photo/retry/observed/manual-pending date; 2-click path, wrong-record 0, auto-write 0');

 // Parent stage labels remain hidden in child mode (cosmetic separation only;
 // as P12 established not family authorization).
 await page.locator('#v218-child-mode').click();
 await page.locator('#nav-records').click();
 const childLabels=await page.evaluate(()=>{
  const labels=[...document.querySelectorAll('#records-list [data-wrong-p15-stage]')];
  return {count:labels.length,visible:labels.filter(el=>el.getClientRects().length).length,
    horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.deepEqual(childLabels,{count:16,visible:0,horizontalOverflow:0});
 await screenshot('06-after-child-list-320');
 assert.deepEqual(await local(page),seeded);
 pass('child 320 shows original A list but hides parent-only stages; unchanged old A data');

 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-home').click();
 const parentCta=await page.locator('#wrong-p13-go').getAttribute('data-record-id');
 assert.equal(parentCta,ids.D,'P14 pending CTA still points to D');
 await page.reload();
 await page.locator('#nav-records').waitFor();
 await page.locator('#nav-records').click();
 const reloaded=await page.locator('#records-list [data-record="'+ids.C+'"] [data-wrong-p15-stage]').textContent();
 assert.ok(reloaded.includes(future));
 const afterReload=await local(page);
 assert.deepEqual(afterReload,seeded);
 assert.equal(ev.externalHttp,0);
 await page.locator('#records-list [data-record="'+ids.C+'"]').scrollIntoViewIfNeeded();
 await screenshot('07-after-reload-C-stage-320');
 pass('reload preserves 16 original A ID/photo SHA and no new write; P14 parent CTA D unchanged; external requests 0');

 ev.evidenceAfter.targetOpenedCorrectly=true;
 ev.evidenceAfter.totalRecords=16;
 ev.evidenceAfter.photoHashesPreserved=seeded.photos;
 ev.evidenceAfter.parentClickBeforeExplicitWriteZero=true;
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P16_COMPACT_RESULT='+JSON.stringify({
   status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
   records:16,photoCount:seeded.photos.length,
   scrollSaved320:ev.evidenceAfter.deltaScroll320,
   scrollSaved390:ev.evidenceAfter.deltaScroll390,
   heightSaved320:ev.evidenceAfter.deltaRowsHeight320,
   writesOnNavigation:0,safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);
 ev.stack=String(e?.stack||'').slice(0,2700);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P16_COMPACT_RESULT='+JSON.stringify({
   status:'FAIL',checks:ev.validations.length,error:String(e),
   safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
