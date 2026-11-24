// Static QA guard only. This does not replace PostgreSQL concurrency, JWT,
// RLS, Storage, signed-URL, or deployed Edge verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../db/qa51_logout_session_revocation.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/qa51-session-revoke/index.ts',import.meta.url),'utf8');

test('private-path gate is volatile and takes a fail-closed shared user lock',()=>{
 assert.match(sql,/session_allowed\(\)[\s\S]*LANGUAGE plpgsql VOLATILE SECURITY DEFINER/);
 assert.match(sql,/pg_try_advisory_xact_lock_shared\s*\(/);
 assert.match(sql,/THEN RETURN false; END IF;/);
});

test('revocation takes the matching exclusive transaction lock before receipt lookup',()=>{
 const exclusive=sql.indexOf('pg_advisory_xact_lock(');
 const receipt=sql.indexOf('SELECT o.global_scope INTO previous_scope');
 assert.ok(exclusive>0&&receipt>exclusive);
 assert.match(sql,/hashtextextended\(u::text,0\)/);
});

test('Edge body limit is enforced while streaming and req.text is absent',()=>{
 assert.match(edge,/async function readLimited\(req:Request,max:number\)/);
 assert.match(edge,/size>max/);
 assert.match(edge,/reader\.cancel\(\)/);
 assert.match(edge,/readLimited\(req,1024\)/);
 assert.doesNotMatch(edge,/req\.text\(\)/);
});

test('revocation responses remain no-store and do not expose provider errors',()=>{
 assert.match(edge,/'cache-control':'no-store'/);
 assert.match(edge,/return reply\(503,\{error:'REVOCATION_UNAVAILABLE'\}\)/);
 assert.doesNotMatch(edge,/response\.error\.(message|details|hint)/);
});
