// Static regression guards, not a PostgreSQL or browser execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rollback=read('db/qa51_logout_session_revocation_rollback.sql');
const sql=read('db/qa51_logout_session_revocation.sql');
const ui=read('scripts/qa48-google-oauth-test.mjs');
test('rollback keeps existing revocation ledger and policies intact',()=>{
 assert.doesNotMatch(rollback,/DROP (TABLE|POLICY|FUNCTION|SCHEMA)|TRUNCATE|DELETE FROM/i);
 assert.doesNotMatch(rollback,/GRANT EXECUTE/i);
});
test('rollback denies all family and photo paths for client and writer',()=>{
 for(const name of ['membership','snapshot','family','photo'])
  assert.ok(rollback.includes('qa51_emergency_'+name+'_deny'));
 assert.match(rollback,/TO authenticated,qa44_sync_writer USING \(false\) WITH CHECK \(false\)/);
 assert.match(rollback,/WITH CHECK \(bucket_id <> 'qa44-family-photos'\)/);
 for(const name of ['public.qa47_my_verified_family_ids','public.qa51_revoke_session','qa44.revoke_current_session'])
  assert.ok(rollback.includes('REVOKE EXECUTE ON FUNCTION '+name));
});
test('SQL function dollar delimiters pair',()=>{
 assert.doesNotMatch(sql,/AS \$\s*\n/);
 assert.equal((sql.match(/\$\$/g)||[]).length,8);
});
test('pending reload blocks login and verification before auto verification',()=>{
 assert.ok(ui.includes('revocationPending=sessionStorage.getItem(revokeOperationKey)!==null'));
 assert.ok(ui.includes("if(revocationPending||storageUnavailable)throw Error('REVOCATION_NOT_CONFIRMED')"));
 assert.ok(ui.includes('else if(revocationPending)say'));
 assert.ok(ui.includes('else if(callbackHasParams||hasStoredSession)safely(verify)'));
 assert.ok(ui.includes('login.disabled=!allowed||busy||active||revocationPending||storageUnavailable'));
});
