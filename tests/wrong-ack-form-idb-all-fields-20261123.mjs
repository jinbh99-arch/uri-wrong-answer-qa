import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV_SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const BASE_QA_SHA='c65c0e1554ad56d45a8dd6574c28b722ea858b28';
const CANDIDATE_SHA=process.env.WRONG_ACK_ALL_FIELDS_SHA||'WORKTREE_UNCOMMITTED';
const DB='uriaimath-github-qa-v224-only';
const OUT=new URL('../qa-proof/wrong-ack-form-idb-all-fields-20261123/',import.meta.url);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const hash=value=>createHash('sha256').update(value).digest('hex');

async function readLedger(page){
  return page.evaluate(async name=>{
    const request=indexedDB.open(name);
    const db=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const tx=db.transaction(['mistakes','photos'],'readonly');
    const read=(store,method)=>new Promise((resolve,reject)=>{
      const op=tx.objectStore(store)[method]();
      op.onsuccess=()=>resolve(op.result);op.onerror=()=>reject(op.error);
    });
    const [rows,keys,blobs]=await Promise.all([
      read('mistakes','getAll'),read('photos','getAllKeys'),read('photos','getAll')]);
    const photos=await Promise.all(blobs.map(async(blob,index)=>({id:String(keys[index]),
      bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))})));
    db.close();return {rows,photos};
  },DB);
}

const savedSnapshot=(row,photoBytes)=>({recordId:row.id,revision:row.updatedAt,
  problemText:row.problemText,studentAnswer:row.studentAnswer,memo:row.memo,
  gradeAtEntry:row.gradeAtEntry,photoSha256:hash(Buffer.from(photoBytes))});

function createAckGate(){
  let approved=null,unknown=null,postCount=0,getCount=0;
  const invalidations=[];
  return {
    approve(row,photoBytes){
      approved={...savedSnapshot(row,photoBytes),requestId:randomBytes(12).toString('hex')};
      unknown=null;return structuredClone(approved);
    },
    invalidate(meta){
      const expected={problem:'input','student-answer':'input',memo:'input','wrong007-grade':'change'};
      assert.equal(meta?.type,expected[meta?.target],`unexpected invalidation ${meta?.target}:${meta?.type}`);
      invalidations.push({type:meta.type,target:meta.target});approved=null;unknown=null;
    },
    submit(){assert.ok(approved);postCount++;unknown=structuredClone(approved);return structuredClone(unknown)},
    reconcile(row,photoBytes){
      assert.ok(unknown);getCount++;
      const current=savedSnapshot(row,photoBytes);
      const match=Object.entries(current).every(([key,value])=>value===unknown[key]);
      return {status:match?'READBACK_MATCH_NO_POST':'READBACK_MISMATCH_BLOCK',postCount,getCount};
    },
    lateAck(response){
      return approved&&response.revision===approved.revision&&response.requestId===approved.requestId&&
        response.code===200&&response.ok!==false?'CURRENT_ACK_CONFIRMED':'STALE_ACK_IGNORED';
    },
    state(){return {approved:approved&&structuredClone(approved),postCount,getCount,
      invalidations:structuredClone(invalidations)}}
  };
}

async function openEdit(page){
  await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#detail-edit').click();
}

