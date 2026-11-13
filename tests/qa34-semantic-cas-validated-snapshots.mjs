// New QA boundary: separately SHA-256 validated, meaning-identical backups
// may differ in object/record/photo-map ordering or export time.
// Unknown fields, array order within a record, photo bytes, child explanation,
// parent review and profile MUST remain significant. Synthetic localhost only.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const key=randomBytes(32).toString('hex');
const directory=mkdtempSync(join(tmpdir(),'wrong-qa-semantic-'));
const path=join(directory,'encrypted-synthetic-families.json');
const PASSWORD='QA-SEMANTIC-ORDER-2026-SYNTHETIC-ONLY';
const FA='qa-semantic-a',FB='qa-semantic-b';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const PNG2='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const row1={id:'qa-math-photo-a',problemText:'합성 사진 문제 A',hasPhoto:true,
 studentAnswer:'가상 아이 답',practiceHistory:[],generalRetryHistory:[
  {answer:'처음 답',explanation:'처음 왜 틀렸는지 설명',review:'needs_help'},
  {answer:'다시 답',explanation:'다시 설명',review:'not_checked'}]};
const row2={id:'qa-math-photo-b',problemText:'합성 사진 문제 B',hasPhoto:true,
 studentAnswer:'다른 가상 아이 답',practiceHistory:[],parentMemo:'가상 학부모 관찰 기록'};
const docA=signSynthetic({format:'uriaimath-offline-backup-v02',
 exportedAt:'2026-11-14T07:00:00.000Z',notice:'기록은 로컬에 보관하세요.',
 backupSummary:{recordCount:2,photoCount:2},
 profile:{nickname:'가상 A 가족',grade:3},records:[row1,row2],
 photos:{[row1.id]:PNG,[row2.id]:PNG2}});
const docB=signSynthetic({format:'uriaimath-offline-backup-v02',
 exportedAt:'2026-11-14T07:01:00.000Z',
 backupSummary:{recordCount:1,photoCount:0},
 profile:{nickname:'가상 B 가족',grade:5},
 records:[{id:'qa-only-b',problemText:'다른 가족 전용 합성 오답',hasPhoto:false,practiceHistory:[]}],
 photos:{}});
const reverseKeys=x=>Array.isArray(x)?x.map(reverseKeys):x&&typeof x==='object'
 ?Object.fromEntries(Object.entries(x).reverse().map(([k,v])=>[k,reverseKeys(v)])):x;
function resigned(x){const c=structuredClone(x);delete c.integrity;return signSynthetic(c)}
let gate,checks=0;
const pass=s=>{checks++;console.log('PASS WRONG SEMANTIC CAS',s)};
async function call(path,method='GET',body,token,rev){
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 const res=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,payload:await res.json(),etag:res.headers.get('etag')};
}
async function user(name){
 const reg=await call('/qa/register','POST',{familyKey:name,password:PASSWORD});
 assert.equal(reg.status,201);
 const logged=await call('/qa/login','POST',{familyKey:name,password:PASSWORD});
 assert.equal(logged.status,200);return logged.payload.token;
}
async function get(token){const res=await call('/qa/snapshot','GET',undefined,token);
 assert.equal(res.status,200);return res}
