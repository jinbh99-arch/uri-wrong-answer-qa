# 02 WRONG A18-13 — 실제 IndexedDB 교체 직전 공통 fail-closed 게이트 · 직접 호출 검증 v1.0

**수행일:** 2026-11-17 (KST) · **승인된 구역:** 합성 A격리 QA만 · **담당:** 02 WRONG 신규방 · **총괄 지시:** [#82 댓글 6940195917](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6940195917) · [#87 현재 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87).

기준: 실제 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변. 직전 A18-12 [정적 위험](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6939679694)은 A18-11의 복원 UI 차단 후에도 이전 `v07ImportBase`·`v18OriginalRestore` 함수 참조를 통한 **내부 진입**이 안전성 검증 범위 밖임을 지적했다. 이 정적 위험을 실제 공격 성공으로 오인하지 않는다.

## 1. 원인 분석과 선택
- `v07ImportBase` (QA app 2141행)→ 초기 `import-file` 복원 핸들러, `v18OriginalRestore` (2722행)→ v07 래퍼 경유. 버튼·파일 input 차단은 **실제 내부 복원 함수의 전역 정책 게이트가 아님**.
- 데이터 교체 함수의 마지막 공통 쓰기 경계: `v23RestoreWithPhotoCheck` (사진 바이트 재확인, 1729~1735행) → `v22RestoreOnlyIfUnchanged` (1661~1684행) → `targetDb.transaction(['mistakes','photos','settings'],'readwrite')` (1666행) → `clear/put` (1674~1676행).
- `v213ClearOnlyIfUnchanged` (1572~1576행)도 `v23`→`v22`에 합류한다. 따라서 **복원만 일괄 차단하려는 변경은 전체 삭제 기능에도 영향**이 있다. 기존 데이터를 지키는 방향으로 이번 QA에서는 둘 다 차단하고, 향후 제품 통합 시 UI 문구·요건을 별도로 검토할 사항이다.
- DOM 이벤트만 다시 막는 대안은 **기각**. 기존 사진 검증 이후의 함수 안에서, **데이터 교체 트랜잭션을 열기 전** 동기적으로 거부하는 공통 게이트를 선택.

## 2. 실제 QA 코드 수정
**QA 브랜치:** `qa/wrong-a18-13-atomic-write-guard-20261117-1511`, 기준 A18-12 HEAD `ae53ab4d33370f38beb7e94f0869fc96b4f64dab`.

| 변경 파일 | 실물 변경 | 범위 |
| --- | --- | --- |
| `index.html` | 주 DB 이름 `DB`과 동일한 `IDBDatabase.name`을 사용하는 복원/전체삭제의 최종 `v22RestoreOnlyIfUnchanged` 진입에서 `A1813_SAFE_TO_RESTORE=false`일 때 `Promise.reject({code:'A1813_RESTORE_DISABLED'})`를 **readwrite 트랜잭션 생성 전** 반환. 다른 객체라도 **동일한 저장소 이름을 가리키는 재연결 핸들**이면 거부. | A격리 수정, 앱 Git blob `4734102b111b20b2185f9fe175ac0802eaebf5e5` |
| `index.html` | 동일 IIFE 안에서 최종 함수 자체를 호출하는 합성 QA-only `window.__wrongA1813Probe` 추가. `directAtomic/directPhoto/directClear` 세 가지 실제 함수 경로를 테스트, 선택적으로 같은 주 DB 이름에 대한 별도 핸들을 개방. **일반 사용자용 API가 아니며 제품 이식 시 제거해야 함**. | 합성 실증 코드, 원문과 역패치로 완전 분리 가능 |
| `qa/a18_13_core_restore_gate.py` | 정확한 원본 앵커 2곳 기준 적용·역적용 생성기, 중복·예상 외 원문이면 FAIL | 격리 QA만 |
| `qa/test_a18_13_core_restore_gate.py` | 단위테스트 9건 | 격리 QA만 |
| `tests/wrong-a18-13-core-direct-call-chromium.mjs` | 실제 합성 주 IndexedDB 오답·사진 Blob·학부모 확인·손상 pending 장부에 대해 내부 코어 직접 호출, 320/390 12경계+원본 보존 증거 | 격리 QA만 |
| `.github/workflows/wrong-a18-13-core-atomic-restore-guard.yml` | ubuntu24.04/Playwright1.56.1 신규 테스트·PNG/JSON 보존 | QA 전용 |

본 패치는 **해당 앱의 파괴적 복원 경로**에만 적용한다. 별도 합성 실험 DB는 주 DB가 아니므로 게이트 판정 대상 아님. 직접 IndexedDB API 접근, 확장프로그램, 외부 코드에 의한 무단 쓰기를 **보안적으로 방지한다는 증거는 없음**. 단조 revision/CAS가 구현된 상태가 아니다.

## 3. 신규 CI 실제 결과와 실패-수정 환류
- **1차 [CI #44029564908](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44029564908) FAIL:** Python **9/9 PASS**, 실제 앱 패치/역패치 **바이트 전체 일치 PASS**, Chromium 320px 6/6 차단·원본 보존 PASS. 단, 390px에서 테스트가 자체 삽입한 `#a18-13-direct-result`가 **중복**되어 `locator.isVisible` strict-mode 오류 발생. **실제 저장 함수 미차단/데이터 변조의 증거가 아닌 시험 코드의 중복 ID 결함**.
- **수정:** 브라우저 테스트 코드에서 새 결과 노드를 삽입하기 전 이전 ID 노드를 1개 삭제. **QA 앱 본문이나 게이트 코드는 수정하지 않음**.
- **최종 [CI #44029740277](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44029740277) SUCCESS**, job `133858517334`:
  - **Python 9/9 PASS**.
  - `A1813_REAL_APP_FORWARD_REVERSE_BYTES_EXACT_PASS`: 앱 patch(base) 전체 일치, `unpatch(patched) === base` 문자/바이트 전체 동일.
  - Chromium **320px 6/6, 390px 6/6**, 총 12회: `directAtomic/directPhoto/directClear` × 주 DB 기존 핸들/동일 DB 이름의 독립 재연결 × 두 폭. 모두 실제 `A1813_RESTORE_DISABLED`를 반환.
  - 내부 파괴적 `readwrite` 진입 **0건**, 테스트용 합성 오답·사진 **전 바이트**·학부모 확인 1건·손상 `pending` 장부 보존, 새로고침 뒤도 동일. 합성 자료만 사용.
  - PNG **2장**, JSON 1건, 외부 요청 **0건**, 브라우저 pageerror **0건**, 앱 파일 바이트 변동 **0**.
  - [CI 아티팩트 `14304403539`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44029740277/artifacts/14304403539): `wrong-a18-13-internal-restore-atomic-guard-320-390`.

## 4. 적합도·신뢰도·실행가능성 평가
| 항목(10점) | 점수 | 직접 근거·한계 |
| --- | ---: | --- |
| A격리 지시 적합도 | 9 | 코드/CI/사진·이력·pending/역패치 완료, 기존 A18-11 UI PASS 중복 재시험 없음 |
| 검증 신뢰도 | 8 | GitHub Actions 실 Chromium 로그·PNG2·JSON, Python9/9·실앱 blob/역패치. 실제 기기·사람 데이터 미시험 |
| 격리 실행가능성 | 9 | 재현 경로 고정, 주 DB 즉시 fail-closed, 독립 연결까지 검증 |
| **평균** | **8.7** | **제품 통합/실복원 안전성의 점수가 아니라 QA 증분 평가** |

## 5. 미검증·차단 및 다음 작업 추천
**A격리 PASS ≠ 안전 복원/운영 보증.** 기존 백업 복원/전체 삭제를 주 DB 대상으로 차단함. `safeToRestore:false` 고정. `v07ImportBase`·`v18OriginalRestore` 함수 참조의 **직접 호출 자체**는 이번 CI에서 별도로 가상 백업 인자를 넣어 실행하지 않았고, 대신 가장 하위의 실제 파괴적 공통 함수를 직접 호출해 **중앙 쓰기 차단**을 증명했다. "기존 래퍼 각각 완전 검증" 주장 금지.
- **다음 후보 1(우선):** CI가 이번 **새 격리 패치의 사용자 UX 부작용(전체 삭제 요청도 차단됨)**을 별도 확인·표시하도록 만들고, `safeToRestore:false`와 저장소 실패 메시지의 사용자 이해도를 320/390에서 국소 확인. 기존 PASS 반복 없이 신규 차이만 검증.
- **다음 후보 2(00 승인/계약 선행):** 제품 이식 전에 시험 전용 `window.__wrongA1813Probe`를 제거한 **정확한 코드 패치**를 독립 06방에서 검증; 전역 revision/CAS, 실제 복구 정책/사용자 동의/실기기 동작을 별도 설계·승인. 지금 PR80 Draft/제품 dev 미병합 유지.
- **미검증:** 복원 성공 자체, 실제 파일 데이터 검증·프로덕션 설정·다른 탭의 ABA 완전 방지, 브라우저 확장/새 코드의 직접 IDB 쓰기, 실부모/실사진, 실제 스마트폰 Safari, 원자 버전 관리 및 서버 ACK.
- **이번 회차 불변:** 제품 `dev`, PR80 Draft, `safeToRestore:false`, 계정·가족 DB·광고·공개·배포·예약 일체.

## 6. 완료/다음/필요
- **완료:** 실제 QA 코드 국소 변경, Python 9/9, Chromium 12 직접 호출 fail-closed, 원본 전체 바이트 역패치, CI PNG/JSON 제출.
- **다음:** 00/06 독립 QA에서 새 앱 게이트와 전체 삭제 UX 영향을 수령·평가 후 다음 실행 커서 지정.
- **필요:** 제품 병합·실데이터 시험·실복원은 별도 승인 전 불가. 사용자 직접 조치 없음.
