# 02 WRONG · 외부자문 `--headless=new` 단일 CI 검증 v1.4

- 작업일: 2026-11-21(KST). 담당 02 WRONG. **실패 재현·새 가설 기각(현 환경의 단일 변경 한정)**. 06 독립 판정/00 추가 보정 승인 없음.
- 00 사전 단회 승인 [#82 #7057339956](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7057339956): 이전 실패 CI 반복 금지, 현 A격리에서 신규 1회 한정.
- 외부자문 가설: 확장 사용 Chromium `headless:true`에서 구 headless 컴포지팅이 단색 Playwright 캡처를 낼 수 있으므로 `--headless=new`를 추가하면 개선될 가능성. **가설이며 입증된 원인 아님**.
- QA 변경 commit **`189cdab53ac95426e33b26dd7d2c2b0e2381159b`**, 부모 `661cbc20bc1b32ba2cf524016200dbd41843ab23`. `tests/wrong-ack-top-warning-native200-320390.mjs` 정확 **한 줄**만 변경: `deviceScaleFactor:1,args:['--disable-extensions-except='+tempDir,'--load-extension='+tempDir]` → `deviceScaleFactor:1,args:['--headless=new','--disable-extensions-except='+tempDir,'--load-extension='+tempDir]`. 테스트 blob `44c31278d850ed27d973b2cdcb6987031fc5a546` → `33673d415dcc1b921b2c687fec999b0275af701d`. 기능 index `101e7ea5ee5ba34e107c77981daaf58101c97750` 불변.
- [신규 CI #44870284002](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44870284002), job `136743038405`, attempt 1: **FAIL**. `Validate parent and inverse without product modification` **PASS**, Chromium 설치 **PASS**, 후속 화면 시험 **FAIL**.
- 실제 로그: `PLAYWRIGHT_BLANK_PIXELS_320-ack-immediate-native200_DISTINCT_1`. 320px·native browser zoom 2에서 CSS 스케일 스크린샷 실패→device 스케일 폴백까지 픽셀 다양성 **1색**, 390px 도달 전 조기중단.
- [신규 ZIP artifact #14693089018](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44870284002/artifacts/14693089018) **1,246B**, SHA256 **`1e121d42088327709e056af15fe5ccf8e2ddf22da489c6a8822ca0298ced9a54`** GitHub digest와 직접 재계산 일치, ZIP CRC `testzip()==None`.
  - `320-ack-immediate-native200-playwright.png`: 640×940, 3,630B, SHA256 `8b383cfa619dd1ff53da4ae2bf8e5e79c7cbd711111df409b877096cc421e2cd`. **직전 실패 #44865442446에서 나온 PNG SHA256과 동일**. 단색 화면이 그대로 재생성된 증거.
  - `result.json`: 1,480B, SHA256 `91432ed9654dab06f9d00014679c37798d0bab07641d39665700613870defff3`; `status=HARNESS_OR_CONTRACT_FAIL`, `cases.length=0`, `screenshots.length=1`, `pixelSummary.distinctSampledColors=1`, `playwrightScale=device-fallback`, `actualFamilyAuthentication=NOT_IMPLEMENTED_NOT_TESTED`.
  - 본 실패 ZIP에는 **CDP PNG 없음, 390 PNG 없음**. 320/390 정상 캡처·동일시점 픽셀 일치·반복 입력/사진/아이DOM 전체 회귀 성공을 주장할 수 없음.
- 토스트 가림 직전 수정(`clearTimeout(toastTimer)`, `toast.hide`) 및 00 요구 경고 비가림 계약은 기존 SHA와 기능 테스트 코드에서 불변. 겹침 단언은 screenshot 단계 이전이나 원시 overlapArea=0 수치는 JSON에 없음: **0px² 확정 증거 미제출**.
- **결론:** 해당 GitHub Actions 실행환경에서 `--headless=new` 한 줄만 추가하는 변경은 기존 Playwright 단색 캡처를 해결하지 못함. 이것은 원래 Chromium 확장/컴포지팅 원인 일반론을 입증하거나 완전히 배제하지 않는다. 기존 06의 캡처 FAIL/가족 인증 BLOCK 유지, A격리 ACK 4/4 수락 보존. 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변.
- **다음 제안(실행 승인 별도):** `headless` 플래그 반복보다 (1) 동일시점 Playwright 캡처 전 1px resize→복원/컴포지터 신호, (2) element/fullPage 캡처 교차증거, (3) headful Xvfb 또는 CDP capture 대비, (4) native zoom 계약을 `deviceScaleFactor:2`로 대체하는 안은 **별도 시험이며 native zoom 검증으로 오인 불가**. 기존 실패 run 재실행/재시도 **0**, 새로운 CI 사용 추가 승인 전 0.
- GitHub 문서는 02 담당 자체 인계. 06 채팅 수신/독립판정 및 00 제품 기술 수락과 분리. 제품 main/dev·PR80 Draft·`safeToRestore:false`·실가족 데이터·운영 DB·배포·광고·기존 예약 불변.
