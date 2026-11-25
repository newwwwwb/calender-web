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


---
---

# v0.2 기술 조사 — 차계부 계정 영역 (VT-1 ~ VT-5)

- 날짜: 2026-11-21 · 작성: Tech Researcher · 최종 결정: Software Architect
- 요구 원본: `docs/00_brief.md` 'v0.2 Brief'(확정 범위), `docs/release/verdict.md` 5장
- 조건: 캘린더 화면·`useCalendar` 코드 불변(예외 1건 `Overlay.tsx`는 이미 반영), 새 앱 의존성 없음.
- 표기: **코드** = 저장소 파일을 직접 읽음, **문서** = 공식 문서를 열어 확인, **QA 기록** = `docs/qa/report.md`의 측정값, **미확인** = 확인 못 함.
- 이번에도 별도 스파이크는 돌리지 않았다. 실제 로그인·브라우저 측정이 필요한 항목은 "확인 방법"을 적었다.

## v0.2 요약 (권장안)

| ID | 결론 |
|---|---|
| VT-1 | 이름·사진은 `user.user_metadata`에서 읽는다(`full_name`/`name`, `avatar_url`/`picture`). 다만 공식 문서에 Google 필드 목록이 없어 **실제 로그인으로 한 번 확인**해야 한다. 사진은 `<img referrerPolicy="no-referrer">`로 그리고, 로드 실패·값 없음이면 이름 첫 글자 원형으로 대체한다. URL은 DB에 저장하지 않는다. |
| VT-2 | `useAuth().signOut`을 그대로 재사용하면 된다(공유 파일 수정 0줄). `AuthButton`은 그대로 쓰기 어렵다(헤더용 스타일, `window.confirm`, 계정 표시 없음). `/car`에서 로그아웃하면 차계부는 로그인 안내로 바뀌고, 캘린더는 이 기기의 로컬 일정으로 바뀐다. 공식 기본값이 `global`이라 **다른 기기·브라우저 세션도 끊긴다.** |
| VT-3 | 새 테이블 `car_settings`(사용자당 1행, `default_vehicle_id … on delete set null`)를 새 SQL 파일로 추가하는 안을 권장. 기기 간 유지, 차량 삭제 자동 처리, RLS 단순. 스키마 변경 없이 하려면 `localStorage`(기기별)가 가장 안전하다. |
| VT-4 | 이름이 추천 7개와 같은 항목의 **주기만** 기본값으로 되돌리고, 지운 추천 항목은 다시 만든다. 마지막 교체일·주행거리·연결 일정 id는 건드리지 않는다. 한 번의 `upsert`로 쓰고 기존 `syncLinked`로 일정을 맞춘다. 전부 지우고 다시 만들기는 비권장. |
| VT-5 | ①AC-04-9는 코드 수정 없이 기존 QA 스크립트로 30회 이상·여러 세트 재측정. ②버튼 줄바꿈은 CSS 약 10줄. ③포커스는 `DueDatesTab.tsx` 약 10~15줄. 원인 ③은 가설이라 측정으로 먼저 확인. |

---

## VT-1. Google 로그인 프로필(사진·이름) 읽기, 실패 처리, 개인정보

### 답 (필드)
- 지금 코드는 `user_metadata`를 한 번도 읽지 않는다(코드: `src`에서 `user_metadata`, `avatar_url`, `picture` 검색 결과 0건). 계정 정보는 `useAuth()`가 돌려주는 `user`(Supabase `User`)에서 읽으면 된다(코드: `src/state/useAuth.ts`).
- Supabase 문서: 소셜 로그인 사용자의 `user_metadata`는 `auth.users.raw_user_meta_data`에 대응하고, 공급자가 준 정보는 `identities[].identity_data`에도 있다. 이름·사진 키로 예제들이 쓰는 것은 `full_name`, `avatar_url`이다(2차 출처: 커뮤니티 예제, Supabase OAuth 가이드 사본).
- **공식 Google 가이드(`https://supabase.com/docs/guides/auth/social-login/auth-google.md`, 2026-11-21 열람)에는 `avatar_url`, `picture`, `full_name`, `user_metadata` 중 어느 것도 나오지 않는다.** 필드 목록은 공식 문서로 확인하지 못했다 → **미확인**.
- 그래서 읽는 쪽을 느슨하게 만든다: 이름 = `full_name` → `name` → 이메일의 `@` 앞, 사진 = `avatar_url` → `picture`, 이메일 = `user.email`. `user_metadata`의 타입은 `{[key: string]: any}`라 `typeof v === 'string'`으로 좁힌다(코드 규칙, 타입 정의는 `@supabase/supabase-js` 기준 → 미확인: 설치본 타입을 열어 보지 않음).
- **확인 방법(1분)**: 개발자 도구 콘솔에서 로그인된 앱의 `JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('auth-token')))).user.user_metadata` 출력. 값은 개인정보이므로 문서에 붙이지 말고 키 이름만 기록한다.

### 값이 없거나 이미지가 안 뜰 때
| 상황 | 원인 후보 | 처리 |
|---|---|---|
| 필드 자체가 없음 | 공급자가 안 줌, 키 이름 차이 | 이름 첫 글자(없으면 이메일 첫 글자) 원형 아바타 |
| URL이 있는데 403 | Google 이미지 서버가 `Referer`에 따라 거부한다는 보고가 다수(StackOverflow 답변 여러 건, **Google 공식 확인 없음**) | `referrerPolicy="no-referrer"`가 해결책으로 가장 자주 나온다. `onError`에서 아바타로 대체 |
| URL이 만료·변경 | 사용자가 사진을 바꿨거나 접근이 끊김. "서명 URL이라 만료된다"는 주장은 저권위 출처 1건뿐 → **미확인** | 세션이 가진 값을 매번 그대로 쓰고 DB에는 복사하지 않는다. 실패하면 `onError`로 대체 |
| 네트워크 차단(사내망·광고 차단) | 이미지 호스트 차단 | 같은 `onError` |
| 느린 로딩 | 외부 호스트 | 원형 자리를 먼저 차지(폭·높이 고정)해 레이아웃이 움직이지 않게 |

- `onError`는 한 번만 처리한다(대체 후 다시 `src`를 바꾸지 않으면 반복되지 않는다).
- 크기: People API 문서에 `=s96-c`처럼 크기 접미사가 있다고 나오지만, 이 값을 조작하는 것은 이번에 확인하지 않았다 → 권장하지 않음. 표시 크기만 CSS로 정한다(32~40px).
- 형식 검사: `https:` 로 시작하는 문자열만 `src`에 넣는다(`data:`·`javascript:` 거부). `<img>`의 `src`는 스크립트를 실행하지 않지만 외부 호스트 임의 요청을 막는 안전장치다.

### 개인정보·참조 정보 위험
1. **`Referer` 노출**: 기본 정책에서 이미지 요청에 이 앱의 주소(출처)가 `lh3.googleusercontent.com` 쪽에 전달된다. 이미 로그인 공급자인 Google에게만 가는 정보지만 불필요하다. `referrerPolicy="no-referrer"`로 줄인다(요청한 쪽 IP·UA는 어차피 간다).
2. **저장 안 함**: URL·이름·이메일을 새 테이블이나 로그에 복사하지 않는다. 세션에서 읽어 화면에만 쓴다. 지금 `useAuth`의 `console.error`는 에러 객체만 찍는다(코드). 새 코드도 `user_metadata`를 콘솔에 찍지 않는다.
3. **화면 노출**: 이메일을 화면에 그대로 보이는 것은 요구 사항이다(확정 범위 포함 1). 긴 값은 말줄임(`text-overflow`)으로 줄이고 `title`로 전체를 준다.
4. **보안 헤더 없음**: `index.html`과 `vercel.json`에 CSP(콘텐츠 보안 정책)·`Referrer-Policy`가 없다(코드: 두 파일에서 `Content-Security-Policy`, `referrer` 검색 0건). 지금은 Google 이미지가 막히지 않는다. 나중에 CSP를 넣으면 `img-src https://lh3.googleusercontent.com`이 필요하다(주의 사항으로만 적는다).
5. **이름 표시 문자열**: Google 표시 이름은 외부 입력이다. React가 텍스트로 이스케이프하므로 `dangerouslySetInnerHTML` 없이 그대로 렌더하면 안전하다(저장소 감사 기록: `context-notes.md` 217행 "XSS 벡터 0건").
6. 접근성: 사진은 장식이므로 `alt=""`로 두고 이름 텍스트를 함께 보인다. 사진만 있는 버튼이면 `aria-label="계정, {이름}"`.

### 권장안 (VT-1)
작은 표시용 컴포넌트(약 40줄)가 `useAuth()`의 `user`만 받아 위 규칙으로 이름·사진·이메일을 계산하고, 순수 함수 `accountDisplay(user)`로 분리하면 단위 테스트가 쉽다(필드 누락·비문자열·`http:` 거부). 위험: 낮음. 남는 미확인: 실제 Google 로그인 결과의 키 이름.

---

## VT-2. 차계부에서 로그아웃: 기존 `useAuth`·`AuthButton` 재사용, 로그아웃 뒤 상태

### 재사용 가능 여부 (코드: `src/state/useAuth.ts`, `src/components/AuthButton.tsx`)
| 대상 | 가능? | 이유 |
|---|---|---|
| `useAuth()` | **가능, 수정 0줄** | 훅은 호출할 때마다 자기 상태와 `onAuthStateChange` 구독을 만든다. `CarbookApp`이 이미 호출 중(`CarbookApp.tsx`). `signOut()`은 `supabase.auth.signOut()`을 부른다 |
| `AuthButton` | 기술적으로 가능, **권장하지 않음** | ① 스타일이 `Header.module.css`의 `todayButton`(헤더 "오늘" 버튼 모양)이다 ② 로그인 상태면 텍스트 "로그아웃" 버튼만 보이고 계정 정보가 없다 ③ 확인에 `window.confirm`을 쓴다(차계부는 `Overlay` 기반 `ConfirmDialog`로 통일, `docs/02_architecture.md` 77행) ④ 확인 문구가 캘린더 중심("계정에 저장된 일정은…") ⑤ `loading` 동안 `null`을 돌려준다 |
| `ConfirmDialog`(차계부) | 가능 | `tone`, `title`, `message`, `confirmLabel` 속성이 있어 로그아웃 확인에 맞다(코드: `ConfirmDialog.tsx`). 단, 위 스펙상 `target`/`message` 중 하나가 필요하다 |

