# 02 WRONG A-03-8 — dev 원본 기반 선행 안전장치 의존성·신규 목록 확인 해제 경로

- 날짜: 2026-11-16 KST. **합성 데이터/격리 GitHub Actions 실행 전용**, 실가족·실OCR·서버 ACK·실폰/외부 배포 미검증.
- 제품 dev SHA: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (불변). Git blob: `250aff5b0a46490488b64f7b96a83c940d2d6c71`.
- 격리 브랜치: `qa/wrong-a03-8-dev-selective-preflight-20261116-1920`, dev에서 직접 분기한 **테스트·문서·패치 fixture 전용**, 제품 `index.html` 커밋 변경 0.
- 기존 A03-3 7/7·A03-5 10/10·A03-6 두 오류 반복 시험 0.

## 정적 의존성 결론

1. **+9/-3 직접 단독 적용은 불가**: 전용 [CI 43849588951](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43849588951)에서 실제 `git apply --check` 충돌, dev에는 `wrongA03UnknownCreateId`·`wrongA03SaveBusy` 및 목록 비동기 재조회가 없음. 이 조건을 해결했다고 오인하지 않는다.
2. 필요한 **기존 QA 선행 앱 코드 차이**를 별도 `tests/fixtures/a03-8-dev-to-predecessor-guard.patch`에 격리. dev→A03-6 직전 QA 앱 기준 **추가56/삭제8줄(7 hunks)**. A03-6 수정은 기존 `tests/fixtures/a03-6-selective-index-only.patch` **추가9/삭제3줄**.
3. **GitHub Actions의 버려도 되는 runner checkout에서만** `git apply --check` 후 선행 패치 적용→두 번째 패치 적용. 실제 두 패치 각각 확인/적용 4회 종료 코드 0. 최종 앱 Git blob은 이전 격리 Chromium PASS 소스의 `b85aa7176d4da135c2ac4b0d9758a4145081759b`와 **완전 동일**. 이 SHA 비교는 새로운 실브라우저 테스트를 이전 A03-6의 검증된 코드와 결부시키는 정합성 확인이며 전체 QA 재실행이 아니다.
4. 작업 종료 후 runner의 `index.html`을 원래 dev 바이트로 되돌려 SHA256 완전 일치, Git blob도 원래 `250aff5b...`와 일치. 운영 서비스 복구·배포 아님.

## 이번에만 새로 테스트한 긍정 경계

- **합성 Chromium**: 신생 과학 오답+합성 PNG 1장을 등록하면서 `mistakes` 후속 readonly IDB 조회 오류 1회를 주입해 `readwrite`는 성공/ACK 확인 불명으로 전환.
- 먼저 원장 `records=1/photos=1` 및 저장 버튼 잠금 확인. 다음 오답 목록으로 이동할 때 **사용자 확인 대화상자**를 승인하고 정상 비동기 read-only 목록을 읽음. 목록에 같은 ID가 있는 경우에만 pending 잠금이 해제됨.
- 이어 별개의 과학 오답 1건을 신규 저장: `records=2/photos=1`, **서로 다른 ID**, 원래 레코드 필드 완전 불변, 원래 JPEG 사진 바이트 배열 완전 동일.
- 화면 320px/390px PNG 총 **5장**, 390px 문서 너비 **390px**, 브라우저 JS 오류 0/외부 네트워크 요청 0. `safeToRestore:false`, 실제 복원 0.
- **초기 CI [43851428853](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43851428853)는 테스트 대화상자 승인 누락으로 16초 timeout FAIL**. 같은 runner에서 패치 조합 및 원복은 성공. 테스트에 기존 화면의 confirm 흐름을 반영한 후 **수정 CI [43851884820](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43851884820) PASS**. 최초 실패를 제품 회귀라고 쓰지 않음.
- [최종 증거 아티팩트 14217637464](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43851884820/artifacts/14217637464): `a03-8-positive-result.json`과 320/390 PNG 5장.

## 판정/다음

- **완료**: dev-rooted 별도 격리에서 선행 코드 의존성 정확한 차이 보존, 선행+후행 패치 내용 조합, 신규 양성 목록 확인→다음 정상 신규 등록 경계 Chromium PASS, runner 원문 복원.
- **보류**: +9/-3만 현재 제품 dev에 직접 적용 가능하다는 주장(불가); 선행 +56/-8이 최종 승인된 최소 프로덕션 이식 범위라는 주장(독립 안전성·기존 다른 분기와의 영향 별도 판단), 실제 병합·전체 런타임 QA·실가족/실인증/실서버 ACK·실기기.
- **00 판단 요청**: 이 선행 +56/-8 과 +9/-3 범위를 하나의 신규 선택적 제품 수정 후보로 수용할지, 더 좁은 dev 맞춤 안전장치로 다시 설계할지. 현재는 QA 자산만 저장, 제품 `dev`·PR80 Draft/`safeToRestore:false`·운영 DB·계정·광고·배포·기존 예약 변경 0.
