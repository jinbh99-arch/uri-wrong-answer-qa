// WRONG-010: first-contact five-subject copy and navigation on the real app.
// Headless Chromium + synthetic data only. No cloud, OAuth, child identity or deployment.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE='http://127.0.0.1:4173/';
const SUBJECTS=[['math','수학'],['korean','국어'],['english','영어'],['science','과학'],['social','사회']];
let browser,checks=0;
const pass=name=>{checks++;console.log('PASS WRONG010 '+name)};
async function shot(page,name){
 await mkdir('wrong010-ui-evidence',{recursive:true});
 await page.screenshot({path:'wrong010-ui-evidence/'+name,animations:'disabled',timeout:25000});
}
async function mobile(page,width){
 const box=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.equal(box.width,width);
 assert.ok(box.scroll<=box.width+2,'horizontal overflow: '+JSON.stringify(box));
}
async function stored(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uriaimath-github-qa-v224-only');
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   return await new Promise((resolve,reject)=>{const tx=db.transaction('mistakes','readonly'),read=tx.objectStore('mistakes').getAll();read.onsuccess=()=>resolve(read.result.sort((a,b)=>a.id.localeCompare(b.id)));read.onerror=()=>reject(read.error)});
  }finally{db.close()}
 });
}
try{
 browser=await chromium.launch({headless:true});
 const parent=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
 const child=await (await browser.newContext({viewport:{width:320,height:740}})).newPage();
 const errors=[];
 for(const p of [parent,child])p.on('pageerror',e=>errors.push(String(e)));
 for(const [p,width] of [[parent,390],[child,320]]){
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.locator('#page-home:visible').waitFor();
  const header=await p.locator('.hero-text').innerText();
  for(const [,label] of SUBJECTS)assert.ok(header.includes(label),'home introduction lacks '+label);
  assert.match(header,/수학 시범 전용/);
  assert.match(await p.locator('#nav-concepts').innerText(),/수학.*시범/);
  assert.match(await p.locator('#v08-start-title').innerText(),/틀린 문제 사진/);
  assert.match(await p.locator('.v08-start').innerText(),/과목별로 찾아볼/);
  assert.match(await p.locator('.v08-start').innerText(),/관찰/);
  await mobile(p,width);
 }
 await shot(parent,'01-parent-home-five-subjects-390.png');
 pass('390/320 홈 첫 진입 안내 5과목·재풀이·부모 관찰·수학 개념 시범 구분, 가로 넘침 없음');

 await parent.locator('#nav-settings').click();
 assert.match(await parent.locator('label[for="subject"]').innerText(),/시범 개념 안내 과목.*별개/);
 assert.deepEqual(await parent.locator('#subject option').evaluateAll(nodes=>nodes.map(n=>n.value)),['math']);
 assert.match(await parent.locator('#profile-form').innerText(),/국어·영어·과학·사회 오답/);
 await parent.locator('#nav-add').click();
 assert.deepEqual(await parent.locator('#wrong007-subject option').evaluateAll(nodes=>nodes.map(n=>n.value)),SUBJECTS.map(s=>s[0]));
 pass('기존 수학 시범 프로필 설정 유지, 오답 등록 5과목과 구별 설명');

 const ids={};
 for(const [code,label] of SUBJECTS){
  await parent.locator('#nav-add').click();
  await parent.locator('#wrong007-subject').selectOption(code);
  await parent.locator('#wrong007-grade').selectOption('3');
  if(code!=='math')assert.equal(await parent.locator('#wrong007-math-fields').isVisible(),false);
  const title='WRONG010 합성 '+label+' 문제';
  await parent.locator('#problem').fill(title);
  await parent.locator('#save-btn').click();
  await parent.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
  const row=(await stored(parent)).find(r=>r.problemText===title);
  assert.ok(row,code+' synthetic record saved');assert.equal(row.subject,code);
  ids[code]=row.id;
 }
 assert.equal(new Set(Object.values(ids)).size,5);
 pass('390px 실제 오답 등록 UI에서 5과목 합성 5건·기존 ID 저장');

 await parent.locator('#nav-home').click();
 assert.match(await parent.locator('.hero-text').innerText(),/수학·국어·영어·과학·사회/);
 const baseline=JSON.stringify(await stored(parent));
 for(const [code] of SUBJECTS){
  await parent.locator('#nav-records').click();
  await parent.locator('#wrong007-filter-subject').selectOption(code);
  const shown=await parent.locator('#records-list button[data-record]').evaluateAll(nodes=>nodes.map(n=>n.dataset.record));
  assert.deepEqual(shown,[ids[code]],'subject filter '+code);
 }
 await parent.locator('#wrong007-filter-subject').selectOption('korean');
 await shot(parent,'02-parent-korean-records-390.png');
 assert.equal(JSON.stringify(await stored(parent)),baseline,'home/filters must be read-only');
 pass('홈→목록 실제 클릭 5과목 각각 자기 기록 1건·필터는 저장 데이터 불변');

 await parent.locator('#records-list button[data-record="'+ids.korean+'"]').click();
 await parent.locator('#wrong002-retry:visible').waitFor({timeout:25000});
 await parent.locator('#v230-answer:visible').waitFor({timeout:25000});
 assert.equal(await parent.locator('#v230-answer').isVisible(),true);
 assert.equal(await parent.locator('#detail-concept').isVisible(),false);
 await parent.locator('#v230-answer').fill('WRONG010 가상 국어 다시 풀기');
 await parent.locator('#v230-save').click();
 await parent.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await parent.locator('#check-status').selectOption('explained');
 await parent.locator('#check-memo').fill('WRONG010 가상 학부모 관찰');
 await parent.locator('#check-save').click();
 await parent.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 const observed=(await stored(parent)).find(r=>r.id===ids.korean);
 assert.ok(observed.generalRetryHistory?.length);
 assert.ok(observed.checkHistory?.length);
 pass('국어 상세에서 수학 개념 없이 일반 재풀이→학부모 직접 관찰 실제 동작');

 await child.locator('#v218-child-mode').click();
 assert.equal(await child.locator('#v218-child-intro').isVisible(),true);
 assert.match(await child.locator('#v218-child-intro').innerText(),/5과목.*다시 풀/);
 assert.match(await child.locator('#v218-child-intro').innerText(),/일부 수학 시범/);
 assert.equal(await child.locator('#nav-records').isVisible(),true);
 await shot(child,'03-child-home-multi-subject-320.png');
 await child.locator('#nav-records').click();
 assert.deepEqual(await child.locator('#wrong007-filter-subject option').evaluateAll(nodes=>nodes.map(n=>n.value)),['',...SUBJECTS.map(s=>s[0])]);
 await shot(child,'04-child-record-list-320.png');
 await mobile(parent,390);await mobile(child,320);
 assert.deepEqual(errors,[]);
 pass('320px 아이 첫화면 5과목 재풀이 안내·수학 시범 제한·오답 목록 진입, JS 오류/가로넘침 0');

 console.log('WRONG010_ENTRY_RESULT='+JSON.stringify({status:'PASS',checks,subjects:5,parentViewport:390,childViewport:320,recordSchemaChanged:false,syntheticOnly:true,productionApproved:false}));
}catch(e){
 console.error('WRONG010_ENTRY_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,2200)}));
 process.exitCode=1;
}finally{await browser?.close()}
