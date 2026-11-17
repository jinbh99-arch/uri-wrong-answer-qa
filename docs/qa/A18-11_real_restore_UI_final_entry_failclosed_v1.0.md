# WRONG A18-11 — 복원 UI 실제 적용·최종 파일선택 차단·원본 바이트 역패치 v1.0

- 작업일: 2026-11-17 KST / 담당: 02 WRONG 개발방 20번 / 총괄 근거: [#82 지시 6937728415](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6937728415), #87 12:52 커서.
- 실물 대상: `jinbh99-arch/uri-wrong-answer-qa`의 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`를 기준으로 별도 QA 브랜치 `qa/wrong-a18-11-real-restore-guard-ui-20261117-1315`만 변경.
- 기준 구현은 A18-10 후보 스크립트 `qa/a18_10_restore_guard.py`, 단위테스트 `qa/test_a18_10_restore_guard.py` (이전 작성만, 실행 N/T). **실제품 dev·PR80·복원 저장소/배포/가족 데이터에는 아무 변경 없음**.

## 1. 확인된 원인과 최소 보완

A18-10 후보는 초기 `$('import-file').onchange`를 조기에 반환시키도록 만들었지만, 실제 `index.html`에는 초기 핸들러 아래 **v07 (`v07ImportBase`) 및 v18 (`v18OriginalRestore`)에서 다시 `onchange`를 덮어쓰는 래퍼**가 있다. 따라서 A18-10 스크립트 문자열 3곳만 바꾼 상태에서는 최종 이벤트 경계가 확정적으로 차단된다고 보기 어렵다.

**이번 격리 패치 (A18-11):**
- 원래 A18-10의 버튼·첫 진입점·최초 복원 핸들러 차단 후보를 실제 `index.html`에 적용.
- 숨겨진 파일 선택 `#import-file`에도 **`disabled` + 경고 `aria-describedby`** 적용.
- 앱의 **모든 기존 복원 래퍼 정의가 끝난 뒤** 최종 차단 스크립트 `#wrong-a18-11-final-restore-guard`를 추가해 클릭·`onchange` 재지정 및 캡처 이벤트 단계에서 파일 선택값 제거/복원 비허용. 기존 복원 코드는 일부 소스에 남지만 UI 진입이 차단된다.
- `#import-json` 버튼 `disabled`, `role=alert` 경고에 ABA(A→B→A) 이중읽기 한계와 사진·기록·확인 이력 보존 명시.
- 기존 **백업 내려받기 `#export-json`은 활성** 상태로 보존; 원본 사진/학부모 확인 이력/미확정 등록 장부를 지우거나 수리·해제하는 코드 없음.
- `qa/a18_10_restore_guard.py`는 **이 최종 패치를 생성**하고 `unpatch()`로 역치환 가능한 생성기. `qa/test_a18_10_restore_guard.py`에 UI 비활성·중복 적용 차단·정확 역패치 검사 추가.

## 2. 신규 실행 증거

- [실제 GitHub Actions #44016281018](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44016281018) **SUCCESS**, job `133814878681` (Ubuntu 24.04/Chromium).
- **Python unit 8/8 PASS**. 같은 CI가 기준 커밋 `5a68bba4e5ea9ef25174e4750cb0c090c6076887:index.html` 원본에 생성기 적용 결과와 실제 QA `index.html`이 정확히 일치함을 확인. 이후 `unpatch()` 역적용 결과는 **원본 전체 문자/바이트 일치**(`A1811_PATCH_FORWARD_REVERSE_BYTE_EXACT_PASS`).
- 원본 `index.html` Git blob: `250aff5b0a46490488b64f7b96a83c940d2d6c71`; 패치 앱 Git blob: `7a30edb28ff1a84167e36d667e57bf5c5b93d180`. 유일하게 격리 사본 변경.
- **실제 앱 소스와 격리 IndexedDB의 합성 데이터로 Chromium 320px/390px 각각 PASS**:
  1. 복원 버튼 `disabled`, 파일 input `disabled`, `role=alert` 위험 설명 화면 표시.
  2. 강제로 선택 파일 객체를 배정하고 `change` 이벤트를 발생시켜도 input 파일 선택값을 지우고, 직접 `onchange`를 호출해도 복원 실행 불가.
  3. 원본 오답 1개, Blob PNG 사진 1개 **전체 바이트**, 가상 학부모 확인 이력 1개, 손상 pending 장부 설정 그대로 보존(두 폭과 재진입 이후 완전 비교).
  4. 기존 백업 버튼 활성, 외부 요청0·pageerror0·320/390 가로 넘침0·앱 파일 바이트 변경0.
- 아티팩트 [#14299405831](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44016281018/artifacts/14299405831): `result.json` 및 **320/390px 전체화면 PNG 2장**. 파일이 GitHub에 등록된 것과 CI 로그는 확인했으나 PNG 픽셀 독립 육안 검사는 별도 수행하지 않음.
- 지난 A18-5~7·A13~17 PASS **반복 실행0**. 범위는 실제 복원 진입 UI 신규 코드와 실패 우회 2개 화면폭만.

## 3. 위험 경계와 후속 판단
- **이번 PASS는 복원 기능 자체의 성공이 아니라 복원 입력 UI의 차단 PASS**이다. 내부 함수 직접 호출·인증된 원격 세션·실폰 Safari·악의적 DOM 스크립트 변경·IndexedDB 원자 CAS·실자료 복구 안전성은 **미검증(BLOCK)**.
- 합성 A격리 안전 차단 후보의 제품 이식/PR 병합은 00/Jin 승인 필요. 특히 `safeToRestore:false` 유지, **원장·사진 자동삭제·장부 강제 해제 금지**.
- 후속 개발 제안(00 판단 대상): ① 복원 기능의 모든 프로그램상 직접 진입(개발자/모듈/래퍼)을 공통 `fail-closed` 게이트로 통합하는 최소 구조 설계 및 실패 주입 ② 복원 재개 전 별도 원자 revision/CAS와 복구 사용자 동의 조건을 검증. 현재 제품 dev 병합·B/C/D 운영은 승인하지 않는다.

## 4. 상태
- **완료:** 실제 QA HTML 패치, 생성기 8개 단위테스트, 실브라우저 320/390 fail-closed 증거, 원본 역패치 일치.
- **미완료/승인 대기:** 제품 dev·PR80 병합, 실제 복원 안전성·원자 CAS·실기기·실가족, 06 독립 제품 검증.
- **불변:** dev/main, PR80 Draft, `safeToRestore:false`, 실오답·실사진·인증/DB·공개 배포·예약.
