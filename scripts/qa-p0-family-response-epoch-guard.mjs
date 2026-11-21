// QA-only family epoch fail-closed client gate: not product authorization.
// The server authenticates requests independently; this rejects a *stale*
// authorized A response after the client switches to B or logs out.
export function createQaFamilyEpochGate(familyId){
 if(typeof familyId!=='string'||!familyId.startsWith('qa-'))throw Error('QA_FAMILY_ID_REQUIRED');
 let active=familyId,epoch=0,consumed=0,rejected=0;
 return Object.freeze({
  begin(){return Object.freeze({familyId:active,epoch});},
  switchTo(id){if(typeof id!=='string'||!id.startsWith('qa-'))throw Error('QA_FAMILY_ID_REQUIRED');
    active=id;epoch++;},
  logout(){active=null;epoch++;},
  accept(ticket,response){
   if(!ticket||ticket.epoch!==epoch||ticket.familyId!==active||active===null){
    rejected++;return {status:'STALE_FAMILY_RESPONSE_DROPPED',data:null};
   }
   if(response?.status!==200){rejected++;return {status:'RESPONSE_NOT_AUTHORIZED',data:null};}
   consumed++;
   return {status:'ACCEPTED_FOR_CURRENT_FAMILY',data:response.data};
  },
  metrics(){return {activeFamily:active,epoch,accepted:consumed,discarded:rejected};}
 });
}
