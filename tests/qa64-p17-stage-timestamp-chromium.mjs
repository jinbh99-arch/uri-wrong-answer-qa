// WRONG QA64: NEW real Chromium test for P17 filter+P15/16 stage timestamp.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=t=>{checks++;console.log('PASS WRONG QA64 CHROMIUM '+t)};
async function store(page) {return page.evaluate(dbName=>new Promise((ok,fail)=>{
 const req=indexedDB.open(dbName);req.onerror=()=>fail(req.error);
 req.onsuccess=()=>{const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
  const a=tx.objectStore('mistakes').getAll(),b=tx.objectStore('photos').getAllKeys();
  tx.onerror=()=>{db.close();fail(tx.error)};
  tx.oncomplete=()=>{db.close();ok({records:a.result,photos:b.result})};
 };
}),DB)}
async function add(page,title){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').filter({hasText:title}).click();
 await page.locator('#v230-answer').fill('가상 재풀이 정답');
 await page.locator('#v230-explanation').fill('가상 이유 설명');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:16000});
 await page.locator('#nav-home').click();
}
async function setTime(page,id,iso){
 await page.evaluate(({dbName,id,iso})=>new Promise((resolve,reject)=>{
  const open=indexedDB.open(dbName);open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('mistakes','readwrite');
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve(true)};
   const st=tx.objectStore('mistakes'),get=st.get(id);
   get.onsuccess=()=>{
    if(!get.result){tx.abort();return}
    const row=get.result;
    row.generalRetryHistory.at(-1).at=iso;
    st.put(row,id);
   };
  };
 }),{dbName:DB,id,iso});
}
async function run(width){
 const ctx=await browser.newContext({viewport:{width,height:780}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const kinds=['valid','future','impossible'];
 try{
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  for(const type of kinds)await add(page,'QA64 '+type+' '+width);
  const initial=await store(page);
  assert.equal(initial.records.length,3);
  const ids=Object.fromEntries(initial.records.map(r=>[kinds.find(k=>r.problemText.includes(' '+k+' ')),r.id]));
  assert.equal(Object.keys(ids).length,3);
  await setTime(page,ids.future,new Date(Date.now()+86400000).toISOString());
  await setTime(page,ids.impossible,'2026-02-30T08:00:00Z');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav-records').click();
  const cards=page.locator('#records-list button[data-record]');
  assert.equal(await cards.count(),3);
  const stamp=id=>page.locator('#records-list button[data-record]').filter({has:page.locator('[data-record-stage]')}).filter({hasText:'QA64'}).locator('[data-record-stage]');
  const stageById=async id=>page.locator('#records-list button[data-record]').evaluateAll((buttons,id)=>{
   const card=buttons.find(b=>b.dataset.record===id);
   return card?.querySelector('[data-record-stage]')?.textContent||null;
  },id);
  assert.match(await stageById(ids.valid),/이번 재풀이 부모 확인 전/);
  assert.match(await stageById(ids.future),/재풀이 시각 확인 필요/);
  assert.match(await stageById(ids.impossible),/재풀이 시각 확인 필요/);
  pass(width+'px real saved latest child attempts distinguish valid/future/impossible stamps');
  const before=await store(page);
  const p17=page.locator('#wrong-dev-p17-filter');
  await p17.selectOption('pending');
  const shown=page.locator('#records-list button[data-record]:visible');
  assert.equal(await shown.count(),1);
  assert.equal(await shown.first().getAttribute('data-record'),ids.valid);
  pass(width+'px P17 pending shows only timestamp-valid child explanation');
  assert.match(await page.locator('#records-count').textContent(),/부모 상태 필터 1건/);
  pass(width+'px P17 count agrees with visible pending stage');
  await page.locator('#v218-child-mode').click();
  assert.equal(await p17.isVisible(),false);
  assert.equal(await shown.count(),3);
  await page.locator('#v218-parent-mode').click();
  assert.equal(await p17.inputValue(),'pending');
  assert.equal(await shown.count(),1);
  pass(width+'px child never inherits parent pending status; return restores view');
  await p17.selectOption('all');assert.equal(await shown.count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+3,true);
  pass(width+'px entire original list remains accessible with no horizontal overflow');
  assert.deepEqual(await store(page),before);
  assert.deepEqual(errors,[]);
  pass(width+'px stored records and photos unchanged by filtering; no JS errors');
 }finally{await ctx.close()}
}
try{browser=await chromium.launch({headless:true});
 for(const width of [320,390])await run(width);
 console.log('WRONG_QA64_BROWSER_RESULT='+JSON.stringify({
  status:'PASS',checks,kind:'actual Chromium synthetic local dates/filter/stage',
  widths:[320,390],realFamilyData:0,authValidated:false,
  writesByFilter:0,safeToRestore:false,deployed:false}));
}catch(e){console.error('WRONG_QA64_BROWSER_RESULT='+JSON.stringify({
 status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1200)}));process.exitCode=1;
}finally{if(browser)await browser.close()}
