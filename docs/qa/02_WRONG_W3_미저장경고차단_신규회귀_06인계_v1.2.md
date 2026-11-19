# 02 WRONG W3 — 미저장 경고 유지 / 허용 전환 토스트 삭제 신규 320·390px 회귀, 06 인계 v1.2

**작업일: 2026-11-19 KST · 판정: 02 자체 신규 A격리 PASS 10/10, 06 신규 독립 N/T, dev 반영 BLOCK 유지.**

## 1. 신규 보강 사유와 검증 계약

기존 W3 [02 자체 12/12](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6994206652)·[06 원시증거 부분 PASS](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6995224236)는 **정상적인 부모→아이 전환 후 토스트가 사라지고 사진 A/부모 메모가 보존되는 경로**를 검증했다. 반면, 4줄 보강이 `v218ApplyMode()`의 기존 3개 차단 경고를 지우거나 미저장 초안을 잃게 만드는 역회귀는 이번 후보 코드에 대해 별도로 입증되지 않았다.

이번 **새로운 음성(negative) 경로**는 동일한 실제 QA 후보 `index.html`를 대상으로 320·390 폭 각각에서 다음 5개 상황을 확인한다.

1. 오답 등록 중 문제 초안이 있으면 아이 화면 전환이 차단되고, 원문 입력·기존 페이지·경고 토스트 표시와 미저장 원장이 유지된다.
2. 상세 화면에 미저장 부모 관찰 메모가 있으면 전환이 차단되며 메모 원문·경고 토스트와 저장된 오답이 유지된다.
3. 비수학 오답의 일반 재풀이를 **선행 저장한 후** 나타나는 미저장 재확인 질문 입력란에 값이 있으면 전환이 차단되고 질문·경고 토스트·기존 원장이 유지된다.
4. 세 초안을 모두 해소한 뒤 허용되는 전환에서는 **이전 부모 경고 토스트가 본문과 DOM에서 삭제/숨김** 처리되며 저장 원장은 변경되지 않는다.
5. 부모 복귀·강제 새로고침 후 합성 저장 원장이 그대로 보존된다.

각 폭에서 총 5/5, 합계 10/10 체크. 실제 가족 인증·사진·운영 앱이 아닌 loopback 가상 기록·일회성 IndexedDB 전용이다.

## 2. 원본 고정·1차 실패와 국소 보정

- `dev` 원본 HEAD `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, 원본 앱 blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`.
- W3 QA 앱 후보 blob `6ff6cf1c2cfeef3706381a68fc105feab8258b04`. 원본 대비 **앱 `index.html` +4/-0**, 이번에는 앱 수정 0.
- 신규 전용 테스트 `tests/wrong-w3-blocked-drafts-toast-guards-320-390.mjs`, 전용 workflow `.github/workflows/wrong-w3-negative-guards-320390.yml`. QA 후보 브랜치 `qa/wrong-w3-internal-dev-candidate-20261119` 밖 영향 없음.
- 첫 [CI 44473977721](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44473977721)는 320 두 경로를 확인한 뒤 세 번째 테스트에서 **테스트 선행조건(비수학 일반 재풀이 저장) 누락**으로 동적 입력란을 찾지 못해 FAIL. 이를 제품 실패로 판정하거나 PASS로 덮지 않는다. 원시 첫 실패 artifact `14504969959`, ZIP digest `87ebf5a72e7b2283ccd6731a78abc9d46f1ab79362f9ec8a74dab5d3938fb99e`.
- 테스트 데이터 준비에 **5줄만** 추가한 국소 수정 `9b46902522de66987ff0398b39df8277eaa7bb6d`: 합성 일반 재풀이 저장→동적 입력란 표시 후 세 번째 경고 검사. [이전 테스트 상태 대비 diff](https://github.com/jinbh99-arch/uri-wrong-answer-qa/compare/db73ea691e1b8711d7bdc1ac8941f52cfd79dbaa...9b46902522de66987ff0398b39df8277eaa7bb6d) **테스트 1파일 +5/-0**, 앱·워크플로 수정0.

## 3. 신규 실행·원시 증거 직접 대조

- [수정 테스트 CI 44474566499](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44474566499): **completed SUCCESS**, job `135391857297`, 실행 소스 SHA40 `9b46902522de66987ff0398b39df8277eaa7bb6d`. CI 로그에 `W3_GUARDS_APP_SOURCE_EXACT_FOUR_LINES_PASS`, 320·390 각 다섯 `W3_GUARD_PASS`, 결과 `PASS_W3_NEGATIVE_GUARDS`, 오류/외부요청 각각0.
- [원시 artifact 14505728063](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44474566499/artifacts/14505728063), ZIP 크기 **964,364B**, SHA256 `e514c06c0723fbc6c53ff1e9970048cb05feafb6be90f6037c4afd98db96581e`. 별도 다운로드·실제 압축 개봉·CRC 검사 PASS.
- **PNG 8장**: 320×800 4장, 390×850 4장. **JSON 1개**: `result.json`의 `checks:10`, 각 폭 `draftGuards:3,allowClean:1,reload:1`, `pageErrors:[],externalRequests:[]`, `safeToRestore:false`. 390 재확인 질문 경고 스크린샷을 별도 실제 시각 확인해 부모 화면 유지·경고 표시를 확인했다.
- 선행 W3 정상 경로 12/12와 이번 **역방향 경로 10/10은 서로 다른 테스트**이며 단순 CI 재실행이 아니다.

## 4. 06 독립과 00 공개·dev 게이트

- **06 독립에 새로 요청할 차분**: 테스트 1파일 +5/-0 정정, 새 CI SHA/job/ZIP digest·CRC·PNG8/JSON1, 3개 가드에서 경고 유지 및 허용된 전환에서만 부모 토스트 제거, 저장 원장 불변, 앱 소스 blob/역치환. 06의 본 신규 증거 독립 판단은 **N/T**. 실폰·실인증·운영은 N/T.
- [00 승인](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6980621371)의 `dev` 내부 적용은 **외부 자동배포 비연동이 입증되지 않으면 금지**. [배포 게이트 v1.1](./02_WRONG_W3_06독립판정수령_dev자동배포안전게이트_v1.1.md)의 BLOCK을 계속 적용. 이번에 `dev/main`·PR80 Draft·실가족·DB·광고·도메인·공개배포·예약 변경 0. W7 `safeToRestore:false` 유지.

**완료:** 새 차단 경로·허용 전환 10/10 자체 원시 QA PASS, 실패 원인 분리 및 국소 1회 보정. **다음:** 06 신규 차분 독립 → 00/08 dev 자동배포 비연동 게이트 해제 여부 별도 판단. **필요:** 사용자 조치 없음.
