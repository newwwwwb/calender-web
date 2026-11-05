# 기술 조사 — 차계부 (T-1 ~ T-4)

- 날짜: 2026-11-05 · 작성: Tech Researcher · 최종 결정: Software Architect
- 요구 원본: `docs/00_brief.md`, `docs/superpowers/specs/2026-11-05-carbook-design.md`
- T-5(번호판 조회, 다음 버전용)는 [plate-lookup.md](plate-lookup.md)로 분리.
- 확인 방법 표기: **코드** = 저장소 파일을 직접 읽음, **실측** = 명령을 실행한 결과, **미확인** = 확인 못 함.
- 별도 스파이크(실행 예제)는 만들지 않았다. 근거는 코드 읽기와 배포 주소 요청(실측)뿐이다.

## 요약 (권장안)

| ID | 결론 |
|---|---|
| T-1 | 배포(Vercel)는 `/car` 새로고침이 이미 된다(실측). 코드에는 `popstate` 처리가 없어 직접 만들어야 한다. 경로를 상태로 들고 `pushState` + `popstate`로 갱신하는 작은 훅을 권장. |
| T-2 | 캘린더는 실시간 구독이 없고 60초 폴링·포커스·가시성 복귀 때만 다시 불러온다. `CalendarProvider`를 `/car`에서도 유지하고 차계부가 `useCalendar().reload()`를 부르면 캘린더 코드 수정 없이 즉시 반영된다. |
| T-3 | `events.id`는 클라이언트가 만드는 uuid다. 일정 id를 먼저 정해 `upsert`하면 중복이 생기지 않는다. 존재 확인은 `id in (...)` 조회 한 번이다. |
| T-4 | 오른쪽 가장자리에는 이미 모바일 새 일정 버튼(FAB), 스와이프 영역, 시스템 제스처가 있다. 모바일은 세로 탭 대신 하단 막대를 권장. |

---

## T-1. `/car` 주소, 뒤로·앞으로 가기, 새로고침

### 답
- **SPA 폴백(새로고침)**: 된다. `vercel.json`에 `rewrites: /(.*) → /index.html`이 있다(코드: `vercel.json`, 도입 커밋 a74f633). 배포 주소 요청 결과(실측, 2026-11-05):
  - `GET https://calender-web-ten.vercel.app/car` → 200 `text/html`
  - `GET https://calender-web-ten.vercel.app/car/` → 200 `text/html`
  - 개발 서버(`vite`)와 `vite preview`는 기본이 SPA 폴백이고 `vite.config.ts`에 `appType` 지정이 없다(코드). 직접 실행하지는 않았다 → 미확인.
- **뒤로·앞으로 가기**: 지금 코드에는 없다. `src`에서 `popstate`, `pushState`, `replaceState`를 검색하면 테스트 파일(`App.test.tsx`)에서 `pushState`만 나온다(코드). `App()`은 렌더 때 `window.location.pathname`을 한 번 읽을 뿐이라, 주소가 바뀌어도 다시 그려지지 않는다.

### 구현 시 주의점
1. `history.pushState`는 `popstate`를 일으키지 않는다. 탭 클릭에서는 `pushState` 후 상태를 직접 갱신하고, 뒤로·앞으로는 `window.addEventListener('popstate', …)`로 받는다.
2. 경로를 React 상태로 들고(`useState(() => location.pathname)`), 비교는 `/car`와 `/car/`를 같게 본다. 배포가 둘 다 200을 주므로 사용자가 둘 다 칠 수 있다.
3. 분기 순서는 `/share/:id`(기존), `/car`, 나머지는 캘린더. 알 수 없는 경로는 지금처럼 캘린더로 보인다(기존 동작 유지).
4. 탭은 `<a href="/car">`로 만들고 클릭에서 `preventDefault` 후 `pushState`한다. 그래야 새 탭 열기·링크 복사가 된다. Ctrl/Cmd/Shift 클릭과 가운데 클릭은 브라우저에 넘긴다.
5. **로그인 복귀**: `signInWithGoogle()`을 `redirectTo` 없이 부르면 Supabase 기본 Site URL(`/`)로 돌아온다(코드: `useAuth.ts`, 기록: `context-notes.md` 139행). `/car`의 로그인 버튼은 `signInWithGoogle(window.location.href)`로 불러야 `/car`로 돌아온다. 공유 수락 화면이 이미 같은 방식을 쓴다(코드: `AcceptSharePage.tsx:61`). `/car`가 Supabase 허용 목록(Redirect URLs)에 들어 있는지는 확인하지 못했다 → **미확인**(배포 전 대시보드 확인).
6. 바탕화면 위젯은 `?widget=1`과 sessionStorage로 판별한다(코드: `widgetMode.ts`). 탭 이동에서 쿼리가 사라져도 sessionStorage가 이어 준다. 위젯에서 탭을 보일지는 PO 결정(Q6).
7. 새 빌드가 배포되면 열려 있던 탭이 옛 청크 주소를 요청하는데, 배포는 없는 파일에도 `index.html`을 200으로 준다(실측: `/assets/nonexistent.js` → 200 `text/html`). 차계부를 `React.lazy`로 나누면 오래 켜 둔 탭에서 동적 import가 실패할 수 있다. 처음부터 번들에 넣는 쪽이 안전하다.

