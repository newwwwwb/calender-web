# 디자인 토큰 — 차계부(/car)

- 날짜: 2026-11-05 · 소유자: UI Designer · 상태: 초안(Product Owner 설계 검토 대기)
- 근거: [screens.md](screens.md)(4.1 탭 크기, 5장 폭별 차이), [flows.md](flows.md), 기존 코드 `src/styles/tokens.css`(실제 값)
- 짝 문서: [components.md](components.md)(컴포넌트 변형·상태), [mockups/car-ledger.html](mockups/car-ledger.html)(시각 확인용 목업)
- 적용 범위: `/car` 화면과 파일철 탭(COMP-01). 캘린더 화면(SCR-00)의 기존 토큰·크기·위치는 바꾸지 않는다(AC-01-5).

## 0. 읽는 법

- **기존**: `src/styles/tokens.css`에 이미 있는 이름이다. 새로 만들지 않고 그대로 쓴다. 값은 아래 표에 옮겨 적었으나 원본이 기준이다.
- **신규**: 이 문서가 처음 정한다. Frontend가 `tokens.css`의 같은 블록(`:root`, `:root:where([data-scheme='dark'])`)에 추가한다. 앱 소스는 UI Designer가 고치지 않는다.
- 컴포넌트 코드에 색·간격·글자 크기·시간을 숫자로 직접 쓰지 않는다. 이 문서의 이름만 쓴다. 예외는 0, 1px 선, 50% 같은 구조 값뿐이다.
- 테마는 3축이다. 라이트/다크(`data-scheme='dark'`), 기본/ZIGZAG(`data-theme='zigzag'`, 라운드 0·그림자 없음), 사용자 설정 미디어 쿼리. 신규 토큰도 세 축을 모두 따른다(4장).
- 대비 수치는 WCAG 2.x 상대 휘도 공식으로 계산한 값이다(계산 스크립트 결과, 2026-11-05). 글자 4.5:1, 큰 글자(24px 이상 또는 18.66px 굵은 글자) 3:1, 비텍스트(테두리·아이콘·포커스) 3:1을 기준으로 삼았다.

## 1. 색

### 1.1 팔레트 원색 (신규, 라이트 기준 · 100/500/900)

| 계열 | 100 (연한 면) | 500 (아이콘·채움) | 900 (글자·테두리) | 용도 |
|---|---|---|---|---|
| 주(primary) | `#e6f0ff` | `#0066ff` | `#003a8c` | 링크, 채운 버튼, 정보 배지 |
| 보조(neutral) | `#f8f8f8` | `#6e6f72` | `#171719` | 면, 보조 글자, 제목 |
| 성공(success) | `#e7f6ed` | `#1a8a4a` | `#0b6b3a` | (현재 차계부 화면에는 성공 배지 없음. 예약) |
| 경고(warning) | `#fff1d6` | `#b45f00` | `#8a4b00` | 곧 교체 배지 |
| 에러(danger) | `#fde8e8` | `#cc3a3a` | `#a82424` | 교체 시기 지남 배지, 오류 문구, 삭제 |
| 정보(info) | `#e6f0ff` | `#0066ff` | `#0052cc` | 안내 상자(MSG-12) |

- 컴포넌트는 팔레트를 직접 쓰지 않고 1.2의 의미 토큰만 쓴다. 팔레트는 의미 토큰이 어디서 왔는지 보여 주는 용도다.
- 주·보조 500, 에러 500은 기존 `--color-primary`, `--color-secondary`, `--color-danger`와 같은 값이다. 새로 정한 값은 나머지다.

### 1.2 의미 토큰

#### 기존 (그대로 사용)

