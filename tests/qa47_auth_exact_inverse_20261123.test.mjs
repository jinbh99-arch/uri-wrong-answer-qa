// Exact inverse evidence for isolated 02 QA47 patch. No product write.
// Compare reverse-patched full text with original product dev git blobs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
const root=new URL('../supabase/functions/qa47-auth-status/',import.meta.url);
function once(source,needle,restore){
 assert.equal(source.split(needle).length,2,'inverse not unique or patch absent');
 return source.replace(needle,restore);
}
test('inverse QA index.ts exactly restores dev blob 849057381bcf',()=>{
 let s=readFileSync(new URL('index.ts',root),'utf8');
 s=once(s," // Preflight must not depend on env/SDK state; handler checks exact Origin.\n if(req.method==='OPTIONS')return handleQa47AuthenticatedGuardianStatus(req);\n",'');
 s=once(s,'// A-isolated candidate only; pinned version and error constructor identity.\n','');
 s=once(s,"import {createClient,AuthApiError} from 'npm:@supabase/supabase-js@2.118.0';", "import {createClient} from 'npm:@supabase/supabase-js@2';");
 s=once(s,"import {rejectSdkAuthError} from './auth-verified-denial.js';\n",'');
 s=once(s,'if(response.error)rejectSdkAuthError(response.error,AuthApiError);',"if(response.error)throw new Error('AUTH_CHECK_FAILED');");
 assert.equal(hash(s),'849057381bcfeaeda450e98190a535b0a072037b');
});
test('inverse QA handler.js exactly restores dev blob 9c56c117e723',()=>{
 let s=readFileSync(new URL('handler.js',root),'utf8');
 s=once(s,"import {Qa47VerifiedAuthDenied} from './auth-verified-denial.js';\n",'');
 s=once(s," }catch(err){\n  // No original SDK error, token, identity, family IDs or addresses in response.\n  if(err instanceof Qa47VerifiedAuthDenied)return send(401,{error:'AUTH_REQUIRED'});\n  return send(503,{error:'GUARDIAN_STATUS_UNAVAILABLE'});",
 " }catch{\n  // Never echo provider errors, token, identity, family IDs, or addresses.\n  return send(503,{error:'GUARDIAN_STATUS_UNAVAILABLE'});");
 assert.equal(hash(s),'9c56c117e723617e0273bef92197175eb64c2008');
});
