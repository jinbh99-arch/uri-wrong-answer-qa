// QA38: login limiter capacity must not evict an active lock.
// Synthetic local gateway only: zero real users, zero production traffic.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const dir=mkdtempSync(join(tmpdir(),'qa38-capacity-'));
const key=randomBytes(32).toString('hex'),durablePath=join(dir,'families.enc');
const PASS='QA38-SYNTHETIC-PASSWORD-NOT-REAL';
const WRONG='QA38-INVALID-PASSWORD-NOT-REAL';
let now=2000000000,gate,checks=0;
const pass=what=>{checks++;console.log('PASS QA38 SECURITY',what)};
async function send(path,method='GET',body,token,origin){
 const headers={};
 if(body!==undefined)headers['content-type']='application/json';
 if(token)headers.authorization='Bearer '+token;
 if(origin)headers.origin=origin;
 const r=await fetch(gate.baseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),headers:r.headers};
}
async function login(id,pwd){return send('/qa/login','POST',{familyKey:id,password:pwd})}
async function start(durable=true){gate=await createIsolatedQaFamilyGateway({
  ...(durable?{durablePath,encryptionKey:key}:{}),now:()=>now
});}
async function stop(){if(gate){await gate.shutdown();gate=null}}
try{
 await start();
 const A='qa-capacity-main',B='qa-capacity-other';
 assert.equal((await send('/qa/register','POST',{familyKey:A,password:PASS})).status,201);
 assert.equal((await send('/qa/register','POST',{familyKey:B,password:PASS})).status,201);
 for(let i=0;i<5;i++)assert.equal((await login(A,WRONG)).status,401);
 assert.equal((await login(A,PASS)).status,429);
 pass('5회 비밀번호 실패로 가족 A 잠금');

 // Fill 255 other slots without ever evicting A's lock. This is deliberately
 // a real end-to-end regression for limiter saturation (no test-only backdoor).
 assert.equal((await login(B,WRONG)).status,401);
 for(let i=0;i<254;i++){
  const id='qa-flood-'+String(i).padStart(4,'0');
  assert.equal((await login(id,WRONG)).status,401,'synthetic id '+id);
 }
 const flood=await login('qa-flood-next',WRONG);
 assert.equal(flood.status,429);
 assert.equal(flood.body.error,'LOGIN_TRACKING_CAPACITY');
 assert.equal((await login(A,PASS)).status,429);
 pass('256개 실패 기록이 가득 차도 A 잠금을 퇴출시키지 않고 새 ID는 429 거절');

 // Existing account B can still authenticate, removing its own old failure.
 const b=await login(B,PASS);
 assert.equal(b.status,200);
 assert.equal((await send('/qa/snapshot','GET',undefined,b.body.token)).status,200);
 pass('기존 가족 B 인증·접근은 다른 가족의 잠금에 영향을 받지 않음');

 const fullAgain=await login('qa-flood-next',WRONG);
 assert.equal(fullAgain.status,401);
 assert.equal((await login(A,PASS)).status,429);
 await stop();
 const ciphertext=readFileSync(durablePath,'utf8');
 assert.ok(!ciphertext.includes(A));
 assert.ok(!ciphertext.includes('qa-flood-'));
 await start();
 assert.equal((await login(A,PASS)).status,429);
 pass('AES-GCM 암호화 상태로 재시작해도 256개 limiter 상태·A 잠금 보존');

 now+=60001;
 const fresh=await login(A,PASS);
 assert.equal(fresh.status,200);
 assert.equal((await login('qa-flood-next',WRONG)).status,401);
 pass('정해진 60초 경과 뒤 잠금 정리되며 합성 가족 A 정상 로그인');

 const protectedResponse=await send('/qa/snapshot','GET',undefined,fresh.body.token);
 assert.equal(protectedResponse.headers.get('referrer-policy'),'no-referrer');
 assert.equal(protectedResponse.headers.get('x-frame-options'),'DENY');
 assert.ok(protectedResponse.headers.get('content-security-policy').includes("default-src 'none'"));
 const wrongOrigin=await send('/qa/snapshot','GET',undefined,fresh.body.token,'https://example.test');
 assert.equal(wrongOrigin.status,403);
 assert.equal(wrongOrigin.body.error,'ORIGIN_NOT_ALLOWED');
 pass('JSON 보안 헤더·외부 사이트 Origin 거절 유지');

 await stop();
 await start(false);
 for(let i=0;i<100;i++){
  const id='qa-member-'+String(i).padStart(4,'0');
  assert.equal((await send('/qa/register','POST',{familyKey:id,password:PASS})).status,201);
 }
 const over=await send('/qa/register','POST',{familyKey:'qa-member-over',password:PASS});
 assert.equal(over.status,429);
 assert.equal(over.body.error,'SYNTHETIC_FAMILY_CAPACITY');
 const old=await login('qa-member-0000',PASS);
 assert.equal(old.status,200);
 pass('메모리 가상 가족 계정도 100개 상한 적용·기존 가족은 계속 이용 가능');

 console.log('QA38_SECURITY_CAPACITY_RESULT='+JSON.stringify({
  status:'PASS',checks,maximumTracked:256,maximumSyntheticFamilies:100,
  encryptedRestart:true,allChildrenSynthetic:true,hostedCloud:false
 }));
}catch(e){
 console.error('QA38_SECURITY_CAPACITY_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1000)}));
 process.exitCode=1;
}finally{await stop();rmSync(dir,{recursive:true,force:true})}
