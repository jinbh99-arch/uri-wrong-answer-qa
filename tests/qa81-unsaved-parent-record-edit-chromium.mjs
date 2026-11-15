// QA81: NEW unsaved parent record-edit memo on SAME synthetic mistake.
// Distinct from QA75: this changes the saved parent record memo IN the edit form
// before attempting parent -> child mode, and proves no silent loss or child DOM leak.
// Existing QA74-79 are NOT rerun.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA=process.env.WRONG_QA81_DEV_SHA;
assert.match(SHA||'',/^[a-f0-9]{40}$/);
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const saved='QA81 기존 가상 부모 메모 · 그림자의 방향';
const draft='QA81 아직 저장하지 않은 부모 메모 · 아이에게 절대 노출 금지';
let browser,preview,checks=0,shots=0;
mkdirSync('qa-proof/qa81',{recursive:true});
const pass=label=>{checks++;console.log('PASS QA81 '+label)};
async function screenshot(page,label){
  const path='qa-proof/qa81/'+String(++shots).padStart(2,'0')+'-'+label+'.png';
  await page.screenshot({path,fullPage:true,animations:'disabled'});
  console.log('QA81_PNG='+path);
}
async function snapshot(page){
  return page.evaluate(name=>new Promise((resolve,reject)=>{
    const r=indexedDB.open(name);r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{
      const db=r.result,tx=db.transaction(['mistakes','photos'],'readonly');
      const rows=tx.objectStore('mistakes').getAll();
      const keys=tx.objectStore('photos').getAllKeys();
      const photos=tx.objectStore('photos').getAll();
      tx.onerror=()=>{db.close();reject(tx.error)};
      tx.oncomplete=async()=>{
        try{
          const pictures=await Promise.all(keys.result.map(async(id,i)=>({
            id,mime:photos.result[i].type,
            bytes:Array.from(new Uint8Array(await photos.result[i].arrayBuffer()))
          })));
          db.close();resolve({rows:rows.result,pictures});
        }catch(e){db.close();reject(e)}
      };
    };
  }),DB);
}
async function exposure(page){
  return page.evaluate(({saved,draft})=>{
    const body=document.body.textContent||'';
    const visible=document.body.innerText||'';
    const values=[...document.querySelectorAll('input,textarea,select')].map(el=>el.value||'');
    const fields=[...document.querySelectorAll('#memo,#check-memo,#wrong008-next-question,#detail-memo')].map(el=>({
      id:el.id,value:el.value||'',text:el.textContent||''
    }));
    const has=(txt)=>body.includes(txt)||visible.includes(txt)||values.some(v=>v.includes(txt))||
      fields.some(f=>f.text.includes(txt)||f.value.includes(txt));
    return {savedLeak:has(saved),draftLeak:has(draft)};
  },{saved,draft});
}

try{
  const username='qa81-fake-local',password=randomBytes(24).toString('hex');
  preview=await startWrongQa66Preview({devSha:SHA,username,password});
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({
    viewport:{width:320,height:760},deviceScaleFactor:1,
    httpCredentials:{username,password},acceptDownloads:false
  });
  const page=await ctx.newPage(),errors=[],outside=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(preview.url))return route.continue();
    if(!url.startsWith('blob:')&&!url.startsWith('data:'))outside.push(url);
    return route.abort();
  });
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(SHA));
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill('QA81 같은 가상 과학 문제: 빛이 오른쪽이면 그림자는?');
  await page.locator('#student-answer').fill('QA81 가상 아이 답: 왼쪽');
  await page.locator('#memo').fill(saved);
  await page.locator('#take-photo').setInputFiles({name:'qa81-fake-1px.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:15000});
  await page.locator('#detail-memo').waitFor({timeout:15000});
  const before=await snapshot(page);
  assert.equal(before.rows.length,1);assert.equal(before.pictures.length,1);
  assert.equal(before.rows[0].memo,saved);
  assert.equal(before.pictures[0].id,before.rows[0].id);
  pass('one synthetic parent record and identical photo ID recorded');

  await page.locator('#detail-edit').click();
  assert.equal(await page.locator('#memo').inputValue(),saved);
  await page.locator('#memo').fill(draft);
  assert.equal(await page.locator('#memo').inputValue(),draft);
  await screenshot(page,'parent-unsaved-record-memo');

  // A pending parent draft must not silently switch to child / discard the draft.
  await page.locator('#v218-child-mode').click();
  const active=await page.locator('#v218-parent-mode').getAttribute('aria-pressed');
  const value=await page.locator('#memo').inputValue();
  console.log('QA81_AFTER_ATTEMPT='+JSON.stringify({
    stayedParent:active==='true',draftRetained:value===draft,
    inputTextPreserved:value===draft,modeSwitchBlocked:active==='true'
  }));
  await screenshot(page,'after-child-switch-attempt');
  assert.equal(active,'true','unsaved parent edit switched to child without safely preserving the draft');
  assert.equal(value,draft,'unsaved parent edit was lost on attempted mode switch');
  assert.deepEqual(await snapshot(page),before,'attempted mode switch wrote record/photo');
  pass('unsaved parent record edit protected from child-mode switch and IDB unchanged');

  // Explicit user cancellation is an allowed discard; no automatic save.
  await page.locator('#cancel-edit').click();
  await page.waitForFunction(text=>document.querySelector('#detail-memo')?.textContent?.includes(text),saved);
  assert.deepEqual(await snapshot(page),before,'cancelling draft altered the original IDB record');
  await page.locator('#v218-child-mode').click();
  assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
  const leak=await exposure(page);
  console.log('QA81_CHILD_DOM_AUDIT='+JSON.stringify(leak));
  assert.deepEqual(leak,{savedLeak:false,draftLeak:false},
    'saved or discarded parent memo persists in child DOM/value');
  await screenshot(page,'child-after-explicit-discard');
  pass('child DOM/text/visible fields contain neither saved nor discarded parent memo');

  await page.locator('#v218-parent-mode').click();
  await page.waitForFunction(text=>document.querySelector('#detail-memo')?.textContent?.includes(text),saved);
  const after=await snapshot(page);
  assert.deepEqual(after,before,'parent/child mode journey changed the exact saved photo or record');
  assert.equal(after.rows[0].memo,saved);
  assert.equal(after.pictures.length,1);
  await screenshot(page,'parent-returns-saved-original');
  pass('parent return restores saved note; unsaved draft absent; exact record and photo bytes unchanged');

  assert.deepEqual(errors,[],'JavaScript page errors');
  assert.deepEqual(outside,[],'unexpected external requests');
  assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=323,'320px horizontal overflow');
  pass('320px clean JS/network/overflow and safeToRestore stays false');
  console.log('QA81_RESULT='+JSON.stringify({status:'PASS',checks,shots,sha:SHA,
    width:320,syntheticOnly:true,realChromium:true,originalRecordAndPhotoUnchanged:true,
    unsavedDraftProtected:true,childHiddenDomScrubbed:true,
    safeToRestore:false,realFamilyAuth:false,realOCR:false,realPhone:false,
    operationalIsolationVerified:false}));
  await ctx.close();
}catch(e){
  console.error('QA81_RESULT='+JSON.stringify({status:'FAIL',checks,shots,
    error:String(e),stack:String(e?.stack).slice(0,1400),safeToRestore:false}));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  if(preview)await preview.close();
}
