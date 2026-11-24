// Static rollback guard only; no PostgreSQL migration is executed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const rollback=readFileSync(new URL('../db/qa51_logout_session_revocation_rollback.sql',import.meta.url),'utf8');
const original=readFileSync(new URL('../db/qa47_authenticated_guardian_status_rpc.sql',import.meta.url),'utf8');

const requiredOriginal=[
 'LANGUAGE sql STABLE SECURITY INVOKER',
 "SET search_path = ''",
 'm.guardian_user_id = (SELECT auth.uid())',
 "m.role = 'guardian'",
 "m.verification_source = 'externally_verified'",
 'm.verified_at IS NOT NULL',
 'm.consent_verified_at IS NOT NULL',
 'm.revoked_at IS NULL',
 'GRANT EXECUTE ON FUNCTION public.qa47_my_verified_family_ids() TO authenticated'
];
test('rollback restores every authorization clause from the original QA47 RPC',()=>{
 for(const clause of requiredOriginal){
  assert.ok(original.includes(clause),clause);
  assert.ok(rollback.includes(clause),clause);
 }
});

test('restrictive policies are removed before their session gate',()=>{
 const gate=rollback.indexOf('DROP FUNCTION IF EXISTS qa44.session_allowed()');
 for(const policy of ['qa51_photo_session','qa51_family_session',
  'qa51_snapshot_session','qa51_membership_session'])
  assert.ok(rollback.indexOf('DROP POLICY IF EXISTS '+policy)>0&&
    rollback.indexOf('DROP POLICY IF EXISTS '+policy)<gate,policy);
});

test('public wrapper and ledger functions are dropped before ledger tables',()=>{
 const table=rollback.indexOf('DROP TABLE IF EXISTS qa44.logout_operation');
 for(const fn of ['public.qa51_revoke_session','qa44.revoke_current_session',
  'qa44.session_allowed'])
  assert.ok(rollback.indexOf('DROP FUNCTION IF EXISTS '+fn)>0&&
    rollback.indexOf('DROP FUNCTION IF EXISTS '+fn)<table,fn);
});

test('rollback warns that Edge and cached or signed URLs are separate',()=>{
 assert.match(rollback,/Edge Function must be undeployed\/disabled separately/);
 assert.match(rollback,/cached\/signed URLs/);
 assert.doesNotMatch(rollback,/DROP SCHEMA|DROP TABLE IF EXISTS qa44\.(families|guardian_memberships|family_snapshots)/);
});
