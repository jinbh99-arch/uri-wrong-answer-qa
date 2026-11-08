// QA42: real wrong-answer App Settings UI, TWO isolated Chromium browsers,
// signed synthetic JWT + live ephemeral PostgreSQL RLS, photos, revision CAS,
// explicit backup-restore consent, offline/uncertain PUT and role revocation.
// Never tests real families, production cloud or real children.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {SignJWT,generateKeyPair,exportJWK} from 'jose';
import {chromium} from 'playwright';
import {createQa40SyntheticOidcResolver} from '../scripts/qa40-oidc-resolver.mjs';
import {createQa41LoopbackFamilyApi} from '../scripts/qa41-signed-family-http.mjs';
const {Pool}=pg;
const ORIGIN='http://127.0.0.1:4173',DB='uriaimath-github-qa-v224-only';
const ID='66666666-6666-4666-8666-666666666666';
const OTHER='77777777-7777-4777-8777-777777777777';
const ISS='https://qa42-synthetic.invalid',AUD='qa42-synthetic-api';
const USER_A='qa42-synthetic-guardian-a',USER_B='qa42-synthetic-guardian-b';
const USER_C='qa42-synthetic-other-family';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
if(!process.env.QA39_TEST_DATABASE_URL||
   !process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))throw Error('QA42_POSTGRES_MUST_BE_LOCAL');
