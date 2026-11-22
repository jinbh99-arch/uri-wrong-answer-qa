// Isolated dev-baseline negative probe. No real credentials, network, DB or student data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
const origin='http://127.0.0.1:4173';
const token='a'.repeat(60);
const uid='123e4567-e89b-42d3-a456-426614174000';
const request=()=>new Request('http://127.0.0.1:4173/qa47-auth-status',{headers:{origin,authorization:'Bearer '+token}});
const service=(error)=>({getUser:async()=>{if(error)throw error;return {id:uid,is_anonymous:false}},findVerifiedFamilies:async()=>[]});
test('identity verifier rejection must be 401, never 503',async()=>{
 const r=await handle(request(),service(new Error('AUTH_CHECK_FAILED')));
 assert.equal(r.status,401);assert.equal((await r.json()).error,'AUTH_REQUIRED');
});
test('backend failure remains 503 without leaking error',async()=>{
 const r=await handle(request(),service(new Error('synthetic provider fault')));
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'GUARDIAN_STATUS_UNAVAILABLE'});
});
test('successful verified synthetic user remains read-only',async()=>{
 const r=await handle(request(),service());const b=await r.json();
 assert.equal(r.status,200);assert.equal(b.studentRecordsEnabled,false);assert.equal(b.syncWritesEnabled,false);
});
test('CORS preflight retains x-client-info on dev baseline',async()=>{
 const r=await handle(new Request('http://127.0.0.1:4173/qa47-auth-status',{method:'OPTIONS',headers:{origin}}),service());
 assert.equal(r.status,204);assert.match(r.headers.get('access-control-allow-headers')||'',/x-client-info/);
});
