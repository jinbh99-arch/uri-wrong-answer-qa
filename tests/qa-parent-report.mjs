import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';

const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const checks=[];
function pass(name,detail=''){checks.push({name,detail});console.log('PASS PARENT_REPORT',name,detail)}

// Unit check the EXACT pure model and CSV function extracted from application source.
const html=readFileSync('index.html','utf8');
const start=html.indexOf('  function v227ReportModel(');
const end=html.indexOf('  function v227RenderParentReport()',start);
assert.ok(start>0&&end>start);
const ctx={};
vm.runInNewContext(html.slice(start,end)+';globalThis.reportApi={v227ReportModel,v227ReportCsv};',ctx,{timeout:5000});
const {v227ReportModel,v227ReportCsv}=ctx.reportApi;
const now=Date.parse('2026-11-07T06:00:00Z');
const when=diff=>new Date(now-diff*3600000).toISOString();
const sample=[
  {id:'test-A',problemText:'=SUM(1,1) 이름이 있는 가상 문제',createdAt:when(5),
    practiceHistory:[
      {kind:'v27-fraction-add-pilot',at:when(1),matchesExample:true,transferCheck:{answer:'3/4',matchesExample:true},supportUsed:false},
      {kind:'v27-fraction-add-pilot',at:when(2),matchesExample:undefined,transferCheck:{answer:'3/8'},supportUsed:undefined}
    ],
    checkHistory:[{at:when(3),status:'explained'}],
    followupHistory:[{at:when(4),outcome:'needs_help'}]},
  {id:'test-B',problemText:'오래된 가상 문제',createdAt:when(24*45),
    practiceHistory:[{kind:'v211-equal-groups-pilot',at:when(24*45),matchesExample:false,transferCheck:null,supportUsed:true}],
    checkHistory:[],followupHistory:[]},
  {id:'test-C',problemText:'날짜 오류',createdAt:'invalid',
    practiceHistory:[{kind:'v27-fraction-add-pilot',at:'not-a-date',matchesExample:false}],
    checkHistory:[],followupHistory:[]}
];
const weekly=v227ReportModel(sample,'7',now);
assert.equal(weekly.created,1);
assert.equal(weekly.attempted,2);
assert.equal(weekly.answerKnown,1);
assert.equal(weekly.answerMatched,1);
assert.equal(weekly.transferAttempted,2);
assert.equal(weekly.transferKnown,1);
assert.equal(weekly.transferMatched,1);
assert.equal(weekly.supportKnown,1);
assert.equal(weekly.supportUsed,0);
assert.equal(weekly.parentRecorded,2);
assert.equal(weekly.parentExplained,1);
assert.equal(weekly.parentNeedsHelp,1);
assert.equal(weekly.missingDates,2);
assert.equal(weekly.events.length,5);
pass('7일 범위·비교 가능 분모·미확인·관찰 계산');

const whole=v227ReportModel(sample,'all',now);
assert.equal(whole.created,2);
assert.equal(whole.attempted,3);
assert.equal(whole.answerKnown,2);
assert.equal(whole.answerMatched,1);
assert.equal(whole.parentRecorded,2);
assert.equal(whole.missingDates,2);
assert.throws(()=>v227ReportModel(sample,'13',now));
pass('전체 기간·날짜 오류·잘못된 기간 거부');

const csv=v227ReportCsv(weekly,'7');
assert.ok(csv.startsWith('\ufeff'));
assert.match(csv,/재풀이 비교 미확인/);
for(const secret of ['test-A','=SUM(1,1)','이름이 있는 가상 문제','3/4','3/8','test-C'])assert.equal(csv.includes(secret),false,'CSV 원본 비밀 유출: '+secret);
assert.match(csv,/집계용 CSV/);
pass('CSV 원본 문제·답·ID 제외 및 복원용과 분리');
const rows=Array.from({length:500},(_,i)=>({
 id:'q'+i,problemText:'합성 '+i,createdAt:when(1),
 practiceHistory:Array.from({length:256},(_,j)=>({kind:'v27-fraction-add-pilot',at:when(1),matchesExample:j%2===0,supportUsed:j%2===1})),
 checkHistory:[],followupHistory:[]
}));
const many=v227ReportModel(rows,'30',now);
assert.equal(many.attempted,128000);
assert.equal(many.answerKnown,128000);
assert.equal(many.answerMatched,64000);
assert.ok(many.events.length<=12);
pass('500건 × 256회 장기 이력 집계 상한과 최근 12개 표시');

