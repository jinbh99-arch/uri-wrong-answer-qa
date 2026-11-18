# 02 WRONG W3 — 아이 화면 전환 시 이전 부모 알림 잔류 · RED→GREEN 격리 QA 인계 v1.0

**2026-11-18 KST / 02 담당 · RED→GREEN 시험 시행, 신규 2차 CI 결과 확인 전.** 00 총괄 최신 [P0 우선순위 #6971077626](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6971077626)에 따라 01 AdSense 보안/06 판단이 최우선이며, 이번 검증은 **02 후행 P1**, 06의 기존 판정을 재수행하지 않는다.

## 1. 관측과 원인(실제 제품 dev 소스)

- 관측: [기존 W3 390px 원시 QA·아이 화면 증거 #6971081776](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6971081776). 합성 지연 OCR가 오답 B 및 아이 DOM에 섞이지 않은 **5/5 자체 PASS**였지만, 아이 모드 화면에 이전의 **일반 사진 선택 알림**이 보였다.
- 원본: [`index.html` dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b/index.html), Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`. `notify(t)`는 고정 `#toast[role=status]`에 문자열을 쓴 뒤 `.hide`를 제거하고 `toastTimer` **3,400ms** 만료 뒤에만 숨긴다.
- 사진 선택 경로 `loadImage()`는 `notify('사진이 선택됐습니다. 바로 저장하거나 문제 부분을 드래그해 지정하세요.')`를 호출한다. `v218ApplyMode('child')`에서는 화면별 메모·관찰 DOM의 소거는 하지만 **전환 이전의 `#toast` 문구·타이머는 소거하지 않는다**. 그러므로 사진 선택 직후에 아이 전환이 허용되면 이전 안내가 일시적으로 잔류할 수 있다.
- **중요한 예외**: `v218ApplyMode`의 초반에는 저장 전 오답/관찰메모/부모 질문의 **전환 차단 가드**가 있다. 이때 `notify('입력 중인 오답...')` 등의 **차단 이유는 부모에게 계속 보여야** 한다. 무조건 모든 알림을 없애면 사용자의 이해를 방해한다.
- 정보경계: 이번 관찰의 토스트에는 파일명·부모 메모·자녀의 이름이 없다. 따라서 **아이에게 실제 개인정보가 유출되었다고 단정할 근거 없음**. 다만 아이 모드에 부모 전환 직전 문구가 남는 UX·향후 알림 문구의 비밀유지 위험은 실물 관측됨. 부모/아이 UI 모드 토글은 **인증·접근제어가 아니다**.

## 2. 최소 해결안 비교

| 선택안 | 보존성 | 위험/판단 |
|---|---|---|
| CSS `body.v218-child #toast{display:none}` 일괄 숨김 | 코드 변화 작음 | **부적합**: 아이 모드에서도 필요한 새 알림 전체를 가리고, 이전 토스트 텍스트가 DOM에 남는다. |
| **B. child 모드가 실제 확정된 뒤** 기존 타이머 취소 + `toast.textContent=''` + `.hide` | 기존 `notify()`/메모 가드/저장 로직 불변; DOM 텍스트도 정리 | **채택하여 QA 격리 검증**. 전환 차단 가드는 이 단계보다 먼저 return하므로 차단 경고가 남는다. |
| 전역 `notify(message,{audience})` 수명·권한화 | 장기적 확장 | 영향 범위 크고 별도 원칙 검토 필요; P0와 무관한 제품 전역 재설계 금지. |

## 3. 정확한 격리 변경·검증계약

- 고정 dev SHA `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`에서 새 브랜치 `qa/wrong-w3-child-toast-mode-boundary-20261118` 생성. [가역 패치 `qa/w3_child_toast_mode_patch.py`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-child-toast-mode-boundary-20261118/qa/w3_child_toast_mode_patch.py)는 **실행 중 QA 복사본 `index.html`만 임시 변경·즉시 역패치**. 제품 dev/main·PR80 Draft·`safeToRestore:false` 불변.
- [신규 시험](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-child-toast-mode-boundary-20261118/tests/wrong-w3-child-toast-guard.mjs)은 **320/390px**에서 비개인 **1px 합성 사진을 실제 사진선택 버튼으로 선택→제외**하여 기존 앱 `notify()` 알림을 UI 경로로 발생시킨 뒤 실제 아이 모드 버튼 클릭. **RED(원본)**에서는 기존 알림의 표시·문구가 남는 상태를 '결함 재현 PASS'로 기록. **GREEN(QA 임시 패치)**에서는 아이 전환 뒤 알림의 화면 표시·DOM 문구가 모두 사라졌는지 확인.
- 동시에 `#problem`에 **가상 미저장 내용**을 작성하고 아이 전환을 시도: **전환 자체가 차단**되어 부모 모드 유지, ‘입력 중인 오답’ 경고가 시각적으로 유지되는지 **RED와 GREEN 모두 검사**. 이 사례를 수정 전 토스트 잔류와 혼동하지 않는다.
- 각 폭·각 모드에서 알림 전환·가드 차단 PNG를 2장씩, 원시 JSON에 DOM 상태·가로폭·원본 app blob·외부 요청/JS 오류를 기록. CI 한 번에 RED→가역 패치→GREEN→**원본 Git blob 정확 역복원**을 검사. **실제 UI 사진선택·제외 경로를 합성 사진으로 검증**하며, 실사용자 개인자료/실사진 OCR/동의·앱 종료는 이번 범위에 포함하지 않는다.

## 4. 완료 판정/한계(실제 CI 값은 별도 기입)

**대상:** [첫 CI 44253504233](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253504233)는 **시험 오용으로 FAIL**: 실제 앱의 로컬 `notify()`를 `page.evaluate`의 전역 함수로 잘못 간주해 `ReferenceError: notify is not defined`; 기능 FAIL 근거 아님. 시험은 실제 UI의 합성 사진선택→제외로 최소 수정했다. [2차 CI 44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980) 실행 SHA `47abbd18f6c41bbdb2ff3fce3e3c92607b0e8a71`, 결과 확인 전. 소스 3개 추가 파일만, 제품 `index.html` 변경 0.

- **원본 기대 RED**: 버튼으로 아이 전환됐는데 이전 부모 알림 문구가 남아 있음. 실제 출처는 W3 기존 사진 선택 경로, 신규 테스트는 전역 `notify()` 동일 경로를 **가상 문구**로 유도.
- **격리 패치 기대 GREEN**: 아이 전환 후 전역 알림이 화면·DOM에서 사라지고, 미저장 입력에 대한 전환 차단 알림은 그대로 표시.
- **검증 완료 기준:** CI job completed/success, 실행 SHA40, 실제 원시 PNG·JSON 각각 열기/SHA256 대조, 역패치 후 원본 blob `250aff5b0a...` 일치, 06 신규 범위 독립 검증. 성공해도 **일반 알림 표시 UX 개선일 뿐 가족 인증/실기기 개인정보 보호·운영 품질 승인 아님**.
- **P0 우선:** 08 AdSense B안 독립 보안 판정 및 06 LEVEL 검증이 먼저다. W3는 06 후행 차분으로 보관하며 다른 앱·공개·Google 계정 변경 금지.

**현재 상태:** 첫 시험 호출 오류 FAIL 인정→실 UI 조작으로 정정한 2차 CI 실행 요청 완료/결과 확인 전. 제품·배포·실자료·예약 변경 0. 검증 결과가 완료되면 이 문서의 증거 절을 실제 값으로 업데이트한 후 #82 한 번 보고한다.
