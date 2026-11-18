// W3 unique delta: COMMITTED candidate index.html (not runtime-patched script).
// Integrated photo A saved -> photo B selected/cancelled -> child toast must clear
// -> parent reload returns saved record + original A blob SHA unchanged.
// Uses only ephemeral loopback synthetic PNGs/IndexedDB; NO actual family/photo data.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const ORIGINAL_DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const CANDIDATE_BLOB='6ff6cf1c2cfeef3706381a68fc105feab8258b04';
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const sha256=b=>createHash('sha256').update(b).digest('hex');
assert.equal(gitBlob(readFileSync('index.html')),CANDIDATE_BLOB,
 'Expected committed and QA-isolated 4-line GREEN source');
const DB='uriaimath-github-qa-v224-only';
const PNG_A=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGMUiVrFAANMDEgANwcANx4BICKd+I8AAAAASUVORK5CYII=','base64');
const PNG_B=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGN8367IAANMDEgANwcAUVABn2Zq2LgAAAAASUVORK5CYII=','base64');
assert.notEqual(sha256(PNG_A),sha256(PNG_B));
const out='qa-proof/w3-committed-candidate';
mkdirSync(out,{recursive:true});
const report={status:'IN_PROGRESS',sourceDev:ORIGINAL_DEV,candidateBlob:CANDIDATE_BLOB,
 checks:0,widths:{},shots:[],errors:[],outbound:[],photoAInputHash:sha256(PNG_A),
 photoBInputHash:sha256(PNG_B),syntheticOnly:true,safeToRestore:false,
 actualFamilyAuth:false,realPhone:false,productionMutation:false};