### 로그아웃 범위: 기본값이 `global`
- 공식 문서(`https://supabase.com/docs/guides/auth/signout.md`, 2026-11-21 열람): JavaScript SDK는 `global`이 기본이다. `global`은 그 사용자의 모든 기기·브라우저 세션의 refresh token을 끊고, 다른 세션은 다음 갱신 때 `Invalid Refresh Token`으로 실패한다. `{ scope: 'local' }`을 주면 현재 세션만 끊는다. `others`는 `SIGNED_OUT` 이벤트가 없다.
- 지금 캘린더의 로그아웃도 `signOut()`(인자 없음) → `global`이다(코드: `useAuth.ts`). 차계부가 같은 함수를 쓰면 동작이 캘린더와 같다.
- `local`로 바꾸려면 `useAuth.ts`를 고치거나(캘린더 로그아웃 동작도 바뀜) 차계부가 `supabase.auth.signOut({ scope: 'local' })`를 직접 호출해야 한다. 후자는 캘린더와 동작이 달라진다.
- 바탕화면 위젯(`?widget=1`)은 같은 브라우저 프로필이면 같은 세션을 쓴다(코드: `widgetMode.ts`는 표시만 함, 세션은 `supabase-js`가 `localStorage`에 보관 → 같은 출처·프로필이면 공유. 미확인: 위젯이 별도 프로필인지).

### `/car`에서 로그아웃하면 (코드로 따라간 결과)
| 대상 | 일어나는 일 |
|---|---|
| `CarbookApp` | `user`가 null이 되고 `loading`은 false라 `LoginGate`("로그인하면 사용할 수 있습니다"+로그인 버튼)로 바뀐다. 요청은 보내지 않는다(AC-02-1과 같은 경로, 코드: `CarbookApp.tsx`) |
| `useCarbook`/`CarbookData` | 언마운트되어 차량·기록·교체 항목·만기일 메모리 상태가 모두 사라진다. 계정을 바꿔 다시 로그인하면 `key={user.id}`로 새로 마운트 |
| `CalendarProvider`(ADR-002로 `/car`에서도 유지) | `user`가 null → 효과가 `setRepo(new LocalEventRepository())` → `reload`가 새로 만들어져 다시 불러온다. 캘린더는 **이 기기의 로컬 일정**을 보인다(계정 일정은 사라진 것처럼 보임). `sharedCalendars`는 비워진다(코드: `useCalendar.tsx`). 다시 로그인하면 돌아온다 |
| 화면 이동 | 로그아웃해도 주소는 `/car` 그대로, 파일철 탭도 그대로. 캘린더 탭을 누르면 로컬 모드 캘린더가 보인다 |
| 진행 중 쓰기 | 저장 요청이 도중에 세션을 잃으면 실패 토스트(`MSG-01`)가 로그아웃 뒤에 뜰 수 있다(토스트 공급자는 위에 남아 있음, 코드 추정). 저장 중에는 로그아웃 버튼을 막을 필요까지는 없다고 본다 |
| 열린 대화상자 | 대화상자 위에서는 배경이 `inert`라 로그아웃 버튼을 누를 수 없다(코드: `Overlay.tsx`). 입력 잃을 위험 낮음 |
| 포커스 | 로그아웃 버튼이 사라져 포커스가 `body`로 떨어진다 → 기존 패턴대로 `document.getElementById('main-content')?.focus()`(코드: `CarbookApp.tsx` retry 처리와 같은 방식) |
| 다른 탭 | `SIGNED_OUT`이 같은 브라우저의 다른 탭 구독자에게도 전해지는지는 이번에 실행해 확인하지 않았다 → **미확인**. `global` 로그아웃이면 어차피 다른 세션이 다음 갱신 때 끊긴다 |

### 권장안 (VT-2)
- `useAuth().signOut`을 재사용하고 새 계정 표시 컴포넌트(VT-1)에 "로그아웃" 항목을 둔다. 확인은 차계부 `ConfirmDialog`로, 문구는 "로그아웃할까요? 다시 로그인하면 차계부와 계정 일정을 볼 수 있어요. 다른 기기에서도 로그아웃됩니다."처럼 **global 사실을 넣는다**(PO 문구 결정).
- `scope`를 바꿀지는 Architect/PO 결정(Q-V2). 기본 권장은 캘린더와 같은 `global`(공유 파일 수정 0줄).
- 위험: 낮음. 확인 방법: 로그아웃 후 `/car` 로그인 안내, 같은 브라우저의 캘린더가 로컬 모드로 전환되는지를 실앱 또는 기존 `useCalendar.auth.test.tsx` 패턴의 테스트로 확인.

---

## VT-3. 기본 차량 설정을 어디에 저장할까

### 현재 동작 (코드: `src/carbook/state/useCarbook.ts`)
- 선택 차량 = 사용자가 고른 `pickedId`가 목록에 있으면 그것, 아니면 **가장 먼저 만든 차량**(`vehicles[0]`). 새로고침하면 다시 첫 차량이다(AC-03-9).
- 차량을 새로 등록하면 그 차량을 고른다(`setPickedId(newId)`).
- DB는 `vehicles`, `car_records`, `car_maintenance_items`, `car_due_dates` 4개 테이블이다. `schema_carbook.sql`은 `create … if not exists`라 이미 적용된 DB에는 열 추가가 반영되지 않는다(문서: `docs/db.md` 1장 마지막 항목). 그래서 v0.2 변경은 **새 파일**로 둔다.
- RLS 테스트는 `supabase/schema_carbook.test.ts`(PGlite)가 `schema.sql` 등 기초 SQL과 `schema_carbook.sql`을 읽어 돌린다(코드: 5~49행). 새 파일을 쓰면 이 테스트에 읽는 줄을 추가해야 한다.

### 선택지 비교
| 방식 | 기기 간 유지 | 스키마·마이그레이션 | 차량 삭제 때 | RLS | 위험 |
|---|---|---|---|---|---|
| A. `localStorage`(사용자 id별 키) | **아니오**(기기·브라우저별) | 없음 | 저장된 id가 없는 차량이면 첫 차량으로 대체(이미 있는 `selectedId` 로직과 같음) | 해당 없음 | 기기를 바꾸면 사라짐. 공용 PC에서 키를 사용자별로 안 나누면 섞임. 브라우저가 지우면 사라짐 |
| B. `vehicles.is_default boolean` + `unique (user_id) where is_default` | 예 | `alter table` 필요(새 파일, 운영 적용) | 행이 사라지니 자동. 기본 차량이 없는 상태 허용 | 기존 `vehicles` 정책 그대로 | 바꿀 때 "이전 것 해제 + 새 것 지정"을 한 번에 못 한다(PostgREST는 두 번 요청 → 유일 인덱스 위반 또는 기본 차량 2개 상태). 함수(RPC)가 필요 |
| **C. 새 테이블 `car_settings (user_id pk, default_vehicle_id → vehicles(id) on delete set null, updated_at)`** (권장) | 예 | 새 SQL 파일 `create table if not exists` + RLS 정책 3~4개 | **`on delete set null`로 DB가 처리**. 화면은 null이면 첫 차량 | `auth.uid() = user_id`(select·insert·update, 필요하면 delete) + insert/update에서 `default_vehicle_id`가 내 차량인지 확인 | 새 테이블 1개 + 운영 SQL 적용(Michael 승인). 읽기 요청이 첫 로드에 1건 늘어남 |
| D. `supabase.auth.updateUser({ data: { default_vehicle_id } })`(`user_metadata`) | 예 | 없음 | FK가 없어 삭제된 차량 id가 남음(화면이 걸러야 함) | 해당 없음 | **캘린더에 부수 효과**: `updateUser`는 `USER_UPDATED` 이벤트로 새 `user` 객체를 만들고, `useAuth`는 모든 이벤트에서 `setUser`한다. `CalendarProvider`의 효과가 `user`에 의존해 저장소를 새로 만들고 `reload`한다(코드: `useAuth.ts`, `useCalendar.tsx`). 데이터는 안전하지만 캘린더 동작에 끼어든다. `user_metadata`는 사용자가 직접 바꿀 수 있는 값이라 보안 판단에 쓰면 안 된다(여기서는 선호값이라 무방) |

### 권장안 (VT-3)
- **C 권장.** 설정이 두 가지뿐이어도(기본 차량, 추천 주기 되돌리기는 저장할 값이 없음) 사용자당 1행 테이블은 단순하고, 차량 삭제와 기기 간 유지 두 요구를 DB가 처리한다. 정책 형태는 `schema_carbook.sql`의 기존 4개 테이블 정책과 같게 쓴다(`to authenticated`, `(select auth.uid()) = user_id`; `docs/db.md` 3장).
- 스키마 변경 없이 하고 싶으면 A(기기별)를 택하고, "기기 간 유지 안 됨"을 사용자에게 알린다(PO 결정).
- 화면 반영: 처음 읽기 `Promise.all`에 설정 1건을 더하되 **실패해도 무시하고 첫 차량으로**(설정 때문에 차계부 전체가 오류가 되지 않게). `selectedId = picked ?? default ?? vehicles[0]`.
- 성능: 첫 로드 요청이 3건→4건(병렬). AC-04-9는 기록 500행 표시 시간이라 영향은 작을 것으로 보나 측정하지 않았다 → **미확인**(VT-5 재측정에 함께 포함).
- 마이그레이션 영향: 새 파일 1개, `schema_carbook.test.ts`에 로드 1줄과 RLS 케이스 추가(내 설정만 보임, 남의 차량 id 지정 거부, 차량 삭제 시 null), `docs/db.md` 갱신, 운영 적용 순서(백업→적용→확인)는 v0.1과 같다.
- 열린 질문: 사용자가 기본 차량을 지정한 뒤 차량을 새로 등록하면 지금처럼 새 차량이 선택되는데(세션 선택), 다음 접속에서는 기본 차량으로 돌아온다. 이 동작이 맞는지 PO 확인(Q-V3).

