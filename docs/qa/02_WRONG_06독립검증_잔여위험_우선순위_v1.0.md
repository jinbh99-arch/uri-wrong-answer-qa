# 02 WRONG — 06 독립검증 미완료·제품 미반영 위험·증거 우선순위 v1.0

작성: 2026-11-18 KST · **02 담당 읽기전용 재감사/문서 인계**. 기존 성공 CI·제품 배포·PR·예약 반복/변경 0.

## 1. 총괄·개발본 대조 결과

- 공식 현재 흐름은 [#87 21:32 KST 실행 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87) 및 [00→08 math 독립보안 P0 #6978436704](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6978436704): **01 LEVEL AdSense C math→08→06→00 승인 게이트** 우선. 구형 `?q` 최초 GET 위험은 수용 불가/BLOCK; WRONG QA는 **후행**, 광고/공개·제품/DB 작업 불가.
- 02 저장소 현재 `dev=3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`, **PR #80 Draft/미병합**, `safeToRestore:false`. 기존 W3/W5/W9 QA의 CI 성공과 운영 제품 적용은 서로 다름.
- **제품에 실제 남아 있는 W3 토스트 잔류 현상 정적 재확인**: dev `function notify(t)`는 `#toast.textContent=t`를 설정한 다음 3400ms 타이머에서 `.hide`만 추가. `v218ApplyMode('child')`는 미저장 초안/관찰·질문 차단 가드를 **앞부분에서 먼저 수행**한 뒤, 자녀 모드로 실제 넘어갈 때 `#toast`를 비우거나 숨기지 않는다. [W3 격리 가역 패치](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-child-toast-mode-boundary-20261118/qa/w3_child_toast_mode_patch.py)는 차단 가드 **이후**에 기존 타이머 취소→`toast.textContent=''`→`.hide`를 넣어 통과했지만 **dev에는 적용되지 않았다**. 이는 관측된 **UI 알림 경계/편의 문제**이지, 민감한 실가족 정보가 외부로 유출됐다는 증거가 아님.

## 2. 실제 GitHub Actions / artifact 재조회 (2026-11-18)

아래 5건 모두 **CI completed/success · 실행 SHA40 일치 · artifact 현재 미만료 · GitHub digest 확인**. 이 문서는 과거 PNG/JSON을 재생성하거나 06의 독립검증을 대신하지 않는다.

| 02 QA 범위 | 실행 SHA40 | CI/원시 artifact·SHA256 | 기존 02 자체/독립 상태 |
|---|---|---|---|
| **P1① W3 다른 오답 사이 지연 OCR 390px** | `723a98c5d33d39c466cc9a608a95b562f389f741` | [CI 44250601733](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44250601733) · [ZIP 14403657921](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44250601733/artifacts/14403657921) · `50f4566752cb79aa811fb080a6fada96170eef944633ac92116eb61943972c94` | 02 합성 Tesseract 5/5 PASS, 원장/사진 불변 · **06 독립 N/T** |
| **P1② W3 부모 사진선택 알림→아이 화면 잔류** | `47abbd18f6c41bbdb2ff3fce3e3c92607b0e8a71` | [CI 44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980) · [ZIP 14405321094](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980/artifacts/14405321094) · `e44a2d3f391e730f01798f09a670c42c02e3506a9f2d8676b1e947cc350aec6a` | 02 RED 기존 결함/QA-only GREEN 320·390 PASS, **제품 미반영·06 N/T** |
| **P2 W5 사진 A≠B: 교체 폐기→reload→복귀** | `bb001d7bc58b0ad7f4381267167f1d165beffcf5` | [CI 44261822975](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44261822975) · [ZIP 14409275395](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44261822975/artifacts/14409275395) · `8faedac17526733e2055be032c9337d2892a65b2d15c818186cb5dd567887e4e` | 02 320·390 12/12 PASS, 저장 Blob SHA/ID 불변 · **06 N/T** |
| **P3 W9 실제 Chrome 탭 확대 200%, 키보드·원장/사진** | `492065fe1c915882d76efc0115523c4d5cf57873` | [CI 44284806565](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44284806565) · [ZIP 14418173496](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44284806565/artifacts/14418173496) · `5d13039c4cabe9d36b07c485b34dff4f02521d712b45b4b49f64368dfe84ae25` | 02 320·390 12/12 PASS·기존 가상 원장 보존 · **06 N/T** |
| **P3 W9 첫 Tab→Enter 본문 실제 포커스/화면 캡처 차분** | `e412955198b8308c5f0a9a7217a92ac09198e8b6` | [CI 44289641424](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44289641424) · [ZIP 14421072282](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44289641424/artifacts/14421072282) · `6b5c1d75b7f9d3eae2299779d8b365f2516ce9ef890ec97e976ec952df894077` | 02 320·390 2/2 PASS, `#qa-main` 실제 포커스 · **06 N/T** |

참고 원시 인계:
- [W3 OCR 390 인계](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-cross-record-ocr-390-dev-20261118/docs/qa/W3_390_교차기록_지연OCR_원시증거_06인계_v1.0.md)
- [W3 토스트 원시 RED/GREEN 인계](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-child-toast-mode-boundary-20261118/docs/qa/W3_아이화면_부모알림_잔류_RED_GREEN_06인계_v1.0.md)
- [W5 사진 A/B 인계](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w5-distinct-photos-discard-reload-20261118/docs/qa/W5_서로다른사진AB_폐기_새로고침_06인계_v1.1.md)
- [W9 본문 이동·캡처 인계](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w9-skiplink-zoom200-viewport-20261118/docs/qa/W9_첫Tab_본문이동_확대캡처오차_차분인계_v1.0.md)

## 3. 06 독립판정 계약과 제품승인 게이트

1. **06 첫 차분 = W3 토스트** (이미 관측된 현 dev UX 문제). SHA/원시 ZIP PNG8·JSON2 **RED와 GREEN을 분리** 대조. 특히 **미저장 오답 때문에 child 전환이 차단될 때 보호 경고를 지우지 않는지** 확인. 합성 사진뿐이므로 실제 개인정보 유출 주장 금지. **이 자체 PASS를 근거로 02가 임의로 dev/main에 패치하지 않음**. 독립판정 후 00이 제품 dev 합류/후속 실기기를 별도 승인해야 함.
2. **다음 W3 OCR 개인정보 경계**: 합성 늦은 A 응답이 B/아이에 섞이지 않는지와 사진/IDB 원장 불변을 독립 확인. 합성 worker 주입이며 실제 OCR SDK·실사진/네트워크 N/T, 모드 토글은 인증이 아니라는 점 유지.
3. **W5 다음**: 서로 다른 PNG A/B 해시/픽셀·저장 Blob SHA/ID, 폐기/reload/부모·아이 화면 동선 대조. 원시 사진 없음, 장기 데이터 내구성 N/T.
4. **W9 후행**: Chrome `tabs.getZoom=2`와 CSS zoom 시뮬레이션을 혼동하지 않고 자연 첫 Tab→`#qa-main` 실제 focus·320/390 문서/글리프 좌표 확인. 이전 `fullPage` PNG 글자 잘림 의심은 화면 캡처 배율 변동으로 설명 가능하지만 실기기·화면낭독기 접근성 N/T.
5. **원본 보호·승인 조건**: 06은 실행 SHA/원시 ZIP 내부·digest 및 원본 `index.html` Git blob·가역 패치·독립 PASS/FAIL/N/T를 구분한다. **최종 제품 반영 게이트 = 06 독립 PASS→00 제품 변경 범위/실기기 검증 승인→02 한정 적용→재검증**. 현재 어느 단계도 자동 승격하지 않으며 안전상 출시 승인도 아님.

**정확한 현황:** 02 자체 격리증거 5건 완료/정적 대조, 06 5건 독립결론은 최신 #82/#87 조회 범위에서 **미확인**. 본 문서 등록·GitHub 댓글은 기존 06 채팅방의 새 모델 응답/수신 증거가 아니다. **01 AdSense C math 08 독립 보안이 우선**이고, W3 제품 개선은 P1 후보다. 제품 dev/main·PR 병합·광고/공개·가족자료/DB·유료API·기존 예약 **변경 0**.
