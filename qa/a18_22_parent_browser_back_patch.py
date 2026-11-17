"""A18-22 browser back/native unload guard. A-only reversible byte patch.
The browser controls its native warning text; this is NOT guaranteed on mobile or tab termination.
Never changes IndexedDB or photo/record formats.
"""
from pathlib import Path
import argparse

BEFORE = """window.scrollTo(0,0)}
document.addEventListener('click',e=>{
const destination=e.target.closest('[data-route],[data-record]');""".encode("utf-8")
AFTER = """window.scrollTo(0,0)}
window.addEventListener('beforeunload',event=>{
  if(route==='detail'&&$('check-memo')?.value.trim()){
    event.preventDefault();
    event.returnValue='';
  }
});
document.addEventListener('click',e=>{
const destination=e.target.closest('[data-route],[data-record]');""".encode("utf-8")

def apply(data:bytes,reverse:bool=False)->bytes:
    old,new=(AFTER,BEFORE) if reverse else (BEFORE,AFTER)
    assert data.count(old)==1,f"A18-22 anchor must be unique reverse={reverse}"
    output=data.replace(old,new,1)
    if not reverse:
        assert apply(output,True)==data,"A18-22 reverse bytes differ"
    return output

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--reverse",action="store_true")
    ap.add_argument("path",nargs="?",default="index.html")
    args=ap.parse_args()
    path=Path(args.path);original=path.read_bytes()
    path.write_bytes(apply(original,args.reverse))
    print("A1822_REVERSE_BYTES_PASS" if args.reverse else "A1822_PATCH_APPLIED")
