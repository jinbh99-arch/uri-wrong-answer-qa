import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const DB='uriaimath-github-qa-v224-only';

async function createTextRecord(page,text,memo){
  await page.locator('#nav-add').click();
  await page.locator('#problem').fill(text);
  await page.locator('#memo').fill(memo);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
}

async function assignSyntheticApprovalStates(page){
  return page.evaluate(async name=>{
    const open=indexedDB.open(name);
    const db=await new Promise((resolve,reject)=>{
      open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
    });
    const read=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
    const rows=await new Promise((resolve,reject)=>{
      read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);
    });
    rows.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    if(rows.length!==2)throw new Error('expected two synthetic records');
    rows[0].guardianApproval={state:'approved',revision:rows[0].updatedAt};
    rows[1].guardianApproval={state:'draft_unapproved',revision:null};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
      rows.forEach(row=>store.put(row,row.id));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    db.close();
    return rows.map(row=>({id:row.id,state:row.guardianApproval.state,problemText:row.problemText}));
  },DB);
}

let preview,browser;
try{
  const username='approved-list-gap',password=randomBytes(24).toString('hex');
  preview=await startWrongQa66Preview({devSha:SHA,username,password});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:900},
      httpCredentials:{username,password},acceptDownloads:false});
    const page=await context.newPage();
    await page.route('**/*',route=>route.request().url().startsWith(preview.url)?route.continue():route.abort());
    await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    const approved='승인된 합성 오답 '+width;
    const unapproved='승인되지 않은 합성 오답 '+width;
    const privateMemo='부모 전용 메모 '+width;
    await createTextRecord(page,approved,'승인 기록 메모');
    await createTextRecord(page,unapproved,privateMemo);
    const fixtures=await assignSyntheticApprovalStates(page);
    assert.deepEqual(fixtures.map(x=>x.state),['approved','draft_unapproved']);

    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#v218-child-mode').click();
    await page.locator('#nav-home').click();
    const choices=page.locator('#wrong-child-next-list [data-wrong-child-pick]');
    await choices.first().waitFor();
    assert.equal(await choices.count(),2);
    const listText=await page.locator('#wrong-child-next-list').textContent();
    assert.match(listText,new RegExp(approved));
    assert.match(listText,new RegExp(unapproved),
      'draft/unapproved record should be absent from an approved-only child list');
    const childDom=await page.locator('body').textContent();
    assert.doesNotMatch(childDom,new RegExp(privateMemo));
    console.log('CHILD_APPROVAL_GAP_CASE='+JSON.stringify({width,records:2,
      approvedVisible:true,unapprovedVisible:true,parentMemoVisible:false,
      result:'APPROVAL_FILTER_MISSING_REPRODUCED'}));
    await context.close();
  }
  console.log('CHILD_APPROVAL_GAP_RESULT='+JSON.stringify({
    status:'SYNTHETIC_PRODUCT_UI_GAP_REPRODUCED',cases:2,
    actualFamilyAuth:'NOT_TESTED',serverApprovalLedger:'NOT_IMPLEMENTED',safeToRestore:false}));
} finally {
  if(browser)await browser.close();
  if(preview)await preview.close();
}
