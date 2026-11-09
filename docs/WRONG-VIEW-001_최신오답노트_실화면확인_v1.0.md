# WRONG-VIEW-001 · 오답노트 최신 Draft 실제 화면 확인 안내 v1.0
검토일: 2026-11-10 KST · 담당: 오답노트 개발방 · 공통 `uri-homework-manager#52` §17

## 1. 무엇이 ‘최신 개발본’인가?

| 대상 | 확인된 소스 / 화면의 성격 | 최신 WRONG-008 포함 여부 | 안전한 보기 |
|---|---|---|---|
| **최신 오답노트 개발본** | [Draft PR #51](https://github.com/jinbh99-arch/uri-wrong-answer-qa/pull/51) / 기준 `187d8fe021953a7232e684f1c902211e063b57c3`, 원본 `index.html` | **예.** 오답별 5과목·1~6학년/복수 원인/일반 재풀이/부모 수동 다음 날짜 메모 | 아래 GitHub Actions의 **합성 실제 브라우저 화면 캡처 ZIP** 또는 동일 커밋의 로컬 HTTP 실행 |
| **기존 공개 시험용 GitHub Pages** | 저장소 README의 [QA 화면](https://jinbh99-arch.github.io/uri-wrong-answer-qa/) / GitHub `main` 기준 SHA `47b6645df5ac75a45b8038e4f416b1c53c6da949` | **아니오(소스 대조).** `main/index.html`에 `wrong008-next-review`, `wrong007-subject`, `wrong006-candidates` 및 `wrong002-journey`가 존재하지 않음. Pages가 `main`을 현재 실제 서빙한다는 최신 HTTP 응답 SHA는 미확인 | 기존 시범 UI를 참고하는 용도만. PR #51 화면이라고 안내 금지. 이 사이트에 실제 아이 자료 입력 금지 |
| **기존 운영 Netlify** | README에서 운영 Netlify 존재는 언급하나 **정확한 승인 URL·현재 코드 SHA·접속 화면은 이 검증의 근거에 없음** | **미확인 / 최신 개발본으로 간주 금지** | 접근·배포·로그인·운영 DB 변경하지 않음 |

> GitHub PR의 **Files changed**는 소스 차이를 읽는 화면이지 최신 웹앱을 직접 실행하는 주소가 아닙니다. GitHub의 Raw/Blob HTML 링크 역시 실제 운영 앱 URL이 아닙니다. `127.0.0.1`은 해당 PC 자신만의 로컬 주소로, 휴대전화에서 곧바로 접속하는 공유 주소가 아닙니다.

## 2. 지금 바로 보는 방법 — GitHub Actions 합성 화면 캡처 (추천)

1. 본 문서/PR에 기록된 **WRONG-VIEW-001 성공 Actions 링크**의 `Artifacts` 구역으로 이동합니다.
2. **`wrong-view-001-latest-draft-screenshots`** ZIP을 내려받아 압축을 풀면 **최신 Draft 실제 Chromium UI에서 합성 자료로 촬영한 PNG 9장**을 볼 수 있습니다. GitHub 다운로드에는 로그인 권한이 필요할 수 있습니다. 보관 기간은 Actions에서 14일 요청했고 저장소 정책에 따라 짧아질 수 있습니다.
3. 화면 순서는 아래와 같습니다. `390px`/ `320px`은 Chromium 가상 모바일 화면 폭이며 **실제 Android/iPhone 물리 기기 검증이 아님**.

| PNG | 실제 앱에서 확인한 장면 |
|---|---|
| `01_first-home-photo_390.png` | 부모 첫 화면: 사진부터 등록 |
| `02_korean-entry_grade-reasons_390.png` | 국어 3학년 오답·가상 사진·복수 원인 후보를 직접 입력하는 폼 |
| `03_records-five-subjects_390.png` | 수학·국어·영어·과학·사회 오답 목록 (가상 기록 5건) |
| `04_korean-detail-and-next-actions_390.png` | 오답 상세: 아이 다시 풀기 / 부모 직접 관찰 |
| `05_generic-retry-parent-review_390.png` | 국어 일반 재풀이 결과와 학부모 직접 관찰 |
| `06_parent-next-check-note_390.png` | 다음 확인 날짜·질문·‘확인 전’ 수동 메모 (정식 일정/알림 아님) |
| `07_parent-evidence-report_390.png` | 학부모 활동 보고서에서 실제 관찰과 단순 예정 메모 구분 |
| `08_backup-settings_390.png` | JSON 백업 버튼과 보존 안내 |
| `09_child-generic-retry_320.png` | 아이 320px 재풀이 입력 화면 (부모 전용 정보 숨김) |

**증거 생산 경로:** 신규 앱 소스 파일 없음. 기존 실브라우저 합성 테스트 `tests/wrong008-nonmath-manual-recheck.mjs`에 `page/locator.screenshot()`만 추가하고, 기존 `.github/workflows/qa-e2e.yml`의 안정된 Chromium 검사 후 `upload-artifact@v4`로 ZIP 업로드. 원본 `WRONG-008`의 10가지 검사와 WRONG-002~007, QA42 회귀를 제거하지 않음. 보안 정책·Netlify·실계정은 접촉하지 않음.

## 3. 직접 클릭해 보는 방법 — PC의 로컬 HTTP 미리보기

아래는 **독립된 시험용 PC에서만** 시행합니다. Git·Python 3가 필요하며 운영/공개 사이트를 만들지 않습니다.

```bash
git clone https://github.com/jinbh99-arch/uri-wrong-answer-qa.git
cd uri-wrong-answer-qa
git checkout 187d8fe021953a7232e684f1c902211e063b57c3
python3 -m http.server 4173 --bind 127.0.0.1
```

그 **PC와 같은 브라우저 장치**에서 `http://127.0.0.1:4173/`에 접속합니다. 터미널을 닫거나 Ctrl+C를 누르면 로컬 미리보기가 종료됩니다. 운영 서비스 계정·실자료를 연결하지 않고 **국어 3학년 가상 문제** 등을 입력해 직접 살펴봅니다.

- **부모 모드** → **오답 등록** → 국어(또는 영어·과학·사회), 학년과 가상 문장 입력 → 원인 후보 복수 선택 → 저장.
- **오답 목록**에서 해당 기록 → **아이 학습 화면**에서 **다시 풀기** → 아이의 가상 풀이 저장 → **부모 화면**으로 전환해 일반 재풀이의 학부모 관찰, 별도의 오답 확인 `checkHistory` 관찰을 직접 기록.
- 같은 기록에서 **‘④ 다음에 다시 확인할 날짜 메모하기’**를 찾아 희망 날짜와 질문을 직접 입력해 수동 메모 저장 → 홈 보고서에서 실제 관찰 건수와 단순 예정 메모가 혼동되지 않는지 확인 → **설정 → JSON 백업** 확인.
- 수학 오답의 공식 개념 그래프/성취기준은 교사 검증된 정본이 아니라 **미검증 AI 시범/수동 연결**임을 인지합니다. 비수학에서 수학 전용 내용이 나타나면 문제입니다.
- `file://`로 HTML을 직접 열면 IndexedDB/브라우저 보안 제약 때문에 동일 동작이 보장되지 않으므로, 위 로컬 HTTP를 사용합니다. 개인 실계정·사진/학교/아이 이름은 입력 금지.

## 4. 검증 및 완료 경계

- **기존 근거:** [WRONG-008 최종 합성 E2E Actions #42702670801](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/42702670801) `completed/success` — 최종 SHA `187d8fe…`, 신규 10/10, 실제 Chromium 390/320px, 사진2장/5과목5ID/부모관찰/수동 날짜 메모/JSON 백업·복원, 기존 WRONG002~007·QA42 성공. **성공 실행에는 화면 캡처 아티팩트가 없었음**(GitHub API 목록 조회 0건).
- **이번 VIEW 전용 변경:** 앱 `index.html`·기존 저장소/비즈니스 로직 변경 **0건**. 기존 테스트에서 같은 장면을 PNG로 캡처하는 것과 CI에 자동 보관 단계만 추가한 후속 Draft. 해당 CI가 `completed/success`이고 동일 SHA일 때만 캡처 검증을 ‘완료’로 판정한다.
- **미수용:** 공개 클릭형 최신 배포 URL, 물리 Android/iOS, 실학생·교사·법정대리인 및 접근권한 검증, 공식 성취기준 교육적 타당성, 운영 Netlify/Supabase·실가족 동기화, 정식 비수학 자동 복습 스케줄·알림, 타서비스 ID/UUID 공식 매핑. 소스·캡처만으로 출시 승인을 뜻하지 않음.
