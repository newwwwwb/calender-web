# 컨텍스트 노트

작업 중 내린 결정과 이유를 계속 추가한다.

## 2026-09-15 · 초기 결정

- **스택**: React + Vite + TypeScript, Vercel 배포. 캘린더는 클라이언트 중심 SPA라 Next.js까지 필요 없다.
- **형태**: 반응형 웹사이트. PWA(설치·오프라인)는 요청하지 않아서 넣지 않는다.
- **저장소 순서**: localStorage로 먼저 만들고 Supabase(로그인 + DB) 동기화는 마지막 단계로 미룬다(사용자 요청). 나중에 교체가 쉽도록 저장소는 인터페이스 뒤에 둔다.
- **의존성 최소화**: 날짜 계산은 `date-fns`만 쓴다. 반복 규칙은 매일/매주/매월/매년 + 종료 조건 정도라 rrule 라이브러리 없이 직접 구현한다. UI 라이브러리 없이 CSS Modules로 레퍼런스를 구현한다.
- **반응형 기준**: 768px 미만은 모바일(사이드바 숨김, 바텀시트), 이상은 데스크탑(사이드바 + 모달).
- **디자인 레퍼런스**: 원티드(Montage) 재구성 문서.
  - `#0066ff`는 액션·선택(오늘, 선택일, 주요 버튼)에만 쓴다.
  - 제목 `#171719`, 본문 `#333333`, 메타 `#858688`, 배경 `#ffffff` / `#f8f8f8`, 구분선 `#e8e9ea`.
  - 라운드는 컨트롤 8px, 카드 12px, 오버레이 16px. 기본은 플랫, 메뉴/모달만 옅은 그림자.
  - 폰트는 Pretendard Variable. Wanted Sans는 레퍼런스상 실제 UI에 쓰이지 않으므로 쓰지 않는다.
  - 일요일·공휴일 색과 카테고리 색은 레퍼런스에 없지만 캘린더에 필요하다. 채도를 낮춘 색으로 제한해 쓴다.
- **v1 제외**: 드래그 이동/리사이즈, 알림, 외부 캘린더 연동.
- **진행 방식**: 단계를 N.1, N.2로 쪼개 하위 작업마다 커밋하고, 단계가 끝나면 ponytail로 점검한다(사용자 요청).

## 2026-09-15 · 1단계 ponytail 점검

- 점검 대상: 스캐폴드, vitest 설정, tokens.css/global.css, Header/Sidebar/App 셸.
- 미사용 토큰(`--color-sunday`, `--font-size-event-title` 등)은 2단계 이후 컴포넌트에서 바로 쓰일 예정이고, 레퍼런스 디자인 시스템 전체를 담는 1.4 작업물이라 지금 깎지 않고 유지하기로 결정.
- CSS 클래스·토큰 실사용 전수 확인, `oxlint` 클린. 수정 없이 통과.

## 2026-09-15 · 공휴일 데이터 검증

- lib/holidays.ts 작성 전 WebSearch로 2026·2027년 공휴일을 교차 검증. 자동 수집 사이트 한 곳(publicholidays.co.kr)의 2027년 표에 현충일·크리스마스 대체공휴일이 잘못 포함돼 있어 제외함 — 현행 규정상 신정·현충일·크리스마스는 대체공휴일 대상이 아님(부처님오신날은 대상, 이 부분은 헷갈리기 쉬워 별도 검색으로 재확인).
- 설날·추석은 "일요일과 겹칠 때만" 대체공휴일이 적용되고 토요일 겹침은 적용 안 됨(2026년 추석 9/26 토요일 겹침에도 대체공휴일 없음, 뉴스 기사로 확인) — 국경일(삼일절/광복절/개천절/한글날)은 토·일 모두 적용되는 것과 다름.
- 제헌절은 2026년부터 18년 만에 공휴일로 복원되어 2026·2027 모두 포함.

## 2026-09-15 · 2단계 ponytail 점검

- `date.ts`의 `parseDateTimeKey`가 문자열 길이를 포맷 문자열 길이와 비교해 종일/시간 여부를 구분하던 부분을 `key.includes('T')`로 교체 — 동작은 같지만 의도가 바로 드러나게 수정.
- 나머지(types/holidays/recurrence/storage)는 아직 UI에서 쓰이지 않지만, 도메인을 먼저 만들고 3단계부터 화면에 연결하는 순서라 당연한 상태 — 불필요한 코드로 보지 않음.
- CRUD 반복(이벤트/카테고리)을 제네릭 팩토리로 합칠지 검토했으나, 엔티티가 2종류뿐이고 인터페이스가 이미 이름을 못박아 둬 오히려 read­ability만 떨어진다고 판단, 그대로 둠.

## 2026-09-15 · 3.3 MonthView 시각 확인 (playwright-cli)

- playwright-cli로 데스크탑(1280px)·모바일(390px) 스크린샷 확인. 그리드·오늘 표시·공휴일 빨간 표시·사이드바 숨김 모두 의도대로 동작.
- 모바일 폭에서 Header의 "캘린더" 제목이 어색하게 줄바꿈됨 — 1.5의 정적 헤더에 반응형 처리가 없어서 발생. 지금은 스코프 밖(3단계는 월 보기 기능 자체가 목표)이라 손대지 않고, 7단계(반응형 다듬기)에서 헤더 레이아웃을 정리하기로 함.

## 2026-09-15 · 3단계 ponytail 점검

