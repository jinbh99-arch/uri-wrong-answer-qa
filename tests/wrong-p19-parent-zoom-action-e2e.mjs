// WRONG-P19 targeted A guardian integrated journey across sixteen actual synthetic records.
// Reuse P17 seeding helpers, but validate new combined user task, not old P17 filter tests.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_P19_LOCAL_SYNTHETIC_ONLY!=='1')
 throw Error('P19_LOCAL_SYNTHETIC_ONLY_GATE_REQUIRED');
const base='a75a74064d9b0d1e42d9e05bd74171ee0b17c029';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.notEqual(gitBlob(before),gitBlob(after),'candidate P19 must be an isolated P18 UI-only change');
assert.ok(after.includes('WRONG-P19 QA only'));
assert.ok(after.includes('WRONG-P18 verified 320x720 P1'));
assert.ok(before.includes('wrong-p13-first-action'));
assert.ok(before.includes('wrongP15Stage'));
 assert.ok(!before.includes('WRONG-P19: same read-only'));

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

const dir='test-results/wrong-p19';
const ev={task:'WRONG-P19 multi-record A local first-action CTA selection',
  baseP18:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_P19_ZOOM_DISCOVERY '+ev.validations.length+' '+label)}
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




 // NEW P19: two different parent tasks from the original P18 candidate.
 // No additional records or retry checks beyond state setup above.
 async function capture(name){
  await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});
  ev.screenshots.push(name+'.png');
 }
 async function probe(stage){
  const m=await page.evaluate(()=>{
   const obj=(selector)=>{
    const n=document.querySelector(selector),r=n?.getBoundingClientRect();
    const st=n?getComputedStyle(n):null;
    return {exists:!!n,visible:!!n&&!!r&&r.width>0&&r.height>0&&st?.display!=='none'&&st?.visibility!=='hidden',
     text:n?.textContent?.trim()?.slice(0,115),id:n?.id,
     rect:r?{x:+r.x.toFixed(1),y:+r.y.toFixed(1),
       bottom:+r.bottom.toFixed(1),right:+r.right.toFixed(1),
       height:+r.height.toFixed(1),width:+r.width.toFixed(1)}:null};
   };
   const nodes={
    navAdd:obj('#nav-add'),
    navRecords:obj('#nav-records'),
    inListAdd:obj('#page-records > .row.spread [data-route="add"]'),
    parentFilter:obj('#wrong-p17-state-filter'),
    parentFilterLabel:obj('#wrong-p17-filter-wrap label'),
    parentFilterHint:obj('#wrong-p17-filter-wrap .small'),
    listHeader:obj('#page-records .sectiontitle'),
    storageBanner:obj('#storage-banner'),
    parentMode:obj('#v218-parent-mode'),childMode:obj('#v218-child-mode')
   };
   for(const x of Object.values(nodes)){
    x.fullyInViewport=!!x.visible&&x.rect.y>=0&&x.rect.bottom<=innerHeight&&x.rect.x>=0&&x.rect.right<=innerWidth;
    x.intersectsViewport=!!x.visible&&x.rect.bottom>0&&x.rect.y<innerHeight;
   }
   return {viewportWidth:innerWidth,viewportHeight:innerHeight,zoom:document.body.style.zoom||'1',
    documentScrollY:scrollY,docWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth-innerWidth,
    height:document.documentElement.scrollHeight,
    route:document.querySelector('#page-records')?.classList.contains('hide')?'not-records':'records',
    parentFilterSelected:document.querySelector('#wrong-p17-state-filter')?.value,
    cardsVisible:[...document.querySelectorAll('#records-list > [data-record]')].filter(x=>x.getClientRects().length).map(x=>x.dataset.record),
    nodes};
  });
  ev.measurements.push({stage,...m});return m;
 }
 const baseline={};
 for(const [width,height] of [[320,720],[390,844]]){
  for(const zoom of [1,2]){
   await page.setViewportSize({width,height});
   await page.evaluate(z=>document.body.style.zoom=String(z),zoom);
   await page.locator('#v218-parent-mode').click();
   await page.locator('#nav-home').click();
   await page.locator('#nav-records').click();
   await page.locator('#records-list > [data-record="'+ids.C+'"]').waitFor();
   const m=await probe('P18 baseline parent '+width+' zoom '+zoom);
   const key=width+'z'+zoom;baseline[key]=m;
   assert.equal(m.cardsVisible.length,16);
   assert.equal(m.parentFilterSelected,'all');
   assert.equal(m.nodes.inListAdd.exists,true);
   assert.equal(m.nodes.parentFilter.visible,true);
   await capture('before-'+width+'-zoom-'+zoom+'-initial-list');
  }
 }
 ev.baseline=baseline;
 pass('P18 16 genuine A IDs first viewport: parent list add CTA and state filter geometry measured 320/390 zoom 1/2');
 // AFTER P19: same 16 original A records and photo bytes, candidate HTML
 // must expose both old guardian actions without physical scroll in CSS200.
 assert.equal((await page.goto(origin+'/candidate')).status(),200);
 await page.locator('#nav-home').waitFor();
 const candidate={};
 for(const [width,height] of [[320,720],[390,844]]){
  for(const zoom of [1,2]){
   await page.setViewportSize({width,height});
   await page.evaluate(z=>document.body.style.zoom=String(z),zoom);
   await page.locator('#v218-parent-mode').click();
   await page.locator('#nav-home').click();
   await page.locator('#nav-records').click();
   await page.waitForTimeout(120); // wait for one route RAF, not a save.
   const m=await probe('P19 after parent '+width+' zoom '+zoom);
   const key=width+'z'+zoom;candidate[key]=m;
   assert.equal(m.cardsVisible.length,16);
   assert.equal(m.parentFilterSelected,'all');
   assert.equal(m.overflow,0,'zoom must not introduce horizontal overflow');
   if(zoom===2){
    assert.ok(m.nodes.parentFilter.fullyInViewport,
      'P19 state select visible at 200% '+key+': '+JSON.stringify(m.nodes.parentFilter));
    assert.ok(m.nodes.parentFilterLabel.fullyInViewport,
      'P19 guardian filter label must also be legible at 200% '+key+': '+JSON.stringify(m.nodes.parentFilterLabel));
    assert.ok(m.nodes.parentFilterHint.fullyInViewport,
      'P19 date-not-reminder and mode-not-auth warning must remain visible at 200% '+key);
    assert.ok(m.nodes.inListAdd.fullyInViewport,
      'P19 original register CTA visible at 200% '+key+': '+JSON.stringify(m.nodes.inListAdd));
    assert.ok(m.documentScrollY>0,'route should land on A content at 200%');
   }else{
    assert.equal(m.nodes.parentFilter.fullyInViewport,baseline[key].nodes.parentFilter.fullyInViewport,
      'normal zoom filter discoverability regression');
    assert.equal(m.nodes.navAdd.fullyInViewport,baseline[key].nodes.navAdd.fullyInViewport,
      'normal zoom registration nav discoverability regression');
   }
   await capture('after-'+width+'-zoom-'+zoom+'-initial-list');
  }
 }
 ev.candidate=candidate;
 assert.deepEqual(await local(page),seeded,'route scroll does not save A records/photos');
 pass('P19 same original A parent filter + register CTA visible at CSS200 320/390; normal-width old action unchanged');

 // Separate task: find manual-note C through *existing* guardian view;
 // parent state no changes until explicit action.
 await page.setViewportSize({width:320,height:720});
 await page.evaluate(()=>document.body.style.zoom='2');
 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 const beforeTask=await local(page);
 assert.deepEqual(beforeTask,seeded);
 await page.locator('#wrong-p17-state-filter').selectOption('manual');
 const manual=await probe('P18 manual C at 320 zoom2');
 assert.deepEqual(manual.cardsVisible,[ids.C]);
 await capture('before-manual-filter-C-zoom2');
 await page.locator('#records-list > [data-record="'+ids.C+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 assert.equal(await page.locator('#detail-text').innerText(),questions.C);
 await page.locator('#detail-image img').waitFor();
 await page.locator('#wrong008-next-review:visible').waitFor();
 assert.ok((await page.locator('#wrong008-last-manual-note').innerText()).includes(future));
 assert.deepEqual(await local(page),seeded);
 await capture('before-manual-C-detail-zoom2');
 pass('parent 320 CSS zoom2 existing P18 manual filter opens exact C photo and date without auto observation/save');
 // Parent registration task uses original A +new-record CTA, with no save.
 await page.locator('#nav-records').click();
 const parentList=await probe('P18 before list add task zoom2');
 await page.locator('#page-records > .row.spread [data-route="add"]').click();
 await page.locator('#add-heading:visible').waitFor();
 assert.ok((await page.locator('#add-heading').textContent()).includes('틀린 문제'));
 assert.deepEqual(await local(page),seeded,'navigating to add form cannot create new A record/photo');
 await capture('before-add-form-no-save-zoom2');
 const childA=await page.locator('#v218-child-mode');
 await childA.click();
 const childState=await probe('P18 child mode after parent preview zoom2');
 assert.equal(childState.nodes.parentMode.visible,true);
 await page.locator('#nav-records').click();
 const afterChild=await probe('P18 child list zoom2');
 assert.equal(afterChild.cardsVisible.length,16);
 assert.equal(afterChild.nodes.parentFilter.visible,false);
 assert.deepEqual(await local(page),seeded);
 await capture('before-child-list-parent-filter-hidden-zoom2');
 ev.baselineTasks={manual:{target:ids.C,stage:manual},registration:{parentList,addFormOpened:true,writeOnOpen:0},
  child:{state:afterChild,filterHidden:true}};
 pass('parent 200% original register CTA opens real A new-record form without save; child all16 and parent filter hidden');
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_P19_ZOOM_RESULT='+JSON.stringify({
  status:'PASS',phase:'before-after',checks:ev.checkCount,png:ev.screenshots.length,
  records:16,photos:16,overflow320z2:baseline['320z2'].overflow,
  inListAddFirst320z2Before:baseline['320z2'].nodes.inListAdd.fullyInViewport,
  parentFilterFirst320z2Before:baseline['320z2'].nodes.parentFilter.fullyInViewport,
  inListAddFirst320z2After:candidate['320z2'].nodes.inListAdd.fullyInViewport,
  parentFilterFirst320z2After:candidate['320z2'].nodes.parentFilter.fullyInViewport,
  autoWrites:0,safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);ev.stack=String(e?.stack||'').slice(0,2600);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_P19_ZOOM_RESULT='+JSON.stringify({status:'FAIL',checks:ev.validations.length,error:String(e),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
