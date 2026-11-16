# 02 WRONG A-03-6 — 사진 변환 예외 및 미확정 첫등록 메뉴 재진입

- 날짜: 2026-11-16 KST · 내부 합성/격리 QA **한정** · 제품 dev/운영 배포·실가족 **미적용**
- 제품 dev SHA: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (불변)
- 기준 격리 QA: `qa/wrong-a03-new-entry-ack-gap-20261116-1036` @ `5bfb2d35dd8cec092cadc80c81ef7a17dd7dd2ce`
- 신규 격리 브랜치: `qa/wrong-a03-6-two-boundaries-20261116`
- **제품 코드 수정·Chromium 성공 증명 커밋:** `1ea5ef6f1c0295f9f33459f423f59c0094763f60`
- 파일: `index.html` +9/−3 (직전 QA 기준), 신규 테스트 `tests/wrong-a03-6-two-boundaries-chromium.mjs`, 신규 전용 Actions `.github/workflows/wrong-a03-6-two-boundaries.yml`.
- 본 문서만 후행 추가하므로 CI 성공 커밋은 위 SHA와 구분할 것.

## 문제·재현·국소 수정·근거

| 새 경계 | 수정 전 실제 합성 Chromium 재현 | 최소 수정 및 수정 후 확인 |
| --- | --- | --- |
| A. 사진 변환 Promise reject → busy 잠금 | 1회 canvas `drawImage` 예외로 `photoBlob()` Promise 거부. 첫 저장 전후 `mistakes=0/photos=0`, 이후 정상 재시도에도 `mistakes=0/photos=0`으로 남아 실제 재저장 실패, core busy 잠금 잔류. 원래 화면은 오류 표시 없이 저장 명령 완료를 암시. | 해당 `photoBlob()` await만 `try/catch`로 감싸 core busy 해제·오류 안내, 양식 유지. 실패 직후 0/0 → 정상 재시도 후 신규 ID 1건·사진 1장(JPEG 변환 보관 바이트 759), 중복 0. |
| B. 첫 커밋 성공→저장 후 재읽기 실패→홈 이동→새 등록 메뉴 | IDB `mistakes` readonly 1회 실패 주입, 첫 커밋 ID 1/사진1; 목록 확인 없이 홈→등록 복귀 시 저장 잠금·미확정 ID 사라짐, 동일 의도 재저장이 **서로 다른 ID 2건** 생성. | `renderAdd()`의 미확정 ID 무조건 초기화 제거, 재진입 시 저장 비활성·저장 여부 확인 안내. 오답 목록의 정상 read-only 재읽기에서 **해당 ID 확인된 경우에만** 잠금 해제. 수정 후 목록 미확인 상태는 같은 ID 1/사진1, 새 ID 0, 원래 사진 바이트 전후 동일. |

**실행 근거**

1. 최초 CI [43824322642](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43824322642): 테스트 주입이 IIFE 내부 변수에 직접 접근하려는 **테스트 오류**로 FAIL. 앱 결함 증거로 사용하지 않음. Canvas API 공개 경계로 주입 방식을 국소 교체.
2. 수정 전 실패재현 CI [43824584438](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43824584438), test SHA `5639adaaf6b1d57a1aa275eb9761b68ac002b244`: **A/B 2경계 결함 실제 합성 Chromium 재현**. `baseline/a03-6-result.json`·320/390 PNG 총 6장, Actions artifact `14205414669`. 첫 오류에 해당하는 예상된 `pageerror` 1건, 외부요청 0.
3. 국소수정 성공 CI [43824820488](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43824820488) @ `1ea5ef6f1c0295f9f33459f423f59c0094763f60`: **A PASS, B PASS**. `fixed/a03-6-result.json`·PNG 6장, artifact `14206331654`. 브라우저 pageerror 0, 외부요청 0, 320px/390px 스크린샷, 390px 가로넘침 없음. `safeToRestore:false`, 실제 복원 0, 실제 실가족 인증/OCR/서버 ACK/운영 데이터 0.

## 최소 변경·원복 증거

- `git compare 5bfb2d35..1ea5ef6f`로 제품 앱은 `index.html +9/-3`만 변경, 그 외 신규 `tests`·`workflow` 2파일. IDB CAS, `restoreState` 원본 함수, 백업·복원·삭제·권한·서버·비밀 변경 없음.
- GitHub의 `index.html` 원문을 각 SHA에서 다시 읽고 4개의 신규 교체 영역을 **메모리에서만 역치환**한 검증 결과, 모든 역치환 위치 1건씩·역치환 결과 원래 QA 인덱스 문자열 **완전 동일**. 이전 QA blob `8127dc7ddab6eca5dc23eaf53444a95aa08fa7db`, 수정 QA blob `b85aa7176d4da135c2ac4b0d9758a4145081759b`, 역치환 후 502,027자 = 원본 502,027자. 실제 저장소/서비스 복원은 **수행하지 않음**.
- 새 브랜치를 기존 QA HEAD에서 분리해 작성하여 이전 A-03-3 7/7·A-03-5 10/10 및 구형 QA를 재실행하지 않음. 기존 합성 **아이 DOM 부모 메모 비노출** 검증은 보존했지만 이번 CI에서 별도 재검증했다고 주장하지 않음.

## 판정·남은 게이트

- **A-03-6 합성 브라우저 재현·국소 수정·신규 두 경계 PASS / 조건부 QA 후보.** 최초 1회 시험 주입 설계 실수는 구분.
- 실제 스마트폰, 실OCR·실사진, 실제 서버 ACK·다중 기기/가족 인증·운영 접근통제·삭제/복구·공개 체험·배포 **미검증**. A의 사진 변환 실패는 모의 예외 경로 테스트이며 실제 모든 디바이스/사진 처리 실패를 포괄하지 않음.
- 제품 dev 병합은 **00 별도 판단 전 보류**. PR #80 **Draft** 유지, `safeToRestore:false` 유지, 합성 자료만 사용. 계정·운영 DB·광고·호스팅/배포·자동화 예약·실사용 데이터는 수정하지 않음.
