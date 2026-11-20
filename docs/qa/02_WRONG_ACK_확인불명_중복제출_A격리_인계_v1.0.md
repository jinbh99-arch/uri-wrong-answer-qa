# 02 WRONG · ACK 확인 불명 뒤 중복 저장 A격리 재현·차단 인계 v1.0

- 작성: 2026-11-21 KST / 담당: 02 WRONG / 상태: **자체 합성 QA PASS, 06 독립 N/T, 00 승인 N/T**
- 00 승인 원장: [#82 #7047304706](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7047304706), 00 최신 [#7050406626](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7050406626)
- 제품 **dev HEAD** `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, **원본 index blob** `250aff5b0a46490488b64f7b96a83c940d2d6c71` (불변)
- 격리 브랜치 `qa/wrong-ack-unknown-duplicate-probe-20261121`; **수정 index blob** `63e31915875a79a2ebcf21d7c722daa9f8deeb98`; 시험 HEAD `e2f110e047ca83e15102ac1ed50783ca11686484`
- 변경 범위: 제품 소스의 `mistake-form.onsubmit` 국소 `inFlight` / `ACK_UNKNOWN` 재등록 차단, 원본 대비 **추가 9행 / 삭제 2행**. 별도 QA 테스트 2파일·워크플로 1파일. 제품 dev/main 및 PR80 **수정·병합하지 않음**.
- 정확 역패치: `node tests/wrong-ack-exact-patch-revert-check.mjs`가 역변환한 index Git blob을 원본 `250aff5b...`와 **바이트 단위 일치**로 확인(성공 CI 로그 포함).

## 문제 원인과 재현

원본 `index.html` 제출 핸들러는 건마다 새 UUID를 생성한다. `v20SaveMistakeGuarded`가 commit을 완료한 뒤 `readOne('mistakes',id)` 재조회가 실패해도 `transactionDone` 경고만 표시하며, 같은 등록 화면의 제출 동작을 잠그지 않았다. 이는 저장 전 트랜잭션 실패와 달리 **실제 저장이 반영됐으나 화면 ACK만 불명확한 상태**다.

**원본 합성 재현:**
- [CI #44820682534](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44820682534) **FAIL(테스트 하네스의 별도 아이모드 사전조건 오인)**. [ZIP #14671683117](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44820682534/artifacts/14671683117) 1,409,147 B, SHA256 `8d3db37e4561aa49242b21d850713b29937feb2c5b982db842f49d7dae0002b1`; 독자 재개봉 CRC PASS, PNG3/JSON1.
- 앱 파일을 수정하지 않고 **로컬 응답 HTML의 commit 이후 readback 한 위치만 1회 실패 주입**. 320px 경고 후 2번째 제출에서 `mistakes` **1→2건**, 서로 다른 UUID 2개, `photos` **2건**, 각각 759 B. 즉 **320px 합성 조건의 중복 기록 발생은 실제 동적 재현**.
- 원본 CI 전체 실패 사유인 별도 `child input` 검사는 **아이 모드 전환이 부모의 미저장 초안 때문에 차단된 상태**에서 값만 검사한 하네스 설계 오류. 부모 메모가 아이 화면에 실제 노출됐다는 증거가 아님. 최초 하네스가 조기 중단되어 원본 390px 동적 결과는 N/T.

## A격리 최소 수정과 신규 증분 합성 결과

- `wrongAckBusy`를 **첫 await 이전 동기적으로 설정**, 동일 등록의 저장 처리 중 두 번째 submit을 거절하고 `finally`에서 해제.
- 저장 트랜잭션 이후 읽기/검증/상태복구가 실패하면 `wrongAckUnknown`를 설정하고 **같은 화면에서 재등록을 차단**. 화면은 목록·사진 확인과 새로 열기를 안내. 확실히 실패한 저장은 재시도 가능하도록 구분.
- [성공 CI #44821167573](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44821167573), job `136582100404`, SHA `e2f110e047ca83e15102ac1ed50783ca11686484`, attempt 1 SUCCESS.
- [원시 ZIP #14670822543](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44821167573/artifacts/14670822543): **2,878,372 B**, SHA256 `228d13ae0b9eec1f1337eeed99daa8700d5ff8f598e7d748fa56b6869900aafc`; 독자 재개봉 **CRC PASS, PNG6/JSON1**, `status=PATCH_BLOCKS_DUPLICATE_RETRIES`.

| 합성 시나리오 | 320px | 390px | 확인 경계 |
|---|---|---|---|
| commit 이후 readback 실패→경고→재클릭 | 기록1·사진1·UUID1 | 기록1·사진1·UUID1 | **중복0** |
| 동일 이벤트 루프의 빠른 submit 2회 | 기록1·사진1·UUID1 | 기록1·사진1·UUID1 | **중복0** |
| 임시 IndexedDB 재진입·사진 바이트 | 기존 사진 SHA 유지 | 기존 사진 SHA 유지 | **PASS** |
| 아이 모드로 실제 진입 뒤 부모 메모 DOM 텍스트·입력·상세 | 발견0 | 발견0 | **합성 PASS** |
| 외부 요청·JS 오류·가로 넘침 | 없음 | 없음 | **합성 PASS** |

## 검증 경계 · 06 독립 인계

- **06 신규 독립 요청:** 두 ZIP SHA256/CRC 및 원시 JSON/PNG 직접 개봉, baseline 320 중복 UUID·사진2 검증, patched 320/390 4건에서 UUID1·사진1·사진 SHA·child DOM0·scrollWidth 확인, index **정확 역패치**·dev SHA 및 브랜치 격리 재확인. 기존 W3/W9 CI 반복하지 말 것.
- **N/T:** 06 독립 판정, 실제 320/390 기기/OS, 실가족 A/B 인증·운영 데이터·클라우드 ACK, 서버 멱등성, 실제 사진, 접근성 스크린리더, 운영 장기 보존. 현 단일 브라우저 앱의 역할 모드는 **가족간 인증 경계가 아님**.
- **불변:** `safeToRestore:false`, PR80 Draft·미병합, 제품 `dev/main` push BLOCK, 운영 DB/실사진·실아동정보/계정·광고·배포·예약 변경0. GitHub 인계 댓글 ≠ 기존 06 ChatGPT 채팅방 실제 수신·새 모델 응답.
- **00 다음 결정:** 06 새 ZIP 독립 QA 확인 후 **A격리 수락/보완** 판단, 제품 승격은 별도 99/00 계약·운영 안전검증 전 금지.
