import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const BASELINE_SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const CANDIDATE_SHA=process.env.WRONG_FAIL_CLOSED_SHA||'WORKTREE_UNCOMMITTED';
const DB='uriaimath-github-qa-v224-only';
const OUT=new URL('../qa-proof/wrong-child-approved-list-fail-closed-20261123/',import.meta.url);
const sha=value=>createHash('sha256').update(value).digest('hex');

async function createTextRecord(page,index,width){
  await page.locator('#nav-add').click();
  await page.locator('#problem').fill(`비공개 승인 전 문제 ${width}-${index}`);
  await page.locator('#student-answer').fill(`비공개 아이 원답 ${width}-${index}`);
  await page.locator('#memo').fill(`비공개 보호자 메모 ${width}-${index}`);
  await page.locator('#save-btn').click();
  await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
}

async function seedLocalOnlyFlagsAndPhoto(page){
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
    if(rows.length!==3)throw new Error('expected three local records');
    rows.forEach((row,index)=>{
      row.guardianApproval={state:index===1?'draft_unapproved':'approved',revision:row.updatedAt};
      row.localAck=index===2?'ACK_UNKNOWN':'ACK_CONFIRMED';
      row.familyId=index===2?'family-B':'family-A';
      row.ocrPreview=`비공개 OCR 초안 ${index}`;
      row.ocrStatus='browser_ocr_unconfirmed';
    });
    rows[0].hasPhoto=true;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['mistakes','photos'],'readwrite');
      rows.forEach(row=>tx.objectStore('mistakes').put(row,row.id));
      tx.objectStore('photos').put(new Blob(['QA-FAKE-PHOTO-BYTES'],{type:'image/png'}),rows[0].id);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    db.close();
    return rows.map(row=>({id:row.id,updatedAt:row.updatedAt}));
  },DB);
}

