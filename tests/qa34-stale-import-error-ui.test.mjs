import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the real product wrapper, not a duplicate implementation.
// This new boundary only tests late error UI after a family revocation.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf("const v18OriginalRestore=$('import-file').onchange;");
const end=html.indexOf("// ===== v1.9: isolated IndexedDB",start);
assert.ok(start>0&&end>start,'real import wrapper must exist');
const source=html.slice(start,end);
function deferred(){let reject,resolve;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(){
 const gate=deferred(),file={value:'old-family-file',files:[{size:20,text:()=>gate.promise}]};
 const result={textContent:'new family verification status'};
 const elements={'import-file':file,'v18-verify-result':result};
 const local=new Map([['qa34-synthetic-local-session-revoke-v1','family-A']]);
 const notifications=[];
 const context={
  $:id=>elements[id],location:{origin:'http://127.0.0.1:4173'},
  localStorage:{getItem:key=>local.get(key)||''},
  V07_BACKUP_LIMIT:30*1024*1024,
  v18CheckBackup:async()=>({count:1,photoCount:1,check:'OK'}),
  v215ValidateRestoreReadiness:()=>{},v19Drill:async()=>({count:1,pics:1}),
  notify:message=>notifications.push(message),console
 };
 // An original import should never be called after an expired session.
 let originalCalls=0;
 file.onchange=()=>{originalCalls++};
 vm.runInNewContext(source,context,{timeout:1000});
 return {file,result,gate,local,notifications,originalCalls:()=>originalCalls};
}
test('old family delayed JSON parse error cannot erase new family file or status',async()=>{
 const x=fixture(),p=x.file.onchange({target:x.file});
 x.local.set('qa34-synthetic-local-session-revoke-v1','family-B');
 x.file.value='new-family-file';
 x.gate.resolve('{broken');
 await p;
 assert.equal(x.file.value,'new-family-file');
 assert.equal(x.result.textContent,'new family verification status');
 assert.equal(x.notifications.length,0);
 assert.equal(x.originalCalls(),0);
});
test('old family late integrity rejection cannot touch new family UI',async()=>{
 const x=fixture(),p=x.file.onchange({target:x.file});
 x.local.set('qa34-synthetic-local-session-revoke-v1','family-B');
 x.file.value='new-family-file';
 x.gate.reject(Error('stale photo checksum failed'));
 await p;
 assert.equal(x.file.value,'new-family-file');
 assert.equal(x.result.textContent,'new family verification status');
 assert.equal(x.notifications.length,0);
 assert.equal(x.originalCalls(),0);
});
test('current session malformed import still shows error and clears only its file',async()=>{
 const x=fixture(),p=x.file.onchange({target:x.file});
 x.gate.resolve('{broken');
 await p;
 assert.equal(x.file.value,'');
 assert.match(x.result.textContent,/복원 전 검사에서 차단/);
 assert.equal(x.notifications.length,1);
 assert.equal(x.originalCalls(),0);
});
test('revocation after successful parsing but before drill completion cannot invoke restore',async()=>{
 const x=fixture(),p=x.file.onchange({target:x.file});
 x.local.set('qa34-synthetic-local-session-revoke-v1','family-B');
 x.file.value='new-family-file';
 x.gate.resolve(JSON.stringify({format:'uriaimath-offline-backup-v02',records:[]}));
 await p;
 assert.equal(x.originalCalls(),0);
 assert.equal(x.file.value,'new-family-file');
 assert.equal(x.result.textContent,'new family verification status');
});
