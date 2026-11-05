# 컴포넌트 규격 — 차계부(/car)

- 날짜: 2026-11-05 · 소유자: UI Designer · 상태: 초안(Product Owner 설계 검토 대기)
- 근거: [screens.md](screens.md)(구성·상태·폭별 차이), [flows.md](flows.md), [tokens.md](tokens.md)(모든 값의 이름)
- 목업: [mockups/car-ledger.html](mockups/car-ledger.html) — 이 문서의 모든 컴포넌트를 라이트/다크, 모바일/데스크톱으로 한 화면에서 확인한다.
- 이 문서는 모양·크기·상태만 정한다. 구성·순서·키보드·문구는 screens.md가 기준이고 여기서 바꾸지 않는다. 값은 전부 tokens.md의 이름으로 쓴다(숫자 직접 입력 금지).

## 1. 공통 규칙

### 1.1 상태 8종의 정의

모든 컴포넌트는 아래 8종 중 해당하는 것만 가진다. 해당 없는 칸은 "-"로 적었다.

| 상태 | 정의 | 공통 표현 |
|---|---|---|
| default | 평상시 | 각 컴포넌트 표 |
| hover | 마우스가 위에 있음(`@media (hover: hover)`에서만) | 면에 `--color-fill-hover`를 덮는다. 전환 `--dur-fast` |
| active | 누르는 중 | 면에 `--color-fill-pressed`를 덮고 채운 버튼은 `--press-scale`(0.96), 행은 `--press-scale-row`(0.98). 누를 때 `--dur-press-in`, 뗄 때 `--dur-press-out` |
| focus | 키보드 포커스(`:focus-visible`) | `outline: var(--line-medium) solid var(--color-focus)`, `outline-offset: var(--focus-offset)`. 가장자리에 붙어 잘리는 컴포넌트(하위 탭, 목록 행, 파일철 탭)는 안쪽 간격(`-2px`)을 쓴다. 마우스 클릭에는 나타나지 않는다 |
| disabled | 누를 수 없음 | 글자 `--color-secondary` + 불투명도 0.5, 면은 `--color-subtle`, `cursor: not-allowed`. 포커스 불가 |
| loading | 요청 진행 중 | 버튼은 글자 앞에 16px 회전 아이콘, 폭 유지, 누를 수 없음, `aria-busy`. 색은 평상시 그대로(흐리게 하지 않는다. 진행 중임이 보여야 하므로). 목록·영역은 9.1 뼈대 |
| error | 검사 실패·불러오기 실패 | 입력은 3장, 영역은 9.3 |
| empty | 보여 줄 데이터 없음 | 9.2 |

### 1.2 크기·간격 원칙

- 모든 버튼·행·입력 칸의 높이는 `--target-min`(44px) 이상. 높이는 `min-height`로 정하고 글자가 늘어나면 같이 커진다(`height` 고정 금지). 예외는 파일철 탭 하나뿐이다(4.1).
- 버튼·행 사이 간격은 8px(`--space-2`) 이상이라 터치 목표가 겹치지 않는다.
- 간격은 `--space-*`만 쓴다. 구획 사이 `--space-5`, 같은 구획 안 요소 사이 `--space-3`, 화면 좌우 `--space-4`.
- 긴 별칭·메모: 카드·대화상자에서는 줄바꿈(`overflow-wrap: anywhere`), 목록 행의 메모는 한 줄 말줄임.
- 아이콘은 `currentColor`로 칠한 SVG(`--icon-sm` 16, `--icon-md` 20)이고 화면낭독기에서 숨긴다(`aria-hidden`). 글자 없이 아이콘만 있는 버튼에는 `aria-label`이 필요하다.

### 1.3 테마 반응

모든 색·모서리·그림자는 토큰이라서 라이트/다크/ZIGZAG에 자동으로 따른다. ZIGZAG에서는 `--radius-*`가 0이 되므로 알약(배지)·원(아이콘 버튼)도 각진다. 의도된 동작이다.

## 2. 버튼

| 변형 | 면 | 글자 | 테두리 | 쓰는 곳 |
|---|---|---|---|---|
| primary | `--color-primary-fill` | `--color-on-primary` | 없음 | 로그인, 차량 추가(빈 상태), 기록 추가, 저장, 확인, 항목 추가 |
| secondary | 투명 | `--color-heading` | `--line-thin` `--color-control-border` | 수정, 취소, 교체 완료, 다시 시도, 차량 추가(영역), 입력, 월 이동 |
| danger | `--color-danger-fill` | `--color-on-danger` | 없음 | 확인창(DLG-02)의 "삭제" |
| danger-outline | 투명 | `--color-danger` | `--line-thin` `--color-danger` | 카드·만기일 행의 "삭제", 수정 양식 안 "삭제", MSG-11 버튼 |
| chip | 투명 | `--color-heading` | `--line-thin` `--color-control-border`, `--radius-pill` | 자동차세 빠른 선택("6월 30일", "12월 31일") |

공통: `min-height: --target-min`, 안쪽 가로 `--space-4`, 글자 `--text-body` `--weight-semibold`, 모서리 `--radius-control`, 아이콘이 있으면 글자와 `--space-1`. 최소 폭 88px. 한 줄 글자(줄바꿈 금지, 긴 글자가 오면 버튼이 늘어난다).

| 상태 | primary / danger | secondary / danger-outline / chip |
|---|---|---|
| default | 위 표 | 위 표 |
| hover | `filter: var(--chip-hover-filter)`(기존, 라이트 0.96 / 다크 1.2) | 면 `--color-fill-hover` |
| active | `--press-scale` 눌림 + 위 hover 유지 | `--press-scale` + 면 `--color-fill-pressed` |
| focus | 1.1의 외곽선 | 같음 |
| disabled | 면 `--color-subtle`, 글자 `--color-secondary` 0.5 | 테두리 `--color-hairline`, 글자 `--color-secondary` 0.5 |
| loading | 평상시 색 + 앞 회전 아이콘, 폭 유지 | 같음. MSG-11 버튼은 진행 중 비활성(screens.md 02b) |
| error | - (버튼 자체 오류 없음) | - |
| empty | - | - |

