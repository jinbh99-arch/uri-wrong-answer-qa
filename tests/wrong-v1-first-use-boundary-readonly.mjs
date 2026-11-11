// Targeted read-only first-use parent boundary clarity check.
// 320/390 CSS100/200: pre-existing QA P19 HTML vs ONE top notice text change.
// No synthetic child photos or family records; no production network, no restores.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

if(process.env.WRONG_FIRST_USE_SYNTHETIC_ONLY!=='1')
 throw Error('SYNTHETIC_FIRST_USE_GATE_REQUIRED');

const baseline='ff20d6caa2f23a7c610f574b86a61587d8b8b644';
const before=execFileSync('git',['show',baseline+':index.html'],{maxBuffer:8*1024*1024}).toString('utf8');
const after=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const original='본 버전은 저장 안정성을 검증 중입니다.</div>';
const replacement='<strong>이 브라우저에 저장한 사진·관찰도 안전한 복원은 보장되지 않습니다.</strong></div>';
assert.ok(before.includes(original));
assert.equal(after,before.replace(original,replacement),'only the one visible original first-use note text may change');
const scriptMap={
 '/scripts/qa-inapp-sync-bridge.mjs':readFileSync(new URL('../scripts/qa-inapp-sync-bridge.mjs',import.meta.url)),
 '/scripts/qa47-live-auth-lab.mjs':readFileSync(new URL('../scripts/qa47-live-auth-lab.mjs',import.meta.url))
};
const dir='test-results/wrong-first-use-boundary';
const evidence={type:'narrow QA one original top warning wording',baseline,syntheticOnly:true,
 productNoAuth:true,safeToRestore:false,realFamilyUsed:false,realPhotoUsed:false,
 restorePerformed:false,externalHttp:0,checks:[],screenshots:[],measurements:[]};