try{
 gate=await createIsolatedQaFamilyGateway({durablePath:path,encryptionKey:key});
 const a=await user(FA),b=await user(FB);
 assert.equal((await call('/qa/snapshot','PUT',docA,a,0)).status,200);
 assert.equal((await call('/qa/snapshot','PUT',docB,b,0)).status,200);
 assert.equal((await get(a)).payload.revision,1);
 assert.equal((await get(b)).payload.revision,1);
 assert.deepEqual((await get(b)).payload.snapshot,docB);
 const encryptedBefore=readFileSync(path);
 assert.ok(!encryptedBefore.includes(Buffer.from('합성 사진 문제 A')));
 pass('가상 가족 A/B를 실제 임시 AES-GCM 원장에 분리 저장, 사진 2장·학생 설명·부모 관찰 포함');

 // All object key order is reversed (including nested profiles/rows/photos),
 // record ID order is reversed, export time changes, and the SHA is re-signed.
 const equivalent=reverseKeys(structuredClone(docA));
 delete equivalent.integrity;
 equivalent.records.reverse();
 equivalent.exportedAt='2026-11-14T08:00:00.000Z';
 signSynthetic(equivalent);
 assert.notEqual(JSON.stringify(docA),JSON.stringify(equivalent));
 assert.notEqual(docA.integrity.digest,equivalent.integrity.digest);
 const same=await call('/qa/snapshot','PUT',equivalent,a,1);
 assert.equal(same.status,200,JSON.stringify(same.payload));
 assert.deepEqual(same.payload,{stored:true,revision:1,unchanged:true,qaOnly:true});
 assert.equal(same.etag,'"1"');
 assert.deepEqual((await get(a)).payload.snapshot,docA,'old validated remote bytes must remain');
 assert.deepEqual(readFileSync(path),encryptedBefore,'identical content must NOT rewrite encrypted store');
 pass('별도 SHA 유효: 객체·기록·사진 키 순서/내보낸 시각이 달라도 CAS 200/unchanged, revision·암호 원본 바이트 동일');

 const changedChild=resigned(docA);
 changedChild.records[0].studentAnswer='중요한 학생 설명 변경';
 signSynthetic(changedChild);
 const deniedChild=await call('/qa/snapshot','PUT',changedChild,a,1);
 assert.equal(deniedChild.status,409,JSON.stringify(deniedChild.payload));
 assert.deepEqual(readFileSync(path),encryptedBefore);
 pass('유효 SHA로 재서명한 학생 설명 변경은 같은 기록 ID 충돌 409, 원장 바이트 불변');

 const changedParent=resigned(docA);
 changedParent.records[0].generalRetryHistory[0].review='mastered';
 signSynthetic(changedParent);
 assert.equal((await call('/qa/snapshot','PUT',changedParent,a,1)).status,409);
 assert.deepEqual(readFileSync(path),encryptedBefore);
 pass('부모 관찰 변경은 무변경으로 간주하지 않고 기존 409 충돌 검사를 유지');

 const changedPhoto=resigned(docA);
 changedPhoto.photos[row1.id]='data:image/png;base64,'+Buffer.from('DIFFERENT SYNTHETIC PHOTO BYTES').toString('base64');
 signSynthetic(changedPhoto);
 assert.equal((await call('/qa/snapshot','PUT',changedPhoto,a,1)).status,409);
 assert.deepEqual(readFileSync(path),encryptedBefore);
 pass('사진 원본 바이트 변경·새 체크섬 부여에도 409, 사진 데이터 무손실');

 const changedHistory=resigned(docA);
 changedHistory.records[0].generalRetryHistory.reverse();
 signSynthetic(changedHistory);
 assert.equal((await call('/qa/snapshot','PUT',changedHistory,a,1)).status,409);
 assert.deepEqual(readFileSync(path),encryptedBefore);
 pass('개별 오답의 재풀이·관찰 이력 순서 변경은 의미 있는 변경으로 엄격히 거절');

 const tampered=structuredClone(docA);
 tampered.records[0].studentAnswer='임의로 변조하고 체크섬은 그대로';
 assert.equal((await call('/qa/snapshot','PUT',tampered,a,1)).status,422);
 assert.equal((await call('/qa/snapshot','PUT',equivalent,a,0)).status,409);
 assert.equal((await call('/qa/snapshot','PUT',equivalent,undefined,1)).status,401);
 assert.deepEqual(readFileSync(path),encryptedBefore);
 pass('SHA 손상 422·구 If-Match 409·미인증 401은 의미 비교보다 앞에서 차단');

 const fresh=resigned(docA);
 fresh.records.push({id:'qa-new-real-change',problemText:'A 합성 신규 문제',hasPhoto:false,
  studentAnswer:'새 아이의 가상 답',practiceHistory:[]});
 fresh.backupSummary.recordCount=3;
 signSynthetic(fresh);
 const added=await call('/qa/snapshot','PUT',fresh,a,1);
 assert.equal(added.status,200,JSON.stringify(added.payload));
 assert.equal(added.payload.revision,2);
 assert.notEqual(added.payload.unchanged,true);
 const aAfter=await get(a);
 assert.equal(aAfter.payload.revision,2);
 assert.deepEqual(aAfter.payload.snapshot,fresh);
 assert.equal(Object.keys(aAfter.payload.snapshot.photos).length,2);
 pass('실제 신규 오답만 CAS revision 1→2, 사진·학생 설명·관찰 보존');

 // Even with valid B credentials, B's occupied ledger cannot be replaced by
 // A's source file. This is a synthetic access boundary, not real provenance.
 const crossing=await call('/qa/snapshot','PUT',docA,b,1);
 assert.equal(crossing.status,409);
 assert.deepEqual((await get(b)).payload.snapshot,docB);
 assert.equal((await get(b)).payload.revision,1);
 pass('별도 가상 가족 B의 원장은 A의 유효 서명 사진 백업으로도 변경 불가');

 console.log('WRONG_QA34_SEMANTIC_CAS_RESULT='+JSON.stringify({status:'PASS',checks,
  nodeHttp:true,syntheticFamilies:2,photos:2,
  validShaReorderedNoop:true,encryptedFileUnchanged:true,
  genuineChangesBlockedOrVersioned:true,realFamilyAuth:false,
  safeToRestore:false,deployment:false}));
}catch(err){
 console.error('WRONG_QA34_SEMANTIC_CAS_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(err),stack:String(err?.stack).slice(0,1100),safeToRestore:false}));
 process.exitCode=1;
}finally{if(gate)await gate.shutdown();rmSync(directory,{recursive:true,force:true})}
