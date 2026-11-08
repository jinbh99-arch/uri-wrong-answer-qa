// QA33: loopback-only synthetic login brute-force backoff, session cap,
// expiry and in-flight authentication guard. No child data and NO real auth.
import assert from 'node:assert/strict';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {chromium} from 'playwright';
process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
const A='qa-security-family-a',B='qa-security-family-b';
const pw='QA33-SYNTHETIC-PASSWORD-DO-NOT-USE',wrong='QA33-INCORRECT-FAKE-PASSWORD';
let current=100000000,gate,browser,checks=0;
const pass=(message)=>{checks++;console.log('PASS QA33 G15',message)};
const doc=signSynthetic({format:'uriaimath-offline-backup-v02',
 profile:{nickname:'QA33-SYNTHETIC',grade:3},
 records:[{id:'qa33-a',problemText:'QA33 SYNTHETIC',hasPhoto:false,practiceHistory:[]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}});
async function req(path,method='GET',body,token,revision){
 const headers={};if(body!==undefined)headers['content-type']='application/json';
 if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const res=await fetch(gate.baseUrl+path,{method,headers,
 body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:res.status,json:await res.json()};
}
async function login(key,password){
 return req('/qa/login','POST',{familyKey:key,password});
}
const expiredTokenErrors=r=>[401,409].includes(r.status);
try{
 gate=await createIsolatedQaFamilyGateway({now:()=>current});
 assert.equal((await req('/qa/register','POST',{familyKey:A,password:pw})).status,201);
 assert.equal((await req('/qa/register','POST',{familyKey:B,password:pw})).status,201);
 pass('명시적 QA 환경에서 서로 다른 두 가족 계정 등록');
 for(let i=0;i<5;i++){
  const x=await login(A,wrong);
  assert.equal(x.status,401,'wrong login '+i);
  assert.equal(x.json.error,'CREDENTIALS_INVALID');
 }
 const blocked=await login(A,pw);
 assert.equal(blocked.status,429);
 assert.equal(blocked.json.error,'LOGIN_RATE_LIMITED');
 const b1=await login(B,pw);
 assert.equal(b1.status,200);
 pass('5회 비밀번호 오류 후 같은 가족만 60초 동안 잠금, 다른 가족 로그인 유지');
 current+=30000;
 assert.equal((await login(A,pw)).status,429);
 current+=30001;
 const a0=await login(A,pw);
 assert.equal(a0.status,200);
 assert.equal((await login(A,pw)).status,200);
 pass('잠금 기간 중 실제 올바른 비밀번호도 차단, 60초 경과 후 새 로그인 허용');
 const sessions=[a0.json.token];
 // We already issued another session above but did not capture it; count is two.
 for(let i=0;i<3;i++)sessions.push((await login(A,pw)).json.token);
 assert.equal((await login(A,pw)).status,429);
 const alive=await req('/qa/snapshot','GET',undefined,sessions[0]);
 assert.equal(alive.status,200);
 pass('가족별 최대 5개 활성 세션 제한; 여섯 번째 로그인 거부·기존 세션 유지');
 const logout=await req('/qa/logout','POST',undefined,sessions[0]);
 assert.equal(logout.status,200);
 assert.equal((await req('/qa/snapshot','GET',undefined,sessions[0])).status,401);
 const restored=await login(A,pw);
 assert.equal(restored.status,200);
 pass('명시 로그아웃 시 그 세션만 폐기되어 6번째 장치 로그인 가능');
 const token=restored.json.token;
 assert.equal((await req('/qa/snapshot','PUT',doc,token,0)).status,200);
 assert.deepEqual((await req('/qa/snapshot','GET',undefined,token)).json.snapshot,doc);
 current+=600001;
 assert.equal((await req('/qa/snapshot','GET',undefined,token)).status,401);
 const afterExpire=await login(A,pw);
 assert.equal(afterExpire.status,200);
 const revived=await req('/qa/snapshot','GET',undefined,afterExpire.json.token);
 assert.deepEqual(revived.json.snapshot,doc);
 assert.equal(revived.json.revision,1);
 pass('10분 세션 만료 및 자동 정리 후 재로그인·원본 오답 복구');
 // In-flight PUT: first chunk is already accepted, then the token expires
 // before the rest arrives. The write must fail closed.
 const {request:requestRaw}=await import('node:http');
 const badDoc=structuredClone(doc);badDoc.records.push({...doc.records[0],id:'qa33-new'});
 badDoc.backupSummary.recordCount=2;signSynthetic(badDoc);
 const raw=JSON.stringify(badDoc);
 let finish;
 const inflight=new Promise((resolve,reject)=>{
  const r=requestRaw(new URL(gate.baseUrl+'/qa/snapshot'),{method:'PUT',headers:{
   authorization:'Bearer '+afterExpire.json.token,'if-match':'"1"',
   'content-type':'application/json','transfer-encoding':'chunked'
  }},res=>{
    const chunks=[];res.on('data',x=>chunks.push(x));
    res.on('end',()=>resolve({status:res.statusCode,
     json:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });
  r.on('error',reject);
  r.write(raw.slice(0,Math.floor(raw.length/2)));
  finish=()=>r.end(raw.slice(Math.floor(raw.length/2)));
 });
 await new Promise(resolve=>setTimeout(resolve,60));
 current+=600001;
 finish();
 const delayed=await inflight;
 assert.equal(delayed.status,409);
 const aNew=await login(A,pw);
 assert.equal(aNew.status,200);
 const unchanged=await req('/qa/snapshot','GET',undefined,aNew.json.token);
 assert.equal(unchanged.json.revision,1);
 assert.deepEqual(unchanged.json.snapshot,doc);
 pass('유효 기간에 시작한 HTTP 스트림도 쓰기 완료 시 세션 만료면 409, 기존 자료 유지');
 // UI check: two separate browser contexts with one locked family.
 browser=await chromium.launch({headless:true});
 const p1=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
 const p2=await (await browser.newContext({viewport:{width:320,height:720}})).newPage();
 for(const page of [p1,p2]){
  await page.goto('http://127.0.0.1:4173/qa-family-sync-lab.html');
  await page.locator('#lab-port').fill(new URL(gate.baseUrl).port);
  await page.locator('#lab-family').fill(A);
  await page.locator('#lab-password').fill(wrong);
 }
 for(let i=0;i<5;i++){
  await p1.locator('#lab-password').fill(wrong);
  await p1.locator('#lab-login').click();
  await p1.getByText('서버 응답 401: CREDENTIALS_INVALID',{exact:false}).waitFor();
 }
 await p2.locator('#lab-password').fill(pw);
 await p2.locator('#lab-login').click();
 await p2.getByText('서버 응답 429: LOGIN_RATE_LIMITED',{exact:false}).waitFor();
 assert.equal(await p2.locator('#lab-upload').isDisabled(),true);
 pass('390/320px 두 독립 실제 Chromium 기기에서 잠금 공유·유효 비밀번호도 브라우저 로그인 차단');
 console.log('QA_G15_ABUSE_GUARD_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticFamilies:2,realBrowserContexts:2,
  loginThreshold:5,windowMs:60000,perFamilySessionCap:5,sessionTtlMs:600000,
  deniedInFlightExpiredWrite:true,realCloud:false,realChildren:0
 }));
}catch(error){
 console.error('QA_G15_ABUSE_GUARD_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(error),stack:String(error?.stack).slice(0,1300)}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gate)await gate.shutdown();
}
