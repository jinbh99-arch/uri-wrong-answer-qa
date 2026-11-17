"""A18-14 isolated UX patch. Input/output are local QA copies, never product dev.
Usage: python qa/a18_14_clear_ux.py source.html patched.html
Reverse: python qa/a18_14_clear_ux.py --reverse patched.html restored.html
"""
import sys
from pathlib import Path

OLD = "if(!storageOk)return notify('저장소를 사용할 수 없습니다.');\n let before,photosBefore;\n try{before=await v22CaptureRestoreBaseline();photosBefore=await v23CapturePhotoFingerprints()}"
NEW = "if(!storageOk)return notify('저장소를 사용할 수 없습니다.');\n if(A1813_SAFE_TO_RESTORE!==true)return notify('전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다.');\n let before,photosBefore;\n try{before=await v22CaptureRestoreBaseline();photosBefore=await v23CapturePhotoFingerprints()}"
# The guard is deliberately only for the destructive clear-all UI path.
# A18-13 core gate remains intact and still protects direct calls.
def apply(data: bytes, reverse=False):
    before, after = (NEW, OLD) if reverse else (OLD, NEW)
    b, a = before.encode("utf-8"), after.encode("utf-8")
    assert data.count(b) == 1, "expected exactly one clear-all UI anchor"
    assert data.count(a) == 0, "patch already applied or ambiguous"
    assert b"A1813_SAFE_TO_RESTORE=false" in data, "A18-13 fail-closed gate missing"
    return data.replace(b, a, 1)

if __name__ == "__main__":
    args = sys.argv[1:]
    reverse = bool(args and args[0] == "--reverse")
    if reverse: args = args[1:]
    if len(args) != 2: raise SystemExit("source and output paths required")
    src = Path(args[0]).read_bytes()
    dst = apply(src, reverse)
    assert apply(dst, not reverse) == src, "reverse byte identity failed"
    Path(args[1]).write_bytes(dst)
