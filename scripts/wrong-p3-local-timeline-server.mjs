// WRONG-P3 isolated localhost-only SYNTHETIC family demo.
// NOT the A v1.4 app; NOT a real Supabase/IdP/browser login; no public listener.
// Real data path: QA44 verified getUser -> B2 childAppend -> B3 guardianObserve
// -> B4 guardianRetryTimeline; only synthetic stage records are accepted.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {signSynthetic} from './qa-family-merge-preflight.mjs';

const demoOnly=()=>{
 if(process.env.QA44_STAGE_ONLY!=='1'||
  process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1'||
  process.env.QA44_SYNTHETIC_GUARDIAN_OBS_ONLY!=='1'||
  process.env.WRONG_P3_SYNTHETIC_LOCAL_ONLY!=='1')
  throw Error('P3_SYNTHETIC_LOOPBACK_ONLY');
};
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const allowedRecords=/^[A-Za-z0-9_-]{1,100}$/;
const noCache={'cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-frame-options':'DENY',
 'cross-origin-resource-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()'};
const pageHeaders={...noCache,
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const fail=(code,message)=>Object.assign(Error(message||code),{code});
const send=(res,status,data,headers={})=>{
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',...noCache,...headers});
 res.end(JSON.stringify(data));
};
const body=async req=>{
 let raw='',bytes=0;
 for await(const part of req){
  bytes+=part.length;
  if(bytes>4096)throw fail('BODY_TOO_LARGE');
  raw+=part.toString('utf8');
 }
 let doc;try{doc=JSON.parse(raw)}catch{throw fail('JSON_REQUIRED')}
 if(!doc||typeof doc!=='object'||Array.isArray(doc))throw fail('INVALID_BODY');
 return doc;
};
const exact=(doc,keys)=>{
 const set=new Set(keys);
 if(Object.keys(doc).some(k=>!set.has(k))||keys.some(k=>!(k in doc)))
  throw fail('UNEXPECTED_FIELDS');
};
function getCookie(header){
 const match=String(header||'').match(/(?:^|;\s*)wrong_p3_demo_session=([a-f0-9]{48})(?:;|$)/);
 return match?.[1]||'';
}
function sanitizeTimeline(value){
 if(value===null)return null;
 return {
  ...value,
  // Do not send synthetic user UUIDs. Server retains the B2 ID for writes.
  attempts:value.attempts.map(a=>({
   attemptId:a.attemptId,answer:a.answer,explanation:a.explanation,
   at:a.at,revision:a.revision,observations:a.observations
  }))
 };
}
/** Start one local QA server. sessions Map: random 48-char cookie -> {token,family,role,recordId}.
 * auth tokens remain server-only. Roles are declared SYNTHETIC by the harness;
 * B2/B3/B4 independently revalidate token/user membership on EVERY call.
 */
export async function startWrongP3SyntheticLocalServer({guardianStore,childStore,sessions,port=0}={}){
 demoOnly();
 if(!guardianStore||!childStore||!(sessions instanceof Map))
  throw fail('SYNTHETIC_SERVER_DEPENDENCIES_MISSING');
 for(const [sid,identity] of sessions){
  if(!/^[a-f0-9]{48}$/.test(sid)||
   !['guardian','child'].includes(identity?.role)||
   !allowedRecords.test(identity?.recordId||'')||
   typeof identity?.token!=='string'||typeof identity?.family!=='string')
   throw fail('SYNTHETIC_SESSION_INVALID');
 }
 const server=createServer(async(req,res)=>{
  const remote=req.socket.remoteAddress;
  const host=String(req.headers.host||'');
  // Refuse DNS rebinding, non-loopback access and arbitrary origin.
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(remote)||
   host!==`127.0.0.1:${server.address()?.port}`){
   return send(res,403,{error:'LOCAL_HOST_ONLY'});
  }
  const origin=`http://127.0.0.1:${server.address().port}`;
  if(!['GET','POST'].includes(req.method))
   return send(res,405,{error:'METHOD_NOT_ALLOWED'});
  const url=new URL(req.url,origin),pathname=url.pathname;
  const session=sessions.get(getCookie(req.headers.cookie));
  if(!session)return send(res,401,{error:'SYNTHETIC_SESSION_REQUIRED'});
  if(req.method==='POST'&&(
   req.headers.origin!==origin||
   req.headers['x-wrong-p3-action']!=='synthetic-only'||
   !String(req.headers['content-type']||'').startsWith('application/json')
  ))return send(res,403,{error:'LOCAL_CSRF_BLOCKED'});
  const role=required=>{
   if(session.role!==required)throw fail('ROLE_DENIED');
  };
  const scope=()=>{
   if(url.searchParams.has('family')&&url.searchParams.get('family')!==session.family)
    throw fail('FAMILY_SCOPE_DENIED');
   if(url.searchParams.has('record')&&url.searchParams.get('record')!==session.recordId)
    throw fail('RECORD_SCOPE_DENIED');
  };
  try{
   if(req.method==='GET'&&pathname==='/qa-p3'){
    res.writeHead(302,{location:session.role==='guardian'?'/qa-p3/parent':'/qa-p3/child',...noCache});res.end();return;
   }
   if(req.method==='GET'&&['/qa-p3/parent','/qa-p3/child'].includes(pathname)){
    role(pathname.endsWith('parent')?'guardian':'child');
    const data=await readFile(new URL('./wrong-p3-local-timeline.html',import.meta.url));
    res.writeHead(200,{'content-type':'text/html; charset=utf-8',...pageHeaders});res.end(data);return;
   }
   if(req.method==='GET'&&['/qa-p3/wrong-p3-local-timeline.js','/qa-p3/wrong-p3-local-timeline.css'].includes(pathname)){
    const file=pathname.endsWith('.js')?'./wrong-p3-local-timeline.js':'./wrong-p3-local-timeline.css';
    res.writeHead(200,{'content-type':file.endsWith('js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8',...pageHeaders});
    res.end(await readFile(new URL(file,import.meta.url)));return;
   }
   if(!pathname.startsWith('/qa-p3/api/'))return send(res,404,{error:'NOT_FOUND'});
   scope();
   if(req.method==='GET'&&pathname==='/qa-p3/api/parent/status'){
    role('guardian');
    const result=await guardianStore.read(session.token,session.family);
    if(!result)return send(res,403,{error:'FAMILY_NOT_ACCESSIBLE'});
    const record=result.snapshot?.records?.find(x=>x.id===session.recordId)||null;
    return send(res,200,{registered:!!record,revision:result.revision,
     record:record?{id:record.id,problemText:record.problemText,subject:record.subject,hasPhoto:record.hasPhoto}:null});
   }
   if(req.method==='POST'&&pathname==='/qa-p3/api/parent/register'){
    role('guardian');
    const request=await body(req);exact(request,['problemText']);
    const problemText=String(request.problemText||'').trim();
    if(!problemText||problemText.length>240)throw fail('INVALID_PROBLEM_TEXT');
    const before=await guardianStore.read(session.token,session.family);
    if(!before||before.revision!==0||before.snapshot!==null)
     throw fail('ALREADY_REGISTERED_OR_STALE');
    // Synthetic fixture: 1px PNG, not a real child's image or OCR.
    const record={id:session.recordId,subject:'korean',gradeAtEntry:3,
     problemText,hasPhoto:true,memo:'가상 부모 비공개 메모',
     studentAnswer:'가상 최초 오답',generalRetryHistory:[],
     checkHistory:[],practiceHistory:[]};
    const doc=signSynthetic({format:'uriaimath-offline-backup-v02',
     profile:{nickname:'QA-P3-가상가족',grade:3},
     records:[record],photos:{[record.id]:PNG},
     backupSummary:{recordCount:1,photoCount:1}});
    const saved=await guardianStore.put(session.token,session.family,0,doc);
    return send(res,201,{registered:true,recordId:record.id,revision:saved.revision});
   }
   if(req.method==='GET'&&pathname==='/qa-p3/api/child/question'){
    role('child');
    const value=await childStore.childRead(session.token,session.family,session.recordId);
    if(!value)return send(res,404,{error:'CHILD_RECORD_NOT_ACCESSIBLE'});
    // Never expose the image data URI in QA browser: just hasPhoto flag.
    return send(res,200,{revision:value.revision,record:{
     id:value.record.id,subject:value.record.subject,
     problemText:value.record.problemText,hasPhoto:value.record.hasPhoto},
     ownAttempts:value.ownAttempts.map(a=>({at:a.at,answer:a.answer,explanation:a.explanation}))});
   }
   if(req.method==='POST'&&pathname==='/qa-p3/api/child/retry'){
    role('child');
    const request=await body(req);
    exact(request,['expectedRevision','requestId','answer','explanation']);
    const saved=await childStore.childAppend(session.token,session.family,session.recordId,
     request.expectedRevision,request.requestId,
     {answer:request.answer,explanation:request.explanation});
    return send(res,200,saved);
   }
   if(req.method==='GET'&&pathname==='/qa-p3/api/parent/timeline'){
    role('guardian');
    const view=await guardianStore.guardianRetryTimeline(session.token,session.family,session.recordId);
    if(!view)return send(res,404,{error:'GUARDIAN_RECORD_NOT_ACCESSIBLE'});
    return send(res,200,sanitizeTimeline(view));
   }
   if(req.method==='POST'&&pathname==='/qa-p3/api/parent/observe'){
    role('guardian');
    const request=await body(req);
    exact(request,['attemptId','expectedRevision','requestId','status','note']);
    const view=await guardianStore.guardianRetryTimeline(session.token,session.family,session.recordId);
    if(!view)throw fail('GUARDIAN_RECORD_NOT_ACCESSIBLE');
    const target=view.attempts.find(x=>x.attemptId===request.attemptId);
    if(!target)throw fail('CHILD_ATTEMPT_NOT_ACCESSIBLE');
    const saved=await guardianStore.guardianObserve(
     session.token,session.family,session.recordId,target.childUserId,
     target.attemptId,request.expectedRevision,request.requestId,
     {status:request.status,note:request.note});
    return send(res,200,saved);
   }
   return send(res,404,{error:'NOT_FOUND'});
  }catch(e){
   const code=e?.code||'LOCAL_REQUEST_FAILED';
   const denied=/DENIED|ACCESSIBLE|REQUIRED|SCOPE|CHILD_ATTEMPT|INVALID_OBSERVATION/.test(code);
   const stale=/STALE|CONFLICT|REUSED|ALREADY_REGISTERED/.test(code);
   return send(res,denied?403:stale?409:400,{error:code});
  }
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,'127.0.0.1',resolve);
 });
 const origin=`http://127.0.0.1:${server.address().port}`;
 return Object.freeze({server,origin,
  close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))});
}
