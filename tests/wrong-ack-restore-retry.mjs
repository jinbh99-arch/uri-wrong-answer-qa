import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV_SHA='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const CANDIDATE_SHA=process.env.WRONG_ACK_RESTORE_SHA||'WORKTREE_UNCOMMITTED';
const DB='uriaimath-github-qa-v224-only';
const OUT=new URL('../qa-proof/wrong-ack-restore-retry/',import.meta.url);
const BASELINE=process.argv.includes('--baseline');
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
      const rows=[];
      op.onsuccess=()=>{
        if(method!=='openCursor')return resolve(op.result);
        const cursor=op.result;
        if(!cursor)return resolve(rows);
        rows.push(cursor.value);cursor.continue();
      };
      op.onerror=()=>reject(op.error);
    });
    const [rows,keys,blobs]=await Promise.all([
      read('mistakes','openCursor'),read('photos','getAllKeys'),read('photos','getAll')]);
    const photos=await Promise.all(blobs.map(async(blob,index)=>({id:String(keys[index]),
      bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))})));
    db.close();return {rows,photos};
  },DB);
}

await mkdir(OUT,{recursive:true});
const cases=[];
const username='ack-restore-retry',password=randomBytes(24).toString('hex');
const preview=await startWrongQa66Preview({devSha:DEV_SHA,username,password});
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:900},httpCredentials:{username,password}});
    const page=await context.newPage(),external=[],posts=[],errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('**/*',route=>{
      const request=route.request();
      if(request.method()==='POST')posts.push(request.url());
      if(request.url().startsWith(preview.url))return route.continue();
      external.push(request.url());return route.abort();
    });
    await page.goto(preview.url,{waitUntil:'domcontentloaded'});
    await page.locator('#nav-add').click();
    await page.locator('#problem').fill('Synthetic restore failure '+width);
    await page.locator('#take-photo').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:PNG});
    await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
    await page.evaluate(()=>{
      const getAll=IDBObjectStore.prototype.getAll;
      const transaction=IDBDatabase.prototype.transaction;
      window.restoreProbe={failures:0,writes:0};
      IDBObjectStore.prototype.getAll=function(...args){
        if(this.name==='mistakes'&&this.transaction.mode==='readonly'&&window.restoreProbe.failures<2){
          window.restoreProbe.failures++;
          throw new Error('Synthetic restore list read failure');
        }
        return getAll.apply(this,args);
      };
      IDBDatabase.prototype.transaction=function(stores,mode,...args){
        if(mode==='readwrite')window.restoreProbe.writes++;
        return transaction.call(this,stores,mode,...args);
      };
    });
    const save=page.locator('#save-btn'),status=page.locator('#form-error');
    const confirmation=page.locator('#v09-save-confirm:not(.hide)');
    await save.click();
    await page.waitForFunction(()=>window.restoreProbe.failures===1);
    await status.filter({hasText:'저장 동작은 실행됐으나'}).waitFor();
    assert.equal(await confirmation.count(),0);
    const initialWrites=await page.evaluate(()=>window.restoreProbe.writes);
    assert.ok(initialWrites>0);
    // Snapshot committed data through an uninstrumented getAllKeys/get path.
    const first=await readLedger(page);
    assert.equal(first.rows.length,1);
    assert.equal(first.photos.length,1);
    assert.equal(first.photos[0].id,first.rows[0].id);
    await save.click();
    await page.waitForFunction(()=>window.restoreProbe.failures===2);
    await status.filter({hasText:BASELINE?'저장 동작은 실행됐으나':'이전 저장을 확인할 수 없습니다'}).waitFor();
    assert.equal(await confirmation.count(),0);
    const second=await readLedger(page);
    const writesAfterFailure=await page.evaluate(()=>window.restoreProbe.writes);
    if(BASELINE){
      assert.equal(second.rows.length,2);
      assert.equal(new Set(second.rows.map(row=>row.id)).size,2);
      assert.ok(writesAfterFailure>initialWrites);
    }else{
      assert.equal(writesAfterFailure,initialWrites);
      assert.deepEqual(second,first);
      await save.click();
      await status.filter({hasText:'이전 저장 기록을 확인했습니다'}).waitFor();
      assert.equal(await confirmation.count(),0);
      assert.equal(await page.evaluate(()=>window.restoreProbe.writes),initialWrites);
      assert.deepEqual(await readLedger(page),first);
    }
    assert.deepEqual(posts,[]);
    assert.deepEqual(external,[]);
    assert.deepEqual(errors,[]);
    const mode=BASELINE?'baseline':'candidate';
    await page.screenshot({path:fileURLToPath(new URL(mode+'-'+width+'.png',OUT)),fullPage:true});
    cases.push({width,initialWrites,retryWrites:writesAfterFailure-initialWrites,
      rowsAfterRetry:second.rows.length,photoSha256:hash(Buffer.from(first.photos[0].bytes)),
      storedIds:second.rows.map(row=>row.id),restoreFailures:2,posts:posts.length,
      successfulReadOnlyRetry:!BASELINE});
    await context.close();
  }
  const mode=BASELINE?'baseline':'candidate';
  const tap='TAP version 13\n'+cases.map((item,i)=>
    'ok '+(i+1)+' - '+item.width+'px '+(BASELINE?'duplicate reproduced':'read-only recovery')).join('\n')+'\n1..'+cases.length+'\n';
  await writeFile(new URL(mode+'.tap',OUT),tap);
  await writeFile(new URL(mode+'.json',OUT),JSON.stringify({source:CANDIDATE_SHA,browser:browser.version(),
    remoteAck:'NOT_TESTED',safeToRestore:false,cases},null,2)+'\n');
  process.stdout.write(tap);
}finally{
  if(browser)await browser.close();
  await preview.close();
}
