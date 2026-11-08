import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const {Pool}=pg;
const conn=process.env.QA39_TEST_DATABASE_URL;
if(!conn||!conn.includes('127.0.0.1'))throw Error('QA44_SERVER_TEST_ONLY');
process.env.QA44_STAGE_ONLY='1';
const admin=new Pool({connectionString:conn});
const privatePool=new Pool({connectionString:conn});
const writer={connect:async()=>{
 const c=await privatePool.connect();
 await c.query('SET ROLE qa44_sync_writer');
 return c;
}};
const UA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 UB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 UC='cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 FA='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TOKEN_A='qa44.synthetic.signed.reference.'+'a'.repeat(90);
const TOKEN_B='qa44.synthetic.signed.reference.'+'b'.repeat(90);
const TOKEN_C='qa44.synthetic.signed.reference.'+'c'.repeat(90);
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const make=items=>{
 const photos={};
 for(const r of items)if(r.hasPhoto)photos[r.id]=photo;
 return signSynthetic({format:'uriaimath-offline-backup-v02',
  profile:{nickname:'qa44 synthetic',grade:4},records:items,photos,
  backupSummary:{recordCount:items.length,photoCount:Object.keys(photos).length}});
};
let checks=0;const pass=s=>{checks++;console.log('PASS QA44 SERVER',s)};
try{
 const client={auth:{async getUser(token){
  const id=token===TOKEN_A?UA:token===TOKEN_B?UB:token===TOKEN_C?UC:null;
  return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
 }}};
 delete process.env.QA44_STAGE_ONLY;
 assert.throws(()=>createQa44ServerFamilyStore({pool:writer,authClient:client}),/NO_LIVE_SUPABASE_AUTH_ALLOWED/);
 process.env.QA44_STAGE_ONLY='1';
 const store=createQa44ServerFamilyStore({pool:writer,authClient:client});
 // Prior RLS test intentionally revokes synthetic A. This independent
 // server-store case starts with admin-provisioned test guardian authority.
 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=NULL WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.deepEqual(await store.families(TOKEN_A),[FA]);
 assert.deepEqual(await store.families(TOKEN_B),['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);
 assert.deepEqual(await store.families(TOKEN_C),[]);
 await assert.rejects(store.families('bad-token'),/AUTH_REQUIRED/);
 await assert.rejects(store.families('a'.repeat(70)),/AUTH_REQUIRED/);
 pass('가상 getUser 서버 확인 뒤 역할 분리, 보류 보호자·가짜 토큰·운영 모드 거부');

 const original=make([{id:'qa44-photo',problemText:'2/7+1/7',hasPhoto:true,practiceHistory:[]}]);
 const stored=await store.put(TOKEN_A,FA,0,original);
 assert.equal(stored.revision,1);
 assert.deepEqual((await store.read(TOKEN_A,FA)).snapshot,original);
 assert.equal((await store.read(TOKEN_A,FA)).snapshot.photos['qa44-photo'],photo);
 assert.equal(await store.read(TOKEN_B,FA),null);
 await assert.rejects(store.put(TOKEN_B,FA,1,original),/FAMILY_NOT_ACCESSIBLE/);
 pass('서명된 형식 전체 사진·오답을 가족 DB에 CAS 저장, 다른 가족 read/write 금지');

 await assert.rejects(store.put(TOKEN_A,FA,0,original),/STALE_REVISION/);
 await assert.rejects(store.put(TOKEN_A,FA,1,make([])),/SILENT_RECORD_OR_PHOTO_LOSS/);
 const tampered=structuredClone(original);
 tampered.records[0].problemText='changed and not resigned';
 await assert.rejects(store.put(TOKEN_A,FA,1,tampered),/digest does not match|CHECKSUM/);
 assert.equal((await store.read(TOKEN_A,FA)).revision,1);
 pass('오래된 개정번호·사진/기록 손실·변조된 백업 차단, 서버 원본 유지');

 const left=make([...original.records,{id:'qa44-left',problemText:'L',hasPhoto:false,practiceHistory:[]}]);
 const right=make([...original.records,{id:'qa44-right',problemText:'R',hasPhoto:false,practiceHistory:[]}]);
 const outcomes=await Promise.allSettled([
  store.put(TOKEN_A,FA,1,left),store.put(TOKEN_A,FA,1,right)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 const last=await store.read(TOKEN_A,FA);
 assert.equal(last.revision,2);
 assert.equal(last.snapshot.records.length,2);
 assert.equal(last.snapshot.photos['qa44-photo'],photo);
 pass('동시 기기 PUT 단 한 건 성공, 사진/오답 원본 보존, 낡은 쓰기 거부');

 const hash=createHash('sha256').update(JSON.stringify(last.snapshot)).digest('hex');
 assert.equal(hash,(await admin.query('SELECT content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',[FA])).rows[0].content_sha256);
 await admin.query('UPDATE qa44.family_snapshots SET content_sha256=$2 WHERE family_id=$1',[FA,'0'.repeat(64)]);
 await assert.rejects(store.read(TOKEN_A,FA),/SERVER_DATA_TAMPERED/);
 await admin.query('UPDATE qa44.family_snapshots SET content_sha256=$2 WHERE family_id=$1',[FA,hash]);
 pass('서버 저장 SHA-256 무결성 훼손 시 실패 폐쇄 및 원본 정합성 복원');

 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.equal(await store.read(TOKEN_A,FA),null);
 await assert.rejects(store.put(TOKEN_A,FA,2,last.snapshot),/FAMILY_NOT_ACCESSIBLE/);
 assert.deepEqual(await store.families(TOKEN_A),[]);
 assert.equal((await store.families(TOKEN_B)).length,1);
 pass('보호자 승인 철회 즉시 서버 백엔드 조회·저장 중단, 다른 가족은 유지');

 console.log('QA44_FAMILY_SERVER_RESULT='+JSON.stringify({
  status:'PASS',checks,realPostgres:true,mockedSupabaseGetUser:true,
  serverOnlyWriterRole:true,photoExact:true,cas:true,guardianRevocation:true,
  productionConnection:false,realChildren:0
 }));
}catch(e){console.error('QA44_FAMILY_SERVER_RESULT='+JSON.stringify({
 status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,1400)}));process.exitCode=1}
finally{await privatePool.end();await admin.end()}
