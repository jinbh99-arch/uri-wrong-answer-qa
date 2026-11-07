# 우리아이 오답노트 GitHub 백업 운영기준 v1.0

작성: 2026-11-08 (KST). 범위: 공개 **격리 QA 개발 저장소** `jinbh99-arch/uri-wrong-answer-qa`만 해당.

## 1. 기준과 복구점

- 운영 Netlify, 타 프로젝트 GitHub Pages, 브라우저 저장소(IndexedDB)는 변경하지 않는다.
- v2.28 / QA8 원본 소스 기준 커밋: `eba3f38af04f8d92a2e9fbf2466c5232881f9efa`.
- 해당 시점의 별도 보존 **브랜치**: `backup/baseline-v2.28-qa8-20261108`.
- 보존 브랜치는 **불변 태그가 아니며**, 권한 보유자가 이동/삭제할 수 있다. 복구 시 반드시 위 커밋 SHA와 대조한다.
- 이 시점의 자동 QA8 보고: Chromium 53개 시나리오·산술 1,142개 성공. 실제 기기·교육 전문가·운영 승인과는 별개이다.

## 2. 개발 소스 백업 방식

1. 변경 이력: GitHub `main`의 커밋 이력으로 추적한다.
2. 기준점: 승인된 중요 변경 시 복구용 브랜치/태그와 전체 SHA를 기록한다.
3. 자동 스냅샷: `.github/workflows/source-backup.yml`의 GitHub Actions가 아래 시점에 실행되도록 설정한다.
   - `main`의 주요 소스·테스트·QA 보고서·백업 파일 변경 후 자동 실행.
   - 매주 월요일 **한국시간 정오**(UTC 03:00) 정기 실행.
   - GitHub Actions의 **Run workflow**를 통해 수동 실행 가능.
4. `scripts/create_source_snapshot.py`는 Git이 추적하는 공개 QA 소스·QA 문서·검사 코드만 선별한다.
5. 생성하는 ZIP에는 `snapshot/source/`, 파일별 SHA-256 `snapshot/SHA256SUMS.txt`, 기준 커밋·파일별 크기/해시가 포함된 `snapshot/MANIFEST.json`, 복구 설명을 넣는다.
6. 압축 작성 직후 ZIP CRC와 압축 내부 전체 파일의 SHA-256을 검사한다. ZIP 자체 SHA-256은 별도 `.zip.sha256`로 기록한다.
7. 성공한 GitHub Actions 실행에서 ZIP과 SHA-256 확인 파일을 **Artifacts**로 내려받는다. 아티팩트의 보존 요청 기간은 30일이며 저장소 정책에 따라 더 짧을 수 있다.
8. 중요한 버전마다 ZIP을 **GitHub 밖의 안전한 저장공간**에도 다운로드하여 별도로 보관해야 실제 독립 백업이 된다.

## 3. 포함 / 제외

**포함:** `index.html`, `check.html`, `README.md`, `QA*.md`, `tests/*.mjs`, `scripts/*.py`, `docs/*.md`, `.github/workflows/*.yml|yaml` 중 Git 추적 파일.

**제외:** `.git`, 로컬 설치 패키지, 임시 테스트 결과, 브라우저 IndexedDB, 실제 아이 이름·문항 사진·학습 기록, 개인 계정·비밀키, 과거 라이브러리 ZIP, 다른 사이트/저장소의 코드.

이 자료는 **공개 QA 소스 백업**이며 가정/학생 개인정보의 백업이 절대 아니다.

## 4. 복구 절차

1. GitHub 코드가 필요하면 해당 기준 커밋 또는 보존 브랜치부터 확인한다.
2. 내려받은 `.zip`의 SHA-256을 옆의 `.zip.sha256`과 비교한다.
3. 새 임시 디렉터리에 풀고 `snapshot/MANIFEST.json`과 `snapshot/SHA256SUMS.txt`로 파일별 SHA-256을 검증한다.
4. `snapshot/source/`를 별도 시험 작업폴더로 복사하고 자동 QA 검사 및 실제 화면 동작을 다시 확인한다.
5. 실제 운영 사이트 배포는 별도 승인·데이터 호환성·모바일 실기기 검사를 거친 후 수행한다. 운영 중인 DB나 사진을 자동으로 덮어쓰지 않는다.

## 5. 검증 상태와 제한

- GitHub Actions 파일 추가 = 자동 백업 **설정**. 실제 성공은 해당 워크플로 실행 기록과 생성 아티팩트를 확인한 뒤에만 인정.
- GitHub 내부 보존 브랜치/커밋/Actions 아티팩트는 서로 다른 형태의 복구 수단이지만 **동일 사업자(GitHub)에 종속**된다.
- GitHub Actions 스케줄은 지연·생략될 수 있으며 장기 미활성 시 비활성화될 수 있다. 주간 백업 성공 여부 확인이 필요하다.
- GitHub에는 실제 사용자 데이터, 브라우저 백업 JSON, 개인 사진, 비밀번호, API 키를 넣지 않는다.
- 학부모의 브라우저 오답·사진 복원은 **설정 > 기록·사진 백업(JSON)** 경로에서 따로 처리한다.
- 과거 `uri-ai-leveltest_integrated_handoff_v4.6.zip` 및 v4.7~v4.9 증분은 라이브러리 역사자료로 보존하되, 본 QA 저장소에 복사해 올리지 않는다.

## 6. 점검표

- [ ] 기준 브랜치와 SHA가 조회되는가?
- [ ] 해당 소스의 QA 검사 결과가 구분되어 있는가?
- [ ] 최신 `Source snapshot backup` Actions 실행이 성공했는가?
- [ ] ZIP과 `.sha256`이 아티팩트로 존재하는가?
- [ ] GitHub 외부 독립 사본이 존재하는가? (확인하지 않았으면 '미확인')
- [ ] 테스트 폴더에 압축을 풀어 실제 복원해 보았는가? (미검증이면 '미검증')
- [ ] 사용자 데이터가 공개 저장소·아티팩트에 들어가지 않았는가?
