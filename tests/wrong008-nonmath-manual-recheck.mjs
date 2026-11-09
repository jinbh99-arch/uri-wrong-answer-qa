// WRONG-008: actual app UI with synthetic non-math recheck date notes (no schema migration).
// No real child, account, production network or service; no automatic schedule/approval.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,checks=0;const pass=s=>{checks++;console.log('PASS WRONG008 '+s)};
const stable=obj=>JSON.stringify(obj,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function stored(page){
 return page.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  const read=req=>new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const t=db.transaction(['mistakes','photos'],'readonly');
   const [rows,keys,files]=await Promise.all([read(t.objectStore('mistakes').getAll()),read(t.objectStore('photos').getAllKeys()),read(t.objectStore('photos').getAll())]);
   return {records:rows.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(keys.map(async(id,i)=>({id,type:files[i].type,bytes:Array.from(new Uint8Array(await files[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
const find=(s,id)=>{const r=s.records.find(x=>x.id===id);assert.ok(r,'missing '+id);return r};
async function add(p,{title,subject='math',grade='3',concept='',photo=false,candidates=[]}){
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption(subject);
 await p.locator('#wrong007-grade').selectOption(grade);
 await p.locator('#problem').fill(title);
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'wrong008-only-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 if(subject==='math'&&concept)await p.locator('#concept').selectOption(concept);
 for(const x of candidates)await p.locator('#wrong006-candidates input[value="'+x+'"]').check();
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const snap=await stored(p),r=snap.records.find(x=>x.problemText===title);
 assert.ok(r);
 return r.id;
}
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong007-record-context:visible').waitFor({timeout:20000});
 // The detail page reads an attached photo asynchronously. Its context label
 // is not the readiness signal for the non-math manual note panel.
 const record=(await stored(p)).records.find(x=>x.id===id);
 if(record?.subject!=='math')await p.locator('#wrong008-next-review:visible').waitFor({timeout:20000});
}
async function plusDays(p,days){
 return p.evaluate(d=>{
  const x=new Date();x.setDate(x.getDate()+d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
 },days);
}
async function note(p,id,day,question){
 await detail(p,id);
 await p.locator('#wrong008-next-date').fill(day);
 await p.locator('#wrong008-next-question').fill(question);
 await p.locator('#wrong008-save-note').click();
 try{
  await p.waitForFunction(({day})=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),{day},{timeout:7000});
 }catch(e){
  const record=(await stored(p)).records.find(x=>x.id===id);
  const status=await p.locator('#wrong008-note-status').first().innerText().catch(()=>'(missing)');
  const note=await p.locator('#wrong008-last-manual-note').first().innerText().catch(()=>'(missing)');
  throw Error('WRONG008 date save diagnostic: '+JSON.stringify({day,status,note,history:record?.checkHistory,error:String(e)}));
 }
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [file]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.locator('#export-json').click()]);
 return readFile(await file.path());
}
async function restore(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'wrong008-only-synthetic.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:30000});
}

try{
 browser=await chromium.launch({headless:true});
 const ac=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const bc=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const A=await ac.newPage(),B=await bc.newPage(),pageErrors=[];
 for(const p of [A,B])p.on('pageerror',e=>pageErrors.push(String(e)));
 await A.goto(BASE,{waitUntil:'domcontentloaded'});
 const mathId=await add(A,{title:'WRONG008 구형 수학 3 + 4',concept:'math.natural.addition',grade:'4',photo:true});
 const koreanId=await add(A,{title:'WRONG008 국어 글 속 주장 다시 설명',subject:'korean',grade:'3',photo:true,candidates:['reading','concept']});
 const englishId=await add(A,{title:'WRONG008 영어에서도 1/4 + 1/6 수식을 정답 계산하지 않음',subject:'english',grade:'5',candidates:['reading']});
 const scienceId=await add(A,{title:'WRONG008 과학 실험 설명 재확인',subject:'science',grade:'6'});
 const socialId=await add(A,{title:'WRONG008 사회 지도 읽기',subject:'social',grade:'4'});
 const initial=await stored(A);
 assert.equal(initial.records.length,5);
 assert.equal(initial.photos.length,2);
 for(const id of [koreanId,englishId,scienceId,socialId]){
  assert.equal(find(initial,id).conceptId,'');
  assert.equal(find(initial,id).studyPlan,null);
  assert.deepEqual(find(initial,id).followupHistory,[]);
 }
 assert.equal(find(initial,mathId).conceptId,'math.natural.addition');
 pass('기존 수학·국어·영어·과학·사회 오답 5ID/사진2장/기존 후보 및 수학 전용 필드 불변');

 await detail(A,koreanId);
 assert.equal(await A.locator('#wrong008-next-review').isVisible(),true);
 assert.equal(await A.locator('#wrong008-next-date').count(),0);
 assert.match(await A.locator('#wrong008-next-review').innerText(),/먼저 위쪽에서 아이가/);
 assert.equal((await stored(A)).records.find(r=>r.id===koreanId).checkHistory.length,0);
 pass('일반 재풀이 전에는 날짜만 먼저 저장하거나 완료로 표시하지 않음');

 await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('중심 문장은 친구와 약속을 지켜야 한다는 뜻');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 assert.equal(await A.locator('#wrong008-next-date').isVisible(),true);
 assert.equal(await A.locator('#wrong008-jump-note').isVisible(),true);
 const date1=await plusDays(A,3),date2=await plusDays(A,7);
 await A.locator('#v230-review').selectOption('needs_help');
 await A.locator('#v230-review-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong008-next-review')?.textContent?.includes('부모 도움이 필요했다고 기록'),null,{timeout:25000});
 let observed=await stored(A);
 assert.equal(find(observed,koreanId).generalRetryHistory.at(-1).review,'needs_help');
 assert.equal(find(observed,koreanId).checkHistory.length,0);
 pass('비수학 일반 재풀이와 실제 부모 관찰은 기존 generalRetryHistory에 따로 기록');

 await A.locator('#wrong008-jump-note').click();
 assert.equal(await A.evaluate(()=>document.activeElement?.id),'wrong008-next-date');
 await A.locator('#wrong008-next-date').fill('2025-02-28');
 // Invalid calendar date: no new record, no silent normalization.
 await A.locator('#wrong008-save-note').click();
 assert.equal(find(await stored(A),koreanId).checkHistory.length,0);
 assert.match(await A.locator('#wrong008-note-status').innerText(),/올바른 날짜/);
 pass('불가능·과거 날짜의 수동 확인 예정 저장 거절, 기존 관찰/오답 무변경');

 await note(A,koreanId,date1,'다음에는 이유를 자기 말로 설명하기');
 let scheduled=await stored(A),korean=find(scheduled,koreanId);
 assert.equal(korean.checkHistory.length,1);
 assert.equal(korean.checkHistory[0].status,'not_checked');
 assert.equal(korean.checkHistory[0].by,'parent_observation');
 assert.match(korean.checkHistory[0].memo,new RegExp('^다음 확인 메모: '+date1));
 assert.deepEqual(Object.keys(korean.checkHistory[0]).sort(),['at','by','memo','status']);
 assert.equal(korean.generalRetryHistory.at(-1).review,'needs_help');
 assert.deepEqual(scheduled.photos,initial.photos);
 assert.deepEqual(find(scheduled,mathId),find(initial,mathId));
 assert.deepEqual(find(scheduled,englishId),find(initial,englishId));
 assert.match(await A.locator('#wrong008-last-manual-note').innerText(),/아직 확인 전/);
 assert.match(await A.locator('#wrong002-state').innerText(),/학부모 관찰 0회/);
 pass('다음 날짜는 기존 checkHistory 4키의 not_checked 수동 메모, 실제 관찰/사진/타 과목과 분리');

 await detail(A,koreanId);
 await A.locator('#check-status').selectOption('explained');
 await A.locator('#check-memo').fill('실제 다시 읽기를 확인한 것이 아니라, 지금 관찰한 글 이해 설명만 기록');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 let afterObserved=await stored(A);
 const observedHistory=find(afterObserved,koreanId).checkHistory;
 assert.equal(observedHistory.length,2);
 assert.equal(observedHistory[0].status,'not_checked');assert.equal(observedHistory[1].status,'explained');
 assert.match(await A.locator('#wrong008-last-manual-note').innerText(),new RegExp(date1));
 assert.match(await A.locator('#check-history').innerText(),/다음 확인 수동 메모/);
 pass('기존 직접 관찰 저장으로 별도 실측 이력 추가; 예정 메모를 자동 완료로 승격하지 않음');

 await note(A,koreanId,date2,'질문을 바꿔 다시 듣기');
 let afterSecond=await stored(A),row=find(afterSecond,koreanId);
 assert.equal(row.checkHistory.length,3);
 assert.match(row.checkHistory[2].memo,new RegExp(date2));
 assert.match(await A.locator('#wrong008-last-manual-note').innerText(),new RegExp(date2));
 assert.match(await A.locator('#wrong002-state').innerText(),/학부모 관찰 1회/);
 pass('날짜 수정은 이전 기록을 지우지 않는 새 수동 메모, 최근 메모만 화면에 안내');

 await A.locator('#wrong002-report').click();
 const model=await A.locator('#v227-evidence').innerText();
 assert.match(model,/학부모/);
 const report=await A.locator('#v227-parent-report').innerText();
 assert.match(report,/다음 확인 수동 메모/);
 assert.match(report,/학부모 관찰 기록/);
 const actualCount=await A.locator('#v227-metrics .v29-stat').last().innerText();
 assert.match(actualCount,/2/); // one review in generalRetry, one direct check; two schedule notes excluded
 pass('학부모 기간 보고서: 실제 관찰 2건과 수동 확인 예정 2건 분리, 자동 완료·효과 판정 없음');

 const before=await stored(A),bytes=await backup(A),json=JSON.parse(bytes.toString());
 assert.equal(json.records.length,5);assert.equal(Object.keys(json.photos).length,2);
 const backed=json.records.find(r=>r.id===koreanId);
 assert.equal(backed.checkHistory.length,3);
 assert.deepEqual(Object.keys(backed.checkHistory[0]).sort(),['at','by','memo','status']);
 await B.goto(BASE,{waitUntil:'domcontentloaded'});
 await restore(B,bytes);
 assert.equal(stable(await stored(B)),stable(before));
 await detail(B,koreanId);
 assert.match(await B.locator('#wrong008-last-manual-note').innerText(),new RegExp(date2));
 await B.reload({waitUntil:'domcontentloaded'});
 assert.equal(stable(await stored(B)),stable(before));
 pass('수학/비수학 5ID·사진 바이트·원인·재풀이·수동 날짜 메모, 구형 JSON 형식 그대로 320px 타 브라우저 복원·새로고침');

 await detail(B,mathId);
 assert.equal(await B.locator('#wrong008-next-review').count(),0);
 assert.equal(await B.locator('#detail-concept').isVisible(),true);
 await detail(B,englishId);
 assert.equal(await B.locator('#wrong008-next-date').count(),0);
 assert.equal(await B.locator('#v25-learning-flow .v25-learning').count(),0);
 assert.equal(await B.locator('#v230-answer').isVisible(),true);
 await B.locator('#v218-child-mode').click();
 assert.equal(await B.locator('#wrong008-jump-note').count(),0); // no attempt yet
 assert.equal(await B.locator('#wrong002-retry').isVisible(),true);
 for(const [p,width] of [[A,390],[B,320]]){
  const info=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(info.scroll<=info.w+2,width+'px horizontal overflow '+JSON.stringify(info));
 }
 assert.deepEqual(pageErrors,[]);
 pass('기존 수학 학습·비수학 일반 재풀이·부모보기 경계/320·390px 미넘침, 페이지 에러 없음');

 console.log('WRONG008_NONMATH_MANUAL_RESULT='+JSON.stringify({status:'PASS',checks,records:5,nonmathSubjects:4,parentViewport:390,childViewport:320,photosByteEqual:true,originalIdsKept:true,contractFieldsAdded:0,autoSchedule:false,realChildren:0,realCloud:false,productionApproved:false}));
}catch(e){console.error('WRONG008_NONMATH_MANUAL_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,2400)}));process.exitCode=1}
finally{await browser?.close()}
