// QA35 NEW synthetic family boundary: identical numeric revision does NOT
// grant cross-family GET/PUT/DELETE rights through swapped bearer tokens,
// client-supplied labels or URL query. Real localhost HTTP + encrypted temp
// ledger. SHA is NOT an origin signature, and not production authorization.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'wrong-qa35-token-boundary-'));
const file=join(folder,'families.aesgcm.json'),key=randomBytes(32).toString('hex');
const A='qa-token-boundary-a',B='qa-token-boundary-b',PASS='QA35-TOKEN-BOUNDARY-NOT-REAL-2026';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const doc=(family,id,photo)=>signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{nickname:family,grade:photo?3:5},
 provenance:{sourceHint:family,verifiedOrigin:false},
 records:[{id,problemText:'가상 '+family+'의 오답',hasPhoto:photo,
  studentAnswer:'아이 설명 '+family,practiceHistory:[],
  generalRetryHistory:[{answer:'가상 재풀이',explanation:family+' 이유',
   review:'needs_help',parentNote:family+' 부모 관찰'}]}],
 photos:photo?{[id]:PNG}:{},
 backupSummary:{recordCount:1,photoCount:photo?1:0}
});
const storedA=doc('A','qa-a-only-photo',true),storedB=doc('B','qa-b-only',false);
let gate,checks=0;const pass=s=>{checks++;console.log('PASS WRONG TOKEN LEDGER',s)};
async function request(path,method='GET',body,token,rev,extra={}){
 const headers={...extra};
 if(token)headers.authorization='Bearer '+token;
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json(),etag:response.headers.get('etag')};
}
async function session(family){
 const reg=await request('/qa/register','POST',{familyKey:family,password:PASS});
 assert.equal(reg.status,201);
 const login=await request('/qa/login','POST',{familyKey:family,password:PASS});
 assert.equal(login.status,200);
 return login.data.token;
}
async function snap(token){
 const r=await request('/qa/snapshot','GET',undefined,token);
 assert.equal(r.status,200);
 return r.data;
}
try{
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 const a=await session(A),b=await session(B);
 assert.notEqual(a,b);
 const aPut=await request('/qa/snapshot','PUT',storedA,a,0);
 const bPut=await request('/qa/snapshot','PUT',storedB,b,0);
 assert.equal(aPut.status,200);assert.equal(bPut.status,200);
 assert.equal(aPut.data.revision,1);assert.equal(bPut.data.revision,1);
 assert.deepEqual((await snap(a)).snapshot,storedA);
 assert.deepEqual((await snap(b)).snapshot,storedB);
 const before=readFileSync(file);
 assert.equal(before.includes(Buffer.from('부모 관찰')),false);
 pass('A/B 인증 토큰 각각 발급, 양쪽 revision 1 동일하지만 사진·부모 관찰 원장 독립·AES-GCM 보관');

 const hintGet=await request('/qa/snapshot','GET',undefined,a,undefined,{'x-qa-family-key':B});
 assert.equal(hintGet.status,200);
 assert.deepEqual(hintGet.data.snapshot,storedA);
 assert.notDeepEqual(hintGet.data.snapshot,storedB);
 const qGet=await request('/qa/snapshot?familyKey='+B,'GET',undefined,a);
 assert.equal(qGet.status,404);
 assert.equal(Object.hasOwn(qGet.data,'snapshot'),false);
 const qOther=await request('/qa/snapshot?familyKey='+A,'GET',undefined,b);
 assert.equal(qOther.status,404);
 pass('A 토큰에 B를 적은 헤더·URL을 붙여도 B 자료 조회 0, B 토큰으로 A 조회 0');

 const unauth=await request('/qa/snapshot');
 assert.equal(unauth.status,401);
 assert.equal(Object.hasOwn(unauth.data,'snapshot'),false);
 const forged=await request('/qa/snapshot','GET',undefined,a.slice(0,-4)+'abcd');
 assert.equal(forged.status,401);
 assert.equal(Object.hasOwn(forged.data,'snapshot'),false);
 pass('토큰 없음·변조된 토큰 GET 401, 응답에 사진/오답 원장 필드 없음');

 const crossA=await request('/qa/snapshot','PUT',storedB,a,1);
 const crossB=await request('/qa/snapshot','PUT',storedA,b,1);
 assert.equal(crossA.status,409,JSON.stringify(crossA.data));
 assert.equal(crossB.status,409,JSON.stringify(crossB.data));
 assert.equal(Object.hasOwn(crossA.data,'snapshot'),false);
 assert.equal(Object.hasOwn(crossB.data,'snapshot'),false);
 assert.deepEqual(readFileSync(file),before);
 pass('동일 개정번호 1 사용해 상대 가족 사진·오답 백업으로 PUT 교체 시 양쪽 모두 409·암호 원장 불변');

 const sameAWithWrongCAS=await request('/qa/snapshot','PUT',storedA,a,0);
 assert.equal(sameAWithWrongCAS.status,409);
 const aWithStolenBRev=await request('/qa/snapshot','PUT',storedA,a,2);
 assert.equal(aWithStolenBRev.status,409);
 assert.deepEqual(readFileSync(file),before);
 pass('상대 가족 revision 수치를 제출해도 낡거나 미래 If-Match는 409, 저장 변화 없음');

 const crossDelete=await request('/qa/family','DELETE',{
  familyKey:B,password:PASS,approved:true,confirmation:'DELETE_SYNTHETIC_FAMILY'
 },a,1);
 assert.equal(crossDelete.status,403);
 assert.equal(Object.hasOwn(crossDelete.data,'snapshot'),false);
 assert.deepEqual(readFileSync(file),before);
 assert.deepEqual((await snap(a)).snapshot,storedA);
 assert.deepEqual((await snap(b)).snapshot,storedB);
 pass('A 토큰과 B의 정확한 가족 ID·비밀번호·revision으로 DELETE 시도도 403, 양쪽 가족 유지');

 const aEnd=await request('/qa/logout','POST',undefined,a);
 assert.equal(aEnd.status,200);
 assert.equal((await request('/qa/snapshot','GET',undefined,a)).status,401);
 const afterB=await snap(b);
 assert.equal(afterB.revision,1);
 assert.deepEqual(afterB.snapshot,storedB);
 assert.equal(Object.keys(afterB.snapshot.photos).length,0);
 pass('A 로그아웃으로 A 토큰 폐기되어도 B 토큰·원장 정상, 사진/부모 관찰 교차 노출 0');

 console.log('WRONG_QA35_CROSS_FAMILY_TOKEN_RESULT='+JSON.stringify({
  status:'PASS',checks,realNodeHttp:true,syntheticFamilies:2,
  identicalRevisionCollision:true,deniedCrossReads:true,deniedCrossWrites:true,
  blockedCrossDelete:true,encryptedOriginalPreserved:true,
  emptyFamilyManualImportProvenanceNotProved:true,productionAuth:false,
  safeToRestore:false,deployment:false}));
}catch(error){
 console.error('WRONG_QA35_CROSS_FAMILY_TOKEN_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(error),stack:String(error?.stack).slice(0,1250),
  safeToRestore:false}));
 process.exitCode=1;
}finally{
 if(gate)await gate.shutdown();
 rmSync(folder,{recursive:true,force:true});
}
