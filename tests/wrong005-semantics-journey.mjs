// WRONG-005: synthetic 3-record concept/reason/observation semantics through
// actual app CRUD, picture, JSON backup/restore, retry, review, report and reload.
// Never real child data, hosted cloud credentials or production services.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let checks=0,browser;
function pass(name){checks++;console.log('PASS WRONG005 '+name)}
async function stored(p){
 return p.evaluate(async name=>{
  const open=indexedDB.open(name),db=await new Promise((ok,bad)=>{open.onsuccess=()=>ok(open.result);open.onerror=()=>bad(open.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const req=q=>new Promise((ok,bad)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
   const [rows,keys,blobs]=await Promise.all([req(tx.objectStore('mistakes').getAll()),req(tx.objectStore('photos').getAllKeys()),req(tx.objectStore('photos').getAll())]);
   return {rows:rows.sort((a,b)=>a.id.localeCompare(b.id)),
     photos:await Promise.all(keys.map(async(id,i)=>({id,mime:blobs[i].type,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB)
}
const row=(state,id)=>{const result=state.rows.find(r=>r.id===id);assert.ok(result,'missing '+id);return result};
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong005-semantic-separation:visible').waitFor();
}
async function add(p,{problem,concept='',reason='unknown',memo='',photo=false}){
 await p.locator('#nav-add').click();
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'wrong005-fake.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#problem').fill(problem);
 await p.locator('#concept').selectOption(concept);
 await p.locator('#reason').selectOption(reason);
 if(memo)await p.locator('#memo').fill(memo);
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const snap=await stored(p),found=snap.rows.find(r=>r.problemText===problem);
 assert.ok(found);return found.id;
}
async function restore(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'wrong005-synthetic-backup.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
}
async function dimensions(p,width){
 const x=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(x.scroll<=x.viewport+2,'horizontal overflow '+width+' '+JSON.stringify(x));
}
try{
 browser=await chromium.launch({headless:true});
 const parent=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const child=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const A=await parent.newPage(),B=await child.newPage(),errors=[];
 A.on('pageerror',e=>errors.push(String(e)));B.on('pageerror',e=>errors.push(String(e)));
 await A.goto(BASE,{waitUntil:'domcontentloaded'});
 const idA=await add(A,{problem:'WRONG005 A 사진 가상: 3+4',concept:'math.natural.addition',reason:'unknown',photo:true});
 const idB=await add(A,{problem:'WRONG005 B 개념 미확인 가상',reason:'reading'});
 const idC=await add(A,{problem:'WRONG005 C 복수 가능 이유 가상',concept:'math.natural.addition',reason:'other',memo:'가상 추정 후보: 계산 단계 또는 문장 읽기. 아직 확인 전.'});
 let base=await stored(A);
 assert.equal(base.rows.length,3);assert.equal(base.photos.length,1);
 assert.equal(row(base,idA).reason,'unknown');assert.equal(row(base,idB).conceptId,'');
 assert.equal(row(base,idC).reason,'other');assert.match(row(base,idC).memo,/계산 단계 또는 문장 읽기/);
 await A.locator('#nav-records').click();
 assert.match(await A.locator('#concept-counts').innerText(),/2건/);
 assert.match(await A.locator('#concept-counts').innerText(),/미분류/);
 pass('3개 다른 ID의 개념 분류·원인 미확인·복수 후보 메모와 개념별 등록 건수 분리');

 await detail(A,idA);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/문제 관련 개념/);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/틀린 이유 후보/);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/복습 후 학부모 관찰/);
 await A.locator('#detail-edit').click();
 assert.equal(await A.locator('#edit-id').inputValue(),idA);
 assert.equal(await A.locator('#reason').inputValue(),'unknown');
 await A.locator('#problem').fill('WRONG005 A 사진과 개념 유지한 문제수정 3+4');
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 let edited=await stored(A);
 assert.equal(edited.rows.length,3);assert.deepEqual(edited.photos,base.photos);
 assert.equal(row(edited,idA).reason,'unknown');assert.equal(row(edited,idA).conceptId,'math.natural.addition');
 assert.deepEqual(row(edited,idB),row(base,idB));assert.deepEqual(row(edited,idC),row(base,idC));
 pass('동일 사진 오답 ID의 텍스트 수정에도 사진 바이트·원인·개념·다른 오답 불변');

 await A.locator('#check-status').selectOption('explained');
 await A.locator('#check-memo').fill('가상 학부모 직접 확인: 설명 성공, 원인 후보는 계속 미확정');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong005-semantic-separation')?.textContent?.includes('오답 확인 1회'));
 await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('7');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await A.locator('#wrong002-plan').click();
 await A.locator('#v05-plan-date').fill('2026-11-18');
 await A.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('2026-11-18'));
 await A.locator('#wrong002-outcome').click();
 await A.locator('#v06-review-outcome').selectOption('needs_help');
 await A.locator('#v06-review-memo').fill('가상 복습 뒤 별도 관찰: 도움이 필요함');
 await A.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 2회'));
 const learned=await stored(A),a=row(learned,idA);
 assert.equal(a.conceptId,'math.natural.addition');assert.equal(a.reason,'unknown');
 assert.equal(a.checkHistory.length,1);assert.equal(a.checkHistory[0].status,'explained');
 assert.equal(a.followupHistory.length,1);assert.equal(a.followupHistory[0].outcome,'needs_help');
 assert.equal(a.generalRetryHistory.length,1);assert.equal(a.studyPlan,null);
 assert.deepEqual(row(learned,idB),row(base,idB));assert.deepEqual(row(learned,idC),row(base,idC));
 assert.deepEqual(learned.photos,base.photos);
 pass('실제 재풀이·부모의 서로 다른 두 관찰이 추정 원인 필드/타 오답/사진에 영향 없음');

 await detail(A,idB);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/미분류/);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/문제 해석/);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/오답 확인 0회/);
 await detail(A,idC);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/메모/);
 await A.locator('#wrong002-report').click();
 assert.equal(await A.locator('#v227-parent-report').isVisible(),true);
 assert.ok(await A.locator('.wrong005-report-semantic[data-record-id="'+idA+'"]').count()>0);
 const report=await A.locator('.wrong005-report-semantic[data-record-id="'+idA+'"]').first().innerText();
 assert.match(report,/개념/);assert.match(report,/원인/);assert.match(report,/관찰/);
 assert.doesNotMatch(report,/오답률|정확한 원인|실력 확정/);
 pass('상세 3정보 구분 및 부모 보고서의 동일 ID 분류/추정/관찰 현황 분리');

 await A.locator('#nav-settings').click();
 const [download]=await Promise.all([A.waitForEvent('download',{timeout:25000}),A.locator('#export-json').click()]);
 const bytes=await readFile(await download.path()),doc=JSON.parse(bytes.toString());
 assert.equal(doc.records.length,3);assert.equal(Object.keys(doc.photos).length,1);
 assert.equal(doc.records.find(r=>r.id===idA).reason,'unknown');
 assert.equal(doc.records.find(r=>r.id===idA).followupHistory[0].outcome,'needs_help');
 assert.equal(doc.records.find(r=>r.id===idC).reason,'other');
 pass('기존 완전 JSON 백업: 3ID·추정·복습 확인·원본 사진 1장 포함');

 await A.locator('#clear-all').click();
 await A.locator('#confirm-dialog[open]').waitFor();await A.locator('#dlg-ok').click();
 await A.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0');
 assert.equal((await stored(A)).rows.length,0);
 await restore(A,bytes);
 const restored=await stored(A);
 assert.deepEqual(restored.photos,learned.photos);
 assert.equal(stable(restored.rows),stable(learned.rows));
 await A.reload({waitUntil:'domcontentloaded'});
 await detail(A,idA);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/오답 확인 1회/);
 assert.match(await A.locator('#wrong005-semantic-separation').innerText(),/복습 후 1회/);
 pass('비파괴 원본 검사 후 명시적 JSON 복원·재접속: 모든 값/사진 바이트·ID 복구');

 await B.goto(BASE,{waitUntil:'domcontentloaded'});
 await restore(B,bytes);
 const other=await stored(B);
 assert.equal(stable(other.rows),stable(learned.rows));
 assert.deepEqual(other.photos,learned.photos);
 await detail(B,idB);
 assert.match(await B.locator('#wrong005-semantic-separation').innerText(),/미분류/);
 await B.locator('#v218-child-mode').click();
 assert.equal(await B.locator('#wrong002-plan').isVisible(),false);
 assert.equal(await B.locator('#wrong002-retry').isVisible(),true);
 await dimensions(A,390);await dimensions(B,320);
 assert.deepEqual(errors,[]);
 pass('320px 별도 브라우저에서 가상 백업 수동 재확인·부모 기능 숨김·가로 넘침 없음');
 console.log('WRONG005_SEMANTIC_RESULT='+JSON.stringify({status:'PASS',checks,records:3,parentViewport:390,childViewport:320,photoBytesEqual:true,threeMeaningsSeparated:true,realChildren:0,realCloud:false,automatedSync:false,productionApproved:false}));
}catch(e){console.error('WRONG005_SEMANTIC_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1400)}));process.exitCode=1}
finally{if(browser)await browser.close()}
