// QA47 Supabase live Edge endpoint core, zero student-data exposure.
// No Supabase SDK import here: allows local tests using synthetic verifiers.
const JSON_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, max-age=0',
 'x-content-type-options':'nosniff'
};
const ALLOWED='http://127.0.0.1:4173';
function respond(status,body,origin=ALLOWED) {
 return new Response(JSON.stringify(body),{status,headers:{
   ...JSON_HEADERS,
   'access-control-allow-origin':origin,
   'vary':'Origin',
   'access-control-allow-headers':'authorization, apikey, content-type',
   'access-control-allow-methods':'GET, OPTIONS'
 }});
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleQa47AuthenticatedGuardianStatus(req,services) {
 // Only a loopback owner lab may call the staged endpoint from browsers.
 // Even if non-browser clients forge Origin, JWT verification and DB RLS apply.
 const origin=req.headers.get('origin');
 if(origin!==ALLOWED)return new Response(null,{status:403,headers:JSON_HEADERS});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'access-control-allow-origin':ALLOWED,
   'vary':'Origin',
   'access-control-allow-headers':'authorization, apikey, content-type',
   'access-control-allow-methods':'GET, OPTIONS',
   'cache-control':'no-store'
 }});
 if(req.method!=='GET')return respond(405,{error:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('authorization')||'';
 const match=/^Bearer ([A-Za-z0-9._~-]{50,12000})$/.exec(authorization);
 if(!match)return respond(401,{error:'AUTH_REQUIRED'});
 if(!services||typeof services.getUser!=='function'||
    typeof services.findVerifiedFamilies!=='function')
  return respond(503,{error:'STAGING_BACKEND_UNAVAILABLE'});
 try{
  // Supabase server-side auth.getUser(access_token); NEVER decode or trust
  // a browser-editable JWT claim as authentication.
  const user=await services.getUser(match[1]);
  if(!UUID.test(String(user?.id||''))||user.is_anonymous===true)
   return respond(401,{error:'AUTH_REQUIRED'});
  // RPC is SECURITY INVOKER. It uses auth.uid() and verified consent RLS,
  // and returns only family UUIDs belonging to this authenticated JWT.
  const families=await services.findVerifiedFamilies(match[1]);
  if(!Array.isArray(families)||families.some(x=>typeof x!=='string'||!UUID.test(x)))
   return respond(503,{error:'GUARDIAN_STATUS_UNAVAILABLE'});
  const unique=new Set(families);
  if(unique.size!==families.length)return respond(503,{error:'GUARDIAN_STATUS_UNAVAILABLE'});
  return respond(200,{
   authenticated:true,
   guardianVerificationRequired:families.length===0,
   verifiedFamilyCount:families.length,
   // Child records / photos / sync are NEVER exposed by this diagnostic API.
   studentRecordsEnabled:false,
   uploadsEnabled:false,
   syncWritesEnabled:false,
   productionApproved:false
  });
 }catch{
  // Never echo provider errors, token, identity, family IDs, or addresses.
  return respond(503,{error:'GUARDIAN_STATUS_UNAVAILABLE'});
 }
}
