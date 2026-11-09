// WRONG-007: existing app per-record grade/subject, photo, retry and family-safe backups.
// All data synthetic; no cloud, operating Netlify/Supabase, child or guardian account.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let checks=0,browser;const pass=n=>{checks++;console.log('PASS WRONG007 '+n)};
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function stored(p){
 return p.evaluate(async name=>{
  const r=indexedDB.open(name),db=await new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error)});
  const read=q=>new Promise((a,b)=>{q.onsuccess=()=>a(q.result);q.onerror=()=>b(q.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const [records,keys,blobs]=await Promise.all([read(tx.objectStore('mistakes').getAll()),read(tx.objectStore('photos').getAllKeys()),read(tx.objectStore('photos').getAll())]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(keys.map(async(id,i)=>({id,mime:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
function pick(x,id){const found=x.records.find(r=>r.id===id);assert.ok(found,'record not found '+id);return found}
async function add(p,{title,subject='math',grade='3',concept='',photo=false,reasons=[]}){
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption(subject);
 await p.locator('#wrong007-grade').selectOption(grade);
 await p.locator('#problem').fill(title);
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'wrong007-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 if(subject==='math')await p.locator('#concept').selectOption(concept);
 for(const candidate of reasons)await p.locator('#wrong006-candidates input[value="'+candidate+'"]').check();
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const x=await stored(p),r=x.records.find(r=>r.problemText===title);assert.ok(r);return r.id;
}
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong007-record-context:visible').waitFor({timeout:20000});
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:25000}),p.locator('#export-json').click()]);
 return await readFile(await download.path());
}
async function restore(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'wrong007-synthetic.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
}
try{
 browser=await chromium.launch({headless:true});
 const pctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const cctx=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const A=await pctx.newPage(),B=await cctx.newPage(),errors=[];
 for(const p of [A,B])p.on('pageerror',e=>errors.push(String(e)));
 await A.goto(BASE,{waitUntil:'domcontentloaded'});
 const mathId=await add(A,{title:'WRONG007 구형 수학 오답 1/2 + 1/3',grade:'4',subject:'math',concept:'math.fraction.add.diff_den',photo:true});
 const koreanId=await add(A,{title:'WRONG007 국어 문장을 다시 읽고 설명하기',grade:'2',subject:'korean',photo:true,reasons:['reading','concept']});
 const englishId=await add(A,{title:'WRONG007 영어 단어 의미를 다시 써 보기',grade:'6',subject:'english',reasons:['reading']});
 let first=await stored(A);assert.equal(first.records.length,3);assert.equal(first.photos.length,2);
 assert.equal(pick(first,mathId).subject,'math');assert.equal(pick(first,mathId).gradeAtEntry,4);
 assert.equal(pick(first,koreanId).subject,'korean');assert.equal(pick(first,koreanId).gradeAtEntry,2);
 assert.equal(pick(first,koreanId).conceptId,'');assert.equal(pick(first,koreanId).reason,'other');
 assert.deepEqual(pick(first,koreanId).reasonCandidates,['reading','concept']);
 assert.equal(pick(first,englishId).subject,'english');assert.equal(pick(first,englishId).gradeAtEntry,6);
 assert.deepEqual(pick(first,englishId).reasonCandidates,['reading']);
 pass('기존 수학 + 신규 국어/영어에 다른 학년과 사진·복수 후보를 동일 저장소에 독립 등록');

 await detail(A,koreanId);
 assert.match(await A.locator('#wrong007-record-context').innerText(),/국어 · 초등 2학년/);
 assert.equal(await A.locator('#detail-concept').isVisible(),false);
 assert.equal(await A.locator('#v11-detail-candidate').count(),0);
 assert.equal(await A.locator('#v05-followup').count(),0);
 assert.equal(await A.locator('#v06-review-cycle').count(),0);
 assert.equal(await A.locator('#v25-learning-flow #v230-answer').isVisible(),true);
 assert.equal(await A.locator('#v25-learning-flow .v25-learning').count(),0);
 assert.match(await A.locator('#detail-learning-aid').innerText(),/수학 개념/);
 await A.locator('#wrong002-plan').click();
 assert.equal(await A.evaluate(()=>document.activeElement?.id),'check-status');
 pass('국어 상세에서 수학 개념/성취기준/시범 풀이/수학 계획 미적용; 직접 관찰 연결');

 await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('가상 재풀이: 글의 중심 문장을 설명함');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await A.locator('#check-status').selectOption('needs_help');
 await A.locator('#check-memo').fill('가상 학부모 관찰: 읽기 도움 필요');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 let learned=await stored(A);
 assert.equal(pick(learned,koreanId).generalRetryHistory.length,1);
 assert.equal(pick(learned,koreanId).checkHistory[0].status,'needs_help');
 assert.deepEqual(pick(learned,koreanId).reasonCandidates,['reading','concept']);
 assert.deepEqual(learned.photos,first.photos);
 pass('비수학도 같은 오답 ID로 일반 재풀이·학부모 관찰, 후보/사진/타과목 불변');

 await detail(A,koreanId);
 await A.locator('#detail-edit').click();
 assert.equal(await A.locator('#wrong007-subject').inputValue(),'korean');
 assert.equal(await A.locator('#wrong007-grade').inputValue(),'2');
 assert.equal(await A.locator('#wrong007-math-fields').isVisible(),false);
 await A.locator('#wrong007-grade').selectOption('3');
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const revised=await stored(A);
 assert.equal(pick(revised,koreanId).gradeAtEntry,3);
 assert.equal(pick(revised,koreanId).subject,'korean');
 assert.equal(pick(revised,koreanId).checkHistory.length,1);
 assert.equal(pick(revised,koreanId).generalRetryHistory.length,1);
 assert.deepEqual(revised.photos,first.photos);
 assert.deepEqual(pick(revised,englishId),pick(learned,englishId));
 pass('국어 학년 직접 수정은 동일 ID 및 복수 후보·이력·사진 보존, 다른 과목은 불변');

 await detail(A,mathId);
 await A.locator('#wrong002-retry').click();
 // The math pilot may be a special math lesson. Use the parent observation
 // to attach historical evidence before attempting a cross-subject rewrite.
 await A.locator('#check-status').selectOption('explained');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 await detail(A,mathId);
 await A.locator('#detail-edit').click();
 await A.locator('#wrong007-subject').selectOption('english');
 await A.locator('#save-btn').click();
 await A.locator('#form-error:not(.hide)').waitFor({timeout:20000});
 assert.match(await A.locator('#form-error').innerText(),/과목 변경/);
 const blocked=await stored(A);
 assert.equal(pick(blocked,mathId).subject,'math');assert.equal(pick(blocked,mathId).gradeAtEntry,4);
 assert.deepEqual(blocked.photos,first.photos);
 await A.locator('#cancel-edit').click();
 await A.locator('#confirm-dialog[open]').waitFor({timeout:10000});
 await A.locator('#dlg-ok').click(); // explicit discard of the unsaved subject edit
 pass('기존 수학 개념·부모 관찰이 있는 오답을 영어로 변경하면 무손실 사전 차단');

 await A.locator('#nav-records').click();
 await A.locator('#wrong007-filter-subject').selectOption('korean');
 assert.match(await A.locator('#records-count').innerText(),/1건 표시/);
 assert.equal(await A.locator('#records-list button.item').count(),1);
 await A.locator('#wrong007-filter-subject').selectOption('english');
 assert.equal(await A.locator('#records-list button.item').count(),1);
 await A.locator('#wrong007-filter-subject').selectOption('');
 assert.equal(await A.locator('#records-list button.item').count(),3);
 await detail(A,koreanId);
 await A.locator('#wrong002-report').click();
 assert.equal(await A.locator('#v227-parent-report').isVisible(),true);
 const semantic=await A.locator('.wrong005-report-semantic[data-record-id="'+koreanId+'"]').first().innerText();
 assert.match(semantic,/과목: 국어/);assert.match(semantic,/초등 3학년/);
 assert.match(semantic,/복수 후보 2개/);assert.match(semantic,/복습 후 학부모 관찰/);
 assert.doesNotMatch(semantic,/확정된 원인|정답률/);
 pass('과목 필터 및 학부모 보고서: 현재 과목/학년·미확정 원인·직접 관찰 분리');

 const before=await stored(A),bytes=await backup(A),original=JSON.parse(bytes.toString());
 assert.equal(original.records.length,3);assert.equal(Object.keys(original.photos).length,2);
 assert.equal(original.records.find(r=>r.id===koreanId).gradeAtEntry,3);
 await B.goto(BASE,{waitUntil:'domcontentloaded'});
 await restore(B,bytes);
 assert.equal(canonical(await stored(B)),canonical(before));
 await detail(B,englishId);
 assert.match(await B.locator('#wrong007-record-context').innerText(),/영어 · 초등 6학년/);
 assert.equal(await B.locator('#v05-followup').count(),0);
 await B.reload({waitUntil:'domcontentloaded'});
 assert.equal(canonical(await stored(B)),canonical(before));
 pass('사진 2장 포함 수학/국어/영어 3ID 완전 JSON 복원→320px 타 브라우저 재접속 동일 바이트');

 for(const mutate of [row=>{row.subject='unsupported-subject'},row=>{row.gradeAtEntry=8},row=>{row.conceptId='math.unit.fraction'}]){
  const payload=structuredClone(original),target=payload.records.find(r=>r.id===koreanId);
  mutate(target);
  const beforeInvalid=await stored(B);
  await B.locator('#nav-settings').click();
  await B.locator('#import-file').setInputFiles({name:'wrong007-invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  assert.equal(await B.locator('#confirm-dialog[open]').count(),0);
  assert.equal(canonical(await stored(B)),canonical(beforeInvalid));
 }
 pass('미지원 과목·범위 외 학년·비수학 수학 개념이 섞인 백업을 원본 교체 전 차단');

 await detail(B,mathId);
 assert.match(await B.locator('#wrong007-record-context').innerText(),/수학 · 초등 4학년/);
 assert.equal(await B.locator('#detail-concept').isVisible(),true);
 await detail(B,koreanId);
 await B.locator('#v218-child-mode').click();
 assert.equal(await B.locator('#wrong002-plan').isVisible(),false);
 assert.equal(await B.locator('#wrong002-retry').isVisible(),true);
 for(const [p,w] of [[A,390],[B,320]]){
  const d=await p.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(d.scroll<=d.inner+2,'horizontal overflow '+w+': '+JSON.stringify(d));
 }
 assert.deepEqual(errors,[]);
 pass('수학 기존 화면 유지·비수학 아이 재풀이·부모 기능 숨김 및 320/390px 오류·넘침 없음');
 console.log('WRONG007_GRADE_SUBJECT_RESULT='+JSON.stringify({status:'PASS',checks,records:3,subjects:['math','korean','english'],grades:[4,3,6],parentViewport:390,childViewport:320,photosByteEqual:true,legacyIdsKept:true,mathOnlyConceptGuard:true,realChildren:0,realCloud:false,productionApproved:false}));
}catch(e){console.error('WRONG007_GRADE_SUBJECT_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1500)}));process.exitCode=1}
finally{if(browser)await browser.close()}
