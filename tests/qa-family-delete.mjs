// QA31: local synthetic family deletion, all-session invalidation,
// durable encrypted restart, cross-family isolation and in-flight race.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {randomBytes} from 'node:crypto';
import {request as rawHttpRequest} from 'node:http';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const pwd='QA31-SYNTHETIC-PASSWORD-DO-NOT-REUSE';
const origin='http://127.0.0.1:4173';
const temp=mkdtempSync(join(tmpdir(),'qa31-family-revoke-'));
const file=join(temp,'isolated-aes-gcm.enc');
const key=randomBytes(32).toString('hex');
const doc=(id)=>signSynthetic({
 format:'uriaimath-offline-backup-v02',profile:{grade:3,nickname:'QA31-SYNTHETIC'},
 records:[{id,problemText:'QA31-SYNTHETIC-'+id,hasPhoto:false,practiceHistory:[]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}
});
const A=doc('qa31-a'),B=doc('qa31-b');
let gate=null,browser=null,checks=0;
const pass=s=>{checks++;console.log('PASS QA31 G15',s)};
async function req(path,method='GET',body,token,rev,extra={}){
 const h={...extra};if(token)h.authorization='Bearer '+token;
 if(rev!==undefined&&rev!==null)h['if-match']='"'+rev+'"';
 if(body!==undefined)h['content-type']='application/json';
 const r=await fetch(gate.baseUrl+path,{method,headers:h,
  body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:r.status,data:await r.json(),headers:r.headers};
}
async function register(name){
 assert.equal((await req('/qa/register','POST',{familyKey:name,password:pwd})).status,201);
}
async function login(name){
 const r=await req('/qa/login','POST',{familyKey:name,password:pwd});
 assert.equal(r.status,200);return r.data.token;
}
const deleteBody=familyKey=>({familyKey,password:pwd,approved:true,
 confirmation:'DELETE_SYNTHETIC_FAMILY'});
function delayedPut(body,token,revision){
 const raw=JSON.stringify(body),url=new URL(gate.baseUrl+'/qa/snapshot');
 let finish;
 const promise=new Promise((resolve,reject)=>{
  const r=rawHttpRequest(url,{method:'PUT',headers:{
   authorization:'Bearer '+token,'if-match':'"'+revision+'"',
   'content-type':'application/json','transfer-encoding':'chunked'
  }},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));
   res.on('end',()=>resolve({status:res.statusCode,
     data:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });
  r.on('error',reject);
  r.write(raw.slice(0,Math.floor(raw.length/2)));
  finish=()=>r.end(raw.slice(Math.floor(raw.length/2)));
 });
 return {promise,finish:()=>finish()};
}
try{
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 await register('qa-family-31-a');await register('qa-family-31-b');
 const a1=await login('qa-family-31-a');
 const a2=await login('qa-family-31-a');
 const b=await login('qa-family-31-b');
 assert.equal((await req('/qa/snapshot','PUT',A,a1,0)).status,200);
 assert.equal((await req('/qa/snapshot','PUT',B,b,0)).status,200);
 assert.deepEqual((await req('/qa/snapshot','GET',undefined,a2)).data.snapshot,A);
 assert.deepEqual((await req('/qa/snapshot','GET',undefined,b)).data.snapshot,B);
 pass('가상 가족 2개, 가족 A 세션 2개와 가족 B 세션 1개 격리');
 assert.equal((await req('/qa/family','DELETE',deleteBody('qa-family-31-a'))).status,401);
 assert.equal((await req('/qa/family','DELETE',deleteBody('qa-family-31-a'),a1)).status,428);
 assert.equal((await req('/qa/family','DELETE',deleteBody('qa-family-31-a'),a1,0)).status,409);
 assert.equal((await req('/qa/family','DELETE',{...deleteBody('qa-family-31-a'),approved:false},a1,1)).status,428);
 assert.equal((await req('/qa/family','DELETE',{...deleteBody('qa-family-31-a'),confirmation:'NO'},a1,1)).status,428);
 pass('삭제에 인증, 현재 revision, 명시적 승인·확인 문구가 없으면 거부');
 assert.equal((await req('/qa/family','DELETE',{...deleteBody('qa-family-31-a'),password:'WRONG-FAKE-PASSWORD-FOR-TEST'},a1,1)).status,403);
 assert.equal((await req('/qa/family','DELETE',deleteBody('qa-family-31-a'),b,1)).status,403);
 assert.equal((await req('/qa/family','DELETE',deleteBody('qa-family-31-b'),a1,1)).status,403);
 pass('비밀번호 오류, 다른 가족의 인증 토큰·명시적 이름 위장은 가족 삭제 불가');
 const forged=await req('/qa/family','DELETE',deleteBody('qa-family-31-a'),a1,1,
  {Origin:'https://jinbh99-arch.github.io'});
 assert.equal(forged.status,403);
 assert.equal(forged.headers.get('access-control-allow-origin'),null);
 pass('공개 GitHub Pages Origin은 삭제 요청 자체를 거부');
 const stale=delayedPut(doc('qa31-slow-update'),a1,1);
 await new Promise(resolve=>setTimeout(resolve,80));
 const result=await req('/qa/family','DELETE',deleteBody('qa-family-31-a'),a2,1);
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(result.data.deleted,true);
 assert.equal(result.data.sessionsRevoked,true);
 assert.equal(result.data.forensicEraseGuaranteed,false);
 stale.finish();
 const delayed=await stale.promise;
 assert.equal(delayed.status,409);
 pass('가족 A 삭제 중 반쯤 전송한 기존 저장 요청은 409, 삭제한 가족 데이터 복구 불가');
 assert.equal((await req('/qa/snapshot','GET',undefined,a1)).status,401);
 assert.equal((await req('/qa/snapshot','GET',undefined,a2)).status,401);
 assert.equal((await req('/qa/login','POST',{familyKey:'qa-family-31-a',password:pwd})).status,401);
 assert.deepEqual((await req('/qa/snapshot','GET',undefined,b)).data.snapshot,B);
 assert.equal((await req('/qa/snapshot','GET',undefined,b)).data.revision,1);
 pass('가족 A의 모든 로그인 세션·재로그인 거부, 가족 B 계정 및 기록 손상 없음');
 const encrypted=readFileSync(file,'utf8');
 assert.ok(!encrypted.includes('qa-family-31-a'));
 assert.ok(!encrypted.includes('QA31-SYNTHETIC-qa31-a'));
 await gate.shutdown();gate=null;
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 assert.equal((await req('/qa/login','POST',{familyKey:'qa-family-31-a',password:pwd})).status,401);
 const b2=await login('qa-family-31-b');
 assert.deepEqual((await req('/qa/snapshot','GET',undefined,b2)).data.snapshot,B);
 assert.equal((await req('/qa/snapshot','GET',undefined,b)).status,401);
 pass('AES-GCM 파일 재시작 후 삭제 상태 유지·가족 B는 복원·재시작 이전 토큰은 폐기');
 await register('qa-family-31-a');
 const a3=await login('qa-family-31-a');
 const fresh=await req('/qa/snapshot','GET',undefined,a3);
 assert.equal(fresh.data.revision,0);
 assert.equal(fresh.data.snapshot,null);
 assert.equal((await req('/qa/snapshot','GET',undefined,a1)).status,401);
 pass('삭제한 같은 가상 ID로 다시 등록해도 이전 가족 기록·세션·리비전은 복원되지 않음');
 // Actual user-facing local lab browser flow, still synthetic and loopback only.
 browser=await chromium.launch({headless:true});
 const c=await browser.newContext({viewport:{width:375,height:812},acceptDownloads:true});
 const d=await browser.newContext({viewport:{width:320,height:736},acceptDownloads:true});
 const page=await c.newPage(),other=await d.newPage();
 for(const p of [page,other]){
  await p.goto(origin+'/qa-family-sync-lab.html');
  await p.locator('#lab-port').fill(new URL(gate.baseUrl).port);
  await p.locator('#lab-family').fill('qa-family-31-a');
  await p.locator('#lab-password').fill(pwd);
  await p.locator('#lab-login').click();
  await p.getByText('로그인 성공.',{exact:false}).waitFor();
 }
 assert.equal(await page.locator('#lab-delete').isEnabled(),true);
 await page.locator('#lab-delete').click();
 await page.getByText('삭제 동의와 확인 문구',{exact:false}).waitFor();
 assert.equal((await req('/qa/snapshot','GET',undefined,a3)).status,200);
 pass('375px·320px 실제 브라우저에 가상 가족 UI 삭제 버튼, 동의 누락 시 기존 기록 유지');
 await page.locator('#lab-delete-approved').check();
 await page.locator('#lab-delete-phrase').fill('가상 가족 삭제');
 await page.locator('#lab-delete-password').fill(pwd);
 await page.locator('#lab-delete').click();
 await page.getByText('가상 가족 데이터와 서버 세션의 논리적 삭제를 확인했습니다.',{exact:false}).waitFor();
 assert.equal(await page.locator('#lab-delete-password').inputValue(),'');
 assert.equal(await page.locator('#lab-upload').isDisabled(),true);
 assert.equal(await page.locator('#lab-delete').isDisabled(),true);
 await other.locator('#lab-refresh').click();
 await other.getByText('서버 응답 401:',{exact:false}).waitFor();
 pass('실제 UI에서 명시적 삭제 후 자격증명 초기화·자기/다른 브라우저 세션 모두 폐기');
 console.log('QA_G15_FAMILY_DELETE_RESULT='+JSON.stringify({
  status:'PASS',checks,isolatedFamilies:2,realBrowserContexts:2,
  persistedDeletion:true,logicalDeletionOnly:true,
  oldTokensRevoked:true,staleWriteDenied:true,realCloud:false,
  realChildren:0,productionAccountDeletion:false
 }));
}catch(error){
 console.error('QA_G15_FAMILY_DELETE_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1400)
 }));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gate)await gate.shutdown();
 rmSync(temp,{recursive:true,force:true});
}
