// QA40 G15: JWT signature/claim verification prototype, NOT a login provider.
// Only a LOCAL synthetic JWKS is accepted. Provider discovery, MFA, legal
// guardian status, logout/recovery and production key rotation are NOT done.
// A guardian must STILL have an independently approved server-side DB membership.
import {createHash} from 'node:crypto';
import {createLocalJWKSet,jwtVerify} from 'jose';

const reject=()=>Object.assign(new Error('AUTHENTICATION_REJECTED'),{
 code:'AUTHENTICATION_REJECTED'
});
function validConfig(issuer,audience,jwks){
 if(typeof issuer!=='string'||!/^https:\/\/[^\s/?#]+(?:\/[^?#]*)?$/.test(issuer))
  throw Error('INVALID_SYNTHETIC_ISSUER');
 if(typeof audience!=='string'||audience.length<3||audience.length>150)
  throw Error('INVALID_API_AUDIENCE');
 if(!jwks||!Array.isArray(jwks.keys)||jwks.keys.length<1||jwks.keys.length>4)
  throw Error('MISSING_PINNED_SYNTHETIC_JWKS');
 for(const jwk of jwks.keys){
  if(!jwk||typeof jwk.kid!=='string'||jwk.kid.length<3||jwk.kid.length>90||
     !['RSA','EC'].includes(jwk.kty)||jwk.d!==undefined||
     (jwk.alg!==undefined&&!['RS256','ES256'].includes(jwk.alg)))
   throw Error('INVALID_PUBLIC_JWK');
 }
}
export function createQa40SyntheticOidcResolver({issuer,audience,jwks}={}){
 if(process.env.QA40_SYNTHETIC_JWKS_ONLY!=='1')
  throw Error('REAL_IDENTITY_PROVIDER_NOT_CONFIGURED');
 validConfig(issuer,audience,jwks);
 const keySet=createLocalJWKSet(jwks);
 return async function resolveAuthenticatedPrincipal(requestContext){
  const token=requestContext?.bearerToken;
  if(typeof token!=='string'||token.length<50||token.length>12000)
   throw reject();
  try{
   const {payload,protectedHeader}=await jwtVerify(token,keySet,{
    issuer,audience,algorithms:['RS256','ES256'],
    maxTokenAge:'10m',clockTolerance:'3s',requiredClaims:['sub','iat','exp']
   });
   if(!protectedHeader.kid||!['RS256','ES256'].includes(protectedHeader.alg)||
      typeof payload.sub!=='string'||payload.sub.length<4||payload.sub.length>256||
      /[\x00-\x1f\x7f]/.test(payload.sub))
    throw Error('INVALID_SUBJECT_OR_JWT_HEADER');
   // Privacy-preserving, stable family-member lookup key from the VERIFIED
   // issuer + subject; NEVER from a browser-supplied family ID.
   const id=createHash('sha256').update(issuer+'\0'+payload.sub).digest('hex');
   return 'oidc:'+id;
  }catch{
   // No credential, key ID, token bytes, JWT claims or server detail in error.
   throw reject();
  }
 };
}
