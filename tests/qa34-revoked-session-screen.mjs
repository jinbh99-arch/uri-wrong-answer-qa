// New boundary only: a server-revoked synthetic session must lock the same-browser app.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
const FAMILY='qa-revoked-house',OLD='QA-REVOKED-SYNTHETIC-OLD-2026',NEW='QA-REVOKED-SYNTHETIC-NEW-2026';
let gate,browser,checks=0;
const pass=x=>{checks++;console.log('PASS REVOKED SCREEN '+x)};
async function api(path,method='GET',body,token,revision){
 const headers={};if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 if(revision!==undefined)headers['if-match']='"'+revision+'"';
 const r=await fetch(gate.baseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
}
async function snapshot(p){return p.evaluate(async()=>{
 const q=indexedDB.open('uriaimath-github-qa-v224-only');
 const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 try{const tx=db.transaction(['mistakes','photos'],'readonly');
 const get=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 const [rows,keys,blobs]=await Promise.all([get(tx.objectStore('mistakes').getAll()),get(tx.objectStore('photos').getAllKeys()),get(tx.objectStore('photos').getAll())]);
 return {rows,photos:await Promise.all(keys.map(async(id,i)=>({id,bytes:Array.from(new Uint8Array(await blobs[i].arrayBuffer()))})))};
 }finally{db.close()}
})}
try{
 process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
 gate=await createIsolatedQaFamilyGateway();
 assert.equal((await api('/qa/register','POST',{familyKey:FAMILY,password:OLD})).status,201);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:320,height:740}});
 const p=await context.newPage();await p.goto('http://127.0.0.1:4173/');
 await p.locator('#nav-settings').click();await p.locator('#qa34-sync-bridge:visible').waitFor();
 const port=new URL(gate.baseUrl).port;
 await p.locator('#qa34-port').fill(port);await p.locator('#qa34-family').fill(FAMILY);
 await p.locator('#qa34-password').fill(OLD);await p.locator('#qa34-login').click();
 await p.getByText('가상 가족 로그인 완료.',{exact:false}).waitFor();
 await p.locator('#nav-add').click();await p.locator('#problem').fill('가상 만료 세션의 오답');
 await p.locator('#save-btn').click();await p.locator('#v09-save-confirm:not(.hide)').waitFor();
 const before=await snapshot(p);assert.equal(before.rows.length,1);
 pass('가상 가족 A가 실제 오답노트에 합성 기록 저장');
 const remote=await api('/qa/login','POST',{familyKey:FAMILY,password:OLD});
 assert.equal(remote.status,200);
 const rotated=await api('/qa/password','POST',{familyKey:FAMILY,oldPassword:OLD,newPassword:NEW,confirmation:'ROTATE_SYNTHETIC_PASSWORD',approved:true},remote.data.token,0);
 assert.equal(rotated.status,200);
 pass('별도 가상 기기에서 비밀번호 교체 후 기존 세션 서버 폐기');
 await p.locator('#nav-settings').click();await p.locator('#qa34-pull').click();
 await p.locator('#qa34-family-privacy-cover:visible').waitFor({timeout:15000});
 assert.equal(await p.locator('#qa-main').evaluate(el=>el.inert),true);
 assert.deepEqual(await snapshot(p),before);
 pass('401 즉시 로컬 오답 화면 잠금, 저장된 오답 불변');
 await p.reload();await p.locator('#qa34-family-privacy-cover:visible').waitFor();
 await p.locator('#qa34-reenter-port').fill(port);
 await p.locator('#qa34-reenter-family').fill(FAMILY);
 await p.locator('#qa34-reenter-password').fill(OLD);
 await p.locator('#qa34-family-reenter button').click();
 await p.waitForFunction(()=>document.querySelector('#qa34-reenter-status')?.textContent?.includes('401'));
 assert.equal(await p.locator('#qa34-family-privacy-cover').isVisible(),true);
 assert.deepEqual(await snapshot(p),before);
 pass('폐기된 비밀번호로 잠금 해제 불가, 기록 불변');
 await p.locator('#qa34-reenter-password').fill(NEW);
 await p.locator('#qa34-family-reenter button').click();
 await p.waitForFunction(()=>!document.querySelector('#qa34-family-privacy-cover'));
 assert.deepEqual(await snapshot(p),before);
 pass('새 가상 비밀번호로만 같은 가족 복귀, 오답 원본 보존');
 console.log('WRONG_QA34_REVOKED_RESULT='+JSON.stringify({status:'PASS',checks,realChromium:true,syntheticOnly:true,safeToRestore:false}));
 await context.close();
}catch(e){console.error('WRONG_QA34_REVOKED_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1000),safeToRestore:false}));process.exitCode=1}
finally{if(browser)await browser.close();if(gate)await gate.shutdown()}
