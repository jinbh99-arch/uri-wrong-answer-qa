# 02 WRONG W3 — 미저장 부모 관찰·재확인 질문 전환 차단 보존 RED→GREEN 추가 QA v1.0

**작성일:** 2026-11-18 KST · **02 승인된 격리 QA 보충, 현재 신규 CI 결과 확인 전.** 제품 운영/계정/DB/배포/예약 변경 0. 기존 [W3 토스트 격리 성공 CI 44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980)을 재실행하지 않는다.

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

**실제 CI:** [신규 CI 44310593267](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267), 실행 SHA `55b8adbf2557dcd148d1114fe1d5ca043efefa0b` (테스트·workflow·patch만). **초기 작성 시 CI 설치 중; 최종 PASS/FAIL 단정 금지**. 예상 원시 증거: RED 320/390 3 PNG씩, GREEN도 각 3 PNG씩 **총 PNG12+JSON2**. CI 결과 수령 후 실제 ZIP/digest/PNG/JSON 파일 확인 뒤 갱신한다.

## 3. 독립/운영 경계와 00 의존관계

- 이번 검증은 **아이/부모 로컬 보기 모드의 UX·미저장 입력 보호**만 확인한다. 보기 전환은 로그인/가족 인증이 아니다. 실제 아동 사진·실OCR·외부 제3자 SDK·실폰·스크린리더·운영 저장 내구성 **N/T**.
- 제품 dev에는 토스트 제거가 **아직 적용되지 않았다**. 성공해도 임의로 병합하지 않고 **06 독립 원시 대조 → 00 명시 승인 → 제품 반영·환경 테스트** 순서를 지킨다.
- [00/87 최신 21:32 KST 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87)와 [00→08 LEVEL AdSense C math #6978436704](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6978436704)가 **P0 선행**. 02 W3의 이번 **P1 후행 독립 검증 후보**는 기존 성공 CI·예약/다른 방 직접 실행을 반복하지 않고 신규 두 가드 차분만 제출한다.
