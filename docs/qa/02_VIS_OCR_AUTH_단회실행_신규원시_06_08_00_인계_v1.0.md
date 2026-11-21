# 02 WRONG — VIS/OCR 단회 신규 원시·AUTH A~F 설계 인계 v1.0

- 기준: 사용자 2026-11-21, #82 [00 실행지시 #7062900528](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062900528), [00 기술승인 #7062893616](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062893616), [08 A~F #7062593397](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062593397).
- **직접 수신 구별**: 본 후속 02 채팅에서 GitHub 지시·A~F 원문을 실제 읽고 착수. 단 GitHub 기록은 기존 별개 자동화 02 채팅, 06·08·00 기존 ChatGPT 방의 직접 수신·응답 증거가 아님.
- 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`·index blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` **불변**. PR80 Draft/미병합, `safeToRestore:false`, 실자료/운영·광고·예약 변경0.

## 1. VIS 1회 — CDP fromSurface 단변수

- 소스 QA 커밋 `4d918acfdc25f1ddcff048e4c06ec15a4ce96267`, 기준 `a974936c…` 대비 **시험1/전용워크플로1/명세1 추가**, 기존 ACK 제품·회귀 시험 미변경. 
- [CI44907598970](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44907598970) job **136856394462 SUCCESS**. [ZIP14708566982](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44907598970/artifacts/14708566982) **402,985 bytes / GitHub SHA256 `10705ffaab74d24e3996a1b31f4eb38683b77037df32dc7dd3461df9e3ad50c2`**. 원시 PNG4/JSON1 업로드, **06 독립 ZIP SHA·CRC·PNG/JSON 재개봉 판정은 아직 N/T**.
- 320/native200: `fromSurface:false`와 `true` 모두 **648×932, 103526B, 310 sampled colors**, PNG SHA **양쪽 동일** `adc1b7a0f12a68d4e535728fe0dc8b8f6ff8e3422f168d39e0b050480fd6a69d`.
- 390/native200: false/true 모두 **788×932, 103083B, 202 colors**, PNG SHA **양쪽 동일** `15ea51a66982d4c20596bf7531d663ace1cd6b9e9163ea9f4a7632358e23ca9e`.
- 실행 순서는 같은 앱/스크롤/viewport를 고정한 **순차 CDP 호출**. 따라서 **CDP fromSurface true/false가 유효 화면/동일 PNG임을 한정 실증**, Playwright 즉시 `page.screenshot` 자체는 이번에 다시 캡처하지 않았다. **기존 즉시 Playwright 단색2 FAIL 해소 아님; 표면 옵션 단독 설명력 약함**. native zoom2·새 source inverse PASS(ACK 상단 후보→기수락 QA→dev 원본).
- 06 요청: **새 ZIP14708566982만** 독립 SHA/CRC·PNG4/JSON1·앱 상태/zoom·색상수·동일 PNG SHA·정확 역패치 확인. 기존 CI44875702927/PNG12, W03·ACK 반복0. 상태 `VIS_CAPTURE_ROOT_CAUSE_UNRESOLVED`, `00T-02-VIS-FIX` BLOCK.

## 2. OCR 단계5 보정 1회

- 지난 CI44902695088은 한글 파일경로 QA 하네스 단계 FAIL, Chromium 미설치·테스트 미실행으로 판정 불가. 기존 workflow 수정 SHA `229c7c714650698bad0b7d8ae0fb105dd50f9315`의 `core.quotePath=false` 기준.
- 신규 **반례 파일만 주석 1줄 차분** `5e7d969a4cb009bbc615ffc48a3b552502f1063f`; GitHub compare로 기존 `229c7c7…` 대비 다른 파일 변경0 확인. [CI44907635062](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44907635062) job **136856501753 SUCCESS**, [ZIP14708207083](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44907635062/artifacts/14708207083) **173,817 bytes / GitHub SHA256 `37b8167e4ad526c520d63dd7ba1e14b9c140e54b69e0f69bb3d4c79e906882eb`**, 320/390 PNG2/JSON1 업로드. 06 직접 아티팩트 독립 검증 **N/T**.
- 신규 자체 JSON `status=PASS_SYNTHETIC_ONLY_AUTH_BLOCK`, 두 폭 각각 `staleOldDiscarded=true`, `parentTextNotOverwritten=true`, `nextOCRPreviewOnly=true`, `reviewNotAutoGranted=true`, `photosAndRecordUnchanged=true`, `childDraftResidueZero=true`; errors0.
- **검증 한계:** 가상 1px 사진/합성 Tesseract, 같은 ID의 순차 OCR1 지연→사진 회전 무효→OCR2 후보 시험. 실제 OCR·물리 휴대폰·두 OCR worker 역순 동시 처리·실가족 인증·운영 서버 미검증. 기존 W03 CI44883435344/QA84 및 단계3/4/6 재실행0. 06은 ZIP14708207083의 원시/사진 SHA·IDB·아이 DOM·원본 blob만 신규 독립 검사→00에 **신규 반례 한정** 판정.
 
## 3. AUTH A~F 설계만 완료

- [AUTH A~F 비운영 구성·증빙 설계 v1.0](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-p0-346-integrity-auth-ack-20261121/docs/qa/02_AUTH_GATE_A-F_비운영분리_수용증빙_구성설계_v1.0.md), 소스 문서 커밋 `469da8c387e16cc49ce62d52be83b093941990ee`. A 독립 origin·Auth/DB/Storage/계정, B 실제 signed provider JWT/verified guardian, C 교차 GET/PUT/POST·사진/백업·아이 DTO, D RLS+Storage/CAS·철회, E 동일 프로필 A→B·지연응답/캐시/DOM·IndexedDB, F SHA/CRC/PNG/JSON·정리·06/08 각 판정.
- **08 요청은 설계표 읽기전용 판단**. A/B 비운영 실접속·계정 생성/변경·JWT 취득·Supabase/Cloudflare 기존 DB·실가족·배포/유료 API는 **Jin/99 별도 B단계 승인 전 실행 금지**. QA44/47 실험을 현행 제품인가로 승격하지 않음.
- **AUTH-GATE BLOCK**, `safeToRestore:false`, 7·8 제품 통합 HOLD 유지.

## 4. 00 다음 판단 한 건

- 06이 새 **VIS ZIP14708566982 + OCR ZIP14708207083의 신규 차분**을 각각 독립 판정한 후 00은 **OCR 같은 기록 지연응답 한정 수락/보완** 여부만 결정하고 VIS 원인은 Playwright 별도 표면·시점 계측 새 승인 없이는 원인확정/기능 PASS 금지.
- AUTH는 신규 실행 착수 전 **Jin/99의 완전 격리 비운영 B 승인** 판단을 별개로 받음. CI 2건으로 실가족 접근 허용되지 않음.
