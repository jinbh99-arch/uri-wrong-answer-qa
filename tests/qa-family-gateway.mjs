// QA25: 2 synthetic families, two device-simulated sessions, append-only conflict guard.
import assert from 'node:assert/strict';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
let checks=0;
const pass=s=>{checks++;console.log('PASS QA25 G15',s)};
await assert.rejects(()=>createIsolatedQaFamilyGateway(),/QA_ONLY/);
pass('explicit synthetic-only activation mandatory');
process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
const gate=await createIsolatedQaFamilyGateway(),BASE=gate.baseUrl;
const P1='QA-TEMP-PASSWORD-DO-NOT-USE-2026',P2='QA-TEMP-PASSWORD-TWO-2026';
async function json(path,method='GET',data,token,etag){
 const headers={};
 if(data!==undefined)headers['content-type']='application/json';
 if(token)headers.authorization='Bearer '+token;
 if(etag)headers['if-match']=etag;
 const res=await fetch(BASE+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 return {status:res.status,payload:await res.json(),etag:res.headers.get('etag')};
}
const row=id=>({id,problemText:'synthetic QA no user',hasPhoto:false,practiceHistory:[]});
const data=(ids,profile={grade:'3',nickname:'QA-EXAMPLE'})=>signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile,records:ids.map(row),photos:{}
});
let a=await json('/qa/register','POST',{familyKey:'qa-family-a',password:P1});
assert.equal(a.status,201);
a=await json('/qa/register','POST',{familyKey:'qa-family-b',password:P2});
assert.equal(a.status,201);
pass('서로 분리된 합성 가족 A·B 메모리 계정 생성, 실제 운영 계정 미생성');
assert.equal((await json('/qa/snapshot')).status,401);
assert.equal((await json('/qa/login','POST',{familyKey:'qa-family-a',password:'definitely-wrong-password-123'})).status,401);
const session=async (familyKey,password)=>{
 const r=await json('/qa/login','POST',{familyKey,password});
 assert.equal(r.status,200);return r.payload.token;
};
const a1=await session('qa-family-a',P1),a2=await session('qa-family-a',P1),b1=await session('qa-family-b',P2);
assert.notEqual(a1,a2);
pass('비밀번호 인증·서로 다른 불투명 세션 토큰·미인증 요청 차단');
assert.deepEqual((await json('/qa/snapshot','GET',undefined,a1)).payload,{revision:0,snapshot:null,qaOnly:true});
assert.equal((await json('/qa/snapshot','PUT',data(['a']),a1)).status,428);
const first=data(['qa-a-1']);
const put1=await json('/qa/snapshot','PUT',first,a1,'"0"');
assert.equal(put1.status,200);
assert.equal(put1.etag,'"1"');
const current=await json('/qa/snapshot','GET',undefined,a1);
assert.deepEqual(current.payload.snapshot,first);
assert.equal((await json('/qa/snapshot','GET',undefined,b1)).payload.snapshot,null);
pass('가족 A 로컬 데이터 저장·읽기, 가족 B와 격리; If-Match 필수');
assert.equal((await json('/qa/snapshot','PUT',data(['qa-a-1','qa-a-2']),a2,'"0"')).status,409);
assert.equal((await json('/qa/snapshot','GET',undefined,a2)).payload.revision,1);
pass('동시에 접속한 A의 두 번째 세션의 오래된 저장 차단');
const edited=data(['qa-a-1']);edited.records[0].problemText='changed';signSynthetic(edited);
assert.equal((await json('/qa/snapshot','PUT',edited,a1,'"1"')).status,409);
assert.equal((await json('/qa/snapshot','PUT',data([]),a1,'"1"')).status,409);
pass('같은 ID 내용 충돌·기존 기록의 묵시적 삭제 차단');
const add=data(['qa-a-1','qa-a-2']);
assert.equal((await json('/qa/snapshot','PUT',add,a1,'"1"')).status,200);
assert.equal((await json('/qa/snapshot','GET',undefined,a2)).payload.snapshot.records.length,2);
assert.equal((await json('/qa/snapshot','GET',undefined,b1)).payload.snapshot,null);
pass('같은 데이터 유지+새 ID만 있는 합성 백업은 명시적 최신버전에서 추가');
const forged=structuredClone(add);forged.records[0].problemText='tampered';
assert.equal((await json('/qa/snapshot','PUT',forged,a1,'"2"')).status,422);
assert.equal((await json('/qa/snapshot','GET',undefined,a1)).payload.revision,2);
pass('서명 위조가 아닌 불일치 SHA-256·원본 변경 저장 차단');
const bPut=await json('/qa/snapshot','PUT',data(['qa-b-1'],{grade:'5',nickname:'QA-B'}),b1,'"0"');
assert.equal(bPut.status,200);
assert.equal((await json('/qa/snapshot','GET',undefined,b1)).payload.snapshot.records[0].id,'qa-b-1');
assert.equal((await json('/qa/snapshot','GET',undefined,a1)).payload.snapshot.records.length,2);
pass('두 합성 가족 A/B 기록·학년 프로필 분리');
await json('/qa/logout','POST',undefined,a1);
assert.equal((await json('/qa/snapshot','GET',undefined,a1)).status,401);
assert.equal((await json('/qa/snapshot','GET',undefined,a2)).status,200);
pass('한 세션 로그아웃 후 토큰 폐기, 다른 동일 가족 세션은 유지');
await gate.shutdown();
assert.equal(gate.qaOnly,true);
assert.equal(gate.productionAuth,false);
assert.equal(gate.cloudReady,false);
console.log('QA_G15_LOOPBACK_RESULT='+JSON.stringify({status:'PASS',checks,realChildren:0,cloudSync:false,realFamilyAuth:false,network:'127.0.0.1 isolated only',productionDeploy:false}));
