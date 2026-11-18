# 02 WRONG W3 — 미저장 부모 관찰·재확인 질문 전환 차단 보존 RED→GREEN 추가 QA v1.0

**작성일:** 2026-11-18 KST · **02 승인된 격리 QA 보충, 신규 CI·원시 ZIP 직접 확인 완료, 자체 PASS.** 기존 W3 토스트의 06 독립검증은 별도로 [#6979473254](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979473254)에서 **PASS(QA만)** 확인됨. 이번 **새 두 가드**도 [06 독립차분 PASS #6979749342](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979749342)를 확인했다. 단 QA 전용, 제품 도입 미승인. 제품 운영/계정/DB/배포/예약 변경 0. 기존 [W3 토스트 격리 성공 CI 44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980)을 재실행하지 않는다.

## 1. 미완료 검증 공백과 실제 소스 비교

- 기존 W3 성공은 부모 화면에서 **일반 사진선택 취소 토스트가 아이 화면에 잔류하는 문제**를 실제 버튼 조작으로 RED 재현, QA-only GREEN 수정으로 제거했다. 또한 **미저장 오답 등록 초안** 차단 경고는 보존했다.
- 하지만 실제 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`의 `v218ApplyMode('child')`는 **세 개의 별도 보호 분기**를 갖는다. 이전 W3 신규 토스트 시험은 그중 ① 오답 초안만 검증했다. **② 오답 상세의 미저장 부모 관찰 메모 `#check-memo`**, **③ 비수학 재풀이 후 미저장 다음 확인 질문 `#wrong008-next-question`**은 이 변경과 동시에 보존돼야 한다.
- W3 가역 패치는 세 가드가 `return 'blocked'`를 수행한 **뒤**에만 `clearTimeout(toastTimer)`, `toast.textContent=''`, `.hide`를 실행한다. 따라서 가드를 통과하지 않은 차단 상황의 경고를 지우면 결함이다. 반대로 **입력내용을 지운 뒤 실제 아이로 전환되었는데 직전 부모 보호 경고가 아이 화면에 남으면 기존 UX 잔류**가 반복된다.
- **추가 차분:** 기존 dev 고정 SHA에서 브랜치 `qa/wrong-w3-dirty-observation-question-guards-20261118` 생성. 이전 [W3 정확 가역 패치](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-child-toast-mode-boundary-20261118/qa/w3_child_toast_mode_patch.py)를 내용 그대로 복사하고, [새 시험](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-dirty-observation-question-guards-20261118/tests/wrong-w3-parent-two-guards-red-green.mjs)과 [별도 workflow](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-dirty-observation-question-guards-20261118/.github/workflows/wrong-w3-parent-two-guards.yml) **3파일만 추가**, 제품 `index.html`·QA 루프백 서버 변경0.

## 2. 정확한 신규 브라우저 실행 계약

| 단계 (320/390 각각 RED 제품 원본과 GREEN 가역 패치) | 기대 결과 | 저장 위험 확인 |
|---|---|---|
| 합성 과학 오답 1건 등록 → 상세 진입 | IndexedDB 오답 1건·사진0 | 운영 가족/사진/네트워크 자료 접촉0 |
| 미저장 `check-memo` 입력 → 아이 화면 선택 | **모드 전환 차단/부모 유지**, 안내 `저장하지 않은 부모 관찰 메모` 표시, 원래 입력 그대로 | 원장 원본 `deepEqual` |
| 부모 관찰 초안만 삭제 → 비수학 일반 재풀이 1건 직접 저장 | 원장 오답 ID 유지, `generalRetryHistory` 1건 | 수동 합성 재풀이 저장은 시험 준비이며 실사용자 아님 |
| 미저장 `wrong008-next-question` 입력 → 아이 선택 | **모드 전환 차단/부모 유지**, 안내 `저장하지 않은 부모 재확인 질문` 표시, 입력 그대로 | 재풀이 기록 포함 원장 `deepEqual` |
| 미저장 질문 입력 삭제 → 아이 선택 | **정상 아이 전환**. RED 원본에는 직전 부모 경고가 일시 잔류, GREEN에는 경고 문구/표시 0 | 저장 원장 변경0, 외부 요청/JS 오류0 |
| 원본 정확성 | `index.html` Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` 핀 | 임시 patch 적용→실행→정확 역패치→`git diff --exit-code` |

**실제 CI:** [신규 CI 44310593267](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267), 실행 SHA `55b8adbf2557dcd148d1114fe1d5ca043efefa0b` (테스트·workflow·patch만). **최종 CI SUCCESS·자체 RED→GREEN 320/390 PASS**. **실제 원시 증거:** RED·GREEN 320/390 각 3 PNG씩 **총 PNG12+JSON2**, ZIP 직접 개봉 및 SHA/PNG 크기·JSON 값 대조 완료.

## 3. 독립/운영 경계와 00 의존관계

- 이번 검증은 **아이/부모 로컬 보기 모드의 UX·미저장 입력 보호**만 확인한다. 보기 전환은 로그인/가족 인증이 아니다. 실제 아동 사진·실OCR·외부 제3자 SDK·실폰·스크린리더·운영 저장 내구성 **N/T**.
- 제품 dev에는 토스트 제거가 **아직 적용되지 않았다**. 성공해도 임의로 병합하지 않고 **06 독립 원시 대조 → 00 명시 승인 → 제품 반영·환경 테스트** 순서를 지킨다.
- [00/87 최신 21:32 KST 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87)와 [00→08 LEVEL AdSense C math #6978436704](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6978436704)가 **P0 선행**. 02 W3의 이번 **P1 후행 독립 검증 후보**는 기존 성공 CI·예약/다른 방 직접 실행을 반복하지 않고 신규 두 가드 차분만 제출한다.


## 4. 실제 실행 완료 / 원시 파일 검증 결과 — 02 자체 PASS

- **신규 [CI #44310593267](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267)** / job `134823391387`, 실행 SHA **`55b8adbf2557dcd148d1114fe1d5ca043efefa0b`**, completed/success. 해당 SHA가 dev와 다른 파일은 **신규 가역 패치 스크립트/시험/workflow 3개**, 앱과 QA 미리보기 서버 변경 0. CI `W3_TWO_GUARDS_PINNED_DEV_AND_QA_ISOLATION_PASS`, `W3_TWO_GUARDS_EXACT_REVERSE_ORIGINAL_BYTES_PASS` 직접 로그 확인.
- [**원시 artifact #14429374261**](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267/artifacts/14429374261), ZIP **5,178,507 bytes**, SHA256 **`89d125ef4a84d07e0a26ca0fc2a48e4bd9b5f4400bcd99bc1e7e6ec978e4a9b8`**, GitHub artifact digest와 일치. **ZIP 직접 개봉 완료:** 320·390 각각 RED 3 PNG + GREEN 3 PNG, 합계 **PNG12장**(서명·크기·파일SHA 확인) 및 원시 `red/result.json`·`green/result.json` 2개를 읽어 아래 상태값 대조.
- **RED 원본** `index.html` Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`. RED `result.status=PASS_BASELINE_PARENT_WARNING_LEAK_REPRODUCED` (320/390 각각 관찰 메모·재확인 질문 보호 차단 PASS, 입력 취소→아이 전환 후 **이전 ‘저장하지 않은 부모 재확인 질문’ 알림이 남음**).
- **GREEN QA 패치 임시 적용** `index.html` Git blob `6ff6cf1c2cfeef3706381a68fc105feab8258b04`, `result.status=PASS_PATCH_PRESERVES_BOTH_GUARDS_AND_CLEARS_CHILD_WARNING`. 320·390 모두 차단 보호 경고·원래 입력 보존 PASS, 정상 아이 전환 후 이전 토스트 **`toastVisible=false`, `toastText=''`**. 테스트 작업공간 즉시 역패치 후 원본 `index.html` 바이트 완전 복원. **제품 repo dev에는 GREEN 패치를 적용하지 않음.**

| 새 보호 사례 / 폭 | RED 제품 원본 | GREEN QA 패치 | 원장·UI 안전 |
|---|---|---|---|
| 320 부모 **미저장 관찰 메모** 차단 | PASS | PASS | 모드=부모, 경고 표시, 메모 미삭제, DB deepEqual |
| 390 부모 **미저장 관찰 메모** 차단 | PASS | PASS | 동일 |
| 320 비수학 **다음 확인 질문** 차단 | PASS | PASS | 질문 미삭제, 저장된 재풀이 기록 불변 |
| 390 비수학 **다음 확인 질문** 차단 | PASS | PASS | 동일 |
| 320 보호 질문 입력 지운 후 아이 전환 | RED 경고 잔류 재현 | **GREEN 알림 표시·DOM 텍스트 제거 PASS** | 저장된 오답·재풀이 불변 |
| 390 보호 질문 입력 지운 후 아이 전환 | RED 경고 잔류 재현 | **GREEN 알림 표시·DOM 텍스트 제거 PASS** | 동일 |
| 외부 요청/JS 오류 | 0 / 0 | 0 / 0 | 합성·로컬 Chromium만, 실 SDK 수신 N/T |

**원시 샘플 SHA256:** GREEN 390 부모 관찰 보호 `a885aa0719e6c167a5bba35afffc81dafa80dda8d0067dc58f77babc3dac11e4`; GREEN 390 부모 질문 보호 `c44c606b03e2d94cee279f3cbb0bdf45a9cae1063af51f7784f96865ad369e5c`; RED 390 아이 전환 후 경고 잔류 `38ca1c03757752bea3b20f6c9d92d92603a13c00bf6bce175b65efbf64efe412`; GREEN 390 아이 전환 후 경고 제거 `180da06571871828941f377e4bc800dddfa04f8e755a2aed0a2ee92e85239f8f`. PNG 390 사진 4장 상단을 실제 나란히 시각 검토하여 **RED는 아이 화면에 이전 경고가 남고 GREEN은 사라지는 차이**를 확인.

- **독립 검증 상태:** 앞선 W3 토스트 **06 독립 PASS(QA만)** 는 [#6979473254](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979473254)로 이미 수령. **이번 두 신규 가드**는 02 **자체 PASS + 06 독립차분 PASS(QA만)** [#6979749342](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979749342). 06이 ZIP PNG12/JSON2·CRC/digest·가역 패치 1앵커 원본 정/역복원을 독립 확인했다. 실가족·아이 인증/실폰·Safari·실사진/실OCR 검증 없음.
- **다음:** 00 P0 AdSense C math 보안이 우선이며 이번 W3 부가분은 06 독립 QA PASS까지 수령했다. 00의 **제품 반영 범위·실환경 검증 별도 승인 전**에는 운영 수정/배포를 수행하지 않는다. 다른 채팅의 실제 모델 응답을 수신했다고 간주하지 않고 **제품 적용/배포/실자료·PR 병합·예약 변경하지 않음**.