- 한 영역(화면·대화상자·카드)에 primary는 하나만 둔다. 확인창(DLG-02)은 primary 없이 danger 하나만 채워 둔다.
- 포커스 시작이 "취소"인 확인창(DLG-02, 04)에서도 "삭제"가 채워진 danger 버튼이다. 포커스 외곽선이 취소 쪽에 있어야 한다.
- 회전 아이콘: `--dur-slow`(500ms) 한 바퀴 반복. 동작 줄이기에서는 회전하지 않고 점 3개(···)가 정지로 보인다(10.2).

## 3. 입력

이름표는 항상 칸 위에 보인다(자리 표시 글자로 대신하지 않는다). 필수 칸의 이름표 끝에 "(필수)"를 글자로 쓴다.

### 3.1 구조

```
이름표 (필수)                     ← --text-body, --weight-medium, --color-heading
[ 값                      단위 ]  ← 높이 --field-h, 안쪽 가로 --space-3, --text-input
도움말 또는 오류 문구             ← --text-caption(도움말) / --text-body(오류), 위 간격 --space-1
```

- 이름표와 칸 사이 `--space-1`, 칸 묶음 사이 `--space-4`.
- 칸: 배경 `--color-canvas`, 테두리 `--line-thin` `--color-control-border`, 모서리 `--radius-control`, 글자 `--color-heading`.
- 단위("원", "km", "L"): 칸 안 오른쪽에 `--color-secondary` `--text-body`. 이름표에도 단위를 쓴다(예: "금액 (원)").
- 숫자 칸: 입력 방식은 숫자 키패드, 글자 정렬은 왼쪽, `tabular-nums`.

### 3.2 변형

| 변형 | 모양 | 비고 |
|---|---|---|
| 글자(별칭, 차종, 번호판, 이름) | 한 줄 칸 | |
| 숫자(연식, 금액, 주행거리, 주유량, 주기) | 한 줄 칸 + 단위 | |
| 날짜(날짜, 마지막 교체일, 만기일) | 기본 날짜 선택 칸. 오른쪽에 달력 아이콘(브라우저 기본) | |
| 선택(종류) | 기본 select 칸. 오른쪽에 아래 화살표 `--icon-sm`(`--color-secondary`) | 차량 선택 상자도 같은 모양(4.3) |
| 여러 줄(메모) | 칸 `min-height` 88px, 세로 크기 조절만 허용 | 글자 수 안내는 도움말 자리 |
| 체크 상자("가득 주유") | 24×24 상자(테두리 `--color-control-border`, 모서리 `--radius-chip`)와 글자를 묶은 한 줄, 줄 전체 `min-height` 44px, 줄 전체가 눌림 영역 | 체크됨: 면 `--color-primary-fill` + 흰 체크 표시(`--color-on-primary`). 체크 표시는 모양(✓)이라 색만으로 구분하지 않는다 |

### 3.3 상태

| 상태 | 표현 |
|---|---|
| default | 3.1 |
| hover | 테두리 `--color-secondary` |
| active | (입력 중) focus와 같음 |
| focus | 테두리 `--color-primary` + 외곽선 `--line-medium` `--color-focus`, `--focus-offset` |
| disabled | 면 `--color-subtle`, 글자 `--color-secondary` 0.5, 테두리 `--color-hairline` |
| loading | - (칸 자체 로딩 없음. 저장 중 칸은 평상시 그대로) |
| error | 테두리 `--line-medium` `--color-danger`(1px에서 2px로 굵어짐), 칸 아래 오류 문구(앞에 오류 아이콘 `--icon-sm` `--color-danger-icon`, 글자 `--text-body` `--color-danger`). `aria-invalid`, 문구는 칸과 연결 |
| empty | 값 없음. 자리 표시 글자는 `--color-secondary`(대비 5.02), 이름표를 대신하지 않음 |

- 오류 문구 대비: 라이트 흰 면 위 4.96, 대화상자(다크 `#1c1c1e`) 위 6.03.
- 오류는 색·두께·아이콘·글자 4중 단서다. 색만으로 구분하지 않는다.
- 오류 칸 두 개 이상이면 첫 오류 칸으로 포커스가 이동하고 외곽선이 보인다(screens.md 2장).
- 교체 항목 양식의 MSG-09는 km 주기·개월 주기 두 칸 묶음 아래 한 곳에 오류 문구로 보이고, 두 칸 모두 오류 테두리가 된다.

### 3.4 칸 배치 (대화상자 안)

| 폭 | 배치 |
|---|---|
| 대화상자 안쪽 폭 < 440px | 모든 칸 한 열 |
| ≥ 440px | 쌍으로 묶는 칸은 2열(칸 사이 `--space-3`). 쌍은 8장 표에 적었다. DOM 순서 = Tab 순서 = 위→아래, 왼→오른 |

## 4. 내비게이션

### 4.1 COMP-01 파일철 탭

| 항목 | 값 |
|---|---|
| 배치 | `position: fixed`, `right: calc(var(--tab-inset) + env(safe-area-inset-right))`, 묶음 세로 중심 = 모바일 `--tab-center-mobile`(40%), 데스크톱 `--tab-center-desktop`(50%). `z-index: var(--z-tab)` |
| 크기(탭 한 개) | 모바일 `--tab-mobile-w` × `--tab-mobile-h` = 28×56px, 데스크톱 `--tab-desktop-w` × `--tab-desktop-h` = 32×96px. 두 탭은 틈 없이 세로로 쌓는다(묶음 28×112 / 32×192) |
| 터치 영역 | 눈에 보이는 탭 모양과 완전히 같다. `::before`·`padding` 확장·`margin` 음수·투명 테두리로 영역을 넓히지 않는다. `box-sizing: border-box`라서 테두리·막대가 크기를 키우지 않는다 |
| 모양 | 왼쪽 두 모서리만 `--radius-control`로 둥글고 오른쪽은 화면 끝에 붙어 직각(파일철). 위쪽 탭 아래에 1px `--color-tab-border` 선 |
| 글자 | 가로 글자를 `rotate(90deg)`로 눕혀 위→아래로 읽는다(세로쓰기 속성 안 씀, tech.md T-4). 안쪽 `span`이 탭 가운데에 놓이고 탭 크기에 영향을 주지 않는다. 한 줄, 줄바꿈 없음. 모바일 `12px` 고정 `--weight-medium`, 데스크톱 `--text-body` |
| 접근성 이름 | 글자 그대로("캘린더", "차계부"). `nav` 이름 "화면 전환", 현재 탭 `aria-current="page"` |
| 폭 여유 | `/car` 본문 오른쪽 안쪽 여백 `--tab-gutter`(모바일 36px, 데스크톱 40px) |

