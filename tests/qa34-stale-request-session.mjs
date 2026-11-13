// Focused executable race: stale synthetic gateway 401 must not clear a new
// family session, and its delayed failure must not overwrite new UI status.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../scripts/qa-inapp-sync-bridge.mjs',import.meta.url),'utf8');
const extract=(start,end)=>{const i=src.indexOf(start),j=src.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'missing code boundary '+start);return src.slice(i,j)};
const requestCode=extract('  async function request(', '\n  async function perform(');
const performCode=extract('  async function perform(', '\n  // Capture the active synthetic identity');
const events=[],deferred=[];
const elements=new Map();
const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,
 setAttribute(){}});return elements.get(id)};
$('qa34-port').value='4174';
const store=new Map(),localStorage={getItem:k=>store.get(k)||'',setItem:(k,v)=>store.set(k,v)};
let token='token-A',activeFamily='qa-a',server='http://127.0.0.1:4174',revision=1,busy=false;
const REVOKE_KEY='qa34-synthetic-local-session-revoke-v1';
function state(){$('qa34-upload').disabled=busy||!token||revision===null}
function clearSession(){token='';activeFamily='';revision=null;events.push('clear')}
function lockLocalView(){events.push('lock')}
function broadcastLock(){events.push('broadcast')}
function status(s){events.push('status:'+s)}
const fetch=(url,options)=>new Promise(resolve=>deferred.push({url,options,resolve}));
const context=vm.createContext({$,localStorage,REVOKE_KEY,AbortController,setTimeout,clearTimeout,
 fetch,Error,TypeError,JSON,Number,RegExp,events,state,clearSession,lockLocalView,broadcastLock,status,
 get token(){return token},set token(v){token=v},
 get activeFamily(){return activeFamily},set activeFamily(v){activeFamily=v},
 get server(){return server},set server(v){server=v},
 get revision(){return revision},set revision(v){revision=v},
 get busy(){return busy},set busy(v){busy=v}});
vm.runInContext('function address(){return "http://127.0.0.1:4174"}\n'+requestCode+'\n'+performCode,context);
let checks=0;const pass=s=>{checks++;console.log('PASS WRONG STALE REQUEST '+s)};
const reply=(entry,status)=>entry.resolve({ok:status===200,status,json:async()=>({error:'old token expired'})});
const old=context.request('/qa/snapshot');
assert.equal(deferred.length,1);assert.equal(deferred[0].options.headers.Authorization,'Bearer token-A');
token='token-B';activeFamily='qa-b';revision=3;
reply(deferred.shift(),401);
await assert.rejects(old,/401/);
assert.deepEqual(events,[]);
assert.equal(token,'token-B');assert.equal(revision,3);
pass('A delayed 401 after B login: B credentials/revision/view untouched');
const current=context.request('/qa/snapshot');reply(deferred.shift(),401);
await assert.rejects(current,/401/);
assert.deepEqual(events.slice(-3),['clear','lock','broadcast']);
assert.equal(token,'');
pass('current family 401 still fails closed and locks all synthetic tabs');
events.length=0;token='token-C';activeFamily='qa-c';revision=5;
const oldError=context.perform(async()=>{await new Promise(resolve=>deferred.push({resolve}));throw Error('old A failure')});
assert.equal(busy,true);
token='token-D';activeFamily='qa-d';revision=6;
deferred.shift().resolve();
await oldError;
assert.equal(events.filter(x=>x.startsWith('status:')).length,0);
assert.equal(token,'token-D');
pass('old async failure does not replace new family status');
const newError=context.perform(async()=>{throw Error('current failure')});
await newError;
assert.ok(events.some(x=>x.includes('current failure')));
pass('current async failure still shows an actionable error');
const before=events.length;
token='token-E';activeFamily='qa-e';revision=7;
const old401=context.request('/qa/snapshot');
localStorage.setItem(REVOKE_KEY,'logout-epoch-1');
reply(deferred.shift(),401);
await assert.rejects(old401,/401/);
assert.equal(events.length,before);
assert.equal(token,'token-E');
pass('cross-tab revoke epoch invalidates delayed 401 without affecting new login');
console.log('WRONG_STALE_REQUEST_RESULT='+JSON.stringify({status:'PASS',checks,
 realFamilies:0,syntheticOnly:true,safeToRestore:false,productionAuth:false}));