let preview,browser;
function pass(label,width){report.checks++;console.log('W3_CANDIDATE_PASS '+width+' '+label)}
async function picture(page,width,name){
 const p=out+'/'+width+'-'+name+'.png';
 await page.screenshot({path:p,animations:'disabled',fullPage:false});
 report.shots.push(p);
}
async function snapshot(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const q=indexedDB.open(dbName);q.onerror=()=>reject(q.error);
  q.onsuccess=()=>{
   const db=q.result,t=db.transaction(['mistakes','photos'],'readonly');
   const rows=t.objectStore('mistakes').getAll(),pkeys=t.objectStore('photos').getAllKeys(),pblobs=t.objectStore('photos').getAll();
   t.onerror=()=>{db.close();reject(t.error)};
   t.oncomplete=async()=>{
    try{
     const images=await Promise.all(pkeys.result.map(async(id,i)=>({
      id,type:pblobs.result[i].type,bytes:Array.from(new Uint8Array(await pblobs.result[i].arrayBuffer()))
     })));
     db.close();resolve({rows:rows.result,images});
    }catch(e){db.close();reject(e)}
   };
  };
 }),DB);
}
try{
 const auth={username:'w3-candidate-synthetic',password:randomBytes(28).toString('hex')};
 preview=await startWrongQa66Preview({devSha:ORIGINAL_DEV,...auth});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?800:850},
   httpCredentials:auth,acceptDownloads:false});
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(preview.url)||url.startsWith('data:')||url.startsWith('blob:'))
    return route.continue();
   report.outbound.push(url);return route.abort();
  });
  const response=await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  const savedProblem='W3 후보 사진A 원본 가상 과학 오답 '+width;
  const savedMemo='W3 후보 부모 저장 메모가 보존돼야 함 '+width;
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill(savedProblem);
  await page.locator('#memo').fill(savedMemo);
  await page.locator('#take-photo').setInputFiles({name:'W3-A.png',mimeType:'image/png',buffer:PNG_A});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
  await page.locator('#detail-image img').waitFor({timeout:15000});
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);
  assert.equal(before.images.length,1);
  assert.equal(before.rows[0].id,before.images[0].id);
  assert.equal(before.rows[0].problemText,savedProblem);
  assert.equal(before.rows[0].memo,savedMemo);
  const originalBlobHash=sha256(Buffer.from(before.images[0].bytes));
  pass('saved A record+blob identity',width);
  await picture(page,width,'01-parent-saved-A');

  // New integration path: old A remains while parent selects DIFFERENT B
  // in a fresh empty form, cancels that selection, then changes view instantly.
  await page.locator('#nav-add').click();
  await page.locator('#take-photo').setInputFiles({name:'W3-B-distinct.png',mimeType:'image/png',buffer:PNG_B});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#remove-photo').click();
  const cancelToast=await page.locator('#toast').textContent();
  assert.equal(cancelToast,'이번 사진 선택만 취소했습니다.');
  assert.equal(await page.locator('#toast').isVisible(),true);
  pass('different B photo cancel raises parent toast',width);
  await page.locator('#v218-child-mode').click();
  const child=await page.evaluate(()=>({
   child:document.body.classList.contains('v218-child'),
   modePressed:document.getElementById('v218-child-mode')?.getAttribute('aria-pressed'),
   toastText:document.getElementById('toast')?.textContent,
   toastHidden:document.getElementById('toast')?.classList.contains('hide'),
   documentWidth:document.documentElement.scrollWidth,
   rawParentMemoVisible:document.body.textContent.includes('W3 후보 부모 저장 메모가 보존돼야 함'),
   selectedPhotoFiles:document.querySelector('#take-photo')?.files.length||0
  }));
  assert.equal(child.child,true,'parent-to-child mode failed');
  assert.equal(child.modePressed,'true');
  assert.equal(child.toastText,'','stale parent toast remains in child DOM');
  assert.equal(child.toastHidden,true,'parent toast still visible in child');
  assert.equal(child.rawParentMemoVisible,false,'saved parent memo exposed to child DOM');
  assert.equal(child.selectedPhotoFiles,0,'parent B selection leaked');
  assert.ok(child.documentWidth<=width+3);
  pass('real child switch scrubs parent toast/fields at current candidate source',width);
  await picture(page,width,'02-child-no-parent-toast');
  assert.deepEqual(await snapshot(page),before,'mode switch changed saved A/photo A');
  pass('A record/photo unchanged by child switch',width);

  await page.locator('#v218-parent-mode').click();
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#detail-image img').waitFor({timeout:15000});
  assert.ok((await page.locator('#detail-memo').textContent()).includes(savedMemo));
  assert.deepEqual(await snapshot(page),before,'parent return changed saved ledger or photo');
  pass('parent return restores A memo and photo',width);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#detail-image img').waitFor({timeout:15000});
  const afterReload=await snapshot(page);
  assert.deepEqual(afterReload,before,'hard reload changed saved A ledger/photo');
  assert.equal(sha256(Buffer.from(afterReload.images[0].bytes)),originalBlobHash);
  assert.ok((await page.locator('#detail-memo').textContent()).includes(savedMemo));
  pass('hard reload preserves A byte SHA/record identity/memo',width);
  await picture(page,width,'03-parent-reload-original');
  report.widths[width]={status:'PASS',originalBlobSha256:originalBlobHash,
    originalId:before.rows[0].id,savedBytes:before.images[0].bytes.length,
    initialRecords:before.rows.length,photos:before.images.length,child};
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.outbound,[]);
 report.status='PASS_W3_COMMITTED_CANDIDATE_PHOTO_TOAST';
}catch(e){report.status='FAIL';report.error=String(e);
 report.stack=String(e?.stack||'').slice(0,1300);
 console.error('W3_CANDIDATE_FAIL '+String(e));process.exitCode=1;
}finally{
 await browser?.close();await preview?.close();
 writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 console.log('W3_CANDIDATE_RESULT='+JSON.stringify({status:report.status,checks:report.checks,
  widths:Object.keys(report.widths),shots:report.shots.length,errors:report.errors.length,
  outbound:report.outbound.length,error:report.error}));
}
