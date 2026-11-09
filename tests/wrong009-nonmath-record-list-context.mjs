// WRONG-009: reproducible non-math subject/status filter confusion in real app.
// Synthetic data and Chromium 390/320px only; no user credentials/production service.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const SUBS=['math','korean','english','science','social'];
let browser,checks=0;const pass=s=>{checks++;console.log('PASS WRONG009 '+s)};
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function stored(p){return p.evaluate(async name=>{
 const req=indexedDB.open(name),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
 const read=q=>new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 try{const tx=db.transaction(['mistakes','photos'],'readonly');
 const [records,ids,photos]=await Promise.all([read(tx.objectStore('mistakes').getAll()),read(tx.objectStore('photos').getAllKeys()),read(tx.objectStore('photos').getAll())]);
 return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),photos:await Promise.all(ids.map(async(id,i)=>({id,type:photos[i].type,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))})))};
 }finally{db.close()}
},DB)}
async function add(p,subject,title,{grade='3',mathConcept='',photo=false,reasons=[]}={}){
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption(subject);
 await p.locator('#wrong007-grade').selectOption(grade);
 await p.locator('#problem').fill(title);
 if(photo){await p.locator('#choose-photo').setInputFiles({name:'wrong009-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'))}
 if(mathConcept)await p.locator('#concept').selectOption(mathConcept);
 for(const code of reasons)await p.locator('#wrong006-candidates input[value="'+code+'"]').check();
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const row=(await stored(p)).records.find(r=>r.problemText===title);assert.ok(row);return row.id;
}
async function addMathPhotoOnly(p){
 const before=await stored(p),ids=new Set(before.records.map(r=>r.id));
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption('math');
 await p.locator('#choose-photo').setInputFiles({name:'wrong009-synthetic-photo.png',mimeType:'image/png',buffer:PNG});
 await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await p.locator('#v08-photo-save').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const row=(await stored(p)).records.filter(r=>!ids.has(r.id));
 assert.equal(row.length,1);assert.equal(row[0].subject,'math');
 assert.equal(row[0].problemText,'');assert.equal(row[0].hasPhoto,true);
 return row[0].id;
}
async function list(p,subject,status='all'){
 await p.locator('#nav-records').click();
 await p.locator('#wrong007-filter-subject').selectOption(subject);
 await p.locator('#v11-filter-status').selectOption(status);
 return p.locator('#records-list button[data-record]').evaluateAll(els=>els.map(el=>el.dataset.record));
}
async function detail(p,id){
 // Explicitly clear filters before navigating by record ID.
 await list(p,'','all');
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong007-record-context:visible').waitFor();
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:25000}),p.locator('#export-json').click()]);
 return readFile(await dl.path());
}
async function restore(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'wrong009-synthetic.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor();
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:30000});
}
async function noOverflow(p){
 const x=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.w+2,'mobile overflow '+JSON.stringify(x));
}
try{
 browser=await chromium.launch({headless:true});
 const A=await (await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true})).newPage();
 const B=await (await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true})).newPage();
 const errors=[];for(const p of [A,B])p.on('pageerror',e=>errors.push(String(e)));
 await A.goto(BASE,{waitUntil:'domcontentloaded'});
 const mathPhotoId=await addMathPhotoOnly(A);
 const mathId=await add(A,'math','WRONG009 가상 수학 덧셈',{grade:'4',mathConcept:'math.natural.addition'});
 const koreanId=await add(A,'korean','WRONG009 국어 문단 중심 내용',{grade:'3',photo:true,reasons:['reading','concept']});
 const englishId=await add(A,'english','WRONG009 영어 단어 뜻',{grade:'5',reasons:['reading']});
 const scienceId=await add(A,'science','WRONG009 과학 실험 설명',{grade:'6'});
 const socialId=await add(A,'social','WRONG009 사회 지도 해석',{grade:'2'});
 const ids={math:mathId,korean:koreanId,english:englishId,science:scienceId,social:socialId};
 const first=await stored(A);
 assert.equal(first.records.length,6);assert.equal(first.photos.length,2);
 assert.deepEqual(first.records.find(r=>r.id===koreanId).reasonCandidates,['reading','concept']);
 pass('가상 5과목 6건(수학 사진만1·수학 개념1·국어 사진1·영어/과학/사회) 저장, 원인 후보/사진 무결성');

 // Source regression: previously v11's photo/text overlay omitted the subject.
 for(const [name,id] of Object.entries(ids)){
  const found=await list(A,name,'text_ready');
  assert.deepEqual(found,[id],name+' status=text_ready must not show other subjects');
  assert.equal(await A.locator('#wrong007-filter-subject').inputValue(),name);
 }
 pass('390px 과목 5개 각각 문제 내용 있음 필터에서도 자기 과목 오답만 1건');

 for(const name of SUBS){
  const found=await list(A,name,'photo_only');
  assert.deepEqual(found,name==='math'?[mathPhotoId]:[],name+' status=photo_only must obey subject');
 }
 pass('390px 과목 5개 각각 사진만 저장 상태도 과목과 동시 적용: 비수학에 수학 사진 오답 노출 0');

 await list(A,'math','all');
 await A.locator('#filter-concept').selectOption('math.natural.addition');
 assert.deepEqual(await A.locator('#records-list button[data-record]').evaluateAll(els=>els.map(el=>el.dataset.record)),[mathId]);
 await A.locator('#wrong007-filter-subject').selectOption('korean');
 assert.equal(await A.locator('#filter-concept').inputValue(),'','subject change must reset stale math-only concept filter');
 assert.equal(await A.locator('#filter-concept').isVisible(),false);
 assert.equal(await A.locator('#concept-counts').isVisible(),false);
 assert.deepEqual(await A.locator('#records-list button[data-record]').evaluateAll(els=>els.map(el=>el.dataset.record)),[koreanId]);
 pass('수학 개념 필터를 켠 뒤 국어 전환: 수학 전용 입력/집계 숨김·낡은 개념 조건 초기화·국어 1건 유지');

 await A.locator('#wrong007-filter-subject').selectOption('english');
 assert.equal(await A.locator('#filter-concept').isVisible(),false);
 await A.locator('#wrong007-filter-subject').selectOption('math');
 assert.equal(await A.locator('#filter-concept').isVisible(),true);
 assert.equal(await A.locator('#concept-counts').isVisible(),true);
 assert.equal(await A.locator('#filter-concept').inputValue(),'');
 await A.locator('#wrong007-filter-subject').selectOption('');
 assert.equal(await A.locator('#records-list button[data-record]').count(),6);
 pass('수학/전체로 돌아가면 기존 수학 개념 필터 복귀, 6개 기록 누락 없음');

 // Existing learning flows, parent check, and non-math manual date keep their contracts.
 await detail(A,koreanId);
 assert.equal(await A.locator('#detail-concept').isVisible(),false);
 assert.equal(await A.locator('#v230-answer').isVisible(),true);
 await A.locator('#v230-answer').fill('가상 국어 재풀이 설명');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await A.locator('#v230-review').selectOption('needs_help');
 await A.locator('#v230-review-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong008-next-review')?.textContent?.includes('부모 도움이 필요했다고 기록'),null,{timeout:25000});
 const day=await A.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+4);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')});
 await A.locator('#wrong008-next-date').fill(day);
 await A.locator('#wrong008-save-note').click();
 await A.waitForFunction(day=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes(day),day,{timeout:25000});
 await A.locator('#check-status').selectOption('explained');
 await A.locator('#check-memo').fill('가상 국어 독립 학부모 관찰');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 const row=(await stored(A)).records.find(r=>r.id===koreanId);
 assert.equal(row.checkHistory.length,2);assert.equal(row.generalRetryHistory.at(-1).review,'needs_help');
 assert.equal(row.checkHistory[0].status,'not_checked');assert.equal(row.checkHistory[1].status,'explained');
 pass('기존 국어 재풀이→부모 실제 관찰→다음 확인 수동 메모/재관찰 및 수학 개념 숨김 불변');

 await A.locator('#wrong002-report').click();
 assert.match(await A.locator('#v227-parent-report').innerText(),/다음 확인 수동 메모/);
 const before=await stored(A),bytes=await backup(A);
 await B.goto(BASE,{waitUntil:'domcontentloaded'});await restore(B,bytes);
 assert.equal(stable(await stored(B)),stable(before));
 await B.reload({waitUntil:'domcontentloaded'});assert.equal(stable(await stored(B)),stable(before));
 pass('오답 6ID/수학 사진·국어 사진 바이트·원인후보·부모 관찰·날짜 메모, 기존 JSON 전체 백업/320px 복원 재접속');

 for(const [name,id] of Object.entries(ids)){
  assert.deepEqual(await list(B,name,'text_ready'),[id],name+' child 320px');
  assert.deepEqual(await list(B,name,'photo_only'),name==='math'?[mathPhotoId]:[]);
  assert.equal(await B.locator('#filter-concept').isVisible(),name==='math');
  await noOverflow(B);
 }
 await B.locator('#v218-child-mode').click();
 await detail(B,koreanId);
 // The detail photo read and subsequent WRONG-002 action wrapper are async.
 // Wait for the actual child retry CTA, not only the earlier context label.
 await B.locator('#wrong002-retry:visible').waitFor({timeout:25000});
 assert.equal(await B.locator('#wrong002-retry').isVisible(),true);
 assert.equal(await B.locator('#wrong002-plan').isVisible(),false);
 assert.equal(await B.locator('#wrong008-next-review').isVisible(),false);
 await noOverflow(B);await noOverflow(A);
 assert.deepEqual(errors,[]);
 pass('320px 5과목 × 2개 정리상태 실제 필터/아이·부모 모드/가로 넘침/JS 오류 없음');

 console.log('WRONG009_NONMATH_FILTER_RESULT='+JSON.stringify({status:'PASS',checks,subjects:5,records:6,photos:2,parentViewport:390,childViewport:320,mathOnlyConceptHiddenNonmath:true,noRecordMutationOnFilter:true,legacyPhotoBytesPreserved:true,realChildren:0,realCloud:false,productionApproved:false}));
}catch(e){console.error('WRONG009_NONMATH_FILTER_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,2300)}));process.exitCode=1}
finally{await browser?.close()}
