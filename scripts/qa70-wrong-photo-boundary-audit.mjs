// WRONG QA70: fail-closed, read-only comparison of externally observed staging vs
// operational photo/DB identities. No network, secret, file write or deployment.
// This checks the SHAPE of supplied observations, not their authenticity.
// Do not claim "external preview verified" from this script alone.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const REF=/^[a-z0-9]{20}$/;
const SHA=/^[0-9a-f]{40}$/;
const HTTP_STATUS=new Set([401,403]);

function urlOrigin(candidate){
 if(typeof candidate!=='string'||!candidate.trim())return null;
 try{
  const url=new URL(candidate);
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname||
    /^(localhost|127\.|0\.0\.0\.0$|\[::1\])/.test(url.hostname))return null;
  return url.origin;
 }catch{return null}
}
function nonempty(s){return typeof s==='string'&&s.trim().length>0}
function validRef(s){return nonempty(s)&&REF.test(s)}
function safeIso(s){
 if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s))return false;
 const n=Date.parse(s);
 return Number.isFinite(n)&&n<=Date.now()+60000;
}

// Data contract, all fields supplied ONLY from independently observed read-only
// provider/account evidence; no claim that user-entered metadata proves identity.
export function auditWrongPreviewBoundary(e={}){
 const blockers=[];
 const fail=(code,reason)=>{blockers.push({code,reason})};
 const qa=e.qa||{},prod=e.operational||{},web=e.web||{};
 if(!validRef(qa.databaseProjectRef))fail('QA_DB_ID_MISSING','시험 DB 프로젝트 식별값 미확인');
 if(!validRef(qa.photoProjectRef)||!nonempty(qa.photoBucketId)||
    qa.photoBucketPrivate!==true)fail('QA_PHOTO_ID_MISSING','비공개 시험 사진 저장소 프로젝트·버킷 식별값 미확인');
 if(!validRef(prod.databaseProjectRef)||!nonempty(prod.databaseSource))
  fail('OPERATIONAL_DB_ID_MISSING','운영 DB 프로젝트 및 읽기 전용 식별 근거 미확인');
 if(!validRef(prod.photoProjectRef)||!nonempty(prod.photoBucketId)||
    !nonempty(prod.photoSource))fail('OPERATIONAL_PHOTO_ID_MISSING','운영 사진 저장소 프로젝트·버킷의 읽기 전용 식별 근거 미확인');
 if(validRef(qa.databaseProjectRef)&&validRef(prod.databaseProjectRef)&&
  qa.databaseProjectRef===prod.databaseProjectRef)fail('DB_PROJECT_SHARED','시험·운영 DB 프로젝트가 같음');
 if(validRef(qa.photoProjectRef)&&validRef(prod.photoProjectRef)&&
  qa.photoProjectRef===prod.photoProjectRef)fail('PHOTO_PROJECT_SHARED','시험·운영 사진 저장소 프로젝트가 같음');

 const publicOrigin=urlOrigin(web.publicUrl),previewOrigin=urlOrigin(web.previewUrl);
 if(!publicOrigin||!previewOrigin||previewOrigin===publicOrigin||
   previewOrigin===urlOrigin(web.operationalUrl))
  fail('EXTERNAL_PRIVATE_ORIGIN_NOT_PROVED','공개·운영과 다른 실제 HTTPS 미리보기 출처 미확인');
 if(!HTTP_STATUS.has(web.unauthenticatedStatus)||web.authenticatedStatus!==200||
    !nonempty(web.accessEvidence))fail('EXTERNAL_ACCESS_NOT_PROVED','외부 무인증 401/403·실인증 200 및 접근제한 근거 미확인');
 if(web.fictionalOnly!==true||!nonempty(web.fictionalEvidence))
  fail('FICTIONAL_ONLY_NOT_PROVED','외부 가상자료 전용 근거 미확인');
 if(!SHA.test(web.expectedDevSha||'')||web.deployedDevSha!==web.expectedDevSha||
    !safeIso(web.observedAt))fail('DEPLOYED_SHA_TIME_NOT_PROVED','외부 실제 반영 SHA·검증 시각 미확인');

 // Structural completeness is never a live verification; supplied evidence must
 // still be checked against provider APIs and authenticated external browser.
 return {status:blockers.length?'BLOCKED':'STRUCTURALLY_READY_NOT_LIVE_VERIFIED',
  structurallyComplete:blockers.length===0,externallyVerified:false,
  safeToRestore:false,blockers};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv[2];
 if(!path){console.error('WRONG_QA70: provide read-only JSON observations file');process.exitCode=2}
 else try{
  const evidence=JSON.parse(await readFile(path,'utf8'));
  const outcome=auditWrongPreviewBoundary(evidence);
  console.log('WRONG_QA70_RESULT='+JSON.stringify(outcome));
  if(!outcome.structurallyComplete)process.exitCode=2;
 }catch{console.error('WRONG_QA70: invalid/missing observations (values withheld)');process.exitCode=2}
}
