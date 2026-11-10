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
out=root/"wrong-nonmath-p0-pc"
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
 return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\\0"+b).hexdigest()
# The actual Git blob of the modified product must match this pin.
index_blob="faae9b784032a0c517ea5ab0800cf593e2db3e4e"
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
guide="""우리아이오답노트 비운영 PC 재학습 시연 v1.2 (2026-11-10)
실행 코드 Git SHA: """+source_sha+"""
제품 index.html Git blob: """+index_blob+"""

※ 아이 실제 이름/학교/사진/가족/계정/개인정보를 절대 입력하지 마세요.
※ 기존 서비스 main·공개 사이트와 다른 격리 PC 개발본이며 운영 승인 전입니다.
※ 부모/아이 보기모드는 로그인 인증·가족 권한이 아닙니다.
※ 선택식 질문 카드는 과목별 일반 예시이며 공식 성취기준·정답·AI 확정 진단이 아닙니다.
※ 질문 카드 선택은 저장되지 않고, 아이가 직접 쓴 답·설명과 부모 관찰만 기존 필드에 저장합니다.
※ 사진을 자동 인식하지 않으므로 사진을 직접 다시 보며 질문에 답해 주세요.
※ 저장은 현재 PC 브라우저 IndexedDB에 있습니다. 브라우저 데이터 삭제 전에 JSON 백업하세요.

실행: ZIP 압축 해제 후 폴더에서 Windows start_windows.bat를 실행 (Python3 필요).
Mac/Linux: sh start_mac_linux.sh
또는 python3 -m http.server 43173 --bind 127.0.0.1
같은 PC 브라우저에서 http://127.0.0.1:43173/
HTML을 file://로 직접 열지 마세요. 종료는 실행창 Ctrl+C.

가상 체험: 국어/영어/과학/사회 가상 오답 등록(사진은 동봉 가상 PNG만 사용)
→ 과목별 상세 → 질문·활동 카드 펼치기 → 활동 선택
→ 아이가 다시 푼 답과 자기 설명 직접 작성 → 학부모 원문 확인 및 관찰 기록
→ 설정에서 전체 JSON 백업 → 비어 있는 다른 브라우저에서 복원.
수학 개념 시범·이전 사진/ID·기록 구조는 변경되지 않았습니다.
실기기·실가족 로그인·교사 검증·학습효과·운영 배포는 미검증입니다.
"""
(out/"실행_안내.txt").write_text(guide,encoding="utf-8")
(out/"start_windows.bat").write_bytes(
 b'@echo off\\r\\ncd /d "%~dp0"\\r\\necho http://127.0.0.1:43173/\\r\\n'
 b'where py >nul 2>&1\\r\\nif %errorlevel%==0 (py -3 -m http.server 43173 --bind 127.0.0.1) else (python -m http.server 43173 --bind 127.0.0.1)\\r\\npause\\r\\n'
)
(out/"start_mac_linux.sh").write_text('#!/bin/sh\\ncd "$(dirname "$0")"\\necho http://127.0.0.1:43173/\\nexec python3 -m http.server 43173 --bind 127.0.0.1\\n',encoding="utf-8")
(out/"start_mac_linux.sh").chmod(0o755)
manifest=dict(kind="WRONG_NONMATH_P0_PC_NONOPERATING",source_commit=source_sha,
 base_commit="eaf87d1fafa830a4c0121df45df8616cd3eaa5de",index_git_blob=index_blob,
 local_origin="http://127.0.0.1:43173",source_files=entries,
 real_children=0,production_approved=False,synthetic_only=True,
 new_db_fields=False,auto_grading=False,official_curriculum_claimed=False)
(out/"RC_MANIFEST.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)+"\\n",encoding="utf-8")
name="WRONG_NONMATH_P0_PC_v1.2_20261110.zip"
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
(root/(name+".sha256")).write_text(digest+"  "+name+"\\n",encoding="utf-8")
report=dict(status="PASS",zip_name=name,zip_sha256=digest,
 index_blob=index_blob,source_commit=source_sha,
 tracked_source_files=9,zip_bytes=(root/name).stat().st_size)
(root/"WRONG_NONMATH_P0_PC_v1.2_20261110_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
print("WRONG_NONMATH_RC_PACKAGE="+json.dumps(report,ensure_ascii=False))
