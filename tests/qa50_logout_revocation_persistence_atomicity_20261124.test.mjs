// 02 WRONG / 00Q-02-AUTH / A-ISOLATED SYNTHETIC TEST ONLY.
// This does not prove actual Supabase Auth/RPC/RLS/Storage enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';

const A='synthetic-guardian-A';
function durable(){return {sessions:new Map(),revoked:new Set(),epoch:new Map()};}
function process(db,{ledgerReadable=true,provider=true}={}){
  return {db,ledgerReadable,provider};
}
function issue(p,id,subject=A){
  const generation=p.db.epoch.get(subject)||0;
  p.db.sessions.set(id,{subject,generation});
  return {id,subject,generation,signed:true,unexpired:true};
}
function allow(p,t){
  if(!p.ledgerReadable||!p.provider||!t.signed||!t.unexpired)return false;
  const row=p.db.sessions.get(t.id);
  return Boolean(row&&row.subject===t.subject&&row.generation===t.generation&&
    !p.db.revoked.has(t.id)&&t.generation===(p.db.epoch.get(t.subject)||0));
}
function deviceLogout(p,t,{failBeforeCommit=false,ackLost=false}={}){
  if(!p.ledgerReadable||!p.db.sessions.has(t.id)||failBeforeCommit)
    return {committed:false,ack:false};
  p.db.revoked.add(t.id);
  return {committed:true,ack:!ackLost};
}
function globalLogout(p,t,{failBeforeCommit=false,ackLost=false}={}){
  if(!p.ledgerReadable||!p.db.sessions.has(t.id)||failBeforeCommit)
    return {committed:false,ack:false};
  p.db.epoch.set(t.subject,(p.db.epoch.get(t.subject)||0)+1);
  return {committed:true,ack:!ackLost};
}

test('device revocation survives a server process restart',()=>{
  const db=durable(),p1=process(db),old=issue(p1,'old');
  assert.deepEqual(deviceLogout(p1,old),{committed:true,ack:true});
  const p2=process(db);
  assert.equal(allow(p2,old),false);
});

test('global generation survives restart and a newly issued session uses the new generation',()=>{
  const db=durable(),p1=process(db),old=issue(p1,'old');
  globalLogout(p1,old);
  const p2=process(db),fresh=issue(p2,'fresh');
  assert.equal(allow(p2,old),false);
  assert.equal(allow(p2,fresh),true);
  assert.equal(fresh.generation,1);
});

test('failure before device-revocation commit never returns a success ACK',()=>{
  const p=process(durable()),old=issue(p,'old');
  assert.deepEqual(deviceLogout(p,old,{failBeforeCommit:true}),
    {committed:false,ack:false});
  assert.equal(allow(p,old),true);
});

test('lost ACK after commit remains denied and retry is idempotent',()=>{
  const p=process(durable()),old=issue(p,'old');
  assert.deepEqual(deviceLogout(p,old,{ackLost:true}),
    {committed:true,ack:false});
  assert.equal(allow(p,old),false);
  assert.deepEqual(deviceLogout(p,old),{committed:true,ack:true});
  assert.equal(p.db.revoked.size,1);
});

test('lost global-logout ACK does not permit an unsafe blind retry increment',()=>{
  const p=process(durable()),old=issue(p,'old');
  assert.deepEqual(globalLogout(p,old,{ackLost:true}),
    {committed:true,ack:false});
  assert.equal(allow(p,old),false);
  // The production contract needs an idempotency key/CAS. A blind second
  // increment would change ordering and is deliberately not claimed safe here.
  assert.equal(p.db.epoch.get(A),1);
});

test('provider or ledger read failure denies after restart',()=>{
  const db=durable(),p1=process(db),active=issue(p1,'active');
  assert.equal(allow(process(db,{ledgerReadable:false}),active),false);
  assert.equal(allow(process(db,{provider:false}),active),false);
});

test('forged subject and stale generation cannot register an allowed session',()=>{
  const db=durable(),p=process(db),old=issue(p,'old');
  globalLogout(p,old);
  const forged={...old,id:'forged',subject:'synthetic-other-B'};
  db.sessions.set('forged',{subject:A,generation:0});
  assert.equal(allow(p,forged),false);
  assert.equal(allow(p,old),false);
});
