import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const B=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const exceptions=[];let passed=0;
page.on('pageerror',e=>exceptions.push(String(e)));
function pass(s){passed++;console.log('PASS QA11',s)}
async function getRows(){
 return page.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   return await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
  finally{db.close()}
 },DB);
}
try{
 await page.goto(B,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('1/4 + 2/4 그리고 1/4 + 1/6을 각각 설명하시오');
 assert.match(await page.locator('#candidate-list').innerText(),/두 개 이상의 분수 식/);
 assert.equal(await page.locator('#candidate-list button').count(),0);
 pass('서로 다른 식이 함께 있는 문항은 무단 개념 후보 단정 보류');

 await page.locator('#problem').fill('분수의 크기를 비교하는 이유를 설명하시오');
 await page.locator('#concept').selectOption('math.fraction.comparison');
 await page.locator('#memo').fill('가상의 수학 개념 확인 시나리오');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const first=(await getRows())[0];
 assert.ok(first);
 assert.equal(first.conceptId,'math.fraction.comparison');
 assert.equal(await page.locator('#v231-inline-map').count(),1);
 pass('일반 문항에 부모 선택 개념이 연결되어 학습 중 작은 지도 생성');

 await page.locator('#v231-inline-map > summary').click();
 const count=await page.locator('.v231-map-nodes button').count();
 assert.equal(count,4,'선택 개념+검토 전 그래프 연결만 포함해야 함');
 assert.match(await page.locator('#v231-concept-info').innerText(),/교육 전문가 검증 전/);
 assert.match(await page.locator('#v231-concept-info').innerText(),/질문/);
 pass('실제 그래프의 4개 개념 및 AI 초안 질문·근거 고지');

 const nodes=page.locator('.v231-map-nodes button');
 await nodes.nth(1).click();
 assert.equal(await nodes.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await nodes.nth(0).getAttribute('aria-pressed'),'false');
 assert.ok((await page.locator('#v231-concept-info .v231-concept-question').count())>=1);
 pass('선택한 인접 개념에 따라 설명과 관찰 질문이 변경됨');

 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  const rectangles=await page.locator('.v231-map-nodes button').evaluateAll(list=>
   list.map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,screen:innerWidth})));
  assert.ok(rectangles.every(r=>r.left>=-1&&r.right<=r.screen+1),'small screen overflow at '+width);
 }
 pass('320·390·768px에서 개념 노드 버튼이 화면 영역을 벗어나지 않음');

 await page.locator('#v230-answer').fill('가상 재풀이 초안');
 await page.locator('#v230-explanation').fill('관찰 질문을 통해 생각한 내용을 메모');
 await page.locator('#nav-home').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:5000});
 assert.match(await page.locator('#dlg-title').innerText(),/저장하지 않은 재풀이/);
 await page.locator('#dlg-cancel').click();
 assert.equal(await page.locator('#v230-answer').inputValue(),'가상 재풀이 초안');
 assert.equal(await page.locator('#v230-explanation').inputValue(),'관찰 질문을 통해 생각한 내용을 메모');
 pass('일반 재풀이 작성 중 메뉴 이탈 취소 시 입력 초안 보존');

 await page.locator('#detail-concept').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:5000});
 await page.locator('#dlg-cancel').click();
 assert.equal(await page.locator('#v230-answer').inputValue(),'가상 재풀이 초안');
 pass('상단 개념 화면 이동에도 작성 중 내용 보호');

 assert.equal((await getRows())[0].generalRetryHistory.length,0);
 pass('개념 노드·질문 탐색과 이탈 취소만으로 저장 기록 생성 안 함');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'),null,{timeout:20000});
 assert.equal((await getRows())[0].generalRetryHistory[0].answer,'가상 재풀이 초안');
 pass('개념 지도 확인 후 일반 재풀이 저장 및 재읽기 성공');

 await page.locator('#nav-home').click();
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('사각형의 둘레를 설명하세요');
 await page.locator('#memo').fill('선택 개념이 없는 시범');
 await page.locator('#concept').selectOption('');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 assert.equal(await page.locator('#v231-inline-map').count(),0);
 assert.match(await page.locator('.v230-general').innerText(),/관련 개념 미선택/);
 pass('선택된 개념이 없으면 관계·확인질문을 임의로 생성하지 않음');

 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:10000});
 await page.locator('#dlg-ok').click();
 await page.waitForFunction(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise(resolve=>req.onsuccess=()=>resolve(req.result));
  try{
   const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
   return await new Promise(resolve=>q.onsuccess=()=>resolve(q.result===0));
  }finally{db.close()}
 },DB,{timeout:20000});
 assert.equal((await getRows()).length,0);
 pass('가상 데이터 모두 정리, 시험 저장소 비움');

 assert.deepEqual(exceptions,[]);
 pass('콘솔 페이지 오류 없음');
 console.log('QA11_RESULT='+JSON.stringify({status:'PASS',checks:passed}));
}catch(e){
 console.error('QA11_RESULT='+JSON.stringify({status:'FAIL',checks:passed,error:String(e),exceptions}));
 try{await page.screenshot({path:'qa11-concept-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
