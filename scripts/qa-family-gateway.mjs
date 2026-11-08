// QA25 — Synthetic family account/snapshot flow exclusively on 127.0.0.1.
// In-memory, no persistence, no cloud, no HTTPS, no real users, no production auth.
// NOT imported by index.html and not reachable from public GitHub Pages.
// Explicit QA_SYNTHETIC_FAMILY_ONLY=1 guard prevents accidental use.
import {createServer} from 'node:http';
import {randomBytes,scryptSync,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,readFileSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,sep} from 'node:path';
import {checkBackup,previewMerge,SyncPreflightError} from './qa-family-merge-preflight.mjs';
import {previewThreeWay} from './qa-family-threeway.mjs';

const MAX_BODY=1024*1024;
function reply(res,status,payload,extra={}){
 res.writeHead(status,{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-qa-service':'non-production-loopback-only',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'", 
  ...extra
 });
 res.end(JSON.stringify(payload));
}
function reject(status,reason){return {status,reason}}
async function jsonBody(req){
 const chunks=[];let length=0;
 for await(const chunk of req){
  length+=chunk.length;
  if(length>MAX_BODY)throw reject(413,'SIZE_LIMIT');
  chunks.push(chunk);
 }
 if(!length)throw reject(400,'BODY_REQUIRED');
 try{
  const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('NOT_OBJECT');
  return obj;
 }catch{throw reject(400,'INVALID_JSON')}
}
function safePassword(password){
 return typeof password==='string'&&password.length>=16&&password.length<=160;
}
function hash(password,salt){
 return scryptSync(password,salt,32);
}
function isQaFamilyKey(key){
 return typeof key==='string'&&/^qa-[a-z0-9-]{4,32}$/.test(key);
}
// Optional restorable AES-GCM encrypted test data: only under OS temp directory.
const DURABLE_FORMAT='qa26-family-encrypted-v01';
function createTestStorage(options={}){
 if(options.durablePath===undefined){
  return {accounts:new Map(),loginAttempts:new Map(),persist:()=>{},durable:false};
 }
 if(process.env.QA_DURABLE_TEST_ONLY!=='1')
  throw Error('QA_ONLY: QA_DURABLE_TEST_ONLY=1 required for encrypted persistence');
 const base=resolve(tmpdir()),target=resolve(options.durablePath);
 if(!target.startsWith(base+sep)||target.endsWith(sep)||target===base)
  throw Error('QA_ONLY: storage path must be a file below OS temporary directory');
 if(typeof options.encryptionKey!=='string'||!/^[a-f0-9]{64}$/i.test(options.encryptionKey))
  throw Error('QA_ONLY: a fresh 32-byte AES key is required, never a user password');
 const key=Buffer.from(options.encryptionKey,'hex');
 function noLink(path){
  if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('QA_ONLY: symlink file rejected');
 }
 noLink(target);noLink(dirname(target));
 let accounts=new Map(),loginAttempts=new Map();
 if(existsSync(target)){
  const source=readFileSync(target);
  if(source.length>16*1024*1024)throw Error('QA_ONLY: encrypted store limit exceeded');
  const envelope=JSON.parse(source.toString('utf8'));
  if(envelope.format!==DURABLE_FORMAT)throw Error('QA_ONLY: unknown encrypted format');
  const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');
  const ciphertext=Buffer.from(envelope.ciphertext,'base64');
  if(iv.length!==12||tag.length!==16)throw Error('QA_ONLY: invalid authenticated envelope');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(DURABLE_FORMAT));decipher.setAuthTag(tag);
  // Wrong key or altered file rejects startup: never silently create a new empty family.
  const parsed=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
  if(!Array.isArray(parsed?.accounts)||parsed.accounts.length>100)throw Error('QA_ONLY: invalid account list');
  // QA36: retain encrypted per-family login backoff through a process restart.
  // Older encrypted fixtures (QA26-35) contain no loginAttempts: compatible.
  const savedAttempts=parsed.loginAttempts===undefined?[]:parsed.loginAttempts;
  if(!Array.isArray(savedAttempts)||savedAttempts.length>256)
   throw Error('QA_ONLY: invalid login limiter state');
  for(const pair of savedAttempts){
   if(!Array.isArray(pair)||pair.length!==2)throw Error('QA_ONLY: malformed login limiter item');
   const [familyKey,item]=pair;
   if(!isQaFamilyKey(familyKey)||loginAttempts.has(familyKey)||
      !Number.isSafeInteger(item?.count)||item.count<1||item.count>5||
      !Number.isSafeInteger(item?.lastFailedAt)||item.lastFailedAt<0||
      !Number.isSafeInteger(item?.blockedUntil)||item.blockedUntil<0)
    throw Error('QA_ONLY: invalid encrypted login limiter entry');
   loginAttempts.set(familyKey,item);
  }
  for(const e of parsed.accounts){
   if(!isQaFamilyKey(e?.familyKey)||accounts.has(e.familyKey))throw Error('QA_ONLY: bad family identity');
   const salt=Buffer.from(e.salt,'base64'),hashed=Buffer.from(e.hashed,'base64');
   if(salt.length!==16||hashed.length!==32||!Number.isSafeInteger(e.revision)||e.revision<0)
    throw Error('QA_ONLY: invalid account credential/revision');
   if(e.snapshot!==null)checkBackup(e.snapshot);
   const history=e.history===undefined?[]:e.history;
   if(!Array.isArray(history)||history.length>12)throw Error('QA_ONLY: invalid version history');
   for(const h of history){
    if(!Number.isSafeInteger(h?.revision)||h.revision<0||h.revision>=e.revision||!h.snapshot)
     throw Error('QA_ONLY: invalid historical revision');
    checkBackup(h.snapshot);
   }
   if(new Set(history.map(h=>h.revision)).size!==history.length)
    throw Error('QA_ONLY: duplicate history revision');
   accounts.set(e.familyKey,{salt,hashed,revision:e.revision,snapshot:e.snapshot,history});
  }
 }
 function persist(candidate,attempts=loginAttempts){
  if(attempts.size>256)throw Error('QA_ONLY: too many login limiter entries');
  const entries=Array.from(candidate,([familyKey,a])=>({
   familyKey,salt:a.salt.toString('base64'),hashed:a.hashed.toString('base64'),
   revision:a.revision,snapshot:a.snapshot,history:a.history||[]
  }));
  if(entries.length>100)throw Error('QA_ONLY: at most 100 synthetic families allowed');
  const payload=Buffer.from(JSON.stringify({
   accounts:entries,loginAttempts:[...attempts]
  }),'utf8');
  if(payload.length>12*1024*1024)throw Error('QA_ONLY: plaintext snapshot limit exceeded');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(DURABLE_FORMAT));
  const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
  const wrapper=JSON.stringify({
   format:DURABLE_FORMAT,iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')
  });
  const temp=target+'.'+randomBytes(8).toString('hex')+'.tmp';
  let descriptor;
  try{
   descriptor=openSync(temp,'wx',0o600);
   writeFileSync(descriptor,wrapper,'utf8');
   fsyncSync(descriptor);closeSync(descriptor);descriptor=undefined;
   noLink(target);
   renameSync(temp,target);
   chmodSync(target,0o600);
  }catch(e){
   if(descriptor!==undefined)closeSync(descriptor);
   try{unlinkSync(temp)}catch{}
   throw e;
  }
 }
 return {accounts,loginAttempts,persist,durable:true};
}
export async function createIsolatedQaFamilyGateway(options={}){
 if(process.env.QA_SYNTHETIC_FAMILY_ONLY!=='1')
  throw Error('QA_ONLY: explicit QA_SYNTHETIC_FAMILY_ONLY=1 required');
 const storage=createTestStorage(options),accounts=storage.accounts,tokens=new Map();
 // QA33: bounded synthetic login-attempt rate limiting and session exhaustion.
 // Still NOT secure hosting/authentication for actual families.
 const clock=typeof options.now==='function'?options.now:Date.now;
 const MAX_ATTEMPTS=5,LOCK_MS=60000,MAX_SESSIONS=5,MAX_TRACKED=256;
 const loginAttempts=storage.loginAttempts;
 const unknownSalt=randomBytes(16);
 function reap(){
  const now=clock();
  for(const [token,session] of tokens)if(session.expiresAt<=now)tokens.delete(token);
  for(const [key,item] of loginAttempts)
   if(item.blockedUntil<=now&&now-item.lastFailedAt>=LOCK_MS)loginAttempts.delete(key);
 }
 function loginGuard(familyKey){
  const now=clock(),failure=loginAttempts.get(familyKey);
  if(failure?.blockedUntil>now)throw reject(429,'LOGIN_RATE_LIMITED');
  // QA38: never evict an active lock to admit a new identifier.
  // At capacity, an unfamiliar key fails closed until an old entry expires.
  if(!failure&&loginAttempts.size>=MAX_TRACKED)
   throw reject(429,'LOGIN_TRACKING_CAPACITY');
 }
 function recordFailedLogin(familyKey){
  const now=clock(),old=loginAttempts.get(familyKey);
  const count=old&&now-old.lastFailedAt<LOCK_MS?old.count+1:1;
  const next=new Map(loginAttempts);
  if(!next.has(familyKey)&&next.size>=MAX_TRACKED)
   throw reject(429,'LOGIN_TRACKING_CAPACITY');
  next.set(familyKey,{count,lastFailedAt:now,
   blockedUntil:count>=MAX_ATTEMPTS?now+LOCK_MS:0});
  // Encrypted atomic write before mutating memory: restart must not reset
  // brute-force protection. A disk error does not silently forgive attempts.
  storage.persist(accounts,next);
  loginAttempts.clear();
  for(const [key,item] of next)loginAttempts.set(key,item);
 }
 const server=createServer(async(req,res)=>{
  try{
   reap();
   if(!req.socket.remoteAddress||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
    throw reject(403,'LOOPBACK_ONLY');
   // QA29: a dedicated local-only HTML client can contact this random loopback port.
   // Never accept an arbitrary Origin (including a public GitHub Pages origin).
   const origin=req.headers.origin;
   if(origin!==undefined){
    if(origin!=='http://127.0.0.1:4173')throw reject(403,'ORIGIN_NOT_ALLOWED');
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, If-Match');
    res.setHeader('Access-Control-Max-Age','0');
   }
   if(req.method==='OPTIONS'){
    if(origin!== 'http://127.0.0.1:4173')throw reject(403,'ORIGIN_NOT_ALLOWED');
    res.writeHead(204,{'cache-control':'no-store'});return res.end();
   }
   if(origin===undefined&&req.headers['sec-fetch-site']==='cross-site')throw reject(403,'CROSS_SITE_FORBIDDEN');
   if(req.url==='/qa/register'&&req.method==='POST'){
    const {familyKey,password}=await jsonBody(req);
    if(!isQaFamilyKey(familyKey)||!safePassword(password))throw reject(422,'SYNTHETIC_CREDENTIALS_ONLY');
    if(accounts.has(familyKey))throw reject(409,'ALREADY_REGISTERED');
    // Bound both ephemeral and encrypted QA account stores consistently.
    if(accounts.size>=100)throw reject(429,'SYNTHETIC_FAMILY_CAPACITY');
    const salt=randomBytes(16);
    const created={salt,hashed:hash(password,salt),revision:0,snapshot:null,history:[]};
    const candidate=new Map(accounts);candidate.set(familyKey,created);
    storage.persist(candidate);
    accounts.set(familyKey,created);
    return reply(res,201,{created:true,qaOnly:true,cloudReady:false});
   }
   if(req.url==='/qa/login'&&req.method==='POST'){
    const {familyKey,password}=await jsonBody(req);
    if(!isQaFamilyKey(familyKey)||!safePassword(password))throw reject(401,'CREDENTIALS_INVALID');
    loginGuard(familyKey);
    const acct=accounts.get(familyKey);
    // Do not short-circuit password hashing for unknown synthetic names.
    const digest=hash(password,acct?.salt||unknownSalt);
    if(!acct||!timingSafeEqual(acct.hashed,digest)){
     recordFailedLogin(familyKey);
     throw reject(401,'CREDENTIALS_INVALID');
    }
    if(loginAttempts.has(familyKey)){
     const next=new Map(loginAttempts);next.delete(familyKey);
     storage.persist(accounts,next);
     loginAttempts.delete(familyKey);
    }
    const count=[...tokens.values()].filter(x=>x.familyKey===familyKey).length;
    if(count>=MAX_SESSIONS)throw reject(429,'SESSION_LIMIT_REACHED');
    const token=randomBytes(32).toString('hex');
    tokens.set(token,{familyKey,expiresAt:clock()+600000});
    return reply(res,200,{token,expiresInSeconds:600,qaOnly:true,cloudReady:false});
   }
   if(req.url==='/qa/logout'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer==='string'&&bearer.startsWith('Bearer '))tokens.delete(bearer.slice(7));
    return reply(res,200,{loggedOut:true});
   }
   // QA31: delete only the current synthetic family. Logical deletion in the
   // encrypted QA store, NOT forensic erasure of filesystem snapshots/backups.
   // QA32: current-family password rotation. Uses the encrypted atomic store,
   // and invalidates EVERY session after successful persistence.
   // This is synthetic loopback QA only, not an account recovery service.
   if(req.url==='/qa/password'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const token=bearer.slice(7),session=tokens.get(token);
    if(!session||session.expiresAt<=clock())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct)throw reject(401,'SESSION_FAMILY_MISSING');
    const match=req.headers['if-match'];
    if(typeof match!=='string'||!/^"\d+"$/.test(match))
     throw reject(428,'IF_MATCH_REQUIRED');
    if(match!=='"'+acct.revision+'"')throw reject(409,'STALE_REVISION');
    const body=await jsonBody(req);
    if(body.confirmation!=='ROTATE_SYNTHETIC_PASSWORD'||body.approved!==true)
     throw reject(428,'PASSWORD_CHANGE_CONFIRMATION_REQUIRED');
    if(body.familyKey!==session.familyKey||
       !safePassword(body.oldPassword)||!safePassword(body.newPassword))
     throw reject(422,'SYNTHETIC_CREDENTIALS_ONLY');
    if(body.oldPassword===body.newPassword)
     throw reject(422,'PASSWORD_MUST_CHANGE');
    if(!timingSafeEqual(acct.hashed,hash(body.oldPassword,acct.salt)))
     throw reject(403,'CREDENTIALS_INVALID');
    const salt=randomBytes(16),hashed=hash(body.newPassword,salt);
    // If a second device changes the family after this request began,
    // refuse rather than reverting the state or reviving old credentials.
    const fresh=accounts.get(session.familyKey);
    if(!fresh||fresh!==acct||tokens.get(token)!==session||fresh.revision!==acct.revision
       ||session.expiresAt<=clock())
     throw reject(409,'STALE_OR_REVOKED_SESSION');
    const previous=fresh.snapshot?{revision:fresh.revision,snapshot:fresh.snapshot}:null;
    const saved={...fresh,salt,hashed,revision:fresh.revision+1,
      history:[...(fresh.history||[]),...(previous?[previous]:[])].slice(-12)};
    const candidate=new Map(accounts);candidate.set(session.familyKey,saved);
    storage.persist(candidate); // Failed persistence means password and sessions stay unchanged.
    accounts.set(session.familyKey,saved);
    for(const [sessionToken,entry] of tokens){
     if(entry.familyKey===session.familyKey)tokens.delete(sessionToken);
    }
    return reply(res,200,{rotated:true,sessionsRevoked:true,revision:saved.revision,
      qaOnly:true,cloudReady:false,productionPasswordRecovery:false},
      {etag:'"'+saved.revision+'"'});
   }
   if(req.url==='/qa/family'&&req.method==='DELETE'){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const token=bearer.slice(7),session=tokens.get(token);
    if(!session||session.expiresAt<=clock())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct)throw reject(401,'SESSION_FAMILY_MISSING');
    const match=req.headers['if-match'];
    if(typeof match!=='string'||!/^"\d+"$/.test(match))
     throw reject(428,'IF_MATCH_REQUIRED');
    if(match!=='"'+acct.revision+'"')throw reject(409,'STALE_REVISION');
    const body=await jsonBody(req);
    if(body.confirmation!=='DELETE_SYNTHETIC_FAMILY' || body.approved!==true)
     throw reject(428,'DELETE_CONFIRMATION_REQUIRED');
    if(body.familyKey!==session.familyKey||!safePassword(body.password))
     throw reject(403,'CREDENTIALS_INVALID');
    if(!timingSafeEqual(acct.hashed,hash(body.password,acct.salt)))
     throw reject(403,'CREDENTIALS_INVALID');
    // An older request body might finish after a parallel deletion or write:
    // compare session identity and current revision again before commit.
    const fresh=accounts.get(session.familyKey);
    if(!fresh||fresh!==acct||fresh.revision!==acct.revision
       ||tokens.get(token)!==session||session.expiresAt<=clock())
     throw reject(409,'STALE_OR_REVOKED_SESSION');
    const candidate=new Map(accounts);candidate.delete(session.familyKey);
    const nextAttempts=new Map(loginAttempts);nextAttempts.delete(session.familyKey);
    storage.persist(candidate,nextAttempts); // Failure preserves family and limiter.
    accounts.delete(session.familyKey);
    loginAttempts.delete(session.familyKey);
    for(const [sessionToken,entry] of tokens){
     if(entry.familyKey===session.familyKey)tokens.delete(sessionToken);
    }
    return reply(res,200,{deleted:true,sessionsRevoked:true,qaOnly:true,
      cloudReady:false,forensicEraseGuaranteed:false});
   }
   if(req.url==='/qa/sync-commit'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const session=tokens.get(bearer.slice(7));
    if(!session||session.expiresAt<=clock())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const initial=accounts.get(session.familyKey);
    if(!initial||!initial.snapshot)throw reject(409,'BASELINE_NOT_STORED');
    const ifMatch=req.headers['if-match'];
    if(typeof ifMatch!=='string'||!/^"\d+"$/.test(ifMatch))
     throw reject(428,'IF_MATCH_REQUIRED');
    if(ifMatch!=='"'+initial.revision+'"')throw reject(409,'STALE_REVISION');
    const body=await jsonBody(req);
    if(body.approved!==true)throw reject(428,'EXPLICIT_REVIEW_APPROVAL_REQUIRED');
    if(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<1||!body.base||!body.local)
     throw reject(422,'MISSING_VERSIONED_BASE_OR_LOCAL');
    // A client-supplied base is NOT trusted. Compare it to encrypted server history
    // of a previously confirmed version to prevent fabricated merge ancestry.
    const fresh=accounts.get(session.familyKey);
    if(!fresh||fresh.revision!==initial.revision||ifMatch!=='"'+fresh.revision+'"'
       ||tokens.get(bearer.slice(7))!==session||session.expiresAt<=clock())
     throw reject(409,'STALE_OR_REVOKED_SESSION');
    const prior=(fresh.history||[]).find(h=>h.revision===body.baseRevision);
    const known=prior||(fresh.revision===body.baseRevision?{snapshot:fresh.snapshot}:null);
    if(!known||JSON.stringify(known.snapshot)!==JSON.stringify(body.base))
     throw reject(409,'BASE_REVISION_NOT_CONFIRMED');
    let plan;
    try{plan=previewThreeWay(known.snapshot,body.local,fresh.snapshot)}
    catch(e){throw reject(422,e instanceof SyncPreflightError?e.code:'INVALID_THREE_WAY_BACKUP')}
    if(!plan.candidate||plan.outcome!=='NON_CONFLICTING_DRAFT')
     throw reject(409,'MERGE_REQUIRES_HUMAN_CONFLICT_REVIEW');
    // No await after the second revision verification: synchronous atomic write.
    const previous={revision:fresh.revision,snapshot:fresh.snapshot};
    const saved={...fresh,snapshot:structuredClone(plan.candidate),revision:fresh.revision+1,
      history:[...(fresh.history||[]),previous].slice(-12)};
    const candidate=new Map(accounts);candidate.set(session.familyKey,saved);
    storage.persist(candidate);
    accounts.set(session.familyKey,saved);
    return reply(res,200,{stored:true,revision:saved.revision,
      records:saved.snapshot.records.length,qaOnly:true,cloudReady:false,
      approvedManualMerge:true},{etag:'"'+saved.revision+'"'});
   }
   if(req.url==='/qa/sync-preview'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const session=tokens.get(bearer.slice(7));
    if(!session||session.expiresAt<=clock())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct||!acct.snapshot)throw reject(409,'BASELINE_NOT_STORED');
    const request=await jsonBody(req);
    if(!request.base||!request.local)throw reject(422,'MISSING_BASE_OR_LOCAL');
    let result;
    try{result=previewThreeWay(request.base,request.local,acct.snapshot)}
    catch(e){throw reject(422,e instanceof SyncPreflightError?e.code:'INVALID_THREE_WAY_BACKUP')}
    // Never send student records, photo bytes or a merged candidate back over this experimental API.
    const {candidate,...publicPlan}=result;
    return reply(res,200,{...publicPlan,candidateAvailable:!!candidate,qaOnly:true,storedRevision:acct.revision});
   }
   if(req.url==='/qa/snapshot'&&['GET','PUT'].includes(req.method)){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const session=tokens.get(bearer.slice(7));
    if(!session||session.expiresAt<=clock())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct)throw reject(401,'SESSION_FAMILY_MISSING');
    if(req.method==='GET')
     return reply(res,200,{revision:acct.revision,snapshot:acct.snapshot,qaOnly:true},{etag:'"'+acct.revision+'"'});
    const oldRev=acct.revision;
    const match=req.headers['if-match'];
    if(typeof match!=='string'||!/^"\d+"$/.test(match))
     throw reject(428,'IF_MATCH_REQUIRED');
    if(match!=='"'+oldRev+'"')throw reject(409,'STALE_REVISION');
    const doc=await jsonBody(req);
    try{checkBackup(doc)}catch(err){
     throw reject(422,err instanceof SyncPreflightError?err.code:'INVALID_BACKUP');
    }
    if(acct.snapshot){
     let plan;
     try{plan=previewMerge(acct.snapshot,doc)}
     catch(err){throw reject(409,err instanceof SyncPreflightError?err.code:'MERGE_PREVIEW_FAILED')}
     // Only append-only same-ID content is allowed; old records/photos may not vanish.
     if(plan.proposedRecords!==doc.records.length||plan.proposedPhotos!==Object.keys(doc.photos).length)
      throw reject(409,'SILENT_RECORD_OR_PHOTO_LOSS');
    }
    // In-memory atomic commit; revision increment, separate family storage.
    // A second request may commit while this request body is still streaming.
    // Recheck the shared revision immediately before the synchronous write.
    const fresh=accounts.get(session.familyKey);
    if(!fresh||fresh.revision!==oldRev
       ||tokens.get(bearer.slice(7))!==session||session.expiresAt<=clock())
     throw reject(409,'STALE_OR_REVOKED_SESSION');
    const previous=fresh.snapshot?{revision:fresh.revision,snapshot:fresh.snapshot}:null;
    const saved={...fresh,snapshot:structuredClone(doc),revision:oldRev+1,
      history:[...(fresh.history||[]),...(previous?[previous]:[])].slice(-12)};
    const candidate=new Map(accounts);candidate.set(session.familyKey,saved);
    // Synchronous atomic write: no acknowledgement before verified disk commit.
    storage.persist(candidate);
    accounts.set(session.familyKey,saved);
    return reply(res,200,{stored:true,revision:saved.revision,qaOnly:true},{etag:'"'+saved.revision+'"'});
   }
   throw reject(404,'NOT_FOUND');
  }catch(error){
   const status=Number.isInteger(error?.status)?error.status:500;
   // No error stacks, token values, passwords, record contents or family keys in responses.
   return reply(res,status,{error:status===500?'INTERNAL_TEST_ONLY_ERROR':error.reason||'REQUEST_REJECTED',qaOnly:true});
  }
 });
 // Bound stalled synthetic requests; do not treat this as production DoS protection.
 server.requestTimeout=15000;
 server.headersTimeout=10000;
 server.maxHeadersCount=64;
 // Explicitly bind loopback; port=0 prevents collision and any public access.
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 return Object.freeze({
  baseUrl:'http://127.0.0.1:'+server.address().port,
  shutdown:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())),
  qaOnly:true,cloudReady:false,productionAuth:false,encryptedRestartRecovery:storage.durable
 });
}
