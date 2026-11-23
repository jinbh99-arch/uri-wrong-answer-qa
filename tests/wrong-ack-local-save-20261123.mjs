import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV_SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const CANDIDATE_SHA=process.env.WRONG_ACK_ALL_FIELDS_SHA||'WORKTREE_UNCOMMITTED';
const DB='uriaimath-github-qa-v224-only';
const OUT=new URL('../qa-proof/wrong-ack-local-save-20261123/',import.meta.url);
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

async function openEdit(page){
  if(await page.locator('#cancel-edit').isVisible()){
    await page.locator('#cancel-edit').click();
    await page.locator('#dlg-ok').click();
  }else await page.locator('#nav-records').click();
  await page.locator('#records-list button[data-record]').first().click();
  await page.locator('#detail-edit').click();
}


await mkdir(OUT,{recursive:true});
let preview,browser;
const cases=[];
try{
  const username='ack-local-save',password=randomBytes(24).toString('hex');
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

    const edits=[
      ['#student-answer',field=>field.fill('합성 답안 수정')],
      ['#memo',field=>field.fill('합성 메모 수정')],
      ['#wrong007-grade',field=>field.selectOption('4')]
    ];
    for(const [selector,apply] of edits){
      await openEdit(page);
      await page.locator('#problem').fill('합성 저장 '+selector);
      // Pause the real post-commit photo comparison without adding form listeners.
      await page.evaluate(()=>{
        const original=Blob.prototype.arrayBuffer;
        window.ackReadStarted=false;
        Blob.prototype.arrayBuffer=async function(...args){
          Blob.prototype.arrayBuffer=original;
          window.ackReadStarted=true;
          await new Promise(resolve=>{window.releaseAckRead=resolve});
          return original.apply(this,args);
        };
      });
      await page.locator('#save-btn').click();
      await page.waitForFunction(()=>window.ackReadStarted);
      await apply(page.locator(selector));
      await page.evaluate(()=>window.releaseAckRead());
      await page.getByText('최신 기록을 다시 열어 현재 수정 내용을 반영해 주세요.',{exact:false}).waitFor({timeout:4000});
      assert.equal(await page.locator('#v09-save-confirm:not(.hide)').count(),0);
      const ledger=await readLedger(page);
      assert.equal(ledger.rows.length,1);
      assert.equal(ledger.rows[0].id,initial.rows[0].id);
      assert.equal(ledger.rows[0].problemText,'합성 저장 '+selector);
      assert.equal(hash(Buffer.from(ledger.photos[0].bytes)),initialPhotoHash);
    }
    await openEdit(page);
    await page.locator('#memo').fill('합성 읽기 확인 실패');
    await page.evaluate(()=>{
      const original=Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer=async function(){
        Blob.prototype.arrayBuffer=original;
        throw new Error('Synthetic local photo read failure');
      };
    });
    await page.locator('#save-btn').click();
    await page.getByText('저장 동작은 실행됐으나 저장 후 확인에 실패했습니다.',{exact:false}).waitFor();
    const beforeRetry=await readLedger(page);
    assert.equal(beforeRetry.rows[0].memo,'합성 읽기 확인 실패');
    await page.evaluate(()=>{
      const transaction=IDBDatabase.prototype.transaction;
      window.retryWriteCount=0;
      IDBDatabase.prototype.transaction=function(stores,mode,...options){
        if(mode==='readwrite')window.retryWriteCount++;
        return transaction.call(this,stores,mode,...options);
      };
    });
    await page.locator('#memo').fill('합성 재시도에서 저장되면 안 되는 내용');
    await page.locator('#save-btn').click();
    await page.getByText('이전 저장 기록을 확인했습니다.',{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.retryWriteCount),0);
    assert.deepEqual(await readLedger(page),beforeRetry);
    assert.deepEqual(external,[]);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:fileURLToPath(new URL('ack-local-'+width+'.png',OUT)),fullPage:true});
    cases.push({width,staleConfirmationsSuppressed:3,readbackRetryChangedRows:0,readbackRetryWriteTransactions:0,
      photoSha256:initialPhotoHash,externalRequests:0});
    console.log('ok '+cases.length+' - '+width+'px local save ACK');
    await context.close();
  }
  await writeFile(new URL('evidence.json',OUT),JSON.stringify({
    candidateQaSha:CANDIDATE_SHA,realChromium:true,realIndexedDB:true,remoteAck:'NOT_TESTED',
    safeToRestore:false,cases},null,2)+'\n');
  await writeFile(new URL('result.tap',OUT),'TAP version 13\n'+cases.map((c,i)=>
    'ok '+(i+1)+' - '+c.width+'px local save ACK').join('\n')+'\n1..'+cases.length+'\n');
}finally{
  if(browser)await browser.close();
  if(preview)await preview.close();
}