---

## VT-4. '추천 교체 주기 되돌리기'의 영향과 재사용

### v0.1 코드 사실
- 추천 항목 7개는 `RECOMMENDED_ITEMS`(이름·주기만)이고, 새 차량 등록 때 `buildRecommendedItems(odometer)`가 `lastDate=오늘`, `lastOdometerKm=차량 주행거리`를 붙여 `api.createItems`로 한 번에 넣는다. **`event_id`는 null**이라 캘린더 일정은 0건이다(코드: `maintenance.ts` 9~22행, `useCarbook.ts` `saveVehicle`; 스펙 AC-06-13).
- 항목에는 "추천에서 온 것"을 가리키는 열이 없다. 이름·주기·마지막 교체 값뿐이다. 같은 이름 유일 제약도 없다(코드·`docs/db.md` 1장).
- 항목을 수정하면 `updateItem`이 연결 id가 비어 있을 때 새 `event_id`를 **선점**하고(`claimThenUpdate`), 그 뒤 일정을 쓴다. 즉 추천 항목을 한 번 저장하면 일정이 생긴다(코드: `saveItem`, `carbookApi.ts`).
- 일정 동기화 도구는 이미 있다: `syncLinked(vehicle, records, items, dues, recordsReady)`가 연결 일정을 한 번에 조회해 제목·날짜가 다른 행만 쓴다. `applyEvent`는 계산 불가(BR-23)면 일정만 지우고 `event_id`는 남긴다. `refreshCalendar`가 쓰기가 있으면 캘린더를 한 번 다시 읽는다(코드: `useCarbook.ts`).

### 되돌리기의 범위 후보
| 방식 | 사용자가 고친 주기 | 직접 추가한 항목 | 직접 지운 추천 항목 | 마지막 교체일·주행거리 | 연결 일정 | 판단 |
|---|---|---|---|---|---|---|
| **1. 이름이 추천과 같은 항목의 주기만 기본값으로, 없는 추천 항목은 새로 추가** (권장) | 기본값으로 | 그대로 | 다시 생김(오늘·차량 주행거리 기준) | **그대로** | 있는 항목은 날짜 재계산 후 일정 수정, 없던 항목은 일정 없음 | 잃는 데이터 없음 |
| 2. 이 차량 항목을 전부 지우고 7개 다시 만들기 | 기본값 | **사라짐** | 생김 | **사라짐**(오늘로 초기화) | 연결 일정 전부 삭제 후 id 없음 | 데이터 손실, 비권장 |
| 3. 1번 + "추천 항목"을 식별하는 새 열(`preset_key`) | 기본값 | 그대로 | 생김 | 그대로 | 위와 같음 | 이름을 바꾼 추천 항목도 정확히 찾음. 스키마 변경 필요 |

- **이름 식별의 한계(1번)**: 사용자가 "엔진오일"을 "오일 교환"으로 이름을 바꾸면 그 항목은 추천으로 안 잡히고, 되돌리기가 "엔진오일"을 새로 추가해 중복처럼 보인다. 같은 이름이 둘 이상이면 가장 먼저 만든 것만 되돌린다. 해결은 3번(열 추가)이거나, 확인 대화상자에 바뀔 내용을 미리 보여 주는 것(권장, 아래).
- **범위**: 선택한 차량 1대만 되돌리는 것을 권장한다. 다른 차량은 기록(주행거리 평균)이 메모리에 없어 일정 날짜를 계산할 수 없다(`recordsReady` 조건, 코드). "모든 차량"은 차량마다 기록을 읽어야 해 비용이 크다(Q-V4).

### 일정 영향 (방식 1)
- 연결 일정이 있는 항목: 주기가 바뀌면 다음 교체일이 바뀐다 → `syncLinked`로 일정 날짜를 고친다(일정 수정). 주행거리 기록 부족으로 날짜 계산이 안 되면 일정이 지워지고 `event_id`는 남는다(BR-23).
- 연결 일정이 없는 항목(추천 그대로인 것): **`saveItem`을 그대로 재사용하면 연결 id를 선점해 일정을 새로 만든다.** AC-06-13·BR-21은 `event_id` 없는 항목에 일정을 만들지 않는다. 되돌리기는 `api.updateItem(id, input)`을 선점 인자 없이 호출하거나 한 번의 `upsert`로 써서 일정이 새로 생기지 않게 한다.
- 새로 추가되는 추천 항목: `event_id: null`로 넣는다(새 차량 등록과 같음).

### 재사용할 코드와 구현 크기
| 부분 | 재사용 | 새로 필요 |
|---|---|---|
| `RECOMMENDED_ITEMS`, `buildRecommendedItems` | 그대로 | - |
| `api.createItems`(`upsert … onConflict: 'id'`, 한 요청) | **기존 행 갱신과 새 행 추가를 한 요청(한 SQL 문)으로** 쓸 수 있어 중간 실패로 일부만 바뀌지 않는다. 기존 행은 `lastDate`·`lastOdometerKm`·`eventId`를 현재 값 그대로 담아 보낸다. 단, 페이로드가 `created_at`을 `now+i`ms로 덮어써 목록 순서가 바뀐다(화면은 `sortItems`로 정렬하므로 영향 작음). 필요하면 기존 행은 `created_at`을 빼고 보내도록 약간 수정 | 기존 행의 `created_at`을 건드리지 않게 하는 분기(약 3줄) |
| `syncLinked`/`refreshCalendar` | 훅 안 클로저라 훅에 새 액션(`resetRecommended`)을 더해 안에서 호출 | - |
| `run`(진행 중 중복 방지, 실패 토스트) | 키 `reset:${vehicleId}` | - |
| 순수 함수 | - | `planRecommendedReset(items, odometerKm, today)` → `{ update: [...], add: [...] }`(약 25줄 + 테스트) |
| 화면 | `ConfirmDialog`(`tone="primary"`, `warning` 속성) | 설정 화면의 "되돌리기" 버튼과 "바뀔 항목 목록" 미리 보기 |
| 예상 크기 | | 함수+테스트 약 70줄, 훅 약 25줄, 화면 약 60줄 → 티켓 하나(400줄 이하) 안 |

### 위험과 권장안 (VT-4)
- 권장: 방식 1, 확인 대화상자에 "주기가 바뀌는 항목 N개, 다시 추가되는 항목 M개, 마지막 교체일·주행거리는 그대로"를 보여 주고, 되돌릴 것이 없으면(이미 모두 기본값) 버튼을 비활성/안내.
- 위험 1: 이름 식별 한계(위). 위험 2: 되돌린 뒤 `syncLinked`가 실패하면 항목은 바뀌었는데 일정이 어긋난다 → 기존 `calendarFailed` 표시와 "캘린더 반영 실패, 다시 시도" 버튼이 이미 이 경우를 다룬다(코드). 위험 3: 두 탭 동시 실행 → `upsert`가 같은 값으로 수렴해 안전.
- 미확인: 실제 DB에서 `upsert`로 기존 행의 `event_id`를 그대로 두는지(값을 그대로 담아 보내므로 문제없을 것으로 보지만 실행하지 않음).

---

## VT-5. v0.1 백로그 3건

### 5-1. AC-04-9 재측정 (원인·방법, 코드 수정 없음)
- **기준**: `/car`를 열어 기록 500행이 보일 때까지 10회의 p95 ≤ 2초(스펙: `docs/03_spec.md` 271행). 10회의 p95는 사실상 **최댓값**이라 이상치 1회로 실패한다.
- **QA 기록**(`docs/qa/report.md` 697, 775행): 정상 회는 1.06~1.4초(중앙 1.1초). 80회 합산 p95 2.22초, 2초 초과 7회(최대 6.4초). 10회 묶음 7세트 중 4개만 p95 ≤ 2초. 느린 회 하나는 HTML 응답이 4.7초에 도착(`navigation.responseEnd`)해 앱 코드가 돌기 전 지연이었고, 다른 느린 회들은 외부 글꼴 CSS가 늦게 끝난 뒤에 앱 요청이 나갔다. 외부 요청을 막은 3세트 중 1세트에서도 첫 회 6.7초가 나와 **원인 하나로 확정 못 함**.
- **코드 근거 하나**: `index.html`은 외부 CDN(`cdn.jsdelivr.net`, Pretendard 글꼴 CSS)을 `<link rel="stylesheet">`로 `<head>`에서 바로 불러온다(코드: `index.html` 29~34행). 이런 스타일시트는 화면 그리기를 막고 일반적으로 뒤따르는 스크립트 실행도 기다리게 한다(일반 지식, 이번에 이 앱에서 직접 확인하지는 않음 → 미확인). QA의 "글꼴 CSS 뒤에 앱 요청" 관찰과 맞지만 증명은 아니다.
- **재측정 방법(권장)**
  1. 한가한 머신에서 `npm run build` 결과를 모의 Supabase로 띄우고 `node docs/qa/scripts/mpr38_perf.mjs <playwright-core> <빌드> fast4g 1 30 only04`를 **3세트 이상**(90회). `BLOCK_EXT=1`(외부 요청 차단)을 켠 세트와 끈 세트를 모두 돌려 글꼴의 영향을 분리한다.
  2. 각 느린 회(1.8초 초과)는 스크립트가 이미 요청별 응답 시각과 long task를 출력한다. 느린 회가 HTML 응답 지연인지, 글꼴인지, 앱 코드인지 분류해 기록.
  3. 판정은 "10회 p95"가 아니라 **전체 회의 p95와 중앙값, 이상치 원인 분류**로 한다. 스펙 문구를 "30회 이상 p95"로 바꿀지 PO·QA가 정한다(Q-V5).
  4. 모의 서버라 실제 Supabase 지연은 빠져 있다. 실제 값을 얻으려면 로그인과 500행이 있는 별도 테스트 Supabase 프로젝트가 필요하다. 새 프로젝트 생성·데이터 적재는 외부 서비스 변경이라 Michael 승인 사안이다(운영 DB에 500행을 넣는 것은 하지 않는다).