### 위험과 권장안
- 위험: 낮음. 권장: `usePathname()`과 `navigate(path)` 훅을 `src/carbook/`에 두고 `App.tsx`에서 분기. 라이브러리 추가 없음(제약 충족).
- 테스트: 기존 방식 `window.history.pushState({}, '', '/car')` 후 렌더(코드: `App.test.tsx:11,22`)가 jsdom에서 그대로 된다.

---

## T-2. `events`·`categories` 직접 쓰기와 캘린더 반영

### 기존 테이블 (코드: `supabase/schema.sql`, `schema_together*.sql`, `src/storage/supabaseRepository.ts`)
- `events`: `id uuid PK`(**기본값 없음, 클라이언트가 만든다**), `user_id`, `title`, `memo`, `category_id → categories(id) on delete set null`, `color`, `all_day`, `start_at text`, `end_at text`(`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm` 문자열), `recurrence jsonb`, `excluded_dates text[]`.
- `categories`: `id uuid PK`(클라이언트가 만든다), `user_id`, `name`, `color`. **이름 유일 제약이 없다.**
- RLS: 두 테이블 모두 select/insert/update/delete가 `auth.uid() = user_id`. select는 추가로 공유 파트너(`is_share_partner`)와 참여자에게도 열려 있다.
- 종일 일정: `all_day=true`, `start_at`·`end_at`은 날짜 문자열. 단일 날짜는 `end_at = start_at`으로 읽힌다(코드: `EventEditor.tsx` 285~291행). 구현 때 에디터가 만든 단일 종일 일정 행과 같은 모양인지 대조할 것 → 미확인(실행 안 함).

### 캘린더가 새 일정을 반영하는 방식 (코드: `src/state/useCalendar.tsx`)
- **실시간 구독 없음.** `src`에서 `channel`, `postgres_changes`, `realtime` 검색 결과가 없고, 파일 주석에도 "Realtime은 쓰지 않는다"고 적혀 있다.
- 다시 불러오는 때: 60초마다(`REFRESH_MS = 60_000`), 창 포커스, 탭이 다시 보일 때, 앱 안 쓰기 직후의 `reload()`.
- `reload`는 컨텍스트로 노출된다(`CalendarContextValue.reload`). 오래된 응답은 순번(`reloadSeqRef`, `appliedSeqRef`)으로 버리므로 차계부가 호출해도 충돌하지 않는다.

### 선택지
| 방식 | 반영 속도 | 캘린더 코드 수정 | 비고 |
|---|---|---|---|
| A. `CalendarProvider`를 `/car`에서도 유지하고, 차계부에서 `useCalendar().reload()` 호출 (권장) | 즉시 | 없음(훅을 읽기만 함) | 보기·선택일 상태가 `/car`를 다녀와도 유지된다. `<CalendarProvider>` 안에서 `path === '/car' ? <CarbookApp/> : <CalendarApp/>` |
| B. `/car`에서 Provider가 언마운트됨 | `/`로 돌아올 때 최초 로드 | 없음 | 보기·선택일이 초기화된다(상태가 Provider 안에 있음) |
| C. Supabase Realtime 도입 | 빠름 | 필요 | AC-2와 충돌 → 제외 |
| D. 60초 폴링에만 의존 | 최대 60초 지연 | 없음 | 방금 만든 일정이 안 보임 → 제외 |