- 점검 대상: useCalendar 상태, MonthView, Header 동적화, EventEditor, CategoryList.
- 실질적으로 고칠 부분 없음. CSS 클래스 실사용 전수 확인(EventEditor의 `.button`은 composes 베이스라 정상), 디버그 로그·포커스/스킵 테스트 없음 확인.
- CategoryList의 add/edit 두 상태를 단일 판별 유니언으로 합칠지 검토했지만 리팩터링 이득이 적어 보류.

## 2026-09-15 · 4단계 ponytail 점검

- MonthView/TimeGridView/AgendaView 세 곳이 "일정이 어느 날짜에 표시되는가" 규칙을 각자 조금씩 다르게 구현하고 있던 걸 발견 — 특히 MonthView는 시간대 다일(多日) 일정을 걸치는 모든 날짜에 표시했지만 TimeGridView/AgendaView는 시작일에만 표시해 뷰마다 동작이 달랐음(잠재 버그).
- `lib/recurrence.ts`에 `allDayInstanceCoversDay`/`timedInstanceStartsOnDay` 두 규칙을 추출해 세 뷰가 공유하도록 통일 — 이제 어디서 바꾸든 한 곳만 고치면 됨. 테스트 3개 추가.
- CSS 클래스 실사용 전수 확인(EventEditor `.button`은 이번에도 composes 베이스라 정상), 디버그 로그·포커스 테스트 없음 확인.

## 2026-09-15 · 5.1 배선 수정 중 발견한 기존 버그

- 지금까지 MonthView/TimeGridView/AgendaView가 `onSelectEvent(instance.event)`로 반복 일정의 원본 템플릿만 넘기고 있어서, 반복 일정의 특정 회차를 클릭해 수정하면 EventEditor가 그 회차의 실제 날짜가 아니라 시리즈의 원본 시작일을 보여주는 버그가 있었음(반복 생성 UI가 아직 없어서 이번까지 드러나지 않았음).
- `EventInstance` 전체를 넘기도록 수정하고 EventEditor가 `instance.start/end`로 폼을 채우도록 고침 — "이 회차만 수정"의 전제 조건이기도 함.

## 2026-09-15 · 5단계 ponytail 점검