| 상태 | 비선택 탭 | 현재 탭 |
|---|---|---|
| default | 면 `--color-tab-idle-bg`, 글자 `--color-tab-idle-text`(대비 4.73 / 다크 6.06), 굵기 500, 테두리 위·아래·왼쪽 `--line-thin` `--color-tab-border` | 면 `--color-tab-current-bg`(어두운 면), 글자 `--color-tab-current-text`(대비 17.90), 굵기 700, 왼쪽 안쪽 `--line-accent`(4px) 막대 `--color-primary-fill`(양옆 모두 3:1 이상: 흰 바탕 4.83, 탭 면 3.7) |
| hover | 면 위 `--color-fill-hover` | `filter: var(--chip-hover-filter)` |
| active | 면 위 `--color-fill-pressed`, 크기 변화 없음(눌림 확대/축소 안 함, 탭 모양 불변) | `filter: brightness(0.9)` |
| focus | 바깥 가장자리에서 안쪽으로 `--line-medium` `--color-focus` 외곽선(`outline-offset: -2px`) + 안쪽 `inset 4px` 띠 `--color-canvas`(면과 외곽선이 섞이지 않게). 외곽선 대비 4.83(다크 5.32) | 같음 |
| disabled / loading / error / empty | - | - |

- 현재 탭이 "튀어나온" 모양은 면 색과 막대, 굵기로 나타낸다. 눈에 안 보이는 영역을 만들지 않으려고 탭을 실제로 옮기거나 키우지 않는다.
- 선택 구분의 색 외 단서는 어두운/밝은 채움 대 투명 채움, 굵기 700 대 500, 왼쪽 막대 유무다(tokens.md 1.3).
- 숨김: 위젯 모드에서는 DOM에 없다. 오버레이(`--z-overlay` 100)가 열리면 가려진다.
- 걸치는 위치: 월 그리드 토요일 칸 일부를 가린다(screens.md 4.3). 시각 보정은 하지 않는다.
- **모바일 대안 위치(4.4, 실기기 확인 뒤)**: `--tab-inset: 12px`, 네 모서리 모두 `--radius-control`, 테두리를 네 변 모두 `--line-thin` `--color-tab-border`, 크기·세로 위치는 그대로(조건 1~4 유지). 이 경우 현재 탭은 왼쪽 막대 대신 테두리 `--line-medium` `--color-primary-fill`이 생긴다.
- 모바일 글자 12px 고정과 28px 폭은 PO가 수락했다(2026-11-05, R-14 조건 4와 WCAG 2.5.8 충족). 수락 조건 두 가지를 구현·검수 기준으로 삼는다.
  1. 브라우저 확대 200%에서 탭 글자가 잘리지 않는다(모바일 12px 고정, 탭 크기 28×56 / 32×96 유지).
  2. 탭마다 접근 가능한 이름이 있다(링크 글자 "캘린더"·"차계부" 또는 `aria-label`).

### 4.2 하위 탭 (탭 목록)

```
[ 기록 ][ 교체 알림 ][ 만기일 ][ 통계 ]
  ▔▔▔▔                                   ← 선택 탭 아래 3px 밑줄
────────────────────────────────────────  ← 목록 아래 1px 선
```

| 항목 | 값 |
|---|---|
| 배치 | 4개 균등 폭 한 줄(<1024px), 내용 폭에 맞춰 왼쪽 정렬(≥1024px, 탭 사이 `--space-2`, 탭 안쪽 가로 `--space-4`) |
| 크기 | `min-height: --target-min`. 글자가 넘치면 두 줄로 줄바꿈하고 높이는 유지(`min-height`) |
| 글자 | `--text-body` |
| 바탕 | 목록 아래 `--line-thin` `--color-hairline` |

| 상태 | 표현 |
|---|---|
| default(비선택) | 글자 `--color-secondary`(5.02), 굵기 500, 밑줄 없음 |
| default(선택) | 글자 `--color-heading`, 굵기 700, 아래 `--line-thick`(3px) `--color-primary`(흰 바탕 4.83) |
| hover | 면 `--color-fill-hover` |
| active | 면 `--color-fill-pressed` |
| focus | `--line-medium` `--color-focus` 외곽선, `outline-offset: -2px`(안쪽) |
| disabled / loading / error / empty | -(탭은 항상 보임, 패널 안에서 상태를 표시) |

- 선택 탭은 색만이 아니라 굵기와 밑줄 두 가지 모양 단서를 갖는다.
- 선택 밑줄은 `border-bottom`으로 그린다(`box-shadow`가 아님, 강제색에서 사라지지 않게. 10.1).

### 4.3 차량 영역: 선택 상자 · 차량 추가

- 차량 선택 상자: 3.2 "선택" 변형. 항상 보인다(1대여도). 이름표 "차량"(보이게). 모바일 전체 폭, 768px 이상 선택 상자와 "차량 추가"(secondary)가 한 줄(칸 사이 `--space-2`), 1024px 이상 영역 왼쪽 열 폭 280px.
- 상태: default / hover / focus / disabled(불러오는 중 뼈대로 대체) / error(차량 목록 실패는 영역 전체가 9.3 오류 블록).

### 4.4 월 선택 (통계)

```
[ ‹ ]   2026-11   [ › ]
```

- 이전·다음 버튼: 44×44px secondary 아이콘 버튼(`aria-label` "이전 달", "다음 달"), 모서리 `--radius-control`.
- 가운데 월 표시: `--text-subtitle` `--weight-bold` `tabular-nums`, 읽기 전용 텍스트(버튼 아님, 포커스 불가), 폭 약 96px 가운데 정렬. 변경 때 총합 영역이 `aria-live="polite"`로 읽힌다.
- 상태: default / hover·active·focus(버튼) / loading(월 이동 중 총합 자리 뼈대 한 줄) / disabled 없음.

