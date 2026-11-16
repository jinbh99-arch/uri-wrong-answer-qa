# A-03-9-2 — dev 국소 수정 적용 전 위험 경계 및 테스트 게이트
2026-11-16 20:36 KST. 기준 dev SHA40: 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b.
검증 종류: dev 구간별 코드 검사. 브라우저 PASS 아님. 제품 index.html 변경 없음.

## 소스 구간 재확인
- index.html 881: navigate('records')가 renderRecords()만 호출. ACK 불명 후 IndexedDB 원장 재읽기 없이 기존 메모리 records를 그린다.
- index.html 1296~1347: 첫 저장 ID를 submit 내부에서 새로 생성. photoBlob()이 try 바깥. 저장중 플래그 없음. DB 커밋 뒤 readOne 또는 restoreState 실패 시 transactionDone만 안내문에 반영되고 새 submit이 차단되지 않는다.
- index.html 1345 이후 catch: transactionDone=true이면 '목록 확인' 안내만 제공. 원본 ID가 폼에 연결되어 있지 않아 재클릭 중복을 방지하지 못함.

## dev 맞춤 최소 수정 경계 (기존 +56/-8 복제 금지)
1. 제출 진입 즉시 동기적 in-flight 잠금(동일 폼 재클릭 금지); 모든 throw/return 경로에서 finally로 해제. photoBlob을 try 안으로 이동하고 변환 실패 시 기존 입력/사진 유지.
2. 신규 ID는 첫 제출 시 생성해 폼 세션에 보존. DB 쓰기 완료 이후 readOne 실패는 unknown-commit 상태로 표시하고 해당 폼의 재저장 금지. 실패 전 commit이 불확실한 경우에도 자동 재쓰기 금지.
3. records 진입 시 unknown ID만 IndexedDB readOne(mistakes/photos)로 조회하고 목록 상태 갱신. 조회 오류는 저장 실패로 단정하지 않고 차단 유지. 존재 확인 전 새 ID 생성 금지.
4. 사용자 명시적 '새 오답' 진입과 수정 editId 흐름을 분리해, 이미 저장된 원본을 수정·중복 생성하지 않도록 한다. 원본 사진 Blob과 학습 이력은 쓰지 않는다.
5. 탭 간 독립 폼은 다른 ID를 유지한다. 저장 확인 상태는 각 탭/폼에 국한하고 운영 DB·인증·실사진은 사용하지 않는다.

## 새 실증의 합격 조건
- photoBlob reject 1회 → 폼 입력 그대로, 잠금 해제, 다음 정상 저장 정확히 1건.
- 커밋 성공 후 readOne reject 1회 → 재클릭 0건, records 재진입에서 원본 ID/사진 읽기전용 확인, 이후 명시적 신규 등록은 별도 ID.
- 서로 다른 탭의 정상 등록 2건 유지, 동일 폼 더블클릭 중복 0건.
- 사진 SHA256·오답 원장/학습 이력 전후 일치, 320/390px 캡처, 콘솔 예외·외부 요청 0.
- 격리 QA에서 git diff --check 및 원복 바이트 일치. 위 실증 전 dev 병합 금지.

## 이번 회차 차단과 재개
GitHub connector로 dev의 870~900, 1285~1358 구간만 확인. 실행 컨테이너 git ls-remote는 github.com DNS 해석 실패. 따라서 제품 파일의 부분 수정/실제 Chromium 테스트는 하지 못함. 다음은 접근 가능한 격리 CI runner에서 dev checkout → 위 1~4 최소 패치 → 새 실패 주입 테스트 및 화면 증거를 만드는 것. 기존 A-03-6/A-03-8 PASS 재실행 금지.
PR80 Draft, safeToRestore:false, 사진·원장 보존, 실가족/실OCR/서버 ACK/인증·삭제·복원·공개·운영 금지.
