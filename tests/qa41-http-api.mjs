// QA41: verified signed JWT -> HTTP Origin/CORS -> real Postgres RLS -> ETag
// CAS, through two Chromium contexts. Synthetic data and loopback only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createQa40SyntheticOidcResolver} from '../scripts/qa40-oidc-resolver.mjs';
import {createQa41LoopbackFamilyApi} from '../scripts/qa41-signed-family-http.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const {Pool}=pg;
if(!process.env.QA39_TEST_DATABASE_URL||
   !process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('QA41_TEST_DATABASE_MUST_BE_EPHEMERAL_LOOPBACK');
process.env.QA39_REFERENCE_ONLY='1';
process.env.QA40_SYNTHETIC_JWKS_ONLY='1';
process.env.QA41_LOOPBACK_ONLY='1';
const ID_A='44444444-4444-4444-8444-444444444444';
const ID_B='55555555-5555-4555-8555-555555555555';
const ISSUER='https://qa41-synthetic.invalid', AUDIENCE='qa41-api';
const USER_A='qa41-synthetic-guardian-a',USER_B='qa41-synthetic-guardian-b';
const ORIGIN='http://127.0.0.1:4173';
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const appUrl=new URL(process.env.QA39_TEST_DATABASE_URL);
appUrl.username='qa39_app';appUrl.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const app=new Pool({connectionString:appUrl.toString()});
let api,browser,ctxA,ctxB,checks=0;
const pass=s=>{checks++;console.log('PASS QA41 HTTP',s)};
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const mkDoc=(rows)=>{
 const photos={};
 for(const x of rows)if(x.hasPhoto)photos[x.id]=photo;
 return signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{nickname:'QA41 synthetic only',grade:3},
  records:rows,photos
 });
};
async function send(path,method='GET',token,body,extra={}){
 const headers={origin:ORIGIN,...extra};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined&&typeof body!=='string')headers['content-type']='application/json';
 const res=await fetch(api.baseUrl+path,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});
 let data;try{data=await res.json()}catch{data=null}
 return {status:res.status,data,headers:res.headers};
}
try{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{modulusLength:2048});
 const jwk={...await exportJWK(publicKey),use:'sig',alg:'RS256',kid:'qa41-test-jwk'};
 const resolver=createQa40SyntheticOidcResolver({issuer:ISSUER,audience:AUDIENCE,jwks:{keys:[jwk]}});
 const issue=subject=>new SignJWT({qa:true}).setProtectedHeader({alg:'RS256',kid:jwk.kid})
  .setIssuer(ISSUER).setAudience(AUDIENCE).setSubject(subject)
  .setIssuedAt().setExpirationTime('5m').sign(privateKey);
 const tokenA=await issue(USER_A), tokenB=await issue(USER_B),tokenUnknown=await issue('qa41-not-provisioned');
 for(const [id,subject] of [[ID_A,USER_A],[ID_B,USER_B]]){
  await admin.query('INSERT INTO qa39.families(family_id) VALUES ($1)',[id]);
  await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES ($1)',[id]);
  const principal='oidc:'+createHash('sha256').update(ISSUER+'\0'+subject).digest('hex');
  await admin.query(`INSERT INTO qa39.guardian_memberships
   (family_id,principal_id,role,verified_at) VALUES ($1,$2,'guardian',now())`,
   [id,principal]);
 }
 // Catch unsafe omission of explicit QA-only startup guard.
 delete process.env.QA41_LOOPBACK_ONLY;
 await assert.rejects(
  createQa41LoopbackFamilyApi({pool:app,resolveAuthenticatedPrincipal:resolver}),
  /QA41_PRODUCTION_NETWORK_DISABLED/
 );
 process.env.QA41_LOOPBACK_ONLY='1';
 api=await createQa41LoopbackFamilyApi({pool:app,resolveAuthenticatedPrincipal:resolver});
 assert.ok(/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(api.baseUrl));
 pass('외부 주소 bind 금지, 명시적 합성 개발 모드 없으면 API 실행 자체가 차단됨');

 const noOrigin=await fetch(api.baseUrl+'/qa41/families',{headers:{authorization:'Bearer '+tokenA}});
 assert.equal(noOrigin.status,403);
 const wrongOrigin=await send('/qa41/families','GET',tokenA,undefined,{origin:'https://evil.invalid'});
 assert.equal(wrongOrigin.status,403);
 const preflight=await send('/qa41/families','OPTIONS');
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN);
 assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
 pass('Origin 정책·OPTIONS 프리플라이트, 비인가 출처와 쿠키 인증 허용 금지');

 const unauth=await send('/qa41/families');
 assert.equal(unauth.status,401);
 const badToken=await send('/qa41/families','GET',tokenA.slice(0,-4)+'aaaa');
 assert.equal(badToken.status,401);
 // QA43: a CORS-mode browser must observe the actual 401 and clear the
 // synthetic session, not misreport it as a disconnected network.
 assert.equal(badToken.headers.get('access-control-allow-origin'),ORIGIN);
 assert.equal(wrongOrigin.headers.get('access-control-allow-origin'),null);
 assert.deepEqual((await send('/qa41/families','GET',tokenA)).data.families,[ID_A]);
 assert.deepEqual((await send('/qa41/families','GET',tokenB)).data.families,[ID_B]);
 assert.deepEqual((await send('/qa41/families','GET',tokenUnknown)).data.families,[]);
 pass('JWT 없는 요청·서명 변조 차단, 가족 목록은 검증된 보호자의 승인 가족만 응답');

 assert.equal((await send('/qa41/families/'+ID_B+'/snapshot','GET',tokenA)).status,404);
 assert.equal((await send('/qa41/families/'+ID_A+'/snapshot','GET',tokenB)).status,404);
 assert.equal((await send('/qa41/families/'+ID_B+'/snapshot','GET',tokenUnknown)).status,404);
 const initial=await send('/qa41/families/'+ID_A+'/snapshot','GET',tokenA);
 assert.equal(initial.status,200);
 assert.equal(initial.data.revision,0);
 assert.equal(initial.headers.get('etag'),'"0"');
 assert.equal(initial.headers.get('cache-control'),'no-store, max-age=0');
 assert.equal(initial.headers.get('x-content-type-options'),'nosniff');
 pass('보호자별 DB 행 수준 접근 차단과 초기 ETag, no-store 보호 헤더');

 const snapPath='/qa41/families/'+ID_A+'/snapshot';
 const one=mkDoc([{id:'qa41-photo-1',hasPhoto:true,problemText:'2/3+1/3',practiceHistory:[]}]);
 const noMatch=await send(snapPath,'PUT',tokenA,{snapshot:one});
 assert.equal(noMatch.status,428);
 assert.equal((await send(snapPath,'PUT',tokenA,{snapshot:one},{'if-match':'0'})).status,400);
 assert.equal((await send(snapPath,'PUT',tokenA,{snapshot:one,ignored:'family-b'}, {'if-match':'"0"'})).status,400);
 const first=await send(snapPath,'PUT',tokenA,{snapshot:one},{'if-match':'"0"'});
 assert.equal(first.status,200);assert.equal(first.data.revision,1);
 const got=await send(snapPath,'GET',tokenA);
 assert.equal(got.status,200);assert.equal(got.headers.get('etag'),'"1"');
 assert.deepEqual(got.data.snapshot,one);
 assert.equal(got.data.snapshot.photos['qa41-photo-1'],photo);
 pass('필수 If-Match·엄격한 payload 검증, 서명된 백업/가상 사진 원본 저장·읽기 일치');

 const mismatch=await send(snapPath,'PUT',tokenA,{snapshot:one},{'if-match':'"0"'});
 assert.equal(mismatch.status,409);
 const erased=mkDoc([]);
 assert.equal((await send(snapPath,'PUT',tokenA,{snapshot:erased},{'if-match':'"1"'})).status,409);
 const tampered=structuredClone(one);tampered.records[0].problemText='malicious';
 assert.equal((await send(snapPath,'PUT',tokenA,{snapshot:tampered},{'if-match':'"1"'})).status,422);
 assert.equal((await send(snapPath,'PUT',tokenB,{snapshot:one},{'if-match':'"1"'})).status,404);
 const left=mkDoc([...one.records,{id:'qa41-extra-A',hasPhoto:false,problemText:'A',practiceHistory:[]}]);
 const right=mkDoc([...one.records,{id:'qa41-extra-B',hasPhoto:false,problemText:'B',practiceHistory:[]}]);
 const outcomes=await Promise.all([
  send(snapPath,'PUT',tokenA,{snapshot:left},{'if-match':'"1"'}),
  send(snapPath,'PUT',tokenA,{snapshot:right},{'if-match':'"1"'})
 ]);
 assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,409]);
 const serverAfter=await send(snapPath,'GET',tokenA);
 assert.equal(serverAfter.data.revision,2);
 assert.equal(serverAfter.data.snapshot.records.length,2);
 assert.equal(serverAfter.data.snapshot.photos['qa41-photo-1'],photo);
 pass('낡은 ETag·불완전 백업·타 가족 PUT 거부, 동시 PUT 2건은 정확히 1건만 성공');

 assert.equal((await send(snapPath,'POST',tokenA,{snapshot:one})).status,405);
 assert.equal((await send(snapPath,'DELETE',tokenA)).status,405);
 assert.equal((await send('/qa41/families','PUT',tokenA,{snapshot:one})).status,405);
 const tooBig=await send(snapPath,'PUT',tokenA,'x'.repeat(1050000),
  {'if-match':'"2"','content-type':'application/json'});
 assert.equal(tooBig.status,413);
 assert.equal((await send(snapPath,'PUT',tokenA,'{broken',
  {'if-match':'"2"','content-type':'application/json'})).status,400);
 assert.equal((await send(snapPath+'?secret=x','GET',tokenA)).status,404);
 pass('삭제·임의 POST·용량 초과·잘못된 JSON·쿼리 인자 거부, 기존 서버 기록 불변');

 browser=await chromium.launch({headless:true});
 ctxA=await browser.newContext({viewport:{width:390,height:844}});
 ctxB=await browser.newContext({viewport:{width:320,height:640}});
 const pageA=await ctxA.newPage(),pageB=await ctxB.newPage();
 await Promise.all([pageA.goto(ORIGIN+'/check.html'),pageB.goto(ORIGIN+'/check.html')]);
 const browserRead=(page,token,id)=>page.evaluate(async({baseUrl,token,id})=>{
  const response=await fetch(baseUrl+'/qa41/families/'+id+'/snapshot',{
   headers:{authorization:'Bearer '+token}});
  return {status:response.status,cors:response.headers.get('access-control-allow-origin'),
   data:await response.json()};
 },{baseUrl:api.baseUrl,token,id});
 const browserA=await browserRead(pageA,tokenA,ID_A);
 const browserB=await browserRead(pageB,tokenB,ID_A);
 // Browsers enforce CORS, but do not expose Access-Control-Allow-Origin
 // to page JavaScript unless the server explicitly exposes it. Successful
 // cross-origin fetch and readable JSON are the correct browser assertions.
 assert.equal(browserA.status,200);
 assert.equal(browserA.data.snapshot.photos['qa41-photo-1'],photo);
 assert.equal(browserB.status,404);
 pass('서로 분리된 실제 Chromium 390/320px 출처에서 CORS+JWT+가족별 RLS 동작 확인');

 await admin.query('UPDATE qa39.guardian_memberships SET revoked_at=now() WHERE family_id=$1',[ID_A]);
 assert.equal((await send(snapPath,'GET',tokenA)).status,404);
 assert.equal((await send(snapPath,'PUT',tokenA,{snapshot:serverAfter.data.snapshot},
  {'if-match':'"2"'})).status,404);
 const persisted=await admin.query('SELECT revision,snapshot_text FROM qa39.family_snapshots WHERE family_id=$1',[ID_A]);
 assert.equal(Number(persisted.rows[0].revision),2);
 assert.equal(JSON.parse(persisted.rows[0].snapshot_text).photos['qa41-photo-1'],photo);
 pass('JWT가 유효해도 보호자 권한 철회 즉시 HTTP 읽기/쓰기 404, 서버 원본 그대로 보존');

 console.log('QA41_SIGNED_HTTP_RLS_RESULT='+JSON.stringify({
  status:'PASS',checks,realPostgres:true,realChromiumContexts:2,
  signedSyntheticJwt:true,conditionalHttpPut:true,crossTenantDenied:true,
  parentRevocationDenied:true,realCloud:false,productionHttps:false,
  legalGuardianVerified:false,realChildren:0,productionApproved:false
 }));
}catch(err){
 console.error('QA41_SIGNED_HTTP_RLS_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(err),code:err?.code,stack:String(err?.stack).slice(0,1500)}));
 process.exitCode=1;
}finally{
 if(ctxA)await ctxA.close();
 if(ctxB)await ctxB.close();
 if(browser)await browser.close();
 if(api)await api.shutdown();
 await app.end();await admin.end();
}