| 토큰 | 라이트 | 다크 | 의미 | 대비(라이트 / 다크) |
|---|---|---|---|---|
| `--color-heading` | `#171719` | `#f5f5f7` | 제목, 강조 숫자 | 흰 배경 17.90 / 올라온 면 15.63 |
| `--color-body` | `#333333` | `#e5e5ea` | 본문 | 12.63 / 13.55 |
| `--color-secondary` | `#6e6f72` | `#98989d` | 보조 글자(날짜, 메모, 이름표 보조) | 흰 5.02, `--color-subtle` 위 4.73 / 올라온 면 5.93 |
| `--color-primary` | `#0066ff` | `#4c8dff` | 글자·아이콘·링크, 포커스 | 흰 4.83 / 올라온 면 5.32 |
| `--color-primary-fill` | `#0066ff` | `#0066ff` | 채운 버튼 면 | 위 글자 `--color-on-primary`(흰) 4.83 |
| `--color-danger` | `#cc3a3a` | `#ff6961` | 오류 글자, 삭제 글자 | 흰 4.96 / 올라온 면 6.03 |
| `--color-danger-fill` | `#cc3a3a` | `#cc3a3a`(기존 값 유지) | 채운 삭제 버튼 | 위 글자 `--color-on-danger` 4.96 |
| `--color-canvas` | `#ffffff` | `#000000` | 페이지 바탕 | |
| `--color-surface-raised` | `#ffffff` | `#1c1c1e` | 대화상자, 시트, 카드 | |
| `--color-subtle` | `#f8f8f8` | 흰 10% 투명 | 눌린 면, 뼈대, 비선택 탭 | |
| `--color-fill-hover` / `--color-fill-pressed` | 검정 4% / 8% | 흰 8% / 14% | 행·버튼 hover, active 덮개 | 장식 |
| `--color-hairline` | `#e8e9ea` | `#38383a` | 장식 구분선 | 1.22(장식이라 요구 없음) |
| `--color-control-border` | `#8e9093` | `#6e6e73` | 입력·비선택 탭·확인 상자 테두리 | 3.20 / 3.36 |
| `--color-focus` | `--color-primary` | 같음 | 포커스 외곽선 | 4.83 / 5.32 |
| `--color-selected-fill` / `--color-on-selected` | `#171719` / `--color-canvas` | `#f5f5f7` / `#000` | 선택된 파일철 탭 면과 글자 | 17.90 / 19.29 |
| `--scrim-color` | 검정 32% | 검정 60% | 대화상자 뒷배경 | |

#### 신규 (상태색 — 배지, 안내 상자, 오류 칸)

글자는 `-text`를 `-bg` 위에 놓는 조합으로만 쓴다. 테두리와 글자가 같은 `-text` 색이라 테두리 대비는 글자와 같다.

| 토큰 | 라이트 | 다크 | 쓰는 곳 | 대비(글자/바탕) |
|---|---|---|---|---|
| `--color-success-bg` / `-text` | `#e7f6ed` / `#0b6b3a` | `#0f2e1d` / `#5fd38d` | 예약(미사용) | 5.92 / 7.83 |
| `--color-warning-bg` / `-text` | `#fff1d6` / `#8a4b00` | `#3a2a0a` / `#ffc266` | "곧 교체" 배지 | 6.09 / 8.68 |
| `--color-warning-icon` | `#b45f00` | `#ffc266` | 배지 아이콘 | 바탕 위 4.11 / 8.68 (3:1 이상) |
| `--color-danger-bg` / `-text` | `#fde8e8` / `#a82424` | `#3d1614` / `#ff8a84` | "교체 시기 지남" 배지 | 6.08 / 6.97 |
| `--color-info-bg` / `-text` | `#e6f0ff` / `#0052cc` | `#0f2347` / `#7aa9ff` | MSG-12 안내 상자 | 5.93 / 6.62 |
| `--color-info-icon` | `#0066ff` | `#4c8dff` | 안내 상자 아이콘 | 4.21 / 4.85 |
| `--color-danger-icon` | `#cc3a3a` | `#ff6961` | 배지·오류 아이콘 | 4.22 / 5.63 |
| `--color-success-icon` | `#1a8a4a` | `#5fd38d` | 예약 | 3.94 / 7.83 |

