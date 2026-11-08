// QA32: synthetic family password rotation with authentication, revision,
// AES-GCM restart recovery, all-session revocation, delayed write race and
// real browser UX. Local loopback only; no real children or production accounts.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {randomBytes} from 'node:crypto';
import {request as rawHttpRequest} from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

const P1='QA32-SYNTHETIC-OLD-PASSWORD-2026';
const P2='QA32-SYNTHETIC-NEW-PASSWORD-2026';
const P3='QA32-SYNTHETIC-RENEWED-PASSWORD-2026';
const P4='QA32-SYNTHETIC-BROWSER-FINAL-PASSWORD-2026';
const PB='QA32-SYNTHETIC-OTHER-FAMILY-2026';
const F1='qa-family-32-a',F2='qa-family-32-b';
const tmp=mkdtempSync(join(tmpdir(),'qa32-rotation-'));
const store=join(tmp,'families.enc'),key=randomBytes(32).toString('hex');
const doc=(id)=>signSynthetic({format:'uriaimath-offline-backup-v02',
 profile:{grade:3,nickname:'QA32-SYNTHETIC'},
 records:[{id,problemText:'QA32-SYNTHETIC-'+id,hasPhoto:false,practiceHistory:[]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}});
const A=doc('qa32-a'),B=doc('qa32-b');
process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
let gate=null,browser=null,checks=0;
const pass=s=>{checks++;console.log('PASS QA32 G15',s)};
async function api(path,method='GET',body,token,rev,extra={}){
 const headers={...extra};if(token)headers.authorization='Bearer '+token;
 if(rev!==undefined&&rev!==null)headers['if-match']='"'+rev+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:res.status,data:await res.json(),headers:res.headers};
}
async function login(family,password,expected=200){
 const x=await api('/qa/login','POST',{familyKey:family,password});
 assert.equal(x.status,expected,'unexpected login status '+JSON.stringify(x.data));
 return x.data.token;
}
function form(oldPassword,newPassword,overrides={}){
 return {familyKey:F1,oldPassword,newPassword,approved:true,
  confirmation:'ROTATE_SYNTHETIC_PASSWORD',...overrides};
}
function slowPut(body,token,revision){
 const json=JSON.stringify(body),url=new URL(gate.baseUrl+'/qa/snapshot');
 let finish;
 const outcome=new Promise((resolve,reject)=>{
  const req=rawHttpRequest(url,{method:'PUT',headers:{
   authorization:'Bearer '+token,'if-match':'"'+revision+'"',
   'content-type':'application/json','transfer-encoding':'chunked'
  }},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));
   res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())}));
  });
  req.on('error',reject);
  req.write(json.slice(0,Math.floor(json.length/2)));
  finish=()=>req.end(json.slice(Math.floor(json.length/2)));
 });
 return {outcome,finish:()=>finish()};
}
async function start(){
 gate=await createIsolatedQaFamilyGateway({durablePath:store,encryptionKey:key});
}
try{
 await start();
 assert.equal((await api('/qa/register','POST',{familyKey:F1,password:P1})).status,201);
 assert.equal((await api('/qa/register','POST',{familyKey:F2,password:PB})).status,201);
 const a1=await login(F1,P1),a2=await login(F1,P1),b1=await login(F2,PB);
 assert.equal((await api('/qa/snapshot','PUT',A,a1,0)).status,200);
 assert.equal((await api('/qa/snapshot','PUT',B,b1,0)).status,200);
 pass('두 가상 가족 A/B 독립 암호화 스냅샷과 가족 A의 2개 독립 세션');
 assert.equal((await api('/qa/password','POST',form(P1,P2))).status,401);
 assert.equal((await api('/qa/password','POST',form(P1,P2),a1)).status,428);
 assert.equal((await api('/qa/password','POST',form(P1,P2),a1,0)).status,409);
 assert.equal((await api('/qa/password','POST',form(P1,P2,{approved:false}),a1,1)).status,428);
 assert.equal((await api('/qa/password','POST',form(P1,P2,{confirmation:'WRONG'}),a1,1)).status,428);
 pass('토큰/If-Match/현재 버전/명시적 확인 없으면 비밀번호 교체 차단');
 assert.equal((await api('/qa/password','POST',form('QA32-SYNTHETIC-WRONG-PASSWORD',P2),a1,1)).status,403);
 assert.equal((await api('/qa/password','POST',form(P1,P1),a1,1)).status,422);
 assert.equal((await api('/qa/password','POST',form(P1,P2,{familyKey:F2}),a1,1)).status,422);
 assert.equal((await api('/qa/password','POST',form(P1,P2),b1,1)).status,422);
 pass('기존 비밀번호 오류/동일 비밀번호/다른 가족 ID·토큰으로 변경 불가');
 const external=await api('/qa/password','POST',form(P1,P2),a1,1,
  {Origin:'https://jinbh99-arch.github.io'});
 assert.equal(external.status,403);
 assert.equal(external.headers.get('access-control-allow-origin'),null);
 pass('공개 GitHub Pages Origin에서 비밀번호 변경 API 접근 거부');
 const rotate=await api('/qa/password','POST',form(P1,P2),a1,1);
 assert.equal(rotate.status,200,JSON.stringify(rotate.data));
 assert.equal(rotate.data.revision,2);
 assert.equal(rotate.data.sessionsRevoked,true);
 assert.equal((await api('/qa/snapshot','GET',undefined,a1)).status,401);
 assert.equal((await api('/qa/snapshot','GET',undefined,a2)).status,401);
 await login(F1,P1,401);
 const a3=await login(F1,P2);
 assert.deepEqual((await api('/qa/snapshot','GET',undefined,a3)).data.snapshot,A);
 assert.equal((await api('/qa/snapshot','GET',undefined,a3)).data.revision,2);
 pass('A의 비밀번호 교체: A 기기 세션 전부 폐기·옛 비밀번호 차단·기록 원본 보존');
 const other=await api('/qa/snapshot','GET',undefined,b1);
 assert.equal(other.status,200);
 assert.deepEqual(other.data.snapshot,B);
 assert.equal(other.data.revision,1);
 pass('가족 A의 비밀번호 교체 이후에도 가족 B의 독립 세션과 원본 정상');
 const contents=readFileSync(store,'utf8');
 assert.ok(!contents.includes(P1));
 assert.ok(!contents.includes(P2));
 assert.ok(!contents.includes('qa32-a'));
 pass('새 비밀번호 검증자료 및 가족 이력의 AES-GCM 시험 파일 원문 미노출');
 await gate.shutdown();gate=null;
 await start();
 await login(F1,P1,401);
 assert.equal((await api('/qa/snapshot','GET',undefined,a3)).status,401);
 const a4=await login(F1,P2);
 assert.equal((await api('/qa/snapshot','GET',undefined,a4)).data.revision,2);
 assert.deepEqual((await api('/qa/snapshot','GET',undefined,a4)).data.snapshot,A);
 const b2=await login(F2,PB);
 assert.deepEqual((await api('/qa/snapshot','GET',undefined,b2)).data.snapshot,B);
 pass('서버 재시작 후 과거 비밀번호·토큰 재사용 불가, 새 비밀번호·가족별 스냅샷 유지');
 const slow=slowPut(doc('qa32-stale-replace'),a4,2);
 await new Promise(resolve=>setTimeout(resolve,85));
 const rot2=await api('/qa/password','POST',form(P2,P3),a4,2);
 assert.equal(rot2.status,200,JSON.stringify(rot2.data));
 assert.equal(rot2.data.revision,3);
 slow.finish();const oldWrite=await slow.outcome;
 assert.equal(oldWrite.status,409);
 const a5=await login(F1,P3);
 assert.deepEqual((await api('/qa/snapshot','GET',undefined,a5)).data.snapshot,A);
 assert.equal((await api('/qa/snapshot','GET',undefined,a5)).data.revision,3);
 pass('늦게 끝난 과거 스냅샷 PUT은 비밀번호 변경 뒤 409 거부, 기존 기록 보존');
 browser=await chromium.launch({headless:true});
 const ca=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const cb=await browser.newContext({viewport:{width:320,height:760},acceptDownloads:true});
 const page=await ca.newPage(),otherPage=await cb.newPage();
 for(const p of [page,otherPage]){
  await p.goto('http://127.0.0.1:4173/qa-family-sync-lab.html');
  await p.locator('#lab-port').fill(new URL(gate.baseUrl).port);
  await p.locator('#lab-family').fill(F1);
  await p.locator('#lab-password').fill(P3);
  await p.locator('#lab-login').click();
  await p.getByText('로그인 성공.',{exact:false}).waitFor();
 }
 pass('두 별도 모바일 Chromium 브라우저에서 가상 가족 P3 로그인');
 await page.locator('#lab-rotate').click();
 await page.getByText('모든 기기 로그아웃 동의가 필요합니다.',{exact:false}).waitFor();
 assert.equal((await api('/qa/snapshot','GET',undefined,a5)).status,200);
 pass('브라우저에서 확인 동의 누락 시 비밀번호와 세션 변경 없음');
 await page.locator('#lab-rotate-approved').check();
 await page.locator('#lab-rotate-old').fill(P3);
 await page.locator('#lab-rotate-new').fill(P4);
 await page.locator('#lab-rotate-confirm').fill(P4);
 await page.locator('#lab-rotate').click();
 await page.getByText('가상 비밀번호가 변경되고 모든 기기의 세션이 폐기되었습니다.',{exact:false}).waitFor();
 assert.equal(await page.locator('#lab-rotate-old').inputValue(),'');
 assert.equal(await page.locator('#lab-rotate-new').inputValue(),'');
 assert.equal(await page.locator('#lab-rotate-confirm').inputValue(),'');
 assert.equal(await page.locator('#lab-upload').isDisabled(),true);
 await otherPage.locator('#lab-refresh').click();
 await otherPage.getByText('서버 응답 401:',{exact:false}).waitFor();
 pass('브라우저 A 변경 성공 후 입력값 초기화·A 로그아웃·B 기존 세션 401');
 await login(F1,P3,401);
 const a6=await login(F1,P4);
 assert.deepEqual((await api('/qa/snapshot','GET',undefined,a6)).data.snapshot,A);
 assert.equal((await api('/qa/snapshot','GET',undefined,a6)).data.revision,4);
 const blocked=await browser.newPage();
 await blocked.goto('file://'+process.cwd()+'/qa-family-sync-lab.html');
 assert.equal(await blocked.locator('#lab-rotate').isDisabled(),true);
 pass('브라우저 변경 최종 버전 4 기록 보존·공개 출처가 아닌 UI에서 조작 비활성');
 console.log('QA_G15_PASSWORD_ROTATION_RESULT='+JSON.stringify({
  status:'PASS',checks,simulatedFamilies:2,independentBrowserContexts:2,
  persistedAcrossRestart:true,oldSessionsRevoked:true,slowWriteDenied:true,
  genuineFamilyAccount:false,realCloud:false,realChildren:0
 }));
}catch(err){
 console.error('QA_G15_PASSWORD_ROTATION_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1600)}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gate)await gate.shutdown();
 rmSync(tmp,{recursive:true,force:true});
}
