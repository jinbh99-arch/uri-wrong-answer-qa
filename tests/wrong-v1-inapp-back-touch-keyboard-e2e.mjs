// WRONG-INTEGRATION targeted A guardian integrated journey across sixteen actual synthetic records.
// Reuse P17 seeding helpers, but validate new combined user task, not old P17 filter tests.
// NO live users, network backend, real family auth, old B2/B3 ledger or restore.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

if(process.env.WRONG_INAPP_BACK_LOCAL_ONLY!=='1')
 throw Error('WRONG_INAPP_BACK_LOCAL_ONLY_GATE_REQUIRED');
const base='d212f7708c83a80bb94f652ba0ecc70ec4cd77c9';
const before=execFileSync('git',['show',base+':index.html'],{maxBuffer:8*1024*1024});
const after=readFileSync(new URL('../index.html',import.meta.url));
const gitBlob=bytes=>createHash('sha1')
 .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.equal(gitBlob(before),gitBlob(after),'test exact unchanged P19 same-session product HTML, no product patch');
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

const dir='test-results/wrong-v1-inapp-back';
const ev={task:'WRONG v1 original A internal list button at 320/390 CSS100/200 touch keyboard original D photo guardian',
  p19ProductSha:base,baselineGitBlob:gitBlob(before),candidateGitBlob:gitBlob(after),
  syntheticOnly:true,originalARecords:true,operatingDataUsed:false,
  childRealIdentity:false,realParentAuthorization:false,
  realNotification:false,safeToRestore:false,restorePerformed:false,
  validations:[],screenshots:[],states:[],measurements:[],
  evidenceBefore:{},evidenceAfter:{},externalHttp:0};
