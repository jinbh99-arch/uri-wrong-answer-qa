// WRONG QA65: NEW combined real Chromium, P14 parent vs child on invalid
// imported-like retry time, P18/P19 zoomed original-list return. Synthetic only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const APP='http://127.0.0.1:4173/',DB='uriaimath-github-qa-v224-only';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA65 CHROMIUM '+s)};
async function saved(page){return page.evaluate(name=>new Promise((resolve,reject)=>{
 const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
 req.onsuccess=()=>{const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly'),
  a=tx.objectStore('mistakes').getAll(),b=tx.objectStore('photos').getAllKeys();
  tx.onerror=()=>{db.close();reject(tx.error)};
  tx.oncomplete=()=>{db.close();resolve({rows:a.result,photoKeys:b.result})};
 };
}),DB)}
async function create(page,title){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(title);
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await page.locator('#nav-records').click();
 const row=page.locator('#records-list button[data-record]').filter({hasText:title});
 await row.waitFor();await row.click();
 await page.locator('#v230-answer').fill('가상 계산');
 await page.locator('#v230-explanation').fill('가상 아이 설명');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),
  null,{timeout:18000});
 await page.locator('#nav-home').click();
}
async function retime(page,id,at){await page.evaluate(({name,id,at})=>new Promise((ok,no)=>{
 const open=indexedDB.open(name);open.onerror=()=>no(open.error);
 open.onsuccess=()=>{const db=open.result,tx=db.transaction('mistakes','readwrite');
  tx.onerror=()=>{db.close();no(tx.error)};
  tx.oncomplete=()=>{db.close();ok(true)};
  const st=tx.objectStore('mistakes'),get=st.get(id);
  get.onsuccess=()=>{if(!get.result){tx.abort();return}
   get.result.generalRetryHistory.at(-1).at=at;
   st.put(get.result,id);
  };
 };
}),{name:DB,id,at})}
async function scenario(width){
 const ctx=await browser.newContext({viewport:{width,height:760}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const titles={valid:'QA65 유효한 아이설명 '+width,bad:'QA65 비정상 날짜 '+width,future:'QA65 미래 시각 '+width};
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  for(const title of Object.values(titles)){await create(page,title);await page.waitForTimeout(20)}
  const initial=await saved(page);assert.equal(initial.rows.length,3);
  const ids=Object.fromEntries(Object.keys(titles).map(key=>[key,initial.rows.find(r=>r.problemText===titles[key])?.id]));
  assert.ok(Object.values(ids).every(Boolean));
  await retime(page,ids.bad,'2026-02-30T08:00:00Z');
  await retime(page,ids.future,new Date(Date.now()+86400000).toISOString());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav-home').click();
  const one=page.locator('#qa9-next-open');await one.waitFor();
  assert.equal(await one.getAttribute('data-record'),ids.valid);
  assert.match(await one.textContent(),/아이 설명 보고 부모가 관찰하기/);
  pass(width+'px P14 parent selects only valid child explanation over newer invalid/future records');
  await one.click();
  await page.waitForFunction(()=>document.activeElement?.id==='v230-review',null,{timeout:8000});
  assert.match(await page.locator('#detail-text').textContent(),/유효한 아이설명/);
  pass(width+'px P14 parent CTA opens original valid ID and focuses observation');
  await page.locator('#nav-home').click();
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await page.locator('#nav-records').click();
  const sel=page.locator('#wrong-dev-p17-filter');
  await page.waitForFunction(()=>document.activeElement?.id==='wrong-dev-p17-filter',null,{timeout:4000});
  assert.equal(await sel.isVisible(),true);
  await sel.selectOption('pending');
  const visible=page.locator('#records-list button[data-record]:visible');
  assert.equal(await visible.count(),1);
  assert.equal(await visible.first().getAttribute('data-record'),ids.valid);
  pass(width+'px P18/P19 zoom 200 parent pending filter agrees with parent first action');
  await visible.first().click();
  await page.locator('#page-detail:visible').waitFor();
  assert.match(await page.locator('#detail-text').textContent(),/유효한 아이설명/);
  await page.locator('#page-detail [data-route="records"]').click();
  await page.waitForFunction(()=>document.activeElement?.id==='wrong-dev-p17-filter',null,{timeout:4000});
  assert.equal(await sel.inputValue(),'pending');
  assert.equal(await visible.count(),1);
  pass(width+'px P18/P19 original detail return restores parent filter and zoom focus');
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.locator('#nav-home').click();
  await page.locator('#v218-child-mode').click();
  const next=page.locator('#wrong-child-next-list button[data-wrong-child-pick]');
  await next.first().waitFor();
  assert.match(await next.first().textContent(),/미래 시각/);
  assert.equal(await one.isVisible(),false);
  pass(width+'px P14 child sees newest registered item independently from parent CTA');
  const before=await saved(page);
  assert.equal(before.rows.length,3);
  assert.deepEqual(before.photoKeys,[]);
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+3,true);
  pass(width+'px original 3 records remain intact, no JS errors or horizontal overflow');
 }finally{await ctx.close()}
}
try{browser=await chromium.launch({headless:true});
 for(const width of [320,390])await scenario(width);
 console.log('WRONG_QA65_BROWSER_RESULT='+JSON.stringify({status:'PASS',checks,
 type:'real Chromium mixed invalid/future parent child and zoom200 return',
 widths:[320,390],realChildren:0,realAuth:false,safeToRestore:false,deployed:false}));
}catch(e){console.error('WRONG_QA65_BROWSER_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(e),stack:String(e?.stack).slice(0,1400),safeToRestore:false}));process.exitCode=1;
}finally{if(browser)await browser.close()}
