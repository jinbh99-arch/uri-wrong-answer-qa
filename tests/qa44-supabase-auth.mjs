import assert from 'node:assert/strict';
import {createQa44StagingAuthAdapter} from '../scripts/qa44-supabase-auth-adapter.mjs';
const URL='http://127.0.0.1:4173';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      USER='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const calls=[],db={members:[],user:null,fail429:false,failProvider:false};
const client={
 auth:{
  async signInWithOAuth(args){calls.push(['google',args]);return {
   data:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic'}}},
  async signUp(args){calls.push(['signup',args]);return {data:{user:{id:USER},session:null}}},
  async signInWithPassword(args){calls.push(['email',args]);db.user={id:USER};return {data:{}}},
  async resetPasswordForEmail(email,opts){calls.push(['reset',{email,opts}]);
   if(db.fail429)return {error:{status:429,message:'simulated'}};return {data:{}}},
  async updateUser(opts){calls.push(['update',opts]);return {data:{}}},
  async getUser(){return db.failProvider?{error:{status:401}}:
   {data:{user:db.user}};},
  async signOut(opts){calls.push(['logout',opts]);db.user=null;return {data:{}}}
 },
 schema(schema){assert.equal(schema,'qa44');return {
  from(table){assert.equal(table,'guardian_memberships');return {
   select(columns){assert.ok(columns.includes('verification_source'));return {
    eq(field,id){assert.equal(field,'guardian_user_id');assert.equal(id,USER);
     return Promise.resolve({data:db.members})}
   }}
  }}
 }}
};
const config={mode:'SYNTHETIC_STAGE_ONLY',origin:URL,
 redirectUrl:URL+'/check.html',recoveryUrl:URL+'/check.html',
 allowRealChildren:false,isProduction:false};
let checks=0;const pass=s=>{checks++;console.log('PASS QA44 AUTH',s)};
try{
 assert.throws(()=>createQa44StagingAuthAdapter(client,{...config,isProduction:true}),/QA44_PUBLIC_LIVE_AUTH_DISABLED/);
 assert.throws(()=>createQa44StagingAuthAdapter(client,{...config,origin:'https://public.example.com'}),/QA44_PUBLIC_LIVE_AUTH_DISABLED/);
 const adapter=createQa44StagingAuthAdapter(client,config);
 assert.deepEqual(adapter.getState().families,[]);
 pass('실제 운영 공개·자녀 데이터 연결 금지, 합성 브라우저에서만 사용 가능');
 const google=await adapter.google();
 assert.equal(google.requiresBrowserNavigation,true);
 assert.ok(google.url.startsWith('https://accounts.google.com'));
 assert.equal(calls.at(-1)[1].provider,'google');
 assert.equal(calls.at(-1)[1].options.redirectTo,URL+'/check.html');
 pass('구글 OAuth SDK 호출·승인된 리다이렉트와 안전한 임시 응답');
 await adapter.register('PARENT@EXAMPLE.ORG','QA44-synthetic-password-2026');
 assert.deepEqual(adapter.getState().families,[]);
 assert.equal(calls.at(-1)[1].options.emailRedirectTo,URL+'/check.html');
 assert.equal(calls.at(-1)[1].email,'parent@example.org');
 await assert.rejects(adapter.register('bad-mail','short'),/EMAIL_FORMAT_INVALID/);
 await assert.rejects(adapter.register('parent@example.org','short'),/STRONG_PASSWORD_REQUIRED/);
 pass('이메일 가입·메일 인증 요구·입력 형식 및 12자 비밀번호 검증');
 db.members=[{family_id:A,verified_at:null,consent_verified_at:null,
  verification_source:'pending',revoked_at:null}];
 let result=await adapter.passwordSignIn('parent@example.org','QA44-synthetic-password-2026');
 assert.equal(result.authenticated,true);
 assert.equal(result.canAccessChildren,false);
 assert.deepEqual(result.families,[]);
 pass('이메일 로그인만으로는 법정대리인 권한 미부여 (DB 미검증 회원)');
 db.members=[{family_id:A,verified_at:new Date().toISOString(),consent_verified_at:null,
  verification_source:'externally_verified',revoked_at:null}];
 result=await adapter.refreshServerVerifiedIdentity();
 assert.equal(result.canAccessChildren,false);
 db.members[0].consent_verified_at=new Date().toISOString();
 result=await adapter.refreshServerVerifiedIdentity();
 assert.deepEqual(result.families,[A]);
 db.members.push({family_id:B,verified_at:new Date().toISOString(),
  consent_verified_at:new Date().toISOString(),verification_source:'pending',revoked_at:null});
 assert.deepEqual((await adapter.refreshServerVerifiedIdentity()).families,[A]);
 db.members[0].revoked_at=new Date().toISOString();
 assert.deepEqual((await adapter.refreshServerVerifiedIdentity()).families,[]);
 pass('외부 보호자 검증+별도 동의 검증 모두 필요, 비동의·철회·미검증 가족 접근 차단');
 const rec=await adapter.recovery('parent@example.org');
 assert.equal(rec.requestAccepted,true);
 assert.equal(calls.at(-1)[1].opts.redirectTo,URL+'/check.html');
 db.fail429=true;
 await assert.rejects(adapter.recovery('parent@example.org'),/AUTH_RATE_LIMITED/);
 db.fail429=false;
 pass('이메일 비밀번호 복구 및 공급자 rate-limit 처리, 계정 존재 정보 노출 방지');
 db.user={id:USER};
 const pw=await adapter.updatePassword('QA44-rotated-synthetic-2026');
 assert.equal(pw.revalidationRequired,true);
 assert.deepEqual(adapter.getState().families,[]);
 assert.ok(calls.at(-1)[1].password);
 db.failProvider=true;
 await assert.rejects(adapter.refreshServerVerifiedIdentity(),/AUTH_REQUEST_REJECTED/);
 assert.equal(adapter.getState().authenticated,false);
 db.failProvider=false;
 await adapter.logout();
 assert.equal(adapter.getState().authenticated,false);
 assert.equal(calls.at(-1)[1].scope,'local');
 pass('비밀번호 변경 후 재검증 요구, 서버 인증 실패/로그아웃 시 메모리 자격 상태 제거');
 console.log('QA44_SUPABASE_AUTH_RESULT='+JSON.stringify({
  status:'PASS',checks,googleOauthSdkCall:true,emailAuthSdkCalls:true,
  resetRecovery:true,externalGuardianGate:true,realProvider:false,
  realEmailSent:false,realAccounts:0,realChildren:0,productionApproved:false
 }));
}catch(e){console.error('QA44_SUPABASE_AUTH_RESULT='+JSON.stringify({
 status:'FAIL',checks,error:String(e),stack:String(e.stack).slice(0,1400)}));process.exitCode=1}
