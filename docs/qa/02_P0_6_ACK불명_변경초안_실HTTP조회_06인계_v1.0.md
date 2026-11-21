# 02 WRONG · 6단계 저장 ACK 불명/변경 초안 — 신규 HTTP 원시 증거와 06 독립검증 인계 v1.0

작성 2026-11-21 KST · 기존 P0 3·4·6 묶음 중 **6단계 신규 차분 하나만** · 담당 02 · 독립검증 06 · 인증/가족 보안 08 · 판정 00.

## 1. 무엇을 새로 검증했는가

가상학부모 정적 의견은 **저장 불명·중복방지 부분 반영**이었다. 과거 QA34 `tests/qa34-put-ack-loss-cas-ledger.mjs`는 HTTP PUT이 커밋됐는데 ACK만 사라지고, 별도 GET과 stale 409가 확인되는 것을 이미 시험했다. **이번에는 그 성공 시험을 재실행하지 않는다.**

**새 경계:** ACK가 불명확한 상태에서 학부모가 **다른 문구로 초안을 변경한 다음 저장을 다시 누르려는 경우**. 기존 `requestId`·`recordId`를 잃지 않은 채 새 PUT을 차단하고, 인증된 로컬 HTTP GET으로 최초 제출한 **원본 전체 snapshot SHA·recordId·revision·ETag**가 일치할 때에만 저장 확인으로 전이되는지 검증한다. GET 결과 내용이 달라지면 성공 오판하지 않는다.

이것은 **실제 Node HTTP 연결을 사용한 가상 가족용 127.0.0.1 시험 서버**이고 운영 웹서버/실가족·실인증 서버가 아니다. 제품 `index.html`과 아직 연결되지 않은 **격리 QA 전용 저장불명 보조 계약**이므로 실제품 ACK·권한·시각적 복구의 PASS가 아니다.

## 2. 고정 원시 증거

- 원본 제품 `dev`: SHA40 `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` — 불변.
- A격리 브랜치: `qa/wrong-p0-346-integrity-auth-ack-20261121`.
- 신규 시험 코드 커밋 `194a3e12432ddfd4fef7a050e2f39340ab231ec7`, 신규 실행 하네스 설정 보정만 적용한 **검증 실행 HEAD** `e1bd0bdbf60fcf2bacadebb106397670eb68f5e3`.
- 신규 테스트 `tests/wrong-p0-ack-unknown-changed-draft-server-readback.mjs` Git blob `ae1ef153b7cec43163aa230ff37005439f4bc1ec`.
- QA 전용 미확정 ACK 보호 모듈 `scripts/qa-p0-ack-unknown-readback-gate.mjs` Git blob `8fac1181dbb51f4b1ee727437a754c109e1eb820`.
- 실행 workflow `.github/workflows/wrong-p0-ack-unknown-changed-draft-20261121.yml` 최신 blob `e448ccf13f34f2082902f0f971031b4aa4e67300`.
- **신규 CI** [44897190744](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44897190744) / job `136825261159` / attempt 1 / **SUCCESS**. [원시 artifact #14704152450](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44897190744/artifacts/14704152450).
- ZIP 901 bytes / **SHA256 `acc2052013167d352998bdbb028e6e8aa1fd65abd4e232043b7e2dd48b46a120`**(GitHub digest·독자 다운로드 계산 일치) / ZIP CRC PASS / 내부 `result.json` 1개 JSON 파싱·원본 확인.
- 처음 실행한 CI [44897151108](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44897151108) 은 checkout shallow로 `dev` 원본 SHA가 없어 테스트 단계 **미실행**; checkout fetch-depth:0만 보정하고 신규 시험 1회 실행. 이 **초기 하네스 FAIL**은 기능 실패도 PASS도 아니다.

## 3. 원시 JSON 및 독자 확인된 신규 경계 결과

| 검사 | 원시값 | 한정 판정 |
|---|---|---|
| 합성 localhost HTTP 첫 PUT | `snapshotPUT=1`, 서버 revision=1 | 서버에 기록됨 |
| 응답 손실 시점 | 서버 내부 commit 후 응답 송신 전 의도적 연결 절단 | 클라이언트 `ACK_UNKNOWN` |
| 학부모 초안 변경 후 재저장 | `newSaveCallbacks=0`, 추가 PUT0, 기존 `requestId`·`recordId` 보존 | **새 경계 PASS (격리 전용)** |
| 저장 재조회 | `snapshotGET=2`, 원장 revision1, ETag `"1"`, recordId 동일 | 별도 GET 일치 |
| 중복 원장 | `serverRecordCount=1`, `duplicateCreates=0`, `extraRecords=0` | 중복0 |
| 내용 무결성 | original text 유지, photo SHA `7062e22cf764a94266a8cdb18c37a676bb917ec532bbc2ce5c3462889fd20006`, 부모 관찰 원문 보존 | 합성 데이터 불변 |
| 학부모 변경 초안 | `changedDraftPreserved=true`, 서버 원본은 기존 문구 | 미확정 수정본이 원장을 덮지 않음 |
| 거짓 ACK 대응 | 동일 revision이지만 snapshot 내용이 다른 *가상 대조 응답*은 `UNVERIFIED` | 성공 오판 방지의 순수 함수 증거 |
| 테스트·보안 선언 | `oldQa34Rerun=false`, `oldW03Rerun=false`, `productAppIntegrated=false`, `realFamilyAuthTested=false`, `realOperationalServerTested=false`, `safeToRestore=false` | 실제품/운영 PASS 불가 |

## 4. 06에 요청하는 **신규 차분만** 독립검증

1. ZIP #14704152450을 직접 다운로드, 901B·SHA256 `acc205…`·CRC·`result.json`의 원본 5개 checks / PUT1 GET2·newSaveCallbacks0·revision1·recordCount1 확인.
2. 소스 blob 세 개와 CI 고정 HEAD·GitHub compare: **제품 index·기존 QA34·기존 서버 qa-family-gateway 불변**, QA 보조모듈·신규 시험·workflow만 변경 확인.
3. 실제 HTTP `PUT` 후 `res.end` ACK hook을 보류하는 지점, socket disconnect, client UNKNOWN, **변경된 초안 재저장 차단 → GET → 정확 서명 snapshot 비교**의 실행 순서 확인. 사후 가짜 응답으로 테스트한 부분은 실제 HTTP GET과 구분.
4. 부정 주장 금지: 이 실험은 **운영 서버 저장/조회도, 현 제품의 ACK UI도, 실가족 인가도 검증하지 않음**. 독립 판정은 `SYNTHETIC_LOCAL_HTTP_NEW_DELTA_LIMITED_PASS` 또는 실패/보완 등 구분하여 00에 회신.
5. 별도 유지: `00T-02-AUTH-GATE` 실가족 401/403/세션·보호자 권한 **BLOCK**; `00T-02-VIS-FIX` 기존 native200 Playwright 즉시 PNG 두 장 단색 **FAIL**; PR80 Draft, `safeToRestore:false`, 7·8단계 HARD HOLD.

**변경범위:** QA에서 새 script/test/workflow 3개 + 이 인계문서만. 제품 dev/main/PR/운영 DB·실자료/배포/광고/유료API/예약 변경0. 성공 CI·이전 QA34 반복0. GitHub 인계 등록은 06 채팅방의 실제 새 모델 수신/응답 증거가 아님.
