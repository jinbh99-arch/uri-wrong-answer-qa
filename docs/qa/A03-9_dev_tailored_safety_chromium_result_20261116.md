# 02 WRONG A-03-9 — dev 맞춤 신규 저장 안전장치 실브라우저 합성 검증

- 기준 제품 `dev` SHA40: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, HTML 원본 git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`.
- 격리 QA 브랜치: `qa/wrong-a03-9-dev-tailored-safety-20261116-2027`, dev에서 직접 분기. 앱 index.html **+14/-8** (기존 A-03-6 전체 QA의 누적 +62/-8 또는 선행 +56/-8 이식 아님), 새로운 단독 테스트 1개와 전용 워크플로 1개만 추가.
- 고정된 Chromium 성공 시험 SHA: `2e680b072c18eb7f468beab794381e9b4695ef87`, 제품 QA Git blob `3e950881c7ad050fb634ef46d7b9be08e69a6075`.
- [최종 성공 Actions CI #43859279810](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43859279810), [증거 artifact 14221638338](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43859279810/artifacts/14221638338): `result.json`, 320/390 PNG 7장.
- 판정: **A-03-9 로컬·격리 합성 Chromium 3/3 PASS; 제품 dev·실가족/실OCR/실서버 ACK/실폰/배포 미적용**.

## 실제 원인과 선별 최소 수정

1. 기존 dev는 첫 등록마다 새로운 ID를 발급하고, `photoBlob()` Promise rejection은 저장 오류 처리 바깥에서 발생. 다중 제출 busy 상태·첫 커밋 후 확인 실패 ID 유지가 없음.
2. 같은 dev의 **기존 v1.3 `v13OldSubmit` 래퍼**가 저장 처리 종료 시 무조건 `save-btn`, `v08-photo-save`, `v08-floating-save`를 활성화함. 첫 A-03-9 시험에서 **저장 불명인데 저장 버튼이 다시 열리는 실제 충돌**이 발견됨.
3. dev 맞춤 `wrongA039SaveBusy`와 `wrongA039UnknownCreateId` 두 상태, 사진 reject try/catch·입력 유지·잠금 해제, 쓰기 commit 뒤 확인 실패시 ID 보존 및 재등록 차단을 국소 구현. `navigate('records')`는 `restoreState()` 읽기 전용 재조회 후 해당 ID **실제 존재 확인** 때만 차단 해제. 읽기 실패·ID 미존재 때는 계속 차단.
4. v1.3 저장 래퍼 및 등록 화면의 **세 저장 버튼을 pending ID 상태와 동기화**하고, 실패 안내가 무조건 '저장 실패'로 덮이지 않도록 수정. 실제 IndexedDB 쓰기·사진 저장·복원·삭제·가족 인증 로직 변경 0.
5. 전 QA 25커밋·A-03-6 +9/-3 후행 패치·선행 +56/-8의 일괄 제품 이식은 수행하지 않음. `dev`와 PR #80 변경 없음.

## 실제 새 경계 검증 (모두 가상의 데이터)

| 검증 | 실제 결과 |
| --- | --- |
| A. 캔버스 사진 변환 `drawImage` 예외 1회 | 초기 원장 0·사진0, 양식 문제/메모 불변·에러 표시, 동일 사진 정상 재시도 후 새 원장1·사진1, SHA256 `9871ecf2f1ac74e30bc79d2477df43f72ae19d871aa43dbc7ee9cec059a2ad28` |
| B. 첫쓰기 커밋 후 `mistakes` 읽기 ACK 유실 1회 | 원장1·사진1, 저장 버튼/재진입 차단, `requestSubmit()` 강제 호출에도 중복0. 목록 재읽기 실패 주입 1회 시 잠금 유지. 이어 목록의 실제 원ID 정상 확인 후만 해제, 독립 신규 문제를 저장해 원장2·사진1; 원래 레코드 JSON 및 사진 바이트 불변 |
| C. 두 탭 각각 별개 영어 오답을 연속 2회 제출 | 의도된 원장2건·서로 다른 ID 2개, 중복0, 사진0, 두 탭 모두 정상 완료 |
| 앱/환경 | 모바일 320·390px PNG 7장·가로 넘침0, 페이지 JavaScript 오류0, 외부 요청0, 제품/운영 접근0 |
| 원복 | 실제 QA Git diff를 별도 임시 디렉터리에 역적용→원래 dev Git blob 정확 일치→다시 정적 재적용 후 QA 바이트 완전 일치. 운영 DB 또는 배포 롤백 아님 |

**초기 CI 실패 기록**: [#43858815438](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43858815438)은 노드에서 브라우저 전용 `CanvasRenderingContext2D`를 참조한 테스트 오류(A)와, 기존 v1.3 래퍼가 잠금을 강제로 해제하는 실제 제품 충돌(B)을 분리 확인. `#43859250453`은 테스트 코드 수정 전 동일 사진 주입 오류가 남은 중간 실행. 그 뒤 래퍼·테스트 주입 위치를 각각 국소 수정해 최종 CI 3/3 통과. 초기 실패를 제품 QA PASS로 소급하지 않음.

## 미검증/판정 경계 및 다음

- **실제 사진 기종별 JPEG/WebP 처리, 실제 OCR, HTTP/서버 ACK, 실제 가족/아동 인증·권한·타가족403, iOS/Android 실기기, 외부 시연과 배포, 영구 저장소·재시작 이후의 미확정 ID 지속성, 운영 데이터 복원은 미검증.** 여기의 IDB 읽기 실패는 브라우저 내 합성 예외 주입이며 실제 외부 서버 ACK 전송이 아님.
- 원장·사진과 기존 학습 이력 규칙을 대체하지 않음. 기존 안전함을 원래와 동일하게 유지하는지는 합성 3경계와 보존 비교 범위에서만 판정.
- 00 총괄은 **격리 후보 코드에 대해 독립 검증과 적용 우선순위 판단** 필요. 병합/PR80 Draft 해제/배포 승인은 이번 작업에 포함되지 않음. `safeToRestore:false` 및 기존 자동화 예약·계정·광고·운영 DB 설정 유지.
