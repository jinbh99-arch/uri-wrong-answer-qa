// QA40 G15: real cryptographic JWT verification + real ephemeral PostgreSQL
// RLS interaction. NO production IdP or child identities, all keys synthetic.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {SignJWT,generateKeyPair,exportJWK} from 'jose';
import {createQa40SyntheticOidcResolver} from '../scripts/qa40-oidc-resolver.mjs';
import {createQa39TenantStore} from '../scripts/qa39-tenant-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const {Pool}=pg;
if(!process.env.QA39_TEST_DATABASE_URL||
   !process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('QA40 requires prior isolated local QA39 PostgreSQL instance');
process.env.QA40_SYNTHETIC_JWKS_ONLY='1';
process.env.QA39_REFERENCE_ONLY='1';
const issuer='https://qa40-synthetic-issuer.invalid';
const audience='qa40-synthetic-api';
const familyId='33333333-3333-4333-8333-333333333333';
const sub='synthetic-guardian-40';
const dbAdmin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL,max:2});
const appUrl=new URL(process.env.QA39_TEST_DATABASE_URL);
appUrl.username='qa39_app';appUrl.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const dbApp=new Pool({connectionString:appUrl.toString(),max:2});
let checks=0;const pass=s=>{checks++;console.log('PASS QA40 VERIFIED ID',s)};
const signed=(key,subject,overrides={})=>{
 const {iss=issuer,aud=audience,iat=Math.floor(Date.now()/1000),
  exp=iat+300,nbf=undefined,kid='QA40-synthetic-key'}=overrides;
 let jwt=new SignJWT({study:'synthetic-qa-only'})
  .setProtectedHeader({alg:'RS256',kid}).setIssuer(iss)
  .setAudience(aud).setSubject(subject).setIssuedAt(iat).setExpirationTime(exp);
 if(nbf!==undefined)jwt=jwt.setNotBefore(nbf);
 return jwt.sign(key);
};
const mustReject=async(promise)=>{
 await assert.rejects(promise,e=>e?.code==='AUTHENTICATION_REJECTED'&&
  e.message==='AUTHENTICATION_REJECTED');
};
try{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{modulusLength:2048});
 const jwk={...(await exportJWK(publicKey)),alg:'RS256',kid:'QA40-synthetic-key',use:'sig'};
 const resolver=createQa40SyntheticOidcResolver({issuer,audience,jwks:{keys:[jwk]}});
 const auth={bearerToken:await signed(privateKey,sub)};
 const verified=await resolver(auth);
 assert.equal(verified,'oidc:'+createHash('sha256').update(issuer+'\0'+sub).digest('hex'));
 assert.equal(await resolver({bearerToken:await signed(privateKey,sub)}),verified);
 pass('RSA SHA-256 서명된 JWT 발급자·대상·sub/iat/exp 확인 후 안정된 익명화 식별자');

 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{iss:'https://attacker.invalid'})}));
 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{aud:'different-service'})}));
 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{
  iat:Math.floor(Date.now()/1000)-900,exp:Math.floor(Date.now()/1000)+200
 })}));
 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{
  iat:Math.floor(Date.now()/1000)-3600,exp:Math.floor(Date.now()/1000)-120
 })}));
 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{
  nbf:Math.floor(Date.now()/1000)+600
 })}));
 pass('다른 발급자·사용처·오래된 발급시각·만료·미래 nbf를 모두 거부');

 const token=auth.bearerToken;
 const chunks=token.split('.');
 const flipped=chunks[1].slice(0,10)+(chunks[1][10]==='A'?'B':'A')+chunks[1].slice(11);
 await mustReject(resolver({bearerToken:[chunks[0],flipped,chunks[2]].join('.')}));
 const wrongPair=await generateKeyPair('RS256',{modulusLength:2048});
 await mustReject(resolver({bearerToken:await signed(wrongPair.privateKey,sub)}));
 await mustReject(resolver({bearerToken:await signed(privateKey,sub,{kid:'unknown-key'})}));
 await mustReject(resolver({bearerToken:'opaque-bearer-token'}));
 await mustReject(resolver({}));
 pass('페이로드 변조·가짜 서명·알 수 없는 kid·서명 없는 입력 차단');

 const badJwk={...jwk,d:'synthetic-leak-test'};
 assert.throws(()=>createQa40SyntheticOidcResolver({issuer,audience,jwks:{keys:[badJwk]}}),/INVALID_PUBLIC_JWK/);
 assert.throws(()=>createQa40SyntheticOidcResolver({issuer:'http://unsafe.invalid',audience,jwks:{keys:[jwk]}}),/INVALID_SYNTHETIC_ISSUER/);
 const oldMode=process.env.QA40_SYNTHETIC_JWKS_ONLY;
 delete process.env.QA40_SYNTHETIC_JWKS_ONLY;
 try{assert.throws(()=>createQa40SyntheticOidcResolver({issuer,audience,jwks:{keys:[jwk]}}),
  /REAL_IDENTITY_PROVIDER_NOT_CONFIGURED/)}
 finally{process.env.QA40_SYNTHETIC_JWKS_ONLY=oldMode}
 pass('JWKS 사설키 유입/HTTP 발급자/합성 QA 명시적 승인 없는 실행 모두 차단');

 // The QA39 database schema was provisioned earlier in the same CI job.
 await dbAdmin.query(`INSERT INTO qa39.guardian_memberships
   (family_id,principal_id,role,verified_at) VALUES ($1,$2,'guardian',now())`,
   [familyId,verified]);
 const store=createQa39TenantStore(dbApp,resolver);
 assert.deepEqual(await store.families(auth),[familyId]);
 assert.equal(await store.read(auth,'11111111-1111-4111-8111-111111111111'),null);
 const unknown={bearerToken:await signed(privateKey,'synthetic-not-approved')};
 assert.deepEqual(await store.families(unknown),[]);
 assert.equal(await store.read(unknown,familyId),null);
 pass('JWT 서명검증은 본인확인일 뿐, DB 보호자 승인 없는 토큰과 타 가족은 RLS 거부');

 const document=signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{nickname:'QA40 only',grade:3},
  records:[{id:'qa40-photo',problemText:'2+3=?',hasPhoto:true,practiceHistory:[]}],
  photos:{'qa40-photo':'data:image/png;base64,aGVsbG8='}
 });
 const stored=await store.put(auth,familyId,0,document);
 assert.equal(stored.revision,1);
 assert.deepEqual((await store.read(auth,familyId)).snapshot,document);
 await assert.rejects(store.put(auth,familyId,0,document),/STALE_REVISION/);
 pass('실제 서명 검증 JWT→보호자 RLS→서버 조건부 저장·사진 원본·낡은 기록 차단');

 await dbAdmin.query('UPDATE qa39.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND principal_id=$2',
  [familyId,verified]);
 assert.equal(await store.read(auth,familyId),null);
 await assert.rejects(store.put(auth,familyId,1,document),/FAMILY_NOT_ACCESSIBLE/);
 pass('유효한 JWT라도 법정대리인 관계 철회 시 가족 데이터 접근 즉시 차단');

 console.log('QA40_SIGNED_IDENTITY_RLS_RESULT='+JSON.stringify({
  status:'PASS',checks,realRsaSignature:true,issuerAudienceExpiryChecked:true,
  actualPostgresRls:true,syntheticJwksOnly:true,realIdentityProvider:false,
  legalGuardianRelationshipVerified:false,productionApproved:false,realChildren:0
 }));
}catch(e){
 console.error('QA40_SIGNED_IDENTITY_RLS_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,1050)
 }));
 process.exitCode=1;
}finally{await dbApp.end();await dbAdmin.end()}