## 5. 카드와 안내

### 5.1 차량 정보 카드

| 항목 | 값 |
|---|---|
| 면 | `--color-subtle`, 모서리 `--radius-card`, 안쪽 `--space-4`, 그림자 없음 |
| 제목 줄 | 별칭 `--text-title` `--weight-bold` `--color-heading`, 아래 줄에 차종·연식 `--text-body` `--color-secondary`(예: "아반떼 · 2021") |
| 항목 | 이름표(번호판, 현재 주행거리) `--text-caption` `--color-secondary`, 값 `--text-body` `--color-heading` `tabular-nums`. 빈 값은 "-". 320px에서 2열, 항목 사이 `--space-4` |
| 버튼 | "수정"(secondary), "삭제"(danger-outline). 모바일 카드 아래 줄에 나란히(각 `flex: 1`), 1024px 이상 카드 오른쪽 위에 세로 정렬 |

| 상태 | 표현 |
|---|---|
| default | 위 |
| hover / active / focus | 카드 자체는 눌리지 않는다(버튼만) |
| loading | 별칭 줄 160px·항목 2개 뼈대(9.1) |
| error | 영역 전체 9.3 |
| empty | 차량 0대는 카드가 없고 SCR-03(9.2) |

### 5.2 안내 상자 (MSG-12 참고용 값)

| 항목 | 값 |
|---|---|
| 면 | `--color-info-bg`, 테두리 `--line-thin` `--color-info-text`(고대비에서는 2px), 모서리 `--radius-control`, 안쪽 `--space-3` `--space-4` |
| 내용 | 앞 정보 아이콘(원 안에 i) `--icon-md` `--color-info-icon`, 글자 `--text-body` `--color-info-text`(대비 5.93, 다크 6.62) |
| 규칙 | 닫기 버튼 없음. 항상 보임. 읽을 수 있는 실제 텍스트(이미지 아님). 교체 알림 탭의 목록 위와 DLG-06 주기 칸 위 두 곳 |

상태는 default 하나뿐이다(hover/active/focus 없음, 눌리지 않음).

## 6. 목록 행

공통: 목록은 행 사이 틈이 없는 평평한 행이고 행 사이에 `--line-thin` `--color-hairline` 선이 있다. 행의 눌림 영역은 행 전체(최소 `--target-min`). 오른쪽 끝에 오른쪽 화살표(›) `--icon-sm` `--color-secondary`를 둔다(눌러서 수정 양식이 열린다는 단서, `aria-hidden`).

공통 상태(눌리는 행)

| 상태 | 표현 |
|---|---|
| default | 면 투명 |
| hover | 면 `--color-fill-hover` |
| active | 면 `--color-fill-pressed` + `--press-scale-row` |
| focus | `--line-medium` `--color-focus` 외곽선, `outline-offset: -2px` |
| loading | 9.1 뼈대 행 |
| error | 목록 전체가 9.3 |
| empty | 9.2 |

### 6.1 기록 행 — 카드형 (<1024px)

```
2026-11-03 · 주유                              52,000원  ›
12,345km · 35.2L · 연비 12.3km/L
출퇴근용 주유소 이용
```

| 줄 | 내용 | 스타일 |
|---|---|---|
| 1 왼쪽 | 날짜 · 종류 이름 | 날짜 `--text-caption` `--color-secondary`, 종류 `--text-body` `--weight-semibold` `--color-heading` |
| 1 오른쪽 | 금액(천 단위 쉼표 + "원") | `--text-subtitle`(18px) `--weight-semibold` `--color-heading`, `tabular-nums`, 오른쪽 정렬 |
| 2 | 주행거리 · 주유량(주유 행) · 연비(구간 끝 가득 주유 행) | `--text-caption` `--color-secondary`, 연비 값은 `--color-heading` `--weight-semibold`. 구분은 가운뎃점(·) 글자. 값이 없는 항목은 빼고 둘째 줄이 통째로 비면 줄도 없앤다 |
| 3 | 메모 한 줄 | `--text-caption` `--color-secondary`, 한 줄 말줄임. 없으면 줄 없음 |

- 안쪽 `--space-3` `--space-4`, 줄 사이 `--space-1`. 768px에서는 메모 한 줄을 더 보인다(폭이 넓어 말줄임이 늦게 생김, 줄 수 변화 없음).
- 같은 날짜 안에서 구분은 정렬 순서뿐이다(별도 표시 없음).

### 6.2 기록 행 — 표형 (≥1024px)

한 줄 행, 최소 높이 `--target-min` + `--space-1`(48px). 열은 격자 한 줄이다.

| 열 | 폭 | 정렬 | 글자 |
|---|---|---|---|
| 날짜 | 112px | 왼쪽 | `--text-body` `--color-heading` |
| 종류 | 72px | 왼쪽 | `--text-body` `--weight-semibold` |
| 금액 | 120px | 오른쪽 | `--text-body` `--weight-semibold`, `tabular-nums` |
| 주행거리 | 112px | 오른쪽 | `--text-body` `--color-secondary` |
| 주유량 | 80px | 오른쪽 | 같음 |
| 연비 | 96px | 오른쪽 | `--color-heading` `--weight-semibold` |
| 메모 | 나머지(`1fr`) | 왼쪽 | `--color-secondary`, 한 줄 말줄임 |
| 화살표 | 24px | 가운데 | › |

- 열 사이 `--space-4`. 머리글 행(눌리지 않음)은 `--text-caption` `--weight-semibold` `--color-secondary`, 아래 `--line-thin` `--color-hairline`, 높이 40px.
- 값이 없는 칸은 비워 둔다(표에서는 "-"를 쓰지 않아도 열이 맞는다).

### 6.3 교체 항목 — 카드형 (<1024px)

여러 동작(이름 누르기, 교체 완료, MSG-11)이 있어 행 전체가 버튼이 아니다. 카드로 묶는다.

```
엔진오일                                  [ 곧 교체 ]  ›
10,000km / 12개월
마지막 교체 2026-05-12 · 31,200km
다음 교체일 2026-11-12 · 남은 거리 1,200km
[ 교체 완료 ]   [ 캘린더 반영 실패, 다시 시도 ]
```

