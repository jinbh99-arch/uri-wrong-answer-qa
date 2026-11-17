"""A18-21 isolated minimal parent draft navigation guard, byte-reversible.
Preserves the pending observation text after a failed save. Does not touch IndexedDB.
"""
from pathlib import Path
import argparse

BEFORE = "document.addEventListener('click',e=>{const nav=e.target.closest('[data-route]');".encode('utf-8')
AFTER = """document.addEventListener('click',e=>{
const destination=e.target.closest('[data-route],[data-record]');
const unsavedParentMemo=$('check-memo');
if(route==='detail'&&destination&&unsavedParentMemo?.value.trim()){
  const sameRecord=destination.hasAttribute('data-record')&&destination.dataset.record===detailId;
  if(!sameRecord){
    e.preventDefault();
    notify('저장하지 않은 학부모 관찰 메모가 있습니다. 메모를 저장하거나 내용을 지운 뒤 이동하세요.');
    return;
  }
}
const nav=e.target.closest('[data-route]');""".encode('utf-8')

def apply(data: bytes, reverse: bool = False) -> bytes:
    old,new=(AFTER,BEFORE) if reverse else (BEFORE,AFTER)
    assert data.count(old)==1, f"A18-21 anchor mismatch reverse={reverse}"
    out=data.replace(old,new,1)
    if not reverse:
        assert apply(out,True)==data, "A18-21 reverse patch not identical"
    return out

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--reverse', action='store_true')
    parser.add_argument('path', nargs='?', default='index.html')
    args=parser.parse_args()
    f=Path(args.path)
    f.write_bytes(apply(f.read_bytes(), args.reverse))
    print('A1821_PATCH_REVERSE_PASS' if args.reverse else 'A1821_PATCH_APPLIED')
