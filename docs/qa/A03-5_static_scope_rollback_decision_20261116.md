# WRONG A-03-5 — 정식 dev 병합 전 변경 영향·역적용 검토서 v1.0

> 2026-11-16 · 02 WRONG 개발 · **격리 QA 정적검토 완료 / 제품 dev 병합·운영 승인 아님**

## 1. 검토 원본·검증 등급

- 기준 dev HEAD: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`.
- 검토 대상 QA: `qa/wrong-a03-new-entry-ack-gap-20261116-1036`, `index.html` blob `8127dc7ddab6eca5dc23eaf53444a95aa08fa7db` (이번 검토에서 해당 제품 파일 변경 없음).
- [A-03-5 신규 독립 **정적** Actions #43814795230](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43814795230) **10/10 PASS**. [검사 코드](../../tests/wrong-a03-5-static-impact-rollback.mjs)와 [JSON 원본 증거](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43814795230/artifacts/14202440397). **이 10/10은 브라우저·사용자 흐름 검사가 아님.**
- 신규 저장/사진·두 탭 Chromium **직전** 별도 실증은 [A-03-3 CI #43803729178 (7/7)](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43803729178)이고 **이번 회차에 재실행하지 않음**.

## 2. 소스 변경 영향 범위 (직접 정적 재확인)

| 검사 기준 | 결과 | 의미 |
|---|---|---|
| 공통 조상/누락 커밋 | QA의 merge-base가 위 dev SHA와 정확히 같음 | 저장소 계보상 기준 dev 커밋 누락 없음. 실제 후속 병합 충돌 보증은 아님. |
| 제품 변경 파일 | **`index.html` 1개**, +56/−8, 7개 diff hunk | 새 브라우저 화면/저장 UX 로직만 대상으로 한 국소 후보. |
| 그 외 후보 변경 | 테스트/CI/검토 문서 8개 | **제품 dev 일괄 반영 대상이 아님**. |
| 원자적 IDB 쓰기/충돌 보호 | `v20SaveMistakeGuarded` 함수 본문 **dev와 바이트 일치** | 저장 트랜잭션의 CAS 판정·사진 put/delete·500건 보호를 손대지 않음. |
| 기존 `restoreState` 함수 | **dev와 바이트 일치** | 저장소를 읽고 입력을 검증하는 기존 함수를 호출만 추가. |
| 추가 재읽기 | `navigate('records')`에서 첫 신규등록 ACK 미확인 상태일 때만 `restoreState().then(renderRecords)` | **읽기 전용**, 자동 두 번째 쓰기/재전송 없음. |
| 확정 여부 안내 | 첫 등록 커밋 후 재조회 실패 시 저장 완료 단정 금지, 동일 양식 재등록 차단 | 기존 7/7 Chromium 증거와 정적 범위 부합. |

## 3. 새로 드러난 미검증 경계 (병합 결정 전 인지)

**위험 A — 사진 변환 단계 예외 시 로컬 잠금 잔류 가능성 (정적 가설).** 신규 `wrongA03SaveBusy=true`는 `await photoBlob()` **앞**에 놓이고, 일반 `finally{wrongA03SaveBusy=false}`는 그 이후 `try`에 배치되어 있음. 사진 캔버스·Blob 변환 자체가 예외를 발생시키면 내부 busy 해제가 실행되지 않을 수 있음. 바깥 v1.3 저장 래퍼의 `v13SaveBusy`와 다른 변수. 실제 지원 이미지에서 예외 발생/후속 저장 차단은 이번에 **실증하지 않음**. 조건부 dev 병합 전 이 실패 경계를 합성 예외 주입으로 확인하고 필요시 busy 설정 범위를 통합 정리 권고.

**위험 B — 미확인 첫 등록 후 ‘목록 확인’ 우회 가능성 (정적 경로).** `renderAdd()`는 `wrongA03UnknownCreateId=null`로 상태를 초기화함. 저장 불확실 경고를 받은 사용자가 목록 확인 대신 **다른 화면→새 오답 등록**으로 이동하면, 다시 동일 내용을 입력하는 것을 전역 중복 판정으로 차단하지 않음. 원래 의도가 '새 양식은 새로운 의도적 등록'이므로 콘텐츠 동일성으로 자동 병합해서도 안 됨. ‘저장 확인 전 새로운 등록 금지’라는 UX 약속이 모든 메뉴 경로에 유효한지는 **신규 경로 시험 전 미확정**. 같은 폼 단발 재클릭 차단 실증과 구분해야 함.

**위험 C — 목록 최신성/재읽기 오류 화면.** `restoreState().then`은 비동기이므로 기록 화면을 떠나기 전 완료될지 보장하지 않음. 그래도 출력은 `route==='records'`일 때만 갱신하며, 실패 시 “새로고침 후 확인”을 보여 주는 형태. 다른 탭이 아주 늦게 쓰거나 `BroadcastChannel`이 없는 브라우저의 순서·사용성은 이번 정적 PASS의 대상이 아님.

실제 가족 인증, 서버 ACK, 계정별 데이터 소유권, 실 OCR, 실카메라, 저장소 초기화/완전삭제, W7 WebKit 복원은 모두 **외부·보안 단계 미검증**. PR80 Draft와 `safeToRestore:false` 유지.

## 4. 원복 실증 및 승격 조건

- 새 Node 검사는 `git diff <고정 dev> HEAD -- index.html`을 **역패치 가능한지 검사**했고, 더 나아가 QA 후보 `index.html`을 **임시 디렉터리**로 복사하여 `git apply --reverse`를 실제 적용한 뒤 **원본 dev `index.html` 전체 바이트와 완전 일치**함을 확인. 모든 파일은 임시 위치에서 처리, 기존 QA/제품 소스에 역패치 실행 안 함. 결과 JSON에 `reversePatchCheck: PASS-temporary-reverse-apply-byte-identical-to-pinned-dev` 기록.
- **병합 시 제품 변경만 따로 선택:** `index.html`의 A-03 가드/목록 상태에 대한 병합 대상을 지정하고 8개 QA 전용 파일을 제품 배포와 혼합하지 않음. 실제 dev 커밋이 생기면 06 독립 diff 검증 및 필요한 새 경계 테스트 후 승인 절차 진행.
- **추천 판정:** A-03-2/3 합성 브라우저 수정안은 *조건부 수용 후보*, A-03-5 정적 범위·원복은 검증 완료. 그러나 위험 A/B의 실제 UX·예외 처리가 아직 확인되지 않았으므로 **`dev` 병합은 00/Jin 명시 판단 전 보류**. 필요하면 A/B 두 차이만 신규 격리 Chromium으로 검증. 재현 없는 포괄적 코드 수정·중복 기존 QA 재실행은 금지.

## 5. 재현 가능한 검증 명령 (격리 QA 체크아웃)

```bash
node --check tests/wrong-a03-5-static-impact-rollback.mjs
node tests/wrong-a03-5-static-impact-rollback.mjs
```

검사 결과: [Actions #43814795230](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43814795230). 실제 운영·dev·main·DB·계정·광고·배포·예약·인증·백업 복원 변경 **0**.
