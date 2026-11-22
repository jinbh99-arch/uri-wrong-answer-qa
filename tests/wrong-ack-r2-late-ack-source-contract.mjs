// 02 WRONG / 00T-02-ACK-CORE: new r1->r2 + stale ACK combined edge.
// Exercises the ORIGINAL isolated QA app's v20SaveMistakeGuarded, extracted
// byte-for-byte from index.html. Fake IndexedDB transaction is synthetic.
// This is NOT product UI / actual IndexedDB / HTTP / family authorization PASS.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const APP_BLOB='63e31915875a79a2ebcf21d7c722daa9f8deeb98';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gitBlob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(gitBlob(html),APP_BLOB,'test pin changed: inspect QA source before rerun');
const start=html.indexOf(' function v20SaveMistakeGuarded(');
const end=html.indexOf(' function v20RemoveMistakeGuarded(',start);
assert.ok(start>=0&&end>start,'original guarded-save function not found');
const source=html.slice(start,end);
const tick=fn=>Promise.resolve().then(fn);

function syntheticIdb(records,photobytes){
 const rows=new Map(records.map(r=>[r.id,structuredClone(r)]));
 const photos=new Map(photobytes);
 const counters={reads:0,puts:0,commits:0,aborts:0};
 const db={transaction(){
  const rs=new Map(rows),ps=new Map(photos);
  let pending=0,aborted=false,completed=false;
  const finish=()=>{
   if(pending||aborted||completed)return;
   completed=true;
   tick(()=>{
    if(aborted)return;
    rows.clear();for(const [k,v] of rs)rows.set(k,v);
    photos.clear();for(const [k,v] of ps)photos.set(k,v);
    counters.commits++;
    tx.oncomplete?.();
   });
  };
  const tx={oncomplete:null,onabort:null,onerror:null,
   abort(){if(aborted)return;aborted=true;counters.aborts++;tick(()=>tx.onabort?.())},
   objectStore(name){
    const map=name==='mistakes'?rs:ps;
    return {
     get(key){
      counters.reads++;pending++;
      const q={result:null,onsuccess:null};
      tick(()=>{q.result=map.get(key);q.onsuccess?.();pending--;finish()});
      return q;
     },
     count(){
      pending++;const q={result:null,onsuccess:null};
      tick(()=>{q.result=map.size;q.onsuccess?.();pending--;finish()});
      return q;
     },
     put(value,key){counters.puts++;map.set(key,value)},
     delete(key){map.delete(key)}
    };
   }
  };
  return tx;
 }};
 return {db,rows,photos,counters};
}

const original={
 id:'qa-parent-edit-ack-r1',subject:'science',
 problemText:'r1 virtual problem',memo:'parent only',revision:1,
 approvedRevision:1,hasPhoto:true
};
const photo=Buffer.from('SYNTHETIC_PHOTO_ORIGINAL_BYTES_ONLY');
const env=syntheticIdb([original],[[original.id,photo]]);
let announceCount=0;
const stale=()=>Object.assign(new Error('stale synthetic CAS'),{code:'V20_STALE'});
const guardedSave=Function(
 'db','MAX_RECORDS','v20AnnounceWrite','v20StaleError',
 'return ('+source+');'
)(env.db,500,()=>{announceCount++},stale);

const tests=[];
const edited={...original,problemText:'r2 parent corrected problem',
 revision:2,approvedRevision:null};
await guardedSave(edited,null,false,JSON.stringify(original));
assert.deepEqual(env.rows.get(original.id),edited);
tests.push('actual guarded-save commits r2 with expected r1 snapshot');

let staleStatus='UNEXPECTED_SUCCESS';
try{
 await guardedSave({...original,problemText:'late r1 ACK payload'},null,
  false,JSON.stringify(original));
}catch(err){staleStatus=err.code}
assert.equal(staleStatus,'V20_STALE');
assert.deepEqual(env.rows.get(original.id),edited);
tests.push('actual guarded-save rejects late stale r1 after r2 commit');

assert.deepEqual(env.photos.get(original.id),photo);
assert.equal(env.counters.puts,1);
assert.equal(env.counters.commits,1);
assert.equal(env.counters.aborts,1);
tests.push('synthetic original photo bytes unchanged and stale replay writes zero');

const submit=html.slice(html.indexOf('let wrongAckBusy=false'),
 html.indexOf("$('cancel-edit').onclick",html.indexOf('let wrongAckBusy=false')));
assert.ok(submit.includes('wrongAckBusy||wrongAckUnknown'));
const gaps={
 noExplicitRecordApprovalRevision:!html.includes('approvedRevision')&&!html.includes('approvalRevision'),
 noRequestId:!html.includes('requestId')&&!html.includes('request_id'),
 noAutomaticUnknownLedgerReadback:!submit.includes('if(wrongAckUnknown){await')&&
  !submit.includes('wrongAckUnknown&&await'),
 postCommitWarningOnly:submit.includes('transactionDone=true')&&
  submit.includes('if(transactionDone)wrongAckUnknown=true')
};
console.log('WRONG_R2_LATE_ACK_CONTRACT='+JSON.stringify({
 status:'PARTIAL_SOURCE_GUARD_PASS_PRODUCT_COMBINED_CONTRACT_GAP',
 checks:tests.length,tests,sourceBlob:APP_BLOB,sourceFunction:'v20SaveMistakeGuarded',
 ...env.counters,announceCount,gaps,
 revisionApprovalInvalidation:'FIXTURE_ONLY_NOT_APPLICATION_IMPLEMENTATION',
 requestIdAndHttpPost:'NOT_IMPLEMENTED_IN_LOCAL_IDB_FORM',
 realIndexedDB:'N/T',realBrowser:'N/T',realFamilyAuthorization:'N/T',
 synthetic:true,safeToRestore:false,devMainModified:false,deploy:false
}));