- EventEditor.tsx가 397줄까지 커지고 JSX 들여쓰기도 일부 깨져 있어서, 반복 규칙 UI(빈도/간격/요일/종료조건)를 `RecurrenceFields.tsx`로 분리하고 들여쓰기를 정리. EventEditor 332줄, RecurrenceFields 122줄로 나뉨. 동작은 동일 — 테스트 109개 전부 그대로 통과, 화면도 재확인.
- CSS 클래스 실사용 전수 확인(파일이 나뉜 뒤에도 EventEditor.module.css를 RecurrenceFields.tsx와 함께 검사), 디버그 로그 없음 확인.
- `DEFAULT_EVENT_COLOR`(새 일정 기본색, #6366f1)와 `FALLBACK_EVENT_COLOR`(색이 아예 없는 옛 데이터용 렌더링 안전망)는 목적이 달라 의도적으로 분리 유지.

## 2026-09-15 · 6단계 ponytail 점검

- CSS 미사용 클래스 검사에서 대량의 "UNUSED"가 나왔지만, 직접 확인해보니 검사 스크립트 자체의 버그(grep -c 출력 포맷 오해)였고 실제 코드 문제는 없었음 — 재확인 후 스크립트를 고쳐 다시 돌림.
- Header와 useKeyboardShortcuts 양쪽에 "보기 전환 시 선택일 기준으로 currentDate를 맞추는" 동일한 2줄 로직이 중복돼 있던 걸 발견 — useCalendar Context에 `changeView` 액션으로 옮겨 양쪽이 공유하도록 정리. 관련 테스트도 fireEvent로 act 래핑 문제 없이 통과 확인.
- 디버그 로그·포커스 테스트 없음 확인, App.tsx는 103줄로 여러 훅(useKeyboardShortcuts/useSwipeNavigation)에 관심사를 잘 위임해 관리 가능한 크기 유지.

## 2026-09-15 · 7.1 Header 모바일 레이아웃 정리

- 1단계 이후 계속 미뤄뒀던 "캘린더" 제목 줄바꿈 문제를 해결. 768px 미만에서 앱 이름과 "+ 새 일정"(이미 하단 FAB가 대신함)을 숨기고, `.spacer`에 `flex: 0 0 100%`를 줘서 flex-wrap 컨테이너의 강제 줄바꿈 지점으로 사용 — 1행 "‹ › 오늘 [날짜]", 2행 "🔍 [보기 전환]"으로 깔끔하게 2줄로 접힘. 마크업 변경 없이 CSS만으로 해결.

## 2026-09-15 · 7.2 반응형 전체 점검

- 375px 등 좁은 화면에서 MonthView의 공휴일 이름("추석 연휴" 등)이 셀 경계를 넘어 삐져나오는 문제 발견 — `.cell`(grid item)과 `.holidayName`(flex item)에 `min-width: 0`이 없어서, grid/flex item 기본 min-width(콘텐츠 크기)가 트랙 폭을 밀어내던 게 원인. 둘 다 `min-width:0` 추가로 해결, ellipsis가 정상 동작.
- **실제 버그 발견**: 일정 제목 등 입력창에 포커스가 있을 때 Esc를 눌러도 모달이 안 닫히던 문제 — `useKeyboardShortcuts`가 "입력 중엔 모든 단축키 무시" 검사를 Esc보다 먼저 해서 막고 있었음. Esc는 입력 포커스 여부와 무관하게 항상 처리하도록 순서를 바꿔 수정, 회귀 테스트 추가.
- 375px/1024px/1280px 폭에서 월·주·목록 보기, EventEditor(바텀시트), SearchDialog 모두 playwright-cli로 재확인.

## 2026-09-15 · 7.3 Vercel 배포

- GitHub 저장소(newwwwwb/calender-web) push, Vercel Import로 배포 완료: https://calender-web-ten.vercel.app/
- playwright-cli로 배포본 실제 점검: 콘솔 에러 0개, 데스크탑/모바일 레이아웃·폰트·공휴일 표시 로컬과 동일, 일정 생성·저장까지 정상 동작 확인. 확인 중 만든 테스트 데이터는 localStorage.clear()로 정리.

## 2026-09-15 · 7단계 ponytail 점검

- CSS 미사용 클래스 재검사(EventEditor `.button`은 이번에도 composes 베이스라 정상), 디버그 로그 없음, 작업 트리·커밋에 불필요한 파일 없음 확인. 수정 사항 없이 통과.

## 2026-09-15 · 8.4 supabaseRepository.ts에서 발견한 빌드 에러

- 생성자 파라미터 프로퍼티(`constructor(private client: SupabaseClient, private userId: string) {}`)를 썼더니 `npm test`(vitest)는 통과했지만 `npm run build`(tsc -b)에서 `TS1294`(erasableSyntaxOnly 옵션과 충돌) 발생 — vitest는 esbuild로 트랜스파일해 이 제약을 검사하지 않기 때문. 명시적 필드 선언 + 생성자 본문 할당으로 고침.
- **교훈**: 테스트 통과만으로 "완료"라고 판단하면 안 되고, 매 하위 작업마다 `npm run build`까지 확인해야 함(CLAUDE.md 8번 규칙과 일치).

## 2026-09-15 · 8.5 로그인 시 repository 전환 + 마이그레이션

- `useCalendar.tsx`의 `CalendarProvider`가 `repository` prop이 명시적으로 주입되지 않았을 때만 `useAuth()`의 `user` 상태를 보고 `LocalEventRepository`/`SupabaseEventRepository`를 전환하도록 함. 기존 컴포넌트 테스트들은 전부 `repository` prop으로 `FakeRepository`를 고정 주입하므로 auth 로직이 개입하지 않아 그대로 통과.
- 마이그레이션은 `localStorage`의 `calendar.migratedToSupabase` 플래그로 1회만 수행 — 로그인할 때마다 같은 로컬 데이터를 다시 insert하면 같은 id로 PK 충돌이 나기 때문. 마이그레이션이 실패하면(네트워크 에러 등) 플래그를 세우지 않고 조용히 로컬 모드로 남는다 — 개인용 앱이라 재시도 UI 없이 다음 로그인 때 다시 시도되는 정도로 충분하다고 판단(YAGNI).
- 마이그레이션 후에도 로컬 데이터는 지우지 않음 — 마이그레이션이 부분 실패해도 데이터가 남아있도록 하는 안전망. 로그아웃 후 로컬에서 새로 추가한 데이터는 다음 로그인 때 자동으로는 안 올라감(재마이그레이션 안 함) — v1 범위 밖으로 남겨둠.
- 테스트: `useCalendar.auth.test.tsx`를 새로 만들어 `vi.doMock`으로 `lib/supabaseClient`/`state/useAuth`를 모킹. 처음엔 mock `useAuth`가 렌더마다 새 `user` 객체 리터럴을 반환해 effect 의존성(`[user, repository]`)이 매번 바뀌어 무한 리렌더 → 메모리 부족으로 워커가 죽는 문제가 있었음 — mock에서 `user` 객체 참조를 고정해 해결(실제 `useAuth.ts`는 `useState`로 참조가 안정적이라 프로덕션 버그는 아니었음).

## 2026-09-15 · 8단계 ponytail 점검 (정적 검토, 8.2~8.5 대상)

- 대상: `supabaseClient.ts`, `useAuth.ts`(+테스트), `AuthButton.tsx`(+테스트), `supabaseRepository.ts`(+테스트), `useCalendar.tsx`의 전환 로직, `schema.sql`.
- 디버그 로그·TODO·`.only`/`.skip` 없음 확인. `AuthButton`이 재사용한 `Header.module.css`의 `.todayButton` 클래스 실존 확인. RLS 정책(select/insert/update/delete 각각 `auth.uid() = user_id`) 4테이블×확인 문제없음.
- 수정 사항 없이 통과 — 코드 자체는 이 상태로 완료. 다만 **실제 로그인·마이그레이션 동작(구글 OAuth, 실 데이터 업로드)은 8.1(Supabase 프로젝트 생성)이 끝나 URL/anon key를 받아야 브라우저로 검증 가능** — 그 전까지는 목(mock) 테스트로만 검증된 상태임을 기록해 둠.

## 2026-09-15 · 9단계 설계 결정 (캘린더 공유)

- 사용자 확인: 공유 방식 = 초대 링크, 권한 = 보기 전용, 표시 = 겹쳐보기 + 캘린더별 표시 토글(둘 다 지원, 상호 배타 아님).
- 스키마: `calendar_shares`(공유 링크 자체, id=토큰) + `calendar_share_members`(수락한 사람) 2테이블로 분리 — 링크 하나를 여러 명이 수락할 수 있게 하기 위함(이메일 1:1 초대가 아니라 링크 공유라서).
- `profiles` 테이블을 따로 만들지 않고, 공유 생성/수락 시점에 이메일을 각 행에 그대로 저장(owner_email/viewer_email) — auth.users는 anon key로 조인 조회가 안 되고, 이메일 표시용 필드 하나 때문에 새 테이블+동기화 로직을 만드는 건 과함(YAGNI).
- `calendar_shares` select는 "로그인만 하면 누구나" 허용 예정 — 초대 링크를 수락하려면 상대가 id(추측 불가능한 uuid)로 그 행을 조회할 수 있어야 하는데, RLS는 "그 id를 어떻게 알았는지"는 구분 못 함. 링크 URL 자체가 비밀이라는 전제(구글 문서 공유 링크와 동일한 패턴)로 감수하기로 함.
- events/categories의 기존 "select own" 정책은 그대로 두고 "select shared"(공유받은 소유자의 데이터도 허용) 정책을 추가 — Postgres RLS는 같은 커맨드의 permissive 정책을 OR로 합치므로 기존 정책 수정 없이 추가만 하면 됨.

## 2026-09-15 · 10단계 설계 결정 (ZIGZAG 참고 테마 토글)

- 사용자가 준 ZIGZAG 참고 디자인 시스템 문서는 근거 기반 재구성 문서라 액센트/버튼/CTA/hover 등 많은 토큰이 의도적으로 비어있음(문서 자체가 "근거 없으면 채우지 말라"는 정책 명시). 그래서 액센트 색(`#0066ff`)과 기능색(오늘 표시 등)은 그대로 두고, 중립색(`#121212`/`#292b2b`/`#878f91`/`#ecedee`)과 카드 모서리(0px, 기존은 12px)만 테마별로 바꾸기로 함.
- 이미 1.4에서 `tokens.css`를 CSS 변수로 분리해뒀기 때문에 새 라이브러리 없이 `[data-theme="zigzag"]` 선택자로 값만 덮어쓰면 됨 — 구조 변경 불필요.

## 2026-09-15 · 10.3 playwright-cli로 두 테마 확인 중 발견한 버그

- `--radius-card`(12px) 토큰이 1.4에서 정의된 이후 지금까지 어떤 컴포넌트 CSS에서도 실제로 쓰인 적이 없었음(전수 grep으로 확인) — 그래서 10.1에서 ZIGZAG 테마의 "카드 0px 라운드"를 이 토큰에 얹었지만 시각적으로 아무 효과가 없는 상태였음. `ShareSection.module.css`의 `.linkRow`(공유 링크를 감싸는 테두리 박스, 이 앱에서 유일하게 "카드"라고 부를 만한 요소)가 `--radius-control`을 쓰고 있던 걸 `--radius-card`로 바꿔 토큰이 실제로 동작하도록 고침.
- 두 테마 모두 데스크탑(1280px)·모바일(390px)에서 playwright-cli로 확인: 콘솔 에러/경고 0개, 카테고리 추가 플로우 정상, `localStorage`에 테마가 저장되어 새로고침 후에도 유지됨. ZIGZAG 테마는 근거 문서 자체가 Montage와 매우 가까운 중립색을 쓰고 있어(둘 다 진한 회색조) 육안상 차이가 미묘한 것이 정상(설계 의도와 일치).

## 2026-09-15 · 10단계 ponytail 점검

- 디버그 로그·TODO 없음, `ThemeToggle.module.css`에 미사용 클래스 없음(전수 확인), `--radius-card`가 10.3에서 고친 대로 실제로 한 곳(ShareSection linkRow)에서 쓰이는 것도 재확인.
- CSR SPA라 첫 로드 시 React가 마운트되기 전까지는 `data-theme`이 안 붙어 아주 짧게 기본 테마로 보일 수 있음(FOUC성) — ZIGZAG 색상 차이가 원래 미묘해서(위 항목 참고) 체감상 거의 안 보이는 수준이라 index.html에 테마 결정 인라인 스크립트를 넣는 등의 추가 작업은 하지 않음(ponytail: 필요해지면 그때 추가).
- 수정 없이 통과. `npm test`(177개) · `npm run build` · `npm run lint` 재확인.
- 세션 중 `npx skills add ... --skill caveman`으로 caveman 스킬을 프로젝트 범위로 설치하면서 `.agents/`, `.claude/`, `skills-lock.json`이 생겨 `.gitignore`에 추가(앱 소스가 아닌 로컬 도구 설정).

## 2026-09-15 · 9.6 공유 UI — 라우팅/빌드에서 발견한 것들

- **SPA 라우팅**: react-router 없이 `App.tsx`가 `window.location.pathname`을 정규식(`/^\/share\/([^/]+)$/`)으로 직접 검사해 `/share/:id`일 때만 `AcceptSharePage`를 렌더링. 경로가 이거 하나뿐이라 라우터 라이브러리를 추가하지 않음(YAGNI).
- **Vercel 배포 시 새로고침/직접 접속 404 문제**: `/share/:id`로 직접 접속(딥링크)하면 정적 호스팅은 해당 경로에 실제 파일이 없어 404가 남 — `vercel.json`에 `rewrites: [{source: "/(.*)", destination: "/index.html"}]`를 추가해 모든 경로가 `index.html`로 폴백되도록 함. 이 프로젝트 첫 `vercel.json`(7단계 배포 때는 Vite 자동 감지만으로 충분해서 안 만들었음).
- **로그인 후 리다이렉트 문제**: `useAuth.signInWithGoogle()`은 기존에 `redirectTo` 없이 호출해 Supabase 프로젝트의 기본 Site URL로 돌아왔음. 공유 링크로 들어온 비로그인 사용자가 로그인 후 다시 `/share/:id`로 돌아와야 초대를 수락할 수 있으므로, `signInWithGoogle(redirectTo?: string)`로 확장해 `AcceptSharePage`가 `window.location.href`를 넘기도록 함. 기존 `AuthButton`은 인자 없이 호출해 동작 그대로 유지.
- **빌드에서만 잡힌 타입 에러**: `AuthButton`이 `onClick={signInWithGoogle}`로 함수 참조를 그대로 넘기고 있었는데, `signInWithGoogle`에 `redirectTo?: string` 파라미터가 생기자 `onClick`이 넘기는 `MouseEvent`가 `redirectTo` 자리에 들어가는 타입 불일치가 `tsc -b`에서만 발생(vitest는 esbuild라 안 잡음) — `onClick={() => signInWithGoogle()}`로 수정. 8.4에 이어 또 한 번 "테스트만으로는 부족, 빌드까지 확인" 사례.

## 2026-09-15 · 9.7 겹쳐보기 렌더링

- `useCalendar`에 `shownEvents`(hiddenOwnerIds로 거른 이벤트)를 추가하고 MonthView/TimeGridView(주·일 공용)/AgendaView/SearchDialog가 기존 `events` 대신 이걸 쓰도록 교체 — "겹쳐보기 토글"이 검색 결과에도 일관되게 적용됨.
- 공유받은 일정(내 소유가 아닌 이벤트)만 소유자별 색(`lib/ownerColor.ts`, 공유자 순서로 고정 팔레트 배정)을 추가로 표시 — 월/주/일 보기는 제목 앞 작은 점, 목록 보기는 제목 뒤 이메일 텍스트. 기존 카테고리/이벤트 색(5.5)은 그대로 두고 "누구 캘린더인지"만 별도 신호로 덧붙이는 방식으로, 기존 색 체계를 건드리지 않음.
- **겹쳐보기 도입으로 드러난 버그**: `DataBackup`(가져오기)이 현재 `events`(공유받은 남의 일정 포함) 전부를 지우고 새로 쓰려고 했는데, 남의 일정은 RLS가 delete를 막아 그 시점에서 에러가 나며 복원이 중간에 멈추는 문제가 있었음 — 내보내기/가져오기 모두 `ownerId`가 없거나 내 id인 것만(`myEvents`/`myCategories`) 대상으로 하도록 수정. 9.4에서 `ownerId`를 노출하면서 생긴 부작용을 9.7에서 바로 잡음.

## 2026-09-15 · 9단계 ponytail 점검

- **버그 발견**: `ownerColorFor`가 `sharedOwnerIds.indexOf(ownerId)`로 -1이 나오면(sharedCalendars가 아직 로드 안 됐거나 공유가 취소된 뒤 남은 이벤트) `PALETTE[-1 % 6]` = `PALETTE[-1]` = `undefined`가 되어 점 색이 안 보이는 문제 — `Math.max(index, 0)`으로 항상 유효한 색을 반환하도록 수정, 회귀 테스트 추가.
- `ShareSection.test.tsx`의 테스트 이름 하나가 실제로 검증하지 않는 내용("안내 문구를 보여주고")을 주장하고 있어 제목만 정리(로직/동작 변경 없음).
- 디버그 로그·TODO·`.only`/`.skip` 없음, 새/수정 CSS 모듈 전부 실사용 클래스만 있음(ShareSection/AcceptSharePage 신규 클래스 + MonthView/TimeGridView/AgendaView의 ownerDot/ownerTag 전수 확인).
- **의도적으로 남겨둔 것**: 이미 수락한 초대 링크를 다시 열면 `unique(share_id, viewer_id)` 제약으로 `acceptShareLink`가 에러를 던지고 "다시 시도해주세요"가 뜸(데이터는 이미 정상 — 멤버십이 이미 있으니 실질적 문제는 없고 메시지만 어색함). 개인용 앱 규모에서 "이미 수락됨" 별도 분기를 만들 정도는 아니라고 판단해 보류.
- `EventEditor`/`CategoryList` 등 기존 CRUD 액션에는 try/catch가 전혀 없는 게 이 코드베이스의 기존 관례(에러는 그냥 던져서 콘솔에 남음) — `ShareSection.copyLink`도 이 관례를 따라 try/catch 없이 둠. 반면 `AcceptSharePage.accept()`는 예외적으로 try/catch로 실패 메시지를 보여주는데, 외부 링크로 들어오는 단독 페이지라 다른 실패 신호(콘솔 등)에 사용자가 접근할 수 없기 때문— 의도적 예외로 기록.
- 수정 사항(ownerColor 버그 픽스 1건, 테스트 제목 1건) 반영 후 `npm test`(173개) · `npm run build` · `npm run lint` 재확인, 전부 통과.

## 2026-09-15 · 11단계 설계 결정 (할 일 목록)

- Todo CRUD는 별도 `TodoRepository`를 새로 만들지 않고 기존 `EventRepository`에 4개 메서드를 추가하는 방식을 택함 — 이 인터페이스가 이미 이벤트+카테고리 두 엔티티를 한 곳에 묶어두고 있고(2단계 점검 노트는 "CRUD 보일러플레이트를 제네릭화하지 말자"는 뜻이지 "엔티티별 인터페이스 분리"가 아니었음), 로그인 상태 기반 Local↔Supabase 전환·1회 마이그레이션 로직(8단계)이 단일 `repo` 인스턴스에 의존하므로 별도 리포지토리를 만들면 그 로직을 통째로 복제해야 했음.
- Todo는 개인 전용(공유 대상 아님), 캘린더 뷰(월/주/일/목록)에는 렌더링하지 않고 Sidebar/모바일 바텀시트 전용 패널로만 노출 — `AgendaView`의 `bucketByDay`가 반복 전개된 `EventInstance` 전용이라 날짜 없는 Todo를 섞으려면 어댑터가 필요했고, 스코프를 넘는다고 판단.
- `TodoList`는 `CategoryList`의 "보기 행 ↔ 인라인 편집 행" 패턴을 그대로 재사용, 완료 토글은 별도 `toggleTodo` API 없이 `updateTodo({...todo, done: !todo.done})`을 직접 호출(불필요한 API 표면 추가 안 함).
- 모바일(Sidebar가 숨는 768px 미만)에서는 `EventEditor`의 오버레이→바텀시트 반응형 CSS 패턴을 `TodoSheet`로 복제, Header에 `✅` 버튼을 새로 추가해 열도록 함(같은 CSS 클래스를 `composes`로 가져와 기본은 숨기고 모바일 미디어쿼리에서만 보이게 함 — 기존 `.title/.newEventButton { display:none }`과 반대 방향 적용).

## 2026-09-15 · 11단계 ponytail 점검

- **버그 발견**: `DataBackup`(내보내기/가져오기)이 `events`/`categories`만 다루고 새로 추가된 `todos`는 빠져있었음 — 로컬 데이터 백업·이전 수단이라는 이 컴포넌트의 목적상 실제 기능 누락. `BackupFile.todos`를 선택 필드로 추가(예전 백업 파일과 호환, 없으면 빈 배열)하고 내보내기/가져오기 로직에 포함, 회귀 테스트 추가.
- 디버그 로그·TODO·`.only`/`.skip` 없음, `TodoList`/`TodoSheet` CSS 모듈 전수 확인(미사용 클래스 없음).
- playwright-cli로 데스크탑(1280px, Sidebar "할 일" 섹션: 추가/마감일 정렬/완료 토글/취소선)과 모바일(390px, Header ✅ 버튼 → TodoSheet 바텀시트) 모두 실제 확인, 콘솔 에러 0개.
- 수정 사항(DataBackup todos 누락 1건) 반영 후 `npm test`(191개) · `npm run build` · `npm run lint` 재확인, 전부 통과.

## 2026-09-15 · 8.1 실 Supabase 키 수신 및 검증

- 사용자가 URL/anon key(`sb_publishable_...` 새 형식) 전달, `.env.local`에 저장(gitignore `*.local`로 커버, 추적 안 됨).
- REST API로 `categories/events/todos/calendar_shares/calendar_share_members` 5개 테이블 전부 200 응답 확인 — SQL 3개(schema/schema_share/schema_todos) 정상 실행됨.
- playwright-cli로 로그인 버튼 클릭 → 처음엔 `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`(Google OAuth 미설정) → 사용자가 Google Cloud Console에서 OAuth 클라이언트 만들고 Supabase에 연결한 뒤 재시도하니 실제 Google 로그인 화면(`accounts.google.com`)까지 정상 도달 확인.
- **실제 계정으로 로그인 완료 → 마이그레이션 → 공유 초대 수락까지의 전체 E2E는 아직 미검증**(에이전트가 실제 구글 계정 자격증명으로 로그인할 수 없음) — 사용자가 직접 브라우저에서 로그인해봐야 최종 확인 가능.
- `.env.local`이 새로 생기면서 `createClient(...)` 분기가 죽은 코드로 제거되지 않게 되어 번들에 `@supabase/supabase-js`가 실제로 포함됨(이전 빌드는 키가 없어 이 분기 전체가 tree-shaking으로 빠져 있었음) — 빌드 산출물이 311kB→531kB로 커짐(정상 동작, 버그 아님). 코드 스플리팅은 지금 범위 밖.

## 2026-09-15 · 12단계 — 실사용 피드백 3건(로그인 표시 안 됨/테마 체감 안 됨/설정 위치)

- **배포본에서 로그인 실 테스트**: 환경변수(Vercel) + Supabase URL Configuration(Site URL/Redirect URLs)까지 다 맞춘 뒤 실제로 Google 로그인 화면까지는 도달하는데, 로그인 후에도 "로그인" 버튼이 안 바뀌는 문제 보고받음. 실제 계정으로 재현이 안 되는 상태라 원인 특정 대신 `useAuth.ts`에 진단 로깅만 추가(`getSession` 에러, `onAuthStateChange` 이벤트명, 리다이렉트 URL의 `error`/`error_description`) — 사용자가 재시도해서 콘솔을 보내주면 다음 단계에서 실제 원인 수정.
- **ZIGZAG 테마 체감 문제**: playwright-cli로 `--color-heading` 등 CSS 변수가 실제로 바뀌는 것까지 확인했지만, 근거 문서의 중립색이 기본 디자인과 워낙 가까워 사용자에게는 "안 바뀐 것 같다"는 인상을 줌. `--radius-overlay:0px`/`--shadow-overlay:none`을 zigzag 테마에 추가해 이 앱의 모든 모달(EventEditor/SearchDialog/TodoSheet/SettingsModal 등)이 각지고 그림자 없이 바뀌도록 확장 — 문서가 관찰한 "0px 카드/box-shadow:none" 특성을 모달까지 넓힌 것이라 근거 없는 값 추가는 아님. 액센트 색은 여전히 안 건드림.
- **설정 위치 재구성**: "데이터"(백업)와 "디자인"(테마)을 Sidebar 섹션에서 빼서 `SettingsModal`(신규, `TodoSheet`와 같은 오버레이→모바일 바텀시트 패턴 재사용)로 묶고, Header에 항상 보이는(데스크탑+모바일 공통) `⚙` 버튼으로 열도록 함. 원래 Sidebar가 768px 미만에서 아예 숨어서 모바일에서는 데이터 백업·테마 선택에 접근할 방법이 없었는데, 이번에 Header 트리거로 옮기면서 그 문제도 같이 해결됨(의도된 부수 효과).
- **테스트 격리 버그 발견**: `.env.local`에 실제 Supabase 키가 생기자 Vite가 `mode=test`(vitest 기본값)에도 이 파일을 로드해버려서, `useAuth`가 실제 프로덕션 Supabase에 진짜 네트워크 요청을 하게 됐고 `App.test.tsx`의 `/share/:id` 테스트가 비동기 타이밍 차이로 깨짐(loading 상태가 `Boolean(supabase)`로 바뀌어 `true`가 됨). `.env.test.local`에 두 변수를 빈 값으로 덮어써서 테스트는 항상 `supabase === null`(로그인 안 된 상태)로 격리되도록 고침 — 실제 키가 로컬에 있어도 테스트가 프로덕션 서비스에 접근하지 않는다는 걸 보장하는 게 목적.

## 2026-09-15 · 12단계 실사용 검증 결과

- **로그인 버그 원인 확정**: 진단 로깅을 배포한 뒤 사용자가 받은 에러가 `Unable to exchange external code: 4/0A...` — Supabase가 구글에 인증 코드를 최종 교환하는 단계에서 실패한다는 뜻으로, Google Client Secret이 잘못 등록돼 있었음(Supabase Provider 설정의 Client Secret을 재발급 값으로 교체해서 해결). 로그인 성공 후 스크린샷으로 "로그아웃" 버튼·공유 캘린더 섹션(내 캘린더 토글, 공유 링크 UI)이 정상 표시되는 것까지 확인 — 12.1의 진단 로깅이 실제로 원인을 잡는 데 결정적이었음.
- **ZIGZAG 모달 변화가 "캐시 때문에 안 보인 것"으로 추정된 사례**: 사용자가 로그인 직후 찍은 스크린샷에서는 설정 모달이 여전히 둥근 모서리+그림자로 보였지만, 곧바로 playwright-cli로 배포본에 직접 접속해 `data-theme` 전환 → `border-radius:0px`/`box-shadow:none` 반영을 확인함 — 코드는 정상이었고, 배포 직후 캐시된 페이지를 보고 있었을 가능성이 높다고 결론.

## 2026-09-15 · 13단계 ZIGZAG 액센트 색

- 모달 각짐/그림자·중립색만으로는 사용자가 "색이 하나도 안 바뀐다"고 느낄 만큼 체감이 약했음 — 액센트 색(`--color-primary`, 오늘 표시/선택일/버튼/링크에 전역적으로 쓰임)까지 바꾸는 건 ZIGZAG 참고 문서의 근거 범위 밖이라고 먼저 확인 질문했고, 사용자가 "액센트 색까지 바꾸기"로 명시적으로 승인.
- 참고 문서가 언급한 레거시 핑크 `#fa6ee3`를 그대로 쓰려 했으나, 흰 배경 대비 2.5:1로 WCAG AA(4.5:1) 미달이라 텍스트/버튼에 실사용하기엔 접근성 문제가 있음 — 같은 색상 계열에서 더 진한 `#c2185b`(대비 5.87:1)로 조정해 브랜드 느낌은 유지하면서 실제로 읽히게 함. 문서에 없는 값을 새로 정하는 결정이라 tokens.css 주석에 근거와 이유를 남김.
- playwright-cli로 로컬에서 "오늘" 날짜 표시가 파란색→핑크로 바뀌는 것까지 실제 확인.

## 2026-09-15 · 14단계 구글 캘린더풍 화면 구성

- 사용자가 준 구글 캘린더 스크린샷 기준으로 4가지 확인 후 전부 반영: 보기 전환 알약(pill), 미니 캘린더 점 표시, 헤더 재배치, 일정 블록 진하고 둥글게. 색 자체는 요청하지 않아서 손대지 않음 — 이미 전부 `--color-primary` 등 토큰이라 테마 전환 시 자동으로 맞음(기본=파랑, ZIGZAG=13단계에서 정한 핑크).
- **미니 캘린더**: 표시 월을 `currentDate`에 직접 연동(별도 상태 없음) — 메인 뷰 이동과 자동으로 같이 움직임. 날짜 클릭은 `setView` 호출 없이 `selectedDate`/`currentDate`만 옮겨서 지금 보던 뷰(월/주/일/목록)를 유지 — MonthView 셀 클릭(5.6, 일 보기로 강제 전환)과는 의도적으로 다르게 동작. 일정 있는 날짜 점은 MonthView의 `eventsOnDay` 판정 로직(`allDayInstanceCoversDay`/`timedInstanceStartsOnDay`)을 그대로 재사용.
- **일정 블록 tint**: `resolveEventTint(color)`가 hex 색에는 `26`(약 15% 알파)을 붙이고, `resolveEventColor`의 CSS 변수 폴백(hex 아님)에는 `var(--color-subtle)`로 안전하게 대체 — 문자열 이어붙이기라 hex 여부를 미리 안 걸러내면 `var(--color-secondary)26`처럼 깨진 값이 나갈 뻔한 걸 설계 단계에서 미리 방지.
- **헤더 재배치**: 마크업 순서만 바꾸고 각 버튼의 `aria-label`/텍스트는 그대로 둬서 기존 `Header.test.tsx`가 수정 없이 통과 — 라벨 기반 쿼리라 DOM 순서에 의존하지 않는다는 걸 재확인.
- 테스트에서 `vi.useFakeTimers()`(오늘 날짜 고정)와 `FakeRepository`의 비동기 초기 로드(Promise 기반)를 같이 쓰면 `findBy*`/`waitFor`가 내부적으로 `setTimeout` 폴링에 의존해 가짜 타이머 아래서 타임아웃남 — `await act(async () => {})`로 마이크로태스크만 직접 플러시해서 해결(`MiniCalendar.test.tsx`).
- playwright-cli로 데스크탑(1280px)·모바일(390px), 기본·ZIGZAG 테마 4가지 조합 전부 스크린샷 확인, 콘솔 에러 0개.

## 2026-09-15 · 14.5~14.6 실사용 피드백 + 설정 기능 추가

- 헤더의 이전/다음 화살표가 붙어있던 걸 월 타이틀 양옆(`< 2026년 9월 >`)으로 재배치 — 마크업 순서만 바꿈.
- 설정 모달에 "기본 보기" 셀렉트 추가(`useDefaultView.ts`, `ThemeToggle`/`useTheme`과 완전히 같은 localStorage 패턴). `useCalendar.tsx`의 `view` 초기값을 `readDefaultView()`로 바꿔서 다음 방문부터 반영, 설정 화면에서 바꾸면 `changeView()`로 지금 화면에도 바로 적용.

## 2026-09-15 · 15단계 서브에이전트+보스 리뷰 — 1라운드

사용자가 애초에 지정한 절차(모든 구현 끝나면 서브에이전트 여러 개 + "혹독한 보스"로 반복 검증)를 시작. 코드 품질/보안/배포본 실사용 UX 3개 에이전트를 병렬로 돌림.

- **보안 리뷰에서 critical 발견**: `supabase/schema_share.sql`의 `calendar_shares_select_authenticated` 정책("로그인만 하면 누구나 select 가능", 9단계에서 "링크 URL 자체가 비밀"이라는 전제로 의도적으로 채택했던 부분)과 `calendar_share_members_insert_self` 정책(`auth.uid() = viewer_id`만 확인)이 합쳐지면, **초대 링크를 한 번도 받은 적 없는 로그인 사용자도 `calendar_shares` 테이블을 통째로 select해서 모든 공유 id를 알아낸 뒤, 아무 id로나 스스로를 멤버 등록해 남의 캘린더(일정·카테고리 전체)를 구독할 수 있었음**. 9단계 당시 "링크를 아는 사람에게 소유자 이메일 정도가 보이는" 수준으로 과소평가했던 트레이드오프가 실제로는 "초대 링크 접근 제어 자체가 무력화"되는 수준이었음 — 문서화된 트레이드오프였다고 안심하지 말고 다시 검증해야 한다는 교훈.
- **즉시 수정**(`supabase/schema_share_fix.sql`, 신규 마이그레이션 — 사용자가 SQL 에디터에서 실행해야 적용됨): `calendar_shares` select를 소유자 전용(`auth.uid() = owner_id`)으로 좁히고, `calendar_share_members` insert 정책은 제거. 대신 `get_share_owner(share_id)`(초대 화면이 소유자 이메일 보여줄 때)와 `accept_share(share_id)`(수락) 두 SECURITY DEFINER 함수로만 접근 허용 — 정확한 id를 아는 사람만 그 한 건에 접근 가능하고, 목록 열람 자체가 불가능해짐. `src/storage/supabaseShareRepository.ts`의 `getShareLink`/`acceptShareLink`를 REST 직접 호출에서 `.rpc()` 호출로 교체, 테스트도 RPC 모킹으로 갱신.
- **확인된 것(문제 없음)**: events/categories/todos의 update/delete는 전부 본인 것만(공유로 인한 수정·삭제 구멍 없음), XSS 벡터 0건(dangerouslySetInnerHTML 등 미사용), service_role 키 노출 없음, `.env.local`/`.env.test.local` 커밋 이력 없음, OAuth redirectTo는 항상 `window.location.href`만 씀(open redirect 없음), 공유 링크 id는 DB `gen_random_uuid()`라 추측 불가능.
- 코드 품질/배포본 UX 리뷰 결과는 진행 중 — 완료되는 대로 이어서 기록.