process.env.QA39_REFERENCE_ONLY='1';
process.env.QA40_SYNTHETIC_JWKS_ONLY='1';
process.env.QA41_LOOPBACK_ONLY='1';
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const url=new URL(process.env.QA39_TEST_DATABASE_URL);
url.username='qa39_app';url.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const dbApp=new Pool({connectionString:url.toString()});
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA42 NATIVE APP',s)};
async function state(p){
 return p.evaluate(async dbname=>{
  const open=indexedDB.open(dbname),db=await new Promise((resolve,reject)=>{
   open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error)
  });
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const all=(store,fn)=>new Promise((resolve,reject)=>{
    const r=tx.objectStore(store)[fn]();
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
   });
   const [records,photos,keys]=await Promise.all([
    all('mistakes','getAll'),all('photos','getAll'),all('photos','getAllKeys')
   ]);
   return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
    photos:await Promise.all(photos.map(async(b,i)=>({
     id:keys[i],mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))
    })))};
  }finally{db.close()}
 },DB);
}
async function app(ctx){
 const p=await ctx.newPage();
 await p.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
 await p.locator('#nav-settings').click();
 await p.locator('#qa42-real-api:visible').waitFor();
 return p;
}
async function connect(p,token,expectedFamily){
 await p.locator('#qa42-port').fill(String(new URL(gate.baseUrl).port));
 await p.locator('#qa42-token').fill(token);
 await p.locator('#qa42-connect').click();
 await p.getByText('JWT와 PostgreSQL 가족 권한 확인 완료.',{exact:false}).waitFor();
 assert.equal(await p.locator('#qa42-token').inputValue(),'');
 assert.equal(await p.locator('#qa42-family').inputValue(),expectedFamily);
 assert.equal(await p.locator('#qa42-upload').isEnabled(),true);
 await p.locator('#qa42-synthetic').check();
}
async function add(p,text,photo=false){
 await p.locator('#nav-add').click();
 if(photo){
  await p.locator('#choose-photo').setInputFiles({
   name:'qa42-synthetic.png',mimeType:'image/png',buffer:PNG
  });
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 await p.locator('#problem').fill(text);
 await p.locator('#student-answer').fill('QA42 synthetic answer');
 await p.locator('#memo').fill('QA42 synthetic only');
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor();
 await p.locator('#nav-settings').click();
}
async function server(id,token){
 const r=await fetch(gate.baseUrl+'/qa41/families/'+id+'/snapshot',{
  headers:{origin:ORIGIN,authorization:'Bearer '+token}});
 return {status:r.status,data:await r.json()};
}
try{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{modulusLength:2048});
 const jwk={...await exportJWK(publicKey),alg:'RS256',use:'sig',kid:'qa42-synthetic'};
 const auth=createQa40SyntheticOidcResolver({issuer:ISS,audience:AUD,jwks:{keys:[jwk]}});
 const issue=sub=>new SignJWT({qa:'synthetic-only'})
  .setProtectedHeader({alg:'RS256',kid:jwk.kid})
  .setIssuer(ISS).setAudience(AUD).setSubject(sub)
  .setIssuedAt().setExpirationTime('10m').sign(privateKey);
 const jwtA=await issue(USER_A),jwtB=await issue(USER_B),jwtC=await issue(USER_C);
 for(const id of [ID,OTHER]){
  await admin.query('INSERT INTO qa39.families(family_id) VALUES($1)',[id]);
  await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES($1)',[id]);
 }
 for(const [id,sub] of [[ID,USER_A],[ID,USER_B],[OTHER,USER_C]]){
  const principal='oidc:'+createHash('sha256').update(ISS+'\0'+sub).digest('hex');
  await admin.query("INSERT INTO qa39.guardian_memberships(family_id,principal_id,role,verified_at) VALUES($1,$2,'guardian',now())",
   [id,principal]);
 }
 gate=await createQa41LoopbackFamilyApi({pool:dbApp,resolveAuthenticatedPrincipal:auth});
 browser=await chromium.launch({headless:true});
 const ctxA=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const ctxB=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const ctxC=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const A=await app(ctxA),B=await app(ctxB),C=await app(ctxC);
 await connect(A,jwtA,ID);await connect(B,jwtB,ID);await connect(C,jwtC,OTHER);
 assert.equal((await state(A)).records.length,0);
 assert.equal((await state(B)).records.length,0);
 pass('실제 앱 390/320px 분리 브라우저 JWT·Postgres 연결, 토큰 입력창 비움, 다른 가족 별도 권한');

 assert.equal((await A.evaluate(()=>localStorage.length)),0,'no credentials in localStorage');
 const cross=await server(ID,jwtC);
 assert.equal(cross.status,404);
 assert.equal((await server(OTHER,jwtC)).status,200);
 pass('다른 가상 가족은 독립 DB 접근 거부, JWT를 영구 브라우저 저장소에 기록하지 않음');

 await add(A,'QA42 synthetic photo answer',true);
 const firstState=await state(A);
 assert.equal(firstState.records.length,1);
 assert.equal(firstState.photos.length,1);
 const noTransfer=[];
 A.on('download',d=>noTransfer.push(d));
 await A.route('**/qa41/families/*/snapshot',route=>{
  if(route.request().method()==='GET')return route.abort('internetdisconnected');
  return route.continue();
 });
 await A.locator('#qa42-upload').click();
 await A.getByText('가상 API 연결 오류.',{exact:false}).waitFor();
 assert.equal(noTransfer.length,0,'offline preflight must not generate plaintext backup');
 assert.deepEqual(await state(A),firstState);
 await A.unroute('**/qa41/families/*/snapshot');
 pass('업로드 전 연결 끊김은 추가 JSON 파일 다운로드 없이 차단, 로컬 사진·오답 원본 보존');

 const [backupDownload]=await Promise.all([
  A.waitForEvent('download',{timeout:30000}),
  A.locator('#qa42-upload').click()
 ]);
 assert.ok(backupDownload.suggestedFilename().endsWith('.json'));
 await A.getByText('개정번호 1에 합성 오답을 저장했습니다.',{exact:false}).waitFor();
 const saved=await server(ID,jwtA);
 assert.equal(saved.status,200);
 assert.equal(saved.data.revision,1);
 assert.equal(saved.data.snapshot.records.length,1);
 assert.equal(Object.keys(saved.data.snapshot.photos).length,1);
 assert.equal((await state(B)).records.length,0);
 pass('기기 A 실제 앱 전체 사진 JSON 생성·검증 → 서명 JWT HTTP PUT → Postgres revision1 저장');

 await B.locator('#qa42-pull').click();
 await B.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 assert.equal((await state(B)).records.length,0,'restore must need explicit consent');
 await B.locator('#dlg-ok').click();
 await B.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='1');
 assert.deepEqual(await state(B),firstState);
 pass('기기 B DB GET → 기존 앱 완전 백업 복원 검증 → 부모 확인 후 사진 바이트까지 복원');

 await add(B,'QA42 second synthetic problem',false);
 const beforeB=await state(B);
 assert.equal(beforeB.records.length,2);
 // Simulate successful PostgreSQL commit followed by network response loss.
 let committed=0;
 await B.route('**/qa41/families/*/snapshot',async route=>{
  if(route.request().method()==='PUT'){
   const res=await route.fetch();assert.equal(res.status(),200);
   committed++;return route.abort('internetdisconnected');
  }
  return route.continue();
 });
 const [lostDownload]=await Promise.all([
  B.waitForEvent('download',{timeout:30000}),
  B.locator('#qa42-upload').click()
 ]);
 assert.ok(lostDownload.suggestedFilename().endsWith('.json'));
 await B.getByText('서버 저장 결과를 확인할 수 없습니다. 자동 재전송하지 않습니다.',{exact:false}).waitFor();
 assert.equal(committed,1);
 await B.unroute('**/qa41/families/*/snapshot');
 assert.deepEqual(await state(B),beforeB);
 const afterCommit=await server(ID,jwtA);
 assert.equal(afterCommit.data.revision,2);
 const newDownloads=[];
 B.on('download',d=>newDownloads.push(d));
 await B.locator('#qa42-upload').click();
 await B.getByText('서버 최신본이 변경돼 원본 백업을 새로 만들지 않고 중단했습니다.',{exact:false}).waitFor();
 assert.equal(newDownloads.length,0);
 assert.equal((await server(ID,jwtA)).data.revision,2);
 pass('실제 PUT 저장 성공 후 응답 유실: 자동 재전송 금지, 수동 재시도도 최신 CAS 사전검사 차단');

 await B.locator('#qa42-pull').click();
 await B.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 assert.deepEqual(await state(B),beforeB);
 await B.locator('#dlg-ok').click();
 await B.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='2');
 assert.deepEqual(await state(B),beforeB);
 await B.locator('#nav-settings').click();
 pass('응답 유실 후 별도의 서버 조회·수동 복원 승인으로 정상화, 기록 2개·원본 사진 유지');

 const stale=[];
 A.on('download',d=>stale.push(d));
 await A.locator('#qa42-upload').click();
 await A.getByText('서버 최신본이 변경돼 원본 백업을 새로 만들지 않고 중단했습니다.',{exact:false}).waitFor();
 assert.equal(stale.length,0);
 assert.deepEqual(await state(A),firstState);
 assert.equal((await server(ID,jwtA)).data.revision,2);
 pass('기기 A 낡은 revision은 백업 재생성 이전 차단, 서버·로컬 원본 모두 불변');

 const pB='oidc:'+createHash('sha256').update(ISS+'\0'+USER_B).digest('hex');
 await admin.query('UPDATE qa39.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND principal_id=$2',[ID,pB]);
 await B.locator('#qa42-pull').click();
 await B.getByText('서버 응답 404: NOT_FOUND',{exact:false}).waitFor();
 assert.equal(await B.locator('#qa42-upload').isDisabled(),true);
 assert.equal(await B.locator('#qa42-connect').isEnabled(),true);
 assert.equal(await B.locator('#qa42-token').inputValue(),'');
 assert.deepEqual(await state(B),beforeB);
 const current=await server(ID,jwtA);
 assert.equal(current.status,200);assert.equal(current.data.revision,2);
 pass('유효 JWT여도 보호자 권한 철회시 앱 자동 연결해제, 기존 DB/사진 무손실·다른 보호자는 유지');

 const countPublic=await ctxA.newPage();
 await countPublic.goto(ORIGIN.replace('127.0.0.1','localhost')+'/');
 assert.equal(await countPublic.locator('#qa42-real-api').count(),0);
 pass('정확하지 않은 localhost 원점에서는 연결 메뉴 자체가 표시되지 않음');

 console.log('QA42_NATIVE_APP_HTTP_RESULT='+JSON.stringify({
  status:'PASS',checks,realAppChromiumContexts:3,realPostgres:true,
  signedSyntheticJwt:true,photoBytesPreserved:true,manualRestore:true,
  staleAndUncertainPutSafe:true,guardianRevocationSafe:true,
  realCloud:false,productionHttps:false,realLegalGuardians:0,realChildren:0
 }));
}catch(e){
 console.error('QA42_NATIVE_APP_HTTP_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1300)
 }));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gate)await gate.shutdown();
 await dbApp.end();await admin.end();
}
