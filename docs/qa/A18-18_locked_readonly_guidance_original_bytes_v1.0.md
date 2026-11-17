# 02 WRONG A18-18 — 안전 잠금 시 원본 보관·재풀이 보류의 실제 학부모 동선 v1.0

**수행:** 2026-11-17 KST · **범위:** QA 격리 가상 자료만 · **00 최신 지시:** [#82 #6949026659](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6949026659), [#87 실행 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87). 직전 [A18-17 #6949008332](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6949008332)는 정상 상태 가상 사진/오답→재풀이→부모 이력 보존을 Chromium 320/390에서 증명했으므로 **이번 신규 검증에서 재실행하지 않음**. [06 독립 의견 #6949064812](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6949064812): 직전 A18-16a의 경고는 QA 함수 직접 호출이며 실제 버튼 클릭·스크린리더 낭독은 아직 검증되지 않았음. 본 과제는 총괄 지시 범위에 맞춰 **삭제 버튼 클릭 금지**, 원본 **안내 이동 버튼만** 실제 클릭.

## 원인·선택
기존 격리 앱 `#v08-no-storage`에는 "원본 백업·검사 필요"라는 문장이 있으나, 실제 **어디로 가야 할지** 연결되지 않았다. 안전 잠금에서 일반 재풀이 `#v230-save`는 실패 메시지만 표시하며, 부모는 기존 오답·사진을 어떤 **읽기 전용 보관 기능**으로 확인할지 알기 어렵다. 이미 앱 내 `#v220-rescue-panel` 및 `#v221-rescue-current`가 있으므로 새 복원·삭제·자동 다운로드를 개발하지 않고 **기존 패널 안내로 이동·제목 초점만 부여**하는 국소 개선을 선택.

**QA 브랜치:** `qa/wrong-a18-18-locked-original-guidance-20261117-2230`, 기준 커밋 `4b4c5ec3539c169948015931b63d4e51350ed9e9`. 기준 QA 앱 Git blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35`, 새 QA 앱 blob `7047f4643f7ebae5677fc9b9e2799659c4cbf578`.

**코드 차분 4개만:**
1. 잠금 시 등록 화면 `#v08-no-storage`에 "새 오답·재풀이 저장 보류, 기존 기록·사진 자동 변경 없음, 원본 보관은 읽기 전용 시도이며 완료·복구 보장 아님" + 안내 버튼 추가.
2. 잠금 후 열 수 있는 기존 가상 오답 일반 재풀이 `#v230-general`에도 같은 안내와 버튼을 배치. 저장 불가 기존 fail-closed 로직은 유지.
3. 버튼은 기존 `#v220-rescue-panel` 스크롤 및 `#v220-rescue-title` 초점 **이동만** 실행. `#v221-rescue-current` 자동 클릭·다운로드·IndexedDB 읽기/쓰기 실행0.
4. 기존 보관 패널 상단의 "예전 기록 이전 실패만 해당" 오해 가능 표현을 "오답·사진·설정 안전 점검 실패 또는 구형 기록 이전 중단"으로 정확화하고, 복원/원본 보관 성공을 약속하지 않게 수정.

**변경 파일:** `index.html`, `qa/a18_18_locked_evidence_navigation.py`, `tests/wrong-a18-18-locked-readonly-evidence.mjs`, `.github/workflows/wrong-a18-18-locked-evidence.yml`, 본 보고서. 전·역패치는 기준 실제 앱 `index.html`의 4개 앵커를 바꾸는 생성기로 구현. 실패/중복 적용 거부 및 `apply(original)==candidate` / `reverse(candidate)==original` **전체 원문 바이트 검증**.

## 검증 실패→원인 분리→성공
- 첫 [CI #44092583774](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44092583774)에서 앱 패치/원복 PASS, 잠금 등록 안내→원본 보관 패널 이동·자동 내려받기 0건까지 확인. 이어 기존 오답 목록 버튼 검사에서 실패. 데이터 손실인지 UI 선택자 오류인지 처음에는 미확인.
- 두 번째 [CI #44092992914](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44092992914) 진단에 **저장 차단**, **"전체 1건 중 1건 표시"**, 보이는 오답 목록 1개·사진/부모이력 내용이 실제 출력됨을 수집. 테스트 선택자 `[data-record=...].first()`가 더 앞의 **숨겨진 홈 화면 중복 버튼**을 선택해 `isVisible=false` 판정한 것이 원인. 제품/QA 앱의 기록이 보이지 않는 문제 **아님**.
- 테스트 선택 범위를 **`#records-list [data-record=...]`**로 한정. 앱 HTML 코드 다시 수정하지 않고 신규 검증 완료.

**최종 [CI #44093239614 — SUCCESS](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44093239614)**, job `134073603446`, [증거 artifact `14332701873`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44093239614/artifacts/14332701873) (320/390 화면별 등록·보관 패널·재풀이 화면 **PNG 6장 + JSON 1건**, 총 3,532,415바이트).

| 새로운 검증 경계 | 320px | 390px |
| --- | --- | --- |
| 앱이 실제 미확정 설정으로 `storageOk=false` · `저장 차단` 표시 | PASS | PASS |
| 합성 과학 오답 1건·사진 Blob 68바이트·과거 재풀이 1건·부모 관찰 1건·pending 1건 시드 | PASS | PASS |
| 오답 등록 화면의 저장 보류·원본 보관 안내 + 버튼 표시 | PASS | PASS |
| 안내 버튼을 실제 클릭 → 보관 패널 노출·제목 키보드 초점 | PASS | PASS |
| 별도 실제 오답 목록 내부에서 기존 가상 기록 열기 및 재풀이 저장 시도 fail-closed | PASS | PASS |
| 재풀이 화면 안내 이동 버튼 클릭, 자동 원본 다운로드 없음 | PASS | PASS |
| **파괴적 `readwrite` 0건, 전체 3-store 스냅샷 불변** | PASS | PASS |
| 앱 새로고침 후 오답·Blob 바이트·부모 이력·pending 불변 | PASS | PASS |
| 앱 소스 Git blob 변화 없음, 전·역패치 원본 전체 바이트 | PASS | PASS |

로그: `A1818_FULL_REAL_APP_FORWARD_REVERSE_SOURCE_BYTES_PASS`, `A1818_RESULT=PASS_LOCKED_READ_ONLY_GUIDANCE_FULL_IDB_UNCHANGED`, 외부 요청0/JS 오류0/자동 다운로드0.

## 평가·미검증
| 평가(10점) | 점수 | 근거 |
| --- | ---: | --- |
| 총괄 지시 적합도 | 9 | 잠금 시 원본 보관·재풀이 보류 실제 UI, 격리·금지 범위 준수 |
| 근거 신뢰도 | 8 | 실제 앱 IndexedDB 3스토어 원본 대조·실 Chromium·PNG/JSON·CI 원문, 실기기/스크린리더 N/T |
| 격리 재현가능성 | 9 | 320/390 각 1 독립 문맥, 재현 가능한 fixture/소스 역패치 |
| **평균** | **8.7** | **운영 안전성·실부모 사용성 점수가 아님** |

**한계와 금지:** 안내 버튼이 기존 read-only 기능으로 이동한 것만 시험. `#v221-rescue-current`의 **실제 파일 생성·다운로드/내용 무결성·복원 가능성**은 이번 시험에서 실행하지 않아 **N/T**; UI 문구도 보관 성공을 약속하지 않는다. 단조 revision/CAS·실가족 자료·실카메라·실사용자 3분 측정·실스크린리더 낭독·실 Safari·제품 병합/배포·실복원은 N/T. 본 CI PASS는 격리 앱만의 부분 검증이고 **06 독립 승인이 아님**.

**다음 최소 후보:** 00/06이 이 신규 안내/CI/역패치를 독립검증한 뒤, 저장소 손상 유형별 **보관 UI의 읽기 전용 실패 안내**를 검증해 원본 보존·평문 개인정보 고지를 개선. 운영 데이터 복구/삭제/복원은 별도 승인 필요.

**완료:** 잠금 UI 안내 코드·신규 CI·PNG6/JSON·원복, 00 인계. **다음:** 06 독립 의견, 안전 읽기 전용 원본보관 결과 검증. **필요:** 사용자 직접 조치 없음. 제품 `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, PR80 Draft·`safeToRestore:false`·실자료/배포/광고/예약 불변.