function pass(label){ev.validations.push(label);console.log('PASS WRONG_INAPP_BACK '+ev.validations.length+' '+label)}
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
  if(req.method==='GET'&&p==='/base'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(after);
  }
  if(req.method==='GET'&&Object.hasOwn(js,p)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});return res.end(js[p]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',hasTouch:true,isMobile:true});
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==origin){ev.externalHttp++;return route.abort()}
  return route.continue();
 });
 const page=await context.newPage();
 assert.equal((await page.goto(origin+'/base')).status(),200);
 await page.locator('#nav-add').waitFor();
 const d=await add(page,'D'),id=d.id;
 await retry(page,id,'D');
 await observe(page,id,'D');
 const fixed=await local(page);
 assert.equal(fixed.rows.length,1);assert.equal(fixed.photos.length,1);
 assert.equal(fixed.rows[0].id,id);
 assert.equal(fixed.rows[0].generalRetryHistory.at(-1).review,'explained');
 assert.equal(fixed.rows[0].checkHistory.length,1);
 await snap(page,'00-original-D-photo-observed');
 pass('seed one synthetic D via original A photo, child explanation and explicit parent observation');
 const views=[];
 async function measure(stage){
  const v=await page.evaluate(()=>{
   const back=document.querySelector('#page-detail [data-route="records"]');
   const r=back?.getBoundingClientRect();
   const visible=!document.querySelector('#page-detail')?.classList.contains('hide');
   const wrap=document.querySelector('#wrong-p17-filter-wrap'),fr=wrap?.getBoundingClientRect();
   return {viewport:{width:innerWidth,height:innerHeight},bodyZoom:document.body.style.zoom||'1',
    route:visible?'detail':(!document.querySelector('#page-records')?.classList.contains('hide')?'records':'other'),
    scrollY:scrollY,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth-innerWidth,
    activeId:document.activeElement?.id||'',activeTag:document.activeElement?.tagName||'',
    activeText:document.activeElement?.textContent?.trim().slice(0,80)||'',
    backVisible:visible&&!!r&&r.width>0&&r.height>0,
    backRect:r?{x:r.x,y:r.y,bottom:r.bottom,right:r.right,height:r.height,width:r.width}:null,
    backInViewport:visible&&!!r&&r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth,
    filter:document.querySelector('#wrong-p17-state-filter')?.value,
    filterRect:fr?{y:fr.y,bottom:fr.bottom}:null,
    parentMode:document.querySelector('#v218-parent-mode')?.getAttribute('aria-pressed')};
  });
  views.push({stage,...v});return v;
 }
 let totalKeyboardTabs=0,backActions=0;
 for(const spec of [{w:320,h:720,zoom:1},{w:320,h:720,zoom:2},{w:390,h:844,zoom:1},{w:390,h:844,zoom:2}]){
  const prefix=String(spec.w)+'-'+String(spec.zoom);
  await page.setViewportSize({width:spec.w,height:spec.h});
  await page.evaluate(z=>{document.body.style.zoom=z===2?'2':''},spec.zoom);
  await page.locator('#v218-parent-mode').click();
  await page.locator('#nav-home').click();
  await page.locator('#nav-records').click();
  await page.locator('#wrong-p17-state-filter').selectOption('all');
  assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
  const pre=await measure(prefix+' records before D');
  assert.equal(pre.route,'records');
  assert.equal(pre.overflow,0,'records must not overflow horizontally');
  await page.locator('#records-list [data-record="'+id+'"]').click();
  await page.locator('#detail-image img').waitFor();
  assert.equal(await page.locator('#detail-text').innerText(),questions.D);
  assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
  assert.equal(await page.locator('#v230-review').inputValue(),'explained');
  const initial=await measure(prefix+' first detail before any scroll');
  assert.equal(initial.route,'detail');assert.equal(initial.backVisible,true);
  assert.ok(initial.backRect.height>=32);
  await snap(page,prefix+'-01-detail-back-actual-entry');
  const tabs=[];
  for(let i=0;i<25;i++){
   await page.keyboard.press('Tab');totalKeyboardTabs++;
   const f=await page.evaluate(()=>{
    const e=document.activeElement;
    return {id:e?.id||'',text:e?.textContent?.trim().slice(0,60)||'',
      isBack:e?.matches?.('#page-detail [data-route="records"]')||false};
   });
   tabs.push(f);if(f.isBack)break;
  }
  const keyboardFound=tabs.some(x=>x.isBack);
  assert.ok(keyboardFound,'existing ← 목록으로 must be reachable by Tab at all viewport states');
  const keyed=await measure(prefix+' after keyboard Tab to ← 목록으로');
  assert.equal(keyed.backInViewport,true,'keyboard focused back must be in viewport');
  await snap(page,prefix+'-02-keyboard-back-focus');
  await page.locator('#page-detail [data-route="records"]').scrollIntoViewIfNeeded();
  const touch=await measure(prefix+' back reachable for tap');
  assert.equal(touch.backInViewport,true);
  const rect=touch.backRect;
  await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
  backActions++;
  await page.locator('#page-records:not(.hide)').waitFor();
  assert.equal(await page.locator('#wrong-p17-state-filter').inputValue(),'all');
  assert.equal(await page.locator('#records-list [data-record="'+id+'"]').count(),1);
  const out=await measure(prefix+' in-app tap returned to original D in all records');
  assert.equal(out.route,'records');assert.equal(out.overflow,0);
  await snap(page,prefix+'-03-return-list-same-D');
  await page.locator('#records-list [data-record="'+id+'"]').click();
  await page.locator('#detail-image img').waitFor();
  assert.equal(await page.locator('#detail-text').innerText(),questions.D);
  assert.equal(await page.locator('#v230-review').inputValue(),'explained');
  assert.ok((await page.locator('#wrong-p0-child-reason-readonly').innerText()).includes(explanations.D));
  assert.ok((await page.locator('#check-history').innerText()).includes('D 관찰'));
  assert.deepEqual(await local(page),fixed,'in-app back and same D reopening cannot mutate original A photos or records');
  await snap(page,prefix+'-04-same-original-D-photo-after-return');
  views.push({stage:'result-'+prefix,firstViewBack:initial.backInViewport,
    initialBack:initial.backRect,keyboardTabsToExistingBack:tabs.length,keyboardFound,
    afterFocus:keyed.backRect,tapScrollRequired:!initial.backInViewport,
    restoredOriginalId:id,samePhoto:true,dataWritesOnRead:0});
  pass(prefix+' zoom: original D ← 목록으로 Tab+touch and same ID/photo/observed state preserved');
 }
 const final=await local(page);assert.deepEqual(final,fixed);assert.equal(ev.externalHttp,0);
 ev.v1OriginalBack={baselineSha:base,recordId:id,conditions:views,totalKeyboardTabs,backActions,
  productHtmlEdited:false,historyPrototypeUsed:false,photoUnchanged:true,
  realUserTested:false,actualMobileOSZoomTested:false,restoreSafe:false};
 ev.result='PASS';ev.checkCount=ev.validations.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.log('WRONG_V1_INAPP_BACK_RESULT='+JSON.stringify({
  status:'PASS',checks:ev.checkCount,png:ev.screenshots.length,
  originalProductSha:base,conditions:4,backActions,
  sameDReopenedAll:true,photoOriginal:true,autoWrites:0,
  externalHTTP:0,safeToRestore:false}));
}catch(e){
 ev.result='FAIL';ev.error=String(e);ev.stack=String(e?.stack||'').slice(0,3000);
 mkdirSync(dir,{recursive:true});writeFileSync(dir+'/evidence.json',JSON.stringify(ev,null,2));
 console.error('WRONG_V1_INAPP_BACK_RESULT='+JSON.stringify({status:'FAIL',
 checks:ev.validations.length,error:String(e),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