| 항목 | 값 |
|---|---|
| 카드 면 | `--color-subtle`, 모서리 `--radius-card`, 안쪽 `--space-4`, 카드 사이 `--space-3` |
| 윗줄 | 이름(`--text-subtitle` `--weight-semibold` `--color-heading`)과 오른쪽 배지(7장), › . 이름+배지 영역이 수정 양식을 여는 버튼(눌림 영역 `min-height` 44px, 상태는 6 공통 표) |
| 정보 줄 | 주기·마지막 교체·다음 교체일·남은 거리. `--text-body` `--color-secondary`, 값(날짜·거리)은 `--color-heading`, 줄 사이 `--space-1`, `tabular-nums` |
| 다음 교체일 | 지남 상태일 때 날짜를 `--color-danger` `--weight-semibold`(배지와 함께, 색만이 아님). MSG-18("주행거리 기록 부족")은 `--color-secondary` 보통 굵기, 오류가 아니다 |
| 버튼 줄 | "교체 완료"(secondary), 일정 쓰기 실패일 때만 MSG-11 버튼(danger-outline, 앞에 새로고침 아이콘). 버튼 사이 `--space-2`, 320px에서 좁으면 줄바꿈해 아래로 쌓는다(전체 폭) |
| 상태 | 6 공통 표(이름 영역). 카드 전체는 눌리지 않는다. MSG-11 버튼 진행 중은 2장 loading, 성공하면 사라지고 줄이 줄어든다 |

### 6.4 교체 항목 — 표형 (≥1024px)

카드형과 같은 정보를 한 줄 행으로 펼친다(면 투명, 행 선 `--color-hairline`, 최소 높이 56px).

| 열 | 폭(셀 안쪽 `--space-2` 포함) | 내용 |
|---|---|---|
| 이름 | 140px | 이름 버튼(눌림 영역, › 포함) |
| 주기 | 128px | `10,000km / 12개월` |
| 마지막 교체 | 152px | 날짜 + 주행거리 |
| 다음 교체일 | 112px | 날짜 또는 MSG-18 |
| 남은 거리 | 88px | 오른쪽 정렬 |
| 상태 | 128px | 배지(한 줄) |
| 동작 | 나머지(본문 최대 폭 880px에서 132px 이상) | "교체 완료", (MSG-11) 오른쪽 정렬. 두 버튼이 한 줄에 안 들어가면 세로로 쌓는다(행 높이는 `min-height`) |

앞 여섯 열 합계 748px + 동작 열 = 본문 최대 폭 880px 안에 들어간다(1024px 화면에서 가로 스크롤 없음). 글자가 넘치는 칸은 말줄임이 아니라 줄바꿈(행이 높아짐)으로 처리한다.

머리글은 6.2와 같다. 정렬은 screens.md 2b(지남 → 곧 교체 → 정상)를 그대로 따른다(UA-8).

### 6.5 만기일 행

세 행 고정(보험 만기, 자동차세 납부, 정기검사). 평평한 행 + 선(눌림 행이 아니므로 hover 없음).

| 폭 | 배치 |
|---|---|
| <600px | 윗줄: 종류 이름(`--text-subtitle` `--weight-semibold`) + 오른쪽 날짜(`--text-body` `tabular-nums`) 또는 "날짜 없음"(`--color-secondary`). 아랫줄: 버튼들(값 없음 → "입력"(secondary) 하나, 값 있음 → "수정"(secondary) "삭제"(danger-outline), 일정 실패면 MSG-11 버튼 추가). 버튼 높이 44px, 사이 `--space-2` |
| ≥600px | 한 줄: 종류(폭 160px) · 날짜(폭 128px) · 오른쪽 정렬 버튼들 |

값이 있는데 "입력" 버튼은 없다(AC-07-6). 임박·지남 배지는 없다(F-07).

### 6.6 통계 구획

| 요소 | 모양 |
|---|---|
| 월 선택 | 4.4 |
| 선택한 달 총합 | 이름표 "총 지출"(`--text-caption` `--color-secondary`) + 숫자 `--text-display`(<900px) / `--text-hero`(≥900px) `--weight-bold` `--color-heading` `tabular-nums` + "원"(`--text-subtitle`). 기록이 없으면 "0원" + 아래 줄 "이 달의 기록이 없습니다"(`--text-body` `--color-secondary`) |
| 종류별 합계 / 월별 합계 | 한 줄 행: 왼쪽 이름(`--text-body`), 오른쪽 금액(`--text-body` `--weight-semibold` `tabular-nums`). 행 `min-height` 44px, 선 `--color-hairline`. 막대·그림 없음(screens.md 2d). 0원 행은 금액을 `--color-secondary`로 |
| 연비 변화 | 한 줄 행: `날짜 — 12.3km/L`. 구간 없으면 "가득 주유 기록이 2건 이상 필요합니다"(`--text-body` `--color-secondary`) |
| 구획 제목(H3) | `--text-subtitle` `--weight-semibold`, 위 `--space-5` 아래 `--space-2` |

### 6.7 연비 요약 (기록 탭 맨 위)

- 면 `--color-subtle`, 모서리 `--radius-card`, 안쪽 `--space-4`. "연비 12.3km/L": 이름표 `--text-caption` `--color-secondary`, 숫자 `--text-heading` `--weight-bold` `--color-heading` `tabular-nums`, 단위 `--text-body`.
- 기록 부족이면 같은 자리에 "연비: 가득 주유 기록이 2건 이상 필요합니다"를 `--text-body` `--color-secondary`로 보인다(오류가 아닌 정상 빈 값, 아이콘 없음).

## 7. 배지

| 변형 | 글자 | 면 | 글자색 | 테두리 | 아이콘(`currentColor`가 아닌 아이콘 색) |
|---|---|---|---|---|---|
| 곧 교체 | "곧 교체" | `--color-warning-bg` | `--color-warning-text` | `--line-thin` `--color-warning-text` | 시계 `--color-warning-icon` |
| 교체 시기 지남 | "교체 시기 지남" | `--color-danger-bg` | `--color-danger-text` | `--line-thin` `--color-danger-text` | 느낌표 원 `--color-danger-icon` |
| 정상 | (배지 없음) | | | | |

