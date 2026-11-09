import assert from 'node:assert/strict';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
const token='eyJhbGciOiJIUzI1NiJ9.'+'a'.repeat(90)+'.'+'b'.repeat(70);
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',F='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ROOT='https://hnpbwxgpwpellgeusjim.supabase.co/functions/v1/qa47-auth-status';
let checks=0;
const pass=s=>{checks++;console.log('PASS QA47 EDGE',s)};
const req=(opts={})=>new Request(ROOT,{method:opts.method||'GET',
 headers:{origin:opts.origin===undefined?'http://127.0.0.1:4173':opts.origin,
 ...(opts.token===null?{}:{authorization:'Bearer '+(opts.token||token)})}});
const svc={
 async getUser(){return {id:U,is_anonymous:false}},
 async findVerifiedFamilies(){return []}
};
let r=await handle(req({origin:'https://evil.example'}),svc);
assert.equal(r.status,403);
assert.equal(r.headers.has('access-control-allow-origin'),false);
pass('모르는 Origin 사전 차단·CORS 없음');
r=await handle(req({origin:'https://jinbh99-arch.github.io',method:'OPTIONS',token:null}),svc);
assert.equal(r.status,204);
assert.equal(r.headers.get('access-control-allow-origin'),'https://jinbh99-arch.github.io');
pass('독립 QA GitHub Pages 출처는 읽기 전용 CORS 사전 요청 허용');
const allowedHeaders=(r.headers.get('access-control-allow-headers')||'').split(',').map(x=>x.trim());
for(const header of ['authorization','x-client-info','apikey','content-type'])
 assert.ok(allowedHeaders.includes(header),'CORS preflight missing '+header);
assert.equal(r.headers.get('access-control-allow-methods'),'GET, OPTIONS');
pass('Supabase JS SDK x-client-info CORS 요청 허용 + GET/OPTIONS 한정');
r=await handle(req({origin:'https://jinbh99-arch.github.io',token:null}),svc);
assert.equal(r.status,401);
assert.equal(r.headers.get('access-control-allow-origin'),'https://jinbh99-arch.github.io');
pass('허용된 QA 출처에서도 JWT 없이 보호자 정보 조회 금지');
r=await handle(req({origin:'https://jinbh99-arch.github.io'}),svc);
assert.equal(r.status,200);
assert.equal((await r.json()).studentRecordsEnabled,false);
pass('QA 출처에서도 검증된 JWT + 데이터 비노출 조건 유지');
r=await handle(req({token:null}),svc);
assert.equal(r.status,401);
assert.equal((await r.json()).error,'AUTH_REQUIRED');
pass('빈 Bearer 토큰 401, 보호자 정보 노출 없음');
r=await handle(req({token:'notjwt'}),svc);
assert.equal(r.status,401);
pass('JWT 형식/길이 오류 401');
r=await handle(req({method:'POST'}),svc);
assert.equal(r.status,405);
pass('쓰기·POST 금지, 상태 읽기 GET only');
r=await handle(req({method:'OPTIONS',token:null}),svc);
assert.equal(r.status,204);
assert.equal(r.headers.get('access-control-allow-origin'),'http://127.0.0.1:4173');
pass('루프백 원점에서만 OPTIONS 허용');
r=await handle(req(),{...svc,getUser:async()=>null});
assert.equal(r.status,401);
pass('실 Supabase auth.getUser 불일치/실패 시 인증 차단');
r=await handle(req(),{...svc,getUser:async()=>({id:U,is_anonymous:true})});
assert.equal(r.status,401);
pass('익명 SignIn 사용자도 권한 거부');
r=await handle(req(),svc);
let j=await r.json();
assert.equal(r.status,200);
assert.deepEqual(j,{authenticated:true,guardianVerificationRequired:true,
 verifiedFamilyCount:0,studentRecordsEnabled:false,uploadsEnabled:false,
 syncWritesEnabled:false,productionApproved:false});
assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
pass('인증 성공·보호자 관계 없음 → 실아동 데이터 접근·업로드·동기화 모두 금지');
r=await handle(req(),{...svc,findVerifiedFamilies:async()=>[F]});
j=await r.json();
assert.equal(j.verifiedFamilyCount,1);
assert.equal(j.guardianVerificationRequired,false);
assert.equal(j.studentRecordsEnabled,false);
assert.ok(!JSON.stringify(j).includes(F));
pass('자기 보호자 가족 1곳 확인되더라도 가족ID·학생데이터·쓰기 기능은 공개하지 않음');
r=await handle(req(),{...svc,findVerifiedFamilies:async()=>[F,F]});
assert.equal(r.status,503);
pass('중복 가족 검증 응답 fail closed');
r=await handle(req(),{...svc,findVerifiedFamilies:async()=>[{family_id:F}]});
assert.equal(r.status,503);
pass('SDK/RPC 예상하지 않은 형식은 거부');
r=await handle(req(),{...svc,findVerifiedFamilies:async()=>{throw Error('secret test token email')}});
assert.equal(r.status,503);
assert.deepEqual(await r.json(),{error:'GUARDIAN_STATUS_UNAVAILABLE'});
pass('서버 오류/토큰/개인정보를 응답에 노출하지 않음');
r=await handle(req(),{});
assert.equal(r.status,503);
pass('플랫폼 환경·Auth 클라이언트 누락 시 fail closed');
console.log('QA47_EDGE_TEST_RESULT='+JSON.stringify({status:'PASS',checks,
 realSupabaseJwtTested:false,liveEdgeDeploymentVerified:false,realChildren:0}));