- 라이트 흰 바탕(`--color-canvas`) 위에서 `-text` 단독 글자도 모두 4.5:1 이상이다(경고 6.80, 성공 6.61).
- 배지·안내 상자의 면(`-bg`)과 페이지 바탕의 대비는 1.12~1.23이다. 면은 장식이고, 경계는 1px `-text` 색 테두리가 맡는다(3:1 이상). 면 색만으로 구분하지 않는다.

#### 신규 (파일철 탭, 뼈대)

| 토큰 | 라이트 | 다크 | 의미 |
|---|---|---|---|
| `--color-tab-idle-bg` | `--color-subtle` | 같음 | 비선택 탭 면 |
| `--color-tab-idle-text` | `--color-secondary` | 같음 | 비선택 탭 글자. 라이트 4.73, 다크(흰 10% 위) 6.06 |
| `--color-tab-current-bg` | `--color-selected-fill` | 같음 | 선택 탭 면 |
| `--color-tab-current-text` | `--color-on-selected` | 같음 | 선택 탭 글자 |
| `--color-tab-border` | `--color-control-border` | 같음 | 비선택 탭 테두리(3:1 이상) |
| `--color-skeleton` | `--color-subtle` | 같음 | 뼈대 기본 면 |
| `--color-skeleton-glint` | 흰 60% | 흰 12% | 뼈대 반짝임 띠(동작 줄이기에서는 없음) |

### 1.3 색만으로 구분하지 않는 규칙

| 대상 | 색 외 단서 |
|---|---|
| 현재 파일철 탭 | 채운 면(어두운/밝은 면) vs 투명한 면, 굵은 글자(700 vs 500), 왼쪽 4px 막대, `aria-current="page"` |
| 선택된 하위 탭 | 아래 3px 밑줄, 굵은 글자(700 vs 500), `aria-selected="true"` |
| 교체 상태 배지 | 글자("곧 교체", "교체 시기 지남"), 아이콘 모양(시계 vs 느낌표), 1px 테두리 |
| 입력 오류 | 칸 아래 오류 문구(글자), 오류 아이콘, 테두리 2px(평소 1px), `aria-invalid` |
| 필수 칸 | 이름표 끝 "(필수)" 글자 |
| 안내 상자(MSG-12) | 아이콘 + 글자. 닫기 버튼 없음 |

## 2. 글꼴

- 글꼴: `--font-family`(기존) = `'Pretendard Variable', Pretendard, -apple-system, sans-serif`. 숫자 열은 `font-variant-numeric: tabular-nums`를 켠다(금액·주행거리·연비가 세로로 맞는다).
- 신규 크기 단위는 `rem`이다(1rem = 브라우저 기본 16px). 사용자가 글자 크기를 키우면 따라 커진다.

### 2.1 글자 크기 (신규, 12~36px)

| 토큰 | rem | px | 줄 높이 토큰 | 쓰임 |
|---|---|---|---|---|
| `--text-caption` | 0.75rem | 12 | `--leading-tight` | 보조 설명, 표 머리글, 배지, 모바일 파일철 탭 글자(5장 예외) |
| `--text-body` | 0.875rem | 14 | `--leading-normal` | 행 본문, 하위 탭, 버튼, 데스크톱 파일철 탭 글자 |
| `--text-input` | 1rem | 16 | `--leading-normal` | 입력 칸 안 글자(16px 미만이면 iOS가 포커스 때 화면을 확대한다) |
| `--text-subtitle` | 1.125rem | 18 | `--leading-snug` | H3 소제목, 대화상자 제목(H2) |
| `--text-title` | 1.25rem | 20 | `--leading-snug` | 차량 카드 별칭 |
| `--text-heading` | 1.5rem | 24 | `--leading-snug` | 연비 요약 숫자 |
| `--text-display` | 1.875rem | 30 | `--leading-tight` | 통계 선택 달 총합(<900px) |
| `--text-hero` | 2.25rem | 36 | `--leading-tight` | 통계 선택 달 총합(≥900px) |