### 충돌 위험 (코드로 확인)
1. **키보드 단축키 누수**: `useKeyboardShortcuts`는 `window`에 `keydown`을 건다. `/car`에서도 `CalendarApp`이 마운트돼 있으면 `n`, `t`, `m`, `/` 같은 한 글자 키가 차계부 화면 뒤에서 동작한다. 입력창과 열린 `[role=dialog]`에서는 막히지만, 버튼·목록에 포커스가 있으면 동작한다(코드: `useKeyboardShortcuts.ts`). 해결: 방식 A처럼 `/car`에서는 **`CalendarApp`을 렌더하지 않고 Provider만 유지**한다.
2. **알림 트리거**: `events_notify_updated`·`events_notify_deleted`의 수신자는 참여자와 "작성자가 아닌 소유자"다. 차계부 일정은 참여자가 없고 작성자가 소유자라 알림이 생기지 않는다(코드: `schema_together_notifications.sql` 66~155행). 문제 없음.
3. **`events_lock_identity` 트리거**: update 때 `id`·`user_id`를 고정한다. 소유자 본인은 `category_id`·`color`를 바꿀 수 있다(코드: `schema_together.sql` 99~115행). 문제 없음.
4. **공유 상대에게 노출(제품 위험)**: `events_select_shared`·`categories_select_shared`가 `is_share_partner`로 열려 있어, 캘린더를 공유한 상대는 차계부가 만든 일정(`[내 차] 보험 만기` 등)과 '차계부' 카테고리를 그대로 본다(코드: `schema_share_mutual.sql`). 원본은 "차량을 공유하지 않는다"이지만 캘린더 일정으로 넣는 이상 공유 상대에게는 보인다. **PO 판단 필요(Q1).**
5. **카테고리 삭제**: 사용자가 '차계부' 카테고리를 지우면 `events.category_id`가 null이 된다(`on delete set null`). 일정은 `event_id`로 찾으므로 연결은 끊기지 않고, 색·분류만 사라진다. 이후 차계부는 이름으로 찾아 새로 만든다.
6. **카테고리 이중 생성**: 이름 유일 제약이 없어서 두 탭에서 동시에 처음 열면 '차계부'가 둘 생길 수 있다.

| 카테고리 중복 방지 | 장점 | 단점 |
|---|---|---|
| 사용자별 고정 uuid로 `upsert(..., { ignoreDuplicates: true })` | 중복이 없다 | 고정 uuid 생성 규칙이 필요하다(해시에서 uuid 만들기, 새 의존성 없이 `crypto.subtle`로 가능). 사용자가 이미 같은 이름을 직접 만들었다면 이름 찾기를 먼저 해야 한다 |
| `schema_carbook.sql`에 `create unique index on categories (user_id, name) where name = '차계부'` | DB가 보장한다 | 기존 `categories`에 인덱스를 더한다(새 파일에만 쓰므로 "기존 스키마 파일 불변"은 지킴). 이미 같은 이름이 둘 이상 있으면 실행 실패 |
| 이름으로 찾고 없으면 만들기(원본 6장) | 스키마 변경 없음 | 경쟁 조건에서 중복이 남을 수 있다 |

### 권장안
방식 A. 차계부는 `useCalendar()`에서 `reload`와 `currentUserId`를 읽고, 일정 쓰기가 끝나면 `reload()`를 부른다. `supabase` 클라이언트는 `src/lib/supabaseClient.ts`의 것을 그대로 쓴다. 카테고리는 "이름으로 찾기 → 없으면 만들기"에 더해 중복 방지 표의 한 가지를 Architect가 고른다.

### 미확인
- 실제 DB에서 `upsert`(= `insert … on conflict (id) do update`)가 위 RLS·트리거를 통과하는지는 실행하지 못했다(`.env.local`을 열지 않음). 정책상 insert·update가 모두 `auth.uid() = user_id`라 통과해야 하지만 구현 단계의 통합 확인이 필요하다.

---

## T-3. `event_id` 참조(FK 없음): 삭제 감지·재생성·중복 방지

### 전제 (코드)
- `events.id`는 클라이언트가 만든다(`crypto.randomUUID()`, `EventEditor.tsx:251,314`). 차계부도 일정 id를 **저장 전에** 정할 수 있다.
- FK가 없으면 캘린더에서 일정을 지워도 차계부 행에는 `event_id`가 그대로 남는다. 존재 여부는 조회로만 안다.

### 권장 절차
1. **저장 순서**: ① 일정 id를 클라이언트에서 먼저 만든다 → ② `events`에 `upsert({ id, … })` → ③ 성공하면 차계부 행에 `event_id` 저장. ③이 실패해도 다음 시도가 **같은 id**로 upsert하므로 중복이 생기지 않는다. 핵심은 "id를 먼저 정하고 upsert"다.
2. **id 공간 분리**: 차계부 행의 id와 일정 id를 같게 쓰지 않는다. 별도 uuid를 `event_id`에 저장한다.
3. **차계부를 열 때 점검(AC-9)**: `event_id`가 있는 모든 행을 모아 한 번에 조회한다.
   `supabase.from('events').select('id').in('id', ids).eq('user_id', userId)`
   결과에 없는 `event_id`만 재생성한다(1번과 같은 upsert, **같은 id 재사용**). `.eq('user_id', …)`는 공유 상대의 일정이 select에 섞이는 경우를 막는다(코드: `schema_share_mutual.sql`).
