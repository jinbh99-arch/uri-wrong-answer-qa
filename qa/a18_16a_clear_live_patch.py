"""A18-16a reversible QA-only clear warning live-region patch; never for product dev."""
PATCHES = [["<button class=\"danger\" id=\"clear-all\">모든 기록과 사진 삭제</button></div>","<button class=\"danger\" id=\"clear-all\">모든 기록과 사진 삭제</button><p id=\"a18-16-clear-live\" class=\"small\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\" aria-label=\"전체 삭제 안전 안내\"></p></div>"],["$('clear-all').onclick=async()=>{","// A18-16a: stable live region; one shared warning contract for both storage states.\n// QA-only read-only probe tests announcement WITHOUT activating the delete button.\nfunction a1816ExplainBlockedClear(){\n const message=!storageOk\n  ?'전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다. 안전 점검이 끝나기 전에는 삭제할 수 없습니다.'\n  :'전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다.';\n $('a18-16-clear-live').textContent=message;\n notify(message);return message;\n}\nObject.defineProperty(window,'__wrongA1816ReadOnlyAnnounce',{configurable:false,value:()=>a1816ExplainBlockedClear()});\n$('clear-all').onclick=async()=>{"],["if(!storageOk)return notify('전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다. 안전 점검이 끝나기 전에는 삭제할 수 없습니다.');\n if(A1813_SAFE_TO_RESTORE!==true)return notify('전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다.');","if(!storageOk)return a1816ExplainBlockedClear();\n if(A1813_SAFE_TO_RESTORE!==true)return a1816ExplainBlockedClear();"]]
def apply(data: bytes, reverse=False) -> bytes:
    pairs=list(reversed(PATCHES)) if reverse else PATCHES
    for old,new in pairs:
        before,after=(new,old) if reverse else (old,new)
        b,a=before.encode('utf-8'),after.encode('utf-8')
        if data.count(b)!=1 or (not reverse and data.count(a)):
            raise ValueError('missing/duplicate anchor or already patched')
        data=data.replace(b,a,1)
    return data
