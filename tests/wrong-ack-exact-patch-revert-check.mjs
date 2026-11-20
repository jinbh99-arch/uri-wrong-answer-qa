// Exact inverse of the ACK single-file QA patch; must recover dev blob byte-for-byte.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let src=readFileSync('index.html','utf8');
const sha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(sha(src),'63e31915875a79a2ebcf21d7c722daa9f8deeb98','unexpected QA app blob');
function inverse(newPart,oldPart){
 assert.equal(src.split(newPart).length,2,'patch inverse anchor not unique');
 src=src.replace(newPart,oldPart);
}
inverse(
 "let wrongAckBusy=false,wrongAckUnknown=false;\n$('mistake-form').onsubmit=async e=>{e.preventDefault();\n if(wrongAckBusy||wrongAckUnknown){$('form-error').textContent=wrongAckUnknown?'⛔ 직전 저장은 완료됐을 수 있으나 확인에 실패했습니다. 중복 저장을 방지하기 위해 이 화면에서는 재등록을 차단합니다. 오답 목록의 기록과 사진을 먼저 확인하고 페이지를 새로 열어 진행하세요.':'⏳ 오답을 저장하는 중입니다. 완료 또는 오류 안내를 확인한 뒤 진행하세요.';$('form-error').classList.remove('hide');return;}\n wrongAckBusy=true;\n try{$('form-error').classList.add('hide');",
 "$('mistake-form').onsubmit=async e=>{e.preventDefault();$('form-error').classList.add('hide');"
);
inverse(
 "}catch(e){\n  if(transactionDone)wrongAckUnknown=true;\n  $('form-error').textContent=transactionDone?",
 "}catch(e){\n  $('form-error').textContent=transactionDone?"
);
inverse(
 "  $('form-error').classList.remove('hide');\n  }\n }finally{wrongAckBusy=false;}\n};\n$('cancel-edit').onclick",
 "  $('form-error').classList.remove('hide');\n}};\n$('cancel-edit').onclick"
);
assert.equal(sha(src),'250aff5b0a46490488b64f7b96a83c940d2d6c71','original dev bytes not restored');
console.log('ACK_QA_EXACT_INVERSE_MATCHES_DEV_BLOB');