// Real Chromium UI/CSV checks on synthetic record; no live children's data.
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
async function readRows(p=page){
 return await p.evaluate(async name=>{
  const req=indexedDB.open(name),db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
    const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
    return await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
  }finally{db.close()}
 },DB);
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#v227-parent-report').isVisible(),true);
 assert.equal(await page.locator('#v227-metrics .v29-stat').count(),6);
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA 집계 가상 분수 1/4+2/4=?');
 await page.locator('#student-answer').fill('3/8');
 await page.locator('#memo').fill('가상 학부모 보고서 시험 자료');
 await page.locator('#concept').selectOption('math.fraction.add.same_den');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const saved=(await readRows())[0];
 assert.ok(saved?.id);
 const put=await page.evaluate(async ({name,id})=>{
  const req=indexedDB.open(name),db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
   const request=store.get(id);
   request.onsuccess=()=>{
    const row=request.result,at=new Date().toISOString();
    const practice=(match,support,transfer)=>({
      kind:'v27-fraction-add-pilot',at,answer:'3/4',explanation:'가상 활동',
      matchesExample:match,checks:[{questionId:'same-unit-first',input:'1',matchesExample:true},{questionId:'same-unit-total',input:'3',matchesExample:true}],
      preHelpAnswer:'3/8',helpOpened:false,supportUsed:support,
      diagramCheck:{paint:[1,2],matchesExample:true},
      commonDenominator:4,problemSignature:'1/4+2/4',exampleAnswer:'3/4',
      source:'child_or_parent_input',reviewState:'draft_unapproved',
      ...(transfer?{transferCheck:{signature:'1/5+2/5',answer:'3/5',exampleAnswer:'3/5',matchesExample:true}}:{})
    });
    row.practiceHistory=[practice(true,false,true),practice(false,true,false)];
    row.checkHistory=[{status:'explained',at,memo:'가상 학부모 관찰'}];
    store.put(row,id);
   };
   tx.oncomplete=()=>{db.close();resolve(true)};
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.onabort=()=>{db.close();reject(tx.error)};
  });
 },{name:DB,id:saved.id});
 assert.equal(put,true);
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#v227-metrics .v29-stat').count(),6);
 const labels=await page.locator('#v227-metrics .v29-stat strong').allInnerTexts();
 assert.deepEqual(labels,['1','2','1/2','1/1','1/2','1']);
 assert.match(await page.locator('#v227-evidence').innerText(),/미확인 0회/);
 const before=await readRows();
 pass('실제 Chromium 홈 보고서 6개 집계·실데이터 스냅샷 기반 가상 기록');

 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:20000}),
  page.locator('#v227-export').click()
 ]);
 const csvFile=await readFile(await download.path(),'utf8');
 assert.ok(csvFile.startsWith('\ufeff'));
 assert.match(csvFile,/재풀이 기록 횟수/);
 assert.equal(csvFile.includes('QA 집계 가상 분수'),false);
 assert.equal(csvFile.includes(saved.id),false);
 assert.equal(csvFile.includes('3/8'),false);
 assert.deepEqual(await readRows(),before);
 pass('실제 UI CSV 다운로드·원문 제외·저장소 미변경');

 await page.locator('#v227-period').selectOption('all');
 assert.deepEqual(await page.locator('#v227-metrics .v29-stat strong').allInnerTexts(),['1','2','1/2','1/1','1/2','1']);
 await page.locator('#v227-events [data-record]').first().click();
 assert.equal(await page.locator('#page-detail').isVisible(),true);
 pass('기간 변경 및 최근 활동에서 원본 오답 상세 이동');

 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v227-parent-report').isVisible(),false);
 await page.locator('#v218-parent-mode').click();
 assert.equal(await page.locator('#v227-parent-report').isVisible(),true);
 pass('아이 화면에서는 보고서 숨김 (진짜 권한제어 아님)');

 const tabB=await context.newPage();
 await tabB.goto(BASE,{waitUntil:'domcontentloaded'});
 await tabB.locator('#nav-records').click();
 await tabB.locator('#records-list button.item').first().click();
 await tabB.locator('#detail-edit').click();
 await tabB.locator('#memo').fill('다른 탭에서 수정한 가상 메모');
 await tabB.locator('#save-btn').click();
 await tabB.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 await page.locator('#v227-export').click();
 await page.waitForFunction(()=>document.querySelector('#v227-export-state')?.textContent?.includes('중단'),null,{timeout:15000});
 assert.match(await page.locator('#v227-export-state').innerText(),/다른 탭에서 기록이 변경/);
 const after=await readRows();
 assert.equal(after[0].memo,'다른 탭에서 수정한 가상 메모');
 pass('다른 탭이 갱신한 오래된 집계 CSV 내보내기 차단');
 await tabB.close();

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:15000});
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(async name=>{
  const req=indexedDB.open(name),db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
    return await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result===0);q.onerror=()=>rej(q.error)})}
  finally{db.close()}
 },DB,{timeout:20000});
 assert.deepEqual(errors,[]);
 pass('합성 자료 삭제 및 페이지 오류 없음');
 console.log('QA_PARENT_REPORT_RESULT='+JSON.stringify({status:'PASS',checks}));
}catch(err){
 console.error('QA_PARENT_REPORT_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1500),pageErrors:errors}));
 try{await page.screenshot({path:'qa-parent-report-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
