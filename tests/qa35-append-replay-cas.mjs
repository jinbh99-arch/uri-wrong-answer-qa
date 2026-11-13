import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'wrong-append-replay-'));
const file=join(folder,'encrypted-a-b.json');
let gateway,checks=0;
function pass(name){checks++;console.log('PASS WRONG APPEND REPLAY',name)}
async function req(path,method='GET',data,token,revision){
 const headers={};
 if(token)headers.authorization='Bearer '+token;
 if(data!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const response=await fetch(gateway.baseUrl+path,{method,headers,
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:response.status,data:await response.json(),etag:response.headers.get('etag')};
}
async function family(name){
 assert.equal((await req('/qa/register','POST',{familyKey:name,password:'synthetic-pass-2026'})).status,201);
 const login=await req('/qa/login','POST',{familyKey:name,password:'synthetic-pass-2026'});
 assert.equal(login.status,200);return login.data.token;
}
function backup(name,rows){
 return signSynthetic({format:'uriaimath-offline-backup-v02',exportedAt:'2026-11-14T00:00:00Z',
  provenance:{source:'synthetic-'+name},profile:{nickname:'Synthetic '+name,grade:3},
  records:rows,photos:{},backupSummary:{recordCount:rows.length,photoCount:0}});
}
const first={id:'synth-001',problemText:'synthetic question one',studentAnswer:'first explanation',
 hasPhoto:false,practiceHistory:[],parentMemo:'parent observation one'};
const second={id:'synth-002',problemText:'synthetic question two',studentAnswer:'second explanation',
 hasPhoto:false,practiceHistory:[],parentMemo:'parent observation two'};
try{
 gateway=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:randomBytes(32).toString('hex')});
 const a=await family('qa-append-family-a'),b=await family('qa-append-family-b');
 const initial=backup('a',[first]),appended=backup('a',[first,second]),other=backup('b',[{...first,id:'b-private'}]);
 assert.equal((await req('/qa/snapshot','PUT',initial,a,0)).status,200);
 assert.equal((await req('/qa/snapshot','PUT',other,b,0)).status,200);
 pass('합성 가족 A/B 각각 revision1에 분리 저장');
 const add=await req('/qa/snapshot','PUT',appended,a,1);
 assert.equal(add.status,200,JSON.stringify(add.data));
 assert.equal(add.data.revision,2);assert.notEqual(add.data.unchanged,true);
 pass('정상 신규 오답 1건 추가 CAS revision1→2');
 const committed=readFileSync(file);
 const same=await req('/qa/snapshot','PUT',appended,a,2);
 assert.equal(same.status,200,JSON.stringify(same.data));
 assert.equal(same.data.unchanged,true);assert.equal(same.data.revision,2);assert.equal(same.etag,'"2"');
 assert.deepEqual(readFileSync(file),committed);
 pass('최신 CAS2 동일 백업 재전송은 200 unchanged, revision2/암호 원장 바이트 불변');
 const stale=await req('/qa/snapshot','PUT',appended,a,1);
 assert.equal(stale.status,409);assert.equal(stale.data.error,'STALE_REVISION');
 assert.deepEqual(readFileSync(file),committed);
 pass('같은 내용이어도 오래된 If-Match 1은 409, 원장 불변');
 const bCross=await req('/qa/snapshot','PUT',appended,b,1);
 assert.equal(bCross.status,409);assert.deepEqual(readFileSync(file),committed);
 const bGet=await req('/qa/snapshot','GET',undefined,b);
 assert.equal(bGet.status,200);assert.equal(bGet.data.revision,1);
 assert.deepEqual(bGet.data.snapshot,other);
 pass('B 유효 토큰으로 A의 추가 기록 전송해도 B 기록·revision 불변');
 const aGet=await req('/qa/snapshot','GET',undefined,a);
 assert.equal(aGet.status,200);assert.equal(aGet.data.revision,2);
 assert.deepEqual(aGet.data.snapshot,appended);
 assert.equal(aGet.data.snapshot.records[0].parentMemo,'parent observation one');
 assert.equal(aGet.data.snapshot.records[1].parentMemo,'parent observation two');
 pass('GET에서 두 아이 설명·부모 관찰 모두 보존');
 const invalid=structuredClone(appended);invalid.records[1].parentMemo='tampered';
 const bad=await req('/qa/snapshot','PUT',invalid,a,2);
 assert.equal(bad.status,422);assert.deepEqual(readFileSync(file),committed);
 pass('손상된 SHA의 재전송은 422, 원장 불변');
 console.log('WRONG_APPEND_REPLAY_RESULT='+JSON.stringify({status:'PASS',checks,
  safeToRestore:false,realFamilyAuth:false,deployed:false}));
}catch(e){
 console.error('WRONG_APPEND_REPLAY_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e.stack).slice(0,1200)}));
 process.exitCode=1;
}finally{if(gateway)await gateway.shutdown();rmSync(folder,{recursive:true,force:true})}
