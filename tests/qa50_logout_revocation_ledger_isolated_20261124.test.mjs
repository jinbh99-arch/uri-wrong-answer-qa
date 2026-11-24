// 02 WRONG / 00Q-02-AUTH / A-ISOLATED SYNTHETIC TEST ONLY.
// This is not an actual Supabase JWT/session/RPC/RLS/Storage security test.
import test from 'node:test';
import assert from 'node:assert/strict';

const PATHS=['family_rpc','membership_select','snapshot_select',
 'child_select','photo_api','ack_api'];
const A='synthetic-guardian-A', B='synthetic-other-B';
function store(){return {authRows:new Map(),registered:new Map(),
 revoked:new Set(),epoch:new Map(),online:true,provider:true};}
function token(subject,id,other={}){return {subject,id,signed:true,unexpired:true,...other};}
function guardian(subject=A,other={}){return {subject,verified:true,consent:true,
 role:'guardian',revoked:false,...other};}
function register(s,who,id){
 s.authRows.set(id,{subject:who}); // Deliberately retained after logout.
 s.registered.set(id,{subject:who,epoch:s.epoch.get(who)||0});
 return token(who,id);
}
function membership(t,g){return Boolean(t.signed&&t.unexpired&&g&&
 g.subject===t.subject&&g.verified&&g.consent&&!g.revoked&&g.role==='guardian');}
function oldModel(s,t,g){return membership(t,g);}
function rowOnlyModel(s,t,g){return membership(t,g)&&s.authRows.get(t.id)?.subject===t.subject;}
function gate(s,t,g){
 // Every server-side dependency failure must deny. Never grant auth.sessions
 // SELECT directly to authenticated to implement this contract.
 if(!s.online||!s.provider||!membership(t,g))return false;
 const row=s.authRows.get(t.id),reg=s.registered.get(t.id);
 return Boolean(row&&reg&&row.subject===t.subject&&reg.subject===t.subject&&
 !s.revoked.has(t.id)&&reg.epoch===(s.epoch.get(t.subject)||0));
}
function c(s,p,t,g){return PATHS.includes(p)&&gate(s,t,g);}
function d(s,p,t,g){return p==='edge_authorized'&&gate(s,t,g);}
function logout(s,t){
 if(!s.online||!s.registered.has(t.id))return {ack:false};
 s.revoked.add(t.id);return {ack:true};
}
function globalLogout(s,t){
 if(!s.online||!s.registered.has(t.id))return {ack:false};
 s.epoch.set(t.subject,(s.epoch.get(t.subject)||0)+1);
 return {ack:true};
}

test('RED: legacy membership authorization still permits old JWT',()=>{
 const s=store(),t=register(s,A,'old');logout(s,t);
 assert.equal(oldModel(s,t,guardian()),true);
});
test('RED: relying solely on a retained auth.sessions row is insufficient',()=>{
 const s=store(),t=register(s,A,'old');logout(s,t);
 assert.equal(s.authRows.has('old'),true);
 assert.equal(rowOnlyModel(s,t,guardian()),true);
});
test('C+ covers six direct paths on an active verified session',()=>{
 const s=store(),t=register(s,A,'old');
 for(const p of PATHS)assert.equal(c(s,p,t,guardian()),true,p);
});
test('C+ denies all direct paths after logout while auth row remains',()=>{
 const s=store(),t=register(s,A,'old');assert.equal(logout(s,t).ack,true);
 assert.equal(s.authRows.has('old'),true);
 for(const p of PATHS)assert.equal(c(s,p,t,guardian()),false,p);
});
test('D+ denies all direct paths even before logout',()=>{
 const s=store(),t=register(s,A,'old');
 for(const p of PATHS)assert.equal(d(s,p,t,guardian()),false,p);
 assert.equal(d(s,'edge_authorized',t,guardian()),true);
});
test('D+ edge rejects revoked session despite persistent auth row',()=>{
 const s=store(),t=register(s,A,'old');logout(s,t);
 assert.equal(d(s,'edge_authorized',t,guardian()),false);
});
test('local logout does not invalidate separate active session',()=>{
 const s=store(),one=register(s,A,'one'),two=register(s,A,'two');
 logout(s,one);
 assert.equal(gate(s,one,guardian()),false);
 assert.equal(gate(s,two,guardian()),true);
});
test('global logout invalidates both old sessions despite retained rows',()=>{
 const s=store(),one=register(s,A,'one'),two=register(s,A,'two');
 assert.equal(globalLogout(s,one).ack,true);
 assert.equal(s.authRows.size,2);
 assert.equal(gate(s,one,guardian()),false);
 assert.equal(gate(s,two,guardian()),false);
});
test('fresh session after global logout is allowed but old is not',()=>{
 const s=store(),old=register(s,A,'old');
 globalLogout(s,old);const fresh=register(s,A,'fresh');
 assert.equal(gate(s,fresh,guardian()),true);
 assert.equal(gate(s,old,guardian()),false);
});
test('revocation-store or provider unavailability denies without false ACK',()=>{
 const s=store(),t=register(s,A,'old');s.online=false;
 assert.equal(logout(s,t).ack,false);
 assert.equal(gate(s,t,guardian()),false);
 s.online=true;s.provider=false;
 assert.equal(gate(s,t,guardian()),false);
});
test('failed revocation cannot be represented as instant logout',()=>{
 const s=store(),t=register(s,A,'old');s.online=false;
 assert.equal(logout(s,t).ack,false);
 s.online=true;assert.equal(gate(s,t,guardian()),true);
});
test('repeated successful logout is idempotent',()=>{
 const s=store(),t=register(s,A,'old');
 assert.equal(logout(s,t).ack,true);
 assert.equal(logout(s,t).ack,true);
 assert.equal(s.revoked.size,1);
 assert.equal(gate(s,t,guardian()),false);
});
test('wrong subject, session, forged JWT or expiry deny',()=>{
 const s=store(),t=register(s,A,'old');
 for(const invalid of [token(B,'old'),token(A,'unknown'),
 token(A,'old',{signed:false}),token(A,'old',{unexpired:false})])
  assert.equal(gate(s,invalid,guardian(invalid.subject)),false);
});
test('missing guardian consent or revoked verification denies',()=>{
 const s=store(),t=register(s,A,'old');
 for(const g of [guardian(A,{consent:false}),guardian(A,{revoked:true}),
 guardian(A,{verified:false}),guardian(B)])
  assert.equal(gate(s,t,g),false);
});
test('unlisted path and pre-issued photo URL are not authorized by contract',()=>{
 const s=store(),t=register(s,A,'old');
 assert.equal(c(s,'private_unknown',t,guardian()),false);
 assert.equal(d(s,'photo_signed_url_issued_before_logout',t,guardian()),false);
 // Important: a real pre-issued signed URL may remain independently usable;
 // this test is NOT a real Storage URL-revocation guarantee.
});
