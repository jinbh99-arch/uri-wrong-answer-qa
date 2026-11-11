// 08 shared, synthetic-only browser harness. Candidate source is preserved byte-for-byte.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright';

const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const origin=new URL(BASE);
assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'QA08_LOOPBACK_ONLY');
const DB='uriaimath-github-qa-v224-only';
const OUT=resolve('tests/artifacts/qa08-wrong-backup');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const report={harness:'08-WRONG',basis:'b5219947a247a90753369a2d63681238fd222314',scope:'synthetic localhost only',status:'FAIL',downloads:[],checks:[],errors:[],realPersons:0,realPhotos:0,operationalWrites:0,safeToRestore:false};
const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name)};
async function stored(page){
 return page.evaluate(async dbName=>{
  const req=indexedDB.open(dbName);
  const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  const read=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const [records,keys,photos]=await Promise.all([
    read(tx.objectStore('mistakes').getAll()),
    read(tx.objectStore('photos').getAllKeys()),
    read(tx.objectStore('photos').getAll())]);
   const content=await Promise.all(keys.map(async(id,i)=>{
    const bytes=Array.from(new Uint8Array(await photos[i].arrayBuffer()));
    return {id,mime:photos[i].type,bytes};
   }));
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),photos:content};
  }finally{db.close()}
 },DB);
}
async function main(){
 await mkdir(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:780},acceptDownloads:true});
   try{
    const page=await context.newPage(),downloads=[],pageErrors=[];
    page.on('download',d=>downloads.push(d.suggestedFilename()));
    page.on('pageerror',e=>pageErrors.push(String(e)));
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('#nav-add').click();
    await page.locator('#wrong007-subject').selectOption('math');
    await page.locator('#wrong007-grade').selectOption('3');
    await page.locator('#problem').fill('08 가상 수학 기록 + 사진 '+width);
    await page.locator('#concept').selectOption('math.natural.addition');
    await page.locator('#choose-photo').setInputFiles({name:'qa08-synthetic.png',mimeType:'image/png',buffer:PNG});
    await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
    await page.locator('#save-btn').click();
    await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
    const before=await stored(page);
    check(width+'px synthetic record+photo saved (records='+before.records.length+',photos='+before.photos.length+',size='+(before.photos[0]?.bytes.length||0)+')',before.records.length===1&&before.photos.length===1&&before.photos[0].bytes.length>0);
    await page.locator('#nav-settings').click();
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    await page.locator('#export-json').click();
    check(width+'px explicit modal visible',await page.locator('#wrong-backup-confirm').isVisible());
    check(width+'px cancel receives initial focus',await page.evaluate(()=>document.activeElement?.id==='wrong-backup-cancel'));
    check(width+'px informed warning present',(await page.locator('#wrong-backup-description').innerText()).includes('비밀번호로 보호되지'));
    await page.keyboard.press('Shift+Tab');
    check(width+'px reverse focus trap',await page.evaluate(()=>document.activeElement?.id==='wrong-backup-continue'));
    await page.keyboard.press('Tab');
    check(width+'px forward focus trap',await page.evaluate(()=>document.activeElement?.id==='wrong-backup-cancel'));
    await page.screenshot({path:resolve(OUT,width+'-zoom200-modal.png'),animations:'disabled'});
    await page.locator('#wrong-backup-cancel').click();
    await page.waitForTimeout(400);
    check(width+'px cancel causes zero download',downloads.length===0);
    check(width+'px cancel returns focus',await page.evaluate(()=>document.activeElement?.id==='export-json'));
    await page.locator('#export-json').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check(width+'px Escape causes zero download',downloads.length===0);
    check(width+'px Escape returns focus',await page.evaluate(()=>document.activeElement?.id==='export-json'));
    check(width+'px cancel+Escape preserve local record/photo',JSON.stringify(before)===JSON.stringify(await stored(page)));
    await page.locator('#export-json').click();
    const [download]=await Promise.all([
     page.waitForEvent('download',{timeout:30000}),
     page.locator('#wrong-backup-continue').click()
    ]);
    check(width+'px explicit save triggers 1 download event',downloads.length===1);
    const tmp=resolve(tmpdir(),'qa08-'+randomUUID()+'.json');
    try{
     await download.saveAs(tmp);
     const bytes=await readFile(tmp);
     const data=JSON.parse(bytes.toString('utf8'));
     check(width+'px saved JSON format',data.format==='uriaimath-offline-backup-v02');
     check(width+'px saved JSON includes synthetic record',data.records.some(x=>x.problemText==='08 가상 수학 기록 + 사진 '+width));
     check(width+'px saved JSON includes photo',Object.keys(data.photos||{}).length===1);
     report.downloads.push({width,eventCount:downloads.length,savedFileCount:1,syntheticJSONSha256:createHash('sha256').update(bytes).digest('hex'),fileBytes:bytes.length});
    }finally{await rm(tmp,{force:true})}
    check(width+'px export preserves original local state',JSON.stringify(before)===JSON.stringify(await stored(page)));
    report.checks.push(width+'px CSS 200% simulated (Chromium; not OS screen-reader acceptance)');
    report.checks.push(width+'px page errors observed: '+pageErrors.length);
   }finally{await context.close()}
  }
  report.status='PASS';
 }finally{await browser.close()}
}
try{await main()}catch(e){report.errors.push(String(e.stack||e));process.exitCode=1}
finally{await mkdir(OUT,{recursive:true});await writeFile(resolve(OUT,'qa08-wrong-backup-result.json'),JSON.stringify(report,null,2),'utf8');console.log('QA08_WRONG_RESULT='+JSON.stringify({status:report.status,checkCount:report.checks.length,downloads:report.downloads,errors:report.errors}));}
