"""A18-15 additional blocked-store clear-all warning (isolated QA only).
This patch composes AFTER A18-14; never edits product dev or user records.
"""
OLD = """$('clear-all').onclick=async()=>{
 if(!storageOk)return notify('저장소를 사용할 수 없습니다.');
 if(A1813_SAFE_TO_RESTORE!==true)"""
NEW = """$('clear-all').onclick=async()=>{
 if(!storageOk)return notify('전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다. 안전 점검이 끝나기 전에는 삭제할 수 없습니다.');
 if(A1813_SAFE_TO_RESTORE!==true)"""

def apply(data: bytes, reverse: bool=False) -> bytes:
    before, after=(NEW, OLD) if reverse else (OLD, NEW)
    b,a=before.encode('utf-8'),after.encode('utf-8')
    if data.count(b)!=1 or data.count(a):
        raise ValueError('expected unique unchanged clear handler anchor')
    return data.replace(b,a,1)

if __name__ == '__main__':
    import sys
    from pathlib import Path
    if len(sys.argv)!=3: raise SystemExit('usage: python qa/a18_15_locked_clear_notice.py INPUT OUTPUT')
    src=Path(sys.argv[1]).read_bytes()
    candidate=apply(src)
    assert apply(candidate,reverse=True)==src
    Path(sys.argv[2]).write_bytes(candidate)
