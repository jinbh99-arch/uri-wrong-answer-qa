# 02 WRONG A18-22 원시 ZIP·PNG·JSON 직접 대조 및 403 진입 URL 판정 정정 v1.1

**작업일:** 2026-11-18 KST · 02 WRONG 개발방의 **원시 산출물 추가 점검**. **06 독립승인 아님**, 제품 미반영. [00 최신 검증 기준 #6968647163](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6968647163), [06 이전 부분판정 #6966603086](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6966603086), [06 신규 ZIP 존재 확인 #6968507765](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6968507765) 상충 수준을 **실제 원시 파일 읽기**로 분리함.

## 1. 직접 확인한 정확한 원본

- 원본: [Github Actions 성공 run 44138438965](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965), 실행 SHA `26f8613e90dae38c0f95fb85cc8a9a0f2fef9279`, job `134234298721`, [artifact 14354170347](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965/artifacts/14354170347).
- **GitHub connector를 통해 artifact ZIP을 실제 받아 열었음**: ZIP **2,700,985 bytes**, 로컬 계산 SHA256 `a635134f2641104f172742f4aa355506cc53a0c03cf40e7bd13eaa94654080e6`, GitHub artifact 메타의 `sha256:` 값과 **정확히 동일**.
- 실제 ZIP 목록: `result.json` **1,643 bytes**, `320-01/02/03/04-*.png` **4장**, `390-01/02/03/04-*.png` **4장**, 총 **PNG 8장+JSON 1개**; PNG 모두 실제 열어 화면 확인. PNG 01·02는 가로폭별 **SHA256과 픽셀 이미지 완전 동일**. 03은 실제 성공 저장 뒤 별도 화면, 04는 아래 설명한 403 오류 페이지.
- [테스트 원문](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/26f8613e90dae38c0f95fb85cc8a9a0f2fef9279/tests/wrong-a18-22-parent-browser-back.mjs), Git blob `0412ba46e4103ca7a9a8445b75b5bc1c2d1ab744`; [로컬 미리보기 서버](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/26f8613e90dae38c0f95fb85cc8a9a0f2fef9279/scripts/qa66-wrong-loopback-preview.mjs), Git blob `57750b971342b8ccc15213cd57892880b3cf3661`; [역패치 생성기](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/26f8613e90dae38c0f95fb85cc8a9a0f2fef9279/qa/a18_22_parent_browser_back_patch.py).
- A18-22 실험용 index Git blob `a98ad002c30d4baec3007041d4798e4d44aba668`; 제품 `dev` 커밋 `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`와 구분. `baselineApp=false`는 **옛 QA index blob 비교 플래그**로서 수정된 QA에는 예상되는 값이며 제품 판정에 사용하지 않는다.

## 2. 원시 JSON/8 PNG 교차 결과

`result.json` 원문은 `status=PASS_A1822_BROWSER_BACK_UNSAVED_DRAFT_GUARD`, `externalRequests=[]`, `pageErrors=[]`, `realFamilyData=false`, `realParentTimingMeasured=false`를 저장했다. 두 폭 결과 모두 `nativeDialogs=[{type:'beforeunload',message:''}]`, `stayed=true`, `draftVisible=true`, `draftExact=true`, `unchanged=true`, `photoBytes=2099`, `savedBackAllowed=true`를 기록했다.

| 판정 대상 | 320px | 390px | 원시 파일·소스에서 실제 확인한 의미 |
|---|---|---|---|
| ZIP 무결성/구성 | PASS | PASS | ZIP SHA256 GitHub artifact 값 일치, PNG 4장씩·JSON 직접 개봉 |
| 저장 실패 후 `beforeunload` 경고 | PASS(격리) | PASS(격리) | JSON 이벤트 기록 및 테스트 `page.on('dialog',dismiss)` 확인; 네이티브 경고 자체는 PNG 안에 촬영되지 않음 |
| ‘머무르기’ → 현재 앱 화면 유지 | PASS(격리) | PASS(격리) | PNG **01 vs 02가 폭별 완전 동일** (SHA256/픽셀); `urlAfterBack=baseUrl=/` |
| 원문 메모 DOM 보존 | PASS(격리) | PASS(격리) | JSON `draftVisible/draftExact=true`; 화면 육안/테스트 입력 단언. DOM 원문 전체 덤프는 ZIP에 없음 |
| IndexedDB 오답·사진 불변 | PASS(격리) | PASS(격리) | JSON `unchanged=true, photoBytes=2099`; 테스트 `ledger(page)` 전후 `deepEqual`; 원시 DB 별도 덤프/각 기록 해시는 ZIP에 없음 |
| 재시도 저장 시 1건 등록 | PASS(격리) | PASS(격리) | 테스트 `checkHistory.length===1`·사진 `deepEqual`·03 화면 저장 피드백; 별도 저장 후 페이지 상태 확인 |
| 저장 후 history.back으로 이전 URL 이동 | PASS(이동 자체) | PASS(이동 자체) | `waitForURL('?a1822=entry')`, `savedBackAllowed=true` 및 PNG 04. **도착 페이지는 HTTP 403** (아래). |
| 정상 앱 화면으로 복귀 | **FAIL(시험상 403)** | **FAIL(시험상 403)** | **04 화면이 빈 흰 화면 + ‘시험용 URL 매개변수는 허용하지 않습니다’에 해당하는 깨진 문자열**. 시험 서버는 `if(query)return done(403,'시험용 URL 매개변수는 허용하지 않습니다.');` 로 모든 `?a1822=entry` 요청 차단 |
| 실제 모바일 뒤로가기·앱 강제 종료·새로고침·Safari | N/T | N/T | 물리폰 동작, OS의 `beforeunload` 정책·백그라운드 종료 및 초안 자동복구 시험 없음 |

**중요한 판정 정정:** 기존 [A18-22 v1.0 보고](./A18-22_parent_failed_save_browser_back_red_green_v1.0.md)의 ‘두 개의 동일 출처 문서’ 표현은 부정확할 수 있다. 진입 경로 `?a1822=entry`는 **서버가 403으로 응답하는 오류 문서**이다. `entryUrl`은 이전/목적지이고, 최초 앱 페이지는 `baseUrl=/`이므로 `stayed=true`와 `urlAfterBack=/`는 모순이 아니다. 하지만 ‘저장 후 정상 **앱** 복귀’는 이 테스트가 입증하지 않는다. 정확한 표현은 **‘정상 저장 뒤 브라우저 이탈 경고 없이 이전 URL(403 응답 경로)로 이동, 동일 출처 IndexedDB 원장 보존’** 이다.

## 3. 검사 추적용 PNG SHA256

| 원시 PNG | SHA256 |
|---|---|
| `320-01-failed-save-before-back.png` | `bddaaf6a7e0a4f4c03069e44495c20a14552d89383496d68ea4c8d81924eabf6` |
| `320-02-after-browser-back.png` | `bddaaf6a7e0a4f4c03069e44495c20a14552d89383496d68ea4c8d81924eabf6` |
| `320-03-saved-before-back.png` | `78ccb1175af6a78180b896c853cbabd8c9d8030dfbc947aabc110e857947ab17` |
| `320-04-allowed-after-save.png` | `2c1039d3b11bde8a2dccef3a07eb533aa796444c7e21b06e681efc7497fd9cab` |
| `390-01-failed-save-before-back.png` | `1ec0dc11a4a99870e8b6fb8b778963c655b4bd19cc1ce8089e5ccb258f9d6aef` |
| `390-02-after-browser-back.png` | `1ec0dc11a4a99870e8b6fb8b778963c655b4bd19cc1ce8089e5ccb258f9d6aef` |
| `390-03-saved-before-back.png` | `a8322c14b5230b38baba0389cd4ced89ca4d3c85d75e7bc0f25e378de2208451` |
| `390-04-allowed-after-save.png` | `40bbbb67d7e8493acbe7196f3539bf125aeaad4552d16f62c49b13b0a4946d4b` |

## 4. 왜 06의 기존 기록이 달라 보였는가

- [#6966603086](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6966603086)는 당시 원시 ZIP·PNG8·JSON을 열어 `stayed` 등 수치를 대조했다고 보고했으나, 이전 주소 `entryUrl`을 **직전 현재 주소**와 비교하여 '완전 차단' 모순이라고 해석했다. 코드상 `baseUrl=/`임을 확인하면 그 해석은 **정정 필요**.
- [#6967532354](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6967532354)는 ZIP 내부 미대조로 기록됐고, [#6968507765](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6968507765)는 artifact **존재**와 CI 단계만 확인했다. **회차별 검증 범위를 구별**해야 하며 모든 06 회차의 '원시 ZIP 직접 검토 완료'로 합치면 안 된다.
- **이번 02 개발방의 추가 자체 검증은 ZIP 원본 바이트·PNG 실제 육안·화면 01/02 완전동일 및 서버 403 응답 코드를 대조한 것**으로, 독립 06 검증을 대신하거나 완료 승격하지 않는다.

## 5. 다음 검증 1건(실행 범위 별도 판단)

기존 성공 CI #44138438965는 **그대로 보존/재실행 금지**. 00이 신규 격리 시험을 허용하는 경우에만, 403인 `?a1822=entry` 대신 **유효한 동일 출처 앱 화면의 두 문서 히스토리**를 만들고 아래 추가 증거를 수집한다: (1) history.before/current/target URL·`history.state` 타임라인, (2) failed save→back/Stay→메모 DOM·IDB·사진 원본, (3) 정상 저장→back 이후 **도착 앱 HTTP 200과 앱 UI 작동 여부**, (4) 320/390 각 PNG/JSON과 정확 역패치·원본 Git blob. 이 테스트가 통과하더라도 물리폰/Safari/강제 종료에서 `beforeunload`가 반드시 작동한다고 주장하지 않는다. 실제 제품 수정·PR #80 병합·실자료·배포·예약 변경은 승인하지 않음.

**최종 판정:** 원시 ZIP 무결성 **PASS**, 합성 Chromium 메모/IDB 보호 **부분 PASS**, 저장 후 원래 앱 화면 복귀 **현재 테스트상 403/미검증(기능 FAIL로 단정 금지)**, 실제 모바일/운영 **N/T**. 검증 완결성 및 안전성의 최종 독립승인은 **보류**.