async function snapshot(page){
  return page.evaluate(async name=>{
    const open=indexedDB.open(name);
    const db=await new Promise((resolve,reject)=>{
      open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
    });
    const tx=db.transaction(['mistakes','photos'],'readonly');
    const rowReq=tx.objectStore('mistakes').getAll();
    const photoReq=tx.objectStore('photos').getAll();
    const rows=await new Promise((resolve,reject)=>{
      rowReq.onsuccess=()=>resolve(rowReq.result);rowReq.onerror=()=>reject(rowReq.error);
    });
    const photos=await new Promise((resolve,reject)=>{
      photoReq.onsuccess=()=>resolve(photoReq.result);photoReq.onerror=()=>reject(photoReq.error);
    });
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();
    rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const photoEvidence=[];
    for(const blob of photos){
      const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      photoEvidence.push({size:blob.size,type:blob.type,sha256:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')});
    }
    return {rows,photoEvidence};
  },DB);
}

await mkdir(OUT,{recursive:true});
let preview,browser;
const cases=[];
try{
  const username='fail-closed',password=randomBytes(24).toString('hex');
  preview=await startWrongQa66Preview({devSha:BASELINE_SHA,username,password});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,
      httpCredentials:{username,password},acceptDownloads:false});
    const page=await context.newPage(),external=[],pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(String(error)));
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(preview.url))return route.continue();
      external.push(route.request().url());return route.abort();
    });
    await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    for(let i=0;i<3;i++)await createTextRecord(page,i,width);
    const seeded=await seedLocalOnlyFlagsAndPhoto(page);
    const before=await snapshot(page);
    const beforeRowsHash=sha(JSON.stringify(before.rows));
    const beforePhotoHash=sha(JSON.stringify(before.photoEvidence));
    await page.reload({waitUntil:'domcontentloaded'});

    await page.locator('#v218-child-mode').click();
    await page.locator('#nav-home').click();
    assert.equal(await page.locator('#wrong-child-next-list [data-wrong-child-pick]').count(),0);
    assert.match(await page.locator('#wrong-child-next-list').innerText(),/목록을 닫았습니다/);
    const childDom=await page.locator('body').textContent();
    for(const marker of ['비공개 승인 전 문제','비공개 아이 원답','비공개 보호자 메모','비공개 OCR 초안'])
      assert.doesNotMatch(childDom,new RegExp(marker),`${marker} leaked at ${width}px`);
    await page.locator('#nav-records').click();
    assert.equal(await page.locator('#page-home').isVisible(),true,'child records route must fail closed');
    assert.equal(await page.locator('#records-list button[data-record]').count(),0,
      'child must not receive a selectable all-records list');

    const contract=await page.evaluate(({seeded,local})=>{
      const make=(items,overrides={})=>({schema:'wrong-child-approval-v1',providerVerified:true,
        guardianAuthorized:true,ackState:'confirmed',familyId:'family-A',childId:'child-A',
        ledgerRevision:'ledger-7',items:items.map(row=>({recordId:row.id,
          recordRevision:row.updatedAt,state:'approved',ackState:'confirmed',familyId:'family-A',
          childId:'child-A',ledgerRevision:'ledger-7'})),...overrides});
      const result={
        zero:globalThis.__wrongQaApprovalGate(local,make([])),
        one:globalThis.__wrongQaApprovalGate(local,make(seeded.slice(0,1))),
        many:globalThis.__wrongQaApprovalGate(local,make(seeded)),
        ackUnknown:globalThis.__wrongQaApprovalGate(local,make(seeded,{ackState:'ACK_UNKNOWN'})),
        noProvider:globalThis.__wrongQaApprovalGate(local,make(seeded,{providerVerified:false})),
        familyB:globalThis.__wrongQaApprovalGate(local,make(seeded.map(row=>({...row})),{
          familyId:'family-B'}))
      };
      return result;
    },{seeded,local:before.rows});
    assert.equal(contract.zero.status,'verified');assert.equal(contract.zero.rows.length,0);
    assert.equal(contract.one.rows.length,1);assert.equal(contract.many.rows.length,3);
    assert.equal(contract.ackUnknown.status,'blocked');assert.equal(contract.noProvider.status,'blocked');
    assert.equal(contract.familyB.rows.length,0);
    for(const row of contract.many.rows){
      assert.deepEqual(Object.keys(row).sort(),['createdAt','gradeAtEntry','hasPhoto','id',
        'problemText','recordRevision','subject'].sort());
      assert.equal('memo' in row||'studentAnswer' in row||'ocrPreview' in row,false);
    }

    await page.screenshot({path:fileURLToPath(new URL(`blocked-${width}.png`,OUT)),fullPage:true});
    await page.locator('#v218-parent-mode').click();
    await page.locator('#nav-records').click();
    const first=page.locator('#records-list button[data-record]').filter({hasText:`비공개 승인 전 문제 ${width}-0`});
    await first.click();
    await page.locator('#detail-edit').click();
    await page.locator('#problem').fill(`비공개 승인 전 문제 ${width}-0 수정`);
    await page.locator('#save-btn').click();
    await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
    const editedSnapshot=await snapshot(page);
    const stale=await page.evaluate(({seeded,local})=>{
      const old=seeded[0];
      return globalThis.__wrongQaApprovalGate(local,{schema:'wrong-child-approval-v1',providerVerified:true,
        guardianAuthorized:true,ackState:'confirmed',familyId:'family-A',childId:'child-A',
        ledgerRevision:'ledger-7',items:[{recordId:old.id,recordRevision:old.updatedAt,
          state:'approved',ackState:'confirmed',familyId:'family-A',childId:'child-A',
          ledgerRevision:'ledger-7'}]});
    },{seeded,local:editedSnapshot.rows});
    assert.equal(stale.rows.length,0,'post-edit stale approval must be invalidated');

    await page.locator('#v218-child-mode').click();
    assert.equal(await page.locator('#wrong-child-next-list [data-wrong-child-pick]').count(),0);
    const after=await snapshot(page);
    assert.equal(sha(JSON.stringify(after.photoEvidence)),beforePhotoHash,'photo bytes changed');
    assert.equal(after.rows.length,before.rows.length,'record count changed');
    assert.equal(after.photoEvidence.length,before.photoEvidence.length,'photo count changed');
    const editedId=seeded[0].id;
    assert.deepEqual(after.rows.filter(row=>row.id!==editedId),
      before.rows.filter(row=>row.id!==editedId),'unrelated IDB records changed');
    assert.equal(after.rows.find(row=>row.id===editedId)?.hasPhoto,true,'edited record lost photo binding');
    assert.deepEqual(external,[]);assert.deepEqual(pageErrors,[]);
    const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(scrollWidth<=width+3,`horizontal overflow ${scrollWidth} at ${width}`);
    cases.push({width,status:'PASS',localFlagsIgnored:true,childChoices:0,
      privateDomMarkers:0,recordsRouteBlocked:true,contractOnlyApprovedCounts:[0,1,3],
      ackUnknownBlocked:true,familyBMismatchRows:0,postEditStaleRows:0,
      beforeRowsHash,afterRowsHash:sha(JSON.stringify(after.rows)),
      photoHashBefore:beforePhotoHash,photoHashAfter:sha(JSON.stringify(after.photoEvidence)),
      photoInvariant:true,selectionBack:'NOT_TESTED_NO_TRUSTED_PROVIDER',scrollWidth});
    console.log(`ok ${cases.length} - ${width}px fail-closed child approval boundary`);
    await context.close();
  }
  const evidence={status:'PASS',baselineDevSha:BASELINE_SHA,candidateQaSha:CANDIDATE_SHA,
    realChromium:true,localHttp:true,syntheticTrustedContractOnly:true,
    realSupabaseJwt:false,remoteServerAck:false,productApprovedListEnabled:false,
    safeToRestore:false,cases};
  await writeFile(new URL('evidence.json',OUT),JSON.stringify(evidence,null,2)+'\n');
  await writeFile(new URL('result.tap',OUT),cases.map((row,index)=>
    `ok ${index+1} - ${row.width}px fail-closed child approval boundary`).join('\n')+
    `\n1..${cases.length}\n`);
  console.log('WRONG_CHILD_APPROVAL_FAIL_CLOSED_RESULT='+JSON.stringify(evidence));
} catch(error){
  console.error('WRONG_CHILD_APPROVAL_FAIL_CLOSED_RESULT='+JSON.stringify({status:'FAIL',
    error:String(error),stack:String(error?.stack).slice(0,1200),cases}));
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  if(preview)await preview.close();
}
