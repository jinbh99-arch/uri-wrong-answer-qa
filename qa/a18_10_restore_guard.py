#!/usr/bin/env python3
"""A18-10 fail-closed restore UI patch. Run only against an isolated copy of dev/index.html.
Usage: python3 qa/a18_10_restore_guard.py path/to/index.html
Refuses unknown/changed source and never edits production automatically.
"""
from pathlib import Path
import sys

BUTTON = '<button class="secondary" id="import-json" type="button">📤 백업 복원</button>'
GUARDED_BUTTON = '<button class="secondary" id="import-json" type="button" disabled aria-describedby="a18-10-restore-block">📤 백업 복원 (안전 검증 대기)</button><p id="a18-10-restore-block" class="notice" role="alert">⚠️ 현재 복원은 차단되어 있습니다. 다른 탭의 기록이 A→B→A로 바뀌어도 기존 비교 검사가 이를 놓칠 수 있습니다. 원자적 변경 이력 검증 전에는 복원 안전을 확인할 수 없습니다. 사진·오답·확인 이력은 변경하지 않습니다. 현재 자료를 별도 백업해 보관하세요.</p>'
FILE_INPUT = "<input accept=\".json,application/json\" class=\"sr\" id=\"import-file\" type=\"file\"/>"
GUARDED_INPUT = "<input accept=\".json,application/json\" class=\"sr\" id=\"import-file\" type=\"file\" disabled aria-describedby=\"a18-10-restore-block\"/>"
FINAL_ANCHOR = "<!-- WRONG isolated QA keyboard fix: mobile nav labels wrap rather than exceed visible width at CSS200. -->"
FINAL_SCRIPT = "<!-- A18-11 QA-only last-resort entry guard: applies AFTER all in-app restore wrapper assignments. -->\n<script id=\"wrong-a18-11-final-restore-guard\">\n(()=>{'use strict';\n const trigger=document.getElementById('import-json'),file=document.getElementById('import-file');\n if(!trigger||!file)return;\n const block=e=>{\n  if(e&&typeof e.preventDefault==='function')e.preventDefault();\n  if(e&&typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();\n  file.value='';\n  const status=document.getElementById('a18-10-restore-block');\n  if(status)status.textContent='⛔ 복원 차단 유지: 두 시점 비교만으로는 중간 A→B→A 변경을 감지할 수 없습니다. 원본 사진·오답·학부모 관찰 이력을 보존하세요.';\n  return false;\n };\n trigger.disabled=true;file.disabled=true;\n trigger.onclick=block;file.onchange=block;\n file.addEventListener('change',block,true);file.addEventListener('click',block,true);\n})();\n</script>\n"
PICKER = "$('import-json').onclick=()=>{$('import-file').click()};"
GUARDED_PICKER = "$('import-json').onclick=()=>{notify('복원은 변경 이력의 원자적 검증 전까지 차단됩니다. 기존 자료를 보존하세요.')};"
HANDLER = "$('import-file').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;"
GUARDED_HANDLER = "$('import-file').onchange=async e=>{e.target.value='';notify('복원은 변경 이력의 원자적 검증 전까지 차단됩니다. 기존 자료를 보존하세요.');return;/* A18-10 fail closed: legacy handler intentionally unreachable */const file=null;if(!file)return;"

def patch(source: str) -> str:
    for before, after in ((BUTTON, GUARDED_BUTTON), (FILE_INPUT, GUARDED_INPUT), (PICKER, GUARDED_PICKER), (HANDLER, GUARDED_HANDLER)):
        if source.count(before) != 1:
            raise ValueError("expected exactly one source anchor; no file written: " + before[:80])
        source = source.replace(before, after, 1)
    if source.count(FINAL_ANCHOR) != 1:
        raise ValueError('expected unique final script insertion point')
    return source.replace(FINAL_ANCHOR, FINAL_SCRIPT + FINAL_ANCHOR, 1)

def unpatch(source: str) -> str:
    if source.count(FINAL_SCRIPT) != 1:
        raise ValueError('QA final guard missing or duplicated')
    source = source.replace(FINAL_SCRIPT, '', 1)
    for before, after in reversed(((BUTTON, GUARDED_BUTTON), (FILE_INPUT, GUARDED_INPUT), (PICKER, GUARDED_PICKER), (HANDLER, GUARDED_HANDLER))):
        if source.count(after) != 1:
            raise ValueError('cannot safely reverse: changed guard source')
        source = source.replace(after, before, 1)
    return source

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: a18_10_restore_guard.py <isolated-index.html>")
    p = Path(sys.argv[1])
    original = p.read_text(encoding="utf-8")
    revised = patch(original)
    assert revised.count('id="a18-10-restore-block"') == 1
    assert revised.count("A18-10 fail closed") == 1
    assert unpatch(revised) == original
    p.write_text(revised, encoding="utf-8")
    print("A18-10 isolated restore UI patch applied; product dev untouched")

if __name__ == "__main__":
    main()
