# 02 WRONG — VIS-FIX 캡처 원인 차분·AUTH-GATE 비운영 증빙조건 v1.0

- 작성일: 2026-11-21 KST / 기존 `00T-02-VIS-FIX`·`00T-02-AUTH-GATE`, `00Q-02-VIS`·`00Q-02-AUTH`. 새 ID 없음.
- **이번 신규 00 지시:** [#82 #7062529815](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062529815). `#87` 미종결 2건만. 이미 06 검증완료된 `00T-06-WRONG-FIX-VERIFY` 반복 금지.
- **읽은 실물:** 기존 브라우저 스크립트 `tests/wrong-ack-top-warning-native200-320390.mjs` blob `98baf69b9fe4efc03c68433ba82b6789e6dd31b4`, job136759813156 원시 로그, 06 독립 [#7058685080](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7058685080), 3·4 단계 HTTP 계약·QA epoch gate blob `9ab7d3630873affabc171058ef677e489e226a1a`, dev `scripts/qa44-supabase-auth-adapter.mjs` blob `d220dd1da6e98551a235e26305af9ce4bdc36cf8`, `scripts/qa47-live-auth-lab.mjs` blob `75e192bb8ef02c69001bab8353499f8df4d93e96`.
- **기준선:** 02 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, 제품 `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` 불변. VIS QA `qa/wrong-ack-top-warning-native200-20261121` 기존 HEAD `45ebfdebca95039f3ea71cb017ed5676ec75d523`; 이번에는 **문서만 추가**, 이미지·코드·CI 미생성.

## 1. VIS-FIX — 관측과 원인 가설 분리

**기존 관측 사실(새 검증 아님).** CI44875702927 / job136759813156 FAIL, ZIP14696006616 SHA256 `188a393bd8b2587c92aa27481e37417bd51e2980b44418f303f3aa5f45203f05`를 06이 독립 원시 대조·CRC PASS. 320/390 nativeZoom2에서 toast∩alert 0px², 상단 `role=note` 첫 화면 2/2 표시·하단 원위치 `role=alert` 유지, 같은 프로필 A 기록 접근 가능. **즉시 Playwright 두 PNG는 단색(고유색1), 그 다음 CDP 두 PNG는 유효**, scroll0/아이 화면의 나머지 8장 유효. 06 판정은 시각 중첩 부분 PASS, **캡처 두 경로 동시 유효 FAIL**, 실 가족 인가 BLOCK. `safeToRestore:false`.

**새 정적 코드 경로 대조(이번 분석).**
1. 시험 `screen()`은 `page.bringToFront()`→`requestAnimationFrame` 2회→`page.screenshot({fullPage:false,scale:'css',animations:'disabled'})`→이미지 저장·브라우저 canvas 기반 픽셀 샘플→**그 후** `ctx.newCDPSession(page)`/`Page.enable`→`Page.captureScreenshot({format:'png',fromSurface:false,captureBeyondViewport:false})`→별도 픽셀 샘플 순서. 따라서 두 캡처는 **동일 순간 또는 동일 렌더 표면을 보장하지 않음**. 06 댓글의 '동일 순간'은 동일 화면 상태를 뜻하는 관찰 설명이지 같은 타임스탬프 증명이 아님.
2. Playwright에서는 `animations:'disabled'`가 전달되며 CDP 직접 호출은 그 옵션을 사용하지 않는다. Playwright가 내부적으로 어떤 CDP 표면·클리핑을 사용하는지는 원시 증거에 없으므로 **`fromSurface:true`와 같다고 단정 불가**. 두 경로의 동작 차이에 연관될 가능성만 있음.
3. 시험은 `launchPersistentContext(headless:false)`+`xvfb-run`+Chrome extension `chrome.tabs.setZoom(tabId,2)` 경로. 초기 뷰포트 변경 뒤 브라우저 CSS `innerWidth` 320/390을 검증. **320 사례의 Playwright PNG 640×940과 CDP 648×932 크기 차**는 별도 디바이스/클리핑/표면 좌표계를 의심할 단서이나, 이 수치만으로 원인 확정 불가.
4. 각 PNG는 브라우저의 `createImageBitmap`→canvas 픽셀을 같은 방식으로 표본 추출한다. Playwright 1색 vs CDP 다색이어서 **단순 앱 alert DOM 부재나 공통 픽셀 분석 함수 오류라는 가설은 약함**. 그러나 저장 직후 표면 일시적 불안정 가능성은 남음.

| 후보 | 근거와 반례 | 판정 |
|---|---|---|
| A. 캡처 표면/컴포지팅 차이 | Playwright만 즉시 단색; CDP `fromSurface:false` 유효. 내부 Playwright 경로는 미계측 | **우선 검토할 가설·미확정** |
| B. 캡처 옵션·시점 | 2×rAF 뒤라도 두 호출이 순차, Playwright `animations:'disabled'`; 이후 scroll0/아이 캡처는 유효 | **대안 가설·미확정** |
| C. 확대/뷰포트·클리핑 차이 | native zoom=2, Playwright/CDP PNG 치수 일부 불일치, `innerWidth`는 올바름 | **대안 가설·미확정** |
| D. 실제 앱 전체가 빈 화면 | DOM 경고 표시·겹침0과 후속 CDP 유효 반례 존재 | **현재 직접 입증되지 않음** |

**후속 최소 단변수 반증 1건 (계획만, 실행 승인 아님).** 같은 승인된 합성 320/native200 **저장 직후 ACK 화면을 유지한 채**, 우선 CDP `Page.captureScreenshot`의 **`fromSurface:false` vs `true`만 바꾸어** 같은 시점 창에서 각 PNG 고유색/CRC·치수·DOM·scrollY·`innerWidth`/`innerHeight`·`visualViewport`·DPR·native zoom·`Page.getLayoutMetrics`를 동일 포맷으로 기록한다. Playwright 기준 PNG(`animations:'disabled'`)는 별도 표시하고 **같은 순간이었다고 보고하지 않는다**. false 유효/true 단색이면 표면 가설 강화, 둘 다 유효인데 Playwright만 단색이면 API/옵션 가설, 둘 다 단색이면 일시적 렌더링 가설을 후속 분리. **이 조건만으로도 원인 확정 아님**. 본 단변수 외 옵션 변경/기존 CI 재실행 불허. 새 CI·워크플로·제품 수정은 **00 별도 승인 전 0**.

## 2. AUTH-GATE — 구현된 합성 경계와 실인가 증빙 간격

**현재 증거를 과장하지 않음.** 06 원시 `sameBrowserProfileShowsA=1`(320·390)은 같은 출처/프로필의 IndexedDB 접근 가능 사례이며, 별도 브라우저 컨테이너 A/B 독립 기록 1건씩은 계정 권한 분리가 아님. 3단계 합성 HTTP 동일 recordId 사진/메모 충돌409은 [06 #7062059788](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062059788) `STAGE3_SYNTHETIC_HTTP_LIMITED_PASS`. 4단계 A→B epoch 폐기는 QA 전용 보조함수·HTTP 응답 완료 뒤 클라이언트 처리 보류로만 검증. 6단계 ACK는 [06 #7061806074](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7061806074) 합성 LIMITED_PASS. 실제 제품의 동일 프로필 로그인 및 서버/아이 권한 계약으로 승격 금지.

**제품 연결 경계:** QA44 Supabase Auth adapter는 `SYNTHETIC_STAGE_ONLY`, 승인된 `guardian_memberships` 필터의 **QA 설계 코드**이므로 실제 서비스 권한 확인 증거가 아니다. QA47 로컬 소유자 Lab은 실제 성인 시험용 provider 호출 경로가 있으나 `allowStudentData:false`, `allowProduction:false`, `studentRecordsEnabled:false`, `syncWritesEnabled:false`; 아이 기록·제품 서버 DTO/실가족 인가와 연결된 성공 원시가 없음. 로그인 성공만으로 guardian consent/verified member가 되지 않는다.

| 08이 판정하려면 필요한 **허가된 비운영 증빙** | 필수 관측과 거부 조건 | 지금 상태 |
|---|---|---|
| 별도 비운영 시험 환경/계정 구성 정본 | 실제 운영 프로젝트·실가족·아동 자료와 격리, 사용·삭제 범위 사전 승인 및 합성 fixture만 | **실제품 연결 증거 N/T** |
| Provider 사용자·세션 검증 | 서버에서 서명/issuer/audience/expiry 검증, 세션 만료·위조·무토큰 401, 자격 토큰 원문 로그 미수집 | **합성 QA 외 N/T** |
| Guardian 멤버십·동의·철회 | 서버가 가족-사용자 승인·동의·철회를 매 요청 확인, 가족 A/B 동일 recordId 교차 GET/PUT 403 및 원장/사진 불변, 철회 직후 403 | **진짜 멤버십·실 JWT/RLS N/T/BLOCK** |
| 역할별 최소 응답 DTO | 아이 GET/직접 ID·과거 버전/캐시 응답에서 부모 메모·정답·미확인 OCR·학부모 관찰 비반출, 인가 없는 POST도 403; display:none만으로는 불합격 | **실 아이 API와 직렬화 N/T/BLOCK** |
| 동일 프로필 가족 교대·폐기 세션 | A→B 전환 중 늦은 A 응답/DOM·메모리·IndexedDB·CacheStorage·ServiceWorker·브라우저 history의 재노출0, 탈퇴·로그아웃·재로그인 뒤 권한/토큰 폐기, 제품 epoch guard 연동 | **같은 프로필 노출 기존 증거 / 제품 방어 BLOCK** |
| 저장 무결성/복구 동시 보증 | 가족별 revision/ETag·snapshot SHA·사진 SHA, 충돌409·ACK_UNKNOWN 재조회·새 UUID/PUT0·원장 봉인/기존 기록 불변 | **로컬 합성 부분만** |
| 판정 프로세스 | 06의 320/390·실 브라우저·키보드/캐시 기능 검증, 08의 서버인가·아이 DTO 독립 검증, 00의 국소 기술수락. 운영/실폰/공개는 별도 | **06/08 실제 제품 최종 PASS 없음** |

**실행 금지:** 실가족·실JWT 임의 생성/재사용, 실제 계정 가입·철회, 운영 Supabase/D1/Cloudflare 변경, 공유 출처 개인 기록 테스트 금지. 위 표는 **승인된 비운영 환경이 마련될 때 필요한 증빙 목록**이지 이 작업의 자동 실행 요구가 아니다.

## 3. OCR 단계 5 신규 실패의 취급과 이번 작업의 범위

- 사용자 승인으로 새 국소 CI44902695088이 1회 수행됐으나 job136841738546는 **`Strict new delta only and product baseline unchanged` 단계 실패**, Chromium 설치 및 320/390 시험 **SKIPPED**, 아티팩트 없음. 이는 **OCR 동작 FAIL 판정이 아닌 검증 하네스 FAIL**.
- 후속 QA 정정 commit `229c7c714650698bad0b7d8ae0fb105dd50f9315`의 `git -c core.quotePath=false diff --name-only`와 trigger 경로 변경은 확인했으나, **후속 CI 추가승인0**. 이 문서의 VIS/AUTH 분석 작업에서 OCR CI를 추가 실행하지 않음.

## 4. 실행·판정·다음 딱 한 건

**완료:** 기존 소스/CI 로그/06 판정·QA44/47·가족 epoch를 실제 열람하고 static 원인가설과 08 비운영 증빙조건을 신규 문서로 정리. 독립검증을 새로 완료했다고 주장하지 않음.
**차단:** VIS 즉시 Playwright PNG2 단색 FAIL, `AUTH-GATE BLOCK`, `safeToRestore:false`, PR80 Draft, 7/8 HARD HOLD. 제품 dev/main 및 운영·배포·실데이터·계정·광고·예약 변경0.
**다음 1건:** 00이 **VIS `fromSurface` 1변수 국소 시험의 단회 승인 여부**를 판단. 08은 비운영 증빙조건만 검토, 실제 자격/권한·아이 API 실험은 별도 승인/환경 계약 뒤. 새 CI·코드 구현·기수락 CI 재실행 금지.

GitHub 문서 및 #82 댓글 제출은 00·06·08 **기존 ChatGPT 방 실수신** 증거가 아니다.
