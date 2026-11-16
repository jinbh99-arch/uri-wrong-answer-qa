# A-03-9 — dev 기반 신규 저장 안전성 의존성 매핑 (정적, 미실증)
2026-11-16 19:38 KST. 기준 dev: 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b. 이 QA 브랜치는 dev에서 직접 분기. 제품 index.html 변경 없음.

## 실제 확인된 최소 의존성
- dev index.html 1296~1347: onsubmit 진입 시 in-flight 잠금 없음. id를 매 시도 새로 생성. 사진 변환은 try 바깥의 `await photoBlob()`라 reject가 저장 예외 처리에 도달하지 못함.
- dev 1326~1345: `v20SaveMistakeGuarded` 완료 직후 `transactionDone=true`; 이어 `readOne(mistakes/photos)` 및 `restoreState`가 실패하면 경고만 보여주고 재클릭에서 새 ID가 생성될 수 있음.
- dev 881 부근 `navigate('records')`: 메모리 목록 렌더만 수행, 저장 확인 불명 ID의 읽기 전용 목록 재확인 없음.
- A-03-6 QA에는 `wrongA03SaveBusy`, `wrongA03UnknownCreateId`, 저장 확인 불명 시 목록 재읽기, 사진 변환 reject 포착, 잠금 해제 finally가 추가됨. +9/-3 단독 패치는 이 상태와 함수에 의존해 dev 적용 불가(A-03-8 git apply --check 실패).

## 비교 판단
A. 25커밋 일괄 이식: 변경면 과대, 금지.
B. A-03-6 선행 코드 전체 이식: 비교적 빠르나 중복 상태 전파·폼 재진입·다중탭 영향 검토 필요.
C. dev 맞춤 국소 설계(우선): 저장 중 플래그 1개, 첫 생성 ID 1개를 상태로 보존, photoBlob reject 포착, DB 커밋 이후 확인 실패는 ID를 보존한 채 재시도 금지, records 메뉴에서 **읽기 전용** restoreState 후 ID 존재 확인, 성공 시 상태 해제. 새 등록을 사용자가 명시적으로 시작하는 흐름과 기존 수정 흐름은 별도 검증. 저장/사진 바이트·오답 원장 변경 로직 자체는 손대지 않음.

## 신규 합성 검증 필수(미실행)
1. photoBlob reject 1회 → 입력 보존, 잠금 해제, 다음 정상 저장 1건.
2. 최초 쓰기 성공 후 readOne reject 1회 → 동일 폼 재클릭 중복 0건; 메뉴 재진입 read-only 확인 → 원본 ID 1건.
3. 다중탭 별도 신규 입력 2건과 동일 폼 연속 클릭 → 정당한 2건 보존·중복 0건.
4. 원본 사진 바이트 SHA256, 기존 학습 이력, 복원 전후 원장 건수, 320/390px 브라우저 캡처, JS 오류·외부 요청 0, git diff --check·원복 바이트 동일성.
5. 실패 주입 후에도 안전성을 증명하지 못하면 FAIL/BLOCKED 유지. 기존 A-03-6 PASS 재실행 금지.

## 범위·차단
정적 의존성 매핑만 완료. 실제 제품 수정/Chromium 신규 PASS/충돌/병합/배포 없음. GitHub clone DNS 장애로 로컬 패치·브라우저 검증 불가; GitHub connector에서 구간별 소스 확인. 다음: dev-rooted QA에 C 최소 변경을 구현하고 신규 실패 주입 및 캡처를 거친 뒤 dev 적용 별도 판정. PR80 Draft, safeToRestore:false, 사진·오답 원장 보존, 인증/삭제/복원/실가족/운영 변경 금지.