- VT-3의 설정 읽기 1건이 추가되면 같은 방법으로 전후를 비교한다.
- 크기: 코드 변경 0줄이 기본. 글꼴 로딩을 바꾸는 안(`preconnect`, `media="print"` 지연 로드, 자체 호스팅)은 `index.html`(캘린더와 공유 파일)을 건드리고 새 폰트 파일을 포함할 수 있어 **측정으로 원인이 글꼴로 확인된 뒤에만** Architect가 결정한다.

### 5-2. 1280px 교체 알림 탭 '캘린더 반영 실패, 다시 시도' 버튼 줄바꿈
- **원인(코드+QA 기록)**: 1024px 이상에서 `.card`가 `grid-template-columns: 140px 128px 152px 112px 88px 128px minmax(0, 1fr)` 7칸 표 행이다. 동작 칸(7번째)에 버튼이 들어가는데 이 칸 폭이 남은 공간(QA 실측 약 108px)뿐이고, `.actions > button { white-space: normal }`과 `CalendarRetryButton.module.css`의 `white-space: normal`이 줄바꿈을 허용한다. 한글에 `word-break: keep-all`이 없어 글자 중간에서 끊긴다(`MaintenanceTab.module.css` 160~235행, `CalendarRetryButton.module.css`, QA 기록 709행). 같은 표의 "10,000km / 12개월" 주기 칸도 "12개/월"로 끊긴다(같은 기록).
- **고치는 크기**: CSS 약 8~12줄, 파일 2개(`MaintenanceTab.module.css`, 필요 시 `CalendarRetryButton.module.css`). 방안:
  - 재시도 버튼은 `word-break: keep-all`로 단어 단위만 줄바꿈하고, 실패 행에서는 버튼이 행 전체 폭의 둘째 줄로 내려가게(`grid-column: 1 / -1; justify-self: end`) 한다.
  - `.cycle`에 `word-break: keep-all`(1줄).
- **검증**: jsdom은 레이아웃이 없어 단위 테스트로 못 닫는다. 기존 `docs/qa/scripts/mpr38_app.mjs`의 실패 1건(데스크톱 재시도 버튼)이 PASS로 바뀌는지와 375px 회귀 없음, 스크린샷 `docs/qa/screens/mpr38-desktop1280-maintenance-retry.png`와 비교.
- 위험: 낮음. 만기일 탭에는 같은 표가 없다(`DueDatesTab`은 이 버튼을 쓰지만 이 표 레이아웃은 아님 → 같은 줄바꿈이 있는지는 확인 못 함, **미확인**).

### 5-3. 만기일 확인창 퇴장 중 포커스가 body에 머묾(모바일, 약 0.7초)
- **관찰**(QA 기록 710행, 718행): 만기일 삭제 확정 뒤 최종 포커스는 정상("보험 만기 입력")이고, 중간에 `body`를 거치는 시간이 만기일만 최장 740ms(375px). 기록·교체 항목은 40ms, 차량은 60ms.
- **코드로 본 원인 가설(측정 전)**:
  1. `Overlay`는 닫히기 시작할 때 "열기 전에 포커스가 있던 요소(opener)"가 아직 문서에 있으면 포커스를 돌려보낸다(`Overlay.tsx` 90~105행). 만기일 삭제는 성공하면 그 행의 "삭제" 버튼이 사라지고(행이 "입력"만 남음) opener가 문서에서 빠져 돌려보낼 곳이 없다.
  2. `ConfirmDialog`의 "삭제" 버튼은 처리 중 `disabled`가 되고(`ConfirmDialog.tsx`) 성공 뒤에도 풀리지 않는다. 포커스가 비활성 버튼에 있으면 브라우저가 `body`로 옮길 수 있다(브라우저 동작은 이번에 실행하지 않음 → 미확인).
  3. 복구는 `AnimatePresence onExitComplete`에서만 일어난다(`DueDatesTab.tsx`). 모바일 시트의 퇴장(`springRelease`, `Overlay.tsx` 195행)이 길어 그 사이가 `body`다.
  기록·교체 탭도 같은 구조인데 짧은 이유는 이번에 설명하지 못했다 → **미확인**(그래서 측정 먼저).
- **확인 방법**: `docs/qa/scripts/mpr38_focus.mjs`(20ms 표집)를 만기일 삭제에 대해 돌리고 표집마다 `activeElement`의 태그·`role`·`aria-label`을 같이 기록해 `body`가 되는 순간이 ① 확정 클릭 직후(버튼 비활성) ② 행 갱신 직후(opener 삭제) ③ 다른 시점 중 어디인지 가른다.
- **고치는 크기(가설 ①·② 기준)**: `DueDatesTab.tsx`에서 삭제 성공으로 대화상자를 닫을 때, 퇴장이 끝나기를 기다리지 않고 닫는 즉시(`Overlay`가 배경 `inert`를 푼 다음 프레임) 같은 행의 첫 버튼으로 포커스를 옮긴다. 약 10~15줄 + 테스트 1개. `restoreFocusAfterExit`(포커스가 `body`일 때만 대상으로 보냄, 대화상자 안에 있으면 최대 500ms 기다림)를 즉시 한 번 더 호출하는 것으로는 포커스가 닫히는 대화상자 안의 비활성 버튼에 남은 경우를 못 구한다(코드: `focusAfterExit.ts`). 구현자는 `inert` 해제 시점 이후에 `focus()`해야 한다(`inert` 요소는 포커스가 안 간다).
- 위험: 낮음~중간(타이밍 코드, 실브라우저 측정으로만 확인). 심각도는 P3이고 최종 포커스 위치는 이미 정상이다. 같은 방식이 `ConfirmDialog`를 쓰는 다른 탭에도 적용될 수 있어 **공용 처리(`ConfirmDialog` 쪽)로 고칠지, 만기일 탭만 고칠지**는 Architect 결정이다(Q-V6). 만기일 탭만이면 범위가 가장 작다.

### 크기 요약 (VT-5)
| 항목 | 파일 | 예상 줄 수 | 검증 |
|---|---|---|---|
| 5-1 AC-04-9 | 없음(측정 기록은 `docs/qa/` 또는 `docs/perf/`) | 코드 0 | `mpr38_perf.mjs` 90회 이상 |
| 5-2 버튼 줄바꿈 | `MaintenanceTab.module.css`(+`CalendarRetryButton.module.css`) | CSS 8~12 | `mpr38_app.mjs` 1280px 케이스 + 스크린샷 |
| 5-3 포커스 | `DueDatesTab.tsx`(+테스트) | 10~15 (+테스트 20~30) | `mpr38_focus.mjs` 만기일 삭제 표집 |

---

## v0.2 열린 질문
| # | 질문 | 결정자 | 권장 |
|---|---|---|---|
| Q-V1 | 실제 Google 로그인에서 `user_metadata`의 이름·사진 키가 무엇인지 1회 확인(VT-1) | Software Architect(구현자가 확인) | `avatar_url`/`picture`, `full_name`/`name`을 모두 시도 |
| Q-V2 | 로그아웃 범위: 캘린더와 같은 `global`(다른 기기도 로그아웃) vs `local`(이 기기만) | Product Owner·Architect | 캘린더와 같은 `global` + 확인 문구에 명시 |
| Q-V3 | 기본 차량 지정 뒤 새 차량을 등록하면 이번 세션은 새 차량, 다음 접속은 기본 차량으로 돌아가도 되는가 | Product Owner | 허용 |
| Q-V3b | 기본 차량 저장: 새 테이블(`car_settings`, 기기 간 유지)과 `localStorage`(기기별, 스키마 변경 없음) 중 | Software Architect | `car_settings` |
| Q-V4 | 추천 주기 되돌리기 범위: 선택한 차량 1대 vs 모든 차량, 이름 식별 vs 식별 열 추가 | Product Owner·Architect | 선택 차량 1대, 이름 식별 + 미리 보기 |
| Q-V5 | AC-04-9 문구를 "10회 p95"에서 "30회 이상 p95와 이상치 원인 분류"로 바꿀까 | Product Owner·QA | 변경 |
| Q-V6 | 포커스 수정을 `ConfirmDialog` 공용으로 할지 만기일 탭만 할지 | Software Architect | 만기일 탭만(범위 최소) |

## v0.2 출처
- 저장소(코드): `src/state/useAuth.ts`, `src/components/AuthButton.tsx`, `src/state/useCalendar.tsx`, `src/App.tsx`, `src/carbook/CarbookApp.tsx`, `src/carbook/state/useCarbook.ts`, `src/carbook/data/carbookApi.ts`, `src/carbook/domain/maintenance.ts`, `src/carbook/components/{ConfirmDialog,DueDatesTab,MaintenanceTab,CalendarRetryButton}.*`, `src/carbook/components/focusAfterExit.ts`, `src/components/Overlay.tsx`, `src/state/widgetMode.ts`, `index.html`, `vercel.json`, `supabase/schema_carbook.sql`, `supabase/schema_carbook.test.ts`
- 저장소(문서): `docs/00_brief.md`, `docs/release/verdict.md` 5장, `docs/qa/report.md`(697, 709~710, 718, 775~777행), `docs/db.md`, `docs/03_spec.md`(AC-04-9, AC-06-13), `docs/02_architecture.md`, `docs/adr/`
- 공식 문서(열람 2026-11-21): https://supabase.com/docs/guides/auth/signout.md (signOut 범위 `global` 기본), https://supabase.com/docs/guides/auth/social-login/auth-google.md (Google 필드 목록 없음 확인), https://supabase.com/docs/guides/auth/identities.md
- 2차 자료(검색 요약, 직접 열람 안 함): Supabase 커뮤니티 예제와 Stack Overflow(Google 프로필 이미지 403과 `referrerpolicy="no-referrer"`), Google People API 이미지 크기 문서 https://developers.google.com/people/image-sizing
- 실행한 것: 문서 `curl` 2건(Supabase 가이드 .md), `node -v`(v24.16.0). 앱 실행·브라우저 측정·실제 로그인은 하지 않았다.

---
---

# v0.3 기술 조사 — UI 이름 사전 탭 (UT-1 ~ UT-5)

