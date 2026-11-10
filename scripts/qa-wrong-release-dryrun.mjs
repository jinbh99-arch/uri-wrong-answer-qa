// Local GitHub Actions release-stage simulation. No hosting, database writes,
// real account access, or deployment API calls. Synthetic browser evidence ONLY.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {assessWrongRelease,WRONG_MAIN_SHA,WRONG_RC_SHA} from './qa-wrong-rollback-release-gate.mjs';

const FILES=[
 'index.html','check.html','qa-family-sync-lab.html',
 'scripts/qa-inapp-sync-bridge.mjs',
 'scripts/qa42-app-http-bridge.mjs',
 'scripts/qa44-supabase-auth-lab.mjs',
 'scripts/qa44-supabase-auth-adapter.mjs',
 'scripts/qa47-live-auth-lab.mjs',
 'scripts/qa47-public-stage-config.mjs'
];
const sha256=b=>createHash('sha256').update(b).digest('hex');
const fail=(code,reason)=>{
 console.error('WRONG_DRY_RELEASE_GATE='+JSON.stringify({status:'ERROR',code,reason:String(reason||'').slice(0,200),deployed:false}));
 process.exit(4);
};
const target=process.env.WRONG_LAB_TARGET_SHA;
const testcase=process.env.WRONG_LAB_CASE||'normal';
const tmp=process.env.RUNNER_TEMP;
const stage=process.env.WRONG_LAB_STAGE_DIR;
if(process.env.WRONG_RELEASE_LAB_ONLY!=='1'||process.env.GITHUB_ACTIONS!=='true'||!tmp||!stage)
 fail('SYNTHETIC_ACTIONS_ONLY','Requires isolated GitHub Actions lab mode');
if(![WRONG_MAIN_SHA,WRONG_RC_SHA].includes(target)||!['normal','partial','corrupt-photo','failed-restore'].includes(testcase))
 fail('UNEXPECTED_TARGET_OR_CASE');
const stagingPath=resolve(stage),tmpPath=resolve(tmp);
if(!stagingPath.startsWith(tmpPath+sep))fail('STAGE_OUTSIDE_EPHEMERAL_RUNNER');
const input=process.env.WRONG_LAB_EVIDENCE;
if(!input||!resolve(input).endsWith('/wrong-rc-synthetic-release-evidence/input.json'))
 fail('EVIDENCE_PATH_INVALID');
let evidence;
try{evidence=JSON.parse(await readFile(input,'utf8'))}
catch(e){fail('EVIDENCE_UNREADABLE',e.message)}
if(evidence.kind!=='WRONG_SYNTHETIC_BROWSER_RELEASE_EVIDENCE_v1'||
 evidence.syntheticOnly!==true||evidence.productionApproved!==false||
 evidence.realUsers!==0||evidence.origin!=='http://127.0.0.1:4173/'||
 evidence.mainSha!==WRONG_MAIN_SHA||evidence.rcSha!==WRONG_RC_SHA)
 fail('EVIDENCE_NOT_OWN_SYNTHETIC');
const baseline=assessWrongRelease({
 fromSha:WRONG_MAIN_SHA,toSha:WRONG_RC_SHA,...evidence.original
});
if(baseline.verdict!=='CANDIDATE_ONLY')
 fail('BASELINE_MIGRATION_PROOF_FAILED',JSON.stringify(baseline.blockedReasons));
const change=structuredClone(evidence.latest);
if(testcase==='partial')change.backup.photosOmitted=1;
if(testcase==='corrupt-photo'){
 const keys=Object.keys(change.backup.photos);
 if(keys.length===0)fail('NO_SYNTHETIC_PHOTO_TO_TAMPER');
 const value=change.backup.photos[keys[0]],parts=value.split(',');
 const bytes=Buffer.from(parts[1],'base64');bytes[bytes.length-1]^=1;
 change.backup.photos[keys[0]]=parts[0]+','+bytes.toString('base64');
}
if(testcase==='failed-restore'){
 const candidate=change.restored.records.find(r=>Array.isArray(r.checkHistory)&&r.checkHistory.length);
 if(!candidate)fail('NO_SYNTHETIC_OBSERVATION_TO_TAMPER');
 candidate.checkHistory=[];
}
const assessment=assessWrongRelease({
 fromSha:WRONG_RC_SHA,toSha:target,...change
});
if(assessment.verdict==='BLOCK'){
 console.log('WRONG_DRY_RELEASE_GATE='+JSON.stringify({
  status:'BLOCK',target,testcase,reasons:assessment.blockedReasons,
  stageCreated:false,deployed:false,syntheticOnly:true}));
 process.exit(3);
}
if(assessment.verdict!=='CANDIDATE_ONLY'||target!==WRONG_RC_SHA)
 fail('UNAPPROVED_STAGE_TARGET',assessment.verdict);
// A positive verdict is still a *local staging* decision, never production approval.
if(await stat(stagingPath).then(()=>true,()=>false))
 fail('STAGE_MUST_START_EMPTY');
const verified=[];
for(const path of FILES){
 let current,expected;
 try{
  current=await readFile(path);
  expected=execFileSync('git',['show',WRONG_RC_SHA+':'+path],{maxBuffer:10*1024*1024});
 }catch(e){fail('SOURCE_READ_ERROR',path+': '+e.message)}
 if(!current.equals(expected))fail('STAGED_FILE_NOT_SAME_AS_VERIFIED_RC',path);
 verified.push({path,bytes:current.length,sha256:sha256(current)});
}
await mkdir(stagingPath,{recursive:false});
for(const item of verified){
 const to=join(stagingPath,item.path);
 await mkdir(dirname(to),{recursive:true});
 const current=await readFile(item.path);
 await writeFile(to,current);
 if(sha256(await readFile(to))!==item.sha256)fail('STAGED_BYTES_MISMATCH',item.path);
}
const receipt={
 status:'SIMULATED_LOCAL_STAGING_ONLY',sourceCommit:WRONG_RC_SHA,
 reason:'Synthetic-only backup/restore gate passed; not a production release',
 fromSha:WRONG_RC_SHA,toSha:target,case:testcase,
 evidenceKind:evidence.kind,
 result:assessment.verdict,
 records:assessment.evidence?.records,photos:assessment.evidence?.photos,
 sha256BackupVerified:true,recordIdsPreserved:true,
 photoBytesPreserved:true,retryAndParentObservationsPreserved:true,
 independentRestoreVerified:true,files:verified,
 realChildren:0,realParents:0,productionApproved:false,
 publicDeploy:false,externalAuthTested:false,operatingDatabaseChanged:false
};
await writeFile(join(stagingPath,'SIMULATED_RELEASE_RECEIPT.json'),JSON.stringify(receipt,null,2),'utf8');
await writeFile(join(stagingPath,'NOT_DEPLOYED.txt'),
 'Only a synthetic non-operational release staging test. Do not upload to Pages/Netlify or use real child data.\n','utf8');
console.log('WRONG_DRY_RELEASE_GATE='+JSON.stringify({
 status:'STAGED_SYNTHETIC_ONLY',target,case:testcase,
 records:receipt.records,photos:receipt.photos,
 sourceFiles:verified.length,exactRcBytes:true,
 deployed:false,productionApproved:false
}));
