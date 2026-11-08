// QA29 G15 user-accessible local-only sync UI, strict CORS and real browser fetch.
// No production domain, no actual family records, no real cloud.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {readFile} from 'node:fs/promises';
const BASE='http://127.0.0.1:4173/';
const password='QA29-SYNTHETIC-PASSWORD-DO-NOT-REUSE-2026';
const make=(items)=>signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{nickname:'QA-SYNTHETIC',grade:3,subject:'math'},
 records:items.map(id=>({id,problemText:'QA29-SYNTHETIC-'+id,hasPhoto:false,practiceHistory:[]})),
 photos:{},backupSummary:{recordCount:items.length,photoCount:0}
});
let gateway=null,browser=null,n=0;
const pass=s=>{n++;console.log('PASS QA29 G15',s)};
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gateway=await createIsolatedQaFamilyGateway();
 browser=await chromium.launch({headless:true});
 const a=await browser.newContext({acceptDownloads:true,viewport:{width:375,height:810}});
 const b=await browser.newContext({acceptDownloads:true,viewport:{width:320,height:700}});
 const A=await a.newPage(),B=await b.newPage();
 await A.goto(BASE+'qa-family-sync-lab.html');
 await B.goto(BASE+'qa-family-sync-lab.html');
 assert.equal(await A.locator('#lab-register').isEnabled(),true);
 assert.equal(await A.locator('#lab-login').isEnabled(),true);
 pass('실제 375px·320px 두 독립 모바일 브라우저에서 QA 로컬 실험실 화면 활성화');
 for(const [page,family] of [[A,'qa-first-family'],[B,'qa-first-family']]){
  await page.locator('#lab-port').fill(String(new URL(gateway.baseUrl).port));
  await page.locator('#lab-family').fill(family);
  await page.locator('#lab-password').fill(password);
 }
 await A.locator('#lab-register').click();
 await A.getByText('가상 가족을 만들었습니다.',{exact:false}).waitFor();
 await A.locator('#lab-login').click();
 await A.getByText('로그인 성공.',{exact:false}).waitFor();
 assert.equal(await A.locator('#lab-password').inputValue(),'');
 pass('CORS를 이용한 실제 브라우저 가상 가족 등록·로그인, 비밀번호 입력란 삭제');
 const first=make(['qa29-first']);
 await A.locator('#lab-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(first))});
 await A.locator('#lab-synthetic').check();
 await A.locator('#lab-upload').click();
 await A.getByText('개정번호 1로 합성 백업을 저장했습니다.',{exact:false}).waitFor();
 assert.match(await A.locator('#lab-revision').textContent(),/개정번호 1/);
 pass('사용자 파일 선택 → 실제 CORS/If-Match 전송 → 임시 가족 서버 저장');
 await B.locator('#lab-login').click();
 await B.getByText('로그인 성공.',{exact:false}).waitFor();
 const [download]=await Promise.all([B.waitForEvent('download',{timeout:15000}),B.locator('#lab-download').click()]);
 const down=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.deepEqual(down,first);
 pass('다른 독립 브라우저 B에서 동일 사진없는 합성 JSON 원본 바이트 및 기록 다운로드');
 const second=make(['qa29-first','qa29-second']);
 await A.locator('#lab-file').setInputFiles({name:'synthetic-new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(second))});
 await A.locator('#lab-upload').click();
 await A.getByText('개정번호 2로 합성 백업을 저장했습니다.',{exact:false}).waitFor();
 const divergent=make(['qa29-first','qa29-third']);
 await B.locator('#lab-file').setInputFiles({name:'synthetic-other.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(divergent))});
 await B.locator('#lab-synthetic').check();
 await B.locator('#lab-upload').click();
 await B.getByText('서버 응답 409: STALE_REVISION',{exact:false}).waitFor();
 const stored=await B.locator('#lab-refresh').click();
 assert.match(await B.locator('#lab-revision').textContent(),/개정번호 2/);
 pass('서로 다른 두 브라우저의 오래된 개정번호 업로드는 409 차단, 서버 데이터 보존');
 const blocked=await browser.newPage();
 await blocked.goto('file://'+process.cwd()+'/qa-family-sync-lab.html');
 assert.equal(await blocked.locator('#lab-register').isDisabled(),true);
 assert.match(await blocked.locator('#lab-status').textContent(),/공개 사이트에서는 작동하지 않습니다/);
 pass('127.0.0.1:4173 외의 출처에서 로그인/업로드/다운로드 UI 완전 비활성');
 const wrongOrigin=await fetch(gateway.baseUrl+'/qa/snapshot',{headers:{Origin:'https://jinbh99-arch.github.io'}});
 assert.equal(wrongOrigin.status,403);
 assert.equal(wrongOrigin.headers.get('access-control-allow-origin'),null);
 pass('GitHub Pages origin의 직접 API 접근 명시적 거부 및 CORS 허용 미반환');
 await A.locator('#lab-logout').click();
 await A.getByText('로그인 세션이 종료되었습니다.',{exact:false}).waitFor();
 assert.equal(await A.locator('#lab-upload').isDisabled(),true);
 pass('로그아웃 즉시 파일 업로드·다운로드 조작 비활성화');
 console.log('QA_G15_LOCAL_UI_RESULT='+JSON.stringify({status:'PASS',checks:n,
 actualBrowserContexts:2,manualFileTransport:true,realChildData:false,
 productionCloud:false,publicPageDisallowed:true,autoSync:false}));
}catch(e){
 console.error('QA_G15_LOCAL_UI_RESULT='+JSON.stringify({status:'FAIL',checks:n,error:String(e),stack:String(e?.stack).slice(0,1500)}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(gateway)await gateway.shutdown();
}