- 크기: 높이 `--badge-h`(24px), 안쪽 가로 `--space-2`, 앞 아이콘 `--icon-sm`과 글자 사이 `--space-1`, 글자 `--text-caption` `--weight-semibold`, 모서리 `--radius-pill`, 한 줄(`white-space: nowrap`).
- 구분 단서 3중: 글자 + 아이콘 모양(시계 vs 느낌표) + 테두리. 면 색은 보조다. 회색조로 봐도 글자와 모양으로 구분된다.
- 배지는 눌리지 않는다(hover/active/focus/disabled 없음). 상태는 default 하나다.
- 대비: 글자/면 라이트 6.09(경고), 6.08(에러), 다크 8.68, 6.97. 테두리(=글자색)는 흰 바탕 위 6.80, 4.96 이상.
- 고대비 선호 설정: 테두리 2px.

## 8. 대화상자

### 8.1 공통 구조

```
┌ 스크림(--scrim-color) ───────────────────┐
│  ┌ 패널(--color-surface-raised) ──────┐ │
│  │ 제목 H2        --text-subtitle     │ │
│  │ 본문(스크롤) 칸/문구               │ │
│  │ ───────── 1px hairline ─────────── │ │
│  │ 버튼 줄(항상 보임)                 │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

| 항목 | 모바일 시트(≤899px) | 데스크톱 모달(≥900px) |
|---|---|---|
| 위치 | 화면 아래에 붙음, 폭 100%(600px 이상은 `--dialog-sheet-max` 560px 가운데) | 화면 가운데, 폭 `--dialog-modal-w` 480px |
| 모서리 | 위 두 모서리만 `--radius-overlay` | 네 모서리 `--radius-overlay` |
| 높이 | 최대 `90dvh`, 넘치면 본문만 스크롤(제목·버튼 줄 고정). 뒷배경 위에 스크림이 최소 10% 보임 | 최대 `85dvh` |
| 그림자·테두리 | `--shadow-md` + `--border-overlay` | `--shadow-lg` + `--border-overlay` |
| 안쪽 | 가로 `--space-4`, 위 `--space-4`, 아래 `--space-4` + `env(safe-area-inset-bottom)` | 모두 `--space-5` |
| 나타남 | 아래에서 위로 `--dur-base` `--ease-out`, 스크림 투명→`--scrim-color` 같은 시간 | 투명도 0→1, 크기 0.98→1, `--dur-base` |
| 사라짐 | 반대 방향 `--dur-fast` | 투명도 1→0 `--dur-fast` |
| 손잡이 | 없음(밀어 닫기를 명세하지 않음) | - |

- 제목 H2는 보이는 글자다(`--text-subtitle` `--weight-semibold` `--color-heading`), 본문과 `--space-4` 간격. 닫기(X) 버튼은 없다("취소"와 Esc가 닫는다, screens.md).
- 버튼 줄: 위 `--line-thin` `--color-hairline` 선, 위 안쪽 `--space-3`, 버튼 사이 `--space-2`. 두 폭 모두 본문이 길어져도 버튼 줄은 항상 보인다.
- 버튼 줄 배치: 안쪽 폭 ≥ 440px는 한 줄 가로, 앞에서부터 DOM 순서(저장, 취소). "삭제"(수정 때만)는 같은 줄 오른쪽 끝(`margin-inline-start: auto`)이고 DOM에서도 마지막이라 Tab 순서와 시각 순서가 일치한다. <440px는 버튼이 세로로 쌓이고 폭 100%, 순서는 같은 DOM 순서(저장 → 취소 → 삭제), 버튼 사이 `--space-2`.
- 포커스 가두기·초기 포커스·복귀는 screens.md 2장 그대로이며 모양은 1.1의 focus 표현을 쓴다.
- 입력 양식 열림 중 뒷배경은 조작할 수 없고 스크림이 가린다. 입력 양식은 바깥 클릭이 닫지 않으므로 스크림은 눌림 표시(손가락 커서)를 하지 않는다. 확인창(DLG-02, 04)은 바깥이 취소다.

### 8.2 DLG별 구성과 칸 배치

(필수는 *, 쌍은 ≥440px 2열이고 그 아래는 한 열)

| ID | 제목 | 칸 배치(Tab 순서) | 버튼 | 특이사항 |
|---|---|---|---|---|
| DLG-01 | 차량 추가 / 차량 수정 | 별칭*, 차종, [연식 / 번호판], 현재 주행거리 | 저장(primary), 취소(secondary) | 값 채워진 수정 양식 |
| DLG-02 | "삭제할까요?"(대상 이름 포함) | 문구 MSG-13(`--text-input` 16px `--color-body`), 차량이면 MSG-14를 다음 줄에 `--color-danger` `--weight-medium` | 삭제(danger), 취소(secondary, 기본 포커스) | 저장 칸 없음. 삭제 중 삭제 버튼 loading |
| DLG-03 | 기록 추가 / 기록 수정 | 종류*(select), [날짜* / 금액*], [주행거리 / 주유량(주유일 때만)], 가득 주유(주유일 때만, 체크 상자 줄), 메모 | 저장, 취소, (수정) 삭제(danger-outline) | 종류가 주유로 바뀌면 주유량·가득 주유가 나타난다(높이 변화는 `--dur-fast`, 동작 줄이기에서는 즉시). 아래 버튼 줄은 항상 보임 |
| DLG-04 | "주행거리가 이전 기록보다 작습니다"(MSG-10 문구 전체를 제목 아래 본문에) | 문구 MSG-10, 값 `{N}`km은 `--weight-bold` | 저장(primary), 취소(secondary, 기본 포커스) | DLG-03 위에 열림. 아래 DLG-03의 입력값이 남아 있다 |
| DLG-05 | 교체 완료 | [마지막 교체일* / 마지막 교체 주행거리] | 확인(primary), 취소 | 항목 이름을 제목 아래 보조 줄(`--text-body` `--color-secondary`)로 보인다 |
| DLG-06 | 교체 항목 추가 / 수정 | 이름*, 안내 상자(5.2), [km 주기 / 개월 주기], 오류 문구 자리(MSG-09), [마지막 교체일* / 마지막 교체 주행거리] | 저장, 취소, (수정) 삭제(danger-outline) | MSG-09는 두 주기 칸 묶음 아래 한 곳. 두 칸 모두 오류 테두리 |
| DLG-07 | 만기일 입력 / 수정 | 종류(읽기 전용 표시: 이름표 + 굵은 글자, 칸 모양 없음), 만기일*(날짜), (자동차세만) 빠른 선택 chip 2개(`--space-2` 간격, 날짜 칸 아래) | 저장, 취소 | chip을 눌러도 저장되지 않는다. 눌린 chip은 날짜 칸 값이 바뀌고 chip 자체 표현은 평상시(선택 유지 표시 없음) |

### 8.3 상태

| 상태 | 표현 |
|---|---|
| default | 8.1~8.2 |
| hover / active / focus | 안의 버튼·칸 각각 2·3장. 패널 자체는 눌리지 않는다 |
| loading | 저장(또는 확인·삭제) 버튼이 loading(2장). 다른 칸·버튼은 평상시. 실패하면 loading이 풀리고 입력값 유지 |
| error | 칸 아래 오류 문구(3.3) + 첫 오류 칸 포커스. 저장·삭제 실패(MSG-01·03)는 토스트(9.4)이고 패널은 그대로 |
| empty | - |
| disabled | 저장 중 저장 버튼만. 칸을 비활성으로 흐리게 하지 않는다 |

## 9. 로딩·빈·오류·토스트

### 9.1 로딩(뼈대)

- 목록 자리에 뼈대 행 3개. 각 행은 실제 행과 같은 높이를 차지해서 데이터가 들어와도 화면이 밀리지 않는다(기록 행 72px, 교체 카드 144px, 표형 48px/56px, 만기일 행 80px).
- 모양: 모서리 `--radius-chip`의 막대(`--color-skeleton`). 한 행에 막대 2개(제목 막대 폭 40%, 둘째 줄 막대 폭 65%, 높이 `--text-body`의 줄 높이). 막대 사이 `--space-2`.
- 반짝임: `--color-skeleton-glint` 띠가 왼쪽에서 오른쪽으로 1500ms 한 주기로 흐른다(`--dur-slow`의 3배, 반복). 동작 줄이기에서는 띠 없음(정지된 `--color-skeleton` 면).
- 화면낭독기용 "불러오는 중" 글자(보이지 않음)와 영역의 `aria-busy`. 뼈대 자체는 `aria-hidden`.
- SCR-01a 세션 확인 중: 화면 가운데 회전 아이콘 `--icon-md` 하나. 문구를 깜빡이지 않는다(회전 아이콘 + 보이지 않는 "불러오는 중").
- 대비 요건 없음(장식). 강제색에서는 막대에 `--line-thin` `GrayText` 테두리가 생긴다(10.1).

### 9.2 빈 상태

```
            기록이 없습니다                     ← --text-subtitle, --weight-semibold, --color-heading
   (선택) 보조 설명 한 줄                       ← --text-body, --color-secondary
          [ 기록 추가 ]                         ← primary 버튼
