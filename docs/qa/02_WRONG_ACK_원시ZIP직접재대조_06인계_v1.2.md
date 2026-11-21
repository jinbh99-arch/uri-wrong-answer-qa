# 02 WRONG ACK 상단 경고 — 원시 ZIP 직접 재대조·06 독립검증 인계 v1.2

- 기준: 2026-11-21 KST. 02 개발방의 **원시 자료 자체 재대조**이며 06의 별도 독립 PASS를 대신하지 않음.
- 00 최신 경고 계약: [#82 #7055400773](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7055400773) — 문서 최상단(scrollY=0)의 부모용 상단 안전 안내 **와** 제출 직후 현재 위치의 기존 하단 `role=alert` **둘 다 필요**, 상단 `role=note`를 저장 최종판정으로 오인 금지.
- 06 최신 판정: [#82 #7055456983](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7055456983) — 정적/CI메타 PARTIAL, ZIP 내부 독립 N/T.
- 제품 `dev` SHA40 `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변. 새 A격리 브랜치 `qa/wrong-ack-top-warning-native200-20261121`; 시험 SHA40 `56fe62708a8a7a7dc35b6c4f0ff41f302118916b`, 현재 QA HEAD는 문서만 추가된 `4386c0663f1c6ed3316f7d93ff6b3ce567399c0e`. QA index blob `a3d12711fa3a170645e01dd4c1b4e6e347f85132`.

## 원시 ZIP 직접 접근 절차 (기존 CI 재실행 금지)
- [GitHub Actions artifact #14685640806](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44851222661/artifacts/14685640806) — 해당 링크에서 원본 ZIP 다운로드 가능(접근 권한 필요할 수 있음).
- GitHub 연동 도구의 **`download_workflow_artifact`** 호출 인자: `repo_full_name=jinbh99-arch/uri-wrong-answer-qa`, `artifact_id=14685640806`. 이는 CI 재실행이 아닌 이미 생성된 원시파일 읽기임.
- Run `44851222661` / job `136682777714` / attempt 1 SUCCESS / artifact 크기 **1,310,616 bytes**.
- **이번 02 직접 재계산**: ZIP SHA256 `088cc2b7006842ef1324bdf9fd0cee7b8212dcbacb425dc09ab4760254b27f88` = GitHub digest. Python zipfile `testzip()` 결과 `None`(CRC 불량 0건). PNG12 + result.json1; 누락0.
- 06은 독립적으로 같은 ZIP을 다시 내려받아 SHA256/CRC/픽셀을 검증할 것. 02 실행을 06의 독립 실행으로 대체하지 않음. GitHub artifact 보존 기간은 업로드 설정상 7일이므로 만료 전 확인 필요.

## PNG 개별 SHA256·픽셀 대조
| 파일 (ZIP 루트 기준) | SHA256 | PNG 크기(px) | RGB 서로 다른 색 수 | 02 시각 대조 |
|---|---|---|---:|---|
| 320-ack-immediate-native200-playwright.png | `8b383cfa619dd1ff53da4ae2bf8e5e79c7cbd711111df409b877096cc421e2cd` | 640×940 | **1** | **단색(화면 증거 불가)** |
| 320-ack-immediate-native200-cdp.png | `1a3d2bb0be6a3dc345a63682a86cf6903021628e156eac2be746b63f24142ddc` | 640×801 | 7,040 | 하단 경고 표시, 짙은 토스트가 일부 영역에 겹쳐 보임 |
| 320-ack-scroll0-native200-playwright.png | `6adcdb7d18d6a581a08d2712057d3fbd2d28b01c11620edb1c7c133ed4de3194` | 640×940 | 6,643 | 첫 화면 상단 노트 표시 |
| 320-ack-scroll0-native200-cdp.png | `33e6b9abe9b0cbda316c16a590c336a17eba1d3cc2241880ab2ef498deabf214` | 640×801 | 5,430 | 첫 화면 상단 노트 표시 |
| 390-ack-immediate-native200-playwright.png | `8e824186f45cdddc44d6b963322a0d2ef1a61202ae29d47b3312c907ebc077c7` | 780×940 | **1** | **단색(화면 증거 불가)** |
| 390-ack-immediate-native200-cdp.png | `da54678d6022cee361164da437f72400b8fbde78b467e5716cab838638bb8aa8` | 780×801 | 6,295 | 하단 경고 표시, 토스트 겹침 가능성 |
| 390-ack-scroll0-native200-playwright.png | `04fcfbb7e6ee079ad74d8223319fcdb8430613ae52751d6280a9c8553a9060ec` | 780×940 | 8,640 | 첫 화면 상단 노트 표시 |
| 390-ack-scroll0-native200-cdp.png | `183121eec95f164b3e4271d3a5a20e32c90a2126b09018d45bbc74a9ada4237c` | 780×801 | 7,703 | 첫 화면 상단 노트 표시 |

나머지 4장은 부모→아이 전환 캡처로 ZIP 안의 `320-A-child-native200-{playwright,cdp}.png`, `390-A-child-native200-{playwright,cdp}.png`; 모두 색 수 1 초과이며 파일별 SHA는 `result.json.screenshots` 원시목록에 기재. 02는 ZIP의 12장 모두 개봉/해시 계산을 수행했으나 표는 신규 UX 경고에 직접 관계된 8장만 발췌.

## result.json 직접 재대조
- `status=SYNTHETIC_TOP_WARNING_PASS_FAMILY_AUTH_BLOCK`, `pngCount=12`, `firstViewportAtScroll0Pass=2`, `errors=[]`, `jsErrors=[]`, `externalRequests=[]`.
- 320: native zoom 1→2, scrollY=0 상단 note top=200/bottom=314.78125, viewport=470, 하단 form-error top=5083.4296875(최상단 비가시), 저장 직후 form-error top=265.4296875/bottom=335.4296875, scrollY=4818.
- 390: native zoom 1→2, scrollY=0 상단 note top=176/bottom=269.0859375, viewport=470, 하단 form-error top=4444.6171875(최상단 비가시), 저장 직후 form-error top=265.1171875/bottom=335.1171875, scrollY=4179.5.
- 부모 전용 note는 `role=note`, 기존 하단은 `role=alert`. **서로 다른 위치/시점에 나타나는 두 경고를 한 곳의 항상 가시 알림으로 오인하지 말 것.**
- 별도 Chromium 프로필 A1/B1, 처음 B0; 동일 프로필 다른 탭 A1 조회됨 → **실제 가족 인증 구현 미완료 BLOCK**. 아이 DOM 부모 메모 0; 실제 실가족/실폰/운영 ACK N/T.

## 06에게 남은 정확한 판정항목
1. 기존 ZIP `#14685640806`을 직접 다운로드→ZIP SHA256/CRC, 12 PNG/JSON 파일별 SHA·픽셀 대조. 특히 두 **단색 Playwright 즉시 캡처**를 정상 스크린샷 PASS로 처리하지 말 것.
2. 320/390 CDP 저장직후 하단 경고와 토스트 겹침을 실제 픽셀/요소 rect로 비교. **02 육안으로는 토스트가 경고 일부를 가리는 것으로 보이지만 독립 수치 판정 N/T**; 이 UX 문제는 상단 note 2/2와 별도.
3. scrollY0 상단 note 가시와 기존 하단 alert의 직후 가시를 구분. 00 계약상의 두 기능에 대해 각각 PASS/PARTIAL/FAIL.
4. UUID·사진SHA·아이 DOM 비노출·중복방지, QA→기수락 ACK→dev 원본 **정확 2단 역패치** 재확인. 실제 가족인증 BLOCK·실기기/운영 N/T 유지.
5. 06 결과를 #82에 새 증분으로 보고→00 기술판정. 제품 dev/main·PR80 Draft·`safeToRestore:false`·배포·실자료·예약 유지.

**상태: 이번 작업은 02 원시 증거 직접 확인 및 06이 다시 재현할 경로/차이 정리 완료. 06 독립 최종 PASS/00 제품 수락은 아님.**
