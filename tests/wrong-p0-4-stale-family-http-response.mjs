// P0 stage 4 NEW: delayed *authorized* response from family A must not
// enter B's active client after family switch even when same recordId is used.
// Real synthetic localhost HTTP, not a real guardian/provider credential test.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {createQaFamilyEpochGate} from '../scripts/qa-p0-family-response-epoch-guard.mjs';
const dir='qa-proof/wrong-p0-34-collision-epoch';mkdirSync(dir,{recursive:true});
const PASS='QA-P0-STAGE4-EPOCH-SWITCH-2026-ONLY',ID='qa-same-id-distinct-family';
function doc(x){return signSynthetic({format:'uriaimath-offline-backup-v02',
 profile:{nickname:'same-name',grade:3},records:[{id:ID,problemText:x+' 원본',
 hasPhoto:false,practiceHistory:[],generalRetryHistory:[{answer:x,explanation:x+' 해설',
 review:'needs_help',parentNote:x+' 보호자 비공개'}]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}})}
const A=doc('family-A'),B=doc('family-B');
let server,checks=[],counts={put:0,get:0,delayedADropped:0};
const pass=s=>{checks.push(s);console.log('PASS P0 STAGE4',s)};
async function call(path,method='GET',body,token,revision){
 const headers={'cache-control':'no-store'};if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 if(path==='/qa/snapshot'){if(method==='PUT')counts.put++;if(method==='GET')counts.get++;}
 const r=await fetch(server.baseUrl+path,{method,headers,
 body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),etag:r.headers.get('etag')};
}
async function family(name){
 assert.equal((await call('/qa/register','POST',{familyKey:name,password:PASS})).status,201);
 const z=await call('/qa/login','POST',{familyKey:name,password:PASS});
 assert.equal(z.status,200);return z.data.token;
}
function result(status,extra={}){
 const proof={status,stage:4,case:'authorized A GET arrives after B switch',
 checks,counters:counts,recordId:ID,clientRejectsOldFamily:true,serverGatewaysRealHttp:true,
 qaSyntheticOnly:true,actualGuardianAuth:false,actualChildServerProjection:false,
 deployed:false,productIntegrated:false,safeToRestore:false,
 qa34StaleResponseRerun:false,qa35CrossTokenRerun:false,...extra};
 writeFileSync(dir+'/stage4.json',JSON.stringify(proof,null,2)+'\n');
 console.log('WRONG_P0_STAGE4_RESULT='+JSON.stringify(proof));
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 server=await createIsolatedQaFamilyGateway();
 const a=await family('qa-stage4-epoch-a'),b=await family('qa-stage4-epoch-b');
 assert.equal((await call('/qa/snapshot','PUT',A,a,0)).status,200);
 assert.equal((await call('/qa/snapshot','PUT',B,b,0)).status,200);
 const g=createQaFamilyEpochGate('qa-stage4-epoch-a');
 const ticketA=g.begin();
 // Hold an already-authorized A HTTP response in the client while switching.
 const aResponse=await call('/qa/snapshot','GET',undefined,a);
 assert.equal(aResponse.status,200);assert.deepEqual(aResponse.data.snapshot,A);
 pass('HTTP server A GET completed with synthetic A token while client kept its response pending');
 g.switchTo('qa-stage4-epoch-b');
 const stale=g.accept(ticketA,aResponse);
 assert.equal(stale.status,'STALE_FAMILY_RESPONSE_DROPPED');
 assert.equal(stale.data,null);counts.delayedADropped++;
 pass('after A-to-B switch, exact authorized stale A HTTP data is not returned to current family client');
 const ticketB=g.begin(),bResponse=await call('/qa/snapshot','GET',undefined,b);
 const fresh=g.accept(ticketB,bResponse);
 assert.equal(fresh.status,'ACCEPTED_FOR_CURRENT_FAMILY');
 assert.deepEqual(fresh.data.snapshot,B);
 assert.equal(fresh.data.snapshot.records[0].generalRetryHistory[0].parentNote,'family-B 보호자 비공개');
 assert.notDeepEqual(fresh.data.snapshot,A);
 pass('same recordId, only live B GET may enter current B client');
 const badTicket=g.begin();
 g.logout();
 const afterLogout=g.accept(badTicket,bResponse);
 assert.equal(afterLogout.status,'STALE_FAMILY_RESPONSE_DROPPED');assert.equal(afterLogout.data,null);
 pass('logout invalidates even B result from prior client session epoch');
 // Server must still reject a missing/invalid token independently of client epoch.
 const unauth=await call('/qa/snapshot','GET');
 assert.equal(unauth.status,401);
 const invalid=await call('/qa/snapshot','GET',undefined,'not-valid-token');
 assert.equal(invalid.status,401);
 pass('localhost HTTP requires bearer token; client epoch is never treated as server authentication');
 const rA=await call('/qa/snapshot','GET',undefined,a);
 const rB=await call('/qa/snapshot','GET',undefined,b);
 assert.deepEqual(rA.data.snapshot,A);assert.deepEqual(rB.data.snapshot,B);
 assert.equal(rA.data.revision,1);assert.equal(rB.data.revision,1);
 result('PASS_SYNTHETIC_LOCAL_HTTP_STAGE4_NEW_EPOCH',{familyARevision:1,familyBRevision:1,
  staleAuthorizedAResponseDiscarded:true,logoutStaleDiscarded:true,
  freshBAccepted:true,noMixInClient:true,serverLedgerUnchanged:true,metrics:g.metrics()});
}catch(e){result('FAIL',{error:String(e),stack:String(e?.stack).slice(0,1200)});process.exitCode=1}
finally{if(server)await server.shutdown()}
