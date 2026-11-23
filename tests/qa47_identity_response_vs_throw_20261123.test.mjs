// QA47: distinguish verified invalid identity response from an unclassified verifier throw.
// This is a dev-handler contract, not a Supabase SDK error provenance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleQa47AuthenticatedGuardianStatus as handle} from '../supabase/functions/qa47-auth-status/handler.js';
const origin='http://127.0.0.1:4173';
const req=()=>new Request(origin+'/qa47-auth-status',{headers:{origin,authorization:'Bearer '+ 'a'.repeat(60)}});
const uid='123e4567-e89b-42d3-a456-426614174000';
const service=(getUser)=>({getUser,findVerifiedFamilies:async()=>[]});
test('verified getUser null identity is 401',async()=>{
 const r=await handle(req(),service(async()=>null));
 assert.equal(r.status,401);
 assert.deepEqual(await r.json(),{error:'AUTH_REQUIRED'});
});
test('verified getUser anonymous identity is 401',async()=>{
 const r=await handle(req(),service(async()=>({id:uid,is_anonymous:true})));
 assert.equal(r.status,401);
});
test('unclassified thrown verifier error stays 503, even with denial-looking message',async()=>{
 const r=await handle(req(),service(async()=>{throw new Error('AUTH_CHECK_FAILED')}));
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{error:'GUARDIAN_STATUS_UNAVAILABLE'});
});