| 토큰 | 값 |
|---|---|
| `--leading-tight` | 1.25(큰 숫자) 단, `--text-caption`은 1.33 |
| `--leading-snug` | 1.35 |
| `--leading-normal` | 1.5(본문) |
| `--weight-regular` / `-medium` / `-semibold` / `-bold` | 400 / 500 / 600 / 700 (기존 `--font-weight-bold`와 같은 700) |
| `--tracking-tight` | -0.01em(제목·큰 숫자). 본문은 0 |

- 24px 이상(`--text-heading` 이상)은 "큰 글자"라 3:1이 기준이지만, 이 화면은 모든 글자에 4.5:1을 적용한다.
- 기존 역할 토큰(`--font-size-body` 등 px)은 캘린더 화면용으로 그대로 둔다. `/car` 컴포넌트는 위 `--text-*`만 쓴다. 두 체계를 한 컴포넌트에 섞지 않는다.

## 3. 간격·크기·선·모서리

### 3.1 간격 (신규, 4px 단위)

| 토큰 | px | 쓰임 |
|---|---|---|
| `--space-1` | 4 | 아이콘과 글자 사이, 배지 위아래 안쪽 |
| `--space-2` | 8 | 한 줄 안 요소 사이, 버튼 안 가로 안쪽(작은 버튼 없음), 탭 여백 여유 |
| `--space-3` | 12 | 행 위아래 안쪽, 입력 칸 사이 작은 틈 |
| `--space-4` | 16 | 화면 좌우 여백(320px), 카드 안쪽, 입력 칸 사이 |
| `--space-5` | 24 | 구획(H3) 사이, 대화상자 안쪽(모달) |
| `--space-6` | 32 | 큰 구획 사이, 빈 상태 위아래 |
| `--space-7` | 48 | 빈 상태·오류 상태 위 여백 |
| `--space-8` | 64 | 화면 아래 여유 |

- 4의 배수가 아닌 값(5px, 10px 등)을 쓰지 않는다. 1px·2px·3px 선 굵기는 3.3에서 따로 이름을 붙였다.

### 3.2 크기 (신규)

| 토큰 | 값 | 의미 |
|---|---|---|
| `--target-min` | 44px | 터치 환경 버튼·행·입력 칸의 최소 높이. 파일철 탭은 5장 예외 |
| `--tab-mobile-w` / `--tab-mobile-h` | 28px / 56px | 모바일(≤899px, 또는 높이 500px 이하 터치 가로) 파일철 탭 한 개. screens.md 4.1과 같음 |
| `--tab-desktop-w` / `--tab-desktop-h` | 32px / 96px | 데스크톱(≥900px) 파일철 탭 한 개 |
| `--tab-center-mobile` / `--tab-center-desktop` | 40% / 50% | 묶음 세로 중심 위치(뷰포트 높이 기준) |
| `--tab-gutter` | 모바일 36px(= 28 + 8), 데스크톱 40px(= 32 + 8) | `/car` 본문 오른쪽 여백 |
| `--tab-inset` | 0px (대안 배치 12px) | 오른쪽 끝에서 띄우는 거리. 4.4 대안을 쓸 때만 12px |
| `--car-content-max` | 640px(≥600px) / 880px(≥1024px) / 960px(≥1280px) | 본문 최대 폭 |
| `--dialog-modal-w` | 480px | ≥900px 가운데 모달 폭 |
| `--dialog-sheet-max` | 560px | 768px 부근 시트 최대 폭(가운데 정렬) |
| `--badge-h` | 24px | 상태 배지 높이 |
| `--icon-sm` / `--icon-md` | 16px / 20px | 아이콘 크기 |
| `--field-h` | 44px | 입력 칸 높이(`--target-min`과 같음) |
| `--z-tab` | 60 | 파일철 탭 층. 기존 `--z-fab`(50) 위, `--z-overlay`(100) 아래 |

