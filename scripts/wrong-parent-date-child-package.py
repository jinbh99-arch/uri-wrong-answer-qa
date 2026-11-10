#!/usr/bin/env python3
"""Nonoperating deterministic PC RC from the existing 9-source product bundle."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

root=Path.cwd()
out=root/"wrong-parent-date-child-p0-pc"
assert not out.exists(), "Do not overwrite an existing package"
out.mkdir()
items=[
 "index.html","check.html","qa-family-sync-lab.html",
 "scripts/qa-inapp-sync-bridge.mjs","scripts/qa42-app-http-bridge.mjs",
 "scripts/qa44-supabase-auth-lab.mjs","scripts/qa44-supabase-auth-adapter.mjs",
 "scripts/qa47-live-auth-lab.mjs","scripts/qa47-public-stage-config.mjs"
]
source_sha=os.environ.get("WRONG_SOURCE_COMMIT")
if not source_sha:
 source_sha=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
assert len(source_sha)==40 and all(c in "0123456789abcdef" for c in source_sha)
def sha(b):
 return hashlib.sha256(b).hexdigest()
def git_blob(b):
 return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
# The actual Git blob of the modified product must match this pin.
index_blob="58754380d6fa764256100963d1a9da5d11873d19"
assert git_blob((root/"index.html").read_bytes())==index_blob
entries=[]
for rel in items:
 p=root/rel
 assert p.is_file() and not p.is_symlink()
 dst=out/rel;dst.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(p,dst)
 assert p.read_bytes()==dst.read_bytes()
 entries.append(dict(path=rel,bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
photo=bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fc1f000003030200edcbdf870000000049454e44ae426082")
(out/"가상_사진연습.png").write_bytes(photo)
guide="""우리아이오답노트 비운영 PC v1.4 · 부모 날짜와 아이 첫화면 연결 (2026-11-10)
실행본 Git SHA: """+source_sha+"""
index.html Git blob: """+index_blob+"""

※ 비운영 로컬 시연판, 운영 사이트·실가족 계정과 연결되지 않습니다.
※ 아이 실제 이름/학교/가족정보/사진 등 개인정보 사용하지 마세요.
※ 부모/아이 화면 전환은 비밀번호나 진짜 부모 인증이 아닙니다.
※ 수학의 기존 부모 복습 계획 날짜, 비수학의 수동 '다음 확인 메모' 날짜만 읽기 전용으로 표시합니다.
※ 메모 질문·상세 서술은 아이 홈에 표시하지 않습니다.
※ 날짜는 참고용이며 자동 푸시/학습 우선순위/완료/정답/취약 진단이 아닙니다.
※ 날짜가 없는 오답도 기존 최근3/전체목록에서 직접 선택할 수 있습니다.
※ 사진만 저장된 문제와 글 문제를 기존 화면에서 다시 풀 수 있습니다.
※ 브라우저 IndexedDB에 데이터가 저장됩니다. 백업 없이 저장소 삭제하지 마세요.

실행: 압축 해제 후 Python3 환경에서 Windows start_windows.bat
Mac/Linux sh start_mac_linux.sh
또는 python3 -m http.server 43173 --bind 127.0.0.1
같은 PC 브라우저 http://127.0.0.1:43173/
file:// 직접 열지 마세요. 서버 종료 Ctrl+C.

가상 체험:
1. 학부모 화면에서 가상 수학/국어 등 오답 등록(동봉 1px 가상 PNG 사용).
2. 수학 상세에서 기존 '복습 날짜'를 입력·저장.
3. 국어는 아이가 기존 재풀이 저장한 뒤 부모 화면의 '다음 확인 희망일' 메모 저장.
4. 아이 학습 화면 → '오늘 다시 풀 한 문제' 위쪽의 날짜 참고 카드 확인.
5. 날짜 카드에서 원하는 문제 직접 선택 → 기존 재풀이·내가 생각한 이유 저장.
6. 부모가 기존 관찰 기록에서 아이 설명 읽고 직접 관찰. 저장·JSON 백업/복원 유지.

실기기·실사용자·가족별 접근통제·교육 효과·운영 배포는 미검증입니다.
"""
(out/"실행_안내.txt").write_text(guide,encoding="utf-8")
(out/"start_windows.bat").write_bytes(
 b'@echo off\r\ncd /d "%~dp0"\r\necho http://127.0.0.1:43173/\r\n'
 b'where py >nul 2>&1\r\nif %errorlevel%==0 (py -3 -m http.server 43173 --bind 127.0.0.1) else (python -m http.server 43173 --bind 127.0.0.1)\r\npause\r\n'
)
(out/"start_mac_linux.sh").write_text('#!/bin/sh\ncd "$(dirname "$0")"\necho http://127.0.0.1:43173/\nexec python3 -m http.server 43173 --bind 127.0.0.1\n',encoding="utf-8")
(out/"start_mac_linux.sh").chmod(0o755)
manifest=dict(kind="WRONG_PARENT_DATE_CHILD_PC_NONOPERATING",source_commit=source_sha,
 base_commit="2953693af8a991540b85deb2b38df87fb52fd950",index_git_blob=index_blob,
 local_origin="http://127.0.0.1:43173",source_files=entries,
 real_children=0,production_approved=False,synthetic_only=True,
 new_db_fields=False,auto_grading=False,official_curriculum_claimed=False)
(out/"RC_MANIFEST.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
name="WRONG_PARENT_DATE_CHILD_PC_v1.4_20261110.zip"
with zipfile.ZipFile(root/name,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for f in sorted(out.rglob("*")):
  if not f.is_file():continue
  rel=f.relative_to(out).as_posix()
  info=zipfile.ZipInfo(rel,(2026,11,10,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  info.external_attr=((0o100755 if rel.endswith(".sh") else 0o100644)<<16)
  archive.writestr(info,f.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(root/name) as archive:
 assert archive.testzip() is None
 assert len(archive.namelist())==14
 for entry in entries:
  assert sha(archive.read(entry["path"]))==entry["sha256"]
digest=sha((root/name).read_bytes())
(root/(name+".sha256")).write_text(digest+"  "+name+"\n",encoding="utf-8")
report=dict(status="PASS",zip_name=name,zip_sha256=digest,
 index_blob=index_blob,source_commit=source_sha,
 tracked_source_files=9,zip_bytes=(root/name).stat().st_size)
(root/"WRONG_PARENT_DATE_CHILD_PC_v1.4_20261110_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("WRONG_PARENT_DATE_CHILD_RC_PACKAGE="+json.dumps(report,ensure_ascii=False))
