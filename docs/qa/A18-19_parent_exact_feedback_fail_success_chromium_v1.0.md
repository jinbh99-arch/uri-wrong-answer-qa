# 02 WRONG A18-19 — 부모 메모 정확 본문·저장 실패/성공 안내·재진입 실제 Chromium 검증 v1.0

**일시:** 2026-11-18 01:21 KST (검증 실행은 2026-11-17 UTC)  
**총괄 공식 지시:** [#82 #6953720560](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6953720560), [#87 02 WRONG 실행 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87).  
**독립검증 이전 판정:** [06 #6953206077](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6953206077) A18-19 정적 코드만 있고 신규 Chromium/CI/PNG/원복 증거 없어 **N/T**.  
**기준:** 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변, PR #80 Draft·미병합, `safeToRestore:false`, 실제 아동·가족 데이터 사용0.

## 1. 문제 분석

A18-17 [기존 CI #44089831428](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44089831428)은 320/390 Chromium에서 합성 사진→오답→아이 재풀이→부모 이력의 IndexedDB 저장은 통과했지만, 화면상 재풀이 성공을 기다리는 `waitForFunction(...).catch(()=>{})`가 **실패를 무시**했고, 부모 이력은 고정 시간 대기 후 **DB 기록 수만 검사**했다. 이 때문에 앱이 부모 메모를 실제로 표시하지 않거나 저장 실패를 알리지 않아도 거짓 PASS가 가능했다.

선행 정적 A18-19 [#6951190769](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6951190769)는 '부모' 같은 제목을 확인하는 허위양성을 개선하여 새 메모의 **정확한 본문**을 요구했지만 아직 실제 실행되지 않아 독립 판정은 N/T였다.

## 2. 개선안 선택 및 실제 작업

**선택:** 앱 기능을 근거 없이 바꾸지 않고, 기존 A18-19 격리 브랜치에서 검증 코드와 CI를 보강하여 **화면에 표시된 실제 문자열과 합성 저장 실패를 신뢰 가능하게 단언**한다. 정상 UI를 이미 검증한 A18-17 전체 PASS를 그대로 재실행하지 않고, 실패·성공 화면 및 재진입의 **새 경계**를 추가한다.

**QA 브랜치:** `qa/wrong-a18-19-parent-visible-feedback-20261117-2235`, 시작점 `091f0108010b31a8c2c450bdc15abe105bd743a8`.

### 새·수정한 파일

1. `tests/wrong-a18-19-parent-visible-feedback.mjs`:
   - 정상 QA IndexedDB에 가상 PNG 2,375바이트를 등록하고 실제 오답 1건·아이 재풀이 1회를 작성. `#wrong002-journey`에서 재풀이 **1회가 화면에 표시**되는지 오류 무시 없이 판정.
   - 부모 `#check-status` 선택과 `#check-memo` 정확 문자열 `아이가 관찰 결과를 스스로 설명함 (QA 가상)` 입력.
   - **합성 실패 검증:** 실제 IndexedDB의 `IDBDatabase.prototype.transaction`을 시험 컨텍스트에서만 일시 가로채 `mistakes` 스토어의 첫 `readwrite` 1회를 강제로 `AbortError` 거절. 실제 **'확인 기록 저장에 실패했습니다.'** 안내가 보이는지 단언. 곧바로 원래 트랜잭션 함수를 복원하고, 실패 전후 전체 오답·사진 Blob 원장/재풀이 이력이 **깊은 동등**임을 확인.
   - **정상 성공 검증:** 같은 메모 재입력·저장 후, 실제 토스트 **'학부모 관찰 결과를 저장했습니다.'** 표시와 상세 화면 `#check-history`의 **정확한 메모 본문** 노출을 동시에 대기·단언. 단순 '부모' 제목과 DB 건수만으로 통과 불가.
   - **재진입 검증:** 앱 새로고침 후 오답 목록의 **보이는 해당 기록**을 다시 열어, 같은 정확 메모가 실제 상세 화면에 표시됨을 확인. 사진 Blob 전체 바이트·재풀이 1회·부모 관찰 1회 원본 유지.
   - 두 화면폭 각각 등록/재풀이/합성 실패/정상 성공/재진입 5장 PNG, 실행 JSON. 외부 요청·pageerror 수집/차단, 앱 파일 blob 검증.
2. `.github/workflows/wrong-a18-19-parent-visible.yml`: 전용 신규 CI, Ubuntu 24.04·Node 22·Playwright 1.56.1 Chromium, 320/390, 신규 증거 업로드. `push.paths`는 `tests/wrong-a18-19-parent-visible-feedback.mjs`, 전용 workflow, 앱 소스 변경을 포함.
3. **앱 HTML 변경 없음:** QA `index.html`의 Git blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35` 유지. A18-17 기준 `4b4c5ec3539c169948015931b63d4e51350ed9e9:index.html`와 **원본 byte 동일**. 기존 A18-16a QA 생성기 `qa/a18_16a_clear_live_patch.py`와 선행 `2a070c134511a6b402f3f3c7154c0ab610e1f55f:index.html`로 **전·역패치 원본 전체 바이트 일치**를 신규 CI에서도 실행:
   `A1819_REAL_APP_ORIGINAL_SOURCE_AND_REVERSE_BYTES_PASS`.
   따라서 A18-19을 이유로 앱 기능을 새로 변경하거나 복원/삭제를 재활성화하지 않았다.

## 3. 실제 CI 결과

**[신규 CI #44124626668 — SUCCESS](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44124626668)**, job `134184913903`, [Artifact `14346857524`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44124626668/artifacts/14346857524) (5,014,832바이트). 최종 로그 `A1819_RESULT=PASS_A1819_PARENT_EXACT_VISIBLE_AND_FAIL_SUCCESS_FEEDBACK`.

| 실제 앱 Chromium 화면·원장 증거 | 320px | 390px |
| --- | --- | --- |
| 가상 사진 2,375B·과학 오답 1개 등록 | PASS | PASS |
| 재풀이 저장 1회 및 재풀이 횟수 **화면 표시** | PASS | PASS |
| 부모 관찰의 `mistakes` 쓰기 **합성 실패 1회** 유발 | PASS | PASS |
| 합성 실패 시 부모 저장 **실패 안내 실제 화면 표시** | PASS | PASS |
| 실패 직후 전체 사진 Blob·오답·재풀이 **원본 동일** | PASS | PASS |
| 재시도 후 부모 저장 **성공 안내 실제 화면 표시** | PASS | PASS |
| 저장된 부모 **메모 정확 본문**이 상세 `#check-history`에 노출 | PASS | PASS |
| 새로고침 → 목록 실제 클릭 → 메모 정확 본문 재표시 | PASS | PASS |
| 사진 Blob·오답1·재풀이1·부모관찰1 원본 재진입 보존 | PASS | PASS |
| QA 앱 해시 고정·전체 바이트 역패치 일치 | PASS | PASS |

결과물 **PNG 10장 + 결과 JSON 1건**, 외부 요청 0·JS pageerror 0·테스트 전후 앱 소스 변경0. 자동화 실행 약 1.9/1.8초는 사람의 조작시간 측정이 아니다.

## 4. 오류 원인 분리와 제한

- 이번 신규 CI는 **첫 실행부터 성공**했으므로 실제 앱 결함을 확인·수정한 것으로 보고하지 않는다.
- 강제 `AbortError`는 **시험 코드가 만든 가상 쓰기 실패**이며 실사용자 환경에서 동일 장애가 발생했다는 증거가 아니다. 실패 시 UI 메시지·원장 보존 **단일 실패 지점의 반응**을 확인한 것이다.
- **미검증:** 실제 아동/부모, 실제 사진·기기 카메라/OCR, 실제 스마트폰·Safari/VoiceOver·TalkBack, 3분 사용성 측정, 다중 탭 충돌, 다른 실패 유형, 실제 원본 보관 파일 다운로드, 운영DB·유료 API·원자적 복원 성공. 특히 `safeToRestore:false` 유지, 실복원·전체삭제는 실행하지 않았다.
- **판정:** 격리 QA **실행 증거 확보 및 자체 PASS**, 06 독립검증은 아직 별도 판정 필요. PR #80 Draft/미병합, 제품 dev·운영 데이터·광고·배포·예약 변경0.

## 5. 다음 및 인계

06 독립검증방에서 A18-19의 **실제 테스트 코드** (`check-history` 정확 본문, 실패시 원장 일치, 실패/성공 토스트)와 **CI 원문·아티팩트 존재·전체 역패치**를 대조하고 부분검증 판정을 00에 환류한다. 이후 추가로 필요한 검증은 실제 사용자 조작/스크린리더의 안내 전달 여부이며, 기존 PASS는 다시 실행하지 않는다.

**완료:** 신규 Chromium 320/390 2/2, PNG 10·JSON 1, 원본 전/역 바이트 정확, 00 총괄 보고. **다음:** 06 독립 판정. **필요:** 사용자 조치 없음.
