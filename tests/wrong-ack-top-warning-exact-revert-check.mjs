// Exact A-isolated top warning inverse: preserve accepted ACK QA bytes, then old inverse recovers dev.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\\0'.replace('\\0','\0')).update(s).digest('hex');
let src=readFileSync('index.html','utf8');
assert.equal(sha(src),'101e7ea5ee5ba34e107c77981daaf58101c97750','unexpected new warning candidate blob');
function inv(a,b){assert.equal(src.split(a).length,2,'nonunique inverse anchor');src=src.replace(a,b)}
inv("    // A-isolated visual feedback only: stale photo toast must not obscure ACK uncertainty.\n    clearTimeout(toastTimer);$('toast').classList.add('hide');\n","");
inv("\n/* A-isolated ACK unknown summary: no fixed overlay or ledger changes. */\n#wrong-ack-top-warning{width:min(1040px,calc(100% - 24px));margin:8px auto 10px;padding:12px 14px;border:2px solid #ad5518;border-radius:12px;background:#fff4e1;color:#6b3312;font-size:14px;line-height:1.55;overflow-wrap:anywhere}\nbody:not(.v08-adding) #wrong-ack-top-warning,body.v218-child #wrong-ack-top-warning{display:none!important}\n"+"</style>\n</head>","</style>\n</head>");
inv("<a class=\"qa16-skip\" href=\"#qa-main\">본문 학습 영역으로 바로가기</a>\n<div id=\"wrong-ack-top-warning\" class=\"hide v218-parent-only\" role=\"note\" aria-label=\"오답 저장 확인 필요\">저장 결과 확인 필요</div>\n","<a class=\"qa16-skip\" href=\"#qa-main\">본문 학습 영역으로 바로가기</a>\n");
inv("if(transactionDone){\n    wrongAckUnknown=true;\n    const topWarning=$('wrong-ack-top-warning');\n    topWarning.textContent='⛔ 저장은 완료됐을 수 있으나 확인하지 못했습니다. 같은 오답을 다시 저장하지 말고 오답 목록에서 기록과 사진을 먼저 확인하세요.';\n    topWarning.classList.remove('hide');\n  }","if(transactionDone)wrongAckUnknown=true;");
assert.equal(sha(src),'63e31915875a79a2ebcf21d7c722daa9f8deeb98','ACK accepted QA blob must exactly restore');
console.log('ACK_TOP_WARNING_EXACT_INVERSE_MATCHES_ACCEPTED_QA_BLOB');
