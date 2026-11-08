// QA43: prospective operations configuration preflight. NEVER boots a public
// service and NEVER validates actual user consent / legal authority.
import {readFileSync} from 'node:fs';
const code=(id)=>Object.assign(new Error(id),{code:id});
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const httpsUrl=x=>{
 if(typeof x!=='string')return false;
 try{const u=new URL(x);return u.protocol==='https:'&&u.username===''&&
  u.password===''&&u.hash===''&&u.hostname.includes('.')&&
  !['localhost','127.0.0.1'].includes(u.hostname)}
 catch{return false}
};
const secretRef=s=>typeof s==='string'&&
 /^(?:secret-manager|vault|kms):\/\/[A-Za-z0-9/_:.@-]{8,160}$/.test(s);
export function validateQa43OperatingCandidate(obj){
 if(!exact(obj,['schema','mode','publicAppOrigin','apiOrigin','oidc','database','photos',
  'privacy','deployment','secrets','externalApprovals']))throw code('CONFIG_SCHEMA');
 if(obj.schema!=='qa43-operating-candidate-v1'||obj.mode!=='PRELAUNCH_DRAFT')
  throw code('NO_PRODUCTION_APPROVAL');
 if(!httpsUrl(obj.publicAppOrigin)||!httpsUrl(obj.apiOrigin)||
    obj.publicAppOrigin===obj.apiOrigin)throw code('HTTPS_ORIGIN_REQUIRED');
 if(!exact(obj.oidc,['issuer','audience','jwksRotation','accessTokenOnly',
  'verifyLegalGuardianExternally','tokenRevocationStrategy']))throw code('OIDC_SCHEMA');
 if(!httpsUrl(obj.oidc.issuer)||typeof obj.oidc.audience!=='string'||
    obj.oidc.audience.length<8||obj.oidc.jwksRotation!=='DOCUMENTED_PENDING'||
    obj.oidc.accessTokenOnly!==true||
    obj.oidc.verifyLegalGuardianExternally!==true||
    obj.oidc.tokenRevocationStrategy!=='SHORT_TTL_PLUS_SERVER_MEMBERSHIP_REVOKE')
   throw code('IDENTITY_CONFIG_INCOMPLETE');
 if(!exact(obj.database,['network','rowLevelSecurity','appRole',
    'pointInTimeRecovery','encryptionAtRest','region']))
   throw code('DATABASE_SCHEMA');
 if(obj.database.network!=='PRIVATE_ONLY'||obj.database.rowLevelSecurity!==true||
    obj.database.appRole!=='NON_OWNER_NON_BYPASSRLS'||
    obj.database.pointInTimeRecovery!=='REHEARSAL_REQUIRED'||
    obj.database.encryptionAtRest!==true||
    obj.database.region!=='TO_BE_APPROVED')throw code('DATABASE_SECURITY_REQUIRED');
 if(!exact(obj.photos,['storage','encryption','access','metadata','retention'])||
    obj.photos.storage!=='PRIVATE_OBJECT_STORAGE_PLANNED'||
    obj.photos.encryption!==true||
    obj.photos.access!=='SHORT_LIVED_SCOPED_ACCESS'||
    obj.photos.metadata!=='STRIP_BEFORE_PERSIST'||
    obj.photos.retention!=='TO_BE_APPROVED')
   throw code('PHOTO_SECURITY_REQUIRED');
 if(!exact(obj.privacy,['guardianConsent','childDataCollection','deletionAndExport',
     'incidentResponse'])||
    obj.privacy.guardianConsent!=='NOT_APPROVED'||
    obj.privacy.childDataCollection!==false||
    obj.privacy.deletionAndExport!=='REVIEW_REQUIRED'||
    obj.privacy.incidentResponse!=='REVIEW_REQUIRED')
  throw code('PRIVACY_NOT_APPROVED');
 if(!exact(obj.deployment,['environment','publicExposure','tlsTermination',
    'rollBackProcedure','hardwareValidation'])||
    obj.deployment.environment!=='UNDEPLOYED_DRAFT'||
    obj.deployment.publicExposure!==false||
    obj.deployment.tlsTermination!=='PLAN_ONLY'||
    obj.deployment.rollBackProcedure!=='REHEARSAL_REQUIRED'||
    obj.deployment.hardwareValidation!=='NOT_TESTED')
   throw code('DEPLOYMENT_NOT_APPROVED');
 if(!exact(obj.secrets,['oidcSigningKey','databaseCredentials','objectStoreCredentials'])||
    !Object.values(obj.secrets).every(secretRef))throw code('INLINE_SECRET_OR_MISSING_REFERENCE');
 if(!exact(obj.externalApprovals,['cloudProvider','privacyAndGuardian','realDevices',
    'releaseOwner'])||!Object.values(obj.externalApprovals).every(v=>v==='PENDING'))
   throw code('EXTERNAL_APPROVAL_REQUIRED');
 const raw=JSON.stringify(obj);
 if(/-----BEGIN(?: RSA)? PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{24}/.test(raw))
  throw code('INLINE_CREDENTIAL');
 return Object.freeze({
  status:'VALID_DRAFT_NOT_DEPLOYABLE',
  providerChosen:false,privacyApproved:false,realDeviceVerified:false,
  customerCredentialsStored:false,canDeploy:false,canCollectChildData:false
 });
}
export function readQa43Draft(path){
 return validateQa43OperatingCandidate(JSON.parse(readFileSync(path,'utf8')));
}
