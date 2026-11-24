// 00Q-02-AUTH: isolated synthetic contract; not Supabase implementation.
// Provider proof is a trusted fixture, never a client-supplied assertion.
// Map state models atomic transactions only; actual persistence/concurrency N/T.
import test from 'node:test';
import assert from 'node:assert/strict';

function model() {
  const sessions = new Map(), epochs = new Map(), operations = new Map();
  const epoch = subject => epochs.get(subject) ?? 0;
  let readable = true;
  function register(proof) {
    if (!readable || !proof.verified || proof.generation !== epoch(proof.subject)) return false;
    const prior = sessions.get(proof.id);
    if (prior) return !prior.revoked && prior.subject === proof.subject &&
      prior.generation === proof.generation;
    sessions.set(proof.id, {subject: proof.subject, generation: proof.generation, revoked: false});
    return true;
  }
  function allow(token) {
    if (!readable || !token.verified || !token.unexpired) return false;
    const row = sessions.get(token.id);
    return !!row && !row.revoked && row.subject === token.subject &&
      row.generation === token.generation && row.generation === epoch(row.subject);
  }
  function logout(token, key, global = false, loseAck = false) {
    if (!readable || !token.verified || !token.unexpired || !key) return {ack:false};
    const scope = JSON.stringify([token.subject, token.id, token.generation, global, key]);
    if (operations.has(scope)) return {ack:true, committed:true};
    if (!allow(token)) return {ack:false};
    if (global) epochs.set(token.subject, epoch(token.subject) + 1);
    else sessions.get(token.id).revoked = true;
    operations.set(scope, true);
    return {ack:!loseAck, committed:true};
  }
  return {register, allow, logout, epoch, unavailable: () => {readable = false;}};
}
const token = (id, generation = 0, subject = 'A') =>
  ({id, generation, subject, verified:true, unexpired:true});

test('global logout permanently denies re-registration of old session id', () => {
  const m = model(), old = token('old');
  assert.equal(m.register(old), true);
  assert.equal(m.logout(old, 'op1', true).ack, true);
  assert.equal(m.register(old), false);
  assert.equal(m.register(token('old', 1)), false);
  assert.equal(m.allow(old), false);
  const fresh = token('fresh', 1);
  assert.equal(m.register(fresh), true);
  assert.equal(m.allow(fresh), true);
});
test('global logout lost ACK retry does not revoke subsequent fresh session', () => {
  const m = model(), old = token('old');
  m.register(old);
  assert.deepEqual(m.logout(old, 'op1', true, true), {ack:false, committed:true});
  const fresh = token('fresh', 1);
  assert.equal(m.register(fresh), true);
  assert.deepEqual(m.logout(old, 'op1', true), {ack:true, committed:true});
  assert.equal(m.epoch('A'), 1);
  assert.equal(m.allow(fresh), true);
  assert.equal(m.logout(old, 'op2', true).ack, false);
});
test('device logout denies reuse while preserving sibling session', () => {
  const m = model(), a = token('a'), b = token('b');
  m.register(a); m.register(b);
  m.logout(a, 'device');
  assert.equal(m.register(a), false);
  assert.equal(m.allow(a), false);
  assert.equal(m.allow(b), true);
});
test('stale provider proof cannot register new id after global logout', () => {
  const m = model(), old = token('old');
  m.register(old); m.logout(old, 'op', true);
  assert.equal(m.register(token('delayed', 0)), false);
});
test('cross-subject registration and unavailable ledger fail closed', () => {
  const m = model(), a = token('a');
  m.register(a);
  assert.equal(m.register(token('a', 0, 'B')), false);
  assert.equal(m.allow(token('a', 0, 'B')), false);
  m.unavailable();
  assert.equal(m.allow(a), false);
  assert.equal(m.register(token('fresh')), false);
  assert.equal(m.logout(a, 'op').ack, false);
});
