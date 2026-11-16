# 02 WRONG A-03-15 — 유효 백업 실복원 완료 및 손상 장부 원본 보관 v1.0

**작업일:** 2026-11-16 KST | **검증:** A 격리 합성 Chromium 2/2 PASS | **제품 반영:** 미승인, `safeToRestore:false` 유지.

## 1. 선행 원인·정확한 검증 경계

- A-03-11: 커밋 후 읽기 확인 실패의 `pending ID`가 메모리에만 있어서 새로고침·탭 교체 시 동일 의도를 중복 생성하던 반례 3개 BLOCK.
- A-03-12: 기존 `settings`에 등록 ID/시각/버전만 원장·사진과 같은 IDB 트랜잭션으로 기록, 원장 ID 확인 전에는 신규 생성 중단. 최종 앱 blob `ec1e45430445beb82fe23e4c98ee76eac402c3a9`.
- A-03-13: 최종 blob 다중 탭 경쟁·원자적 중단 [CI #43873361597](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43873361597)에서 실증 PASS. A-03-14: 미확정 장부 상태의 일반 백업·복원 차단과 손상 장부 저장 차단 [CI #43875894580](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43875894580), [#43876145725](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43876145725) PASS.
- **이번에만 신규로 시험한 것:** (A) 미확정 장부가 *없는* 정상 상태에서, 실제로 내려받은 앱 백업을 **기기 원장 교체 및 독립 검증까지 완료**하는 경계 (B) 원장 ID가 없는 손상 장부로 앱 쓰기가 차단된 상태에서 **실제 원본 보관용 JSON 내려받기** 경계. 이미 PASS된 다중탭·재시작/백업 차단 시나리오는 반복하지 않음.

## 2. 코드/환경 분리

- 제품 `dev` SHA40: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (미변경). PR #80 `Draft`, 미병합, `safeToRestore:false`.
- A-03-14 보고 기준 SHA `a4457b6dd17f541401ca1e250b901d1d7f0f0507`에서 분리한 QA 브랜치 `qa/wrong-a03-15-restoration-rescue-20261116-2240`.
- **앱 `index.html` 수정 0**, 기준 Git blob `ec1e45430445beb82fe23e4c98ee76eac402c3a9` 정확히 고정. 추가 파일은 `tests/wrong-a03-15-restore-rescue-chromium.mjs`, `.github/workflows/wrong-a03-15-restore-rescue.yml`, 본 문서.
- 임시 Basic Auth 게이트 localhost, 가상 3학년 과학 오답·가상 보호자 관찰 메모·합성 1px PNG만 사용. 아동/가족 실계정·사진·운영 IndexedDB/서버는 접근하지 않음.

## 3. 실제 브라우저 데이터 복원 성공 경계

1. 첫 가상 오답 1건과 사진 1장 생성 → 상세화면에서 학부모 `checkHistory` 1건 실제 저장, 원장·사진 바이트 수집.
2. 앱의 **비암호화 백업 위험 확인창**에서 보호자 확인 클릭 → 브라우저가 내려받은 JSON 파일을 직접 읽어 `uriaimath-offline-backup-v02`, 기록1·사진1, SHA-256 무결성 및 복원 호환 사전검사 성공 확인.
3. 별도의 두 번째 가상 문제·사진을 생성하여 원장을 2건·사진 2장으로 변경(등록 ID 서로 다름).
4. 이전 **실제 백업 JSON**을 앱 복원 파일 입력에 주입 → `v18` 원본 검사/격리 DB dry-run 및 복원 확인 대화상자 표시 → 해당 합성 세션에서 복원 확인을 명시적으로 클릭.
5. 복원 트랜잭션 이후 앱 자체 재읽기 알림 확인. IndexedDB 직접 재조회 결과 **기록1·사진1**, 원래 기록 ID·과목·문장·메모·학부모 확인 이력 및 사진 바이트 전부 보존; 원본 백업에 없던 두 번째 오답 ID/사진은 제거, 새 `pending` 장부는 없음.
6. 앱 새로고침 후 `storage-state` 정상 연결 및 **전체 원장·사진·settings 상태가 직전 복원 결과와 완전 일치**함을 검사.

**결론:** 정상 장부 상태의 합성 IndexedDB와 실UI 복원 동작은 PASS. 외부 실제 가족·핸드폰·용량한도·서버 승인까지 PASS라는 의미 아님.

## 4. 존재하지 않는 ID의 손상 장부에서 원본 보관

1. 별도의 가상 브라우저 DB에 오답1·사진1·관찰 이력1 저장하고, `settings['wrongA012PendingCreateV1']`에 **존재하지 않는 ID**를 넣어 손상 장부 상태를 재현.
2. 새로고침 후 `storage-state`가 저장 차단임을 확인. 기존 UI의 `v220-rescue-panel` 원본 보관 기능은 계속 접근할 수 있음.
3. `현재 저장소 전체 원본 보관하기` UI 버튼을 실제 클릭 → **브라우저 다운로드 이벤트**에서 원본 JSON 파일을 열어 `uriaimath-current-raw-evidence-v01`, `restorableByApp:false`, 기록1·사진1·settings 전체 키/값 포함 확인.
4. JSON의 사진 `dataUrl`에서 Base64 디코딩한 바이트 배열과 IndexedDB 원본 사진 바이트를 전수 비교, SHA256 동일. 기존 오답의 학부모 `checkHistory`와 손상된 pending ID/타임스탬프/버전 값도 **누락 없이 보존** 확인.
5. 원본 보관 기능 실행 전후 원장·사진·settings 전부 `deepEqual` 동일. 재접속 이후에도 저장은 보수적으로 차단되며, 손상 장부를 자동 삭제하거나 정상이라고 표시하지 않음.

**한계:** 이 파일은 **원본 증거 보관용**이고 앱의 자동 복원 형식이 아니다. 저장 데이터에 민감한 실제 학습내용/사진이 있을 경우 파일은 평문이며 노출 위험이 있어 별도 안전 보관이 필수. **손상된 장부를 실제로 수리하는 기능은 여전히 미검증/미구현.**

## 5. 검증 실물·실제 결론

- **신규 CI:** [GitHub Actions #43878210199](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43878210199), Chromium `normalRestore` **PASS**, `corruptRawRescue` **PASS**.
- **증거:** [artifact 14229763700](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43878210199/artifacts/14229763700) `result.json` 및 320/390px PNG **7장**, 외부 네트워크 요청0, JS 페이지 오류0, 시험 전후 앱 SHA-1 Git blob 동일. `index.html`의 백업/복원/원본보관 코드를 수정하지 않고 **테스트/워크플로/문서만** 추가.
- 실행 가능한 종합 판정: 합성 환경 **A-03-15 신규 2/2 PASS**, A-03-12/13/14 선행 범위는 유지. QA를 병합 또는 배포해도 된다는 결정은 **아님**.

## 6. 남은 승인 전 위험·후속 작업

- 미확정 장부에 실제 원장 ID가 존재하지 않는 경우 현재는 사용자 보호를 위해 저장/일반 백업·복원을 막는다. 이번 검증은 원본 보관만 성공하였으며 **장부 복구/해제 절차를 구현하지 않음**. 복구 전 데이터 삭제·수정·재저장 금지.
- 실제 OCR/이미지 대용량·저장소 quota/eviction, 브라우저 강제 종료 시점, iOS Safari/Android, 가족 권한과 로그인, 서버 ACK·네트워크 단절, 실가족 데이터, 백업 파일의 외부 안전 보관/실제 운영 복구는 **미검증**.
- 총괄 00에서 다음 신규 A 범위를 결정할 경우 **원본 보관 후 수동 확인·수리 후보**와 **실제 제품 병합 필요조건·원복 계약** 우선. 본 보고서만으로 B/C/D 단계 승인·`safeToRestore:true` 판정 금지.
- 제품 `dev`, PR80, 운영 DB, 실계정·가족, 광고/통계/호스트/배포/예약 변경0.