4. **두 탭 동시 실행**: 둘 다 같은 id로 upsert하므로 행은 하나다. 마지막 쓰기가 남지만 내용이 같다.
5. **계산 불가 상태**: 다음 교체일을 계산할 수 없으면 일정을 만들지 않는다(원본 6장). 이미 있던 일정을 지울지는 원본에 없다 → Q3. 권장: 지운다(틀린 날짜가 캘린더에 남는 것보다 낫다).
6. **삭제 순서**: 연결 일정을 먼저 지우고 행을 지운다. 일정 삭제가 실패하면 행을 남겨 재시도할 수 있다. 반대로 하면 고아 일정이 캘린더에 남는다. **차량 삭제**는 `on delete cascade`가 행을 한꺼번에 지우므로, 삭제 전에 그 차량의 `event_id`들을 읽어 `delete … in (ids)`를 먼저 해야 한다. DB 트리거로 처리하는 방법도 있으나 `security definer` 함수가 필요해 복잡도가 커서 비권장.
7. **캘린더에서 사용자가 연결 일정의 제목·날짜를 고친 경우**: 차계부가 다음에 저장할 때 덮어쓴다. 원본에 규정이 없다 → Q2. 권장: 덮어쓰기 허용.
8. **대안 — FK 사용**: 새 테이블 쪽에 `event_id uuid references public.events (id) on delete set null`을 선언하면, 캘린더에서 지운 일정이 곧바로 `event_id is null`로 드러나 3번 점검이 단순해진다. 새 테이블에만 선언하므로 "기존 스키마 파일 불변"은 지킨다. 원본 4장은 FK 없음을 전제하므로 Architect가 결정한다(Q4). 이 경우에도 순서는 ① 일정 upsert → ② 행 저장이어야 한다(1번과 같음).

### 위험과 권장안
- 위험: 중간. 권장: 1·3번(id 선행 생성 + `in` 조회 + 같은 id upsert). 대안은 8번.
- 미확인: `in()` 목록 길이 한계(주소 길이). 차량당 항목이 수십 개라 문제없을 것으로 보지만, 수백 개를 넘으면 나눠서 조회해야 한다.

---

## T-4. 오른쪽 고정 세로 탭: 겹침과 접근성

### 기존 레이아웃 (코드: `App.module.css`, `Overlay.module.css`, `Header.module.css`, `index.html`)
- `.app`: `display: flex; height: 100dvh; overflow: hidden;` 좌우 `env(safe-area-inset-*)` padding.
- 모바일(≤899px 또는 낮은 터치 가로 화면)과 900~1023px에서 **새 일정 FAB**가 `position: fixed; right: 20px; bottom: calc(20px + safe-area)`로 이미 오른쪽 아래에 있다. 크기 `--fab-size: 52px`.
- z-index 단계: `--z-sticky 10`, `--z-now 20`, `--z-fab 50`, `--z-overlay 100`, `--z-fullscreen 200`, `--z-toast 300`.
- 모바일 `.main`은 `padding: 0`이라 월 그리드가 오른쪽 끝까지 닿는다.
- `SwipeableViewport`가 터치·펜 가로 스와이프로 기간을 넘긴다(코드: `SwipeableViewport.tsx`). 오른쪽 끝에서 시작한 터치와 겹칠 수 있다.
- `index.html`에 `viewport-fit=cover`가 있어 `env(safe-area-inset-*)`가 실제 값을 갖는다.