### 3.3 선 굵기·모서리·반응형 경계

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--line-thin` | 1px | 평소 테두리 |
| `--line-medium` | 2px | 포커스 외곽선, 오류 입력 테두리 |
| `--line-thick` | 3px | 선택된 하위 탭 밑줄 |
| `--line-accent` | 4px | 선택된 파일철 탭 왼쪽 막대 |
| `--focus-offset` | 2px | 포커스 외곽선 간격 |
| `--radius-control` / `-card` / `-overlay` / `-pill` | 8 / 12 / 16 / 999 (기존) | 버튼·입력 / 카드·행 / 모달·시트 위 모서리 / 배지 |

반응형 경계(CSS 변수로 쓸 수 없어 미디어 쿼리 값으로만 존재)

| 이름 | 쿼리 | 바뀌는 것 |
|---|---|---|
| 모바일 | `(max-width: 899px), (max-height: 500px) and (pointer: coarse)` | 기존 캘린더와 같음. 탭 28×56, 시트, 카드형 |
| 데스크톱 | `(min-width: 900px)` | 탭 32×96, 가운데 모달 |
| 표형 | `(min-width: 1024px)` | 기록·교체 목록이 표형, 차량 영역 가로 배치, 통계 2열 |
| 본문 폭 | `(min-width: 600px)`, `(min-width: 1280px)` | `--car-content-max` 단계 |

## 4. 그림자·모션·재질

### 4.1 그림자 (sm / md / lg, 신규 별칭)

| 토큰 | 라이트 | 다크 | ZIGZAG | 쓰는 곳 |
|---|---|---|---|---|
| `--shadow-sm` | `--shadow-indicator` (0 1px 2px 검정 12%) | 없음 | 없음 | 선택된 세그먼트처럼 작게 떠 있는 면. 차계부에서는 쓰지 않아도 됨 |
| `--shadow-md` | `--shadow-overlay` | 0 8px 24px 검정 50% | 없음 | 하단 시트, 토스트 |
| `--shadow-lg` | 0 12px 32px 검정 16% | 0 16px 40px 검정 60% | 없음 | 가운데 모달(≥900px) |

- 목록 행·카드·탭은 그림자를 쓰지 않는다(평평한 면 + 1px 선). 기존 앱의 원칙(그림자는 오버레이에만)을 따른다.
- 다크와 ZIGZAG에서 그림자가 없으면 `--border-overlay`(기존)로 층을 구분한다.

### 4.2 전환 시간 (신규)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--dur-fast` | 150ms (= 기존 `--dur-hover`) | hover·포커스·탭 선택 색 바뀜 |
| `--dur-base` | 300ms | 시트 올라옴, 모달 나타남, 스크림 |
| `--dur-slow` | 500ms | 뼈대 반짝임 한 번(반복 주기는 1500ms) |
| `--ease-out` | cubic-bezier(0.2, 0.8, 0.2, 1) (기존) | 전체 공통 |

- 누르는 순간 눌림 효과는 기존 `--dur-press-in`(60ms), `--dur-press-out`(220ms), `--press-scale`(0.96)를 그대로 쓴다.

### 4.3 동작 줄이기·투명도 줄이기·고대비·강제색

| 설정 | 규칙 |
|---|---|
| `prefers-reduced-motion: reduce` | 모든 전환 시간을 0ms로 한다(`--dur-fast/base/slow` = 0ms). 시트·모달은 위치 이동 없이 즉시 나타난다. 뼈대 반짝임 애니메이션 없음(정지 면). 눌림 크기 변화(`--press-scale`) 없음. 색 바뀜은 즉시 |
| `prefers-reduced-transparency: reduce` | 기존 `--material-bar`가 불투명으로 바뀌는 규칙 그대로. 스크림은 반투명 유지(가림막 기능) |
| `prefers-contrast: more` | 기존 규칙(`--color-hairline`·`--color-control-border`·`--color-secondary` 진하게)을 따른다. 신규 `-text` 토큰은 이미 4.5:1 이상이라 바꾸지 않는다. 배지·안내 상자 테두리는 1px에서 2px로 |
| `forced-colors: active` | components.md 10장 참고. 시스템 색(`Canvas`, `CanvasText`, `Highlight`, `HighlightText`, `ButtonText`, `GrayText`, `LinkText`)만 쓴다. 면 색 정보는 사라지므로 테두리·글자·아이콘 모양이 단서를 맡는다 |

