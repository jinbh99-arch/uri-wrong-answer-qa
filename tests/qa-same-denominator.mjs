import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await ctx.newPage();
const checks=[];
function pass(name,details=''){checks.push({name,details});console.log('PASS SAME_DEN',name,details)}
async function readRow() {
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   const query=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   const rows=await new Promise((resolve,reject)=>{query.onsuccess=()=>resolve(query.result);query.onerror=()=>reject(query.error)});
   return rows.find(r=>r.problemText==='1/4+2/4=?');
  }finally{db.close()}
 });
}
try{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.QA_BASE || 'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 const demo=page.locator('#v225-samples');
 assert.equal(await demo.locator('[data-v225-sample]').count(),3);
 await demo.locator('[data-v225-sample="same"]').click();
 assert.equal(await page.locator('#problem').inputValue(),'1/4+2/4=?');
 assert.equal(await page.locator('#student-answer').inputValue(),'3/8');
 assert.equal(await page.locator('#concept').inputValue(),'math.fraction.add.same_den');
 const noAuto=await readRow();
 assert.equal(noAuto,undefined,'예시 선택만으로 데이터가 저장됨');
 pass('선택형 가상 예시 3종·자동 저장 없음');
 await page.locator('#memo').fill('QA 가상 같은 분모 문제');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const panel=page.locator('.v27-learning');
 assert.equal(await panel.count(),1);
 assert.match(await panel.innerText(),/같은 분모 덧셈 시범/);
 pass('같은 분모 문항 자동 연결', '원본 1/4+2/4, 학생 답 3/8');

 const conceptStage=panel.locator('details.v27-stage').filter({has:page.locator('summary:text("② 작은 개념 지도")')});
 await conceptStage.locator(':scope > summary').click();
 assert.equal(await conceptStage.locator('.v25-map button').count(),5);
 await conceptStage.locator('.v25-map button').first().click();
 assert.match(await conceptStage.locator('.v25-node-note').innerText(),/같은 분모/);
 pass('같은 분모 개념 5개 지도 탐색');

 const drawStage=panel.locator('details.v27-stage').filter({has:page.locator('summary:text("③ 막대를 직접")')});
 await drawStage.locator(':scope > summary').click();
 const bars=drawStage.locator('.v27-paint-row');
 assert.equal(await bars.count(),2);
 assert.equal(await bars.nth(0).locator('button.v27-paint-cell').count(),4);
 assert.equal(await bars.nth(1).locator('button.v27-paint-cell').count(),4);
 await bars.nth(0).locator('button.v27-paint-cell').first().click();
 await bars.nth(1).locator('button.v27-paint-cell').nth(0).click();
 await bars.nth(1).locator('button.v27-paint-cell').nth(1).click();
 await drawStage.locator('button').filter({hasText:'색칠 확인'}).click();
 assert.match(await drawStage.locator('.v25-status').first().innerText(),/예시와 같아요/);
 const solution=drawStage.locator('details.v26-solution');
 await solution.locator(':scope > summary').click();
 assert.match(await solution.innerText(),/분모 4는 그대로/);
 pass('조작형 4칸 막대·원리 설명', '분자 1+2, 분모 4 유지');

 const checkStage=panel.locator('details.v27-stage').filter({has:page.locator('summary:text("④ 두 개의 짧은 확인")')});
 await checkStage.locator(':scope > summary').click();
 const inputs=checkStage.locator('input.control');
 assert.equal(await inputs.count(),2);
 await inputs.nth(0).fill('1');
 await inputs.nth(1).fill('3');
 await checkStage.locator('button').filter({hasText:'두 답 확인'}).click();
 assert.match(await checkStage.locator('.v25-status').innerText(),/같습니다/);
 pass('같은 단위 개수·전체 조각 확인 질문');

 const finalStage=panel.locator('details.v27-stage').filter({has:page.locator('summary:text("⑤ 재풀이와 새 문제")')});
 await finalStage.locator(':scope > summary').click();
 const transfer=finalStage.locator('.v222-transfer');
 const text=await transfer.locator('.v222-newproblem').innerText();
 assert.match(text,/(\d+)\/(\d+)\+(\d+)\/\2/,'새 문제도 같은 분모여야 함');
 const match=text.match(/(\d+)\/(\d+)\+(\d+)\/(\d+)/);
 assert.ok(match);
 const numer=Number(match[1])+Number(match[3]);
 const denom=Number(match[2]);
 assert.equal(Number(match[2]),Number(match[4]));
 await transfer.locator('input.control').fill(numer+'/'+denom);
 await transfer.locator('button').click();
 assert.match(await transfer.locator('p.v25-status').innerText(),/예시 계산값과 같습니다/);
 await finalStage.locator('label.field').filter({hasText:'다시 계산한 답'}).locator('input').fill('3/4');
 await finalStage.locator('textarea').fill('같은 크기의 조각은 개수만 더해요.');
 await finalStage.locator('button.primary').filter({hasText:'재풀이 기록 저장'}).click();
 await page.waitForFunction(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   const rows=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
   const row=rows.find(x=>x.problemText==='1/4+2/4=?');
   return row?.practiceHistory?.length===1;
  }finally{db.close()}
 },null,{timeout:20000});
 const row=await readRow();
 assert.ok(row);
 assert.equal(row.studentAnswer,'3/8');
 assert.equal(row.practiceHistory.length,1);
 assert.equal(row.practiceHistory[0].matchesExample,true);
 assert.equal(row.practiceHistory[0].transferCheck?.matchesExample,true);
 assert.equal(row.practiceHistory[0].checks[1].questionId,'same-unit-total');
 pass('재풀이·동일 분모 새 문제·기존 백업 호환 이력 저장');

 await page.locator('#nav-settings').click();
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:20000}),page.locator('#export-json').click()]);
 const file=await download.path();
 const {readFile}=await import('node:fs/promises');
 const backup=JSON.parse(await readFile(file,'utf8'));
 assert.equal(backup.records.length,1);
 assert.equal(backup.records[0].practiceHistory[0].matchesExample,true);
 assert.ok(backup.integrity);
 pass('새 학습 이력 실제 JSON 백업', '기존 v02 형식');
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-records').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 0건'),null,{timeout:20000});
 assert.deepEqual(errors,[]);
 pass('가상 데이터 정리·JS 오류 없음');
 console.log('QA_SAME_DEN_RESULT='+JSON.stringify({status:'PASS',checks}));
}catch(e){
 console.error('QA_SAME_DEN_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1600)}));
 try{await page.screenshot({path:'qa-same-den-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
