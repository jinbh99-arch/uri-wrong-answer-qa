// WRONG A-03-5: dev-vs-candidate STATIC scope and reverse-patch acceptance.
// Node built-in only, no browser, child data, DB, server, app writes or deployment.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
const base='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const path='index.html';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const current=readFileSync(path,'utf8');
const original=git('show',base+':'+path);
const sha=git('rev-parse','HEAD').trim();
const refbase=git('merge-base',base,'HEAD').trim();
const names=git('diff','--name-only',base,'HEAD').trim().split('\n').filter(Boolean);
const product=names.filter(x=>/^(index\.html|src\/|public\/|app\/|data\/)/.test(x));
const stats=git('diff','--numstat',base,'HEAD','--',path).trim().split('\t');
const patch=git('diff','--no-ext-diff','--unified=2',base,'HEAD','--',path);
const reverse=spawnSync('git',['apply','--reverse','--check','-'],{input:patch,encoding:'utf8'});
const checks=[];
const check=(label,fn)=>{fn();checks.push(label);console.log('WRONG_A035_PASS '+checks.length+' '+label)};
const between=(txt,a,b)=>{let i=txt.indexOf(a),j=txt.indexOf(b,i+1);assert.ok(i>=0&&j>i);return txt.slice(i,j)};
let hunk=(patch.match(/^@@/gm)||[]).length;
check('HEAD descends directly from pinned dev',()=>assert.equal(refbase,base));
check('exactly one changed product source index.html',()=>assert.deepEqual(product,[path]));
check('product index lines +56/-8 only',()=>{assert.equal(Number(stats[0]),56);assert.equal(Number(stats[1]),8)});
check('all data-write CAS logic unchanged',()=>assert.equal(
 between(original,'function v20SaveMistakeGuarded','function v20RemoveMistakeGuarded'),
 between(current,'function v20SaveMistakeGuarded','function v20RemoveMistakeGuarded')));
check('IDB restoreState original validation/reading unchanged',()=>assert.equal(
 between(original,'async function restoreState()','// v2.19'),
 between(current,'async function restoreState()','// v2.19')));
check('first-create uncertain guard and no unconditional success',()=>{
 assert.ok(current.includes("if(transactionDone&&!old){"));
 assert.ok(current.includes("wrongA03UnknownCreateId=id;"));
 assert.ok(current.includes("if(!editId&&wrongA03UnknownCreateId){"));
 assert.ok(current.includes("'save-btn').disabled=true"));
 assert.ok(current.includes('저장 확인 필요'));
 assert.ok(!original.includes('wrongA03UnknownCreateId'));
});
check('records path read-only after uncertain first registration only',()=>{
 const nav=between(current,'function navigate(next)','function list(container');
 assert.ok(nav.includes("if(wrongA03UnknownCreateId){"));
 assert.ok(nav.includes('restoreState().then('));
 assert.ok(nav.includes("if(route==='records')renderRecords()"));
 assert.ok(!nav.includes('v20SaveMistakeGuarded('));
 assert.ok(!nav.includes('saveMistake('));
});
check('candidate reverse patch applies cleanly without changing tree',()=>{
 assert.equal(reverse.status,0,reverse.stderr||reverse.stdout);
 assert.equal(readFileSync(path,'utf8'),current);
});
const risks={
 photoConversionOutsideProtectedTry:current.includes("wrongA03SaveBusy=true;const id=")&&current.includes('blob=image?await photoBlob():null;'),
 freshAddRouteResetsUnknownId:current.includes('function renderAdd(){wrongA03SaveBusy=false;wrongA03UnknownCreateId=null;'),
 navigationRefreshIsAsync:current.includes('restoreState().then(()=>'),
 realMultiTabGlobalDedupNotImplemented:true
};
check('precommit exception and fresh-add route caveats explicitly identified',()=>{
 assert.equal(risks.photoConversionOutsideProtectedTry,true);
 assert.equal(risks.freshAddRouteResetsUnknownId,true);
});
const result={
 status:'PASS',kind:'static-only-NOT-browser-QA',devSha:base,qaHead:sha,
 checks:checks.length,checkNames:checks,hunks:hunk,additions:Number(stats[0]),
 deletions:Number(stats[1]),changedProductFiles:product,otherChanges:names.filter(x=>!product.includes(x)),
 reversePatchCheck:'PASS-read-only-no-files-changed',newRisksNotResolved:risks,
 mergerAuthorized:false,productionSourceChanged:false,safeToRestore:false,
 noPriorChromiumOrOlderQARerun:true,
 next:'00/Jin decision after acceptance of unresolved photo conversion and navigation caveats'
};
mkdirSync('qa-proof/wrong-a03-5',{recursive:true});
writeFileSync('qa-proof/wrong-a03-5/static-diff-and-rollback.json',JSON.stringify(result,null,2));
console.log('WRONG_A035_RESULT='+JSON.stringify(result));