## 5. 접근성 수치 한눈에

| 항목 | 기준 | 이 설계의 값 |
|---|---|---|
| 본문 글자 대비 | 4.5:1 | 최저 4.67(`--color-danger` / `--color-subtle`), 대부분 5 이상 |
| 큰 글자 대비 | 3:1 | 24px 이상도 4.5:1 적용 |
| 비텍스트 대비(테두리·아이콘·포커스) | 3:1 | 입력 테두리 3.20, 포커스 4.83, 아이콘 3.94 이상 |
| 터치 영역 | 44px | 버튼·행·입력 칸 44px 이상. 예외: 파일철 탭 28×56 / 32×96(아래) |
| 포커스 | 2px 외곽선 | `--line-medium` + `--focus-offset` 2px, 색 `--color-focus` |
| 확대 | 200%에서 깨지지 않기 | 글자 rem, 높이는 `min-height`, 줄바꿈 허용. 가로 스크롤 없음. 예외: 모바일 파일철 탭 글자(아래) |
| 동작 줄이기 | 존중 | 4.3 |

### 파일철 탭 예외 두 건 (PO 수락 2026-11-05, 조건: 200% 확대에서 글자 안 잘림 · 탭마다 접근 가능한 이름)

1. **44px 규칙**: 탭 터치 영역은 UX가 PRD R-14 조건 4(24×44px 이상)와 screens.md 4.1에 맞춰 28×56(모바일)·32×96(데스크톱)으로 정했고 보이지 않는 확장 영역은 금지됐다. 긴 쪽은 44px 이상이지만 모바일 짧은 쪽(28px)은 44px 미만이다. WCAG 2.2 SC 2.5.8(최소 24×24px)은 충족한다. 44px 규칙 위반을 조건 4가 허용하는 범위로 기록한다.
2. **글자 확대**: 모바일 탭은 크기가 px로 고정(28×56)이라 글자를 rem으로 두면 안드로이드 글자 크기 200%에서 3글자(`차계부`)가 56px를 넘는다(12px×2×3 = 72px). 그래서 모바일 탭 글자는 `12px` 고정(5장 예외), 데스크톱 탭 글자는 `--text-body`(rem)이고 96px 안(안쪽 여백 8px씩 뺀 80px)에 약 190%까지 들어간다. 브라우저 확대(Ctrl +)는 모든 길이가 함께 커지므로 영향 없다. 모바일 탭 글자는 화면낭독기 이름(`차계부`)과 같아서 정보는 잃지 않는다.

## 6. Frontend 추가 위치

`src/styles/tokens.css`에 다음 순서로 추가한다. 이 문서의 이름·값이 기준이다.

1. `:root`: 1.1 팔레트, 1.2 라이트 값, 2장, 3장, 4.1~4.2.
2. `:root:where([data-scheme='dark'])`: 1.2 다크 값, `--shadow-md/lg` 다크 값.
3. `:root:where([data-theme='zigzag'])`: `--shadow-md/lg: none`. 라운드는 기존 토큰이 0이라 신규 토큰이 `--radius-*`를 쓰는 한 자동으로 따른다.
4. `@media (prefers-reduced-motion: reduce)`: 4.3.
5. `@media (prefers-contrast: more)`: 배지·안내 상자 테두리 2px.

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | UX Designer 요청 conv-8c399a(MPR-1~16) | UX Designer | 신규 토큰만 추가. 기존 캘린더 토큰·화면 불변 |
