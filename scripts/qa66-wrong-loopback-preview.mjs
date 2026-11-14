// WRONG QA66: strictly localhost-only, ephemeral, auth-gated DEV preview.
// This is NOT hosted or a real family authentication/production proof.
// No public bind, no production API keys, no persistent server storage.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HOST='127.0.0.1';
const APP=new URL('../index.html',import.meta.url);
const ASSETS=new Map([
 ['/scripts/qa-inapp-sync-bridge.mjs',new URL('./qa-inapp-sync-bridge.mjs',import.meta.url)],
 ['/scripts/qa47-live-auth-lab.mjs',new URL('./qa47-live-auth-lab.mjs',import.meta.url)]
]);
const securityHeaders={
 'Cache-Control':'no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex, nofollow, noarchive',
 // The source app is inline JS; only self-hosted scripts can execute.
 'Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
};
const validSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/i.test(s);
function safeAuth(candidate,expected){
 const a=Buffer.from(String(candidate)),b=Buffer.from(String(expected));
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function startWrongQa66Preview({devSha,username,password}={}){
 if(!validSha(devSha)||typeof username!=='string'||username.length<4||
    typeof password!=='string'||password.length<20)
  throw Error('QA66_REQUIRES_VALID_SHA_AND_EPHEMERAL_GATE_SECRET');
 if(/[\r\n:]/.test(username)||/[\r\n]/.test(password))
  throw Error('QA66_INVALID_GATE_CREDENTIAL');
 const original=await readFile(APP,'utf8');
 const updatedAt=new Date().toISOString();
 const banner='<aside id="wrong-qa66-preview-meta" role="note" style="padding:12px;background:#fef5db;color:#30230f;line-height:1.5">'+
  '<strong>비운영 · 가상자료 전용 로컬 QA</strong> · 반영 dev SHA: '+devSha+
  ' · 검증 상태: 로컬 준비 (외부 인증·운영 DB 분리 실증 전) · 확인 시각: '+updatedAt+
  ' · 실가족 인증/사진 복원 미검증 · 배포 아님</aside>';
 if(!/<body[^>]*>/i.test(original))throw Error('QA66_APP_BODY_NOT_FOUND');
 const html=original.replace(/(<body[^>]*>)/i,'$1'+banner);
 const server=createServer(async(req,res)=>{
  const done=(status,body,extra={})=>{res.writeHead(status,{...securityHeaders,...extra});res.end(body)};
  if(req.method!=='GET'&&req.method!=='HEAD')return done(405,'요청 불가');
  let path,query;
  try{const url=new URL(req.url,'http://127.0.0.1');path=url.pathname;query=url.search}
  catch{return done(400,'잘못된 요청')}
  if(query)return done(403,'시험용 URL 매개변수는 허용하지 않습니다.');
  const token=String(req.headers.authorization||'');
  let credential='';
  if(token.startsWith('Basic ')&&token.length<1024){
   try{credential=Buffer.from(token.slice(6),'base64').toString('utf8')}catch{}
  }
  if(!safeAuth(credential,username+':'+password))return done(401,'로컬 미리보기 접근 제한',{
   'WWW-Authenticate':'Basic realm="WRONG LOCAL QA66", charset="UTF-8"',
   'Content-Type':'text/plain; charset=utf-8'
  });
  if(path==='/'||path==='/index.html')return done(200,req.method==='HEAD'?'':html,{
   'Content-Type':'text/html; charset=utf-8'
  });
  if(!ASSETS.has(path))return done(404,'등록되지 않은 경로');
  try{
   const body=await readFile(ASSETS.get(path));
   return done(200,req.method==='HEAD'?'':body,{'Content-Type':'text/javascript; charset=utf-8'});
  }catch{return done(500,'파일 조회 실패')}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,HOST,()=>{
  server.off('error',no);ok()
 })});
 const address=server.address();
 if(address.address!==HOST||address.port===4173){
  await new Promise(ok=>server.close(ok));
  throw Error('QA66_LOCAL_BIND_BOUNDARY');
 }
 return {url:'http://'+HOST+':'+address.port+'/',host:address.address,port:address.port,
  devSha,updatedAt,close:()=>new Promise(ok=>server.close(ok))};
}
// No default server or credential. This opt-in CLI is local only; the
// ephemeral password is supplied by the caller and must not be printed.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const devSha=process.env.WRONG_QA66_DEV_SHA;
 const username=process.env.WRONG_QA66_USER;
 const password=process.env.WRONG_QA66_PASS;
 const preview=await startWrongQa66Preview({devSha,username,password});
 console.log('WRONG_QA66_LOCAL_ONLY='+preview.url);
 console.log('WRONG_QA66_DEV_SHA='+preview.devSha);
 console.log('WRONG_QA66_EXTERNAL_DEPLOY=false');
}