```

- 가운데 정렬, 위아래 안쪽 `--space-7`, 좌우 `--space-4`. 문구와 버튼 사이 `--space-4`.
- 기록·교체 알림 탭이 비면 상단의 "기록 추가"·"항목 추가" 버튼은 숨기고(screens.md UA-11, UX Designer 결정 2026-11-05), 빈 상태 버튼 하나만 primary로 둔다. 목록이 생기면 상단 버튼이 나타나고 빈 상태 버튼은 사라진다. 한 영역에 primary는 하나라는 2장 규칙이 그대로 지켜진다.
- SCR-03(차량 0대): 이 영역이 화면 전체이므로 버튼이 primary이고 문구는 `--text-heading`.
- SCR-01 로그인 안내: 같은 모양, 문구 MSG-02(`--text-subtitle`), 버튼 "로그인" primary. 가운데 정렬 한 열, 폭이 늘어나도 폭 `--dialog-modal-w` 이하로 유지.
- 통계 "이 달의 기록이 없습니다"는 빈 상태가 아니라 6.6의 보조 줄이다.

### 9.3 오류 블록 (MSG-04)

| 항목 | 값 |
|---|---|
| 면 | `--color-danger-bg`, 테두리 `--line-thin` `--color-danger-text`, 모서리 `--radius-card`, 안쪽 `--space-4` |
| 내용 | 앞 오류 아이콘 `--icon-md` `--color-danger-icon`, 문구 "차계부 데이터를 불러오지 못했습니다" `--text-body` `--weight-semibold` `--color-danger-text`(대비 6.08 / 6.97), 아래 `--space-3` 간격으로 "다시 시도" secondary 버튼 |
| 위치 | 해당 영역 자리를 대신한다(토스트가 아님). 차량 목록 실패는 하위 탭까지 가리고 이 블록만 보인다 |
| 상태 | 다시 시도 누르면 버튼 loading(2장). 성공하면 블록이 정상 화면으로 바뀐다 |

### 9.4 토스트 (기존 장치, MSG-01·03)

- 새로 만들지 않는다. 기존 `ToastViewport`의 어두운 알약(`--color-heading` 면)과 위치(모바일 FAB 위, 데스크톱 기존 위치)를 그대로 쓴다.
- 층 `--z-toast`(300)는 파일철 탭(`--z-tab` 60)과 대화상자(`--z-overlay` 100) 위라서 모든 것에 가려지지 않는다.
- 토스트(아래쪽)와 파일철 탭 묶음(높이 40~50% 지점)은 세로로 떨어져 있어 겹치지 않는다. 토스트 위치를 바꾸지 않는다.

## 10. 환경별 대응

### 10.1 강제색(`forced-colors: active`)

원칙: 면 색·그림자·`box-shadow`·그라데이션은 사라지므로 **모양 단서를 테두리(border), 외곽선(outline), 글자, 아이콘(`currentColor`)으로만 만든다.** 선택 밑줄·막대·테두리를 `box-shadow`나 `background-image`로 그리지 않는다.

| 컴포넌트 | 강제색에서 |
|---|---|
| 버튼 모든 변형 | `border: var(--line-thin) solid ButtonText`(primary·danger도 테두리를 가진다). primary는 `--line-medium`으로 구분. 글자 `ButtonText`. disabled는 `GrayText` |
| 현재 파일철 탭 | 면 `Highlight`, 글자 `HighlightText`, 왼쪽 막대는 `border-left: var(--line-accent) solid ButtonText` |
| 비선택 파일철 탭 | 면 `Canvas`, 글자 `CanvasText`, 테두리 `ButtonText` |
| 하위 탭 | 선택: `border-bottom: var(--line-thick) solid Highlight`, 글자 굵기 700. 비선택: 밑줄 없음 |
| 입력 | 테두리 `ButtonText`, 오류는 `--line-medium` 테두리 + 오류 아이콘 + 글자. 포커스 외곽선 유지 |
| 체크 상자 | 체크 표시 `CanvasText`(모양). 체크 안 됨은 빈 상자 |
| 배지·안내 상자·오류 블록 | 테두리 `CanvasText`(면 색 사라짐), 글자 `CanvasText`, 아이콘 `currentColor`. 모양과 글자가 구분을 맡는다 |
| 뼈대 | `border: var(--line-thin) dashed GrayText` |
| 대화상자 | 패널 테두리 `--line-thin` `CanvasText`(그림자 사라짐) |
| 목록 행 선 | `CanvasText` 대신 `GrayText`로 약하게 |
| 포커스 외곽선 | 유지. 색 `Highlight`가 아니라 `CanvasText`로 두어 면과 겹쳐도 보이게 |

### 10.2 동작 줄이기(`prefers-reduced-motion: reduce`)

| 동작 | 일반 | 동작 줄이기 |
|---|---|---|
| 시트 올라옴·모달 나타남 | `--dur-base` 이동/확대 | 이동·확대 없음, 즉시 나타남(스크림도 즉시) |
| 사라짐 | `--dur-fast` | 즉시 |
| 호버·선택 색 바뀜 | `--dur-fast` | 즉시(0ms) |
| 눌림 확대/축소 | `--press-scale` | 없음. 눌림 표시는 면 색만 |
| 뼈대 반짝임 | 1500ms 반복 | 없음(정지 면) |
| 회전 아이콘(loading) | 500ms 한 바퀴 | 회전 없음, 정지된 점 3개(···). 버튼은 `aria-busy` 유지 |
| 주유 양식 칸 나타남 | `--dur-fast` | 즉시 |
| 파일철 탭 선택 변화 | `--dur-fast` | 즉시 |

구현: 토큰의 `--dur-fast`, `--dur-base`, `--dur-slow`를 `0ms`로 바꾸는 한 곳(tokens.md 6장 4번)과 뼈대·회전 애니메이션을 `animation: none`으로 끄는 한 곳이면 된다.

### 10.3 200% 확대·글자 크기 키우기

- 글자는 rem이라 따라 커진다. 행·카드·버튼은 `min-height`와 줄바꿈으로 늘어나므로 잘리지 않는다. 가로 스크롤은 어느 폭에서도 없다.
- 브라우저 200% 확대는 CSS 폭을 절반으로 만든다. 1280px 화면은 640px(모바일 배치)이 된다. 설계 최소 폭은 320px이고, 1280px 화면의 400% 확대(= 320px)에서도 한 열이다.
- 표형 목록은 1024px 이상에서만 쓴다. 확대로 폭이 줄면 카드형으로 바뀌므로 가로 스크롤이 생기지 않는다.
- 예외: 모바일 파일철 탭 글자(12px 고정, tokens.md 5장).
- 대화상자 높이가 부족하면(가로 화면, 큰 글자) 본문이 스크롤되고 제목·버튼 줄은 고정이다. 키보드가 올라올 때도 같다(`dvh`).

### 10.4 다크·ZIGZAG·고대비

- 다크: 모든 신규 토큰에 다크 값이 있다(tokens.md 1.2). 대화상자 같은 올라온 면은 `--color-surface-raised`(#1c1c1e), 페이지는 `#000`. 그림자 대신 `--border-overlay`로 층을 나눈다.
- ZIGZAG: 모서리 0, 그림자 없음, 강조색 핑크(`#c2185b`). 상태색(경고·에러·정보)은 ZIGZAG에서도 같은 값을 쓴다. 배지는 사각이 된다.
- 고대비 선호(`prefers-contrast: more`): 구분선·입력 테두리·보조 글자가 기존 규칙으로 진해지고, 배지·안내 상자 테두리는 2px.

