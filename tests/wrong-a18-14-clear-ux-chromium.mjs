import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('qa/a18_14_patched.html','utf8');
mkdirSync('artifacts/a18-14',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
for(const width of [320,390]){
 const context=await browser.newContext({viewport:{width,height:780},serviceWorkers:'block'});
 const page=await context.newPage();
 let dialogs=0;const errors=[];
 page.on('dialog',d=>{dialogs++;d.dismiss()});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('http')?route.abort():route.continue());
 await page.goto('file://'+process.cwd()+'/qa/a18_14_patched.html');
 await page.waitForTimeout(500);
 const before=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('wrong-a18-14-probe',1);r.onupgradeneeded=()=>r.result.createObjectStore('keep');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
   await new Promise((resolve,reject)=>{const t=db.transaction('keep','readwrite');t.objectStore('keep').put('immutable','sentinel');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
   db.close();return 'immutable';
 });
 const button=page.locator('#clear-all');
 await button.evaluate(el=>el.click());
 await page.waitForTimeout(250);
 const visible=await page.locator('body').innerText();
 assert(visible.includes('전체 삭제는 복원 안전성 검증 전까지 보류됩니다.'),'missing UX warning');
 assert.equal(dialogs,0,'unexpected native confirmation');
 assert.equal(errors.length,0,'page error '+errors.join(','));
 await page.screenshot({path:'artifacts/a18-14/clear-ux-'+width+'.png',fullPage:true});
 results.push({width,warning:true,dialogs,errors,syntheticSentinel:before});
 await context.close();
}
await browser.close();
writeFileSync('artifacts/a18-14/results.json',JSON.stringify(results,null,2));
console.log('A18_14_CLEAR_UX_NEW_CASES_PASS',JSON.stringify(results));