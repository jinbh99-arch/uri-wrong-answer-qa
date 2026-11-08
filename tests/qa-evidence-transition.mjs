import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const html=readFileSync('index.html','utf8');
const begin=html.indexOf('  function v227ReportModel('),end=html.indexOf('  function v227RenderParentReport()',begin);
assert.ok(begin>0&&end>begin,'report code not found');
const ctx={};vm.runInNewContext(html.slice(begin,end)+';globalThis.qa={v227ReportModel,v227ReportCsv};',ctx,{timeout:7000});
const {v227ReportModel,v227ReportCsv}=ctx.qa;
const now=Date.parse('2026-11-08T06:00:00Z'),when=h=>new Date(now-h*3600000).toISOString();
let checks=0;const done=label=>{checks++;console.log('PASS QA12',label)};
const samples=[
 {id:'hidden-id-a',problemText:'진짜 학습 효과 아닙니다',checkHistory:[{at:when(5),status:'needs_help'},{at:when(2),status:'explained'}]},
 {id:'b',checkHistory:[{at:when(5),status:'explained'},{at:when(1),status:'needs_help'}]},
 {id:'c',checkHistory:[{at:when(6),status:'needs_help'},{at:when(3),status:'needs_help'}]},
 {id:'d',checkHistory:[{at:when(6),status:'explained'},{at:when(3),status:'explained'}]},
 {id:'e',checkHistory:[{at:when(6),status:'explained'}]},
 {id:'f',checkHistory:[{at:when(5),status:'explained'},{at:when(5),status:'needs_help'}]},
 {id:'g',checkHistory:[{at:when(24*8),status:'needs_help'},{at:when(2),status:'explained'}]},
 {id:'h',checkHistory:[{at:when(3),status:'needs_help'}],
  generalRetryHistory:[{at:when(2),answer:'private solution should not leak',explanation:'private memo',
    review:'explained',reviewedAt:when(1)}]},
 {id:'i',followupHistory:[{at:when(4),outcome:'needs_help'},{at:when(2),outcome:'explained'}]},
 {id:'j',checkHistory:[{at:'invalid-date',status:'needs_help'},{at:when(2),status:'explained'}]},
 {id:'k',practiceHistory:[{at:when(5),kind:'v27-fraction-add-pilot',matchesExample:true}],
  checkHistory:[{at:when(3),status:'not_checked'}]}
];
const weekly=v227ReportModel(samples,'7',now);
assert.equal(weekly.observationChanges.comparable,6);
assert.equal(weekly.observationChanges.helpToExplained,3);
assert.equal(weekly.observationChanges.explainedToHelp,1);
assert.equal(weekly.observationChanges.stillHelp,1);
assert.equal(weekly.observationChanges.stillExplained,1);
assert.equal(weekly.observationChanges.ambiguous,1);
assert.equal(weekly.observationChanges.insufficient,4);
assert.equal(weekly.observationChanges.invalidDates,1);
done('7일 범위의 첫/마지막 학부모 관찰을 여섯 기록만 비교');

const whole=v227ReportModel(samples,'all',now);
assert.equal(whole.observationChanges.comparable,7);
assert.equal(whole.observationChanges.helpToExplained,4);
assert.equal(whole.observationChanges.insufficient,3);
done('7일 밖 관찰을 전체 기간에서는 포함하고 동일 관찰은 중복 비교하지 않음');

const empty=v227ReportModel([{id:'only-practice',
 practiceHistory:[{kind:'v27-fraction-add-pilot',at:when(1),matchesExample:true}]}],'30',now);
assert.equal(empty.observationChanges.comparable,0);
assert.equal(empty.observationChanges.insufficient,1);
done('자동 계산 일치만으로 학부모 관찰 변화나 학습효과를 만들어내지 않음');

const future=v227ReportModel([{id:'future-only',checkHistory:[
 {at:when(1),status:'explained'},{at:when(-10),status:'needs_help'}]}],'all',now);
assert.equal(future.observationChanges.comparable,0);
done('미래 날짜 관찰 제외');

const csv=v227ReportCsv(weekly,'7');
for(const expected of ['도움 필요→스스로 설명 관찰','스스로 설명→도움 필요 관찰',
 '관찰 횟수 부족 오답','학습효과를 증명하지 않음'])assert.ok(csv.includes(expected),expected);
