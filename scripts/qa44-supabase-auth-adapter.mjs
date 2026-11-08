// QA44 G15 — Supabase Auth integration ADAPTER, not deployed.
// Google OAuth + email/password/confirm/reset. No actual user/child data.
// The Supabase client must be supplied by a trusted hosting setup; never
// accept an API secret or "service_role" key in any public browser bundle.
const error=code=>Object.assign(new Error(code),{code});
const local='http://127.0.0.1:4173';
const emailPattern=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,30}$/;
const isUuid=s=>typeof s==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function guardEnv(config){
 if(!config||config.mode!=='SYNTHETIC_STAGE_ONLY'||config.origin!==local||
    config.allowRealChildren!==false||config.isProduction!==false)
  throw error('QA44_PUBLIC_LIVE_AUTH_DISABLED');
}
function validateEmail(email){
 if(typeof email!=='string'||!emailPattern.test(email)||email.length>254)
  throw error('EMAIL_FORMAT_INVALID');
 return email.trim().toLowerCase();
}
function validatePassword(password){
 if(typeof password!=='string'||password.length<12||password.length>128)
  throw error('STRONG_PASSWORD_REQUIRED');
 return password;
}
function ensure(result){
 if(result?.error){
  // Do not leak raw provider error, user existence or access token to UI.
  const status=Number(result.error.status);
  if(status===429)throw error('AUTH_RATE_LIMITED');
  throw error('AUTH_REQUEST_REJECTED');
 }
 return result?.data||null;
}
function safeRedirect(url){
 if(typeof url!=='string'||!url.startsWith(local+'/'))
  throw error('UNAPPROVED_REDIRECT');
 return url;
}
export function createQa44StagingAuthAdapter(client,config){
 guardEnv(config);
 if(!client||typeof client.auth?.signInWithOAuth!=='function'||
    typeof client.auth?.signUp!=='function'||
    typeof client.auth?.signInWithPassword!=='function'||
    typeof client.auth?.resetPasswordForEmail!=='function'||
    typeof client.auth?.updateUser!=='function'||
    typeof client.auth?.signOut!=='function'||
    typeof client.auth?.getUser!=='function'||
    typeof client.schema!=='function')
  throw error('SUPABASE_AUTH_CLIENT_REQUIRED');
 // Never obtain an identity from editable client-supplied JWT claims.
 let currentUser=null,approvedFamilies=[],verifiedEpoch=0;
 const clear=()=>{
  currentUser=null;approvedFamilies=[];verifiedEpoch++;
 };
 async function refreshServerVerifiedIdentity(){
  const attempt=++verifiedEpoch;
  let r;
  try{r=await client.auth.getUser()}catch{clear();throw error('IDENTITY_UNAVAILABLE')}
  if(attempt!==verifiedEpoch)throw error('SESSION_CHANGED');
  const user=ensure(r)?.user;
  if(!isUuid(user?.id)||user?.is_anonymous===true){
   clear();throw error('VERIFIED_IDENTITY_REQUIRED');
  }
  currentUser=user.id;approvedFamilies=[];
  let memberships;
  try{
   memberships=await client.schema('qa44').from('guardian_memberships')
    .select('family_id,verified_at,consent_verified_at,verification_source,revoked_at')
    .eq('guardian_user_id',user.id);
  }catch{clear();throw error('GUARDIAN_CHECK_UNAVAILABLE')}
  if(attempt!==verifiedEpoch)throw error('SESSION_CHANGED');
  const records=ensure(memberships);
  if(!Array.isArray(records)){
   clear();throw error('GUARDIAN_CHECK_UNAVAILABLE');
  }
  approvedFamilies=records.filter(row=>isUuid(row.family_id)&&
   row.verification_source==='externally_verified'&&
   !!row.verified_at&&!!row.consent_verified_at&&row.revoked_at===null)
   .map(row=>row.family_id);
  return Object.freeze({authenticated:true,canAccessChildren:approvedFamilies.length>0,
   guardianVerificationRequired:approvedFamilies.length===0,
   families:[...approvedFamilies]});
 }
 async function google(){
  clear();
  const result=ensure(await client.auth.signInWithOAuth({
   provider:'google',options:{
    redirectTo:safeRedirect(config.redirectUrl),skipBrowserRedirect:true
   }
  }));
  // Auth SDK returns OAuth destination. Never expose raw provider tokens.
  if(!result?.url||!/^https:\/\/[^@\s/]+(?:\/|$)/.test(result.url))
   throw error('BAD_OAUTH_DESTINATION');
  return Object.freeze({requiresBrowserNavigation:true,url:result.url});
 }
 async function register(email,password){
  clear();
  ensure(await client.auth.signUp({
   email:validateEmail(email),password:validatePassword(password),
   options:{emailRedirectTo:safeRedirect(config.redirectUrl)}
  }));
  return Object.freeze({confirmationRequired:true,guardianAccessGranted:false});
 }
 async function passwordSignIn(email,password){
  clear();
  ensure(await client.auth.signInWithPassword({
   email:validateEmail(email),password:validatePassword(password)
  }));
  // Verified auth is NEVER equivalent to legal guardian authority.
  return refreshServerVerifiedIdentity();
 }
 async function recovery(email){
  ensure(await client.auth.resetPasswordForEmail(validateEmail(email),{
   redirectTo:safeRedirect(config.recoveryUrl)
  }));
  return Object.freeze({requestAccepted:true,identityDisclosure:false});
 }
 async function updatePassword(password){
  const r=await client.auth.getUser();
  if(!isUuid(ensure(r)?.user?.id))throw error('VERIFIED_IDENTITY_REQUIRED');
  ensure(await client.auth.updateUser({password:validatePassword(password)}));
  clear();
  return Object.freeze({passwordChanged:true,revalidationRequired:true});
 }
 async function logout(){
  try{ensure(await client.auth.signOut({scope:'local'}))}
  finally{clear()}
  return Object.freeze({signedOut:true});
 }
 return Object.freeze({
  google,register,passwordSignIn,recovery,updatePassword,logout,
  refreshServerVerifiedIdentity,
  getState:()=>Object.freeze({
   authenticated:currentUser!==null,
   canAccessChildren:approvedFamilies.length>0,
   families:[...approvedFamilies],
   requiresGuardianVerification:approvedFamilies.length===0
  }),
  invalidate:clear
 });
}
