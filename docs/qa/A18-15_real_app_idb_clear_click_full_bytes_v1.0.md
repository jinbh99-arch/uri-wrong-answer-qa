# 02 WRONG A18-15 — 실제 QA 앱 IndexedDB 사진·오답·부모이력·pending 삭제 클릭 전후 원본 바이트 검증 v1.0

**일시:** 2026-11-17 KST · **총괄 지시:** [#82 #6944778068](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6944778068), #87 18:58 커서. **기준:** 02 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변, PR #80 Draft, `safeToRestore:false`. A격리 QA에서 **실가족/실사진/운영DB/공개배포 사용0**.

## 1. 기존 검증 부족과 실제 원인

선행 [A18-14 CI #44048900520](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44048900520)은 **삭제 버튼 UX/클릭 전후 별도 sentinel**을 확인했으나, 앱의 실제 `uriaimath-github-qa-v224-only` IndexedDB에 보관된 `mistakes/photos/settings` 3스토어를 포괄하여 사진 **Blob 전체 바이트·학부모 `checkHistory`·미확정 `pending` 장부까지 읽는 검증은 하지 않았다. 따라서 기존 PASS를 데이터 보존 통과로 확장할 수 없었다.

이번 새 실제 앱 실행 중 **새 문제**도 확인했다: 미확정/알 수 없는 설정 키 `wrongA012PendingCreateV1`가 있는 저장소는 `v221InspectLiveSafety`의 설정 키 규칙에 의해 `storageOk=false`가 되고, `#clear-all`은 A18-14 위험 안내가 아니라 **일반 '저장소를 사용할 수 없습니다'** 안내만 띄웠다. **손상 pending은 실제 삭제된 것이 아니라, 사전 검사 단계에서 접근 차단된 것**이다. 보호 이유를 사용자에게 정확하게 알려야 한다.

## 2. A격리 국소 수정과 완전한 역패치

**새 QA 브랜치:** `qa/wrong-a18-15-real-idb-clear-click-evidence-20261117-1910`, A18-14 기준 `3ab034bc695984f926bd56141bcc6be63b0acb3f`.

- `index.html`: 기존 A18-14 `qa/a18_14_clear_ux.py`의 클릭 전 `A1813_SAFE_TO_RESTORE!==true` 안내를 **실제 앱 HTML QA 사본에 적용**하고, 추가로 `storageOk=false` 경계에서도 ‘전체 삭제는 복원 안전성 검증 전까지 보류됩니다. 기록과 사진은 그대로 유지됩니다. 안전 점검이 끝나기 전에는 삭제할 수 없습니다.’를 표시하는 **문구 1곳만** 국소 수정. 그 외 저장/복원 핸들러, 스토어, 프로필/자식/사진/계정 코드 변경0.
- `qa/a18_15_locked_clear_notice.py`: 저장소 잠금 상태 전용 안내 문구에 대한 적용/역적용 생성기. **두 단계 역패치** `unpatch15`→`unpatch14`로 기준 QA 원본 byte-for-byte 복원.
- `tests/wrong-a18-15-real-app-idb-clear-click-chromium.mjs`: A18-14 sentinel 재실행 **아님**. 실 앱의 동일 DB를 `mistakes`·`photos`·`settings` 3스토어 **하나의 readonly 트랜잭션**으로 읽어 모든 키/값과 이미지 Blob `arrayBuffer()` 전체 바이트를 캡처. 화면 `#clear-all` **실제 클릭 전/후** 원본 전체 JSON/해시 및 오답·사진·학부모 이력·모든 설정/pending 개별 동일성 비교, IDB의 파괴적 `readwrite` 호출 후킹으로 0건 단언. 새로고침 후 원본 재조회, 모바일 넘침·경고·사용자 확인 대화상자 검증.
- `.github/workflows/wrong-a18-15-real-idb-clear-click.yml`: 신규 실앱 CI 전용; Ubuntu 24.04, Playwright Chromium 1.56.1, HTML 정확 바이트 역적용/소스 blob 확인, JSON 및 320/390 전폭 PNG 업로드.
- **기준 앱 blob** `4734102b111b20b2185f9fe175ac0802eaebf5e5` → **최종 QA 앱 blob** `d611cb6e6b7d8afb70299fe96cca78e926a2670c`. GitHub Actions에서 `apply15(apply14(base))==candidate`, `reverse14(reverse15(candidate))==base` 실제 실행 통과. 앱의 파괴적 공통 게이트 `A1813_SAFE_TO_RESTORE=false` 유지.

## 3. 신규 브라우저 검증: 실패 → 원인 분리 → 국소 수정

1. **[첫 CI #44062526435](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44062526435) FAIL:** 복원 안 된 미확정 장부가 실제 앱 `storageOk=false`를 유발해 통상 삭제 경고 문구 대신 일반 오류 표시. 이는 **새 사용자 안내 누락**으로 분류. 보완 패치에서 잠금 상태에도 ‘삭제 보류·원본 보존’을 명시. 기존 A18-14 PASS 반복 금지.
2. **중간 CI #44062981025 FAIL:** 새 합성 fixture의 장부 식별자 기대값이 `a18-15`인데 주입값은 `a18-13`으로 남아 있어서 검사 도중 동일성 확인 전에 FAIL. **시험 데이터 불일치**, 데이터 삭제 증거 아님. 시험 seed/기대값 두 곳을 함께 정정.
3. **[최종 CI #44063235389](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44063235389) SUCCESS**, job `133970212362`:
   - **320px PASS, 390px PASS.** 실제 A격리 앱 DB에서 `mistakes` 오답 1개, 연결 `photos` Blob 1개 **68바이트 전부**, 학부모 `checkHistory` 1개, `settings`에서 미확정 `pending` 1개 확인.
   - **전체 3스토어 SHA256 클릭 전/후** 두 폭 모두 `f8b4037fa96e0e2036ef1a284830c5d26128152fa2905e7cd131f61d3f648c00` 동일.
   - 각각 별도 데이터 필드 `records/photos/settings` 깊은 동등성, `pending` 키·원ID·사진 원본 바이트·부모 이력 1개 보존. 재진입 후에도 원본 동일.
   - 사용자 확인창 **0건**, 본래 `#confirm-dialog.open=false`, 파괴적 쓰기 트랜잭션 **0건**, 외부 요청/JS pageerror **각 0건**, 화면 PNG **2장**, 테스트 도중 앱 소스 변경0.
   - 실제 앱 적용+두 단계 역패치 원본 **바이트 전체 일치**: `A1815_LOCKED_STORAGE_WARNING_PATCH_REVERSE_BYTES_PASS`.
   - [증거 아티팩트 `14319162178`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44063235389/artifacts/14319162178) (`result.json`+320/390 PNG2). **아티팩트 등록·CI 로그 확인. PNG 픽셀을 별도로 육안 확인했다는 주장 없음**.

## 4. 범위·한계·판정

**완료:** 실제 앱 격리 사본에 A18-14+15 안내 국소 패치, 미확정 pending 경계에서의 삭제 클릭 전/후 **실제 앱 3스토어 원본 바이트 대조** PASS, 소스 원복 PASS, GitHub CI/증거 등록.

**미검증/차단:** 실가족·실사진, 실제 사진 여러 개/대용량, 동시 탭의 실전 변경, 정상 `storageOk=true` 상태의 모든 설정/복원 경로, 운영 장부 수리·원자 CAS·복원 성공, 실폰·Safari, 공격자가 코드 직접 수정해 IndexedDB 쓰는 행위. 이 신규 PASS를 모든 데이터 안전/복원 안전/운영 PASS로 승격 금지.

**중요한 한계:** 이번 경계의 `pending`은 의도적으로 안전검사를 실패시키는 합성 장부다. 따라서 제품은 `storageOk=false`에서 버튼을 클릭하고 **보존 안내**를 보여준 것이다. 다른 깨끗한 저장소의 전체 삭제 정상 동작이나 원자적 변경 보증과 혼동하지 않는다. `safeToRestore:false` 유지.

**다음 제안(00 판단):** (1) 확인창 없는 잠금 상태 안내의 실사용 이해도·키보드/스크린리더 접근성 국소 점검, (2) `storageOk=true`와 `false`의 차이를 명확히 하는 안전 상태 UI 일원화, (3) A격리 테스트 전용 내부 함수 훅을 제품 이식 패치에서 제거한 경량 후보/06 독립검증. 기존 A18-11~14 PASS 반복 금지.

**승인 경계:** QA 브랜치만 변경. 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`·PR80 Draft·`safeToRestore:false`·계정/실DB/실데이터/운영/배포·예약 모두 불변.
