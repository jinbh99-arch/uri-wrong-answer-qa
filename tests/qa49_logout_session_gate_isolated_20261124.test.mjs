// 02 WRONG / 00Q-02-AUTH / ISOLATED-SYNTHETIC ONLY.
// This is NOT a Supabase integration test, not a JWT verifier, and not a product security proof.
// Inputs and results are fabricated. The real RPC/RLS were read only (no changes).
import test from 'node:test';
import assert from 'node:assert/strict';

const PATHS = ['family_rpc', 'guardian_memberships_select', 'family_snapshots_select',
  'child_records_select', 'photo_access', 'ack_write'];
const GUARDIAN = Object.freeze({
  userId:'synthetic-guardian-A', familyId:'synthetic-family-A', role:'guardian',
  verificationSource:'externally_verified', verified:true, consent:true, revoked:false
});
const makeJwt = (sessionId='synthetic-session-OLD', extra={}) => ({
  subject:GUARDIAN.userId, sessionId, signatureValid:true, beforeExpiry:true, ...extra
});
const makeSession = (sessionId='synthetic-session-OLD', extra={}) => ({
  sessionId, userId:GUARDIAN.userId, active:true, ...extra
});
function ownsFamily(jwt, membership=GUARDIAN) {
  return Boolean(jwt?.signatureValid && jwt?.beforeExpiry &&
    jwt.subject===membership.userId && membership.role==='guardian' &&
    membership.verificationSource==='externally_verified' && membership.verified &&
    membership.consent && !membership.revoked);
}
// Mirrors ONLY the critical missing-session-check property in current RPC/RLS;
// it is not a byte-for-byte implementation of PostgreSQL RLS.
function existingPermissionModel(jwt, membership=GUARDIAN) {
  return ownsFamily(jwt,membership);
}
// Option C: a hypothetical server-owned verifier is applied to EACH direct path.
// It must fail closed when session status cannot be read.
function cSessionGate(jwt, sessions, membership=GUARDIAN) {
  if(!ownsFamily(jwt,membership) || !jwt?.sessionId || !(sessions instanceof Map))return false;
  const s=sessions.get(jwt.sessionId);
  return Boolean(s && s.active && s.userId===jwt.subject && s.sessionId===jwt.sessionId);
}
function cAuthorizePath(path,jwt,sessions,membership=GUARDIAN) {
  if(!PATHS.includes(path))return false;
  return cSessionGate(jwt,sessions,membership);
}
// Option D: all direct access is DENIED. Only a separately verified server edge
// would be authorized; a bare getUser() call alone is NOT a session revocation gate.
function dAuthorizePath(path,jwt,sessions,membership=GUARDIAN) {
  if(path!=='edge_authorized')return false;
  return cSessionGate(jwt,sessions,membership);
}

const oldJwt=makeJwt();

test('RED / as-is membership-only model exposes family after synthetic logout',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  assert.equal(existingPermissionModel(oldJwt),true);
  sessions.delete(oldJwt.sessionId); // Synthetic signOut, not an actual provider API.
  assert.equal(sessions.size,0);
  assert.equal(existingPermissionModel(oldJwt),true); // RED: old JWT still satisfies current rule.
});

test('GREEN C / before logout: active verified guardian may access each covered path',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  for(const p of PATHS)assert.equal(cAuthorizePath(p,oldJwt,sessions),true,p);
});

test('GREEN C / after synthetic session removal: old JWT denied on all covered paths',()=>{
  const sessions=new Map();
  for(const p of PATHS)assert.equal(cAuthorizePath(p,oldJwt,sessions),false,p);
});

test('GREEN C / new login does not reactivate old JWT',()=>{
  const fresh=makeJwt('synthetic-session-NEW');
  const sessions=new Map([[fresh.sessionId,makeSession(fresh.sessionId)]]);
  assert.equal(cSessionGate(fresh,sessions),true);
  assert.equal(cSessionGate(oldJwt,sessions),false);
});

test('GREEN C / unknown provider session state fails closed',()=>{
  assert.equal(cSessionGate(oldJwt,null),false);
  assert.equal(cSessionGate(makeJwt(null),new Map()),false);
});

test('GREEN C / substituted or foreign session is denied',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession(oldJwt.sessionId,{userId:'synthetic-other'})]]);
  assert.equal(cSessionGate(oldJwt,sessions),false);
  assert.equal(cSessionGate(makeJwt('unknown'),sessions),false);
});

test('GREEN C / invalid/expired JWT denied regardless of session row',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  assert.equal(cSessionGate(makeJwt(oldJwt.sessionId,{signatureValid:false}),sessions),false);
  assert.equal(cSessionGate(makeJwt(oldJwt.sessionId,{beforeExpiry:false}),sessions),false);
});

test('GREEN C / non-guardian identity or missing consent denied',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  assert.equal(cSessionGate(makeJwt(oldJwt.sessionId,{subject:'synthetic-other'}),sessions),false);
  assert.equal(cSessionGate(oldJwt,sessions,{...GUARDIAN,consent:false}),false);
  assert.equal(cSessionGate(oldJwt,sessions,{...GUARDIAN,revoked:true}),false);
});

test('GREEN D / no client direct RPC, table, child, photo, or ACK route',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  for(const p of PATHS)assert.equal(dAuthorizePath(p,oldJwt,sessions),false,p);
  assert.equal(dAuthorizePath('edge_authorized',oldJwt,sessions),true);
});

test('GREEN D / old JWT edge request blocked after synthetic session removal',()=>{
  assert.equal(dAuthorizePath('edge_authorized',oldJwt,new Map()),false);
});

test('C/D LIMIT / session row retained after signOut leaves old JWT usable',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  // DELIBERATELY retain the old row. This exposes a required REAL provider test.
  assert.equal(cSessionGate(oldJwt,sessions),true);
  assert.equal(dAuthorizePath('edge_authorized',oldJwt,sessions),true);
});

test('C/D LIMIT / unknown direct path never gets blanket authorization',()=>{
  const sessions=new Map([[oldJwt.sessionId,makeSession()]]);
  assert.equal(cAuthorizePath('unlisted_admin_endpoint',oldJwt,sessions),false);
  assert.equal(dAuthorizePath('unlisted_admin_endpoint',oldJwt,sessions),false);
});
