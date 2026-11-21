# 02 WRONG · headful Chromium + Xvfb 신규 단회 A격리 실증 v1.5

- 일자: 2026-11-21 KST / 담당: **02 WRONG** / 상태: **지정 단회 시험·원시 인계 완료**, 전체 **PARTIAL / 캡처경로 시각 FAIL**, 06 신규 독립판정 및 00 기술수락 **N/T**.
- 00의 기술승인: [#82 #7057918355](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7057918355). 기존 실패 headless CI 재실행 금지, 이번 방식 신규 CI 1회 한정.
- A격리 코드커밋 `d0a497b799a647919b2345ff357365cd4dd5cc8f` (기준 `60816e554a6f643a53c9146f866741eccbecbcda`), 변경은 `tests/wrong-ack-top-warning-native200-320390.mjs` blob `98baf69b9fe4efc03c68433ba82b6789e6dd31b4` 및 workflow blob `dbaf873cf011947a33d6a28ed371a058955ad75a` **두 파일만**. `index.html` 신규경고 후보 blob `101e7ea5ee5ba34e107c77981daaf58101c97750`과 제품 dev SHA `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변.
- 신규 A격리 변경: extension 탑재 persistent Chromium `headless:false`, GitHub runner `xvfb-run -a`, `chrome.tabs.setZoom` native zoom **1→2**, Playwright와 CDP(`Page.captureScreenshot({fromSurface:false})`) 각각 **독립 1회 촬영**, 실제 PNG 픽셀 다양성 fail-closed, 상단/하단 경고 및 토스트 교집합 면적 **수치 JSON 저장**. 저장 ACK·사진·인증/원장 로직 변경 0.
- [GitHub CI #44875702927](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44875702927), job **136759813156**, attempt1 **FAIL**. 정확 소스 기준·2단 역패치 step **PASS**, synthetic Chromium 설치 PASS, 실제 브라우저 시나리오는 320/390 **2건 완료**. 마지막 단계에서 **Playwright/CDP 캡처 둘 다 유효** 조건이 2장면에서 불충족되어 **의도된 FAIL**.
- [원시 ZIP artifact #14696006616](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44875702927/artifacts/14696006616) 크기 **1,329,380 bytes**, 02 직접 내려받아 SHA256 **`188a393bd8b2587c92aa27481e37417bd51e2980b44418f303f3aa5f45203f05`** GitHub digest 일치, ZIP CRC 불량0(`testzip()==None`), PNG **12** + `result.json` **1** 실제 개봉. HTML/제품/브랜치 자동 병합하지 않음.

## 원시 결과(320/390 실제 native 200%)

| 영역 | 320 | 390 | 근거/주의 |
|---|---:|---:|---|
| 사진 선택 토스트 ∩ 저장 불명 `#form-error` 경고 | **0px²** | **0px²** | `result.json.overlapProbes`, 필터 후 후보 공집합. 새 토스트 가림 수정의 A격리 기능경계 충족 |
| 최초 scrollY0 부모용 상단 `role=note` | PASS | PASS | `firstViewportAtScroll0Pass=2`; 기존 하단 `role=alert`와 다름 |
| 저장 직후 하단 `role=alert` 가시 | PASS | PASS | `warningVisibleImmediatelyAfterEnter=true`, CDP PNG에서 글자 가시 |
| Playwright 저장직후 PNG 실제 픽셀 다양성 | **FAIL, 1색** | **FAIL, 1색** | `captureQuality[*].playwrightColors=1`, 기존 단색 SHA256과 동일 |
| 같은 순간 CDP `fromSurface:false` PNG | PASS (128+ 샘플색) | PASS (128+ 샘플색) | Playwright를 대체하는 동등 PASS 아님 |
| scroll0 및 아이 모드 Playwright/CDP 이미지 | PASS 2쌍 | PASS 2쌍 | 양쪽 각 128+ 샘플색, 각 파일 해시/치수 원본 보존 |
| 별도 브라우저 A/B | A1/B1, 새 B0 | A1/B1, 새 B0 | 합성 프로필별 저장 구분뿐, **가족 인증 PASS 아님** |
| 아이 모드 부모 메모 DOM 노출 | 0 | 0 | `childA/childB` body/input/detail false |
| 같은 프로필에서 다른 탭 A원장 읽기 | **1건 읽힘** | **1건 읽힘** | **실가족 인증/인가 BLOCK 지속** |

- A/B 사진 각각1건. 사진 원본 SHA256 **`9871ecf2f1ac74e30bc79d2477df43f72ae19d871aa43dbc7ee9cec059a2ad28`** 320/390 모두 동일·유실0. UUID 수 각1건·분리 브라우저 UUID 중복0, 중복 재제출 2차 기록 추가0.
- 스킵 링크 첫 Tab→Enter→`qa-main`, 저장 버튼 자연 Tab→Enter, JS 오류0/외부요청0. 원시 브라우저 실기기 아님.
- CDP 즉시 PNG 320 `fc41d1117089f50e172e844cd1be92137f4f2e6517959a08646f381c8bb31452` (648×932), 390 `462a6e2b6c6dfc92dc58dbb4c3c64aae59e43f81f07777b2182460c5d59c495a` (788×932).
- 같은 시점 Playwright 즉시 PNG 320 `8b383cfa619dd1ff53da4ae2bf8e5e79c7cbd711111df409b877096cc421e2cd` (640×940), 390 `8e824186f45cdddc44d6b963322a0d2ef1a61202ae29d47b3312c907ebc077c7` (780×940). **각 직전 헤드리스 실패 PNG와 SHA 동일**.
- 두 캡처 방식은 픽셀 크기 자체도 일치하지 않음(예: 320: 640×940 대 648×932). 따라서 모든 장면의 픽셀 완전일치가 아닌 각 방식의 **콘텐츠 가시성·화면/요소 좌표 일관성** 및 별도 단색 검사가 적절함.

## 판정·다음 인계

1. **02 수행 범위완료(FAIL/PARTIAL 근거 제출)**: 신규 승인 CI 1회 소진. 토스트 비가림 수치 0px²(320/390) 및 상단/하단 경고·원장/모의 A/B/사진 확인. Playwright 저장직후 캡처 단색 **FAIL 그대로**; 실제 원인(브라우저 surface·렌더 순서·줌)은 확정하지 못함. 새 headful 방식은 CDP 경로를 재현가능하게 했지만 Playwright 경로 해결은 아님.
2. **06 담당**: 이 신규 ZIP만 독자 다운로드→SHA256/CRC·PNG12/JSON1·역패치, `overlapAreaPx2=0`, 320/390 native200/Tab·경고 상태·원장/사진SHA·아이DOM을 **PASS/PARTIAL/FAIL**로 독립 판정. Playwright 즉시 PNG 2장 1색을 정상으로 승격 금지. 기존 CI 재실행 금지.
3. **00 담당**: `00T-02-VIS-FIX`의 *국소 토스트 비가림* 범위는 해당 증거/06 판정 후 한정 기술수락 판단 가능, *캡처 하네스 시각 동등성*은 FAIL 잔여로 별도 결함 분리. 같은 증거 없는 추가 CI/헤드리스 반복 승인 금지. 실제 가족 인증은 **독립 BLOCK**: 동일 프로필 A원장 접근 사실 유지. 제품 dev 승격/PR80 Draft/`safeToRestore:false` 변경 불허.
4. GitHub 보고·06 인계는 **기존 06 ChatGPT 채팅방의 직접 수신/실행 응답**을 증명하지 않음. 실기기·운영 ACK/가족 권한·보안·배포 테스트 N/T.

**변경 통제:** 제품 `dev/main`·PR80·실가족/운영 DB·유료 API·광고/배포/계정·기존 예약 0건 변경. 문서 추가는 workflow path filter 대상이 아니어서 새 CI 실행하지 않음.
