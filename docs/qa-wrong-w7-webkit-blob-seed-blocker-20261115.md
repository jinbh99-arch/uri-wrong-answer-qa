# 02 WRONG W7 · WebKit 사진 저장소 선행조건 진단 (2026-11-15)

**범위:** 기존 app `dev` `8bb3055d6af6e2537c32b89e3b054598c4bc7e51` 및 PR #80 후보에 대한 **QA 전용 WebKit Blob seed 차단** 진단. 운영 앱·실아동 데이터/사진·Netlify 배포·main/dev·인증·`safeToRestore:false` **모두 변경 없음**.

## 새 실증 — QA91 (Ubuntu → macOS, 2개 플랫폼)

- [Ubuntu WebKit 첫 진단 #43702119083](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43702119083): WebKit `Mozilla/5.0 ... Version/26.0 Safari/605.1.15`, origin `http://127.0.0.1:<ephemeral>`, `isSecureContext=true`. `plain-object`, `uint8array-4` 저장 **완료**. `blob-4`, `blob-4096`, `blob-262144`는 모두 `IDBRequest.UnknownError`/transaction abort. QA90는 기존 동일 원인으로 seed 단계 중지 (`Error preparing Blob/File data to be stored in object store`). **초기 QA91 워크플로에는 pipeline `tee`로 인해 Node 실패 코드가 누락된 오류가 있었으므로 이 실행의 녹색 표시는 안전성 PASS가 아님.**
- [macOS WebKit 엄격 진단 #43702328457](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43702328457): GitHub `macos-15` 실제 WebKit, 동일한 origin/secure context 조건과 동일 5개 케이스. `plain-object`, `uint8array-4`: **완료**; 세 가지 서로 다른 크기의 Blob 저장 요청: **전부 UnknownError/abort**. 워크플로에 `set -euo pipefail`을 추가하여 **정확히 실패(exit code 2)** 로 종료. 선행 seed가 실패했으므로 QA90 복원 함수 검사는 실행하지 않음. [QA91 로그 아티팩트](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43702328457/artifacts/14157336461).

## 확인된 사실과 확인되지 않은 것

1. **확인:** 격리된 Playwright WebKit 브라우저 두 CI 플랫폼에서 일반 IDB 값 쓰기는 성공했고 Blob 저장만 실패. 이 특정 QA90 실행의 `IDB_SEED_ERROR null`은 앱 복원 가드를 호출하기 전에 발생한 `UnknownError`; 요청 단위 원인은 `Error preparing Blob/File data to be stored in object store`로 좁혀짐.
2. **미확인:** 실제 iPhone Safari에서도 같은 오류가 발생하는지, 왜 테스트 환경 WebKit에서 발생했는지(기기·웹킷 빌드·브라우저 파티션/스토리지 백엔드 등), PR #80의 사진 바이트 검사/트랜잭션 keep-alive 방식이 WebKit에서 통과하는지는 **전혀 입증하지 못함**. 실기기/운영 개인정보에 대한 결론을 내리지 않는다.
3. **별도 근거:** [QA89 보완 전 결함 RED](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43681120170)에서 동일 크기·MIME 사진 내용만 post-digest/pre-transaction 구간에 변경하면 원본이 덮어써졌음. [QA89 Chromium 보호 후보 GREEN](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43681341839)에서는 사진 바이트 보존·정상 복원 확인. **Chrome 로컬 PASS는 WebKit/실인증/암호화/출시 PASS로 확대 금지.**

## 차단/재개 조건

- **PR #80 Draft 유지, dev 병합·제품 기능 및 Netlify 배포 변경 금지.** `safeToRestore:false` 유지, 부모의 실백업 복원 안전성 주장 금지.
- 다음 안전한 실증은 실제 기기나 WebKit Blob 직렬화가 검증된 별도 보호된 환경에서, Blob seed→사진 지문 검사→원자성 회귀를 신규 범위로 확인하는 것. 시험 환경의 Blob 저장 오류를 무시하거나 `Uint8Array` 성공을 Blob 사진 저장 성공으로 대신하지 않는다.
- 사용자에게 보여주기 위한 UI 체험은 별개 가상 자료 데모/정확한 dev 소스 ZIP으로 제공된 상태. 실제 최신 제품의 **보호된 온라인 미리보기 접속은 아직 검증되지 않았으며** 00/08 배포·Access/팀 보호 판단이 필요하다.

**판정:** QA91의 *진단은 완료*, W7 WebKit 보호 검증은 *환경 제약으로 미검증*, 제품 안전성 게이트는 *차단 유지*.
