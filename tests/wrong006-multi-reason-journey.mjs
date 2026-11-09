// WRONG-006: real app + IndexedDB with synthetic 0/1/N cause candidates.
// No child data, cloud, production origin or real family identities.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let browser,checks=0;const pass=label=>{checks++;console.log('PASS WRONG006 '+label)};
const sorted=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function snapshot(p){
 return p.evaluate(async name=>{
  const open=indexedDB.open(name);
  const db=await new Promise((yes,no)=>{open.onsuccess=()=>yes(open.result);open.onerror=()=>no(open.error)});
  const q=request=>new Promise((yes,no)=>{request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const [records,keys,photos]=await Promise.all([q(tx.objectStore('mistakes').getAll()),q(tx.objectStore('photos').getAllKeys()),q(tx.objectStore('photos').getAll())]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(keys.map(async(id,i)=>({id,mime:photos[i].type,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
function record(x,id){const r=x.records.find(r=>r.id===id);assert.ok(r,'ID missing: '+id);return r}
async function mutateRecord(p,id,transform){
 // Test-only synthetic legacy fixture and corrupt-row injection into an isolated DB.
 await p.evaluate(async ({name,id,mode})=>{
  const req=indexedDB.open(name);
  const db=await new Promise((yes,no)=>{req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error)});
  try{
   await new Promise((yes,no)=>{const tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
    const g=store.get(id);
    g.onsuccess=()=>{
     const r=g.result;
     if(mode==='legacy')delete r.reasonCandidates;
     else if(mode==='damage')r.reasonCandidates=['reading','reading'];
     store.put(r,id)
    };
    tx.oncomplete=yes;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);
   });
  }finally{db.close()}
 },{name:DB,id,mode:transform});
}
async function add(p,{title,concept='',select='',multi=[],photo=false,memo=''}) {
 await p.locator('#nav-add').click();
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'wrong006-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#problem').fill(title);
 if(memo)await p.locator('#memo').fill(memo);
 await p.locator('#concept').selectOption(concept);
 if(select)await p.locator('#reason').selectOption(select);
 for(const v of multi)await p.locator('#wrong006-candidates input[value="'+v+'"]').check();
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const x=await snapshot(p),r=x.records.find(r=>r.problemText===title);
 assert.ok(r);return r.id;
}
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong005-semantic-separation:visible').waitFor();
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:25000}),p.locator('#export-json').click()]);
 return await readFile(await download.path());
}
async function restore(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'wrong006-synthetic.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
}
try {
 browser=await chromium.launch({headless:true});
 const pctx=await browser.newContext({viewport:{width:390,height:850},acceptDownloads:true});
 const cctx=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const A=await pctx.newPage(),B=await cctx.newPage(),errors=[];
 A.on('pageerror',e=>errors.push(String(e)));B.on('pageerror',e=>errors.push(String(e)));
 await A.goto(BASE,{waitUntil:'domcontentloaded'});
 const idZero=await add(A,{title:'WRONG006 원인 후보를 아직 모르는 합성 사진',photo:true,concept:'math.natural.addition'});
 const idSingle=await add(A,{title:'WRONG006 구형 단일 원인 합성',select:'reading'});
 const idMulti=await add(A,{title:'WRONG006 여러 추정 이유 합성',concept:'math.natural.addition',
   multi:['calculation','reading','concept'],memo:'복수 추정일 뿐: 관찰 후 확인 필요.'});
 let first=await snapshot(A);
 assert.equal(first.records.length,3);assert.equal(first.photos.length,1);
 assert.deepEqual(record(first,idZero).reasonCandidates,[]);assert.equal(record(first,idZero).reason,'unknown');
 assert.deepEqual(record(first,idSingle).reasonCandidates,['reading']);assert.equal(record(first,idSingle).reason,'reading');
 assert.deepEqual(record(first,idMulti).reasonCandidates,['calculation','reading','concept']);
 assert.equal(record(first,idMulti).reason,'other');
 pass('추정 이유 0/1/3개 각각 별도 ID·사진·기존 scalar 호환 값으로 저장');

 // Reproduce a genuine old row without the extension, not a migrator.
 await mutateRecord(A,idSingle,'legacy');
 await A.reload({waitUntil:'domcontentloaded'});
 let legacy=await snapshot(A);
 assert.equal(Object.prototype.hasOwnProperty.call(record(legacy,idSingle),'reasonCandidates'),false);
 await detail(A,idSingle);
 await A.locator('#detail-edit').click();
 assert.equal(await A.locator('#reason').inputValue(),'reading');
 assert.equal(await A.locator('#wrong006-candidates input[value="reading"]').isChecked(),true);
 assert.equal(Object.prototype.hasOwnProperty.call(record(await snapshot(A),idSingle),'reasonCandidates'),false);
 await A.locator('#cancel-edit').click();
 pass('구형 단일 reason 레코드의 비파괴 읽기·편집 취소로 신규 필드 자동 이관 없음');

 await detail(A,idMulti);
 assert.match(await A.locator('#detail-reason').innerText(),/복수 후보 3개/);
 await A.locator('#detail-edit').click();
 assert.equal(await A.locator('#wrong006-candidates input[value="reading"]').isChecked(),true);
 await A.locator('#wrong006-candidates input[value="reading"]').uncheck();
 assert.equal(await A.locator('#reason').inputValue(),'other');
 await A.locator('#save-btn').click();
 await A.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 let edited=await snapshot(A);
 assert.deepEqual(record(edited,idMulti).reasonCandidates,['calculation','concept']);
 assert.equal(record(edited,idMulti).reason,'other');
 assert.deepEqual(record(edited,idZero),record(legacy,idZero));
 assert.deepEqual(record(edited,idSingle),record(legacy,idSingle));
 assert.deepEqual(edited.photos,legacy.photos);
 pass('기존 같은 ID에서 3→2개 수정·삭제, 인접 오답·사진 Blob 불변');

 await A.locator('#check-status').selectOption('needs_help');
 await A.locator('#check-memo').fill('가상 학부모 관찰: 도움이 필요해 보였지만 원인은 미확인');
 await A.locator('#check-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong005-semantic-separation')?.textContent?.includes('오답 확인 1회'));
 await A.locator('#wrong002-retry').click();
 await A.locator('#v230-answer').fill('11');
 await A.locator('#v230-save').click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'));
 await A.locator('#wrong002-plan').click();
 await A.locator('#v05-plan-date').fill('2026-11-18');
 await A.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('2026-11-18'));
 await A.locator('#wrong002-outcome').click();
 await A.locator('#v06-review-outcome').selectOption('explained');
 await A.locator('#v06-review-memo').fill('가상 관찰: 스스로 설명함, 후보를 확정할 근거는 아님');
 await A.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await A.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 2회'));
 const learned=await snapshot(A),m=record(learned,idMulti);
 assert.deepEqual(m.reasonCandidates,['calculation','concept']);assert.equal(m.reason,'other');
 assert.equal(m.checkHistory.length,1);assert.equal(m.checkHistory[0].status,'needs_help');
 assert.equal(m.followupHistory.length,1);assert.equal(m.followupHistory[0].outcome,'explained');
 assert.deepEqual(learned.photos,legacy.photos);
 pass('부모의 상반된 재확인 관찰·아이 재풀이와 2개 원인 추정/사진은 별도·불변');

 await A.locator('#wrong002-report').click();
 const report=await A.locator('.wrong005-report-semantic[data-record-id="'+idMulti+'"]').first().innerText();
 assert.match(report,/복수 후보 2개/);assert.match(report,/복습 후 학부모 관찰/);
 assert.doesNotMatch(report,/정확한 원인|오답률|실력 확정/);
 pass('부모 보고서에서 원인 후보 개수와 기록된 관찰 횟수를 독립 표시');

 const bytes=await backup(A),data=JSON.parse(bytes.toString());
 assert.equal(data.records.length,3);assert.equal(Object.keys(data.photos).length,1);
 assert.equal(Object.hasOwn(data.records.find(r=>r.id===idSingle),'reasonCandidates'),false);
 assert.deepEqual(data.records.find(r=>r.id===idMulti).reasonCandidates,['calculation','concept']);
 await B.goto(BASE,{waitUntil:'domcontentloaded'});
 await restore(B,bytes);
 assert.equal(sorted(await snapshot(B)),sorted(learned));
 await detail(B,idMulti);
 assert.match(await B.locator('#detail-reason').innerText(),/복수 후보 2개/);
 await B.reload({waitUntil:'domcontentloaded'});
 assert.equal(sorted(await snapshot(B)),sorted(learned));
 pass('구형 단일값+신규 복수 후보 혼합 JSON 백업/복원 및 320px 다른 브라우저 재접속 바이트 일치');

 // Legacy edit in a new client adds candidates on SAVE only, not on LOAD.
 await detail(B,idSingle);
 await B.locator('#detail-edit').click();
 await B.locator('#memo').fill('구형 기록의 새 편집: 후보 reading 유지');
 await B.locator('#save-btn').click();
 await B.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const converted=await snapshot(B),b=record(converted,idSingle);
 assert.deepEqual(b.reasonCandidates,['reading']);assert.equal(b.reason,'reading');
 assert.equal(b.id,idSingle);
 assert.deepEqual(converted.photos,learned.photos);
 assert.deepEqual(record(converted,idMulti),record(learned,idMulti));
 pass('구형 단일값 레코드는 동일 ID로 직접 수정한 때만 신규 후보 배열 추가');

 // A deliberate corrupt new array must be rejected before a full export.
 await mutateRecord(B,idMulti,'damage');await B.reload({waitUntil:'domcontentloaded'});
 await B.locator('#nav-settings').click();
 const warning=await B.evaluate(async()=>{const open=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((yes,no)=>{open.onsuccess=()=>yes(open.result);open.onerror=()=>no(open.error)});
  const tx=db.transaction('mistakes','readonly'),r=tx.objectStore('mistakes').getAll();
  const rows=await new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)});
  db.close();return rows.find(x=>Array.isArray(x.reasonCandidates)&&x.reasonCandidates.length===2&&x.reasonCandidates[0]===x.reasonCandidates[1])?.id;
 });
 assert.equal(warning,idMulti);
 await B.locator('#export-json').click();
 await B.waitForTimeout(300);
 assert.equal((await snapshot(B)).records.length,3);
 // Restore the original clean authenticated backup, then verify no corrupt value persisted.
 await restore(B,bytes);
 assert.equal(sorted(await snapshot(B)),sorted(learned));
 pass('중복 후보가 있는 합성 손상 데이터는 백업에서 차단, 정상 혼합 백업으로 안전 복구');

 for(const [p,w] of [[A,390],[B,320]]){
  const d=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
  assert.ok(d.scroll<=d.inner+2,'horizontal overflow '+w+' '+JSON.stringify(d));
 }
 assert.deepEqual(errors,[]);
 console.log('WRONG006_MULTI_REASON_RESULT='+JSON.stringify({status:'PASS',checks,records:3,parentViewport:390,childViewport:320,legacyWithoutArray:true,multiCandidateCount:2,photoBytesEqual:true,cloud:false,realChildren:0,productionApproved:false}));
}catch(e){
 console.error('WRONG006_MULTI_REASON_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1600)}));process.exitCode=1;
}finally{if(browser)await browser.close()}
