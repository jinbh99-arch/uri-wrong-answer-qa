# 02 WRONG W3 — 내부 dev 반영 승인 후, 자동배포 안전 게이트와 격리 후보 인계 v1.0

**2026-11-19 KST · 현재 상태: A격리 후보 실제 코드 적용 및 신규 Chromium 320/390 자체 PASS. dev 푸시는 미실행. 06 신규 차분 독립 N/T.**

## 1. 총괄 승인·예약 실행과 현재 중단 조건

- 00 공식 승인 [#6980621371](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6980621371): 내부 개발용 dev에서 index.html 4줄 국소 패치 허용, **dev push가 자동 외부배포를 유발한다면 절대 push하지 말고 QA 후보로만 인계**. 정상 아이 화면 전환 때 이전 부모 알림 타이머·문구·표시를 지우되 미저장 오답·관찰·재확인 질문을 차단하는 3개 경고는 유지.
- 02 기존 매시 예약 ID 6af80045faa48191b949336b3cff0b9c, 2026-11-19 07:34 KST경 실행 completed, 다음 예약 08:35 KST. 마지막 예약의 실제 내용은 dev 원본/승인 패치 일치 확인, **자동배포 비연동 확인 실패로 dev 수정 보류**. 기존 예약 재실행·변경·중복 CI 0.
- GitHub 실제 repo has_pages=true. main의 이전 Actions에는 *pages build and deployment* 성공 이벤트가 있으나, dev 브랜치 제한 Actions 조회 결과 0건. 현재 Pages 배포 소스 설정, 별도 GitHub 웹훅, 외부 호스팅 연동 전부를 확인할 수 있는 API 권한은 없음. 이는 **dev push 절대 비배포**라는 완전한 증명이 아님.
- [기존 08 Netlify 관리자 실증 #6886601103](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6886601103)은 2026-11-15 당시 기존 Netlify 수동 Drop 배포·Current repository Not linked를 확인했으나, **오늘 시점의 관리자 연결 상태는 직접 재조회하지 못함**.
- **결정:** 00 승인 경계를 준수해 dev 푸시를 보류하고, 원본 dev SHA로 만든 별도 QA 브랜치에 동일 앱 패치를 **실제 Git 커밋**한 뒤 새 결합 시나리오만 실행. 공개 호스팅·계정·실사용자 데이터·예약 변경 없음.

## 2. 실제 변경과 정·역패치 기준

| 항목 | 실제 값/상태 |
|---|---|
| 원본 dev SHA40 | 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b — 재조회 불변 |
| 원본 index.html Git blob | 250aff5b0a46490488b64f7b96a83c940d2d6c71 |
| QA 브랜치 | qa/wrong-w3-internal-dev-candidate-20261119 |
| [실제 앱 4줄 수정 커밋](https://github.com/jinbh99-arch/uri-wrong-answer-qa/commit/ce2e0c243410c4f82fae509c4945695d218a05b9) | ce2e0c243410c4f82fae509c4945695d218a05b9 |
| 수정 index.html Git blob | 6ff6cf1c2cfeef3706381a68fc105feab8258b04 — 기존 W3 독립 PASS의 GREEN 임시 앱 blob과 완전 동일 |
| [신규 실행 SHA40](https://github.com/jinbh99-arch/uri-wrong-answer-qa/commit/946f84cbbf4bbf4140f69a82ff5505fce5a40a88) | 946f84cbbf4bbf4140f69a82ff5505fce5a40a88 |
| 제품 대비 변경 | 앱 index.html **+4/-0**, 신규 테스트 1개, 신규 workflow 1개. 원본 앱 외 다른 제품 파일 변경 0 |
| [신규 CI 44416573121](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44416573121) | job 135198336404 **completed SUCCESS**, W3_COMMITTED_CANDIDATE_FOUR_LINES_EXACT_REVERSE_PASS |
| [원시 ZIP artifact 14478189455](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44416573121/artifacts/14478189455) | 566,522 bytes, SHA256 **ae28b0d9fdde13c4200fbae562c0be7ed32449a49bfddd749e12fe0d5eb803a5** |

**이번 새 실행은 이전 RED→GREEN 테스트의 재실행이 아님.** 실제 GitHub QA 브랜치에 커밋된 후보를 대상으로 사진 A를 먼저 저장, **내용과 해시가 다른 합성 사진 B를 임시 선택하고 취소**, 직후 아이 화면 전환 시 이전 부모 알림·문구 삭제, 원본 사진 A/오답 ID/부모 메모의 강제 새로고침 전후 byte-for-byte 불변을 통합 검사했다.

## 3. 실제 원시 ZIP 검증 — 02 자체 PASS 12/12

- CI 로그: 320px **6/6 PASS**, 390px **6/6 PASS**, 합계 12/12. result.status=PASS_W3_COMMITTED_CANDIDATE_PHOTO_TOAST, JS 오류0, 외부 도메인 요청0. 두 폭의 합성 오답과 사진을 **서로 다른 일회성 브라우저 컨텍스트/IDB**에 생성, 실사용 사진/성명/가족 계정 접촉0.
- GitHub artifact digest와 **로컬 ZIP 자체 SHA256 정확 일치**, ZIP testzip CRC 오류0. 실물 **PNG 6장(320×800 3장, 390×850 3장) 및 JSON 1개**를 직접 열어 파일명·해상도·상태값 확인. result.json SHA256 **92e94c7d550c8ee129ee0ed834fc22c797e77703cf47efe91934824f622b2748**. 6 PNG를 합친 표본 화면도 직접 살펴봄.
- 두 폭 공통: 저장 오답 1건·사진1개, 저장 blob SHA256 **21886aa508096c5ed229eb799bb3ba5ae06ca5f5a6c378fb03eaf6fb16e1defb**. 원본 사진 A의 ID/Byte, 부모 메모는 사진 B 취소→아이 전환→부모 복귀→hard reload에도 IndexedDB 전체 deepEqual 및 SHA 동일 PASS.
- 아이 전환 직후 DOM: child=true, 모드 pressed=true, **toastText 비어 있음·toastHidden=true**, 이전 부모 저장 메모의 본문 노출 false, 파일 input B 선택 0, 문서 가로 넘침0 (320→scrollWidth 320, 390→390). 브라우저 200% 확대나 OS 휴대전화·인증은 이번 검사 범위가 아님.
- 새 CI의 git diff --numstat **정확 4추가/0삭제**, 독립 Python 원본→후보·후보→원본 전체바이트 정·역치환 PASS. dev·main·PR80 실제 수정 0. 원본 데이터 복원 기능은 별개이며 PR80 W7 WebKit 게이트 BLOCK·safeToRestore:false 유지.

## 4. 미완료·06 독립 인계·00 판단

- **06에 새로 검증받을 정확한 범위:** 원본 SHA/후보 blob/CI SHA40, 4줄 외 앱 변경0, ZIP SHA/CRC·PNG6/JSON1 실제 내용, 사진 A/B 입력 해시 구별 및 A 저장 blob의 부모→아이→부모→reload 불변, 토스트 DOM0/외부 요청0. 이전 W3 [#6979473254](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979473254) 및 [#6979749342](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979749342) 독립 PASS는 유효하나 **이번 커밋 후보의 06 신규 판정은 N/T**.
- **개발 브랜치 반영:** 00 승인 자체는 존재하지만 'dev push 무자동공개' 선행 증거가 부족하므로 현 단계 BLOCK. 실제 승인 범위 내에서 진행할 다른 하부 검증은 완료. 권한 있는 00/08이 최신 Pages/Netlify 외부 자동연결을 별도로 검증해 공개 변경 위험이 없음을 확인하면, 현재 고정 원본을 다시 대조하고 그때 dev 4줄만 반영·새 dev SHA→06 독립→00 완료 재판정.
- 기존 Netlify 수동 공개본·GitHub Pages 공개원본·실실가족/아동 정보·실OCR·물리 휴대전화·화면낭독기·운영 백업/복원은 **N/T**, 정식 서비스 검증과 현재 A격리 테스트를 혼동하지 않음. 사용자에게 계정 공유·폰 검사 요청하지 않음. 예약·광고·배포·제품 main/PR 병합 변경 없음.

**완료:** 격리 QA 실제 코드 4줄, 신규 320/390 CI PASS12/12, ZIP PNG6/JSON1 직접 검증. **다음:** 06 차분 독립과 00/08 자동배포 비연동 확인 → dev 변경 가능 여부 결정. **필요:** 사용자 조치 없음.
