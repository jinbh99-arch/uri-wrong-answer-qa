"""A18-21 small, byte-reversible QA-only navigation guard.
Only guards user-click navigation away from a detail view containing unsaved parent memo text.
Does not alter IDB, deletion/restore, authentication, or exported data.
"""
from pathlib import Path
import argparse

BEFORE = b"document.addEventListener('click',e=>{const nav=e.target.closest('[data-route]');"
AFTER = (
    b"document.addEventListener('click',e=>{"
    b"const destination=e.target.closest('[data-route],[data-record]');"
    b"const unsavedParentMemo=$('check-memo');"
    b"if(route==='detail'&&destination&&unsavedParentMemo?.value.trim()){"
    b"const stayingOnSameRecord=destination.hasAttribute('data-record')&&destination.dataset.record===detailId;"
    b"if(!stayingOnSameRecord){"
    b"e.preventDefault();"
    b"notify('\\xec\\xa0\\x80\\xec\\x9e\\xa5\\xed\\x95\\x98\\xec\\xa7\\x80 \\xec\\x95\\x8a\\xec\\x9d\\x80 \\xed\\x95\\x99\\xeb\\xb6\\x80\\xeb\\xaa\\xa8 \\xea\\xb4\\x80\\xec\\xb0\\xb0 \\xeb\\xa9\\x94\\xeb\\xaa\\xa8\\xea\\xb0\\x80 \\xec\\x9e\\x88\\xec\\x8a\\xb5\\xeb\\x8b\\x88\\xeb\\x8b\\xa4. \\xeb\\xa9\\x94\\xeb\\xaa\\xa8\\xeb\\xa5\\xbc \\xec\\xa0\\x80\\xec\\x9e\\xa5\\xed\\x95\\x98\\xea\\xb1\\xb0\\xeb\\x82\\x98 \\xeb\\x82\\xb4\\xec\\x9a\\xa9\\xec\\x9d\\x84 \\xec\\xa7\\x80\\xec\\x9a\\xb4 \\xeb\\x92\\xa4 \\xec\\x9d\\xb4\\xeb\\x8f\\x99\\xed\\x95\\x98\\xec\\x84\\xb8\\xec\\x9a\\x94.');"
    b"return;}}"
    b"const nav=e.target.closest('[data-route]');"
)
# Decode the escaped Korean text to UTF-8 bytes while preserving the ASCII JS
AFTER = AFTER.replace(
    b"'\\\\xec\\\\xa0\\\\x80\\\\xec\\\\x9e\\\\xa5\\\\xed\\\\x95\\\\x98\\\\xec\\\\xa7\\\\x80 \\\\xec\\\\x95\\\\x8a\\\\xec\\\\x9d\\\\x80 \\\\xed\\\\x95\\\\x99\\\\xeb\\\\xb6\\\\x80\\\\xeb\\\\xaa\\\\xa8 \\\\xea\\\\xb4\\\\x80\\\\xec\\\\xb0\\\\xb0 \\\\xeb\\\\xa9\\\\x94\\\\xeb\\\\xaa\\\\xa8\\\\xea\\\\xb0\\\\x80 \\\\xec\\\\x9e\\\\x88\\\\xec\\\\x8a\\\\xb5\\\\xeb\\\\x8b\\\\x88\\\\xeb\\\\x8b\\\\xa4. \\\\xeb\\\\xa9\\\\x94\\\\xeb\\\\xaa\\\\xa8\\\\xeb\\\\xa5\\\\xbc \\\\xec\\\\xa0\\\\x80\\\\xec\\\\x9e\\\\xa5\\\\xed\\\\x95\\\\x98\\\\xea\\\\xb1\\\\xb0\\\\xeb\\\\x82\\\\x98 \\\\xeb\\\\x82\\\\xb4\\\\xec\\\\x9a\\\\xa9\\\\xec\\\\x9d\\x84 \\\\xec\\\\xa7\\\\x80\\\\xec\\\\x9a\\\\xb4 \\\\xeb\\\\x92\\\\xa4 \\\\xec\\\\x9d\\\\xb4\\\\xeb\\\\x8f\\\\x99\\\\xed\\\\x95\\\\x98\\\\xec\\\\x84\\\\xb8\\\\xec\\\\x9a\\\\x94.'",
    "'저장하지 않은 학부모 관찰 메모가 있습니다. 메모를 저장하거나 내용을 지운 뒤 이동하세요.'".encode('utf-8')
)

def apply(data: bytes, reverse: bool = False) -> bytes:
    old, new = (AFTER, BEFORE) if reverse else (BEFORE, AFTER)
    if data.count(old) != 1:
        raise AssertionError(f'A18-21 patch anchor uniqueness failed: reverse={reverse}, count={data.count(old)}')
    patched = data.replace(old, new, 1)
    if not reverse and apply(patched, True) != data:
        raise AssertionError('A18-21 forward / reverse bytes mismatch')
    return patched

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--reverse', action='store_true')
    parser.add_argument('path', nargs='?', default='index.html')
    args=parser.parse_args()
    path=Path(args.path)
    original=path.read_bytes()
    path.write_bytes(apply(original,args.reverse))
    print('A1821_QA_PATCH_REVERSED' if args.reverse else 'A1821_QA_PATCH_APPLIED')
