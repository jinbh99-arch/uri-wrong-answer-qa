// QA20 — isolated public QA only. Four bounded technical acceptance suites:
// G03 non-diagnostic evidence, G05 read-only concept maps, G06 manipulative
// fraction/group drawings, G07 human input questions and separate transfer tasks.
// No curriculum approval, physical devices or student records.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage(),errors=[],evidence={G03:[],G05:[],G06:[],G07:[]};
page.on('pageerror',e=>errors.push(String(e)));
function pass(g,label){evidence[g].push(label);console.log('PASS QA20 '+g+' '+label)}
async function records(){
 return page.evaluate(async name=>{
  const o=indexedDB.open(name),db=await new Promise((ok,bad)=>{o.onsuccess=()=>ok(o.result);o.onerror=()=>bad(o.error)});
  try{const r=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();return await new Promise((ok,bad)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)})}finally{db.close()}
 },DB);
}
async function add(problem,answer,concept){
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill(problem);
 await page.locator('#student-answer').fill(answer);
 if(concept!==undefined)await page.locator('#concept').selectOption(concept);
 await page.locator('#memo').fill('QA20 전용 합성 오답');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const all=await records(),row=all.find(r=>r.problemText===problem);assert.ok(row);
 return row;
}
async function openStage(panel,index){
 const stage=panel.locator('details.v27-stage').nth(index);
 await stage.locator(':scope > summary').click();
 return stage;
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('1/4 + 2/4 그리고 1/3 + 1/4 을 비교하세요');
 assert.match(await page.locator('#candidate-list').innerText(),/두 개 이상의 분수 식/);
 assert.equal(await page.locator('#candidate-list button').count(),0);
 assert.equal((await records()).length,0);
 pass('G03','두 수식의 모호한 문항에서 개념·원인 후보 자동확정 보류, DB 무변경');
 const fraction=await add('1/4+2/4=?','3/8','math.fraction.add.same_den');
 const panel=page.locator('.v27-learning');
 assert.equal(await panel.count(),1);
 const disclosure=panel.locator('details.v26-solution').first();
 await disclosure.locator(':scope > summary').click();
 const cause=disclosure.locator('.v222-cause');
 assert.equal(await cause.locator('li').count(),3);
 assert.match(await cause.innerText(),/분모/);
 assert.match(await cause.innerText(),/가능성/);
 assert.match(await cause.innerText(),/단정 불가|자동 진단이 아닙니다/);
 pass('G03','분모도 더한 답 3/8은 가능성+학부모 질문 3개로만 표시');
 const draw=await openStage(panel,1);
 const bars=draw.locator('.v27-paint-row');
 assert.equal(await bars.count(),2);
 assert.equal(await bars.nth(0).locator('button.v27-paint-cell').count(),4);
 assert.equal(await bars.nth(1).locator('button.v27-paint-cell').count(),4);
 await draw.getByRole('button',{name:'색칠 확인'}).click();
 assert.match(await draw.locator('p.v25-status').first().innerText(),/다시 살펴|생각/);
 await bars.nth(0).locator('button.v27-paint-cell').first().click();
 for(let i=0;i<2;i++)await bars.nth(1).locator('button.v27-paint-cell').nth(i).click();
 await draw.getByRole('button',{name:'색칠 확인'}).click();
 assert.match(await draw.locator('p.v25-status').first().innerText(),/예시와 같아요/);
 const selected=await bars.locator('button.v27-paint-cell[aria-pressed="true"]').count();
 assert.equal(selected,3);
 pass('G06','같은 분모 그림 2×4칸 조작, 부분색칠 거부·정확한 1+2칸 표시');
 await bars.nth(1).locator('button.v27-paint-cell').first().click();
 assert.equal(await bars.locator('button.v27-paint-cell[aria-pressed="true"]').count(),2);
 await bars.nth(1).locator('button.v27-paint-cell').first().click();
 assert.equal(await bars.locator('button.v27-paint-cell[aria-pressed="true"]').count(),3);
 pass('G06','색칠 조작은 취소·복구 가능하며 aria-pressed와 일치');
 const checks=await openStage(panel,2);
 assert.equal(await checks.locator('input.control').count(),2);
 await checks.locator('input.control').nth(0).fill('2');
 await checks.locator('input.control').nth(1).fill('3');
 await checks.getByRole('button',{name:'두 답 확인'}).click();
 assert.match(await checks.locator('.v25-status').innerText(),/다시 확인/);
 await checks.locator('input.control').nth(0).fill('1');
 await checks.getByRole('button',{name:'두 답 확인'}).click();
 assert.match(await checks.locator('.v25-status').innerText(),/예시 계산과 같습니다/);
 assert.equal((await records()).find(r=>r.id===fraction.id).practiceHistory.length,0);
 pass('G07','확인 질문 2개: 오답/예시 일치 비교하되 자동 저장·숙련도 판정 없음');
 const apply=await openStage(panel,3);
 const transfer=apply.locator('.v222-transfer');
 const signature=(await transfer.locator('.v222-newproblem').innerText()).match(/(\d+)\/(\d+)\+(\d+)\/(\d+)/);
 assert.ok(signature,'신규 연습 분수식 누락');
 assert.equal(signature[2],signature[4]);
 assert.notEqual(signature[0],'1/4+2/4');
 await transfer.locator('input.control').fill('0/1');
 await transfer.getByRole('button',{name:'새 문제의 답 확인'}).click();
 assert.match(await transfer.locator('p.v25-status').innerText(),/다릅니다/);
 await transfer.locator('input.control').fill(String(Number(signature[1])+Number(signature[3]))+'/'+signature[2]);
 await transfer.getByRole('button',{name:'새 문제의 답 확인'}).click();
 assert.match(await transfer.locator('p.v25-status').innerText(),/예시 계산값과 같습니다/);
 await apply.locator('label.field').filter({hasText:'다시 계산한 답'}).locator('input').fill('3/4');
 await apply.locator('textarea').fill('같은 크기의 조각은 개수만 더합니다.');
 await apply.getByRole('button',{name:'재풀이 기록 저장'}).click();
 await page.waitForFunction(async id=>{
  const open=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise(ok=>open.onsuccess=()=>ok(open.result));
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').get(id);
   return await new Promise(ok=>q.onsuccess=()=>ok(q.result?.practiceHistory?.length===1))}finally{db.close()}
 },fraction.id,{timeout:20000});
 const fractionSaved=(await records()).find(r=>r.id===fraction.id).practiceHistory[0];
 assert.equal(fractionSaved.matchesExample,true);
 assert.equal(fractionSaved.transferCheck.matchesExample,true);
 assert.equal(fractionSaved.diagramCheck.matchesExample,true);
 assert.equal(fractionSaved.checks[0].matchesExample,true);
 assert.equal(fractionSaved.checks[1].matchesExample,true);
 assert.equal(fractionSaved.reviewState,'draft_unapproved');
 pass('G07','새 숫자 다른 문제의 불일치/일치, 질문·그림·재풀이 근거 연결 저장');
 const group=await add('3×4=?','7','');
 const gp=page.locator('.v211-learning');
 assert.equal(await gp.count(),1);
 await gp.locator('details.v26-solution').first().locator(':scope > summary').click();
 const gcause=gp.locator('.v222-cause');
 assert.equal(await gcause.locator('li').count(),3);
 assert.match(await gcause.innerText(),/덧셈/);
 assert.match(await gcause.innerText(),/가능성|단정 불가/);
 pass('G03','3×4 문제에서 아이의 덧셈 답 7은 확정진단 대신 질문 3개만 제시');
 const gd=await openStage(gp,1);
 assert.equal(await gd.locator('.v211-group').count(),3);
 assert.equal(await gd.locator('button.v211-dot').count(),12);
 await gd.getByRole('button',{name:'묶음 색칠 확인'}).click();
 assert.match(await gd.locator('p.v25-status').first().innerText(),/다시 확인|현재 0개/);
 await gd.locator('button.v211-dot').evaluateAll(list=>list.forEach(el=>el.click()));
 assert.equal(await gd.locator('button.v211-dot[aria-pressed="true"]').count(),12);
 await gd.getByRole('button',{name:'묶음 색칠 확인'}).click();
 assert.match(await gd.locator('p.v25-status').first().innerText(),/맞아요/);
 pass('G06','3묶음×4개 총12 버튼의 부분색칠 감지·전수색칠·접근성 상태');
 const gc=await openStage(gp,2);
 await gc.locator('input.control').nth(0).fill('3');
 await gc.locator('input.control').nth(1).fill('4');
 await gc.getByRole('button',{name:'답 확인'}).click();
 assert.match(await gc.locator('p.v25-status').innerText(),/예시와 같아요/);
 const ga=await openStage(gp,3),gt=ga.locator('.v222-transfer');
 const sig=(await gt.locator('.v222-newproblem').innerText()).match(/(\d+)×(\d+)/);
 assert.ok(sig);assert.equal(Number(sig[1]),3);assert.notEqual(Number(sig[2]),4);
 await gt.locator('input.control').fill(String(Number(sig[1])*Number(sig[2])));
 await gt.getByRole('button',{name:'새 문제의 답 확인'}).click();
 assert.match(await gt.locator('p.v25-status').innerText(),/예시 계산값과 같습니다/);
 await ga.locator('label.field').filter({hasText:'다시 계산한 답'}).locator('input').fill('12');
 await ga.getByRole('button',{name:'재풀이 기록 저장'}).click();
 await page.waitForFunction(async id=>{
  const o=indexedDB.open('uriaimath-github-qa-v224-only'),db=await new Promise(ok=>o.onsuccess=()=>ok(o.result));
  try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').get(id);
   return await new Promise(ok=>q.onsuccess=()=>ok(q.result?.practiceHistory?.length===1))}finally{db.close()}
 },group.id,{timeout:20000});
 const groupSaved=(await records()).find(r=>r.id===group.id).practiceHistory[0];
 assert.equal(groupSaved.kind,'v211-equal-groups-pilot');
 assert.equal(groupSaved.matchesExample,true);
 assert.equal(groupSaved.diagramCheck.matchesExample,true);
 assert.equal(groupSaved.transferCheck.matchesExample,true);
 assert.equal(groupSaved.reviewState,'draft_unapproved');
 pass('G07','곱셈 묶음 2개 질문·새로운 곱셈 연습·수동 재풀이 이력 연결');
 const generic=await add('QA20 사각형 넓이와 분수 개념을 설명하시오','아직 설명할 수 없음','math.fraction.comparison');
 const graph=await page.evaluate(()=>JSON.parse(document.querySelector('script#concept-data').textContent));
 const concepts=new Map(graph.concepts.map(c=>[c.concept_id,c]));
 const expected=[generic.conceptId],seen=new Set(expected);
 for(const edge of graph.edges.filter(e=>e.to_concept_id===generic.conceptId||e.from_concept_id===generic.conceptId)){
  const next=edge.to_concept_id===generic.conceptId?edge.from_concept_id:edge.to_concept_id;
  if(!seen.has(next)&&concepts.has(next)){seen.add(next);expected.push(next)}
  if(expected.length>=5)break;
 }
 const map=page.locator('#v231-inline-map');
 assert.equal(await map.count(),1);
 await map.locator(':scope > summary').click();
 const nodes=map.locator('.v231-map-nodes button');
 assert.equal(await nodes.count(),expected.length);
 for(let i=0;i<expected.length;i++)assert.equal((await nodes.nth(i).innerText()).trim(),concepts.get(expected[i]).label_ko);
 pass('G05','선택 개념을 기반으로 원본 초안 관계만 중복 없이 5개 이내 연결');
 for(let i=0;i<expected.length;i++){
  await nodes.nth(i).click();
  assert.equal(await nodes.nth(i).getAttribute('aria-pressed'),'true');
  assert.equal(await nodes.locator('[aria-pressed="true"]').count(),1);
  const inf=await page.locator('#v231-concept-info').innerText();
  assert.ok(inf.includes(concepts.get(expected[i]).definition),'Concept definition mismatch: '+expected[i]);
  assert.match(inf,/검증 전/);
  const count=graph.questions.filter(q=>q.concept_id===expected[i]).length;
  assert.equal(await map.locator('.v231-concept-question').count(),Math.min(count,2));
 }
 pass('G05','연결된 각 개념의 원문 설명·AI 질문을 실제 데이터와 전수 대조');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  const fit=await nodes.evaluateAll(els=>els.every(el=>{
   const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1
  }));
  assert.equal(fit,true,'Graph content overflow '+width);
 }
 pass('G05','320·390·768px의 노드 이동·접근성 상태 보존');
 const rows=await records(),last=rows.find(r=>r.id===generic.id);
 assert.equal(last.generalRetryHistory.length,0);
 assert.equal(last.practiceHistory.length,0);
 assert.equal(last.conceptVerified,false);
 assert.match(await map.innerText(),/AI 시범|검토 전/);
 pass('G05','그래프·질문 클릭만으로 자동 저장·공식 검증·숙련도 판정 없음');
 assert.deepEqual(errors,[]);
 for(const g of Object.keys(evidence))assert.ok(evidence[g].length>=3,g+' acceptance too shallow');
 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home:visible').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.equal((await records()).length,0);
 console.log('QA20_FOUR_GOALS_RESULT='+JSON.stringify({status:'PASS',counts:Object.fromEntries(Object.entries(evidence).map(([k,v])=>[k,v.length])),evidence,
  limitations:'synthetic arithmetic/data, unapproved AI concepts; no education expert validity or learning-effect proof'}));
}catch(err){
 console.error('QA20_FOUR_GOALS_RESULT='+JSON.stringify({status:'FAIL',counts:Object.fromEntries(Object.entries(evidence).map(([k,v])=>[k,v.length])),error:String(err),stack:String(err?.stack).slice(0,1600),errors}));
 try{await page.screenshot({path:'qa20-four-goals-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
