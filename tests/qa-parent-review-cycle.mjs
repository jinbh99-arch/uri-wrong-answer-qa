// QA19 G09: full human-entered plan -> recheck -> completed observation,
// safe backup/restore, malformed/over-limit followup rejection and two-tab guard.
// Isolated public QA with fake data only, not educational efficacy proof.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const a=await context.newPage(),pageErrors=[],passed=[];
a.on('pageerror',e=>pageErrors.push(String(e)));
const pass=msg=>{passed.push(msg);console.log('PASS QA19',msg)};
async function state(p=a){
 return p.evaluate(async name=>{
  const open=indexedDB.open(name),db=await new Promise((res,rej)=>{open.onsuccess=()=>res(open.result);open.onerror=()=>rej(open.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const q=(st,method)=>new Promise((res,rej)=>{const r=tx.objectStore(st)[method]();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   const [rows,keys,photos]=await Promise.all([q('mistakes','getAll'),q('photos','getAllKeys'),q('photos','getAll')]);
   return {rows,photos:await Promise.all(keys.map(async (key,i)=>[key,{type:photos[i].type,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))}]))};
  }finally{db.close()}
 },DB);
}
async function detail(p=a){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').filter({hasText:'QA19 가상 복습'}).first().click();
 await p.locator('#v05-followup').waitFor({timeout:20000});
}
async function settings(){await a.locator('#nav-settings').click()}
function signed(obj){const data=structuredClone(obj);delete data.integrity;obj.integrity={...obj.integrity,algorithm:'SHA-256',digest:createHash('sha256').update(JSON.stringify(data)).digest('hex')};return obj}
async function reject(name,mutator,destructive){
 const corrupt=structuredClone(backup);mutator(corrupt);signed(corrupt);
 const before=await state();
 await a.evaluate(()=>document.querySelector('#v18-verify-result').textContent='QA19 초기 대기');
 await a.locator(destructive?'#import-file':'#v18-verify-file').setInputFiles({
  name:name+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupt))});
 await a.waitForFunction(phrase=>document.querySelector('#v18-verify-result')?.textContent?.includes(phrase),destructive?'복원 전 검사에서 차단':'검사 실패',{timeout:30000});
 if(destructive)assert.equal(await a.locator('#confirm-dialog[open]').count(),0);
 assert.deepEqual(await state(),before,name+' changed saved observations');
 pass(name+' 사전 차단·기존 기록 유지');
}
let backup,backupPath,b;
try{
 await a.goto(BASE,{waitUntil:'domcontentloaded'});
 await a.locator('#nav-add').click();
 await a.locator('#problem').fill('QA19 가상 복습: 1/4 + 2/4는?');
 await a.locator('#student-answer').fill('3/8');
 await a.locator('#memo').fill('합성 부모 복습 기록만');
 await a.locator('#concept').selectOption('math.fraction.add.same_den');
 await a.locator('#save-btn').click();
 await a.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 assert.equal((await state()).rows.length,1);
 await detail();
 assert.equal(await a.locator('#v06-review-cycle').isVisible(),true);
 assert.equal(await a.locator('#v06-review-outcome').count(),0);
 pass('개념 연결 가상 오답의 복습 계획 전 관찰 저장 불가');
 await a.locator('#v05-plan-method').selectOption('picture');
 await a.locator('#v05-plan-date').fill('2026-11-10');
 await a.locator('#v05-plan-note').fill('부모가 그림으로 설명해 보기');
 await a.locator('#v05-followup button').filter({hasText:'복습 계획 저장'}).click();
 await a.waitForFunction(()=>Boolean(document.querySelector('#v06-review-outcome')),null,{timeout:20000});
 let before=await state();
 assert.equal(before.rows[0].studyPlan.dueDate,'2026-11-10');
 assert.equal(before.rows[0].studyPlan.method,'picture');
 assert.equal(before.rows[0].studyPlan.by,'parent_planned');
 assert.equal(before.rows[0].followupHistory.length,0);
 pass('부모 직접 설정한 복습 계획·날짜·방법 저장, 결과 미생성');
 b=await context.newPage();b.on('pageerror',e=>pageErrors.push(String(e)));
 await b.goto(BASE,{waitUntil:'domcontentloaded'});
 await detail(b);
 await b.locator('#v06-review-outcome').selectOption('needs_help');
 await b.locator('#v06-review-action').selectOption('needs_recheck');
 await b.locator('#v06-next-date').fill('2026-11-14');
 await b.locator('#v06-review-memo').fill('B 탭의 오래된 초안');
 await a.locator('#v06-review-outcome').selectOption('needs_help');
 await a.locator('#v06-review-action').selectOption('needs_recheck');
 await a.locator('#v06-next-date').fill('2026-11-12');
 await a.locator('#v06-review-memo').fill('A 부모: 아직 도움 필요');
 await a.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await a.waitForFunction(()=>document.querySelector('#v06-review-cycle')?.textContent?.includes('이 오답의 복습 후 관찰 이력 1건'),null,{timeout:20000});
 let saved=await state();
 assert.equal(saved.rows[0].studyPlan.dueDate,'2026-11-12');
 assert.equal(saved.rows[0].followupHistory.length,1);
 assert.equal(saved.rows[0].followupHistory[0].workflowState,'needs_recheck');
 assert.equal(saved.rows[0].followupHistory[0].outcome,'needs_help');
 assert.equal(saved.rows[0].followupHistory[0].by,'parent_observation');
 pass('1차 학부모 관찰: 도움 필요→재확인 날짜 지정·과거 계획 갱신');
 await b.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await b.waitForTimeout(120);
 assert.deepEqual(await state(),saved,'Second tab overwrote new observation');
 pass('실제 두 탭: 오래된 복습 관찰 저장 차단 및 최신 일정/이력 유지');
 await b.close();
 await a.locator('#v06-review-outcome').selectOption('explained');
 await a.locator('#v06-review-action').selectOption('completed_observation');
 await a.locator('#v06-review-memo').fill('부모: 두 번째 관찰에서 스스로 설명');
 await a.locator('#v06-review-cycle button').filter({hasText:'복습 관찰 저장'}).click();
 await a.waitForFunction(()=>document.querySelector('#v06-review-cycle')?.textContent?.includes('이 오답의 복습 후 관찰 이력 2건'),null,{timeout:20000});
 saved=await state();
 assert.equal(saved.rows[0].studyPlan,null);
 assert.equal(saved.rows[0].followupHistory.length,2);
 assert.equal(saved.rows[0].followupHistory[1].workflowState,'completed_observation');
 assert.equal(saved.rows[0].followupHistory[1].outcome,'explained');
 assert.equal(saved.rows[0].followupHistory[1].by,'parent_observation');
 pass('2차 학부모 관찰: 복습 계획 종료·이전 도움 필요 기록 1건 유지');
 await a.locator('#nav-home').click();
 assert.match(await a.locator('#v06-review-numbers').innerText(),/부모가 기록한 복습 관찰/);
 assert.match(await a.locator('#v06-review-latest').innerText(),/스스로 설명|도움/);
 pass('홈 복습 관찰 집계와 최신 이력에 실제 저장된 2회 연결');
 await settings();
 const [download]=await Promise.all([a.waitForEvent('download',{timeout:30000}),a.locator('#export-json').click()]);
 backupPath=await download.path();backup=JSON.parse(await readFile(backupPath,'utf8'));
 assert.equal(backup.records.length,1);
 assert.equal(backup.records[0].followupHistory.length,2);
 assert.equal(backup.records[0].studyPlan,null);
 assert.deepEqual(await state(),saved);
 pass('두 부모 관찰·종료된 복습 계획 상태 포함 전체 JSON 백업');
 await reject('복습 관찰 자동진단 조작',d=>{d.records[0].followupHistory[0].outcome='auto_mastered';},false);
 await reject('복습 관찰 201회 초과',d=>{const row=d.records[0];row.followupHistory=Array.from({length:201},()=>structuredClone(row.followupHistory[0]));},false);
 await reject('복원 전 복습 관찰 201회 초과',d=>{const row=d.records[0];row.followupHistory=Array.from({length:201},()=>structuredClone(row.followupHistory[0]));},true);
 await a.locator('#clear-all').click();
 await a.locator('#confirm-dialog[open]').waitFor();
 await a.locator('#dlg-ok').click();
 await a.locator('#page-home:visible').waitFor({timeout:20000});
 await a.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.equal((await state()).rows.length,0);
 await settings();
 await a.locator('#import-file').setInputFiles(backupPath);
 await a.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 await a.locator('#dlg-ok').click();
 await a.locator('#nav-records').click();
 await a.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 1건'),null,{timeout:25000});
 assert.deepEqual(await state(),saved,'Restored follow-up observations differ');
 pass('실제 백업 파일 복원으로 부모 관찰 2회와 완료 상태 무손실 회복');
 await a.reload({waitUntil:'domcontentloaded'});
 assert.deepEqual(await state(),saved,'Reload lost follow-up observations');
 await detail();
 assert.match(await a.locator('#v06-review-cycle').innerText(),/관찰 이력 2건/);
 pass('새로고침 후 관찰 이력 2개·원본 오답 유지');
 await settings();
 await a.locator('#clear-all').click();await a.locator('#confirm-dialog[open]').waitFor();
 await a.locator('#dlg-ok').click();await a.locator('#page-home:visible').waitFor({timeout:20000});
 await a.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.equal((await state()).rows.length,0);
 assert.deepEqual(pageErrors,[]);
 pass('합성 기록 정리·브라우저 오류 없음');
 console.log('QA_G09_REVIEW_RESULT='+JSON.stringify({status:'PASS',checks:passed.length,passed,
  limitation:'Parent-reported observation, not independent evidence of mastery or learning effectiveness.'}));
}catch(err){
 console.error('QA_G09_REVIEW_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),pageErrors}));
 try{await a.screenshot({path:'qa19-review-cycle-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
