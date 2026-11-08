// QA26: encrypted restart durability, two independent client sessions,
// family A/B isolation, fail-closed corrupted ciphertext and stale-write guard.
// ALL data synthetic. No external server or production child records.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

const key=randomBytes(32).toString('hex');
const temp=mkdtempSync(join(tmpdir(),'qa26-g15-encrypted-'));
const file=join(temp,'synthetic-families.json.enc');
const P1='SYNTHETIC-LOCAL-ONLY-A-SECURE-TEST-PASSWORD';
const P2='SYNTHETIC-LOCAL-ONLY-B-SECURE-TEST-PASSWORD';
const profile={grade:'3',nickname:'SYNTHETIC-ONLY'};
const mk=(id,grade='3')=>signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{...profile,grade},records:[{
  id,problemText:'QA26-SYNTHETIC-HISTORY-DO-NOT-USE-FOR-KIDS',hasPhoto:false,
  practiceHistory:[],generalRetryHistory:[]
 }],photos:{}
});
let gate=null,passCount=0;
const pass=s=>{passCount++;console.log('PASS QA26 G15',s)};
async function call(base,path,method='GET',body,token,etag){
 const headers={};
 if(token)headers.authorization='Bearer '+token;
 if(etag)headers['if-match']=etag;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 return {status:r.status,json:await r.json(),etag:r.headers.get('etag')};
}
async function login(base,id,pwd){
 const r=await call(base,'/qa/login','POST',{familyKey:id,password:pwd});
 assert.equal(r.status,200);return r.json.token;
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 delete process.env.QA_DURABLE_TEST_ONLY;
 await assert.rejects(()=>createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key}),/QA_DURABLE_TEST_ONLY/);
 process.env.QA_DURABLE_TEST_ONLY='1';
 await assert.rejects(()=>createIsolatedQaFamilyGateway({durablePath:'/etc/qa26-test.enc',encryptionKey:key}),/temporary directory/);
 await assert.rejects(()=>createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:'short'}),/32-byte/);
 pass('권한 환경변수·임시 폴더 경계·256비트 암호키 모두 없으면 서버 구동 실패');
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 assert.equal(gate.encryptedRestartRecovery,true);
 let base=gate.baseUrl;
 assert.equal((await call(base,'/qa/register','POST',{familyKey:'qa-family-one',password:P1})).status,201);
 assert.equal((await call(base,'/qa/register','POST',{familyKey:'qa-family-two',password:P2})).status,201);
 const tA1=await login(base,'qa-family-one',P1);
 const tA2=await login(base,'qa-family-one',P1);
 const tB=await login(base,'qa-family-two',P2);
 assert.notEqual(tA1,tA2);
 pass('가상 가족 2개·단일 가족 독립 세션 2개 생성');
 const A=mk('qa26-a');
 assert.equal((await call(base,'/qa/snapshot','PUT',A,tA1,'"0"')).status,200);
 const B=mk('qa26-b','5');
 assert.equal((await call(base,'/qa/snapshot','PUT',B,tB,'"0"')).status,200);
 assert.equal((await call(base,'/qa/snapshot','GET',undefined,tA2)).json.snapshot.records[0].id,'qa26-a');
 assert.equal((await call(base,'/qa/snapshot','GET',undefined,tB)).json.snapshot.records[0].id,'qa26-b');
 pass('A/B 분리 저장·두 기기 세션에서 즉시 동일 원본 읽기');
 await gate.shutdown();gate=null;
 const ciphertext=readFileSync(file,'utf8');
 assert.equal(statSync(file).mode&0o077,0);
 assert.ok(!ciphertext.includes('QA26-SYNTHETIC-HISTORY-DO-NOT-USE-FOR-KIDS'));
 assert.ok(!ciphertext.includes('qa-family-one'));
 assert.ok(!ciphertext.includes(P1));
 assert.ok(!ciphertext.includes('qa26-a'));
 pass('실제 파일 AES-256-GCM 암호화, 원문·계정 ID·비밀번호 평문 미노출, 파일 권한 0600');
 await assert.rejects(()=>createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:randomBytes(32).toString('hex')}),/auth|bad decrypt|authenticate/i);
 pass('잘못된 복호화 키로 재실행하면 새 빈 데이터로 덮지 않고 시작 자체 차단');
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 base=gate.baseUrl;
 assert.equal((await call(base,'/qa/snapshot','GET',undefined,tA1)).status,401);
 const restoredA=await login(base,'qa-family-one',P1),restoredB=await login(base,'qa-family-two',P2);
 assert.deepEqual((await call(base,'/qa/snapshot','GET',undefined,restoredA)).json.snapshot,A);
 assert.deepEqual((await call(base,'/qa/snapshot','GET',undefined,restoredB)).json.snapshot,B);
 pass('프로세스 재시작 후 A/B 기록 및 바이트 그대로, 이전 세션 토큰 자동 폐기');
 const newA=signSynthetic({...structuredClone(A),records:[...A.records,{...A.records[0],id:'qa26-a-new'}]});
 assert.equal((await call(base,'/qa/snapshot','PUT',newA,restoredA,'"0"')).status,409);
 assert.equal((await call(base,'/qa/snapshot','PUT',newA,restoredA,'"1"')).status,200);
 assert.equal((await call(base,'/qa/snapshot','GET',undefined,restoredA)).json.revision,2);
 pass('복구 후에도 기존 리비전 유지, 오래된 기기 요청은 409, 새 기록 추가는 정상');
 await gate.shutdown();gate=null;
 const original=readFileSync(file,'utf8');
 const tampered=JSON.parse(original);tampered.ciphertext=tampered.ciphertext.replace(/^./,tampered.ciphertext[0]==='A'?'B':'A');
 writeFileSync(file,JSON.stringify(tampered),'utf8');
 await assert.rejects(()=>createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key}),/auth|bad decrypt|authenticate/i);
 assert.equal((await import('node:fs')).readFileSync(file,'utf8'),JSON.stringify(tampered));
 pass('암호문 1바이트 위변조 시 서버 기동 차단·기존 원본 임의 교체 없음');
 writeFileSync(file,original,'utf8');
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 base=gate.baseUrl;
 const final=await login(base,'qa-family-one',P1);
 assert.deepEqual((await call(base,'/qa/snapshot','GET',undefined,final)).json.snapshot,newA);
 pass('원본 암호파일 복구 후 다시 2회차 모두 일치');
 console.log('QA_G15_DURABLE_RESULT='+JSON.stringify({
  status:'PASS',checks:passCount,encryptedAtRest:true,remoteHosted:false,
  persistedAcrossRestart:true,realCloud:false,realChildData:false,
  productionAuth:false,network:'127.0.0.1 only'
 }));
}finally{
 if(gate)await gate.shutdown();
 rmSync(temp,{recursive:true,force:true});
}
