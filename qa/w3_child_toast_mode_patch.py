"""W3 isolated QA-only child-mode notification scrub; exact reversible byte patch.
Never apply to product dev/main without a separate approval.
"""
from pathlib import Path
import sys

BEFORE = (b"   if(mode==='child'){\n"
          b"    $('wrong-parent-needs-help-queue')?.replaceChildren();")
AFTER = (b"   if(mode==='child'){\n"
         b"    // QA-only: remove previous parent toast AFTER all draft-block guards pass.\n"
         b"    clearTimeout(toastTimer);\n"
         b"    $('toast').textContent='';\n"
         b"    $('toast').classList.add('hide');\n"
         b"    $('wrong-parent-needs-help-queue')?.replaceChildren();")

def apply(data, reverse=False):
    src,dst = (AFTER,BEFORE) if reverse else (BEFORE,AFTER)
    if data.count(src)!=1 or data.count(dst)!=0:
        raise ValueError('W3 toast patch source mismatch or already applied')
    return data.replace(src,dst,1)

if __name__=='__main__':
    f=Path('index.html')
    old=f.read_bytes()
    new=apply(old, '--reverse' in sys.argv[1:])
    assert apply(new, reverse='--reverse' not in sys.argv[1:])==old
    f.write_bytes(new)
    print('W3_CHILD_TOAST_REVERSIBLE_PATCH_PASS reverse='+str('--reverse' in sys.argv[1:]))