## 11. Frontend 체크리스트 (구현 없이 규격만으로 확인)

- [ ] 색·간격·글자 크기·시간을 숫자로 직접 쓰지 않았다(0, 1px, 50% 제외).
- [ ] 모든 버튼·행·입력 칸 높이 ≥ 44px. 예외는 파일철 탭뿐이다.
- [ ] 파일철 탭 크기 = 보이는 모양, 모바일 28×56 / 데스크톱 32×96, 보이지 않는 확장 없음. 브라우저 확대 200%에서 탭 글자가 잘리지 않고, 탭마다 접근 가능한 이름이 있다(PO 수락 조건).
- [ ] 선택 탭(파일철·하위)과 배지가 색 말고 모양/글자 단서를 갖는다.
- [ ] 선택 밑줄·막대는 `border`로 그렸다(강제색).
- [ ] 포커스 외곽선 2px이 모든 대화형 요소에 보인다(잘리는 곳은 안쪽 간격).
- [ ] 동작 줄이기에서 이동·확대·반짝임·회전이 없다.
- [ ] 320px에서 가로 스크롤이 없다.

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | UX Designer 요청 conv-8c399a(MPR-1~16) | UX Designer | 신규 컴포넌트 규격만 추가. 기존 캘린더 컴포넌트 불변 |
| 2026-11-05 | 4.1·11장에 파일철 탭 예외 수락 조건 2건 기록(200% 확대에서 글자 안 잘림, 접근 가능한 이름) | PO 검토 통과 회신 07-27 | Product Owner | 설계 전체 승인. 규격 값 변경 없음 |
| 2026-11-05 | 9.2 빈 상태 버튼을 primary로, 상단 추가 버튼은 빈 상태에서 숨김. 6.4 열 폭, 8.2 확인창 버튼 순서 수락 확인 | UX Designer 회신 05-35 (UA-11) | UX Designer | 빈 상태 화면의 버튼 하나만 primary |
