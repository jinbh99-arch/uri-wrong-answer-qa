# 02 WRONG A18-16a 정상/잠금 저장소 삭제 안내 접근성 — 실제 격리 브라우저 v1.0

수행일 2026-11-17 KST · 총괄 #82 [6948556832](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6948556832) · 기준 QA `qa/wrong-a18-16-clear-accessibility-20261117-2035@2a070c134511a6b402f3f3c7154c0ab610e1f55f` · 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변.

## 문제와 수정 이유
직전 A18-16은 버튼 이름·역할·초점을 **정적으로 읽는 테스트 코드**만 등록. 실제 정상(`storageOk=true`)/잠금(`storageOk=false`) 독립 fixture를 만들지 않았고 동적 경고가 지속적인 화면읽기 live region에 들어가는지 시험하지 않아 PASS 미판정이었다. 기존 `#toast`는 `role=status`지만 `.hide{display:none!important}`로 평상시 숨겨졌다가 `notify`와 함께 노출된다. 실제 보조기기에서 안내가 읽힐지는 그 방식만으로 보장할 수 없으므로 삭제 안내 고유의 **항시 DOM에 존재하는** `role=status aria-live=polite aria-atomic=true` 영역을 QA 실제 앱에 추가하였다.

## 격리 QA 실제 변경
- 브랜치: `qa/wrong-a18-16a-clear-live-state-browser-20261117-2200`.
- `index.html` 실제 QA 사본: 삭제 버튼 **직후** `#a18-16-clear-live` 상시 상태영역 1개 추가. 정상/잠금 분기를 `a1816ExplainBlockedClear`로 모아 **실제 삭제 보류 경고 + 기존 toast**와 동일 문구를 표시. 복원/삭제 차단 `A1813_SAFE_TO_RESTORE=false` 유지. **QA 전용** 비파괴 경고 진입점 `window.__wrongA1816ReadOnlyAnnounce`를 두어 삭제 버튼/IDB 쓰기 없이 해당 안내만 호출; 제품 이식 시 QA hook 제거 필요.
- `qa/a18_16a_clear_live_patch.py`: 고정 3앵커 전·역 적용, 원문 변동·중복 적용 시 실패. 역패치 검사 첫 실행에서 함수 앵커가 신규 함수 안에도 포함되는 것을 기존 중복으로 잘못 인식하던 검사기 결함 발견→reverse 검사만 수정.
- `tests/wrong-a18-16a-live-keyboard-fixtures-chromium.mjs`: 앱의 실제 IndexedDB 동일 이름에 정상 `profile` 또는 정상 `profile`+알 수 없는 `pending` 키를 주입한 **독립 브라우저 컨텍스트 4개**, 각 앱 reload 후 실제 연결/차단 상태 확인. 설정 저장 버튼에서 **실제 키보드 Tab**으로 삭제 버튼에 초점이 도착하는지, outline/버튼 accessible name/role, 상시 live region 갱신을 MutationObserver로 검증. `window.__wrongA1816ReadOnlyAnnounce`로 경고를 안전하게 호출(클릭하지 않음), IDB 전후 snapshot 동일성 확인.
- `.github/workflows/wrong-a18-16a-clear-live.yml`: 신규 Chromium QA/PNG/JSON; 제품 브랜치/실 DB/배포 영향 없음.

## 실행 로그·증거
- 1차 [CI 44088774942](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44088774942): 역패치 검사 자체의 포함관계 오류로 실패. **QA HTML/저장 기능 결함 아님**. generator 수정 후 재검.
- 최종 **[CI 44088929366 SUCCESS](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44088929366)** / job `134058651225`. 소스 `index.html` 실제 앱 Git blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35`.
- **실제 Python 원본 전·역 패치 전체 바이트 일치**: `A1816A_REAL_APP_REVERSE_ORIGINAL_BYTES_PASS`.
- Chrome Chromium **320px 정상, 320px 잠금, 390px 정상, 390px 잠금 4/4 PASS**, live mutation **4건**, PNG **4장**, JSON **1건**, 클릭 0/파괴적 변경 0/외부 요청 0/JS 오류 0/앱 원본 읽기 시험 중 변경 0.
- [증거 아티팩트 `14329879076`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44088929366/artifacts/14329879076) `qa-proof/wrong-a18-16a/*` = 정상/잠금 320/390 각 PNG와 JSON. **화면읽기 기기가 실제 음성으로 읽었다는 증거는 아님**. 실제 학부모가 3분에 사용했다는 측정도 없음.

## 부모 핵심 동선 현재 판정·장애 1
- 오답 등록 화면 `#page-add`의 선택형 사진/텍스트 등록, 기록 상세 `#page-detail`의 `#wrong002-retry`→`#v230-answer`/저장 UI는 **코드상 연결되어 있음**. 이 부분의 전체 사용자 여정 실브라우저 실행은 **이번 CI에서 아직 안 했으므로 사용성 PASS 아님**.
- **명시한 핵심 장애 후보 1:** 안전 잠금(`storageOk=false`)이면 오답 등록/재풀이 저장 모두 차단되며, 부모가 저장소 원본을 어떻게 별도 보관해 복구해야 하는지 **즉시 동선으로 안내하는 UI 확인은 미완료**. 이 잠금은 데이터 보호의 의도된 동작이므로 우회 저장/삭제는 금지. 다음 최소 작업은 잠금 상태의 비파괴적인 원본 보관 안내→3분 학습동선 대체안 연결을 검증하고 QA 최소수정 여부 판단.
- 전체 정상 저장소에서 사진/오답 등록→재풀이→부모 기록까지의 실동선, 실제 OCR, 실가족, 화면읽기 VoiceOver/TalkBack, 실제 스마트폰, 제품 병합/배포/유료 API/원자 CAS 등은 **N/T**.

결론: **A18-16a A격리 QA 성공, 제품 dev 반영0**, `safeToRestore:false`, PR80 Draft/미병합, 삭제·복원 미실행. 코드·CI·원본/역패치 증거를 06 및 총괄에 인계; 사용자 조치 없음.