- 날짜: 2026-11-25 · 작성: Tech Researcher · 최종 결정: Software Architect
- 요구 원본: `docs/00_brief.md` 'v0.3 Brief'(커밋 261758f). 조사 대상: `C:/Users/a9163/Downloads/ui.html`(이하 "원본").
- 조건: 캘린더 화면·코드 동작 불변, 라우터 라이브러리 없음, 새 앱 의존성 없음, 내용은 그대로·디자인만 서비스 토큰으로.
- 표기: **실측** = 원본 텍스트를 읽거나 명령으로 센 값(원본은 실행하지 않았고 브라우저로 열지 않았다), **코드** = 저장소 파일을 읽음, **문서** = 공식 문서를 열어 확인, **추정** = 위 근거로 계산한 값, **미확인** = 확인 못 함.
- 별도 실행 스파이크는 하지 않았다. 원본 실행이 금지라 브라우저 측정(열기 시간, 동작 회귀)은 **미확인**이고, 확인 방법을 적었다. 원본은 구문 검사(`node --check`)와 번들러 최소화(rolldown, 실행 없음)만 했다.

## v0.3 요약 (권장안)

| ID | 결론 |
|---|---|
| UT-1 | 원본은 "데이터"가 아니라 **항목 310개 × (설명 4칸 + 데모 HTML 문자열 + 동작 함수)** 구조다. 동작 함수 289개가 DOM을 직접 만지고 타이머 132곳, 문서 전체 이벤트 6곳을 쓴다. React 컴포넌트 310개로 다시 쓰는 안(A)은 이번 범위에 비해 크다. **권장: 같은 출처 iframe에 별도 문서로 싣는 안(C)** — 원본 코드를 그대로 쓰므로 동작 회귀가 구조적으로 없고, CSS·JS 누출과 정리(타이머 해제)가 문서 단위로 끝난다. 대안은 Shadow DOM 이식(B). |
| UT-2 | 최소 변경은 파일 3개(`navigation.ts`, `FileTabs.tsx`, `App.tsx`), 합계 약 20줄. `CalendarApp`·`useCalendar`·캘린더 컴포넌트는 안 바뀐다. 다만 `FileTabs`의 현재 탭 판정이 "차계부 아니면 캘린더"라는 2개 전제라 **그 한 줄은 고쳐야 한다**. 탭이 3개가 되면 오른쪽 겹침 높이가 1.5배가 된다(A11Y-3 범위 확대). |
| UT-3 | 원본 스크립트+CSS는 최소화·gzip 후 **약 139KB**(현재 앱 JS+CSS 약 254KB의 55%). C안이면 앱 번들은 0바이트 늘고 탭을 처음 열 때만 받는다. 원본은 이미 "화면 근처 카드만 초기화"하는 지연 렌더가 있다. 열기 시간은 **미확인**(측정 방법 아래). |
| UT-4 | 색 참조 약 2,160곳 중 약 1,390곳(65%)은 기본 변수 9개와 같은 값이라 토큰으로 기계 치환된다. 흰/검정 244곳은 결정이 필요하고, 약 440곳은 데모 고유색(사진 배경·파스텔)이라 `--dict-*` 전용 값으로 두는 안을 권장. 원본은 **브랜드색이 주황(#FF5B1F)이고 변수 이름은 `--blue`**라 이름만 보고 치환하면 안 된다. |
| UT-5 | 사용자 입력이 HTML로 들어가는 경로는 **찾지 못했다**(입력은 `textContent` 또는 `esc()`로 들어가고, 자동완성 1곳은 후보가 고정 한글 과일 이름이라 막힌다). 단 패턴 검색이므로 전수 증명은 아니다. 클립보드 쓰기 호출은 **3곳**("7곳"은 단어 출현 횟수). HTTPS(또는 localhost)와 클릭 같은 사용자 동작 안에서만 되고, **실패해도 "복사했어요"를 띄우는 결함**이 원본에 있다. |

---

## 원본 실측 (UT-1~5 공통 근거)

| 항목 | 값 | 비고 |
|---|---|---|
| 파일 | 473,979B, 3,232행 | `<style>` 55,332B(9~690행), `<script>` 417,272B(707~3230행), 본문 933B |
| 항목·분류 | 항목 310(= `add(` 호출 310), 분류 13 | input 35, nav·feedback·data 각 30, social·commerce 각 25, ux·motion·media·layout·gesture·flow 각 20, map 15 |
| 항목 구성 | `add(분류, 이름, 영문, 설명, 데모 HTML, 동작 함수, 클래스)` | 동작 함수 289개, 없는 정적 항목 21개. 항목 하나의 코드 크기 중앙값 850B, 평균 1,293B, 최대 11,029B(스크롤 시 숨는 헤더) |
| 설명 4칸 합계 | 52,180B(gzip 19,485B) | 이름·영문·설명에 `<`·`&` 0개 |
| CSS | `<style>` 55KB + 스크립트 안 `css()` 블록 19개 129KB = 184KB(gzip 34.9KB) | 규칙 2,242개, 클래스 964종, `@keyframes` 33개(앱의 4개와 이름 겹침 0) |
| 요소 선택자 규칙 | `section` 6, `h1` 4, `:root` 2, `body` 2, `footer` 2, `*`·`button`·`input`·`textarea`·`::selection` 각 1 (모두 페이지 틀 쪽) | 데모 규칙은 전부 클래스 선택자 |
| HTML 삽입 | `innerHTML` 151회(106행), `insertAdjacentHTML` 3회 | `eval`·`new Function`·`document.write`·`outerHTML` 0, 인라인 `on…=` 속성 0, `javascript:` 0 |
| 동작·자원 | `setInterval` 17(`clearInterval` 18), `setTimeout` 82, `requestAnimationFrame` 33, `IntersectionObserver` 2, `document.addEventListener` 6(제거 3), `document.*` 직접 참조 29 | 원본은 페이지가 닫힐 때까지 정리 코드가 없다 |
| 저장소·주소·네트워크 | `localStorage`·`sessionStorage`·`location`·`history` 0, 실제 `fetch` 0(예시 문자열 1) | 외부 주소 3개: Pretendard CSS(jsDelivr), JetBrains Mono(Google Fonts), 예시 문자열 `https://ui.kr/api/ui` |
| 접근성 단서 | `aria-label` 43, `keydown` 13, `tabindex` 1, `prefers-reduced-motion` **0** | 서비스의 NFR-22(동작 줄이기)와 맞지 않는다 |
| 렌더 방식 | 카드 310개 틀을 한 번에 만들고, 화면 600px 근처에 들어온 카드만 `boot`(데모 HTML 삽입+동작 함수 실행) | 이미 지연 초기화다. 검색·분류는 `display:none` 토글 |
| 구문·타입 | `node --check` 통과. 이 저장소 `tsc`(6.0.3, 앱 설정)로 `.ts`처럼 검사하면 **오류 1,262건**(암묵 any 679, 인수 개수 302, …). `oxlint` 오류 0, 경고 29 | 그대로 `src/`에 넣으면 `npm run build`(`tsc -b`)가 깨진다 |
| 번들(실측, 실행 없음) | 스크립트 최소화 403,774B → gzip 126,637B / brotli 97,921B. CSS 55,315B → gzip 12,147B / brotli 10,683B | 스크립트 수치에 `css()` 129KB가 이미 들어 있어 CSS를 따로 더하면 안 되고, `<style>` 부분만 더한다 |
| 현재 앱(비교) | `dist/`(2026-11-21 빌드, 현재 소스 기준인지 **미확인**): JS gzip 합 약 238KB(index 59.2, react 67.6, supabase 54.5, motion 45.1, date 11.4), CSS 15.8KB | |

헤더 문구 "표제어 104개"는 원본 HTML에 고정된 값이고 스크립트가 310으로 바꾼다. 이식하면 이 숫자는 데이터에서 계산해야 한다(내용 변경 아님).

---

## UT-1. 단일 HTML을 서비스 탭으로 옮기는 방식과 CSS 누출 방지

### UT-1.1 후보 비교

| 안 | 내용 | 코드 변경량(추정 근거) | 격리 | 토큰·테마 | 위험 |
|---|---|---|---|---|---|
| **A. React 전면 재작성** | 항목 310개를 컴포넌트로 다시 작성, 데이터는 TS | 원본 417KB 전부를 새로 씀. 동작 함수 289개의 DOM 조작을 상태로 바꿔야 함 | 완전(React 트리) | 서비스 토큰 직접 사용, 다크·ZIGZAG 자동 | "내용·데모 동작 그대로"를 310번 다시 증명해야 함. 이번 범위(조사·PRD·설계 후 구현)에 비해 가장 큼 |
| **B. 데이터 분리 + 원본 데모 코드 이식 + Shadow DOM** | 설명 4칸은 TS 데이터로(기계 변환 가능, 52KB), 데모 HTML·동작 함수는 분류별 모듈로 옮겨 React가 만든 `div`의 Shadow Root 안에서 실행 | 데모 코드 이동 + 수정 지점: `document.*` 29곳·문서 이벤트 6곳을 root 기준으로, 타이머 132곳 정리, 모듈에 `@ts-nocheck`(오류 1,262건) | CSS·DOM 격리는 Shadow Root가 해 줌(Shadow DOM 지원: Chrome 53, Firefox 63, Safari 10, 문서: caniuse) | 변수(`--color-*`)는 Shadow 경계를 넘어 상속되므로 다크·ZIGZAG가 따라옴 | 이벤트 재지정(retargeting)으로 "바깥 클릭 닫기" 6곳이 깨짐(`e.target`이 호스트가 됨). 탭을 떠날 때 타이머·rAF가 계속 돎(정리 필요). 테스트 라이브러리 질의가 Shadow 안을 못 봄. 전부 **프로토타입으로 확인 필요** |
| **C. 별도 문서 + 같은 출처 iframe** (권장) | 원본 코드를 별도 HTML 진입점(`ui-dict.html`)으로 두고, 탭 화면은 `iframe` 하나. CSS만 서비스 토큰으로 치환 | 앱 코드 신규 약 30~50줄(iframe 래퍼, 테마 전달) + Vite 진입점 1개 추가(`vite.config.ts` 수정). 원본 JS는 그대로 | 완전(문서가 다름). 탭을 떠나면 문서가 사라져 타이머·리스너 정리가 공짜 | 토큰 CSS를 같은 진입점에서 `import`하면 값이 하나로 유지됨. 현재 테마는 처음 열 때 쿼리나 같은 `index.html`식 선(先)스크립트로 전달 | 중첩 스크롤(iOS Safari의 `iframe`+sticky 검색줄), 앱의 건너뛰기 링크·포커스 규약이 iframe 경계에서 끊김, 단위 테스트는 래퍼까지만 가능, 다크 모드 실시간 전환 불가(사전 탭엔 테마 설정 UI가 없어 실제로는 영향 작음) |
| D. 전역 그대로 + 선택자 접두어(`.dict …`) | CSS 규칙 2,242개에 접두어를 붙여 같은 문서에 삽입 | 선택자 재작성 스크립트 + `@keyframes` 이름 | 접두어에 의존(누락 시 누출) | 상속됨 | CSS 중첩·`@scope`로 대신하면 iOS Safari 17.0~17.3이 빠짐(아래). 타이머 정리·document 참조 문제는 B와 같음 |

- **CSS 중첩과 `@scope`를 쓰지 않는 이유(문서: caniuse 데이터, 2026-11-25 조회).** `@scope`는 iOS Safari 17.4+, Firefox 146+. CSS 중첩은 iOS Safari 16.5~17.1이 부분 지원(요소 선택자 앞에 `&` 필요), 17.2부터 완전. 서비스 지원 범위 NFR-13이 iOS Safari 17 이상이라 `@scope`는 17.0~17.3, 중첩은 17.0~17.1이 걸린다. Vite 내장 변환기로 푸는 방법(lightningcss)은 devDependency 추가라 NFR-16 승인이 필요하다 — 이번 후보에서 제외.
- **누출은 양방향이다.** (1) 원본 → 서비스: 원본의 `*`, `body`, `button`, `input`, `section`, `h1`, `footer`, `:root` 규칙이 새면 서비스 전체가 바뀐다. (2) 서비스 → 원본: 서비스 `global.css`의 `* {box-sizing}`, `h1,h2,h3,p {margin:0}`, `button {font-family:inherit; touch-action}`이 데모 안 요소에 적용된다. 현재 원본이 쓰는 값(`*{margin:0;padding:0}` 등)과 달라 데모 모양이 바뀔 수 있다. C는 둘 다 없고, B는 (1)을 막고 (2)는 상속 속성만 들어온다.
- **원본 페이지 틀(머리말·검색줄·분류 버튼·푸터)은 어차피 서비스 디자인으로 다시 만든다.** 위 요소 선택자 규칙 21개가 거기에 해당하므로 이식하지 않는다. 데모 규칙은 전부 클래스라 접두어 없이도 문서 안에서만 쓰인다(C) 또는 Shadow 안에서만 쓰인다(B).

### UT-1.2 위험 정리 (안별)

| 위험 | A | B | C |
|---|---|---|---|
| 데모 동작이 원본과 달라짐 | 높음(310개 재작성) | 중간(`document` 직접 참조 29곳, 그중 문서 이벤트 6곳이 재지정 영향) | 낮음(원본 JS 그대로) |
| 탭을 떠난 뒤 타이머·rAF 누수 | 낮음(React 정리) | 중간(132곳, 모듈 범위에서 `setInterval` 등을 가려 쓰는 방식으로 줄일 수 있으나 미확인) | 없음(문서 폐기) |
| 서비스 화면에 CSS 누출 | 없음 | 없음(Shadow) | 없음 |
| 모바일 스크롤·sticky | 낮음 | 낮음 | **중간** — 검증 필요 |
| 접근성(원본이 약함: `aria-label` 43개, `tabindex` 1개, 동작 줄이기 0) | 새로 설계 가능 | 원본 수준 유지, CSS로 일부 보강 | 원본 수준 유지, CSS로 일부 보강 |
| 테스트 | 컴포넌트별 가능 | Shadow 질의 도우미 필요 | 래퍼와 제목·링크까지만 |
| 새 앱 의존성 | 0 | 0 | 0 (`vite.config.ts` 진입점 추가) |
| 나중에 React로 옮기기 | — | 항목 단위로 점진 가능 | 항목을 꺼내 B로 옮기면 됨 |

### UT-1.3 권장안 (UT-1)

1. **첫 배포는 C(같은 출처 iframe)** 권장. 이유: "내용·동작은 그대로"라는 사용자 조건을 코드가 그대로라는 사실로 만족하고, 정리·누출 문제를 문서 단위로 끝내며, 앱의 `dependencies`·`CalendarApp`·`tsc -b`를 건드리지 않는다.
2. **결정 전에 프로토타입 1건**(분류 1개, 예: 모션 20개)을 B와 C로 각각 올려 아래 5가지를 측정한다: ①열기 시간(UT-3 방법), ②iOS Safari 실기기 스크롤·sticky, ③바깥 클릭 닫기 6곳, ④탭 왕복 10회 뒤 타이머 수(DevTools), ⑤다크·ZIGZAG에서 색.
3. C로 가면 iframe에 `title="UI 이름 사전"`, 부모 `main`에 `id="main-content" tabIndex={-1}`(앱의 화면 전환 포커스 규약, `App.tsx` 205행)과 `h1`을 두고, iframe 안 문서에도 `lang="ko"`와 자기 `h1`을 둔다.
4. 이식 때 원본 HTML을 `src/`에 넣지 않는다(C의 진입점은 저장소 최상위 또는 `public/` 밖 별도 폴더). `tsc -b`가 오류 1,262건을 내고, `oxlint` 경고 29건이 나온다(오류 0).
5. 구현 티켓은 분류 13개 단위로 나누는 것이 DoR의 "변경 400줄 이하"에 맞는다(분류당 15~35개 항목, 코드 19~42KB).

---

## UT-2. 탭 추가 위치와 기존 코드 변경 범위

### UT-2.1 코드 사실 (코드)

- `App.tsx` 196~215행: `isCarPath(pathname) ? <CarbookApp /> : <CalendarApp />`와 `FileTabs`가 `CalendarProvider` 안에 있다. `screenName`(문서 제목·포커스 이동용)도 같은 2분기(`'차계부' : '캘린더'`).
- `FileTabs.tsx`: `TABS` 배열 2개, 현재 탭 판정 `(href === '/car') === onCar` — **"차계부가 아니면 캘린더"** 전제라 3번째 탭을 더하면 사전 화면에서 캘린더 탭도 현재로 표시된다.
- `navigation.ts`: `isCarPath`만 있고 `navigate`·`usePathname`은 경로 문자열 비교라 3번째 경로도 그대로 동작한다. 새 경로가 `/share/:id`(`matchShareId`)와 겹치지 않으면 된다.
- `vercel.json`: 모든 경로를 `index.html`로 보내므로 배포 설정 변경 없음. 정적 파일(C안의 `ui-dict.html`)은 파일이 우선이라 rewrite에 안 걸린다(Vercel 동작, **미확인** — 배포 전 확인).
- `CalendarApp`(단축키 `useKeyboardShortcuts` 포함)은 `/car`처럼 사전 경로에서도 그려지지 않으므로 캘린더 단축키가 사전 화면에서 켜질 일이 없다.
- 기존 테스트는 이름으로 탭을 찾아(`getByRole('link', {name:'차계부'})`) 탭이 3개가 되어도 깨지지 않는다. 탭 개수를 단정하는 테스트는 찾지 못함.

### UT-2.2 최소 변경 범위

| 파일 | 변경 | 줄 수(추정) | 캘린더 코드? |
|---|---|---|---|
| `src/carbook/navigation.ts` | 사전 경로 판정 함수 1개(예: `isDictPath`) | +3~5 | 아님(차계부 폴더) |
| `src/carbook/FileTabs.tsx` | `TABS`에 1개 추가, 현재 탭 판정을 경로 기반으로 | +6, −2 | 아님 |
| `src/App.tsx` | `screenName` 3분기, 렌더 3분기, (B안이면 `React.lazy`) | +6~8 | **`App()` 함수만**. `CalendarApp` 본문·`useCalendar`·캘린더 컴포넌트는 불변 |
| `FileTabs.module.css` | 없음(세로 `flex`라 자동으로 쌓임) | 0 | 아님 |
| 신규 폴더(예: `src/dictionary/` 또는 별도 진입점) | 사전 화면 전부 | 신규 | 아님 |

- **캘린더 코드 불변 원칙과의 충돌**: `App()`이 캘린더 화면과 같은 파일이지만 v0.1에서 이미 같은 방식(차계부 분기)으로 바꾼 선례(ADR-001·002)가 있고 `CalendarApp`은 건드리지 않는다. 위 3개 파일 변경 때문에 기존 캘린더 테스트가 깨질 가능성은 낮다(**미확인** — 변경 뒤 `npm test`로 확인).
- **대안은 모두 더 크다**: 사이드바·헤더에 진입점을 넣으면 캘린더 컴포넌트를 고치게 되어 원칙에 충돌한다. 탭 3개 방식이 유일하게 캘린더 코드 밖에서 끝난다.
- `CalendarProvider`는 그대로 감싸 둔다(ADR-002). 사전은 캘린더 데이터가 필요 없지만, 밖으로 빼면 탭 왕복마다 캘린더가 다시 불러오는 문제가 생긴다.

### UT-2.3 새 탭이 만드는 영향 (측정 필요)

- 탭 높이: 데스크톱 32×96px ×3 = 288px, 모바일 28×56px ×3 = 168px(지금 192·112px). 세로 중심은 그대로라 **오른쪽 가장자리를 가리는 높이가 1.5배**. NFR-17의 알려진 예외 A11Y-3(모바일 주 보기에서 토요일 칸 일부가 가려져 남는 폭이 24px 미만)의 **세로 범위가 넓어진다**. 폭은 그대로. 가로 화면 낮은 터치 기기(높이 ≤500px)에서 168px가 화면에 맞는지 **미확인**.
- 탭 글자는 세로로 눕혀 쓰며 데스크톱 높이 96px·14px 글자, 모바일 56px·12px 글자다. "UI 이름 사전"(7자)은 모바일 56px에 안 들어갈 가능성이 크다(**추정**: 12px 한글 글자 폭 약 12px×6자 = 72px). 라벨은 "사전" 같은 2~3자가 안전하다. 라벨은 PO·UI Designer 결정.
- 경로 이름(예: `/ui`, `/dict`)은 PO·Architect 결정. `/car`처럼 `/x`와 `/x/`를 같게 다룰지(BR-01 선례)도 같이 정한다.

### UT-2.4 권장안 (UT-2)

3개 파일, 약 20줄 변경, 위 3분기 판정을 한 곳(`navigation.ts`)에서 함수로 내보내 App·FileTabs가 같은 함수를 쓰게 한다. 탭 라벨은 2~3자. 변경 뒤 NFR-07(캘린더 요소 위치 변화 0, 기존 테스트 100%)과 A11Y-3 측정을 다시 한다.

---

## UT-3. 첫 화면 크기와 속도

### UT-3.1 크기 (실측, 위 표)

| 구성 | 크기(gzip) | 앱에 더해지는 양 |
|---|---|---|
| 스크립트(최소화) | 126.6KB (brotli 97.9KB) | |
| `<style>` 부분 CSS | 12.1KB (brotli 10.7KB) | |
| **합계** | **약 139KB** (brotli 약 109KB) | 현재 앱 JS+CSS 약 254KB 대비 +55% |

- **C안(별도 문서)**: 앱 번들 +0. 탭을 처음 열 때만 약 139KB를 받는다. 코드 분할 설정이 필요 없다.
- **B안(앱 안)**: `React.lazy`/동적 `import()`로 분리하지 않으면 첫 화면(캘린더)에 +139KB가 얹힌다. 분리하면 +0이고 탭 첫 방문 때 받는다. `vite.config.ts`의 분할 그룹은 라이브러리용이라 동적 import는 별도 설정 없이 청크가 나뉜다(Vite 기본, **미확인** — 빌드로 확인).
- **분류별로 더 쪼갤 수 있다**: 설명 4칸(52KB)은 검색 때문에 한 곳에 두고, 데모 코드는 분류 13개(코드 19~42KB)로 나누어 그 분류 카드가 화면에 들어올 때 받는다. 단 이 쪼개기는 B안에서만 쉽다. C안은 원본 구조를 그대로 두므로 쪼개지 않는다.

### UT-3.2 한 번에 그릴 때와 나눠 그릴 때

- 원본은 이미 **카드 틀 310개를 한 번에 만들고, 데모는 화면 600px 근처에 들어올 때만 만든다**(`bootIO`, 렌더 코드 3190행 근처). 즉 "310개 데모를 한 번에 그린다"는 상태가 아니라 첫 화면 몇 개만 그린다. 첫 화면에 몇 개가 뜨는지, 열기 시간은 **미확인**(원본 실행 금지).
- 차이를 재는 방법(구현 프로토타입에서): ①원본 방식(지연 초기화), ②전부 즉시 `boot`, ③(B안만) 분류별 청크. 각각 Chrome 성능 탭, 네트워크 "Fast 4G", 30회 이상 p95(NFR 공통 기준, `docs/04_nfr.md`), 지표는 "탭 클릭 → 첫 카드 데모 표시"와 "스크롤 1화면 뒤 프레임 시간".

### UT-3.3 지금 NFR과 맞추는 방법

- 기존 NFR-01(탭 클릭→화면 전환 100ms 이하, 데이터 로딩 제외)은 **두 번째 방문부터**의 기준으로 읽는 것이 자연스럽다. 첫 방문은 NFR-02(`/car` 열기 2초 이하)와 같은 종류(네트워크 포함)로 새 NFR을 두는 안을 권장: "사전 탭 첫 방문 → 첫 카드 표시 2초 이하(p95, Fast 4G)", "재방문 100ms 이하".
- 전송만 따지면 139KB는 Fast 4G 프리셋 값에 따라 0.1~0.2초대로 **추정**(프리셋 정확한 값 **미확인**). 병목은 전송보다 `boot`의 DOM 생성과 스타일 계산일 가능성이 높다(CSS 2,242규칙 한 번에 적용) — 측정 전이라 가설.
- 첫 방문 지연이 거슬리면 탭에 `hover`/`focus` 때 미리 받기(`prefetch`)를 건다. 앱 코드 몇 줄.
- 외부 글꼴: Pretendard는 서비스 `index.html`이 이미 같은 CSS를 쓴다(원본 `<link>`는 이식 때 제거). **JetBrains Mono는 서비스에 없는 외부 요청(Google Fonts)**이다. 이식 때 제거하고 시스템 고정폭(`ui-monospace`) 스택을 쓰는 안을 권장(원본 `--mono`가 99곳). 유지하려면 PO가 외부 전송 범위를 정해야 한다(NFR-30은 차계부에 한정).

### UT-3.4 권장안 (UT-3)

C안이면 구성만으로 앱 번들 +0. B안이면 동적 import 필수. 어느 쪽이든 구현 전에 위 측정 3종을 프로토타입에서 한 번 하고, 새 NFR(첫 방문·재방문)을 PRD에 둔다.

---

## UT-4. 원본 디자인을 서비스 토큰으로 바꾸는 범위

### UT-4.1 원본 변수와 서비스 토큰 대응 (코드: `src/styles/tokens.css`, `docs/design/tokens.md`)

원본은 `:root`가 2번 있고 **뒤 블록이 이긴다**(587행). 실제로 보이는 값은 뒤 블록(종이 느낌의 크림 바탕+주황 강조)이다.

| 원본 변수(실제 값) | 사용 횟수 | 대응 서비스 토큰 | 메모 |
|---|---|---|---|
| `--ink` #161513 | 408 | `--color-heading`(글자), 선은 `--color-control-border` 또는 `--color-heading` | 원본은 **1.5px 진한 테두리**가 스타일 핵심. 서비스는 가는 선+연한 면이라 모양이 달라진다 |
| `--blue` **#FF5B1F(주황)** | 206 | `--color-primary` / `--color-primary-fill`(파랑 #0066ff) | **이름은 blue, 값은 주황**. 서비스 강조색은 파랑이라 "강조"로 바뀐다 |
| `--paper` #FBF9F4 | 193 | `--color-surface-raised` | |
| `--sub` #6E6A61 | 164 | `--color-secondary` | 대비는 서비스 토큰 값 기준으로 다시 확인 |
| `--mono` JetBrains Mono | 99 | **대응 없음**(신규 `--font-mono` 필요) | UT-3.3 |
| `--red` #E0312B | 62 | `--color-danger` | |
| `--line` #D9D3C5 | 59 | `--color-hairline` | |
| `--soft` #EAE5D8 | 55 | `--color-subtle` | |
| `--green` #2E8B57 | 39 | `--color-success-text`/`-icon`(`tokens.css`에 있음) | |
| `--bg` #F3EFE6 | 2 | `--color-canvas` | |
| 기타 지역 변수(`--ik`, `--c1`, `--e`, `--d` 등) | 약 30 | 대응 대상 아님 | 데모별 계산용(색상 견본 `--c1`/`--c2` 포함) |

### UT-4.2 색 참조의 분류 (실측)

원본 색 참조 약 2,160곳(`var()` 1,285, 16진 리터럴 793, `rgba()` 80, `hsl()` 1).

| 분류 | 횟수 | 처리 |
|---|---|---|
| 기본 변수 9개를 쓰는 `var()` | 1,285 | 표대로 **기계 치환** |
| 실제 테마 변수값과 같은 리터럴(#161513, #ff5b1f, #2e8b57 …) | 109 | 같은 변수로 **기계 치환** |
| 덮어써진 첫 `:root` 팔레트값(#3182f6, #f04452 …) | 56(`<style>` 27, 스크립트 29) | 남은 옛 값. 데모 의도인지 확인 후 결정 |
| 흰색·검정 리터럴(#fff 229, #000 15) | 244 | 흰 면은 `--color-surface-raised`/`--color-canvas`, 사진 위 반투명 흰색 등은 의도 판단 필요(**결정 필요**: 다크에서 흰 데모 면을 뒤집을지) |
| 그 밖(데모 고유색 101종: 파스텔 #ffe3d6 ×48, #c9e2ff ×17, #ffc342 ×16 등 + `rgba` 80) | 약 384 + 80 | 예시 사진·상품·지도 배경. **서비스 의미 토큰으로 못 바꾼다.** `--dict-*` 전용 값으로 한 곳에 모으는 안 권장 |
| `linear/radial/conic-gradient` | 60/18/3 | 사진 대용 배경이 대부분. 위와 같음 |

→ 기계 치환 가능: 약 1,390곳(65%). 결정 필요: 흰/검정 244 + 옛 팔레트 56. 데모 고유: 약 460.

### UT-4.3 색 말고 모양

- 원본 글자 크기 27종, 모서리 반경 20종, 인라인 `style=` 125곳. 서비스 토큰 규칙("숫자 직접 쓰기 금지", 4px 간격, `--text-*` 12~36px)은 **앱 틀(머리말·검색·분류·카드 바깥)**에는 그대로 적용할 수 있다. **데모 안(휴대폰 화면을 축소해 보여 주는 9.5~13px 미니어처)**에 같은 규칙을 적용하면 모양이 깨진다. 두 층으로 나누는 안 권장: 틀은 토큰 엄격 적용, 데모 무대는 색·선 굵기만 토큰, 크기는 원본 유지. `tokens.md`에 이 예외를 적어야 한다(UI Designer·PO 결정).
- 다크·ZIGZAG(`data-scheme`, `data-theme`) 두 축은 `var()` 치환분은 따라온다. 리터럴·그라디언트는 따라오지 않으므로 다크에서 눈으로 점검 필요(원본은 라이트 전용).
- `prefers-reduced-motion`은 원본에 0건(애니메이션 `@keyframes` 33, `rAF` 33, `setInterval` 17)이다. CSS 한 블록(`animation`·`transition` 끄기)은 쉽지만 JS로 움직이는 데모에는 안 먹는다. NFR-22를 사전 탭에도 적용할지 PO 결정.

### UT-4.4 권장안 (UT-4)

① 기계 치환 규칙(변수 9개 + 같은 값 리터럴 109)을 먼저 적용한다. ② 흰/검정 244와 옛 팔레트 56은 UI Designer가 샘플 5~10개 분류별로 정한 규칙을 문서에 남긴다. ③ 데모 고유색은 `--dict-tint-*` 같은 전용 변수로 모은다. ④ `--font-mono`를 신규 토큰으로 추가하거나 시스템 스택으로 간다. ⑤ 원본 이름 `--blue`(주황)를 그대로 쓰지 않도록 치환표에 값 기준으로 적는다.

---

## UT-5. innerHTML 보안(XSS)과 클립보드 권한

### UT-5.1 HTML 삽입 경로 점검 (실측: 패턴 검색 + 표본 정독, **전수 정독은 아님**)

- 삽입 API: `innerHTML` 151회(106행), `insertAdjacentHTML` 3회. 위험한 함수(`eval`, `new Function`, `document.write`, `outerHTML`, 인라인 `on…=`, `javascript:`, 문자열 안 `<script`) 0건.
- **사용자가 입력한 글이 HTML로 들어가는 곳**을 찾았다: 입력 값(`.value`)이 삽입 문자열(`${…}`)에 직접 들어가는 곳 **0건**. 입력은 `textContent`로 넣거나(채팅·태그·댓글 입력), `esc()`(9곳)를 거친다(하이라이트·인라인 편집).
- 가장 의심스러운 곳: 검색·자동완성(원본 1836행) — `${d.replace(q, `<mark>${q}</mark>`)}`에서 `q`가 사용자 입력이다. 그러나 `d`는 후보에서 `d.includes(q)`로 걸러진 값이고 후보는 고정 한글 과일 이름 14개(`<` 없음)라 `q`가 `<`를 포함하면 후보에 맞지 않아 걸러진다. 일치가 없으면 고정 문구 `검색 결과가 없어요`만 나온다. 같은 구조의 지도 검색(2288행)은 후보를 고정 배열에서만 꺼낸다.
- 위험도: 이 사전에는 URL·저장소·서버 응답에서 오는 입력이 **없다**(`location`, `localStorage`, `fetch` 0). 설령 우회가 있어도 본인 브라우저에서 본인이 입력하는 자기 자신 대상 XSS 수준이다. C안의 `sandbox="allow-scripts"`(출처 없음) iframe이면 서비스의 로그인 토큰(`localStorage`)에도 못 닿는다(이 경우 테마는 쿼리로 전달, 클립보드는 `allow="clipboard-write"` 필요).
- 서비스 규칙 NFR-29("HTML 삽입 API 사용 0건")는 차계부 입력용이다. 이 사전에는 그대로 적용하면 A안만 통과하므로, **적용 범위를 "사용자 입력이 들어간 삽입 0건 + 고정 문자열 삽입 허용"**으로 따로 정하는 안을 권장한다. 코드 검색으로 강제하는 간단한 테스트(`${…value…}`가 `innerHTML` 안에 있으면 실패)를 둔다.

### UT-5.2 정적 데이터를 React로 옮기면 사라지는 위험

- 이름·영문·설명 310개(`<`·`&` 없음, 실측)는 React의 일반 텍스트 렌더로 충분하다. 데모 HTML 문자열(정적 템플릿)만 A안에서 JSX로 바뀌면 `innerHTML`이 0이 된다. B·C안은 정적 템플릿 삽입이 남지만 그 안에 사용자 값이 섞이지 않게 위 테스트로 막는다.

### UT-5.3 클립보드 (문서: MDN Clipboard API, 열람 2026-11-25)

- **호출 위치는 3곳**: `설명 리스트`(1141행), `복사 버튼`(1284행), `2D 컬러 피커`(1810행). "7곳"은 `clipboard`라는 단어가 7번 나오는 횟수(실측 `writeText` 3회). 셋 다 클릭 처리기 안이다.
- 조건: ①보안 컨텍스트(HTTPS 또는 localhost)에서만 `navigator.clipboard`가 있다. 배포는 HTTPS라 충족, **개발 중 휴대폰으로 `http://<PC 주소>`로 열면 실패**한다. ②쓰기는 사용자 동작(클릭 등 transient activation)이 필요하다(Firefox·Safari는 `clipboard-write` 권한 자체를 지원하지 않아 이 동작에 의존). ③`iframe`에서는 Permissions-Policy `clipboard-write`가 허용돼야 한다 — 같은 출처 iframe은 기본 허용으로 알려져 있으나 이 조사에서 확인하지 못했고(**미확인**), 출처 없는 `sandbox` iframe은 `allow="clipboard-write"`가 필요하다.
- **원본 결함**: `try{ navigator.clipboard.writeText(…) }catch{}`는 비동기 거부(`NotAllowedError`)를 못 잡는다. 실패해도 "복사했어요" 안내가 뜨고 콘솔에 처리 안 된 거부가 남는다. 이식 때 `.then/.catch`로 성공·실패를 나누는 수정이 필요하다 — "내용 그대로" 원칙의 예외로 PO 승인 필요(동작 설명이 아니라 안내 문구의 정확성).
- 권한 프롬프트: 쓰기에는 별도 프롬프트가 없다(Chrome·Firefox·Safari). 읽기는 쓰지 않는다.

### UT-5.4 권장안 (UT-5)

① 삽입 문자열에 입력 값이 섞이지 않는지 확인하는 테스트 1개를 둔다. ② 클립보드 3곳은 실패 처리를 고친다(안내 문구 승인). ③ 개발 중 모바일 확인은 HTTPS(터널 또는 배포 미리보기)로. ④ 위 점검은 패턴 검색이므로, 이식 때 삽입 106행을 한 번 더 눈으로 훑는 작업을 티켓에 넣는다.

---

## v0.3 열린 질문

| # | 질문 | 결정자 | 권장 |
|---|---|---|---|
| Q-U1 | 이식 방식: C(iframe, 원본 코드 그대로) vs B(Shadow DOM 이식) vs A(React 전면). 프로토타입 1분류로 비교한 뒤 정할지 | Software Architect | C로 시작, 프로토타입 5가지 측정(UT-1.3)으로 확정 |
| Q-U2 | 탭 라벨(2~3자 권장)과 경로 이름, `/x/` 끝 슬래시 처리 | Product Owner·UI Designer | 라벨 2~3자 |
| Q-U3 | 사전 탭에도 WCAG 2.2 AA·동작 줄이기(NFR-22)를 적용하는가. 원본은 `aria-label` 43개·`prefers-reduced-motion` 0 | Product Owner | 틀(검색·분류)은 적용, 데모는 가능한 범위(CSS로 끌 수 있는 것) |
| Q-U4 | 새 NFR: 첫 방문 → 첫 카드 표시(예: 2초, Fast 4G, 30회 p95)와 재방문(100ms) | Product Owner·Spec Writer | 위 값 제안 |
| Q-U5 | 디자인 토큰 적용 범위(틀 엄격 / 데모 무대 색·선만), 흰·검정 244곳과 옛 팔레트 56곳 규칙, `--font-mono` 신규 | UI Designer·Product Owner | UT-4.4 |
| Q-U6 | JetBrains Mono(Google Fonts 외부 요청) 제거 또는 유지 | Product Owner | 제거, 시스템 고정폭 |
| Q-U7 | 클립보드 실패 안내를 고쳐도 되는가(내용 그대로 원칙의 예외) | Product Owner | 허용 |
| Q-U8 | NFR-29를 사전 탭에 어떻게 적용할지(고정 문자열 삽입 허용 + 입력 값 삽입 0건) | Software Architect | 위 안 |
| Q-U9 | 동작 회귀 확인 기준: 원본 실행은 금지였다. QA가 원본을 직접 열어 대조해도 되는가 | Product Owner | 허용(QA 한정) |

## v0.3 출처

- 원본(텍스트로만 읽음, 실행·브라우저 열기 없음): `C:/Users/a9163/Downloads/ui.html`(473,979B). 구문 검사 `node --check`, 번들러 최소화 rolldown 1.2.8, 타입 검사 `tsc` 6.0.3(앱 설정), `oxlint`는 모두 복사본에 대해 실행(코드 실행 없음). 복사본은 작업 폴더 밖 임시 폴더에 두었다.
- 저장소(코드): `src/App.tsx`(196~215행), `src/carbook/FileTabs.tsx`, `src/carbook/FileTabs.module.css`, `src/carbook/navigation.ts`, `src/styles/tokens.css`, `src/styles/global.css`, `vite.config.ts`, `vercel.json`, `tsconfig.app.json`, `.oxlintrc.json`, `dist/assets/*`(2026-11-21 빌드).
- 저장소(문서): `docs/00_brief.md`(v0.3 Brief), `docs/04_nfr.md`(NFR-01·02·07·12·13·16·17·22·23·29·30), `docs/design/tokens.md`, `docs/adr/`(ADR-001·002).
- 공식 문서(열람 2026-11-25): MDN `Clipboard.writeText()`와 Clipboard API(보안 컨텍스트, 쓰기 시 transient activation, iframe의 Permissions-Policy, Firefox·Safari의 `clipboard-write` 권한 미지원) — https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText , https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API (GitHub `mdn/content` 원문으로 읽음).
- 브라우저 지원 자료(열람 2026-11-25): caniuse 데이터(`Fyrd/caniuse`의 `css-cascade-scope`, `css-nesting`, `shadowdomv1`) — `@scope` iOS Safari 17.4+·Firefox 146+, CSS 중첩 iOS Safari 16.5~17.1 부분·17.2+ 완전, Shadow DOM v1 Chrome 53·Firefox 63·Safari 10.
- 실행한 것: 원본 텍스트 검색·계수(`grep`·`awk`·`node`), 복사본 `node --check`·rolldown·`tsc`·`oxlint`, 문서·데이터 `curl` 4건. 앱 실행·브라우저 측정·모바일 실기기는 하지 않았다.
