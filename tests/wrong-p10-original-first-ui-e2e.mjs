// WRONG-P10 UI-only targeted Chromium exercise: original A record and
// photo before QA-injected P7 read summary; no P8/P9 full suites, no PG/import.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongP3SyntheticLocalServer} from '../scripts/wrong-p3-local-timeline-server.mjs';

for(const flag of ['QA44_STAGE_ONLY','QA44_SYNTHETIC_CHILD_ONLY',
 'QA44_SYNTHETIC_GUARDIAN_OBS_ONLY','WRONG_P3_SYNTHETIC_LOCAL_ONLY',
 'WRONG_P7_SYNTHETIC_RESTORED_READONLY','WRONG_P8_SYNTHETIC_A_PARENT_ONLY',
 'WRONG_P10_SYNTHETIC_UI_ONLY']){
 if(process.env[flag]!=='1')throw Error('P10_SYNTHETIC_UI_FLAG_REQUIRED_'+flag);
}
const sha=x=>createHash('sha256').update(x).digest('hex');
const indexBytes=readFileSync(new URL('../index.html',import.meta.url));
const bridgeBytes=readFileSync(new URL('../scripts/wrong-p8-a-parent-read-bridge.js',import.meta.url));
const sid=()=>randomBytes(24).toString('hex');
const fa='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fb='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessions=new Map();
const [sa,sb,sr,sc]=[sid(),sid(),sid(),sid()];
const [ta,tb,tr,tc]=['QA-P10-A','QA-P10-B','QA-P10-REVOKED','QA-P10-CHILD'];
for(const [session,role,token,family] of [[sa,'guardian',ta,fa],[sb,'guardian',tb,fb],
 [sr,'guardian',tr,fa],[sc,'child',tc,fa]]){
 sessions.set(session,{role,token,family,recordId:'pending-record'});
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const title='가상 국어 문제: 비 오는 날 우산을 쓴 이유는?';
let liveId='',readCalls=0;
const t0='2026-11-11T00:01:00Z';
function projection(){
 const attempts=[
  {attemptId:'child-retry-001',answer:'비가 와서',explanation:'처음에는 그림만 보았어요.',
   at:t0,revision:2,observations:[
    {id:'parent-observe-001',status:'explained',
     note:'첫 설명을 아이에게 직접 들었어요.',at:t0,revision:3}]},
  {attemptId:'child-retry-002',answer:'젖지 않으려고',explanation:'우산을 쓰는 이유를 연결했어요.',
   at:t0,revision:4,observations:[
    {id:'parent-observe-002',status:'needs_help',
     note:'두 번째 설명에는 추가 질문이 필요했어요.',at:t0,revision:5}]}
 ];
 return {record:{id:liveId,subject:'korean',gradeAtEntry:3,
  problemText:title,hasPhoto:true},revision:5,attempts,
  order:[{kind:'child_retry',attemptId:'child-retry-001',revision:2},
         {kind:'guardian_observation',attemptId:'child-retry-001',
          observationId:'parent-observe-001',revision:3},
         {kind:'child_retry',attemptId:'child-retry-002',revision:4},
         {kind:'guardian_observation',attemptId:'child-retry-002',
          observationId:'parent-observe-002',revision:5}],
  readOnlyRestored:true,readOnly:true,
  observationEventsIncludedInJsonBackup:false,safeToRestore:false};
}
const guardianStore={
 async guardianRetryTimeline(token,family,recordId){
  readCalls++;
  if(!liveId||recordId!==liveId)return null;
  // Fixture deliberately emulates authorization/consent rejection; real P7
  // permission is not under test and retains its original SQL implementation.
  if(token===tr||token===tc)return null;
  if(token===ta&&family===fa)return projection();
  if(token===tb&&family===fb)return {...projection(),
   record:{...projection().record,problemText:'FOREIGN_FAMILY_PRIVATE_PROBLEM'}};
  return null;
 }
};
const evidence={task:'WRONG-P10 real A parent-first collapsed QA bridge',
 syntheticOnly:true, realAuth:false, realConsent:false,
 indexOriginalChanged:false, P7ModuleChanged:false, restorePerformed:false,
 safeToRestore:false, checks:[],screenshots:[],failClosed:[],externalRequests:0};
function passed(label){evidence.checks.push(label);
 console.log('PASS WRONG_P10_UI '+evidence.checks.length+' '+label)}
async function local(page){
 return page.evaluate(async()=>{
  const name='uriaimath-github-qa-v224-only';
  const db=await new Promise((ok,no)=>{
   const req=indexedDB.open(name);req.onsuccess=()=>ok(req.result);
   req.onerror=()=>no(req.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const query=(store,method)=>new Promise((ok,no)=>{
    const req=tx.objectStore(store)[method]();
    req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
   });
   const [rows,keys,photos]=await Promise.all([
    query('mistakes','getAll'),query('photos','getAllKeys'),query('photos','getAll')]);
   const fp=[];
   for(let i=0;i<photos.length;i++){
    const v=photos[i],buf=await v.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))]
     .map(x=>x.toString(16).padStart(2,'0')).join('');
    fp.push({key:keys[i],bytes:buf.byteLength,mime:v.type,sha:hash});
   }
   return {rows,photos:fp};
  }finally{db.close()}
 });
}
async function openRecord(page,id){
 await page.locator('#nav-records').click();
 await page.locator('#records-list [data-record="'+id+'"]').click();
 await page.locator('#detail-text:visible').waitFor();
 await page.locator('#wrong-p8-read-action:visible').waitFor();
 await page.locator('#detail-image img').waitFor();
}
async function shot(page,name){
 const path='test-results/wrong-p10/'+name+'.png';
 await page.screenshot({path,fullPage:true});
 evidence.screenshots.push(name+'.png');
}
async function cookie(context,origin,id){
 await context.addCookies([{name:'wrong_p3_demo_session',value:id,
  url:origin,httpOnly:true,sameSite:'Strict'}]);
}
let server,browser,context;
try{
 server=await startWrongP3SyntheticLocalServer({guardianStore,
  sessions,restoredReadOnly:true,aParentReadOnly:true,port:0});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
 await cookie(context,server.origin,sa);
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(/^https?:/.test(url)&&new URL(url).origin!==server.origin){
   evidence.externalRequests++;return route.abort()
  }
  return route.continue();
 });
 const page=await context.newPage();
 const response=await page.goto(server.origin+'/qa-p8/a-parent');
 assert.equal(response.status(),200);
 await page.locator('#nav-add').waitFor();
 assert.ok((await page.locator('body').innerText()).includes('우리아이 오답노트'));
 passed('actual unmodified A index served from guarded localhost P8 bridge; no invented screen');

 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('korean');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#problem').fill(title);
 await page.locator('#choose-photo').setInputFiles({name:'synthetic.png',
  mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor();
 const original=await local(page);
 assert.equal(original.rows.length,1);assert.equal(original.photos.length,1);
 assert.equal(original.rows[0].problemText,title);
 liveId=original.rows[0].id;
 for(const session of sessions.values())session.recordId=liveId;
 await openRecord(page,liveId);
 const hierarchy=await page.evaluate(()=>({
  problem:document.querySelector('#detail-text')?.textContent,
  image:document.querySelector('#detail-image img')?.getAttribute('alt'),
  cardPosition:document.querySelector('#detail-card')?.compareDocumentPosition(
    document.querySelector('#wrong-p8-restored-read')),
  summaryHidden:document.querySelector('#wrong-p10-read-summary')?.hidden,
  eventCount:document.querySelectorAll('#wrong-p8-read-events li').length
 }));
 assert.equal(hierarchy.problem,title);
 assert.ok(hierarchy.image?.includes('문제'));
 assert.ok(Boolean(hierarchy.cardPosition&4 /* DOCUMENT_POSITION_FOLLOWING */));
 assert.equal(hierarchy.summaryHidden,true);
 assert.equal(hierarchy.eventCount,0);
 mkdirSync('test-results/wrong-p10',{recursive:true});
 await shot(page,'01-before-390');
 passed('A original question/real local photo and parent content precede QA bridge; no timeline before query');

 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p10-read-summary')?.hidden===false);
 const summary=await page.locator('#wrong-p10-read-summary').innerText();
 assert.ok(summary.includes('아이 재풀이 2회 · 부모 관찰 2회 (가상 읽기 전용)'));
 assert.equal(await page.locator('#wrong-p8-read-events li').count(),0);
 assert.equal(await page.locator('#wrong-p10-expand').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('#wrong-p8-read-events').isVisible(),false);
 assert.equal(await page.locator('#wrong-p8-restored-read').innerText().then(s=>s.includes('child-retry-001')),false);
 await shot(page,'02-verified-collapsed-390');
 passed('verified guarded P7-shape 2 retries + 2 observations show concise summary, no raw event or technical revision until explicit expand');

 await page.locator('#wrong-p10-expand').click();
 assert.equal(await page.locator('#wrong-p10-expand').getAttribute('aria-expanded'),'true');
 const rows=page.locator('#wrong-p8-read-events li');
 assert.equal(await rows.count(),4);
 const contents=await rows.allTextContents();
 assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.kind)),
  ['child_retry','guardian_observation','child_retry','guardian_observation']);
 assert.ok(contents[0].includes('그림만 보았어요'));
 assert.ok(contents[1].includes('첫 설명을 아이에게 직접'));
 assert.ok(contents[2].includes('이유를 연결했어요'));
 assert.ok(contents[3].includes('추가 질문이 필요'));
 assert.ok((await page.locator('#wrong-p8-restored-read').innerText()).includes('서버 개정 5'));
 await shot(page,'03-expanded-390');
 passed('user click expands four original ordered records + revision detail without rewriting any text');

 await page.locator('#wrong-p10-expand').click();
 assert.equal(await page.locator('#wrong-p10-expand').getAttribute('aria-expanded'),'false');
 assert.equal(await rows.count(),0);
 assert.equal(await page.locator('#wrong-p8-read-events').isVisible(),false);
 await shot(page,'04-collapsed-again-390');
 passed('second click folds timeline and removes sensitive event DOM; summary remains in original A detail');

 assert.deepEqual(await local(page),original);
 await page.locator('#nav-home').click();
 assert.equal(await rows.count(),0);
 assert.equal(await page.locator('#wrong-p8-restored-read').isVisible(),false);
 await openRecord(page,liveId);
 assert.equal(await page.locator('#wrong-p10-read-summary').isVisible(),false);
 passed('moving out/returning to record removes prior guardian timeline; original local records/photo unchanged');

 await cookie(context,server.origin,sb);
 await page.reload();await openRecord(page,liveId);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p8-read-status')?.textContent?.includes('조회 차단'));
 assert.equal(await rows.count(),0);
 assert.equal(await page.locator('#wrong-p10-expand').isVisible(),false);
 assert.equal(await page.locator('#wrong-p10-read-summary').isVisible(),false);
 assert.ok(!(await page.locator('#wrong-p8-restored-read').innerText()).includes('FOREIGN_FAMILY_PRIVATE_PROBLEM'));
 await shot(page,'05-family-mismatch-denied-390');
 evidence.failClosed.push('different family same ID with mismatched problem');
 passed('other family with same local record ID but different question is fail-closed without showing private event');

 await cookie(context,server.origin,sr);
 await page.locator('#wrong-p8-read-action').click();
 await page.waitForFunction(()=>document.querySelector('#wrong-p8-read-status')?.textContent?.includes('조회 차단'));
 assert.equal(await rows.count(),0);assert.equal(await page.locator('#wrong-p10-expand').isVisible(),false);
 evidence.failClosed.push('synthetic guardian revoked');
 passed('synthetically revoked guardian server read denied and any old summary/timeline erased');

 await cookie(context,server.origin,sc);
 const forbidden=await page.goto(server.origin+'/qa-p8/a-parent');
 assert.equal(forbidden.status(),403);
 evidence.failClosed.push('synthetic child-as-guardian');
 passed('synthetic child cannot load original A parent-only QA page');

 await cookie(context,server.origin,sa);
 await page.goto(server.origin+'/qa-p8/a-parent');await openRecord(page,liveId);
 const post=await page.evaluate(async()=>{
  const response=await fetch('/qa-p3/api/parent/observe',{method:'POST',
   headers:{'content-type':'application/json'},body:'{}'});
  return response.status;
 });
 assert.equal(post,405);
 passed('synthetic P7 restoredReadOnly blocks observation writes; no restore or DB mutation path');

 const final=await local(page);
 assert.deepEqual(final,original);
 assert.equal(sha(readFileSync(new URL('../index.html',import.meta.url))),sha(indexBytes));
 assert.equal(sha(readFileSync(new URL('../scripts/wrong-p8-a-parent-read-bridge.js',import.meta.url))),sha(bridgeBytes));
 assert.equal(evidence.externalRequests,0);
 passed('pre/post actual A IndexedDB record + photo bytes identical, tracked A file unchanged and HTTP external zero');
 evidence.recordId=liveId;evidence.recordSha=sha(JSON.stringify(original.rows[0]));
 evidence.photo=original.photos[0];evidence.readCalls=readCalls;
 evidence.result='PASS';evidence.checkCount=evidence.checks.length;
 writeFileSync('test-results/wrong-p10/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_P10_UI_RESULT='+JSON.stringify({
  status:'PASS',checks:evidence.checkCount,shots:evidence.screenshots.length,
  actualA:true,originalFirst:true,expandCollapse:true,
  foreignRejected:true,revokedDenied:true,childDenied:true,
  aIndexedDBUnchanged:true,safeToRestore:false}));
}catch(error){
 mkdirSync('test-results/wrong-p10',{recursive:true});
 evidence.result='FAIL';evidence.error=String(error);
 evidence.stack=String(error?.stack).slice(0,1800);
 writeFileSync('test-results/wrong-p10/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_P10_UI_RESULT='+JSON.stringify({status:'FAIL',
  checks:evidence.checks.length,error:String(error),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await server.close();
}
