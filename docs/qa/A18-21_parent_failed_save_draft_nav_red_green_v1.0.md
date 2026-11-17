# 02 WRONG A18-21 — 부모 메모 저장 실패 후 이동 시 미저장 본문 손실 방지 · RED→GREEN v1.0

- 확인: 2026-11-18 KST (Actions UTC 실행)
- 00 유효 지시: [#82 #6954739096](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6954739096)에서 02는 A격리 기존 커서 계속. [#87 현재 02](https://github.com/jinbh99-arch/uri-homework-manager/issues/87)
- 제품 `dev` HEAD 실조회: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`; **미변경**. PR #80 Draft 미병합, `safeToRestore:false`.
- 격리 파생 QA: `qa/wrong-a18-21-parent-draft-nav-20261118`. 기존 A18-19/20 QA 브랜치 `qa/wrong-a18-19-parent-visible-feedback-20261117-2235`는 앱 원본 blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35`로 바이트 복구하고 신규 A18-21 테스트/워크플로를 분리함.

## 1. 문제점·근거

기존 A18-19는 합성 부모 메모 쓰기 실패 경고/실패 직후 원장 불변/정상 재시도를 검증했다. A18-20은 즉시 2회 저장 활성화의 중복 방지를 검증했다. **새 누락 경계:** 학부모가 긴 메모를 작성하고 저장이 실패한 직후 '오답 목록'으로 이동하면, 입력 화면이 숨겨지고 상세 화면을 다시 열 때 작성한 문장이 사라질 수 있다.

- 새 표적 시험: [`tests/wrong-a18-21-parent-draft-nav.mjs`](../../tests/wrong-a18-21-parent-draft-nav.mjs).
- 기준 앱 `index.html` blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35`를 대상으로 [RED CI #44132401045](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44132401045) 실행: **completed/failure (의도된 결함 재현)**. 320px의 실제 앱 합성 실패→목록 클릭에서 `stillDetail:false`, `memoPreserved:false`, `ledgerUnchanged:true`; PNG 2장 + JSON 1개 [artifact #14349154965](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44132401045/artifacts/14349154965). 실사용 운영 장애 발생 증거는 아님.
- 근본 원인: 기존 앱의 전역 `[data-route]` 클릭 처리에는 `#check-memo`의 미저장 텍스트 확인이 없어, 저장 오류 뒤 오답 목록으로 이동할 때 입력 내용이 보호되지 않음.

## 2. 해결방안 비교 및 선택

1. IndexedDB 임시 초안 자동저장: 운영 저장구조·장애 경계 확대, 개인정보/복원 영향이 커 현재 승인 범위 대비 과도함 → 보류.
2. 떠나기 전 `window.confirm` 강제: 확인 후 초안 분실 우려, 모바일 UX/다른 모달과 충돌 위험 → 보류.
3. **클릭 이동 경로의 최소 가드**: 상세 화면에서 메모 텍스트가 남아 있고 목록·다른 기록 이동 클릭 시 **이동 차단 + '저장하지 않은 학부모 관찰 메모가 있습니다. 메모를 저장하거나 내용을 지운 뒤 이동하세요.' 안내**. 입력은 그대로 두고 재저장 선택 가능. 이번 격리 QA에만 적용.

실제 코드: [`index.html`](../../index.html) `document.addEventListener('click',...)` 근처 **13줄 국소 변경**, [바이트 단위 전·역패치 생성기 `qa/a18_21_parent_draft_nav_patch.py`](../../qa/a18_21_parent_draft_nav_patch.py). 기존 읽기/쓰기/삭제/복원·사진·저장형식 변경 없음.

## 3. 실제 GREEN 증거

[신규 GitHub Actions #44132887314](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44132887314), job `134214470971` `completed/success`, 실행 SHA `12a517164500763520a37fbca79bd124e9f86662`.

| 신규 브라우저 검증 | 320px | 390px |
| --- | --- | --- |
| 합성 저장 실패 1회 발생·화면 실패 안내 확인 | PASS | PASS |
| 목록 이동 클릭 시 상세 화면 유지 | PASS | PASS |
| 실패 후 정확한 부모 메모 입력값 보존 | PASS | PASS |
| 이동 차단 이유를 토스트로 안내 | PASS | PASS |
| 실패·이동 차단 전후 원본 오답·PNG(2,084B) 완전 불변 | PASS | PASS |
| 재저장 성공 후 부모 이력 1건만 저장 | PASS | PASS |
| 정상 저장 후 목록 이동→상세 재진입·정확 메모 본문 표시 | PASS | PASS |
| 외부 요청 / 자바스크립트 pageerror | 0 / 0 | 0 / 0 |

- [증거 artifact #14351580584](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44132887314/artifacts/14351580584): PNG **8장**·결과 JSON **1개**, 업로드 3,580,587바이트.
- 원시 CI 로그: `A1821_RESULT=PASS_A1821_FAILED_PARENT_DRAFT_NAV_GUARD`; `A1821_LOCAL_QA_MINIMAL_PATCH_FORWARD_REVERSE_BYTES_PASS` 및 `A1821_INHERITED_QA_REVERSE_BYTES_PASS`.
- 새 QA 앱 blob: `7986d9d94fc72ec6fb447384859121048e160799` (이 변경이 기존 제품/다른 QA로 자동 반영된 것은 아님).
- 이전 A18-19/20 QA 브랜치에서는 중간 수정 커밋 이후 **HTML blob을 구버전과 바이트 단위로 되돌리고 A18-21 시험 파일/워크플로를 제거**. 제품 dev는 독립 HEAD 재조회 불변.

## 4. 판정의 한계 및 향후 작업

- **판정:** 버그 재현(RED)→QA 화면 최소 수정→신규 320·390px 실브라우저 GREEN→원본 역패치 확인. 모두 합성·격리 QA 자체 검증. 06 독립검증 **대기**. 제품 dev·main·PR 병합 및 실제 서비스 반영 **없음**.
- 보호 범위: **메모에 텍스트가 있는 상태에서 클릭으로 목록/다른 기록 이동하는 경우**. '상태 선택만 하고 메모 입력 없음', 브라우저 뒤로가기·새로고침·탭 종료·비정상 종료, 프로그램 내부에서 직접 `navigate()` 호출되는 경로는 이번 추가 가드로 모두 해결됐다고 주장하지 않음.
- 미검증: 물리적 스마트폰·Safari/VoiceOver/TalkBack, 2탭 충돌, 실제 카메라/OCR, 학부모 3분 사용, 실아동/실가족 자료, 실제 원본 보관/복원, 실운영 환경.
- 절대 불변: `safeToRestore:false`, PR #80 Draft, 실사진·아동자료·운영 데이터·삭제/복원·광고·계정/배포·기존 자동화 미변경.
- **06 인계:** 기존 RED와 새 GREEN의 테스트 소스/CI 원시 로그/PNG·JSON/전체 원본 역패치를 직접 대조. 특히 제안된 차단이 부모 작성 메모뿐 아니라 저장 성공 후 자연스러운 이동을 막지 않는지 확인.
- **다음 A격리 후보:** 상태 선택만 변경된 미저장 부모 관찰 또는 브라우저 뒤로가기에서의 초안 손실 경계를 별도 테스트. 기존 PASS 무조건 재실행 금지.
