# 02 WRONG · 00T-02-VIS-FIX 단회 신규 CI 실패 분석·06/00 인계 v1.3

- 기준일: 2026-11-21 KST
- 00 지시: [#82 #7056392971](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7056392971), [#7055740882](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7055740882)
- 최초 06 FAIL: [#7055560666](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7055560666)
- **신규 1회 QA 커밋:** `ff55f0fb82c3ab8d63456ad2a5958b78d11e6c20`; QA 브랜치 `qa/wrong-ack-top-warning-native200-20261121` / index blob `101e7ea5ee5ba34e107c77981daaf58101c97750`.
- 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 및 기수락 ACK QA 불변. PR80 Draft, `safeToRestore:false`, 실가족/사진/운영·배포/예약 변경0.

## 실제 신규 CI (기존 실패 CI 재실행 아님)

- [run #44865442446](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44865442446), job `136727947202`, commit `ff55f0fb82c3ab8d63456ad2a5958b78d11e6c20`, **FAIL**.
- GitHub Actions `Validate parent and inverse without product modification` 단계 **PASS**: 신규 index→기수락 ACK QA→제품 dev의 2단 정확 원복·SHA 대조·스크립트 문법 및 diff 검사.
- 320px 실제 Chromium native zoom 2에서 저장 후 기존 `#form-error` 도달→토스트 겹침 검증 `overlap.length===0` 단언을 **통과하여** 다음 screenshot 단계에 진입. 이는 이전 재현 3108.75px²의 가림이 사라졌음을 *조건부로* 시사하지만, **겹침 면적 숫자를 새 JSON에 직접 기록하지 않았으므로 00 요구 overlap=0 원시 정량 기록은 N/T**. 390px 실행 전 종료.
- **새 실패:** `PLAYWRIGHT_BLANK_PIXELS_320-ack-immediate-native200_DISTINCT_1`. 원래 `page.screenshot(scale:'css')`가 단색→150ms/frame 대기 후 `page.screenshot(scale:'device')` 보정도 **유효 색상 1종**. 단색 화면을 성공 캡처로 대체·재명명하지 않았음.
- [ZIP artifact #14691508027](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44865442446/artifacts/14691508027): **1,246B**, SHA256 `0205611d4f324fe31bb9553ea0927f969ea05863a6aa8de9e0cd0ed43eb61b08` (직접 ZIP 재계산·GitHub digest 일치), ZIP CRC 오류0. **PNG1/JSON1**; PNG `320-ack-immediate-native200-playwright.png` 640×940 SHA256 `8b383cfa619dd1ff53da4ae2bf8e5e79c7cbd711111df409b877096cc421e2cd`; JSON `status=HARNESS_OR_CONTRACT_FAIL`, `caseCount=0`, `pngCount=1`, `distinctSampledColors=1`, `playwrightScale=device-fallback`, `jsErrors=[]`, `externalRequests=[]`.
- 따라서 **이번 회차 320/390 화면 유효 PNG·CDP 대조·가족 A/B 원장/사진SHA/아이DOM·상단 note 2/2 완전 회귀는 미검증**. 기존 ACK 4/4 기술수락·과거 06 원시 PASS는 그대로 유지하되 새 시각 FAIL 해소 완료로 승격하지 않음.

## 결함 원인·후속 계약

- 토스트 가림 원인(실제 재현): 사진 선택 안내 토스트가 `position:fixed; bottom:24px; z-index:10`로 3.4초 유지된 채 ACK 저장 불명 `role=alert`와 겹침. 현재 국소 패치는 ACK 커밋 성공 후 readback 불명일 때 **기존 사진 선택 토스트 타이머 해제+숨김만** 수행. 기존 ACK 중복방지/원장 저장·인증 로직 불변.
- 별도 캡처 원인: **미확정**. 네이티브 브라우저 200% 확대와 Playwright 단색 캡처 경로의 호환성, 클리핑/표면/타이밍을 독립 검토해야 함. Playwright 두 방식(css/device) 모두 단색이었고 이전 CDP는 유효했지만 이번 실패 run에서 CDP 단계는 도달하지 못함. 이를 앱 기능 FAIL로 단정하지 않음.
- 후속 제안(00 기술 승인 대상): **CI 1회 추가 승인 시에만** 같은 A격리 브랜치에서 Playwright screenshot 유효성 복구 경로(예: fullPage/대상 element 캡처와 동일 상태 CDP 비교)를 원시픽셀 기준으로 320/390 native zoom2 재시험. 실패 시 즉시 FAIL/원시 증거 남기고 자동 반복 금지. 겹침 영역 숫자 `0px²`를 JSON에 명시 저장; 2단 정확 원복·사진/UUID·아이 DOM·상단 note·하단 alert 회귀 후 06 독립.
- **요청:** 00은 위 신규 단회 CI 실패를 수령하고 `00T-02-VIS-FIX`를 미완료 유지, 추가 1회에 대한 기술 승인 여부/대체 캡처 수락조건 결정. 06은 이 문서·원시 ZIP에 대한 별도 판정이 없다면 PASS 처리하지 않음. 제품 dev/main·PR80·실가족·운영 DB/배포·계정·예약 변경 금지.

이 문서 커밋은 `docs/qa/`만 추가하므로 현재 GitHub Actions의 경로 필터(index.html, 지정 테스트/워크플로)를 건드리지 않아 **신규 CI를 유발하지 않는 보고 작업**이다.