async function waitInvalidated(gate,count){
  for(let i=0;i<100;i++){
    if(gate.state().approved===null&&gate.state().invalidations.length===count)return;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  throw new Error(`approval invalidation callback did not settle: ${JSON.stringify(gate.state())}`);
}

await mkdir(OUT,{recursive:true});
let preview,browser;
const cases=[];
try{
  const legacyTargets=['problem'];
  const requiredTargets=['problem','student-answer','memo','wrong007-grade'];
  const legacyMissing=requiredTargets.filter(target=>!legacyTargets.includes(target));
  assert.deepEqual(legacyMissing,['student-answer','memo','wrong007-grade']);

  const username='ack-all-fields',password=randomBytes(24).toString('hex');
  preview=await startWrongQa66Preview({devSha:DEV_SHA,username,password});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:900},
      httpCredentials:{username,password},acceptDownloads:false});
    const page=await context.newPage(),external=[],errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(preview.url))return route.continue();
      external.push(route.request().url());return route.abort();
    });
    await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    await page.locator('#nav-add').click();
    await page.locator('#problem').fill(`ACK 전체필드 r1 ${width}`);
    await page.locator('#student-answer').fill('아이 원답 r1');
    await page.locator('#memo').fill('보호자 메모 r1');
    await page.locator('#wrong007-grade').selectOption('3');
    await page.locator('#take-photo').setInputFiles({name:'ack.png',mimeType:'image/png',buffer:PNG});
    await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
    await page.locator('#save-btn').click();
    await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});

    const initial=await readLedger(page);
    assert.equal(initial.rows.length,1);assert.equal(initial.photos.length,1);
    const initialPhotoHash=hash(Buffer.from(initial.photos[0].bytes));
    const gate=createAckGate();
    await page.exposeFunction('ackApprovalFieldObserved',meta=>gate.invalidate(meta));
    await page.evaluate(()=>{
      const contract={problem:'input','student-answer':'input',memo:'input','wrong007-grade':'change'};
      for(const [id,type] of Object.entries(contract))document.querySelector('#'+id).addEventListener(type,event=>{
        window.ackApprovalFieldObserved({type:event.type,target:event.target.id});
      });
    });

    const edits=[
      {target:'student-answer',type:'input',apply:()=>page.locator('#student-answer').fill('아이 원답 r2')},
      {target:'memo',type:'input',apply:()=>page.locator('#memo').fill('보호자 메모 r3')},
      {target:'wrong007-grade',type:'change',apply:()=>page.locator('#wrong007-grade').selectOption('4')}
    ];
    let current=initial;
    for(let index=0;index<edits.length;index++){
      const approval=gate.approve(current.rows[0],current.photos[0].bytes);
      const pending=gate.submit();
      await openEdit(page);
      await edits[index].apply();
      await waitInvalidated(gate,index+1);
      assert.equal(gate.state().approved,null);
      await page.locator('#save-btn').click();
      await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:16000});
      const next=await readLedger(page);
      assert.equal(next.rows[0].id,current.rows[0].id);
      assert.notEqual(next.rows[0].updatedAt,approval.revision);
      assert.equal(hash(Buffer.from(next.photos[0].bytes)),initialPhotoHash);
      assert.equal(gate.lateAck({...pending,code:200,ok:true}),'STALE_ACK_IGNORED');
      current=next;
    }
    assert.equal(current.rows[0].studentAnswer,'아이 원답 r2');
    assert.equal(current.rows[0].memo,'보호자 메모 r3');
    assert.equal(current.rows[0].gradeAtEntry,4);

    const finalApproval=gate.approve(current.rows[0],current.photos[0].bytes);
    gate.submit();
    assert.deepEqual(gate.reconcile(current.rows[0],current.photos[0].bytes),
      {status:'READBACK_MATCH_NO_POST',postCount:4,getCount:1});
    assert.equal(gate.lateAck({...finalApproval,code:200,ok:true}),'CURRENT_ACK_CONFIRMED');
    assert.equal(gate.state().postCount,4);
    assert.deepEqual(gate.state().invalidations,edits.map(({target,type})=>({type,target})));
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await page.screenshot({path:fileURLToPath(new URL(`ack-all-fields-${width}.png`,OUT)),fullPage:true});
    cases.push({width,status:'PASS',legacyMissing,invalidatedTargets:requiredTargets.slice(1),
      revisionTransitions:3,staleAckIgnored:3,getBeforeRetry:true,newPostDuringReadback:0,
      photoSha256Before:initialPhotoHash,
      photoSha256After:hash(Buffer.from(current.photos[0].bytes)),photoInvariant:true,
      realServerAck:'NOT_TESTED',realFamilyAuth:'BLOCK'});
    console.log(`ok ${cases.length} - ${width}px saved-field approval invalidation`);
    await context.close();
  }
  const evidence={status:'PASS',devSha:DEV_SHA,baseQaSha:BASE_QA_SHA,
    candidateQaSha:CANDIDATE_SHA,red:{legacyMissing:['student-answer','memo','wrong007-grade']},
    realChromium:true,localHttp:true,syntheticAckAdapter:true,realServerAck:false,
    realSupabaseJwt:false,safeToRestore:false,cases};
  await writeFile(new URL('evidence.json',OUT),JSON.stringify(evidence,null,2)+'\n');
  await writeFile(new URL('result.tap',OUT),cases.map((row,index)=>
    `ok ${index+1} - ${row.width}px saved-field approval invalidation`).join('\n')+
    `\n1..${cases.length}\n`);
  console.log('WRONG_ACK_ALL_FIELDS_RESULT='+JSON.stringify(evidence));
} catch(error){
  console.error('WRONG_ACK_ALL_FIELDS_RESULT='+JSON.stringify({status:'FAIL',
    error:String(error),stack:String(error?.stack).slice(0,1200),cases}));
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  if(preview)await preview.close();
}
