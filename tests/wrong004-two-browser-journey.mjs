// WRONG-004: parent(390px)/child-view(320px) ACTUAL index.html through signed
// synthetic JWT + temporary local PostgreSQL, with full original image proof.
// Strictly fake records, temporary loopback HTTP, NO real child/cloud/Netlify.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {SignJWT,generateKeyPair,exportJWK} from 'jose';
import {chromium} from 'playwright';
import {createQa40SyntheticOidcResolver} from '../scripts/qa40-oidc-resolver.mjs';
import {createQa41LoopbackFamilyApi} from '../scripts/qa41-signed-family-http.mjs';
const {Pool}=pg;
const BASE='http://127.0.0.1:4173',DB='uriaimath-github-qa-v224-only';
const FAMILY='a1111111-1111-4111-8111-111111111111';
const FOREIGN='b2222222-2222-4222-8222-222222222222';
const ISS='https://wrong004-fake-issuer.invalid',AUD='wrong004-signed-fake-api';
const USER_A='wrong004-synthetic-guardian-A',USER_B='wrong004-synthetic-guardian-B',USER_C='wrong004-foreign-family';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
if(!process.env.QA39_TEST_DATABASE_URL||!process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('WRONG004_POSTGRES_MUST_BE_LOCAL');
process.env.QA39_REFERENCE_ONLY='1';process.env.QA40_SYNTHETIC_JWKS_ONLY='1';process.env.QA41_LOOPBACK_ONLY='1';
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const url=new URL(process.env.QA39_TEST_DATABASE_URL);
url.username='qa39_app';url.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const dbApp=new Pool({connectionString:url.toString()});
let gate,browser,checks=0;
const pass=x=>{checks++;console.log('PASS WRONG004 '+x)};
async function stored(p){
 return p.evaluate(async name=>{
  const open=indexedDB.open(name),db=await new Promise((ok,bad)=>{open.onsuccess=()=>ok(open.result);open.onerror=()=>bad(open.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const q=req=>new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
   const [records,photos,ids]=await Promise.all([
    q(tx.objectStore('mistakes').getAll()),q(tx.objectStore('photos').getAll()),q(tx.objectStore('photos').getAllKeys())]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(photos.map(async(b,i)=>({id:ids[i],mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
async function app(ctx){
 const p=await ctx.newPage();
 await p.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa42-real-api:visible').waitFor({timeout:25000});
 return p;
}
async function connect(p,jwt,expected){
 await p.locator('#qa42-port').fill(String(new URL(gate.baseUrl).port));
 await p.locator('#qa42-token').fill(jwt);
 await p.locator('#qa42-connect').click();
 await p.getByText('JWT와 PostgreSQL 가족 권한 확인 완료.',{exact:false}).waitFor({timeout:25000});
 assert.equal(await p.locator('#qa42-family').inputValue(),expected);
 await p.locator('#qa42-synthetic').check();
}
async function remote(family,jwt){
 const response=await fetch(gate.baseUrl+'/qa41/families/'+family+'/snapshot',{headers:{origin:BASE,authorization:'Bearer '+jwt}});
 return {status:response.status,body:await response.json()};
}
async function toDetail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong004-handoff').waitFor({timeout:15000});
}
async function handoff(p){
 await p.locator('#wrong004-handoff').click();
 await p.locator('#qa42-real-api:visible').waitFor();
}
async function push(p,rev){
 const before=await p.locator('#qa42-revision').innerText();
 assert.equal(await p.locator('#qa42-upload').isEnabled(),true,'upload button disabled at '+before);
 assert.equal(await p.locator('#qa42-synthetic').isChecked(),true,'synthetic only confirmation lost');
 await p.locator('#qa42-upload').click();
 await p.waitForFunction(value=>{
  const el=document.querySelector('#qa42-status');
  return el&&(el.textContent.includes('개정번호 '+value+'에 합성 오답을 저장했습니다.')||el.dataset.error==='true');
 },rev,{timeout:25000});
 const actual=await p.locator('#qa42-status').innerText();
 assert.match(actual,new RegExp('개정번호 '+rev+'에 합성 오답을 저장했습니다\\.'),'upload failed: '+actual+'; previously '+before);
}
async function pull(p,id){
 await p.locator('#qa42-target').selectOption(id);
 await p.locator('#qa42-pull').click();
 await p.waitForFunction(()=>{
  const verify=document.querySelector('#v18-verify-result')?.textContent||'';
  return document.querySelector('#confirm-dialog[open]')||
   document.querySelector('#qa42-status')?.dataset.error==='true'||
   verify.includes('복원 전 검사에서 차단')||verify.includes('⛔');
 },null,{timeout:25000}).catch(async err=>{
  const status=await p.locator('#qa42-status').innerText();
  const verify=await p.locator('#v18-verify-result').innerText();
  const toast=await p.locator('#toast').innerText();
  throw Error('GET/import no confirm: status='+status+' | integrity='+verify+' | toast='+toast+' | '+String(err));
 });
 const status=await p.locator('#qa42-status').innerText();
 const verify=await p.locator('#v18-verify-result').innerText();
 assert.equal(await p.locator('#confirm-dialog[open]').count(),1,'GET/pull blocked: '+status+'; import='+verify);
 await p.locator('#dlg-ok').click();
 await p.locator('#wrong004-handoff:visible').waitFor({timeout:10000}).catch(async err=>{
  const evidence=await p.evaluate(()=>({
   qa42Status:document.querySelector('#qa42-status')?.textContent,
   qa42Error:document.querySelector('#qa42-status')?.dataset.error,
   restoreCheck:document.querySelector('#v18-verify-result')?.textContent,
   toast:document.querySelector('#toast')?.textContent,
   visiblePages:Array.from(document.querySelectorAll('[data-page]')).filter(el=>!el.classList.contains('hide')).map(el=>el.id),
   detailExists:Boolean(document.querySelector('#detail-card #detail-text')),
   handoffExists:Boolean(document.querySelector('#wrong004-handoff')),
   chosenId:document.querySelector('#qa42-target')?.value,
   openDialog:Boolean(document.querySelector('#confirm-dialog[open]'))
  }));
  throw Error('WRONG004_AFTER_RESTORE_DIAGNOSTIC='+JSON.stringify(evidence)+' | '+String(err));
 });
 assert.equal(await p.locator('#detail-edit').getAttribute('data-record')===id,false); // detail is selected by app, not a URL query
 assert.equal(await p.locator('#wrong004-cross-device').isVisible(),true);
}
try{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{modulusLength:2048});
 const jwk={...await exportJWK(publicKey),alg:'RS256',use:'sig',kid:'wrong004-fake'};
 const resolve=createQa40SyntheticOidcResolver({issuer:ISS,audience:AUD,jwks:{keys:[jwk]}});
 const issue=sub=>new SignJWT({qa:'wrong004-synthetic-only'}).setProtectedHeader({alg:'RS256',kid:jwk.kid})
  .setIssuer(ISS).setAudience(AUD).setSubject(sub).setIssuedAt().setExpirationTime('10m').sign(privateKey);
 const [jwtA,jwtB,jwtC]=await Promise.all([issue(USER_A),issue(USER_B),issue(USER_C)]);
 for(const id of [FAMILY,FOREIGN]){
  await admin.query('INSERT INTO qa39.families(family_id) VALUES($1)',[id]);
  await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES($1)',[id]);
 }
 for(const [id,sub] of [[FAMILY,USER_A],[FAMILY,USER_B],[FOREIGN,USER_C]]){
  const principal='oidc:'+createHash('sha256').update(ISS+'\0'+sub).digest('hex');
  await admin.query("INSERT INTO qa39.guardian_memberships(family_id,principal_id,role,verified_at) VALUES($1,$2,'guardian',now())",[id,principal]);
 }
 gate=await createQa41LoopbackFamilyApi({pool:dbApp,resolveAuthenticatedPrincipal:resolve});
 browser=await chromium.launch({headless:true});
 const parentCtx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const childCtx=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const otherCtx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const A=await app(parentCtx),B=await app(childCtx),C=await app(otherCtx),errors=[];
 for(const p of [A,B,C])p.on('pageerror',e=>errors.push(String(e)));
 await connect(A,jwtA,FAMILY);await connect(C,jwtC,FOREIGN);
 assert.equal((await remote(FAMILY,jwtC)).status,404);
 assert.equal((await remote(FOREIGN,jwtC)).status,200);
 pass('다른 가족 JWT/RLS는 타 가족 기록 조회 차단, 부모 390px/아이 320px 별도 브라우저');

 await A.locator('#nav-add').click();
 await A.locator('#choose-photo').setInputFiles({name:'wrong004-1px.png',mimeType:'image/png',buffer:PNG});
 await A.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await A.locator('#problem').fill('WRONG004 가상 사진 문제: 6 + 3 = ?');
 await A.locator('#student-answer').fill('8 가상 오답');
 await A.locator('#concept').selectOption('math.natural.addition');
 await A.locator('#reason').selectOption('unknown'); // related concept known; cause NOT established
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor();
 const original=await stored(A),id=original.records[0]?.id;
 assert.equal(original.records.length,1);assert.equal(original.photos.length,1);
 await A.locator('#wrong002-plan').click();
 await A.locator('#v05-plan-date').fill('2026-11-15');
 await A.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('2026-11-15'));
 // WRONG-005: a second distinct family mistake, unknown concept but a
 // different POSSIBLE reason. Must never be conflated with the photo record.
 await A.locator('#nav-add').click();
 await A.locator('#problem').fill('WRONG005 가상 가족 둘째 오답: 문제 문장 해석 후보');
  await A.locator('#wrong007-subject').selectOption('english');
  await A.locator('#wrong007-grade').selectOption('5');
  assert.equal(await A.locator('#wrong007-math-fields').isVisible(),false);
 // English math concept selector is intentionally hidden. Its value must remain blank.
  assert.equal(await A.locator('#concept').inputValue(),'');
 await A.locator('#reason').selectOption('reading');
 await A.locator('#wrong006-candidates input[value="calculation"]').check();
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor();
 const second=(await stored(A)).records.find(r=>r.problemText.startsWith('WRONG005 가상 가족 둘째'));
 assert.ok(second);
 const secondId=second.id;
 // WRONG-008: parent saves an English manual recheck date in original checkHistory,
 // NOT a fabricated future observation or math studyPlan.
 await toDetail(A,secondId);
 await A.locator('#v230-answer').fill('English words: synthetic re-answer');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await A.locator('#v230-review').selectOption('needs_help');
 await A.locator('#v230-review-save').click();
 await A.waitForFunction(()=>document.querySelector('#v230-review')?.value==='needs_help');
 const wrong008Day=await A.evaluate(()=>{
  const d=new Date();d.setDate(d.getDate()+5);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 });
 await A.locator('#wrong008-next-date').fill(wrong008Day);
 await A.locator('#wrong008-next-question').fill('Synthetic English repeat reading');
 await A.locator('#wrong008-save-note').click();
 await A.waitForFunction(day=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),wrong008Day);
 await toDetail(A,id);
 const initial=await stored(A);
 assert.equal(initial.records.length,2);
 assert.equal(initial.records.find(r=>r.id===secondId).reason,'other');
 assert.deepEqual(initial.records.find(r=>r.id===secondId).reasonCandidates,['calculation','reading']);
 assert.equal(initial.records.find(r=>r.id===secondId).conceptId,'');
  assert.equal(initial.records.find(r=>r.id===secondId).subject,'english');
  assert.equal(initial.records.find(r=>r.id===secondId).gradeAtEntry,5);
  assert.equal(initial.records.find(r=>r.id===secondId).generalRetryHistory.at(-1).review,'needs_help');
  assert.equal(initial.records.find(r=>r.id===secondId).checkHistory[0].status,'not_checked');
  assert.match(initial.records.find(r=>r.id===secondId).checkHistory[0].memo,new RegExp('^다음 확인 메모: '+wrong008Day));
  assert.deepEqual(Object.keys(initial.records.find(r=>r.id===secondId).checkHistory[0]).sort(),['at','by','memo','status']);
 await handoff(A);
 await push(A,1);
 assert.equal(await A.locator('#qa42-target').inputValue(),id);
 assert.equal((await remote(FAMILY,jwtA)).body.snapshot.records.length,2);
 assert.ok((await remote(FAMILY,jwtA)).body.snapshot.records.some(r=>r.id===id));
 assert.ok((await remote(FAMILY,jwtA)).body.snapshot.records.some(r=>r.id===secondId));
 pass('보호자 가상 사진·복습 계획 저장→같은 ID 선택→가족 서버 수동 전송 rev1');

 await connect(B,jwtB,FAMILY);
 await B.locator('#qa42-target').selectOption(id);
 assert.equal(await B.locator('#qa42-target').inputValue(),id);
 await B.locator('#qa42-pull').click();
 await B.locator('#confirm-dialog[open]').waitFor();
 assert.equal((await stored(B)).records.length,0);
 await B.locator('#dlg-cancel').click();
 assert.equal((await stored(B)).records.length,0);
 await pull(B,id);
 assert.deepEqual(await stored(B),initial);
 assert.equal(await B.locator('#wrong004-handoff').isVisible(),true);
 pass('아이 브라우저 수신: 명시적 복원 취소는 0건, 확인 뒤 동일 ID/사진 바이트/복습 계획');

 await B.locator('#v218-child-mode').click();
 assert.equal(await B.locator('#wrong002-retry').isVisible(),true);
 assert.equal(await B.locator('#wrong002-plan').isVisible(),false);
 await B.locator('#wrong002-retry').click();
 await B.locator('#v230-answer').fill('9');
 await B.locator('#v230-explanation').fill('6개와 3개를 세어 다시 풀었음 (가상)');
 await B.locator('#v230-save').click();
 await B.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 const childState=await stored(B);
 assert.equal(childState.records.length,2);
 const childFirst=childState.records.find(r=>r.id===id);
 assert.ok(childFirst);
 assert.equal(childFirst.conceptId,'math.natural.addition');
 assert.equal(childFirst.reason,'unknown');
 assert.deepEqual(childFirst.reasonCandidates,[]);
 assert.equal(childState.records.find(r=>r.id===secondId).reason,'other');
 assert.deepEqual(childState.records.find(r=>r.id===secondId).reasonCandidates,['calculation','reading']);
 assert.equal(childState.records.find(r=>r.id===secondId).conceptId,'');
  assert.equal(childState.records.find(r=>r.id===secondId).subject,'english');
  assert.equal(childState.records.find(r=>r.id===secondId).gradeAtEntry,5);
  assert.equal(childState.records.find(r=>r.id===secondId).generalRetryHistory.at(-1).review,'needs_help');
  assert.match(childState.records.find(r=>r.id===secondId).checkHistory[0].memo,new RegExp(wrong008Day));
 assert.deepEqual(childState.photos,original.photos);
 assert.equal(childFirst.studyPlan.dueDate,'2026-11-15');
 await handoff(B);
 assert.equal(await B.locator('#qa42-real-api').isVisible(),true);
 await B.locator('#qa42-learning-approve').check();
 await push(B,2);
 assert.equal((await remote(FAMILY,jwtA)).body.revision,2);
 pass('아이는 같은 ID의 재풀이 저장, 화면상 부모 기능 숨김 → 보호자 시범 전송 rev2 (자동동기화 아님)');

 await A.locator('#qa42-target').selectOption(id);
 await pull(A,id);
 assert.deepEqual(await stored(A),childState);
 await A.locator('#wrong002-outcome').click();
 await A.locator('#v06-review-outcome').selectOption('explained');
 await A.locator('#v06-review-memo').fill('가상 관찰: 다시 풀 때 설명을 함');
 await A.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'));
 await A.locator('#wrong002-report').click();
 assert.equal(await A.locator('#v227-parent-report').isVisible(),true);
 await toDetail(A,id);await handoff(A);
 await A.locator('#qa42-learning-approve').check();
 await push(A,3);
 pass('부모가 rev2 수신 후 같은 ID의 복습 결과 관찰→활동 보고서→가족 서버 rev3');

 await B.locator('#qa42-target').selectOption(id);
 await pull(B,id);
 const observed=await stored(B);
 assert.equal(observed.records.length,2);
 const observedFirst=observed.records.find(r=>r.id===id),observedSecond=observed.records.find(r=>r.id===secondId);
 assert.ok(observedFirst);assert.ok(observedSecond);
 assert.equal(observedFirst.conceptId,'math.natural.addition');
 assert.equal(observedFirst.reason,'unknown');
 assert.deepEqual(observedFirst.reasonCandidates,[]);
 assert.equal(observedSecond.conceptId,'');assert.equal(observedSecond.reason,'other');
  assert.equal(observedSecond.subject,'english');assert.equal(observedSecond.gradeAtEntry,5);
 assert.deepEqual(observedSecond.reasonCandidates,['calculation','reading']);
 assert.equal(observedSecond.followupHistory.length,0);
 assert.equal(observedSecond.checkHistory.length,1);
 assert.match(observedSecond.checkHistory[0].memo,new RegExp(wrong008Day));
 assert.equal(observedSecond.studyPlan,null);
 assert.equal(observedFirst.generalRetryHistory.length,1);
 assert.equal(observedFirst.followupHistory.length,1);
 assert.equal(observedFirst.followupHistory[0].outcome,'explained');
 // Existing v06 review completion explicitly clears the active plan while
 // retaining its dated history; requiring dueDate here was a stale test oracle.
 assert.equal(observedFirst.studyPlan,null);
 assert.equal(observedFirst.followupHistory[0].workflowState,'completed_observation');
 assert.deepEqual(observed.photos,initial.photos);
 await B.reload({waitUntil:'domcontentloaded'});
 await B.locator('#nav-records').click();
 await B.locator('#records-list button[data-record="'+id+'"]').click();
 assert.match(await B.locator('#wrong002-state').innerText(),/학부모 관찰 1회/);
 pass('양쪽 브라우저 수동 교환 후 재접속: 오답ID·사진·복습·부모 관찰 모두 유지');

 // Sign-in tokens deliberately vanish on reload. Reconnect B (synthetic only),
 // edit local data without upload, then make the remote newer via parent.
 await B.locator('#nav-settings').click();
 await B.locator('#qa42-real-api:visible').waitFor();
 await connect(B,jwtB,FAMILY);
 await toDetail(B,id);
 await B.locator('#detail-edit').click();
 await B.locator('#memo').fill('WRONG004 가상: 기기에만 남은 미전송 메모');
 await B.locator('#save-btn').click();
 await B.locator('#v09-save-confirm:not(.hide)').waitFor();
 const unsynced=await stored(B);
 await A.locator('#nav-settings').click();
 // A still has valid QA42 token. Add another independently owned record.
 await A.locator('#nav-add').click();
 await A.locator('#problem').fill('WRONG004 부모의 별도 합성 오답: 10 + 1');
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor();
 await handoff(A);
 await push(A,4);
 assert.equal((await remote(FAMILY,jwtA)).body.revision,4);
 // After a local edit the app is on the record flow, not Settings. Navigate
 // through the actual UI before exercising the guarded manual import.
 await B.locator('#nav-settings').click();
 await B.locator('#qa42-real-api:visible').waitFor();
 await B.locator('#qa42-pull').click();
 await B.getByText('미전송·다른 가족 기록 또는 충돌 변경',{exact:false}).waitFor({timeout:25000});
 assert.deepEqual(await stored(B),unsynced);
 const count=await stored(B);assert.equal(count.records.length,2);
 await B.locator('#qa42-upload').click();
 await B.getByText('서버 최신본이 변경돼 원본 백업을 새로 만들지 않고 중단했습니다.',{exact:false}).waitFor();
 assert.deepEqual(await stored(B),unsynced);
 assert.equal((await remote(FAMILY,jwtA)).body.revision,4);
 pass('로컬 미전송 편집 + 서버 신규 오답 충돌 → 전체 복원 차단·CAS 업로드 차단·모든 원본 유지');

 await B.route('**/qa41/families/*/snapshot',r=>r.abort('internetdisconnected'));
 await B.locator('#qa42-pull').click();
 await B.getByText('가상 API 연결 오류.',{exact:false}).waitFor();
 assert.deepEqual(await stored(B),unsynced);
 await B.unroute('**/qa41/families/*/snapshot');
 pass('오프라인 GET 장애는 데이터 교체·자동 재시도 없이 중단');

 assert.equal(await C.locator('#qa42-target').inputValue(),'');
 assert.equal((await stored(C)).records.length,0);
 const outside=await otherCtx.newPage();
 await outside.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
 assert.equal(await outside.locator('#qa42-real-api').count(),0);
 assert.equal(await outside.locator('#wrong004-handoff').count(),0);
 assert.deepEqual(errors,[]);
 for(const [page,width] of [[A,390],[B,320]]){
  const {scroll,inner,offenders}=await page.evaluate(()=>{
   const inner=innerWidth,scroll=document.documentElement.scrollWidth;
   const offenders=Array.from(document.querySelectorAll('body *'))
    .filter(el=>{
     if(el.closest('.hide,[hidden]'))return false;
     const style=getComputedStyle(el);
     if(style.display==='none'||style.visibility==='hidden')return false;
     const rect=el.getBoundingClientRect();
     return rect.width>0&&(rect.right>inner+2||rect.left < -2)&&
      rect.right>0&&rect.left<inner;
    })
    .slice(0,15).map(el=>{
     const r=el.getBoundingClientRect();
     return {tag:el.tagName,id:el.id,classes:String(el.className).slice(0,60),
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
    });
   return {scroll,inner,offenders};
  });
  assert.ok(scroll<=inner+2,'horizontal overflow '+width+' actual scroll '+scroll+'/'+inner+' candidates '+JSON.stringify(offenders));
 }
 pass('다른 가족·비인가 origin·320/390px 모바일 넘침·브라우저 오류 없음');
 console.log('WRONG004_PARENT_CHILD_RESULT='+JSON.stringify({
  status:'PASS',checks,browsers:3,parentViewport:390,childViewport:320,
  syntheticSignedJwt:true,localPostgres:true,preservedId:id,photosByteEqual:true,
  safeOnConflict:true,offlineFailClosed:true,realChildren:0,realCloud:false,
  productionApproved:false,automatedSync:false
 }));
}catch(error){
 console.error('WRONG004_PARENT_CHILD_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1400)}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown();await dbApp.end();await admin.end()}
