// P0 stage 3 NEW: two unrelated synthetic families independently use the
// SAME recordId (and same parent display profile) with DIFFERENT photos/notes.
// Their HTTP revisions and encrypted snapshots must remain disjoint.
// This is NOT QA35 cross-family token or QA34 ACK loss; no reruns of either.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const dir='qa-proof/wrong-p0-34-collision-epoch';
const {mkdirSync,writeFileSync}=await import('node:fs');mkdirSync(dir,{recursive:true});
const PASS='QA-P0-STAGE3-COLLISION-2026-ONLY';
const id='p0-shared-uuid-across-families';
const profile={nickname:'이름도 같은 합성 학부모',grade:3};
const PHOTO_A='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const PHOTO_B='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const doc=(prefix,photo)=>signSynthetic({format:'uriaimath-offline-backup-v02',profile,records:[
 {id,problemText:prefix+' 문제',hasPhoto:true,practiceHistory:[],
  generalRetryHistory:[{answer:prefix+' 답',explanation:prefix+' 풀이',review:'needs_help',parentNote:prefix+' 보호자 관찰'}]}
 ],photos:{[id]:photo},backupSummary:{recordCount:1,photoCount:1}});
const A=doc('가상 A',PHOTO_A),B=doc('가상 B',PHOTO_B);
const snapshotHash=d=>createHash('sha256').update(JSON.stringify(d)).digest('hex');
let gate,checks=[],counters={aPut:0,bPut:0,staleRejected:0};
const record=s=>{checks.push(s);console.log('PASS P0 STAGE3',s)};
async function call(path,method='GET',data,token,rev){
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(data!==undefined)headers['content-type']='application/json';
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:res.status,data:await res.json(),etag:res.headers.get('etag')};
}
async function family(name){
 assert.equal((await call('/qa/register','POST',{familyKey:name,password:PASS})).status,201);
 const r=await call('/qa/login','POST',{familyKey:name,password:PASS});
 assert.equal(r.status,200);
 return r.data.token;
}
function saveResult(status,extra={}){
 const proof={status,stage:3,case:'same-record-id-two-family-identical-profile-different-photo-parent-note',
  checks,counters,sharedRecordId:id,photoAsha:createHash('sha256').update(PHOTO_A).digest('hex'),
  photoBsha:createHash('sha256').update(PHOTO_B).digest('hex'),
  familyAhash:snapshotHash(A),familyBhash:snapshotHash(B),qaOnly:true,
  realFamilyAuthentication:false,productIntegrated:false,safeToRestore:false,
  existingQa35Rerun:false,existingQa34Rerun:false,...extra};
 writeFileSync(dir+'/stage3.json',JSON.stringify(proof,null,2)+'\n');
 console.log('WRONG_P0_STAGE3_RESULT='+JSON.stringify(proof));
}
let temp;
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 process.env.QA_DURABLE_TEST_ONLY='1';
 temp=mkdtempSync(join(tmpdir(),'wrong-stage3-sameid-'));
 const file=join(temp,'qa-encrypted-ledger.json');
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:randomBytes(32).toString('hex')});
 const a=await family('qa-stage3-collision-a'),b=await family('qa-stage3-collision-b');
 const put=await Promise.all([
   call('/qa/snapshot','PUT',A,a,0),call('/qa/snapshot','PUT',B,b,0)
 ]);
 assert.deepEqual(put.map(x=>x.status),[200,200]);
 assert.deepEqual(put.map(x=>x.data.revision),[1,1]);
 counters.aPut++;counters.bPut++;
 record('same id and same display profile stored once in each synthetic family HTTP ledger');
 let aa=await call('/qa/snapshot','GET',undefined,a);
 let bb=await call('/qa/snapshot','GET',undefined,b);
 assert.equal(aa.data.revision,1);assert.equal(bb.data.revision,1);
 assert.deepEqual(aa.data.snapshot,A);assert.deepEqual(bb.data.snapshot,B);
 assert.equal(aa.data.snapshot.records[0].id,bb.data.snapshot.records[0].id);
 assert.notEqual(aa.data.snapshot.records[0].generalRetryHistory[0].parentNote,
   bb.data.snapshot.records[0].generalRetryHistory[0].parentNote);
 assert.notEqual(aa.data.snapshot.photos[id],bb.data.snapshot.photos[id]);
 record('same UUID does not share photo bytes or parent journal between synthetic families');
 const encryptedBefore=readFileSync(file);
 const staleA=await call('/qa/snapshot','PUT',B,a,0);
 const staleB=await call('/qa/snapshot','PUT',A,b,0);
 assert.equal(staleA.status,409);assert.equal(staleB.status,409);
 counters.staleRejected=2;
 assert.deepEqual(readFileSync(file),encryptedBefore);
 record('opposite-family payload with expired expected revision 0 rejected for both families, durable encrypted file exactly unchanged');
 const crossA=await call('/qa/snapshot','PUT',B,a,1);
 const crossB=await call('/qa/snapshot','PUT',A,b,1);
 assert.equal(crossA.status,409);assert.equal(crossB.status,409);
 assert.deepEqual(readFileSync(file),encryptedBefore);
 record('even current revision 1 cannot silently rewrite an existing photo or parent observation');
 aa=await call('/qa/snapshot','GET',undefined,a);
 bb=await call('/qa/snapshot','GET',undefined,b);
 assert.deepEqual(aa.data.snapshot,A);assert.deepEqual(bb.data.snapshot,B);
 assert.equal(aa.data.revision,1);assert.equal(bb.data.revision,1);
 assert.equal(aa.data.snapshot.records.length,1);assert.equal(bb.data.snapshot.records.length,1);
 record('fresh GET independently confirms A/B snapshots, photos, notes and revision remain exact');
 saveResult('PASS_SYNTHETIC_LOCAL_HTTP_STAGE3_NEW_COLLISION',{families:2,eachRecordCount:1,
  photoBytesUnmixed:true,childNotesUnmixed:true,parentNotesUnmixed:true,
  encryptedSnapshotUnchangedAfterReject:true,postRejectARevision:1,postRejectBRevision:1,
  freshGETVerified:true});
}catch(e){saveResult('FAIL',{error:String(e),stack:String(e?.stack).slice(0,1200)});process.exitCode=1;}
finally{if(gate)await gate.shutdown();if(temp)rmSync(temp,{force:true,recursive:true});}
