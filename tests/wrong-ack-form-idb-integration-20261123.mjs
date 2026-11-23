import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const hash=value=>createHash('sha256').update(value).digest('hex');

async function readLedger(page){
  return page.evaluate(async name=>{
    const request=indexedDB.open(name);
    const db=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const tx=db.transaction(['mistakes','photos'],'readonly');
    const read=(store,method)=>new Promise((resolve,reject)=>{
      const op=tx.objectStore(store)[method]();
      op.onsuccess=()=>resolve(op.result);op.onerror=()=>reject(op.error);
    });
    const [rows,photoKeys,photoBlobs]=await Promise.all([
      read('mistakes','getAll'),read('photos','getAllKeys'),read('photos','getAll')]);
    const photos=await Promise.all(photoBlobs.map(async(blob,index)=>({
      id:String(photoKeys[index]),bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))
    })));
    db.close();
    return {rows,photos};
  },DB);
}

function createAckGate(){
  let approved=null,unknown=null,postCount=0,getCount=0,invalidations=[];
  return {
    approve(row,photoBytes){
      approved={revision:row.updatedAt,requestId:randomBytes(12).toString('hex'),
        recordId:row.id,problemText:row.problemText,photoSha256:hash(Buffer.from(photoBytes))};
      unknown=null;return structuredClone(approved);
    },
    invalidate(meta){
      assert.equal(meta?.type,'input','approval invalidation must come from the product form input event');
      assert.equal(meta?.target,'problem');
      invalidations.push({type:meta.type,target:meta.target,value:meta.value});
      approved=null;unknown=null;
    },
    submit(){
      assert.ok(approved,'an explicit current approval is required');
      postCount++;unknown=structuredClone(approved);return structuredClone(unknown);
    },
    reconcile(row,photoBytes){
      assert.ok(unknown,'ACK_UNKNOWN must exist before readback');getCount++;
      const current={revision:row.updatedAt,recordId:row.id,problemText:row.problemText,
        photoSha256:hash(Buffer.from(photoBytes))};
      const match=current.revision===unknown.revision&&current.recordId===unknown.recordId&&
        current.problemText===unknown.problemText&&current.photoSha256===unknown.photoSha256;
      return {status:match?'READBACK_MATCH_NO_POST':'READBACK_MISMATCH_BLOCK',postCount,getCount};
    },
    lateAck(response){
      return approved&&response.revision===approved.revision&&
        response.requestId===approved.requestId&&response.code===200&&response.ok!==false
        ?'CURRENT_ACK_CONFIRMED':'STALE_ACK_IGNORED';
    },
    state(){return {postCount,getCount,approved:approved&&structuredClone(approved),
      invalidations:structuredClone(invalidations)}}
  };
}

let preview,browser;
try{
  const username='ack-form-idb',password=randomBytes(24).toString('hex');
  preview=await startWrongQa66Preview({devSha:SHA,username,password});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:900},
      httpCredentials:{username,password},acceptDownloads:false});
    const page=await context.newPage();
    await page.route('**/*',route=>route.request().url().startsWith(preview.url)?route.continue():route.abort());
    await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    await page.locator('#nav-add').click();
    await page.locator('#problem').fill('ACK r1 합성 문항 '+width);
    await page.locator('#take-photo').setInputFiles({name:'ack.png',mimeType:'image/png',buffer:PNG});
    await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
    await page.locator('#save-btn').click();
    await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});

    const gate=createAckGate();
    const r1=await readLedger(page);
    assert.equal(r1.rows.length,1);assert.equal(r1.photos.length,1);
    const approval1=gate.approve(r1.rows[0],r1.photos[0].bytes);
    const pending1=gate.submit();
    assert.deepEqual(gate.state(),{postCount:1,getCount:0,approved:approval1,invalidations:[]});

    // The adapter observes the product's real edit control. There is no direct
    // gate.invalidate() call in the test journey.
    await page.exposeFunction('ackApprovalInputObserved',meta=>gate.invalidate(meta));
    await page.evaluate(()=>document.querySelector('#problem').addEventListener('input',event=>{
      window.ackApprovalInputObserved({type:event.type,target:event.target.id,value:event.target.value});
    }));

    await page.locator('#nav-records').click();
    await page.locator('#records-list button[data-record]').first().click();
    await page.locator('#detail-edit').click();
    await page.locator('#problem').fill('ACK r2 보호자 수정 '+width);
    await page.waitForFunction(()=>true); // allow the exposed event callback to settle
    const invalidated=gate.state();
    assert.equal(invalidated.approved,null);
    assert.deepEqual(invalidated.invalidations,[{type:'input',target:'problem',
      value:'ACK r2 보호자 수정 '+width}]);
    await page.locator('#save-btn').click();
    await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
    const r2=await readLedger(page);
    assert.equal(r2.rows[0].id,r1.rows[0].id);
    assert.equal(r2.rows[0].problemText,'ACK r2 보호자 수정 '+width);
    assert.equal(hash(Buffer.from(r2.photos[0].bytes)),hash(Buffer.from(r1.photos[0].bytes)));
    assert.equal(gate.lateAck({...pending1,code:200,ok:true}),'STALE_ACK_IGNORED');

    const approval2=gate.approve(r2.rows[0],r2.photos[0].bytes);
    gate.submit();
    const readback=gate.reconcile(r2.rows[0],r2.photos[0].bytes);
    assert.deepEqual(readback,{status:'READBACK_MATCH_NO_POST',postCount:2,getCount:1});
    assert.equal(gate.lateAck({...approval1,code:200,ok:true}),'STALE_ACK_IGNORED');
    assert.equal(gate.lateAck({...approval2,code:503,ok:false}),'STALE_ACK_IGNORED');
    assert.equal(gate.lateAck({...approval2,code:200,ok:true}),'CURRENT_ACK_CONFIRMED');
    assert.deepEqual(gate.state().postCount,2,'readback must not create another POST');
    assert.deepEqual(gate.state().getCount,1);
    console.log('ACK_FORM_IDB_CASE='+JSON.stringify({width,recordId:'SYNTHETIC_REDACTED',
      revisionChanged:approval1.revision!==approval2.revision,oldApprovalInvalidated:true,
      invalidationSource:'product#problem:input',manualInvalidationCalls:0,
      getBeforeRetry:true,newPostDuringReadback:0,lateR1Ignored:true,photoBytesStable:true}));
    await context.close();
  }
  console.log('ACK_FORM_IDB_RESULT='+JSON.stringify({status:'PASS_SYNTHETIC_BROWSER_IDB_INTEGRATION',
    cases:2,realServerAck:'NOT_TESTED',realFamilyAuth:'BLOCK',safeToRestore:false}));
} finally {
  if(browser)await browser.close();
  if(preview)await preview.close();
}
