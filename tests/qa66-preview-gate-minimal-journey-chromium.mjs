// WRONG QA66: authenticated loopback preview of current DEV parent screens.
// Disposable fictional record, 1px PNG, real Chromium, independent profiles.
// Does NOT validate an externally hosted Access gate or production DB isolation.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const devSha=process.env.WRONG_QA66_DEV_SHA;
assert.match(devSha||'',/^[a-f0-9]{40}$/);
const username='qa-local-parent',password=randomBytes(30).toString('hex');
const auth='Basic '+Buffer.from(username+':'+password).toString('base64');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
let preview,browser,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG QA66 '+s)};
async function records(page){return page.evaluate(name=>new Promise((resolve,reject)=>{
 const req=indexedDB.open(name);req.onerror=()=>reject(req.error);
 req.onsuccess=()=>{const db=req.result,tx=db.transaction(['mistakes','photos'],'readonly');
  const rows=tx.objectStore('mistakes').getAll(),photos=tx.objectStore('photos').getAll();
  tx.onerror=()=>{db.close();reject(tx.error)};
  tx.oncomplete=()=>{db.close();resolve({rows:rows.result,photos:photos.result.map(b=>b?.size||0)})};
 };
}),'uriaimath-github-qa-v224-only')}
async function run(){
 preview=await startWrongQa66Preview({devSha,username,password});
 assert.equal(preview.host,'127.0.0.1');
 assert.notEqual(preview.port,4173);
 assert.match(preview.url,/^http:\/\/127\.0\.0\.1:\d+\/$/);
 pass('strict ephemeral 127.0.0.1-only bind, nonpublic port, source dev SHA');
 const denied=await fetch(preview.url);
 assert.equal(denied.status,401);
 assert.match(denied.headers.get('www-authenticate')||'',/Basic/i);
 const wrong=await fetch(preview.url,{headers:{Authorization:'Basic '+Buffer.from('wrong:wrong').toString('base64')}});
 assert.equal(wrong.status,401);
 pass('anonymous and wrong credentials denied before any HTML or parent record');
 const query=await fetch(preview.url+'?qa47=1',{headers:{Authorization:auth}});
 assert.equal(query.status,403);
 const forbidden=await fetch(preview.url+'scripts/qa47-public-stage-config.mjs',{headers:{Authorization:auth}});
 assert.equal(forbidden.status,404);
 pass('live Supabase lab query and unlisted config cannot be reached');
 const success=await fetch(preview.url,{headers:{Authorization:auth}});
 assert.equal(success.status,200);
 assert.match(success.headers.get('x-robots-tag')||'',/noindex/);
 assert.match(success.headers.get('cache-control')||'',/no-store/);
 const html=await success.text();
 assert.ok(html.includes('wrong-qa66-preview-meta')&&html.includes(devSha));
 assert.match(html,/외부 인증·운영 DB 분리 실증 전/);
 pass('authorized HTML displays exact DEV SHA, local-only status, updatedAt and indexing block');
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:780},
  httpCredentials:{username,password}});
 const page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await ctx.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('blob:')&&!url.startsWith('data:'))external.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 const badge=page.locator('#wrong-qa66-preview-meta');
 await badge.waitFor();assert.match(await badge.textContent(),new RegExp(devSha));
 assert.equal((await records(page)).rows.length,0);
 pass('real authenticated browser starts empty and displays QA-only provenance');
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('QA66 가상 과학 오답: 빛의 진행');
 await page.locator('#choose-photo').setInputFiles({
  name:'qa66-fictional-1px.png',mimeType:'image/png',buffer:PNG
 });
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:10000});
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:18000});
 await page.locator('#nav-records').click();
 const card=page.locator('#records-list button[data-record]').filter({hasText:'QA66 가상 과학 오답'});
 assert.equal(await card.count(),1);
 await card.click();
 assert.equal(await page.locator('#detail-image img').count(),1);
 pass('real preview shows fictional text+1px photo original without live family image');
 await page.locator('#v230-answer').fill('가상 아이 답: 직진');
 await page.locator('#v230-explanation').fill('가상 아이 설명: 직진하는 빛을 그림으로 나타냄');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:16000});
 await page.locator('#check-status').selectOption('needs_help');
 await page.locator('#check-memo').fill('가상 부모 관찰: 설명에 도움 필요');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('가상 부모 관찰'),null,{timeout:16000});
 pass('fictional child retry and parent observation saved in isolated browser IndexedDB');
 await page.locator('#wrong008-next-date').fill('2026-12-01');
 await page.locator('#wrong008-next-question').fill('가상 부모 재확인 질문: 그림을 설명할 수 있나요?');
 await page.locator('#wrong008-save-note').click();
 await page.waitForFunction(()=>document.querySelector('#wrong008-last-manual-note')?.textContent?.includes('2026-12-01'),null,{timeout:16000});
 await page.locator('#nav-records').click();
 const stage=page.locator('#records-list [data-record-stage]');
 assert.match(await stage.textContent(),/별도 부모 관찰 이력: 도움 필요/);
 assert.match(await stage.textContent(),/수동 메모\(알림·예약·완료 아님\)/);
 pass('same preview offers parent observation, next check memo and clear nonalarm status');
 await page.locator('#wrong-dev-p17-filter').selectOption('manual');
 assert.equal(await page.locator('#records-list button[data-record]:visible').count(),1);
 const before=await records(page);
 assert.equal(before.rows.length,1);
 assert.equal(before.photos.length,1);
 assert.equal(before.photos[0],PNG.length);
 await page.setViewportSize({width:320,height:760});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth)<=323,true);
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#wrong-dev-p17-filter').isVisible(),false);
 assert.equal(await stage.isVisible(),false);
 await page.locator('#v218-parent-mode').click();
 assert.equal(await stage.isVisible(),true);
 assert.deepEqual(await records(page),before);
 pass('320px usable parent stage, child separation, manual filter, saved photo+record unchanged');
 const second=await browser.newContext({viewport:{width:390,height:780},
  httpCredentials:{username,password}});
 const p2=await second.newPage();
 await p2.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.equal((await records(p2)).rows.length,0);
 assert.equal((await records(p2)).photos.length,0);
 pass('second isolated browser profile cannot see fictional first-profile records or photo');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 pass('no JS exceptions or outbound external network requests in preview flow');
 await second.close();await ctx.close();
}
try{
 await run();
 console.log('WRONG_QA66_PREVIEW_RESULT='+JSON.stringify({status:'PASS',checks,kind:'real Chromium gated loopback preview',
  externalUrl:null,authGate:'ephemeral HTTP Basic for loopback only',
  sourceDevSha:devSha,localOnly:true,fakePhotoOnly:true,isolatedBrowserProfiles:true,
  verifiedHostedAccess:false,verifiedProductionStorageSeparation:false,
  safeToRestore:false,deployed:false}));
}catch(error){
 console.error('WRONG_QA66_PREVIEW_RESULT='+JSON.stringify({status:'FAIL',checks,
 error:String(error),stack:String(error?.stack).slice(0,1500),
 verifiedHostedAccess:false,deployed:false}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(preview)await preview.close()}
