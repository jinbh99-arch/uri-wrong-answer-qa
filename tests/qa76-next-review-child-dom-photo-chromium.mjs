// QA76: NEW privacy path, nonmath parent's optional future-question draft/panel.
// Unlike QA74/75, this checks next recheck input and uses a real synthetic 1px photo.
// No OCR execution, external API, real family access or auth claims.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA76_SOURCE_DEV_SHA;
assert.match(SHA||'',/^[0-9a-f]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const question='QA76 가상 학부모 저장 질문: 빛의 반대쪽은?';
const draft='QA76 저장 전 부모 비공개 질문: 다음 확인할 그림은?';
let browser,preview,checks=0;
const pass=x=>{checks++;console.log('PASS WRONG QA76 '+x)};
async function snapshot(page){
 return page.evaluate(name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const rows=tx.objectStore('mistakes').getAll(),keys=tx.objectStore('photos').getAllKeys(),
    blobs=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{
    try{
     const pics=await Promise.all(keys.result.map(async(id,i)=>({
      id,type:blobs.result[i].type,
      bytes:Array.from(new Uint8Array(await blobs.result[i].arrayBuffer()))
     })));
     db.close();resolve({rows:rows.result,photos:pics});
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
try{
 preview=await startWrongQa66Preview({devSha:SHA,username:'qa76-local-fake',password:randomBytes(25).toString('hex')});
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username:preview.username,password:preview.password},acceptDownloads:false});
 const page=await context.newPage(),outside=[],errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('blob:')&&!u.startsWith('data:'))outside.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA76 합성 그림자 과학 사진 문제');
 await page.locator('#take-photo').setInputFiles({name:'qa76-fake-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
 await page.locator('#detail-image img').waitFor({timeout:15000});
 let stored=await snapshot(page);
 assert.equal(stored.rows.length,1);
 assert.equal(stored.photos.length,1);
 assert.equal(stored.photos[0].id,stored.rows[0].id);
 pass('320px synthetic photo-backed nonmath mistake saved with bytes and ID');

 await page.locator('#v230-answer').fill('QA76 아이 가상답: 오른쪽');
 await page.locator('#v230-explanation').fill('QA76 아이 가상설명: 빛의 반대쪽');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:15000});
 const when=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 await page.locator('#wrong008-next-date').fill(when);
 await page.locator('#wrong008-next-question').fill(question);
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(q=>document.querySelector('#check-history')?.textContent?.includes(q),question,{timeout:15000});
 assert.ok((await page.locator('#check-history').innerText()).includes(question));
 pass('saved parent follow-up question is a real observation-history entry');

 await page.locator('#wrong008-next-question').fill(draft);
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#wrong008-next-question').inputValue(),draft);
 pass('unsaved parent future-question blocks child switch and preserves draft');

 await page.locator('#wrong008-next-question').fill('');
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#wrong008-next-review').count(),0,
  'hidden parent review panel must not remain in child DOM');
 assert.equal(await page.locator('#wrong008-jump-note').count(),0);
 let child=await page.evaluate(([saved,unwritten])=>({
  saved:document.body.textContent.includes(saved),
  unwritten:document.body.textContent.includes(unwritten),
  photoVisible:!!document.querySelector('#detail-image img')?.getClientRects().length
 }),[question,draft]);
 assert.deepEqual(child,{saved:false,unwritten:false,photoVisible:true});
 pass('child detail removes parent next-review panel/draft and retains question photo');

 await page.locator('#nav-home').click();
 await page.locator('#nav-records').click();
 await page.locator('#records-list button[data-record]').first().click();
 await page.locator('#detail-text').waitFor();
 assert.equal(await page.locator('#wrong008-next-review').count(),0,
  'child revisiting the record recreated parent-only panel');
 assert.ok(!(await page.evaluate(x=>document.body.textContent.includes(x),question)));
 pass('child reentry cannot recreate hidden parent question DOM');

 await page.locator('#v218-parent-mode').click();
 await page.locator('#wrong008-next-question').waitFor({timeout:15000});
 await page.waitForFunction(q=>document.querySelector('#check-history')?.textContent?.includes(q),question,{timeout:15000});
 assert.ok((await page.locator('#check-history').innerText()).includes(question));
 const after=await snapshot(page);
 assert.deepEqual(after,await snapshot(page),'repeat stable read');
 assert.equal(after.rows.length,stored.rows.length);
 assert.equal(after.photos.length,stored.photos.length);
 assert.deepEqual(after.photos,stored.photos);
 assert.deepEqual(outside,[]);
 assert.deepEqual(errors,[]);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323);
 pass('parent return restores saved question; original synthetic photo bytes preserved and no JS/network/overflow');
 console.log('WRONG_QA76_RESULT='+JSON.stringify({status:'PASS',checks,
  sourceDevSha:SHA,realChromium:true,viewport:320,syntheticPhoto:true,
  parentQuestionAbsentFromChildDOM:true,
  operationalStorageSeparated:false,authenticationVerified:false,safeToRestore:false,deployed:false}));
 await context.close();
}catch(e){
 console.error('WRONG_QA76_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),
  stack:String(e?.stack).slice(0,1400),safeToRestore:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
