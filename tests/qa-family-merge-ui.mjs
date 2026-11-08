// QA30: two isolated Chromium UI clients approve a non-conflicting merge.
// Local synthetic data only. Does not connect to production or real students.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const password='QA30-SYNTHETIC-ONLY-DO-NOT-REUSE';
const row=id=>({id,problemText:'QA30-SYNTHETIC-'+id,hasPhoto:false,practiceHistory:[]});
const doc=ids=>signSynthetic({format:'uriaimath-offline-backup-v02',profile:{grade:3,nickname:'QA-SYNTHETIC'},
 records:ids.map(row),photos:{},backupSummary:{recordCount:ids.length,photoCount:0}});
let gate,browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA30 G15 BROWSER',s)};
async function api(path,method='GET',body,token,rev){
 const headers={};if(token)headers.authorization='Bearer '+token;
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(gate.baseUrl+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
async function file(page,object){
 await page.locator('#lab-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(object))});
}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 browser=await chromium.launch({headless:true});
 const A=await (await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true})).newPage();
 const B=await (await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true})).newPage();
 for(const p of [A,B]){
  await p.goto('http://127.0.0.1:4173/qa-family-sync-lab.html');
  await p.locator('#lab-port').fill(new URL(gate.baseUrl).port);
  await p.locator('#lab-family').fill('qa-30-family-demo');
  await p.locator('#lab-password').fill(password);
 }
 await A.locator('#lab-register').click();
 await A.getByText('가상 가족을 만들었습니다.',{exact:false}).waitFor();
 for(const p of [A,B]){
  await p.locator('#lab-login').click();
  await p.getByText('로그인 성공.',{exact:false}).waitFor();
  await p.locator('#lab-synthetic').check();
 }
 pass('두 별도 모바일 Chromium 컨텍스트에서 가상 가족 2세션 로그인');
 await file(A,doc(['qa-a','qa-b']));
 await A.locator('#lab-upload').click();
 await A.getByText('개정번호 1로 합성 백업을 저장했습니다.',{exact:false}).waitFor();
 const [download]=await Promise.all([B.waitForEvent('download'),B.locator('#lab-download').click()]);
 assert.ok((await (await import('node:fs/promises')).readFile(await download.path(),'utf8')).includes('qa-a'));
 assert.match(await B.locator('#lab-merge-status').textContent(),/기준본 서버 개정번호 1/);
 pass('기기 B에서 실제 서버 원본 1을 다운로드해 기준 이력 보관');
 await file(A,doc(['qa-a','qa-b','qa-from-a']));
 await A.locator('#lab-upload').click();
 await A.getByText('개정번호 2로 합성 백업을 저장했습니다.',{exact:false}).waitFor();
 await file(B,doc(['qa-a','qa-b','qa-from-b']));
 await B.locator('#lab-preview-merge').click();
 await B.getByText('충돌 없음: 아래 동의를 선택하면',{exact:false}).waitFor();
 assert.equal(await B.locator('#lab-commit-merge').isDisabled(),true);
 assert.equal(await B.locator('#lab-merge-approved').isEnabled(),true);
 pass('다른 기록을 각 기기에 추가: 미리보기는 성공해도 확인 전 실제 저장 버튼 차단');
 await B.locator('#lab-merge-approved').check();
 await B.locator('#lab-commit-merge').click();
 await B.getByText('승인된 충돌 없는 변경만 개정번호 3에 저장되었습니다.',{exact:false}).waitFor();
 const session=await api('/qa/login','POST',{familyKey:'qa-30-family-demo',password});
 assert.equal(session.status,200);
 const snapshot=await api('/qa/snapshot','GET',undefined,session.body.token);
 assert.equal(snapshot.body.revision,3);
 assert.deepEqual(snapshot.body.snapshot.records.map(x=>x.id).sort(),
  ['qa-a','qa-b','qa-from-a','qa-from-b']);
 assert.equal(await B.locator('#lab-commit-merge').isDisabled(),true);
 pass('명시적 승인 후 A+B의 네 개 기록 모두 보존, 승인 버튼 다시 비활성화');
 console.log('QA_G15_MERGE_UI_RESULT='+JSON.stringify({status:'PASS',checks,
  browserContexts:2,manualReview:true,realCloud:false,childrenData:0}));
}catch(e){
 console.error('QA_G15_MERGE_UI_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,800)}));
 process.exitCode=1;
}finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
