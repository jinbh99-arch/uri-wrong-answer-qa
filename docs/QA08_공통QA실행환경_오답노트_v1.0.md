# 08 공통 QA 실행환경 — 02 오답노트 v1.0
기준일 2026-11-12 · 실사용/운영 승인 아님 · **합성 가상자료만 허용**

## 보존하는 대상과 실행 증거
- 기준 비운영 후보 HEAD: `b5219947a247a90753369a2d63681238fd222314`
- QA 브랜치: `qa/qa08-wrong-backup-harness-20261112`
- 검증된 테스트 SHA(최초 성공): `2f3ee199f607e71c829f84352a42c73da4b7f6bb`
- 최초 CI: https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43111931111 (completed/success)
- 실행 시험: `tests/qa08_plaintext_backup_browser.mjs`
- 자동화: `.github/workflows/qa08-wrong-backup.yml`
- CI 증거: 위 실행의 `qa08-wrong-backup-evidence` (320/390px PNG + 관찰 JSON만 포함)

## 개발방에서 로컬 재현(원본 업무 브랜치와 격리)
**이미 설치된 Node.js 22·Python 3·Chromium이 있다면 재사용**한다. 운영 사이트/계정은 접속하지 않는다.
```sh
git clone https://github.com/jinbh99-arch/uri-wrong-answer-qa.git qa08-wrong-local
cd qa08-wrong-local
git switch qa/qa08-wrong-backup-harness-20261112
npm install --no-save playwright@1.56.1
npx playwright install chromium
python3 -m http.server 4173 --bind 127.0.0.1
```
위 서버를 그대로 두고 **별도 터미널**에서 같은 저장소 폴더로 이동해 실행:
```sh
QA_BASE=http://127.0.0.1:4173/ node tests/qa08_plaintext_backup_browser.mjs
```
Windows에서는 환경변수 설정 문법을 셸에 맞게 변경하면 된다. 브라우저/패키지가 미설치된 로컬 PC에서만 위 설치가 필요하다. **GitHub Actions에서는 모두 자동 설치하며, 휴대전화에 별도 설치할 필요가 없다.**

## 검증 계약과 결과 해석
- 320/390px 독립 Chromium context, 가상 오답 1건과 가짜 PNG 1장만 입력. CSS 200% 상태에서 모달·초점 확인.
- 취소와 Escape 경로: download 이벤트 **각 0**, 파일 저장 없음, 원 버튼으로 초점 복귀.
- 명시 동의: download 이벤트 **1**, 실제 임시 JSON 파일 **1**, 백업 스키마·가상 기록·가상 사진 검사.
- 내보내기 전/후 IndexedDB의 오답 레코드와 사진 바이트 동등. 성공 시 `QA08_WRONG_RESULT={"status":"PASS",...}`; 최초 성공 검사는 **36/36**.
- `tests/artifacts/qa08-wrong-backup/`에 **합성 화면 PNG + 비식별 검사 JSON** 저장. 실제 다운로드한 평문 백업 JSON은 임시 파일에서 삭제하고 Actions Artifact에 보관하지 않음.
- **백업 생성이 안전한 복원·운영 개인정보 보호를 입증하는 것은 아님**. `safeToRestore:false` 유지. 실제 아이·사진·운영 DB·인증·클라우드 전송 불가.
- 네트워크·기기·로컬 브라우저 버전 차이로 실패하면 CI 로그의 해당 step과 `QA08_WRONG_RESULT`를 함께 인계. **기준 후보와 다른 SHA의 테스트 통과를 자동으로 인정하지 않는다.**

## 범위 및 인계
- 변경 허용 범위는 이 QA 브랜치의 테스트·CI·사용법 문서뿐. `main`, 정본 A, 원 Draft PR, 공개 배포/운영 인증·DB 변경 금지.
- GitHub #52 인계: https://github.com/jinbh99-arch/uri-homework-manager/issues/52#issuecomment-6808628800
- QA 브랜치를 단순 checkout만 해도 별도 지속 서버가 설치되는 것은 아니다. **GitHub Actions 가상 실행 환경은 매번 생성되고 종료**된다. 실제 제품 개발방에는 재현 명령과 GitHub 증거를 공유하는 방식이다.