for(const secret of ['hidden-id-a','진짜 학습 효과 아닙니다','private solution should not leak','private memo']){
 assert.equal(csv.includes(secret),false,'CSV leaked raw/private text: '+secret);
}
done('CSV에는 집계 수치만 포함되고 문제·아이 답·내부 ID·풀이 설명은 포함되지 않음');

// Performance and exact totals on the supported 500-record local demo ceiling.
const big=Array.from({length:500},(_,i)=>({id:'synthetic-'+i,checkHistory:[
 {at:when(7),status:i%2?'explained':'needs_help'},
 {at:when(1),status:i%2?'needs_help':'explained'}
]}));
const start=Date.now(),large=v227ReportModel(big,'30',now),elapsed=Date.now()-start;
assert.equal(large.observationChanges.comparable,500);
assert.equal(large.observationChanges.helpToExplained,250);
assert.equal(large.observationChanges.explainedToHelp,250);
assert.ok(elapsed<5000,'500 record model too slow '+elapsed+'ms');
done('500개 가상 오답의 관찰 변화 일관성 및 5초 이내 집계');

// Real local Chromium UI, fresh synthetic browser store, no child data.
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',err=>errors.push(String(err)));
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
async function countRows(){
 return page.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});
  try{
   const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
   return await new Promise((r,j)=>{q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})
  }finally{db.close()}
 },DB);
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA12 관찰 변화 전용 가상 문항: 가상의 분수 설명하기');
 await page.locator('#student-answer').fill('개인정보가 아닌 가상 아이 답');
 await page.locator('#memo').fill('가상의 부모 메모');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.evaluate(async name=>{
   const req=indexedDB.open(name);
   const db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('mistakes','readwrite');
    const st=tx.objectStore('mistakes'),all=st.getAll();
    all.onsuccess=()=>{
      const row=all.result[0],now=Date.now();
      row.checkHistory=[
        {at:new Date(now-3600000).toISOString(),status:'needs_help',memo:'가상 관찰'},
        {at:new Date(now-60000).toISOString(),status:'explained',memo:'가상 관찰'}
      ];
      st.put(row,row.id);
    };
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
   });
 },DB);
 await page.reload();
 await page.locator('#v232-change-summary').waitFor();
 assert.match(await page.locator('#v232-change-summary').innerText(),/비교 가능한 오답 1건/);
 assert.match(await page.locator('#v232-change-summary').innerText(),/도움 필요→스스로 설명 1건/);
 assert.match(await page.locator('#v232-change-summary').innerText(),/학습.*효과를 판정하지 않습니다/);
 done('Chromium 학부모 보고서에서 실제 저장된 2회 관찰을 변화로 집계');

 await page.locator('#v227-period').selectOption('7');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  const pos=await page.locator('#v232-change-summary').evaluate(x=>{
   const r=x.getBoundingClientRect();return{left:r.left,right:r.right,screen:innerWidth};
  });
  assert.ok(pos.left>=-1&&pos.right<=pos.screen+1,'overflow at '+width);
 }
 done('320·390·768px 화면에서 비교 요약 가로 잘림 없음');

 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#v227-export').click()]);
 const exported=await readFile(await download.path(),'utf8');
 assert.ok(exported.includes('도움 필요→스스로 설명 관찰'));
 assert.ok(exported.includes('"1"'));
 assert.ok(!exported.includes('가상의 부모 메모'));
 assert.ok(!exported.includes('개인정보가 아닌 가상 아이 답'));
 done('실제 CSV 다운로드는 관찰 변화 숫자만 포함하며 가상 개인 답·메모 유출 없음');

 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(async name=>{
  const req=indexedDB.open(name),db=await new Promise(res=>req.onsuccess=()=>res(req.result));
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
   return await new Promise(res=>q.onsuccess=()=>res(q.result===0))}
  finally{db.close()}
 },DB,{timeout:20000});
 assert.equal(await countRows(),0);
 assert.deepEqual(errors,[]);
 done('가상 기록 삭제 확인과 브라우저 오류 0건');

 console.log('QA12_RESULT='+JSON.stringify({status:'PASS',checks,largeRecords:500}));
}catch(e){
 console.error('QA12_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),errors}));
 try{await page.screenshot({path:'qa12-evidence-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
