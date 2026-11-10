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
out=root/"wrong-child-next-p0-pc"
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
index_blob="732000a95c815cce86edaff2f52085a83188b587"
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
guide="""우리아이오답노트 비운영 PC 아이 첫 화면 v1.3 (2026-11-10)
실행 코드 Git SHA: """+source_sha+"""
제품 index.html Git blob: """+index_blob+"""

※ 실제 아동 이름/학교/가족/사진/계정/개인정보를 절대 입력하지 마세요.
※ 비운영 로컬 시연본이며 기존 공개 GitHub Pages/Netlify와 다릅니다.
※ 부모/아이 화면 선택은 권한 인증이나 접근통제 서비스가 아닙니다.
※ 기록된 문제의 최근 3개를 중립적으로 미리 표시하고, 아이가 직접 골라 재풀이합니다.
※ 취약 개념, 오답 원인, 정답·점수·복습 순위를 자동 판정하거나 저장하지 않습니다.
※ 일반 비수학 학습 질문 카드는 교육과정 공식 검증/정답 진단이 아닙니다.
※ 로컬 브라우저 IndexedDB에만 저장됩니다. 브라우저 삭제/변경 시 손실 위험이 있습니다.

실행 방법: ZIP 압축을 푼 뒤 Python3 설치한 PC에서
Windows start_windows.bat / Mac·Linux sh start_mac_linux.sh
또는 해당 폴더에서 python3 -m http.server 43173 --bind 127.0.0.1
동일 PC 웹브라우저 http://127.0.0.1:43173/
파일을 file://로 직접 열지 마세요. 종료는 실행 터미널 Ctrl+C.

가상 시연:
1. 학부모 화면에서 5과목 가상 오답 등록(동봉 가상 사진 PNG만 사용).
2. 상단 '아이 학습 화면' → 첫 화면 '오늘 다시 풀 한 문제'에서 하나 고르기.
3. 화면에 3개가 보이며, 더 많은 문제는 '전체 오답 목록'에서 선택.
4. 기존 상세에서 사진 확인 → 재풀이 답과 이유 작성 → 저장.
5. 부모 화면에서 아이 설명을 읽고 관찰 상태를 직접 선택하여 저장.
6. 설정에서 전체 JSON 백업 → 별도 빈 브라우저에서 복원 확인.
7. 0건이면 안내만 보입니다. 기존 수학 시범·비수학 활동 카드는 유지됩니다.

실기기/실아동/실가족 인증·동의·교육 효과·운영 배포/보안 검증은 별도입니다.
"""
(out/"실행_안내.txt").write_text(guide,encoding="utf-8")
(out/"start_windows.bat").write_bytes(
 b'@echo off\r\ncd /d "%~dp0"\r\necho http://127.0.0.1:43173/\r\n'
 b'where py >nul 2>&1\r\nif %errorlevel%==0 (py -3 -m http.server 43173 --bind 127.0.0.1) else (python -m http.server 43173 --bind 127.0.0.1)\r\npause\r\n'
)
(out/"start_mac_linux.sh").write_text('#!/bin/sh\ncd "$(dirname "$0")"\necho http://127.0.0.1:43173/\nexec python3 -m http.server 43173 --bind 127.0.0.1\n',encoding="utf-8")
(out/"start_mac_linux.sh").chmod(0o755)
manifest=dict(kind="WRONG_CHILD_NEXT_ONE_PC_NONOPERATING",source_commit=source_sha,
 base_commit="da0d969a8b4d6838f40804958b4561c389950625",index_git_blob=index_blob,
 local_origin="http://127.0.0.1:43173",source_files=entries,
 real_children=0,production_approved=False,synthetic_only=True,
 new_db_fields=False,auto_grading=False,official_curriculum_claimed=False)
(out/"RC_MANIFEST.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
name="WRONG_CHILD_NEXT_ONE_PC_v1.3_20261110.zip"
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
(root/"WRONG_CHILD_NEXT_ONE_PC_v1.3_20261110_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("WRONG_CHILD_NEXT_RC_PACKAGE="+json.dumps(report,ensure_ascii=False))
