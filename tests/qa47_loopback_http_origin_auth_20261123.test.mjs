// 02 WRONG / 00Q-02-AUTH: real Node TCP loopback HTTP transport for
// the exact A-isolated handler.js and typed error adapter, with MOCK SDK.
// NOT a real Supabase SDK, Deno Edge, JWT signature, deployed HTTP, or family RLS test.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
import {rejectSdkAuthError} from '../supabase/functions/qa47-auth-status/auth-verified-denial.js';
const origin='http://127.0.0.1:4173';
const token='SYNTHETIC_QA_TOKEN_'+('A'.repeat(65));
const guardian={id:'123e4567-e89b-42d3-a456-426614174000',is_anonymous:false};
class MockAuthApiError extends Error{
 constructor(status,code){super('DO_NOT_REFLECT_SDK_ERROR');this.name='AuthApiError';this.status=status;this.code=code;}
}
let server, base, mode='denied', getUserCalls=0, rpcCalls=0;
const services={
 async getUser(){getUserCalls++;
  if(mode==='denied')rejectSdkAuthError(new MockAuthApiError(401,'bad_jwt'),MockAuthApiError);
  if(mode==='expired')rejectSdkAuthError(new MockAuthApiError(403,'session_expired'),MockAuthApiError);
  if(mode==='outage')rejectSdkAuthError(new MockAuthApiError(503,'bad_jwt'),MockAuthApiError);
  if(mode==='network')rejectSdkAuthError(new Error('DO_NOT_REFLECT_SDK_ERROR'),MockAuthApiError);
  if(mode==='anonymous')return {...guardian,is_anonymous:true};
  return guardian;
 },
 async findVerifiedFamilies(){rpcCalls++;
  if(mode==='rpc')throw Error('DO_NOT_REFLECT_SDK_ERROR');
  return [];
 }
};
before(async()=>{
 server=createServer(async(req,res)=>{
  try{
   // Native node:http request is wrapped in Fetch API Request; the original
   // handler decides authorization, status, CORS and response headers.
   const url='http://127.0.0.1/'+(req.url||'');
   const response=await handle(new Request(url,{method:req.method,headers:req.headers}),services);
   res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(err){res.writeHead(500,{'content-type':'text/plain'});res.end('LOOPBACK_HARNESS_ERROR');}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 base='http://127.0.0.1:'+server.address().port+'/functions/v1/qa47-auth-status';
});
after(async()=>{if(server){server.close();await once(server,'close')}});
const call=(method='GET',extra={})=>fetch(base,{method,headers:{origin,authorization:'Bearer '+token,...extra},redirect:'manual'});
const checkSafety=async(response,status)=>{
 assert.equal(response.status,status);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 assert.equal(response.headers.get('vary'),'Origin');
 const text=await response.text();
 assert.equal(text.includes(token),false);
 assert.equal(text.includes('DO_NOT_REFLECT_SDK_ERROR'),false);
 assert.equal(text.includes('123e4567-e89b-42d3-a456-426614174000'),false);
 return text?JSON.parse(text):{};
};
test('loopback OPTIONS CORS succeeds without getUser or RPC',async()=>{
 getUserCalls=0;rpcCalls=0;
 const r=await call('OPTIONS',{'access-control-request-method':'GET','access-control-request-headers':'authorization,x-client-info'});
 assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 assert.match(r.headers.get('access-control-allow-headers'),/x-client-info/);
 assert.equal(getUserCalls,0);assert.equal(rpcCalls,0);
});
test('loopback disallowed Origin and no bearer fail closed before SDK',async()=>{
 getUserCalls=0;rpcCalls=0;
 const denied=await call('GET',{origin:'https://untrusted.example'});
 assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
 const missing=await call('GET',{authorization:''});
 assert.deepEqual(await checkSafety(missing,401),{error:'AUTH_REQUIRED'});
 assert.equal(getUserCalls,0);assert.equal(rpcCalls,0);
});
test('loopback typed 401/403 auth denial maps to 401 without RPC or raw message',async()=>{
 for(const m of ['denied','expired']){
  mode=m;getUserCalls=0;rpcCalls=0;
  const r=await call();assert.deepEqual(await checkSafety(r,401),{error:'AUTH_REQUIRED'});
  assert.equal(getUserCalls,1);assert.equal(rpcCalls,0);
 }
});
test('loopback SDK-like 503 and unknown network error stay 503',async()=>{
 for(const m of ['outage','network']){
  mode=m;getUserCalls=0;rpcCalls=0;
  const r=await call();assert.deepEqual(await checkSafety(r,503),{error:'GUARDIAN_STATUS_UNAVAILABLE'});
  assert.equal(getUserCalls,1);assert.equal(rpcCalls,0);
 }
});
test('loopback successful synthetic guardian returns read-only status and NO family data',async()=>{
 mode='ok';getUserCalls=0;rpcCalls=0;
 const data=await checkSafety(await call(),200);
 assert.deepEqual(data,{authenticated:true,guardianVerificationRequired:true,verifiedFamilyCount:0,
  studentRecordsEnabled:false,uploadsEnabled:false,syncWritesEnabled:false,productionApproved:false});
 assert.equal(getUserCalls,1);assert.equal(rpcCalls,1);
});
test('loopback anonymous and RPC outage fail closed',async()=>{
 mode='anonymous';getUserCalls=0;rpcCalls=0;
 assert.deepEqual(await checkSafety(await call(),401),{error:'AUTH_REQUIRED'});
 assert.equal(rpcCalls,0);
 mode='rpc';
 assert.deepEqual(await checkSafety(await call(),503),{error:'GUARDIAN_STATUS_UNAVAILABLE'});
 assert.equal(rpcCalls,1);
});
test('loopback POST cannot mutate and always returns 405',async()=>{
 mode='ok';getUserCalls=0;rpcCalls=0;
 assert.deepEqual(await checkSafety(await call('POST'),405),{error:'METHOD_NOT_ALLOWED'});
 assert.equal(getUserCalls,0);assert.equal(rpcCalls,0);
});