### 위험과 대응
| 위험 | 근거 | 대응 |
|---|---|---|
| 모바일 FAB과 겹침 | FAB이 오른쪽 20px, 아래 20px | 세로 중앙에 두면 FAB과는 안 겹치나 아래 항목들과 부딪힌다. 모바일은 하단 막대로 대체 권장 |
| 콘텐츠 가림 | 월·주 그리드가 오른쪽 끝까지 닿음 | 폭을 24~32px로 작게 하고 그리드 마지막 열의 일부를 가리는 것을 허용할지 PO가 정한다. 여백을 더해 밀어내면 AC-2("배치 불변")와 충돌 |
| 터치 목표 크기 | 저장소가 `pointer: coarse`에서 큰 목표를 쓰는 패턴 | 터치에서 높이 44px 이상(WCAG 2.5.8 최소는 24px) |
| 시스템 가장자리 제스처 | 모바일 브라우저의 오른쪽 가장자리 동작과 겹칠 수 있음 | 실기기 동작은 **미확인**. iOS Safari, Android Chrome 확인 필요 |
| 세이프에어리어 | `viewport-fit=cover` | `right: env(safe-area-inset-right)`를 직접 처리 |
| 모달·토스트와의 층 | 오버레이 100, 전체화면 200, 토스트 300 | 탭 z-index는 50(FAB)~100(오버레이) 사이(예: 60) |
| 모달 열림 중 포커스 | `Overlay.tsx`가 배경을 `inert`/`aria-hidden` 처리하는지 확인하지 못함 | **미확인**. 구현 전에 `Overlay.tsx`를 확인 |
| 키보드·스크린리더 | 건너뛰기 링크와 `<main id="main-content">`가 있고 h1은 `App.tsx`의 `sr-only` 하나 | `<nav aria-label="화면 전환">` 안에 링크 두 개, 현재 화면에 `aria-current="page"`, DOM 순서는 본문 뒤. `/car`에서도 h1은 하나. 화면 전환 후 포커스를 새 화면의 `main`으로 옮기고 기존 `aria-live` 안내를 재사용 |
| 세로 글자 | `writing-mode: vertical-rl`은 한글이 눕거나 세워져 읽기 어색할 수 있음 | 글자를 가로로 두고 회전(`rotate`)하거나 아이콘+짧은 글자 사용. 화면낭독기 읽기에는 영향 없음 |
| 대비·강제색 | `prefers-contrast`, `forced-colors` 대응이 기존 코드에 있음(`Header.module.css`, `MonthView.module.css`) | 선택된 탭을 색만이 아니라 모양(튀어나옴, 굵기)으로도 구분. 강제색에서 테두리 유지 |
| 모션 | `useReducedMotion` 사용 중 | "튀어나오는" 전환은 reduced-motion이면 즉시 |
| 바탕화면 위젯 | 창 최소 400px | 위젯에서 탭을 숨길지 PO가 정한다(Q6) |

### 권장안
- 데스크톱(≥900px): 오른쪽 가장자리 고정 세로 탭, 폭 28~32px, 세로 중앙 근처, z-index 60, 캘린더 레이아웃에는 여백을 더하지 않는다.
- 모바일(≤899px): 세로 탭이 FAB·스와이프·가장자리 제스처와 겹치므로 하단 막대 또는 FAB 위쪽 배치를 PO에 제안한다. 원본 3.1은 모바일을 따로 말하지 않는다(Q6).
- 위험: 중간. 겹침은 화면에서만 닫을 수 있는데 이번 조사에서는 렌더해 보지 않았다 → **미확인**.

---

## 열린 질문 (결정 요청)
| # | 질문 | 결정자 | 권장 |
|---|---|---|---|
| Q1 | 캘린더 공유 상대에게 차계부 일정이 보여도 되는가 (T-2-4) | Product Owner | 허용하고 안내하거나, 제목에서 번호판·민감 정보를 뺀다 |
| Q2 | 사용자가 캘린더에서 연결 일정을 고쳤을 때 차계부 저장이 덮어써도 되는가 (T-3-7) | Product Owner | 덮어쓰기 허용 |
| Q3 | 계산 불가가 된 항목의 기존 일정을 지울까 (T-3-5) | Software Architect | 지운다 |
| Q4 | `event_id`에 FK(`on delete set null`)를 쓸까 (T-3-8) | Software Architect | FK 없이도 가능하나 FK가 단순하다 |
| Q5 | 카테고리 중복 방지 방법 (T-2 표) | Software Architect | 고정 id + upsert 또는 유일 인덱스 |
| Q6 | 모바일 탭 배치와 위젯 표시 (T-4) | Product Owner | 모바일 하단 막대, 위젯 숨김 |

## 출처
- 저장소(코드): `vercel.json`, `index.html`, `src/App.tsx`, `src/state/useCalendar.tsx`, `src/state/useKeyboardShortcuts.ts`, `src/state/useAuth.ts`, `src/state/widgetMode.ts`, `src/storage/supabaseRepository.ts`, `src/components/App.module.css`, `src/components/EventEditor.tsx`, `supabase/schema.sql`, `supabase/schema_together.sql`, `supabase/schema_together_notifications.sql`, `supabase/schema_share_mutual.sql`, `context-notes.md`
- 실측(2026-11-05): `curl`로 `https://calender-web-ten.vercel.app/`, `/car`, `/car/`, `/assets/nonexistent.js` 요청. 네 건 모두 200 `text/html`.
- 패키지: `@supabase/supabase-js` 최신 2.119.0, 수정일 2026-11-04(`npm view`, 2026-11-05). 저장소 고정은 `^2.116.0`.
