// 02 WRONG / 00Q-02-AUTH: isolated execution of the *real QA index.ts* wrapper.
// Supabase createClient and SDK error constructor are injected fixtures;
// this is NOT a Deno/real SDK/JWT/remote HTTP or RLS test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleQa47AuthenticatedGuardianStatus} from '../supabase/functions/qa47-auth-status/handler.js';
import {rejectSdkAuthError} from '../supabase/functions/qa47-auth-status/auth-verified-denial.js';

const source=readFileSync(new URL('../supabase/functions/qa47-auth-status/index.ts',import.meta.url),'utf8');
const runnableSource=source.replace(/^import\s+.*;\r?\n/gm,'');
assert.doesNotMatch(runnableSource,/^import\s/m,'Unexpected ESM import must not be silently ignored');
class FixtureAuthApiError extends Error {
 constructor(status,code){super('PRIVATE_PROVIDER_MESSAGE');this.name='AuthApiError';this.status=status;this.code=code;}
}
const origin='http://127.0.0.1:4173', token='A'.repeat(68);
const makeRequest=(method='GET',extra={})=>new Request('https://qa.test/qa47-auth-status',{
 method,headers:{origin,authorization:'Bearer '+token,...extra}
});
function boot({env={},clientFactory=()=>{throw Error('SHOULD_NOT_CREATE_CLIENT')},envGet}={}) {
 let handler=null,clientCount=0,envCount=0;
 const Deno={env:{get(key){envCount++;return envGet?envGet(key):env[key]}},serve(fn){handler=fn}};
 const createClient=(...args)=>{clientCount++;return clientFactory(...args)};
 new Function('Deno','Response','createClient','AuthApiError',
  'handleQa47AuthenticatedGuardianStatus','rejectSdkAuthError',runnableSource)(
  Deno,Response,createClient,FixtureAuthApiError,handleQa47AuthenticatedGuardianStatus,rejectSdkAuthError);
 assert.equal(typeof handler,'function','Deno.serve callback missing');
 return {handle:handler,counts:()=>({clientCount,envCount})};
}
test('OPTIONS approved origin succeeds 204 with zero env reads or SDK calls',async()=>{
 const a=boot({envGet:()=>{throw Error('NO_ENV_DURING_PREFLIGHT')}});
 const response=await a.handle(makeRequest('OPTIONS'));
 assert.equal(response.status,204);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 assert.match(response.headers.get('access-control-allow-headers'),/x-client-info/);
 assert.deepEqual(a.counts(),{clientCount:0,envCount:0});
});
test('OPTIONS disallowed origin returns 403 before env reads, without CORS allow-origin',async()=>{
 const a=boot({envGet:()=>{throw Error('NO_ENV_DURING_PREFLIGHT')}});
 const response=await a.handle(makeRequest('OPTIONS',{origin:'https://evil.invalid'}));
 assert.equal(response.status,403);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.deepEqual(a.counts(),{clientCount:0,envCount:0});
});
test('GET unavailable platform env returns 503 and never constructs auth client',async()=>{
 const a=boot();const r=await a.handle(makeRequest());
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'STAGING_BACKEND_UNAVAILABLE');
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(a.counts().clientCount,0);
});
test('full entrypoint mocked SDK 401 denial and 503 provider outage preserve no sensitive response',async()=>{
 const env={SUPABASE_URL:'https://local.invalid',SUPABASE_ANON_KEY:'LOCAL_ANON_PLACEHOLDER'};
 for(const [err,expected] of [[new FixtureAuthApiError(403,'bad_jwt'),401],
     [new FixtureAuthApiError(503,'bad_jwt'),503],[new Error('PRIVATE_PROVIDER_MESSAGE'),503]]) {
  let rpcCalls=0;
  const a=boot({env,clientFactory:()=>({
    auth:{getUser:async()=>({error:err,data:{user:null}})},
    rpc:async()=>{rpcCalls++;return {data:[]}}
  })});
  const response=await a.handle(makeRequest());
  assert.equal(response.status,expected);
  const text=await response.text();
  assert.equal(text.includes('PRIVATE_PROVIDER_MESSAGE'),false);
  assert.equal(text.includes(token),false);
  assert.equal(rpcCalls,0);
  assert.equal(a.counts().clientCount,1);
 }
});
