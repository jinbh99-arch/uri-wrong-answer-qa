# WRONG A-03-3 — 신규 오답 등록·두 탭·이중 제출 QA 수용 및 원복 인계
> 2026-11-16 · 02 WRONG / A 합성 로컬·격리 검증 · **dev 병합/운영 승인 아님**

## 기준과 확인 대상
- 기준 dev: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`; dev `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`.
- 격리 후보: `qa/wrong-a03-new-entry-ack-gap-20261116-1036`. A-03-2 최초 등록 ACK 재읽기 실패→새 ID·사진 2건 중복을 원본 [43798152467](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43798152467)에서 재현하고, 후보 첫 가드 [43798946685](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43798946685) 5/5 PASS. **이 과거 검사는 이번에 재실행하지 않음.**
- A-03-3 신규 [실제 앱 2탭 검사](../../tests/wrong-a03-3-multitab-new-create-and-double-submit.mjs) 및 [Actions #43803729178](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43803729178) **7/7 PASS**, [PNG 5장 + JSON 아티팩트](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43803729178). Chromium 320/390 합성 화면. 실제 OCR/가족 인증/물리적 폰·서버 ACK 아님.

## 새로 확인한 차이, 원인, 해결
1. **안전:** 빈 DB에서 A/B 두 탭이 각각 신규 오답 폼을 연 뒤 A는 쓰기 커밋·재읽기 실패, B는 독립 저장. 두 ID/사진 2건이 각각 남고 덮어쓰기 0. A의 미확정 폼 재제출은 차단. 이후 빠른 `requestSubmit()` 2회는 신규 C 한 건만 만들어 **총 3건**, 기존 두 사진의 ID·바이트·부모 메모·시각 불변. 아이 DOM에 두 부모 메모 없음.
2. **새 UX 경계:** A의 첫 미확정 등록을 마치고 B가 그 뒤 저장하면 A의 과거 메모리 목록은 1건인데 실제 IndexedDB는 2건일 수 있음. 처음 검사에서는 목록의 즉시 최신성을 가정해 실패했으며, 일부 실행에서 기존 BroadcastChannel '다른 탭 최신 기록' 버튼이 숨겨져 있음을 확인. **저장 데이터 손실과 목록 최신성은 구별**함.
3. **QA 국소 보완:** `index.html`의 `navigate('records')`에 **`wrongA03UnknownCreateId`가 존재하는 경우에만** 읽기 전용 `restoreState()` 후 `renderRecords()`를 한 번 더 실행. 재조회 중에는 '최신 오답 목록 확인 중', 실패 시 '브라우저 새로고침 후 확인' 안내. **새 쓰기·삭제·ID 재생성·자동 재전송·기존 편집 폼 강제 초기화 없음**. 기존 다른 화면 탐색 경로는 변경하지 않음.
4. **고정 검증:** 수정 뒤 A 목록에서 두 건이 브라우저 전체 새로고침 없이 나타남. 로그상 `visibleCount=2, actualStored=2, withoutBrowserReload=true, withoutExtraWrite=true`; 위 7개 시나리오 PASS. JS 오류/외부 네트워크/320·390 가로넘침 0. 시험에 쓰인 1px 사진은 합성이고 OCR 모델/네트워크 호출 없음.

## 영향과 미검증
- 제품 dev/main 및 PR80 변경 0. 시험 브랜치에서만 UI 상태 가드와 목록 진입 직후 **읽기**를 추가. 3개 IDB 저장소 스키마/백업 포맷·가족/계정·광고/운영/API 변경 없음.
- **같은 내용**을 서로 다른 탭에서 각각 의도적으로 새로 등록하는 경우는 서로 다른 등록 요청이므로 이 검사로 내용 기반 중복 제거/전역 idempotency를 입증하지 않음. 매우 늦은 제3탭 변경, BroadcastChannel 미지원 브라우저, 프로필 읽기 실패/재진입 복구, 실 WebKit/기기 지속성은 미검증.
- 새로 읽기 실패하면 이전 화면 숫자를 정답으로 단정하지 않고 사용자에게 새로고침 안내; 별도 안정화와 접근성 QA 필요.
- 기존 QA78/84/85/92·A-01/02 및 A-03-2 CI **재실행하지 않음**. 신규 A-03-3 초기 실패 실행은 테스트의 즉시 최신성/경고 버튼 가정과 실제 레이스 차이를 좁히는 과정의 기록이며, 최종 7/7 PASS와 구분.

## 수용·원복 결론 (00/Jin 결정 필요)
- **A 내부 QA 수용 후보:** '커밋 후 새 오답 저장 확인 불명에서 같은 폼 중복 차단' + '해당 상태에서 목록 진입 시 최신 원장 다시 읽기'. 원본 보존·아이 DOM 분리 증거 있음.
- **dev 병합/운영 출시는 미승인**. 병합 결정 전 00은 QA HEAD/비교 차이·미검증을 수용, 06은 **실제 새 dev diff가 생길 때만** 독립 검증, 08은 B~D 승인 게이트에서 가족 인증·실사진·백업/삭제·WebKit을 평가.
- **빠른 원복:** 현재는 `dev`를 전혀 변경하지 않았으므로 운영 원복 **불필요**. 후보 자체를 되돌리려면 QA 브랜치에서 `index.html`의 A-03 가드 및 목록 재조회 변경만 지정 커밋으로 revert하고 dev 기준의 기존 파일을 보존한다. DB 마이그레이션/기존 기록 재작성은 없음. 나중에 승인 후 병합한 경우는 병합 SHA의 해당 UI 변경을 별도 revert하고 테스트/원장 보존 증거를 재확인해야 함.
