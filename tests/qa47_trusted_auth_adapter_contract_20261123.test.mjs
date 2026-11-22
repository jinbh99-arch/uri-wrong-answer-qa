// A-isolated adapter contract fixture only; NOT wired to production auth.
// A plain Error message is never proof of identity rejection.
import test from 'node:test';
import assert from 'node:assert/strict';

const AUTH_DENIED_CODES = new Set(['INVALID_TOKEN', 'EXPIRED_TOKEN', 'REVOKED_TOKEN']);
function classifyAdapterOutcome(outcome) {
  if (outcome?.kind === 'verified_auth_denial' && outcome?.source === 'trusted_auth_adapter' && AUTH_DENIED_CODES.has(outcome.code)) {
    return {status: 401, error: 'AUTH_REQUIRED'};
  }
  return {status: 503, error: 'GUARDIAN_STATUS_UNAVAILABLE'};
}

test('explicit trusted adapter denial is 401', () => {
  assert.deepEqual(classifyAdapterOutcome({kind:'verified_auth_denial',source:'trusted_auth_adapter',code:'INVALID_TOKEN'}),{status:401,error:'AUTH_REQUIRED'});
});
test('trusted adapter expiration/revocation are explicit denials', () => {
  for (const code of ['EXPIRED_TOKEN','REVOKED_TOKEN']) assert.equal(classifyAdapterOutcome({kind:'verified_auth_denial',source:'trusted_auth_adapter',code}).status,401);
});
test('untrusted plain Error message never becomes 401', () => {
  assert.equal(classifyAdapterOutcome(new Error('AUTH_CHECK_FAILED')).status,503);
  assert.equal(classifyAdapterOutcome({message:'INVALID_TOKEN',code:'INVALID_TOKEN'}).status,503);
});
test('provider outage, unknown code, and spoofed source remain 503', () => {
  for(const value of [{kind:'provider_failure',code:'TIMEOUT'}, {kind:'verified_auth_denial',source:'trusted_auth_adapter',code:'TIMEOUT'}, {kind:'verified_auth_denial',source:'unknown',code:'INVALID_TOKEN'}, null]) assert.deepEqual(classifyAdapterOutcome(value),{status:503,error:'GUARDIAN_STATUS_UNAVAILABLE'});
});
