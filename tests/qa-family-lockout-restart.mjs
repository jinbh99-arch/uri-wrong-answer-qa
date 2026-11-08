// QA36 G15: encrypted synthetic family lockout survives process restart.
// Isolated loopback only. No production authentication or child information.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'qa36-encrypted-backoff-'));
const file=join(folder,'synthetic-families.enc');
const key=randomBytes(32).toString('hex');
const A='qa-36-family-a',B='qa-36-family-b';
const passwordA='QA36-FAKE-FAMILY-A-PASSWORD';
const passwordB='QA36-FAKE-FAMILY-B-PASSWORD';
const wrong='QA36-DELIBERATELY-WRONG-PASSWORD';
let clock=1000000000,gate=null,checks=0;
const pass=s=>{checks++;console.log('PASS QA36 G15',s)};
async function req(path,method='GET',body,token,revision){
 const headers={};
 if(token)headers.authorization='Bearer '+token;
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:r.status,data:await r.json()};
}
async function login(familyKey,password){
 return req('/qa/login','POST',{familyKey,password});
}
async function start(){
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key,now:()=>clock});
}
async function restart(){
 await gate.shutdown();gate=null;
 await start();
}
try{
 await start();
 assert.equal((await req('/qa/register','POST',{familyKey:A,password:passwordA})).status,201);
 assert.equal((await req('/qa/register','POST',{familyKey:B,password:passwordB})).status,201);
 pass('가상 가족 A/B 별도 암호화 저장소 생성');

 for(let i=0;i<3;i++)assert.equal((await login(A,wrong)).status,401);
 const ciphertext=readFileSync(file,'utf8');
 assert.ok(!ciphertext.includes(A)&&!ciphertext.includes(wrong));
 assert.ok(!ciphertext.includes('lastFailedAt')&&!ciphertext.includes('loginAttempts'));
 pass('3회 실패 횟수·잠금 기록도 AES-GCM 암호문 내부에만 저장');

 await restart();
 assert.equal((await login(A,wrong)).status,401);
 assert.equal((await login(A,wrong)).status,401);
 const locked=await login(A,passwordA);
 assert.equal(locked.status,429);
 assert.equal(locked.data.error,'LOGIN_RATE_LIMITED');
 pass('서버 재시작 전 3회 + 재시작 후 2회 실패를 합산하여 5회 잠금');

 const okB=await login(B,passwordB);
 assert.equal(okB.status,200);
 assert.equal((await req('/qa/snapshot','GET',undefined,okB.data.token)).status,200);
 pass('A의 잠금이 B의 인증·기록 조회에 영향 없음');

 await restart();
 assert.equal((await login(A,passwordA)).status,429);
 assert.equal((await req('/qa/snapshot','GET',undefined,okB.data.token)).status,401);
 pass('잠금은 두 번째 재시작에도 유지, 이전 세션 토큰은 재사용 불가');

 clock+=30000;
 assert.equal((await login(A,passwordA)).status,429);
 clock+=30001;
 const restored=await login(A,passwordA);
 assert.equal(restored.status,200);
 pass('60초 경과 뒤 올바른 비밀번호로 재로그인 허용');

 await restart();
 assert.equal((await login(A,passwordA)).status,200);
 for(let i=0;i<4;i++)assert.equal((await login(A,wrong)).status,401);
 assert.equal((await login(A,passwordA)).status,200);
 assert.equal((await login(A,wrong)).status,401);
 assert.equal((await login(A,passwordA)).status,200);
 pass('인증 성공으로 실패 횟수가 암호화 저장본에서도 초기화');

 // A locked account may still be deleted with an already valid authenticated
 // token: removing it must not poison a newly registered family of the same ID.
 for(let i=0;i<5;i++)assert.equal((await login(B,wrong)).status,401);
 assert.equal((await login(B,passwordB)).status,429);
 const tokenB=(await login(A,passwordA)).data.token;
 assert.equal((await req('/qa/snapshot','GET',undefined,tokenB)).status,200);
 // Obtain B's authenticated session by advancing only the fake clock; then
 // re-lock B while the session remains valid.
 clock+=60001;
 const activeB=(await login(B,passwordB));
 assert.equal(activeB.status,200);
 for(let i=0;i<5;i++)assert.equal((await login(B,wrong)).status,401);
 assert.equal((await login(B,passwordB)).status,429);
 const removed=await req('/qa/family','DELETE',{
  familyKey:B,password:passwordB,approved:true,confirmation:'DELETE_SYNTHETIC_FAMILY'
 },activeB.data.token,0);
 assert.equal(removed.status,200);
 const newPasswordB='QA36-NEW-SYNTHETIC-B-PASSWORD';
 assert.equal((await req('/qa/register','POST',{familyKey:B,password:newPasswordB})).status,201);
 assert.equal((await login(B,newPasswordB)).status,200);
 await restart();
 assert.equal((await login(B,newPasswordB)).status,200);
 pass('가족 삭제가 오래된 실패 횟수도 제거해 동일 가상 ID 재등록을 차단하지 않음');

 console.log('QA_G15_ENCRYPTED_RESTART_LOCKOUT_RESULT='+JSON.stringify({
  status:'PASS',checks,encryptedAtRest:true,persistedAcrossRestarts:true,
  syntheticFamilies:2,lockThreshold:5,lockoutMs:60000,productionAuth:false,
  realCloud:false,realChildren:0
 }));
}catch(e){
 console.error('QA_G15_ENCRYPTED_RESTART_LOCKOUT_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1400)}));
 process.exitCode=1;
}finally{
 if(gate)await gate.shutdown();
 rmSync(folder,{force:true,recursive:true});
}
