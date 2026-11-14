// New QA50 narrow regression against the ACTUAL dev-derived Edge handler.
// No previous suites, real auth tokens, family records, or external requests.
import assert from 'node:assert/strict';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
const URL='https://example.invalid/functions/v1/qa47-auth-status';
const allowed='http://127.0.0.1:4173', github='https://jinbh99-arch.github.io';
const svc={getUser:async()=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',is_anonymous:false}),
 findVerifiedFamilies:async()=>[]};
const token='eyJhbGciOiJIUzI1NiJ9.'+'a'.repeat(90)+'.'+'b'.repeat(70);
let checks=0;function pass(name){checks++;console.log('PASS WRONG QA50 '+name)}
const request=(method,origin,headers={})=>new Request(URL,{method,headers:{origin,...headers}});
for(const origin of [allowed,github]){
 const pre=await handle(request('OPTIONS',origin,{
 'access-control-request-method':'GET',
 'access-control-request-headers':'authorization, x-client-info, apikey, content-type'
 }),svc);
 assert.equal(pre.status,204);
 assert.equal(pre.headers.get('access-control-allow-origin'),origin);
 assert.equal(pre.headers.get('access-control-allow-methods'),'GET, OPTIONS');
 const hdr=(pre.headers.get('access-control-allow-headers')||'').split(',').map(s=>s.trim());
 assert.deepEqual(hdr,['authorization','x-client-info','apikey','content-type']);
 pass('SDK preflight exact allowed origin '+origin);
}
const rejected=await handle(request('OPTIONS','https://attacker.example',{'access-control-request-headers':'x-client-info'}),svc);
assert.equal(rejected.status,403);
assert.equal(rejected.headers.get('access-control-allow-origin'),null);
pass('unknown Origin still blocked with no CORS');
const unauth=await handle(request('GET',allowed,{'x-client-info':'supabase-js/2.0'}),svc);
assert.equal(unauth.status,401);
assert.deepEqual(await unauth.json(),{error:'AUTH_REQUIRED'});
pass('SDK header does not bypass missing JWT');
const post=await handle(request('POST',allowed,{authorization:'Bearer '+token}),svc);
assert.equal(post.status,405);
pass('CORS fix cannot enable write method');
const get=await handle(request('GET',allowed,{authorization:'Bearer '+token,'x-client-info':'supabase-js/2.0'}),svc);
assert.equal(get.status,200);
const result=await get.json();
assert.equal(result.studentRecordsEnabled,false);
assert.equal(result.uploadsEnabled,false);
assert.equal(result.syncWritesEnabled,false);
assert.equal(result.productionApproved,false);
assert.equal(get.headers.get('cache-control'),'no-store, max-age=0');
assert.equal(get.headers.get('access-control-allow-headers'),'authorization, x-client-info, apikey, content-type');
pass('authenticated read-only response unchanged; zero student data');
const empty=await handle(request('GET',allowed,{authorization:'Bearer '+token}),{});
assert.equal(empty.status,503);
pass('unconfigured backend fails closed');
console.log('WRONG_QA50_RESULT='+JSON.stringify({status:'PASS',checks,realAuth:false,
 realChildren:0,networkWrites:0,liveDeployment:false,safeToRestore:false}));