function pass(x){evidence.checks.push(x);console.log('PASS WRONG_FIRST_USE '+evidence.checks.length+' '+x)}
let server,browser,context;
try{
 mkdirSync(dir,{recursive:true});
 server=createServer((req,res)=>{
  const p=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&(p==='/base'||p==='/candidate')){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   return res.end(p==='/base'?before:after);
  }
  if(req.method==='GET'&&Object.hasOwn(scriptMap,p)){
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
   return res.end(scriptMap[p]);
  }
  res.writeHead(404);res.end('NOT_FOUND');
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',hasTouch:true,isMobile:true});
 await context.route('**/*',route=>{
  const u=route.request().url();
  if(/^https?:/.test(u)&&new URL(u).origin!==origin){evidence.externalHttp++;return route.abort()}
  return route.continue();
 });
 const page=await context.newPage();
 async function inspect(stage){
  const a=await page.evaluate(()=>{
   const note=document.querySelector('[role="note"]');
   const mode=document.querySelector('.v218-mode-note');
   const nav=document.querySelector('#nav-add');
   const banner=document.querySelector('#storage-banner');
   const cta=document.querySelector('#wrong-p13-go');
   const rect=e=>{const r=e?.getBoundingClientRect();return !r?null:{
    y:+r.y.toFixed(1),bottom:+r.bottom.toFixed(1),x:+r.x.toFixed(1),
    right:+r.right.toFixed(1),height:+r.height.toFixed(1),width:+r.width.toFixed(1)
   }};
   return {size:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,
    overflow:document.documentElement.scrollWidth-innerWidth,scrollY:scrollY,
    rootRoleNoteCount:document.querySelectorAll('[role="note"]').length,
    note:{text:note?.textContent?.trim(),role:note?.getAttribute('role'),
     rect:rect(note),display:note?getComputedStyle(note).display:null},
    mode:{text:mode?.textContent?.trim(),rect:rect(mode)},
    banner:{text:banner?.textContent?.trim(),rect:rect(banner)},
    navAdd:{rect:rect(nav),text:nav?.textContent?.trim()},
    hero:{rect:rect(document.querySelector('header'))},
    firstAction:{text:cta?.textContent?.trim(),rect:rect(cta)},
    bodyHasParentClass:document.body.classList.contains('v218-child')===false,
    signedInClaim:document.body.textContent?.includes('로그인 완료')||false};
  });
  evidence.measurements.push({stage,...a});return a;
 }
 for(const spec of [{w:320,h:720,z:1},{w:320,h:720,z:2},{w:390,h:844,z:1},{w:390,h:844,z:2}]){
  const tag=spec.w+'-'+spec.z+'x';
  const pair={};
  for(const [pageName,isCandidate] of [['base',false],['candidate',true]]){
   await page.setViewportSize({width:spec.w,height:spec.h});
   assert.equal((await page.goto(origin+'/'+pageName)).status(),200);
   await page.locator('#nav-add').waitFor();
   await page.waitForFunction(()=>document.querySelector('#storage-banner')?.textContent?.includes('이 브라우저에만 보관'));
   await page.evaluate(z=>{document.body.style.zoom=z===2?'2':''},spec.z);
   await page.waitForTimeout(50);
   const r=await inspect(tag+' '+pageName);pair[pageName]=r;
   assert.equal(r.overflow,0,tag+' root horizontal overflow');
   assert.equal(r.note.role,'note');
   assert.ok(r.note.rect.width>0&&r.note.rect.height>0);
   assert.ok(r.note.rect.x>=0&&r.note.rect.right<=spec.w);
   assert.ok(r.note.rect.y>=0,'top warning should follow hero without clipping');
   assert.ok(r.mode.text.includes('계정·비밀번호 보호가 아닙니다'));
   assert.ok(r.banner.text.includes('이 브라우저에만 보관'));
   assert.ok(r.note.text.includes('개인정보를 입력하지 마세요'));
   assert.equal(r.bodyHasParentClass,true);
   assert.equal(r.signedInClaim,false);
   if(isCandidate){
    assert.ok(r.mode.text.includes('계정·비밀번호 보호가 아닙니다'));
    assert.ok(r.note.text.includes('사진·관찰'));
    assert.ok(r.note.text.includes('안전한 복원은 보장되지 않습니다'));
   }else{
    assert.ok(!r.note.text.includes('안전한 복원은 보장되지 않습니다'));
   }
   await page.screenshot({path:dir+'/'+tag+'-'+pageName+'-firstscreen.png',fullPage:false});
   evidence.screenshots.push(tag+'-'+pageName+'-firstscreen.png');
  }
  const first=pair.base,updated=pair.candidate;
  const shift=updated.note.rect.height-first.note.rect.height;
  assert.ok(shift<=100,'first-use text must not expand banner excessively '+tag+': '+shift);
  assert.ok(updated.navAdd.rect.height>=44,'original register nav remains touchable');
  evidence.measurements.push({stage:tag+' delta',warningNewHeight:shift,
    firstViewportNoteBaseline:first.note.rect.bottom<=spec.h,
    firstViewportNoteCandidate:updated.note.rect.bottom<=spec.h,
    shiftedNavAddPx:+(updated.navAdd.rect.y-first.navAdd.rect.y).toFixed(1),
    shiftedFirstActionPx:updated.firstAction.rect&&first.firstAction.rect?
      +(updated.firstAction.rect.y-first.firstAction.rect.y).toFixed(1):null,
    noPhotoOrRecordStorageWritten:true});
  pass(tag+' original vs one top note: parent/child != auth & local photo/observations != safe restore, readable DOM, root overflow0');
 }
 assert.equal(evidence.externalHttp,0);
 evidence.result='PASS';evidence.count=evidence.checks.length;
 writeFileSync(dir+'/evidence.json',JSON.stringify(evidence,null,2));
 console.log('WRONG_FIRST_USE_RESULT='+JSON.stringify({status:'PASS',checks:evidence.count,
  png:evidence.screenshots.length,conditions:4,productHtmlChangesOneNote:true,
  externalHTTP:0,realFamilyUsed:false,realPhotoUsed:false,
  autoWrites:0,safeToRestore:false}));
}catch(e){
 evidence.result='FAIL';evidence.error=String(e);evidence.stack=String(e?.stack||'').slice(0,2500);
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/evidence.json',JSON.stringify(evidence,null,2));
 console.error('WRONG_FIRST_USE_RESULT='+JSON.stringify({status:'FAIL',
  checks:evidence.checks.length,error:String(e),safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(server)await new Promise((ok,no)=>server.close(e=>e?no(e):ok()));
}
