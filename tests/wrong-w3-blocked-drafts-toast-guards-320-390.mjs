// W3 NEW negative regression: a blocked parent->child switch MUST keep the draft
// and show its warning. Once all drafts are cleared a successful switch must
// clear any parent-only toast. Synthetic loopback and IndexedDB ONLY.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV_SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const W3_BLOB='6ff6cf1c2cfeef3706381a68fc105feab8258b04';
const blobSha=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
assert.equal(blobSha(readFileSync('index.html')),W3_BLOB,'Expected approved W3 4-line QA-only candidate');
const DB='uriaimath-github-qa-v224-only';
const out='qa-proof/w3-blocked-draft-guards';
mkdirSync(out,{recursive:true});
const report={status:'IN_PROGRESS',devSha:DEV_SHA,candidateBlob:W3_BLOB,checks:0,
 widths:{},shots:[],pageErrors:[],externalRequests:[],syntheticOnly:true,
 productionMutation:false,actualFamilyAuth:false,realDevice:false,safeToRestore:false};
let browser,preview;
function pass(label,width){report.checks++;console.log('W3_GUARD_PASS '+width+' '+label)}
async function shot(page,width,label){
 const p=out+'/'+width+'-'+label+'.png';
 await page.screenshot({path:p,animations:'disabled',fullPage:false});
 report.shots.push(p);
}
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(dbName);
  o.onerror=()=>reject(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const m=tx.objectStore('mistakes').getAll(),p=tx.objectStore('photos').getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve({rows:m.result,photoIds:p.result})};
  };
 }),DB);
}
async function blocked(page,fieldId,prefix,expectText,width){
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'false',
  prefix+' should block child mode');
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('v218-child')),false);
 assert.equal(await page.locator(fieldId).inputValue(),expectText,
  prefix+' draft must remain unchanged');
 const toast=page.locator('#toast');
 const text=await toast.textContent();
 assert.ok(text?.includes(prefix),'blocked-switch warning removed or missing: '+text);
 assert.equal(await toast.isVisible(),true,'guard warning must not be suppressed');
 assert.equal(await page.locator('#toast').evaluate(el=>el.classList.contains('hide')),false);
 await shot(page,width,'guard-'+prefix.replaceAll(' ','-'));
}
try{
 const auth={username:'w3-guard-fake',password:randomBytes(28).toString('hex')};
 preview=await startWrongQa66Preview({devSha:DEV_SHA,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({
   viewport:{width,height:width===320?800:850},
   httpCredentials:auth,acceptDownloads:false
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))
    return route.continue();
   report.externalRequests.push(url);
   return route.abort();
  });
  const resp=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(resp?.status(),200);
  const initial=await snapshot(page);
  assert.deepEqual(initial,{rows:[],photoIds:[]});
  // Guard #1. Parent is on unsaved ADD draft. A forbidden transition MUST
  // leave the field, warning and original route intact.
  await page.locator('#nav-add').click();
  const addText='W3 합성 미저장 오답 차단 '+width;
  await page.locator('#problem').fill(addText);
  await blocked(page,'#problem','입력 중인 오답',addText,width);
  assert.equal(await page.locator('#page-add').isVisible(),true);
  assert.deepEqual(await snapshot(page),initial);
  pass('unsaved add blocks; warning visible; ledger intact',width);

  // Discard only the synthetic ADD, then save one synthetic record.
  await page.locator('#nav-home').click();
  await page.locator('#confirm-dialog[open]').waitFor({timeout:10000});
  await page.locator('#dlg-ok').click();
  await page.locator('#nav-add').click();
  const saved='W3 합성 부모 메모 질문 차단 확인 '+width;
  await page.locator('#problem').fill(saved);
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
  // WRONG-008 shows the next-question form only after a non-math retry.
  await page.locator('#v230-answer').fill('합성 재풀이 답안 '+width);
  await page.locator('#v230-explanation').fill('합성 재풀이 설명 '+width);
  await page.locator('#v230-save').click();
  await page.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:15000});
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  assert.deepEqual(before.photoIds,[]);

  // Guard #2. Unsaved check-memo must stop child transition,
  // preserving the original warning instead of wiping all toasts.
  const memo='W3 합성 미저장 관찰 메모 '+width;
  await page.locator('#check-memo').fill(memo);
  await blocked(page,'#check-memo','저장하지 않은 부모 관찰 메모',memo,width);
  assert.equal(await page.locator('#detail-text').isVisible(),true);
  assert.deepEqual(await snapshot(page),before);
  pass('unsaved observation blocks; warning visible; ledger intact',width);

  // Guard #3. Unsaved next question must also keep the field and warning.
  await page.locator('#check-memo').fill('');
  const question='W3 합성 미저장 재확인 질문 '+width;
  await page.locator('#wrong008-next-question').fill(question);
  await blocked(page,'#wrong008-next-question','저장하지 않은 부모 재확인 질문',question,width);
  assert.deepEqual(await snapshot(page),before);
  pass('unsaved next question blocks; warning visible; ledger intact',width);

  // Now a genuine allowed parent->child transition must scrub the PARENT
  // warning. This assertion distinguishes blocked from allowed transitions.
  await page.locator('#wrong008-next-question').fill('');
  await page.locator('#v218-child-mode').click();
  assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#toast').textContent(),'');
  assert.equal(await page.locator('#toast').isVisible(),false);
  assert.deepEqual(await snapshot(page),before);
  pass('allowed switch removes previous warning without changing saved data',width);
  await shot(page,width,'allowed-child-no-parent-toast');

  await page.locator('#v218-parent-mode').click();
  assert.deepEqual(await snapshot(page),before);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.deepEqual(await snapshot(page),before);
  assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
  assert.ok((await page.locator('#records-list').count())>=0);
  pass('parent return and reload preserve synthetic saved ledger',width);
  report.widths[width]={status:'PASS',savedRows:before.rows.length,
   photos:before.photoIds.length,draftGuards:3,allowClean:1,reload:1};
  await ctx.close();
 }
 assert.equal(report.checks,10);
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.externalRequests,[]);
 report.status='PASS_W3_NEGATIVE_GUARDS';
}catch(e){
 report.status='FAIL';report.error=String(e);
 report.stack=String(e?.stack||'').slice(0,1800);
 process.exitCode=1;
 console.error('W3_GUARD_FAIL '+String(e));
}finally{
 await browser?.close();await preview?.close();
 writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 console.log('W3_GUARD_RESULT='+JSON.stringify({
  status:report.status,checks:report.checks,widths:Object.keys(report.widths),
  shots:report.shots.length,errors:report.pageErrors.length,
  external:report.externalRequests.length,error:report.error
 }));
}
