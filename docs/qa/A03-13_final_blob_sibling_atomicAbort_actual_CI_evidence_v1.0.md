# 02 WRONG · A-03-13 최종 앱 다중 탭·원자적 저장 취소 실증 확인 v1.0

**2026-11-16 23:48 KST 검증 인계** · 상태: **A격리 신규 2경계 CI PASS 확인** · 제품 병합/배포: **미승인** · `safeToRestore:false`

## 1. 검증 배경과 출처·버전 고정

- 총괄 #87의 이전 상태는 **A-03-13 워크플로만 수정, 두 경계 CI·PNG 결과 미확인**이었다. 이전 보고의 미확인 상태를 실제 Actions 실행기록·증거 ZIP·테스트 원문으로 갱신한다.
- 검증 대상 제품 `dev` SHA: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (현재 비교 동일, 제품 변경0).
- 격리 QA 소스 **정확한 CI 커밋** `69099fa495a881b5a94d38224e36f9bee4158a39`; 앱 `index.html` Git blob **`ec1e45430445beb82fe23e4c98ee76eac402c3a9`**, 테스트 `tests/wrong-a03-12-durable-intent-chromium.mjs` blob `df7a394159fa13862f4f46ebcbf7dbdfeffb05e7`.
- [실제 CI run #43873361597](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43873361597) · 성공 job `133319979340` · [증거 artifact #14228319132](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43873361597/artifacts/14228319132) · 업로드 로그의 ZIP SHA-256 `7f0da120f3790d443932e16471ba728dd1553bc844636aaa1df4bf95d895ca91`.
- 이 보고서는 **CI 재실행 없이** 위 기존 성공 실행의 실제 로그·코드·파일을 새로 대조했다. 새 QA 브랜치 `qa/wrong-a03-13-ci-evidence-audit-20261116-2348`는 검증 출처 커밋에서 분기하여 **문서만 추가**, 앱·시험·워크플로 변경 없음.

## 2. A-03-13 새 경계별 구체적 합격조건·증거

| 경계 | 기존 테스트에서 실제 확인하는 내용 | 관측·판정 |
| --- | --- | --- |
| **같은 등록 의도를 가진 다중 탭 경쟁** (`A0312_CASE=sibling`) | 탭 B에 등록내용·가상 사진을 먼저 준비하고 탭 A에서 실제 쓰기는 커밋, 후속 조회만 합성 실패 주입 → 미확정 ID 1개 생성. 탭 B 저장 재시도에서 **다른 탭/이전 실행** 오류가 보여야 함. 서로 다른 ID로 2건이 되면 실패. | 로그 `A0312_sibling_PASS`; 원장 `after.records`와 `first.records` 객체 배열의 `deepEqual`, 사진 전체 바이트 배열 `deepEqual`, `after.marker.id===first.marker.id`, 탭 B 저장버튼 잠금. 목록의 동일 ID 확인 후에만 안전 해제. **PASS** |
| **쓰기 트랜잭션 실패·원자적 취소** (`A0312_CASE=atomicAbort`) | 합성 `IDBObjectStore.put('mistakes')`를 최초 1회 강제 throw. 실패 직후 `mistakes=0`·`photos=0`·`settings['wrongA012PendingCreateV1']=null`이어야 함. 재시도 때 기록1·사진1·장부 null. | 로그 `A0312_atomicAbort_PASS`; 증거 JSON `precommitAbortRolledBackRowPhotoAndReceipt:true`, `normalRetryAfterAbort:true`, `afterRetryRecords:1`, `afterRetryPhotos:1`. **PASS** |
| **기존 탭 재접속** (`A0312_CASE=reopen`) | 이전 시나리오의 재접속 잠금·실 ID 확인 후 별도 기록 저장. | CI가 이 경계도 실행하여 `A0312_reopen_PASS`. 이번 신규 미완료 판정 범위가 아니며 별도의 재실행은 하지 않음. |

**원본/사진/확인 장부 해석:** 테스트 `ledger()`가 하나의 IDB 읽기 트랜잭션에서 `mistakes` 행 전체, `photos`의 Blob을 **바이트 배열**로 디코딩한 값, `settings`의 **정확한 키** `wrongA012PendingCreateV1`을 함께 읽어 비교한다. 다중 탭은 원본 행/사진 바이트 불변과 ID 일치를 검증하며, 취소는 행·사진·설정 장부의 동시 부재를 검증한다. 여기서 확인한 **장부 키**는 별도의 백업 복원 허용 목록 전체나 실환경 원복 보증을 뜻하지 않는다.

## 3. 실물 ZIP 점검과 독립적 증거 제한

실제 다운로드한 artifact ZIP 파일 안에 아래 **PNG 5장**과 `a03-12-result.json` 1개가 있다. PNG 파일 시그니처·실제 이미지 너비 확인:

| 실제 ZIP 파일명 | 실제 이미지 너비×높이 | 해당 경계 |
| --- | --- | --- |
| `04-tab-reopen-locked-390.png` | 390×5236 | 재접속 |
| `04b-reopen-verified-new-intent-390.png` | 390×4446 | 재접속 |
| `05-sibling-tab-conflict-blocked-320.png` | 320×5869 | 다중 탭 |
| `06-atomic-tx-abort-no-receipt-320.png` | 320×5872 | 실패 후 원복 |
| `07-after-atomic-retry-390.png` | 390×4742 | 정상 재시도 |

**증거 파일 한계:** 각 테스트 실행이 같은 `qa-proof/wrong-a03-12/a03-12-result.json`을 덮어쓴다. 최종 ZIP의 JSON에는 **마지막 `atomicAbort` 결과만** 남아 있으며 `sibling`·`reopen`의 개별 JSON은 없다. 두 경계의 실행 PASS는 **CI 로그·해당 screenshot 및 시험 코드의 명시적 assert**로 확인했다. 따라서 ZIP 하나만으로 다중 탭 독립 JSON까지 확보했다고 주장하지 않는다. ZIP에 담긴 이미지와 기록은 합성 가상 데이터이며 아동·가족 실자료가 아니다.

## 4. 사용자 보호·진행 상태·불변 내역

- **이번 보고의 확정판정:** A-03-13 최종 앱 blob의 **다중 탭 경쟁 PASS, 원자적 abort PASS**, 로그에 명시된 두 경계의 코드·사진·원장·장부 비교 확인. A-03-12의 재접속 경계도 기존 CI에 포함됐으나 금회 재시험하지 않음.
- **아직 승인할 수 없는 것:** 실제 OCR·외부 서버 ACK/권한/가족·아동 계정/실폰/브라우저 완전 강제종료/실운영 백업과 복원. A-03-14/15의 별도 합성 복원 증거가 있어도 제품 `dev`의 기능이라고 해석할 수 없다.
- 제품 `dev`, main, PR #80 Draft, 외부 가족/아동 데이터·계정·DB, 광고·통계, 배포·자동화 예약 수정0. `safeToRestore:false` 유지.
- **총괄 00 요청:** #87의 A-03-13 **“CI·PNG 미확인” 커서를 “CI 실제 로그 및 ZIP 확인 / 신규 2경계 A격리 PASS”로 갱신**하고, 제품 병합/실자료 승인과 구분. 새 기능이나 2개 PASS 경계의 중복 검증은 불필요.
