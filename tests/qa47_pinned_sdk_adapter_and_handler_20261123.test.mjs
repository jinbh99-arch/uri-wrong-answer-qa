// Synthetic QA only, pinned SDK type/source verified from official v2.118.0 tag.
// Imports actual A-isolated handler and adapter, not production Supabase SDK runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rejectSdkAuthError,Qa47VerifiedAuthDenied} from '../supabase/functions/qa47-auth-status/auth-verified-denial.js';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
const ts=readFileSync(new URL('../supabase/functions/qa47-auth-status/index.ts',import.meta.url),'utf8');
class AuthApiErrorFromPinnedSdkFixture extends Error{
  constructor(status,code){super('SYNTHETIC_PROVIDER_AUTH_ERROR');this.name='AuthApiError';this.status=status;this.code=code;}
}
class AuthRetryableFetchErrorFromPinnedSdkFixture extends Error{
  constructor(status,code){super('SYNTHETIC_NETWORK_ERROR');this.name='AuthRetryableFetchError';this.status=status;this.code=code;}
}
const token='A'.repeat(68),origin='http://127.0.0.1:4173';
const user={id:'123e4567-e89b-42d3-a456-426614174000',is_anonymous:false};
const req=(method='GET',extra={})=>new Request('https://qa.invalid/function',{
 method,headers:{origin,authorization:'Bearer '+token,...extra}
});
const withError=(e)=>({getUser:async()=>rejectSdkAuthError(e,AuthApiErrorFromPinnedSdkFixture),findVerifiedFamilies:async()=>{throw Error('UNEXPECTED_RPC_CALLED')}});
async function checkError(e,expected){
  const response=await handle(req(),withError(e));
  assert.equal(response.status,expected);
  assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');
  const json=await response.json();
  assert.equal(json.error,expected===401?'AUTH_REQUIRED':'GUARDIAN_STATUS_UNAVAILABLE');
  assert.equal(JSON.stringify(json).includes('SYNTHETIC_'),false);
}
test('SDK semver pinned and runtime AuthApiError constructor passed to adapter',()=>{
 assert.match(ts,/npm:\@supabase\/supabase-js\@2\.118\.0/);
 assert.match(ts,/rejectSdkAuthError\(response\.error,AuthApiError\)/);
 assert.doesNotMatch(ts,/throw new Error\('AUTH_CHECK_FAILED'\)/);
});
test('pinned SDK AuthApiError bad JWT 401 -> trusted 401, no raw message',async()=>{await checkError(new AuthApiErrorFromPinnedSdkFixture(401,'bad_jwt'),401)});
test('pinned SDK expired/revoked session 401/403 -> trusted 401',async()=>{
 await checkError(new AuthApiErrorFromPinnedSdkFixture(401,'session_expired'),401);
 await checkError(new AuthApiErrorFromPinnedSdkFixture(403,'session_not_found'),401);
});
test('API outage 500/503 and retryable fetch error -> 503',async()=>{
 await checkError(new AuthApiErrorFromPinnedSdkFixture(500,'unexpected_failure'),503);
 await checkError(new AuthApiErrorFromPinnedSdkFixture(503,'bad_jwt'),503);
 await checkError(new AuthRetryableFetchErrorFromPinnedSdkFixture(503,'bad_jwt'),503);
});
test('untrusted plain Error and lookalike with AuthApiError fields cannot forge 401',async()=>{
 await checkError(new Error('AUTH_CHECK_FAILED'),503);
 await checkError({name:'AuthApiError',status:401,code:'bad_jwt',message:'FAKE'},503);
 await checkError(new AuthApiErrorFromPinnedSdkFixture(401,'unknown_error'),503);
});
test('invalid token/no anonymous user in handler is 401 without RPC',async()=>{
 for(const v of [null,{...user,is_anonymous:true},{id:'foo'}]){
  const r=await handle(req(),{getUser:async()=>v,findVerifiedFamilies:async()=>{throw Error('BAD_RPC')}});
  assert.equal(r.status,401);
 }
});
test('accepted synthetic guardian gets read-only 200 with zero family records',async()=>{
 const r=await handle(req(),{getUser:async()=>user,findVerifiedFamilies:async()=>[]});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{authenticated:true,guardianVerificationRequired:true,verifiedFamilyCount:0,studentRecordsEnabled:false,uploadsEnabled:false,syncWritesEnabled:false,productionApproved:false});
});
test('rpc failure 503; origin/method/preflight unchanged',async()=>{
 const r=await handle(req(),{getUser:async()=>user,findVerifiedFamilies:async()=>{throw Error('RPC_DOWN')}});assert.equal(r.status,503);
 const bad=await handle(req('GET',{origin:'https://disallowed.invalid'}),{});assert.equal(bad.status,403);
 const cors=await handle(req('OPTIONS'),{});assert.equal(cors.status,204);assert.match(cors.headers.get('access-control-allow-headers'),/x-client-info/);
 const method=await handle(req('POST'),{});assert.equal(method.status,405);
});
