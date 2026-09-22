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

## 2026-09-15 · 15단계 서브에이전트+보스 리뷰 — 2라운드(내가 직접 보스 역할)

- 4번째(코드품질/보안/UX 3개 결과를 종합 판정하는 "보스") 에이전트가 계정 월 지출 한도(HTTP 429)로 실패. 재시도는 같은 한도에 다시 걸릴 가능성이 커서, 사용자의 "중단된 작업 이어서 진행" 지시에 따라 보스 역할(각 서브에이전트 주장을 코드로 직접 검증, 우선순위 판단, 수정)을 내가 직접 수행함.
- **홀리데이 팩트체크**: 코드 리뷰 에이전트가 "제헌절은 2008년부터 공휴일 아님"이라고 주장했는데 이전 세션의 자체 조사(context-notes)와 상충 — WebSearch로 직접 확인한 결과 제헌절은 2026년부터 부활 예정이라 에이전트가 틀렸음(코드 수정 안 함). 반대로 "2027-12-25(토) 크리스마스도 2023년 법 개정으로 대체공휴일 적용 대상"이라는 별도 주장은 맞아서 holidays.ts에 반영 — 서브에이전트 보고를 그대로 믿지 않고 항목별로 따로 검증한 사례.
- **자기 수정의 회귀**: 15.2에서 `calendar_shares` select를 소유자 전용으로 좁힌 게 보안상 맞는 방향이었지만, PostgREST의 임베디드 조인(`.select('calendar_shares(...)')`)도 그 테이블의 RLS를 그대로 타는 걸 놓쳐서 `listSharedWithMe()`(공유받은 캘린더 목록)가 아예 빈 배열만 반환하게 됨 — 코드 리뷰 에이전트가 잡아냄. `calendar_shares_select_own_or_member`(소유자 OR 이미 수락한 멤버)로 정책을 넓혀 해결(`schema_share_fix2.sql`). 보안 수정이 다른 기능을 조용히 깨뜨릴 수 있다는 걸 재확인 — RLS 정책을 좁힐 때는 그 테이블을 참조하는 모든 임베디드 쿼리를 같이 점검해야 함.
- **모바일 접근성 공백**(사용자가 리뷰 도중 직접 제보: "원래 사용할 수 있는 기능들이 모바일로 넘어가면서 화면에 표시되지 않아서 사용할 수 없어"): `Sidebar.module.css`가 768px 미만에서 사이드바 전체를 숨기는데, 그 안의 카테고리 관리와 공유 캘린더(링크 생성·수락·멤버 관리)는 Sidebar에만 있어서 모바일에서 완전히 접근 불가였음. 할 일은 이미 `TodoSheet`(모바일 전용 바텀시트)로 대응돼 있었어서 같은 패턴 대신, 이미 모바일에서도 항상 보이는 Header ⚙ → `SettingsModal`에 두 섹션을 추가하는 쪽을 택함(새 UI 패턴을 안 늘리고 기존 진입점 재사용) — 카테고리는 15.4에서 먼저 발견해 넣었고, 공유 캘린더는 이번에 마저 추가. `MiniCalendar`는 보조 내비게이션(헤더 화살표로 대체 가능)이라 범위에서 제외.
- playwright-cli로 iPhone 15 뷰포트에서 설정 모달을 열어 "공유 캘린더" 섹션이 실제로 보이는 것까지 확인.

## 2026-09-15 · schema_share_fix2.sql이 낸 RLS 무한 재귀 버그

- 사용자가 "공유 링크 만들기가 작동 안 한다"고 제보, 콘솔에 `42P17 infinite recursion detected in policy for relation "calendar_shares"`.
- 원인: fix2.sql에서 `calendar_shares_select_own_or_member` 정책이 `calendar_share_members`를 EXISTS 서브쿼리로 직접 조회하도록 넓혔는데, `calendar_share_members_select`(schema_share.sql)가 반대 방향으로 `calendar_shares`를 서브쿼리로 조회하고 있어서 두 정책이 서로를 무한히 참조하게 됨 — fix2.sql 리뷰 때 이 상호 참조를 놓쳤음.
- 수정(`schema_share_fix3.sql`): `calendar_shares` 쪽 멤버십 확인을 `is_share_member()` SECURITY DEFINER 함수로 옮겨 그 안에서는 RLS를 다시 안 타게 해서 순환을 끊음. RLS 정책 두 개가 서로 다른 테이블을 참조할 때는 항상 순환 여부를 같이 점검해야 한다는 교훈 — SECURITY DEFINER 함수 경계가 그 순환을 끊는 표준 패턴.

## 2026-09-15 · 마이그레이션 완료 플래그 키 이름 변경이 낸 재마이그레이션 버그

- 사용자 제보: `POST .../events 409 (Conflict)`, `duplicate key value violates unique constraint "events_pkey"`.
- 원인: 15.3.10에서 마이그레이션 플래그 키를 전역(`calendar.migratedToSupabase`)에서 사용자별(`calendar.migratedToSupabase.<uid>`)로 바꿨는데, 이 사용자는 이미 예전 전역 키로 마이그레이션을 마친 상태였음. 새 키 기준으로는 "마이그레이션 안 함"으로 보여서 로그인할 때마다 이미 Supabase에 있는 이벤트를 다시 insert하려다 unique 제약 위반으로 계속 실패.
- 수정: 옛 전역 키(`LEGACY_MIGRATED_KEY`)도 같이 확인해서, 있으면 재마이그레이션 없이 바로 새 키를 세우고 넘어가도록 함. 키 이름을 바꾸는 마이그레이션 플래그는 항상 이전 키와의 하위 호환을 같이 챙겨야 한다는 교훈 — 이번처럼 "존재 여부만 확인하는 idempotent 플래그"라도 이름이 바뀌면 과거 상태가 안 보이는 게 아니라 완전히 새로 시작한 것처럼 취급돼서 부작용(중복 insert)이 남.

## 2026-09-17 · 16단계 애플 디자인 원칙 적용 — 초기 결정

- apple-design 스킬(WWDC Designing Fluid Interfaces 등) 기준으로 배포본과 코드를 검토. 핵심 공백: transition/animation 0건(오버레이 즉시 mount/unmount), 스와이프는 touchend 판정만(추종·속도 없음), 바텀시트 끌어 닫기 없음, backdrop-filter·letter-spacing·prefers-* 0건. 추가로 월 보기 `.cell`(button)이 right/bottom 테두리만 지정해 브라우저 기본 2px 테두리가 남아 격자선이 두껍게 보이던 버그 발견.
- **motion 라이브러리 도입 — "의존성 최소화(date-fns만)" 원칙의 의도적 예외(사용자 결정)**. 이유: 중단 가능한 스프링, 드래그 속도 이어받기, exit 애니메이션(AnimatePresence)을 직접 구현하면 코드량과 버그 위험이 더 큼.
- 스프링 값: 기본 `bounce 0, duration 0.4`(critically damped), 시트 `bounce 0.2, duration 0.3`(애플 drawer damping 0.8/response 0.3). 바운스는 손가락 속도를 받은 경우에만.
- ZIGZAG 테마는 플랫 성격 유지 — 재질(반투명·blur)은 토큰으로만 넣고 zigzag에선 불투명.
- 범위 제외: 다크 모드, 일정 드래그 이동/리사이즈(v1 제외 결정 유지).

## 2026-09-17 · 16.5 스와이프를 터치 기반 훅에서 motion 드래그로 전면 교체

- 기존 `useSwipeNavigation`(touchend 판정만, 이동 중 피드백 없음)을 삭제하고 `SwipeableViewport` 컴포넌트로 대체. Motion의 `drag="x"` + `useDragControls`를 써서 pointerdown 시점에 `pointerType !== 'mouse'`인 경우만 `dragControls.start()`로 드래그를 시작 — 데스크톱 클릭과 충돌하지 않는다.
- 방향(다음/이전) 판정은 별도 "direction" 상태를 두지 않고, 렌더 시점에 이전 `currentDate`와 비교해 자동으로 계산한다(ref에 저장). 이 덕분에 헤더 ‹›·키보드 ←→·미니 캘린더·스와이프 등 `currentDate`를 바꾸는 모든 경로가 손대지 않고도 같은 방향 슬라이드를 얻는다. `view` 자체가 바뀔 때는 슬라이드 대신 크로스페이드.
- 드래그 종료 시 `project(velocity)`로 투사한 위치가 뷰포트 폭의 30%를 넘으면 `onSwipe`로 커밋, 아니면 `dragSnapToOrigin`으로 복귀. 커밋 시 속도를 ref에 저장해 다음 렌더의 스프링 `transition.x.velocity`로 한 번만 소비(그다음 프로그램적 이동은 다시 0으로 리셋) — 손가락 속도가 진입 애니메이션까지 자연스럽게 이어지게 함.
- **검증 한계**: playwright-cli에는 실제 멀티터치 제스처 명령이 없어 `element.dispatchEvent(new PointerEvent(...))`로 흉내냈다. 이 방식은 진짜 터치 드래그(pointerdown→pointermove→pointerup)는 잘 재현해 스와이프 커밋을 확인했지만, 브라우저가 자체적으로 합성하는 tap→click은 재현하지 못해 "터치로 날짜 칸을 탭했을 때도 클릭이 그대로 동작하는지"는 실기기로 확인되지 않았다 — 마우스 클릭은 정상 동작 확인함. Motion의 `dragListener={false}` + 수동 시작 패턴은 실사용에서 흔히 쓰이는 방식이라 문제 없을 것으로 보되, 실제 모바일 기기(또는 CDP 터치 인젝션)로 재확인이 필요하면 이 노트를 참고할 것.

## 2026-09-17 · 16단계 완료 + ponytail 정리

- 228개 테스트/빌드/lint 통과, playwright-cli로 데스크톱·모바일 × 기본·ZIGZAG 4조합 전부 확인(콘솔 에러 0). `prefers-contrast: more`/`reducedMotion`/`reducedTransparency` 에뮬레이션도 확인.
- ponytail 점검에서 안 쓰는 코드 발견: Overlay가 경계 저항을 motion의 `dragElastic`으로 이미 처리해서, 직접 만든 `rubberband()` 함수와 `springStatic` 프리셋이 어디서도 호출되지 않고 있었음 — 삭제(테스트도 같이 정리, 231→228개).
- 진행 중 사용자가 배포본 스크린샷으로 "반복이 제대로 안 되는 것 같다"고 제보(임베디드/공강/Spring-Boot/캡스톤 디자인이 9월 셋째 주에만 보이고 다음 주부터 안 보임). `expandRecurrence`/`occurrenceDates` 순수 함수로 동일 시나리오(목요일 매주, byWeekday 있음/없음, 월 그리드 전체 범위) 재현 테스트를 임시로 돌려봤으나 둘 다 정상적으로 다음 주(9/24)까지 나옴 — 로직 자체는 문제없음 확인. 임베디드는 사용자가 애초에 반복을 설정 안 한 것으로 확인됨. Spring-Boot/캡스톤 디자인은 "매주로 설정해놨음"이라는데 실제 라이브 데이터(반복 드롭다운·요일 체크박스·종료조건 실제 값)를 직접 확인 못 해 원인 미해결 — 사용자가 다음에 이어서 확인하기로 하고 16단계 작업으로 복귀함. **다음에 이어볼 것**: 사용자가 실제 이벤트를 열어 반복 설정값을 알려주면 그 값 그대로 재현 테스트 시도.

## 2026-09-17 · 17단계 공유 양방향 — 초기 결정

- 사용자 요청: "공유 링크를 가진 상대와 서로의 캘린더를 확인". 기존엔 수락자만 소유자 캘린더를 봤음(`events_select_shared`가 한 방향만 검사).
- 관계를 대칭으로 정의: 나와 X 사이에 멤버십 행이 하나라도 있으면(내가 소유자든 수락자든) 서로 파트너. 판정은 `is_share_partner(p_other)` SECURITY DEFINER 함수로 — fix3에서 겪은 정책 간 무한 재귀를 피하려고 RLS를 다시 타지 않게 함.
- 보기 전용 유지(수정·삭제 정책은 그대로 본인 것만). todos는 공유 대상 아님(기존과 동일).
- `listSharedWithMe()`는 필터 없이 `calendar_share_members`를 조회 — 기존 RLS가 이미 "내가 수락자이거나 링크 소유자인 행"만 돌려주므로, 행마다 viewer_id가 나면 소유자를, 아니면 수락자를 상대로 고른다.
- 주의: SQL 실행 즉시 기존에 수락된 공유도 전부 양방향이 된다. 상대 목록은 로그인/새로고침 때만 갱신(실시간 반영은 범위 밖).

## 2026-09-17 · 17단계 완료

- 230개 테스트/빌드/lint 통과. diff 자체 재검토(ponytail) 결과 불필요한 추상화 없음 — 계획대로 최소 변경.
- **사용자 액션 필요**: `supabase/schema_share_mutual.sql`을 Supabase SQL 에디터에서 실행해야 실제로 양방향이 적용됨. 실행 즉시 기존에 수락된 공유도 전부 양방향으로 바뀜.

## 2026-09-17 · 17.6 accept_share 파라미터명 충돌 버그 (실사용 제보)

- 사용자 제보: 초대 수락 시 `POST .../rpc/accept_share 400`, `{"code":"42702","message":"column reference \"share_id\" is ambiguous"}`.
- 원인: `accept_share(share_id uuid)`의 파라미터명이 `calendar_share_members.share_id` 컬럼명과 같음. `INSERT ... ON CONFLICT (share_id, viewer_id)` 절은 PL/pgSQL 변수와 컬럼명이 겹치면 어느 쪽을 가리키는지 판단 못 해 에러를 낸다 — schema_share_fix.sql에서 함수를 처음 만들 때부터 있던 잠재 버그(get_share_owner/is_share_member는 이미 p_ 접두어로 구분했는데 accept_share만 놓침).
- 수정: 파라미터명을 `p_share_id`로 변경(`supabase/schema_share_fix4.sql`, 사용자가 SQL 에디터에서 실행 필요), 클라이언트 RPC 호출도 `{ p_share_id: id }`로 맞춤(`supabaseShareRepository.ts`), 테스트 갱신.
- 교훈: PL/pgSQL 함수 파라미터명은 항상 관련 테이블 컬럼명과 겹치지 않게 짓는다(p_ 접두어 등) — 특히 INSERT ON CONFLICT 대상 목록에서 잘 드러남.

## 2026-09-17 · 18단계 반복 일정 검증 — 결론

- 사용자 요청으로 recurrence.ts 순수 로직을 라인 단위 재추적 + Explore 에이전트 교차검증. interval+byWeekday 조합/until 경계/count 기준/월말 규칙/Supabase jsonb 왕복 전부 iCal RRULE 표준과 일치, 버그 없음.
- **"공강" 사고의 실제 원인**: 코드 문제 아님. 종일 일정의 "종료" 필드(그 일정 자체 길이)를 반복종료일과 같은 3개월 뒤로 잘못 입력 → 매주 수/금마다 3개월짜리 종일 일정이 새로 시작되어 누적 중첩. 스크린샷의 주별 개수 증가 패턴을 직접 계산해 정확히 일치함을 확인. 사용자가 종료일을 시작일과 같게 고치면 즉시 해결(안내 완료).
- 다만 감사 중 **실제 버그 2건 발견**(둘 다 자체 테스트로 이미 증명 가능한 상태):
  - 버그 A: EventEditor "전체 일정" 저장 시, 클릭한 회차의 날짜(`common.start`)로 시리즈 원본 앵커(`event.start`)가 조용히 재설정됨 — `EventEditor.test.tsx:359-371`가 이 틀린 동작을 그대로 기대값으로 박아놓고 있었음.
  - 버그 B: "반복 종료: 날짜까지" 선택 시 `until` 초기값이 시작일과 같아서, 사용자가 날짜를 안 만지고 저장하면 반복이 즉시 끝남 — "다음 주부터 안 보인다" 제보의 유력 후보.
- 18단계 범위: 버그 A/B 수정, 종일+다일치+반복 조합 경고 문구(이번 사고 재발 방지), 반복 요약 문구(사람이 읽는 한 줄), 테스트 공백 보강. 반복 아이콘·새 반복 옵션·이중 확인 다이얼로그는 범위 밖으로 명시적 제외.

## 2026-09-17 · 18단계 완료

## 2026-09-17 · 19단계 설계 결정 (함께 일정)

- 사용자 요청: 공유 중인 상대와 "같이 하는 일정"을 만들고, 상대가 수락/거절하며 일정을 맞추고, 앱 내 알림을 받고 싶음. 두 방향(A. 일정별 참여자 초대 / B. 별도 공동 캘린더)을 HTML 목업(claude.ai artifact)으로 비교해 사용자가 A를 선택. 이후 "상대가 수락하면 서로의 캘린더에도 일정 추가"라는 추가 요청이 있었는데, 논의 끝에 "같이 하는 일정이라는 티가 나야 한다"는 방향으로 정리되어 A(참여자 초대 방식, 확정되면 두 색 테두리+겹친 프로필+"함께" 표시)로 확정.
- 참여자는 이미 공유 링크로 연결된 상대(`is_share_partner`)에서만 선택 — 새 초대 UI를 따로 만들지 않음(YAGNI).
- 작성자가 일정마다 "수락 요청"(pending) / "바로 등록"(accepted) 선택. 참여자별 색·카테고리는 만들지 않음(YAGNI) — 카테고리·색은 작성자만 수정 가능.
- 삭제는 작성자만, 참여자는 "참여 취소"(=거절)로 대체 — RLS가 참여자의 delete를 막을 것이므로 UI에서 아예 버튼을 안 보여줌.
- 반복하는 함께 일정은 참여자가 수정할 때 "전체 일정" 범위만 허용 — "이 일정만"/"이후 전체"는 참여자 없는 새 일정을 만들어버리기 때문(EventEditor의 excludeOccurrence/truncateRecurrenceBefore + addEvent 경로).
- 알림은 앱 내(헤더 종+배지)만, Realtime 없이 앱 열 때/60초 주기/창 포커스 시 확인 — 개인용 앱 규모에서 브라우저 푸시(서비스워커·서버 함수 필요)는 과함(YAGNI, 사용자 확인).
- Plan 에이전트 검토로 발견한 위험 반영: supabaseRepository의 update가 항상 `user_id: this.userId`를 보내던 기존 동작이 참여자가 저장하면 소유자를 바꿔버릴 수 있어 update 페이로드에서 user_id를 제외하도록 설계. RLS 정책 간 상호 참조는 SECURITY DEFINER 헬퍼로 끊기(17단계 42P17 재발 방지 교훈 재적용), 함수 파라미터는 `p_` 접두어(17.6 교훈 재적용).
- 상세 계획은 `~/.claude/plans/calender-sunny-diffie.md`에 있음. SQL은 19.1과 19.6 두 번 실행 필요.

## 2026-09-17 · 19단계 구현 완료 (19.1~19.10)

- 305개 테스트/빌드/lint 통과. playwright-cli로 로그아웃 상태 데스크톱(1280px)·모바일(390px, iPhone 15) 확인 — 월/주 보기, 새 일정 모달 모두 회귀 없음, 콘솔 에러 0개. 실제 함께 일정 흐름(초대→수락→알림)은 에이전트가 구글 계정으로 로그인할 수 없어 검증 못 함 — **사용자가 두 계정으로 직접 확인 필요**.
- **사용자 액션 필요(SQL 2개)**: `supabase/schema_together.sql` → `supabase/schema_together_notifications.sql` 순서로 SQL 에디터에서 실행. 실행 전까지는 `listEvents`가 PGRST200을 잡아 참여자 없이 정상 동작(캘린더 안 비어 보임)하지만 함께 일정 기능 자체는 못 씀.
- ponytail 점검: 디버그 로그·TODO·.only/.skip 없음. CSS 미사용 클래스 재확인 — `EventEditor.module.css`의 `.button`(기존 composes 베이스), `JointBadge.module.css`의 `.badge`(composes 베이스), `TogetherFields.tsx`의 `status_pending`/`status_declined`(동적 `styles[\`status_${status}\`]` 접근이라 정적 grep에 안 잡힘)는 전부 실사용 확인됨 — 실제 미사용 없음.
- 19.5 계획을 실행 중 조정: `respondToEvent`/`setEventParticipants`는 구현체(togetherRepository)가 나오는 19.6에서 useCalendar에 연결(계획엔 19.5로 돼 있었음). 19.6의 알림 SQL은 계획대로 schema_together.sql에 이어붙이지 않고 새 파일(`schema_together_notifications.sql`)로 분리 — `create table`은 재실행이 안 되기 때문, 기존 fix1~4 관례와 동일.
## 2026-09-17 · 19단계 혹독한 보스 리뷰 (서브에이전트 6개 병렬 + 직접 검증)

사용자 지정 최종 절차대로 서브에이전트 6개를 병렬로 돌려 DB/RLS 보안, 클라이언트 데이터 무결성, 모바일 UX(에디터/알림), 모바일 UX(캘린더 뷰), 테스트 커버리지, 알림 시스템 견고성을 각각 점검받고, 각 주장을 실제 코드와 대조해 직접 검증한 뒤 수정했다(서브에이전트 보고를 그대로 믿지 않는다는 기존 관례 재적용).

**즉시 수정한 진짜 버그:**
- **[치명적] 월 보기 칩에서 JointBadge가 폭을 다 먹어 일정 제목이 0글자로 잘림** — `JointBadge`에 `variant="dots"`를 추가해 월 보기에서는 텍스트 배지 없이 참여자 점만 표시(대기 상태는 칩 자체의 점선 테두리로 이미 전달됨).
- **`respond_to_event`가 멱등하지 않아 같은 초대를 반복 수락/거절할 때마다 작성자에게 알림이 중복으로 쌓임** — 상태가 실제로 바뀔 때만 update+알림 insert하도록 수정(`schema_together_notifications.sql`).
- **`setParticipants`가 userId만 보고 diff해서 거절한 사람을 다시 체크해도 재초대가 안 됨**(2단계 저장 필요했음) — declined 상태면 delete+재insert하도록 diff 로직 수정.
- **RLS가 참여자의 category_id/color 변경을 막지 않음**(클라이언트에서만 막고 있었음, raw API로 우회 가능) — `events_lock_identity` 트리거가 소유자가 아닌 update일 때 category_id/color도 고정하도록 확장.
- **함께 일정 쓰기 실패가 조용히 묻힘**(모달이 이미 닫힌 뒤라 사용자가 모름) — 참여자 초대/응답/삭제 흐름에 `window.alert` 최소 에러 처리 추가(기존 DataBackup 관례를 따름).
- **거절 버튼이 "취소"와 똑같이 생겨서 위험한 동작이라는 게 안 보임** — `buttonDanger` 스타일로.
- **참여자 체크박스 터치 영역이 44px 미만** — `.checkboxRow`에 padding 추가.
- **대기/거절 상태 텍스트가 WCAG AA 대비 미달**(12px에 옅은 색) — pending은 본문색으로, declined는 배경을 채운 알약으로.
- **월/주 보기 점선 테두리가 카테고리 색과 섞여 거의 안 보임** — 중립색(`--color-secondary`)으로 덮어써 목록 보기와 시각 언어 통일.
- TimeGridView `.eventBlock`에 `white-space:nowrap`/`text-overflow:ellipsis` 누락(배지 추가로 줄바꿈 위험 커짐) — `.chip`과 동일하게 보강.
- 테스트 공백 보강: 반복+함께 일정 조합(작성자가 이미 함께인 반복 일정 수정, 작성자가 기존 반복 일정에 처음 초대), 이미 초대된 사람 중복 후보 방지, `useNotifications` 로그아웃 시 폴링/리스너 정리, `respondToEvent`/`setEventParticipants`의 로컬 모드 no-op, TimeGrid/Agenda의 "함께"(accepted) 상태 표시 — 316개로 증가.

**검토했지만 의도적으로 안 고친 것(YAGNI/기존 관례와 일치):**
- 알림 패널을 열면 모든 알림이 즉시 읽음 처리돼, 다른 기기/탭에서는 아직 안 봤어도 다음 폴링부터 읽음으로 보임 — 이 프로젝트의 "Realtime 없음, 기기별 읽음 상태 없음" 기존 방침과 일치하는 단순화.
- 알림 패널을 닫았다 열면 이미 응답한 초대도 수락/거절 버튼이 다시 보임(세션 로컬 상태라 초기화됨) — `respond_to_event`가 멱등해졌으므로 다시 눌러도 이제 안전한 무해 동작이라 심각도가 낮아짐, 추가 상태 저장은 과함.
- Header가 모바일에서 종 아이콘 때문에 3번째 줄로 넘어갈 수 있다는 지적 — 이미 `flex-wrap:wrap`이 걸려 있어 넘치면 그냥 줄이 늘어날 뿐 클리핑/오버플로는 없음, 실제 버그 아님.
- 새 일정에 참여자를 초대하는 두 비동기 호출(addEvent→setEventParticipants) 사이의 아주 좁은 레이스 — alertOnFailure 추가로 실패 시 최소한 조용히 묻히진 않게 됨, 그 이상의 낙관적 잠금은 개인용 앱 규모에서 과함.
- DB/RLS 감사에서는 크리티컬/하이 이슈 없음, 소유자가 참여자를 처음부터 'accepted'로 넣을 수 있는 것(바로 등록)은 의도된 동작으로 확인.

이후 SQL 2개(`schema_together.sql`→`schema_together_notifications.sql`)를 사용자가 실행하고 실제 두 계정으로 E2E 검증하면 19단계 마무리.

## 2026-09-17 · 19단계 배포 + SQL 실행 확인

- 커밋 13개 push(사용자 요청), Vercel 배포본 번들(index-Dpaz231G.js)이 로컬 빌드와 동일하고 함께 일정 코드 포함 확인, 배포본 콘솔 에러 0개.
- 사용자가 SQL 2개 실행 완료. REST로 확인: `event_participants`/`notifications` 200(빈 배열, RLS 정상), `events` + `event_participants` 임베디드 조인 200(PGRST200 폴백 불필요), `respond_to_event` RPC가 새 로직대로 `participant not found` 반환.
- 참고: anon 키로도 RPC가 실행됐다(권한 거부가 아니라 함수 내부 예외) — Supabase 기본 권한이 public 스키마 함수에 anon 실행을 주기 때문으로, 기존 `accept_share` 등도 같다. anon은 `auth.uid()`가 null이라 어떤 행도 건드릴 수 없어 실질 위험은 없음.
- 남은 것: 실제 두 계정으로 초대→수락→알림 흐름 확인(사용자).

## 2026-09-17 · 19.6 계획 대비 조정 사항

- 계획에서는 알림 SQL을 schema_together.sql에 이어서 추가하기로 했으나, `create table`은 재실행이 안 되므로(이미 있는 테이블) 기존 관례(schema_share.sql → schema_share_fix.sql처럼 후속 변경은 새 파일)를 따라 `supabase/schema_together_notifications.sql`을 새 파일로 분리했다. respond_to_event는 파라미터 이름이 그대로라 `create or replace`로 알림 insert를 추가해도 기존 grant가 유지된다(17.6 교훈: 파라미터명을 바꿀 때만 drop 필요).
- 19.5에서는 계획대로 respondToEvent/setEventParticipants를 바로 연결하지 않고 shownEvents/reload만 먼저 넣었다 — 두 액션의 구현체(togetherRepository)가 19.6에서야 생기기 때문. useCalendar 컨텍스트 연결은 19.6에 포함시켰다.

- 246개 테스트/빌드/lint 통과. playwright-cli로 실제 폼에서 경고 문구("91일간 지속돼요")와 반복 요약("매주 수, 금요일마다")이 정확히 뜨는 것을 확인.
- ponytail로 diff 재검토 — 불필요한 추상화 없음. "전체 일정" 델타 방식(단순 날짜 고정이 아니라)이 필요했던 이유: 사용자에게 이미 "종료 날짜를 시작일과 같게 고치고 전체 일정으로 저장하라"고 안내했는데, 단순히 앵커를 고정해버리면 그 수정 경로 자체가 막혀버림 — 델타 방식은 날짜를 안 건드리면 앵커 유지, 지속시간만 줄이면 그 변경이 전체 회차에 반영되어 두 요구를 동시에 만족.

## 2026-09-17 · 20단계 설계 결정 (모바일 UX/UI)

- 사용자 제보: 모바일이 어색함, 주/일에서 아래로 스크롤이 안 됨(더 이상 창이 없는 것처럼), 좌우 스와이프가 너무 민감함. 배포본을 iPhone 15(393×659)·SE(375×667)로 실측 + 코드 감사.
- 스크롤이 안 되는 원인: SwipeableViewport가 터치 pointerdown마다 즉시 가로 드래그를 시작(세로 스크롤 중에도 패널이 옆으로 끌림), `.scrollArea`가 overflow-x:auto로 계산돼 가로 제스처를 브라우저가 가져감, 그리드가 항상 0시에서 시작 + 화면 위 36%는 스크롤 불가 영역. 민감도 원인: project(v,0.998)≈0.5×속도 + 기준 30%.
- 사용자 결정: 모바일 헤더 iOS식 2줄(큰 월 제목→날짜 선택, 전체 폭 세그먼트, 로그인은 설정으로, 화살표 제거), 주 보기는 7일 유지하되 iOS식 블록(제목 줄바꿈), 월 보기는 iOS식(점 + 선택일 목록, 탭해도 일 보기로 안 넘어감), 편집 시트는 상단 고정 바 [취소] 제목 [저장]. 데스크톱은 그대로.
- 모바일 분기는 useMediaQuery('(max-width: 767px)') — jsdom엔 matchMedia가 없어 기존 테스트는 데스크톱 경로로 그대로 통과, 모바일 테스트는 matchMedia 스텁.
- 할 일 아이콘은 헤더에 유지(매일 보는 콘텐츠라 설정 안에 넣으면 한 단계가 늘어남).

## 2026-09-20 · 20단계 구현 + 혹독한 보스 리뷰 (서브에이전트 6개: 제스처 코드, 헤더·월 실측, 주/일 스크롤 실측, 시트·편집기 실측, CSS 정적 감사, 회귀·테스트 감사)

**구현(20.1~20.11)**: 스와이프 의도 판정(>10px, 가로 우세일 때만 드래그, 넘김 기준 폭 35%+40px, 감속 0.99), 주/일 그리드 현재 시각 근처에서 열기 + 현재 시각 선, viewport-fit=cover·dvh·세이프 에어리어, 전역 터치 위생(탭 하이라이트·입력 16px·hover:hover·:active), 44pt 터치 영역, 시트 = 고정 헤더 + 스크롤 본문 + 스크롤 잠금, 편집 시트 상단 바, 모바일 헤더 iOS식 2줄(큰 월 제목 → 날짜 이동 시트, 세그먼트, 로그인은 설정으로), 모바일 월 보기(점 + 선택일 목록), 모바일 주 블록.

**실측으로 확인된 것**: 사용자가 말한 "아래로 안 내려감"은 스와이프가 터치 즉시 가로 드래그를 시작하고 스크롤 컨테이너가 가로 제스처를 가져가던 것이 원인이었고, 수정 뒤 CDP 터치 실측에서 세로 스크롤 1:1 추종·대각선 드리프트 무반응·확실한 가로 스와이프/플릭 전환·짧고 느린 드래그 복귀가 모두 의도대로 나옴("너무 민감함"도 해소).

**보스 리뷰로 추가 수정(20.12-a~e)**: 비스듬한 스와이프 사각지대(판단을 한 번만 하도록), 퇴장 패널이 오래된 속도를 쓰던 문제(transition을 variants로), pointercancel로 끝난 드래그 커밋 방지, 주/일 넘길 때 스크롤 위치 초기화(마지막 위치 유지), **FAB 회피 하단 여백이 실제로는 스크롤 높이에 안 잡히던 것(실측 발견, `align-items:flex-start`)**, 오늘=파란 글자/선택=채운 원 구분, 큰 제목 28px, 마지막 주가 통째로 다음 달이면 생략, 목록 날짜 제목 sticky, 월 보기에서 달을 넘기면 선택일도 따라감(어긋남 해소), 겹치는 주 블록 계단식(24px 폭 글자 깨짐 해소), **모바일 검증 오류가 화면 밖에 뜨던 문제**, [취소]가 폼 복귀인데 같은 단어로 시트를 닫던 혼동 → [뒤로], Overlay Esc 닫기, 대비(색을 계산해 AA 통과 확인), 입력 16px를 터치 기기 기준까지 확장, 44pt 일괄, hover 전용 삭제 버튼, 핀치 확대 허용, 안전 영역 등.

**의도적으로 보류(사유)**: 가로 모드 휴대폰(≥768px)은 여전히 데스크톱 레이아웃 — 입력 확대·44pt는 pointer:coarse로 막았지만 전용 레이아웃은 별도 과제. 스냅백 스프링 튜닝, 움직이는 패널 터치 시 즉시 정지, 스크림 위 텍스트 선택 드래그로 닫힘(데스크톱), 날짜 이동 시트 미니 캘린더의 선택 표시를 그리드와 통일, 미분류 일정 점이 회색(새 일정은 기본색이 있음), FAB가 목록 행 오른쪽을 가림, iOS 키보드가 하단 시트를 가리는지(interactive-widget), 계정 이메일 표시, 겹친 블록 중 아래 짧은 일정은 왼쪽 22%만 보임(Google 캘린더와 같은 절충).

**남은 확인(사용자)**: 실제 iPhone(iOS Safari)에서 스와이프/스크롤 체감, 키보드가 시트를 가리는지.

## 2026-09-20 · 20단계 2차 보스 검증 (서브에이전트 3개: 실기기 터치 재검증, 데스크톱 회귀, 수정분 코드 리뷰)

- **재검증 통과**: 스크롤 위치 유지(스와이프 후 깜빡임 없음), FAB 여백(scrollHeight 1152+88), 5주 월 보기, sticky 제목, 오늘/선택 스타일, 월 넘김 시 선택일 동기화, 검증 오류 위치(role=alert), 범위 선택 [뒤로], Esc, 헤더(109px, 44px 컨트롤, SE에서 겹침 없음), 할 일 폼, 콘솔 에러 0개. 데스크톱(1280px)은 월/주/일/목록/편집/설정/검색/단축키/ZIGZAG 모두 그대로.
- **2차에서 나온 실제 결함(20.13~)**: 2026-02(일요일 시작 28일)의 5주째가 통째로 다음 달인데 그려짐 → 1일 위치+말일로 주 수 계산, "오늘"로 돌아와도 기억한 스크롤 위치 때문에 현재 시각 선이 화면 밖 → 오늘이 있는 기간으로 들어올 때만 현재 시각으로, 겹침 5개 이상에서 계단식 폭 음수/현재 시각 선 가림, 둘째 손가락 뗄 때 첫 손가락 판정이 지워짐, 목록 보기 좌우 여백 소실(내가 모바일 .main 패딩을 없앤 부작용), 종일 줄 무제한 커짐(모바일 96px 상한), 확인(✓) 아이콘이 흐림, **데스크톱에서 주/일 블록 텍스트 선택 불가(user-select:none을 터치 기기로 한정)**, "8시" 라벨 절반 잘림(8px 위에서 열기), **태블릿 세로(768~1023px) 헤더가 넘쳐 로그인이 화면 밖**(이 작업 이전부터 있던 문제, 앱 이름 숨김+줄바꿈).
- **의도된 동작으로 유지**: 대각선 60px 짧은 스와이프가 주를 안 넘김(드래그는 붙고 넘김 기준 폭 35%가 "너무 민감함" 불만을 막는 것 — 120px 이상/빠른 플릭은 넘어감), 드래그가 손가락보다 10~15px 늦게 붙는 것(의도 판정 임계값), 월 이동 시 선택일 드리프트(iOS와 동일), 오버레이 닫힘 애니메이션 동안(0.3~0.6s) 단축키 무시(기존 동작).

## 2026-09-20 · 21단계 바탕화면 위젯 — 설계 결정 (계획: ~/.claude/plans/expressive-hatching-cosmos.md)

- **목표**: 웹앱을 윈도우 바탕화면에 위젯처럼 상시 표시. 웹과 데이터가 양방향으로 반영되어야 함(반영 속도는 무관, 이중 입력만 없으면 됨). 로그인할 때 자동 실행.
- **데이터 공유는 이미 됨**: 같은 Vercel URL + 같은 Google 계정이면 같은 Supabase DB. 부족한 건 자동 갱신뿐이라 useCalendar에 60초 폴링을 추가한다. Realtime은 기존 방침대로 쓰지 않음(SQL 변경 없음).
- **래퍼 앱(Electron/WebView2) 제외**: 로그인이 Google OAuth 전용(useAuth.ts)이고 구글은 임베디드 브라우저 로그인을 차단한다. 진짜 Edge 창(`--app`, 전용 프로필)을 AutoHotkey로 제어한다.
- **투명은 "배경만 투명"(색 키)**: 브라우저 창은 CSS 투명이 안 먹으므로 Windows 레이어드 윈도우 색 키를 쓴다. 색 키로 지정된 픽셀은 마우스 입력에서도 빠져 빈 칸 클릭이 바탕화면으로 통과 → 일정 추가는 추가 버튼으로만(사용자 확인). 웹 디자인은 그대로 두고 `?widget=1`일 때만 배경 토큰을 바꾼다.
- **미검증 위험(21.4에서 실측)**: Win+D가 창을 최소화하는지, Chromium에서 색 키가 실제로 적용되는지, 글자 테두리 상태. 실패 시 창 전체 반투명으로 되돌린다.
- **번호**: 계획서에는 19단계로 적었으나 19·20단계가 이미 있어 21단계로 기록.
- **21.1 구현**: `useCalendar`에 60초 `setInterval` + `window focus` 시 `reload()`. 폴링 응답이 방금 한 수정의 재로드보다 늦게 도착해 최신 데이터를 덮는 경합을 막으려고 `reloadSeqRef`로 오래된 응답을 버린다. 갱신 실패(네트워크)는 무시하고 다음 주기에 재시도. EventEditor는 초기값을 `useState`로 한 번만 잡고 events 변화로 재설정하지 않아 입력 중 갱신에 덮이지 않음(코드로 확인).
- **21.2 구현**: `--color-canvas`는 일정 칩 위 흰 글자색(`color: var(--color-canvas)`)으로도 쓰여서 통째로 키 색으로 바꿀 수 없다 → 배경 전용 토큰 `--color-page`(기본값 = canvas, 웹 불변)를 새로 만들고 global.css body·MonthView `.dayListTitle`만 이 토큰으로 바꿨다. `?widget=1`이면 `<html class="widget">`(state/widgetMode.ts, main.tsx에서 호출) → `--color-page: #010101`(AutoHotkey 색 키 0x010101). 월 보기 날짜 칸은 `background: none`이라 body 색이 그대로 비쳐 격자 영역만 투명해진다. 헤더·버튼·일정 칩·팝업은 불투명 그대로라 클릭이 유지된다.
- **playwright-cli 확인**: 위젯 모드 body=rgb(1,1,1), 일반 모드 흰색(웹 불변). 처음에는 반투명 헤더(`--material-bar` rgba 흰색 72%)가 어두운 키 색과 섞여 회색으로 보여서 위젯 모드에서만 불투명 흰색·블러 없음으로 고정. 480px 폭(모바일 레이아웃)에서도 헤더·FAB 정상.
- **알려진 한계**: 글자색이 흰 배경용 어두운 색이라 어두운 바탕화면 위에서는 글자가 안 보일 수 있다(21.4 실측에서 확인). 이중 색 키 투명 영역(날짜 칸 빈 곳)은 클릭이 바탕화면으로 통과.
- **21.3 도구 변경(AutoHotkey → PowerShell)**: AutoHotkey가 설치돼 있지 않았다. 윈도우 기본 PowerShell에서 user32(SetWindowPos/SetLayeredWindowAttributes)를 호출하면 같은 일이 되므로 설치 없이 `desktop-widget/calendar-widget.ps1` 하나로 처리한다. `-Setup`(구글 로그인용 일반 창), `-Install`(시작프로그램 바로가기, 창 스타일 최소화), 기본(위젯 실행).
- **실측 결과(21.4 일부)**: ① 색 키 픽셀은 정확히 (1,1,1)로 그려지는데도 **GPU 합성 상태의 Chromium은 색 키를 무시**한다(창 전체 알파 180은 동작). ② `--disable-gpu --disable-direct-composition`을 주면 색 키가 동작해 격자 영역이 투명해지고 헤더·버튼은 불투명으로 남는다 → 스크립트에 플래그 반영. ③ 그림자는 키 색과 섞여 검은 테두리가 되므로 위젯 모드에서 `--shadow-overlay: none`. ④ `--disable-sync`가 없으면 새 프로필이 윈도우 계정으로 Edge 동기화 안내 창을 띄운다. ⑤ 처음에는 "포커스가 없을 때만 맨 아래로" 내리게 했더니 방금 켜진 창이 포커스를 가져 위에 남았다 → 항상 맨 아래로 내린다(위젯 아래에는 Progman만 남는 것 확인). 창 스타일(레이어드·툴윈도우·색 키 0x010101)·크기 480×760 적용 확인.
- **미확인(사용자 눈으로)**: Win+D 후 위젯 표시 여부, 어두운 바탕화면에서 글자 가독성, 로그인 유지/양방향 반영은 배포 후 확인.
- **21.4 검증 결과(2026-09-20)**: ① **Win+D**: 대조군(크롬·터미널)은 최소화되는데 위젯은 최소화되지 않고 남는다(WS_EX_TOOLWINDOW 효과로 추정), 다시 누르면 모두 복구. → "Win+D로 바탕화면 볼 때 사용" 방식 성립, 바탕화면 레이어 부모 지정 같은 우회책 불필요. ② **로그인 유지**: `-Setup` 창에서 로그인 후 프로필 localStorage에 `sb-…-auth-token` 저장, 위젯 실행 시 `INITIAL_SESSION 세션 있음`. ③ **첫 화면 전에 레이어드 스타일을 걸면 흰 화면으로 남는다**(실측) → 창이 뜬 뒤 6초 대기 후 적용. ④ **위치·크기**: Edge 자체 저장은 종료 때만 기록돼 강제 종료·로그오프에 유실되고, `-Setup` 창의 큰 크기가 남았다 → 스크립트가 2초 간격으로 `%LOCALAPPDATA%\CalendarWidget\rect.txt`에 저장하고 다음 실행에 `--window-position/size`로 복원(기본 480×760 우측). 이동→재시작 복원 확인. ⑤ 시작프로그램 바로가기 등록(`shell:startup\CalendarWidget.lnk`, 삭제하면 해제).
- **운영 메모**: 위젯 종료는 작업 관리자에서 `msedge`(CalendarWidget 프로필)와 `powershell`(calendar-widget.ps1)을 끝내면 된다. 로그인이 풀리면 `powershell -File desktop-widget\calendar-widget.ps1 -Setup`으로 다시 로그인. 배포 주소를 바꾸면 `-Url`로 넘기고 `-Install`을 다시 실행.
- **ponytail 점검(21단계)**: 앱 코드 변경은 useCalendar 주기 갱신 + `--color-page` 토큰 + widgetMode 함수 3개뿐이고 새 의존성 없음. 스크립트는 외부 도구 설치 없이 PowerShell 한 파일. 위젯 전용 UI/설정 화면·Realtime·래퍼 앱은 만들지 않음(YAGNI).

## 2026-09-20 · 21단계 사용자 피드백 반영 (21.6)

- **피드백**: ① Win+D 직후 위젯이 안 보임(다른 창을 같이 볼 때만 보임) ② Edge 창 틀(제목 표시줄·닫기·스크롤바)이 보이지 않고 캘린더만 단독으로 ③ 기본 크기는 앱 모양이 아니라 웹 데스크탑 화면 ④ 너무 투명해서 글자가 안 보임, 약간의 배경색 필요.
- **④ 색 키 폐기 → 창 전체 반투명(기본 85%)**: 색 키는 "완전 투명 아니면 완전 불투명"이라 반투명 배경이 불가능. 창 전체 알파로 바꾸면 GPU를 다시 켤 수 있고, 빈 곳 클릭이 바탕화면으로 통과하던 한계도 사라진다. 대신 글자도 알파만큼 흐려진다(`-Opacity`로 조절, 20~100). 앱 쪽 `--color-page` 토큰·헤더 불투명·그림자 제거는 되돌리고, 위젯 모드 CSS는 스크롤바 숨김(`scrollbar-width: none`)만 남겼다. ⚠ **Vercel에 배포된 이전 버전은 아직 색 키 CSS(배경 #010101)라 새 스크립트가 열면 배경이 검다 — push해야 정상.**
- **① Win+D**: Win+D 직후 활성 창이 `Progman`(바탕화면)이 되고, 바탕화면 계층이 맨 아래 위젯을 덮는다(위젯 자리 픽셀이 배경화면 색으로 확인됨). 활성 창 클래스가 Progman/WorkerW일 때만 TOPMOST로 올리고, 다른 창이 활성화되면 곧바로 맨 아래로 내린다(HWND_BOTTOM이 TOPMOST도 해제). HWND_TOP은 부족했고 TOPMOST여야 보였다.
- **② 창 틀 숨김(측정으로 찾은 조합)**: 영역 잘라내기(SetWindowRgn)만으로는 (a) 윈도우 11 Mica 배경 효과가 창 전체에 뿌연 막으로 남고 (b) 캡션 버튼 자국 `×` (c) 위쪽 1px 흰 선이 남는다. → Mica 끔(DWMWA_SYSTEMBACKDROP_TYPE=1) + 모서리 라운딩 끔 + 캡션·리사이즈 테두리 스타일 제거(0xC40000) + 눈에 보이는 창 영역(DWMWA_EXTENDED_FRAME_BOUNDS) 기준으로 위 29 DIP·테두리 1 DIP 잘라내기를 **모두** 해야 깨끗했다. 테두리색 끄기(DWMWA_BORDER_COLOR=NONE)는 오히려 흰 선을 만들어 뺐다. 레이어드 스타일을 건 **뒤에** 영역을 지정해야 한다(먼저 하면 풀림).
- **틀 다시 보이기(이동·크기 조절용)**: 마우스가 창 맨 위 띠(제목 표시줄 자리, 29+12 DIP)에 오면 원래 스타일로 복구하고 영역을 풀어 틀이 나타남 → 창 밖으로 나가면(드래그 중 제외) 다시 숨김. 300ms 폴링이라 약간의 지연이 있다.
- **③ 기본 크기**: 저장된 rect.txt가 없으면 1100×720 DIP를 화면 오른쪽 위에 둔다(768px 이상이라 사이드바 포함 데스크탑 레이아웃). 스크립트를 DPI 인식으로 바꿔 물리 픽셀로 다루고, 명령줄·rect.txt는 DIP로 변환한다.
- **로컬 시험**: 배포 전이라 개발 서버(`?widget=1`)로 확인. Win+D 상태 스크린샷에서 제목 표시줄·스크롤바·닫기 버튼 없이 캘린더만 반투명으로 떠 있는 것 확인.
- **21.7 사이드바 접기/펼치기(위젯 전용, 사용자 요청)**: `useSidebarCollapsed`(localStorage `calendar.sidebarCollapsed`, 기본 펼침) + 위젯 모드일 때만 Header에 `onToggleSidebar`를 넘겨 맨 앞에 토글 버튼(`SidebarIcon`)을 보인다. 접히면 `<Sidebar />`를 렌더하지 않아 격자가 전체 폭을 쓴다. 웹(위젯 아님)은 버튼도 없고 항상 펼침이라 기존 화면 불변. 접힘 상태는 위젯 전용 Edge 프로필의 localStorage에 저장돼 재부팅 후에도 유지된다. 애니메이션 없이 즉시 전환(YAGNI). playwright-cli로 펼침/접힘 렌더링 확인, 콘솔 에러 0.
- **21.7 실측 중 발견한 버그(스크립트)**: Win+D로 바탕화면이 보이는 상태에서 위젯을 클릭하면 위젯이 사라졌다. 클릭하면 위젯이 활성 창이 되는데, 스크립트는 "활성 창이 Progman/WorkerW일 때만 TOPMOST"라서 그 순간 맨 아래로 내려 바탕화면 계층 밑으로 가라앉은 것. → `$raised` 상태를 두어, 바탕화면 때문에 올라온 뒤에는 위젯이 활성이어도 TOPMOST를 유지하고 다른 창이 활성화될 때만 내린다. 실제 위젯에서 접기→펼치기→접기를 Win+D 상태에서 클릭으로 확인(위젯 유지, 토글 정상).
- **참고**: 토글 버튼은 사이드바가 펼쳐지면 헤더와 함께 오른쪽으로 밀린다(접힘 시 좌측 끝). 사용자가 위젯 폭을 840 DIP 정도로 좁혀 쓰는 경우 펼치면 헤더가 2줄로 감긴다(기존 태블릿 폭 헤더 동작). 접힌 상태가 좁은 창에 더 맞는다.

## 2026-09-21 · 21단계 위젯 혹독한 보스 리뷰 (서브에이전트 4개: 스크립트 정적 리뷰 / 앱 코드+웹 회귀 / 장기 운영·환경 시나리오 / 실기 측정) + 직접 검증

**결과 요약**: 실기 측정 9항목(알파·틀 숨김·z-순서·Win+D·클릭·토글·틀 재표시·위치 저장 3회 재시작 드리프트 0·자원 CPU 0.8%/메모리 증가 없음·로그인 유지)은 전부 통과. 웹 회귀(1280/390, 위젯 모드) 이상 없음, 테스트 366→372, 빌드·린트 신규 경고 0. 보고된 결함은 각 주장을 코드·실측으로 검증해 채택/보류했다.

**채택·수정한 것 — 앱**
- **갱신 순번 방어의 허점**: "마지막에 시작한 것만 적용"이라 수정 직후 재로드 중에 더 새 폴링이 시작돼 실패하면 재로드 결과까지 버려져 화면이 최대 60초 낡았다(호출자의 `await reload()`도 성공으로 끝남). 최초 로드가 포커스와 겹치면 빈 화면이 깜빡이는 것도 같은 원인. → "이미 반영된 것보다 오래된 것만 버린다"(`appliedSeqRef`) + 저장소가 바뀐 뒤 도착한 이전 저장소 응답은 버린다(`currentRepoRef`). 리뷰 제안(단조 증가만)에는 로그인 전환 때 이전 저장소 응답이 잠깐 보이는 부작용이 있어 저장소 확인을 더했다. 리뷰가 제안한 테스트는 순서가 반대라 현재 코드에서도 통과했다(실측) → 지적된 순서로 다시 작성해 실패를 확인한 뒤 수정.
- **가려졌던 창이 다시 보일 때 즉시 갱신**(`visibilitychange`): Chromium은 가려진 창의 타이머를 늦추고 Win+D·다른 창 최소화로는 포커스도 받지 못한다.
- **며칠 켜둔 위젯의 날짜**: 마운트 때 한 번만 `new Date()`라 절전을 거쳐 날짜가 바뀌어도 보는 기간이 옛날에 머문다 → 위젯 모드에서만 날짜 변경 시 오늘로 이동(웹은 불변).
- **로그인 리다이렉트로 `?widget=1` 소실**: 같은 탭에서는 유지(sessionStorage — localStorage는 일반 브라우저를 계속 위젯 모드로 만들 수 있어 배제).
- 사이드바 토글 aria: 라벨을 고정("사이드바")하고 `aria-expanded`로 상태 표기, 툴팁은 title.

**채택·수정한 것 — 스크립트(재작성, 아래는 모두 실측으로 재검증)**
- **루프 예외로 관리가 영구 중단**되던 구조 → 반복마다 try/catch, 전체는 "창이 닫히거나 Edge가 죽거나 시작 중 예외가 나면 10초 뒤 재시작"(Edge 종료 후 13초 만에 재시작·스타일 재적용 확인).
- **이중 실행/이미 떠 있는 Edge**: 이름 있는 Mutex로 두 번째 실행을 조용히 종료(2번째 실행 후 스크립트 수 1 유지 확인). Mutex는 이전 스크립트가 강제 종료되면 "버려진 상태"라 `AbandonedMutexException`을 잡아야 한다(이 프로젝트는 스크립트를 자주 강제 종료). 세션 시작 때 전용 프로필의 남은 Edge를 정리해 새 창이 기존 프로세스에 붙어 창 핸들을 못 얻는 상황을 없앰.
- **rect.txt 손상·화면 밖·너무 작음**: 파싱 실패/크기 미달/모든 화면과 100×100 DIP 미만으로 겹침이면 기본 위치(주 모니터 작업 영역보다 크지 않게 1100×720)로. 실측: "-", 화면 밖(5000,100), 크기 100×100 세 경우 모두 기본 위치 복구·스크립트 생존(이전 스크립트라면 첫 경우에 시작 직후 죽었을 것). 저장 조건은 DIP로 통일(기존엔 물리 픽셀과 DIP 기준이 섞여 있었다), 최대화·최소화 중에는 저장 안 함.
- **원본 스타일 캐시 폐기**: 시작 때 저장한 스타일로 되돌리면 최대화 등으로 Edge가 바꾼 스타일을 덮으므로, 그때그때 현재 스타일에서 캡션·리사이즈 테두리 비트(0xC40000)만 바꾼다. 틀 숨김 상태에서 스타일·영역이 되돌려졌는지 2초마다 검사해 재적용(DPI·해상도 변경 대비).
- **왼손잡이 마우스 설정**(SM_SWAPBUTTON)·`SetWindowRgn` 실패 시 HRGN 해제·Edge 설치 경로 3곳 탐색·부팅 직후 DNS 대신 실제 HEAD 응답 대기(최대 5분)·창 탐색 60초·첫 화면 대기 6→8초.
- **z-순서 규칙을 두 번 고침(실측으로 발견)**: ① 기존 "활성 창이 바탕화면이 되면 올리고, 위젯이 활성이면 유지"는 클릭 시 사라지는 버그는 막았지만, **바탕화면 보기에서 위젯을 클릭한 뒤 Win+D로 창을 복구하면 위젯이 활성으로 남아 복구된 창을 계속 가렸다**(실기 측정 에이전트는 클릭 없이 Win+D만 눌러 못 잡았고 내가 클릭 후 복구 경로를 재시험하다 발견). ② 이를 "보이는 창이 0개일 때만 올림"으로 바꿨더니 이 PC에서는 Win+D 후에도 설정 앱(UWP ApplicationFrameWindow)·"Windows 입력 환경"(CoreWindow)이 최소화되지 않아 개수가 0이 되지 않아 클릭 시 다시 사라졌다(실측). ③ 최종: 올라온 뒤 관측한 보이는 창 수의 **최솟값**을 기준으로, 창이 복구돼 개수가 늘면 위젯이 활성이어도 내림(Win+D 직후에는 아직 최소화 중이라 처음 값이 실제보다 큼). CoreWindow·제목 없는 창·툴윈도우·cloaked·100px 미만은 세지 않는다. 실측 2라운드: Win+D 후 올라옴 → 위젯 클릭(토글) 두 번에도 유지 → Win+D 복구 시 내려감.

**보류·기각한 것 (사유)**
- 혼합 배율 멀티 모니터(좌표 변환 어긋남): 이 PC는 모니터 1개·단일 배율. 스크립트 머리 주석에 "모든 모니터 배율 동일 전제"를 적었다.
- 동시 편집 충돌(웹에서 지운 일정을 위젯에서 저장하면 조용히 유실, last-write-wins): `update/delete`에 `.select()`를 붙여 0행이면 오류를 내는 제안은 RLS로 SELECT가 막힌 행에서 오탐이 날 수 있어(함께 일정 등) 개인 앱 규모에서 보류.
- 로그아웃 상태에서 위젯이 로컬 모드로 전환돼 일정이 위젯 프로필에만 저장되고 재로그인 때 이관되지 않는 문제(리뷰가 "가장 위험"으로 꼽음): 웹 앱 전체의 기존 설계(로컬→로그인 1회 이관)이고, 세션이 풀리는 경우 자체가 드물다(supabase-js는 60초 폴링 쿼리마다 토큰을 갱신하고 refresh token은 만료되지 않음, 소스 확인). 헤더에 "로그인" 버튼이 보이고 위젯 안에서 바로 복구 가능. 위험이 남아 있음을 기록만 한다.
- 알림 훅과 이중 폴링·focus 최소 간격, localStorage 예외 처리(기존 훅 전체가 같은 방식), 시작프로그램 스크립트의 저장소 내 위치(개인 PC, 일반 Run 키와 같은 위험군), Sleeping Tabs(--app/가려진 창 적용 여부 미확인).
- `desktop wallpaper 클릭 시 위젯이 열린 창들 위로 올라오는 부작용`: 바탕화면을 클릭하면 활성 창이 바탕화면이 돼 위젯이 잠깐 올라온다. 다른 프로그램 창을 클릭하면 내려간다 — 의도된 동작으로 유지.

**알려진 잔여 위험**: 간헐적 테스트 실패 1회(전체 테스트 5회 중 1회에서 2개 실패, 서브에이전트들이 동시에 부하를 주던 때였고 이후 4회 전부 통과. 어떤 테스트인지 특정하지 못함). 실기 측정 에이전트가 최소화된 터미널에 `SetForegroundWindow`를 호출해 셸의 바탕화면 보기 복원 목록을 깨뜨렸고 Discord 창이 최소화 상태로 남았다(작업 표시줄에서 한 번 클릭하면 복구) — 이후 이 방식의 조작은 금지.

## 2026-09-21 · 22단계 위젯 배경만 투명 — 설계 결정

- **요구**: "배경을 제외한 다른 부분은 다 또렷하게". 창 전체 알파(85%)는 글자·칩까지 흐리게 해서 부적합.
- **조사**: 글자·칩은 또렷하고 배경만 반투명한 진짜 픽셀별 알파는 Edge 앱 창으로는 불가(Chromium 창 투명 API 미완성, chromium issue 41026383). 전용 앱(Electron 등)은 구글이 임베디드 웹뷰 로그인을 막아(WebView2Feedback #1578/#1584/#2552) 시스템 브라우저 로그인+세션 전달이 필요하고, 이 PC에 .NET SDK·Rust가 없고, 맨 아래 고정·Win+D·자동 재시작·위치 저장을 다시 만들어야 해 큰 작업 → 보류(부족하면 별도 계획).
- **선택**: 이미 실측된 색 키(배경만 100% 투명) + 글자 흰 외곽선으로 가독성 확보. 키 색은 거의 흰색 #FFFFFE — 외곽선 색(#FFFFFF)과 파랑 성분만 1 차이라 외곽선 그림자의 안티앨리어싱이 "키 또는 순백"으로 수렴해 또렷한 외곽선이 된다(검정 키 #010101은 가장자리가 회색 테두리로 지저분했음).
- **한계(합의)**: 배경에 옅은 색을 깔 수 없음(100% 투명 아니면 불투명), 배경 빈 곳 클릭은 바탕화면으로 통과(일정 추가는 버튼), 글자 모양이 위젯에서만 외곽선 스타일, GPU를 꺼야 색 키가 동작(CPU 증가 가능). 헤더·사이드바는 클릭성을 위해 불투명 흰색 유지.
- **간헐적 테스트 실패의 정체(21.8에서 못 잡았던 것)**: `useCalendar.auth.test.tsx`의 2개(로그인 시 마이그레이션·실패 시 로컬 유지). 이 파일은 `vi.doMock` 뒤 테스트 안에서 `useCalendar`를 처음 동적 import(변환)하는데, CPU가 바쁠 때(전체 테스트 병렬 실행 + 개발 서버 종료·서브에이전트 등 동시 부하) 10.9초까지 걸려 기본 제한(테스트 5초, `waitFor` 1초)에서 실패했다. 단독·유휴 상태에서는 항상 통과(전체 3회 + 단독 3회). 이 파일만 `asyncUtilTimeout` 5초·describe timeout 30초로 늘리고, 전체 테스트 2개 동시 실행 부하에서도 통과 확인. (내가 커밋 명령을 `;`로 이어 실패를 무시하고 22.1을 커밋한 것은 실수 — 이후 테스트 통과를 확인한 뒤 커밋한다.)
- **22.2 구현·실측(개발 서버 `?widget=1`로 실제 바탕화면 Win+D 캡처)**: 색 키 0xFEFFFF(플래그 3 = COLORKEY|ALPHA, alpha 255) + `--disable-gpu --disable-direct-composition`. 배경은 투명, 글자·칩·버튼은 100% 불투명.
  - **검은 띠 발견·수정**: 위젯 왼쪽·아래 약 10px가 순수 검정(000000)이었다. 캡션·리사이즈 테두리 스타일을 제거해도 클라이언트 영역은 창 사각형보다 좌·우·아래 12px 안쪽이고(측정: `ClientToScreen`/`GetClientRect`), 그 바깥 띠가 소프트웨어 렌더링에서 검게 칠해진다(GPU+알파 때는 안 보였음). 영역을 "눈에 보이는 프레임(DWM 경계)"이 아니라 **클라이언트 영역** 기준으로 다시 계산 → 순수 검정 픽셀 0개.
  - **외곽선 3단계**: ① 블러 그림자(0 0 2~4px)는 얇은 선밖에 못 만든다(안티앨리어싱 수렴 구간이 좁음) ② 블러 없는 흰 그림자를 8방향×1px + 4방향×2px 겹치니 굵기가 정확히 나왔다 ③ **날짜 숫자가 그대로 얇았던 원인**: 날짜 칸이 `<button>`이고 브라우저 기본 스타일이 폼 컨트롤의 `text-shadow`를 꺼 상속이 끊김 → `:where(:root.widget) :is(button, input, select, textarea) { text-shadow: inherit }`(특이도 0,0,1로 낮춰 아래 예외가 이기게). 색 배경 위 흰 글자(선택일 파란 원, 배지, FAB, 저장 버튼 등 `color: var(--color-canvas)` 9곳)는 흰 외곽선이 글자를 뭉개므로 각 규칙에 `text-shadow: none`.
  - 회색 글자(요일·보조)는 외곽선 위에서 약해 위젯 모드에서만 `--color-secondary`를 #2b2c2e로 진하게.
  - 회귀: Win+D 올라옴 → 위젯 클릭(토글 2회) 유지 → 복구 시 내려감, 틀 숨김 유지. CPU(20초, 8코어 기준) 스크립트 0.06%·Edge 전체 0.37%, 작업집합 520MB — GPU를 꺼도 부담 없음.
  - **미확인**: 일정 칩(로그인 세션은 Vercel 원본에만 있어 개발 서버로는 못 봄) → 배포 후 22.3에서 실제 데이터로 확인.

## 2026-09-21 · 22단계 되돌리기 준비 (push 전)

- **기준점**: 22단계 이전에 배포돼 있던 마지막 커밋 `8a14adc`에 태그 `widget-before-transparent-bg`(창 전체 반투명 85% 방식, 21.8까지 반영). 22단계로 push되는 것은 `cd47e36`(22.1 앱 CSS) · `5ddff30`(테스트 견고화, 독립) · `3940ed0`(22.2 스크립트+CSS 보강).
- **`git revert cd47e36 3940ed0`은 충돌한다**(복제본 시험으로 확인) — 22.2가 22.1이 바꾼 CSS 파일을 다시 수정했기 때문. 아래 "파일 복원" 방식을 쓴다.
- **되돌리기 절차(복제본에서 시험 완료: 기준과 차이 0, 빌드 성공, 테스트 372개 통과)**
  1. 앱: `git checkout widget-before-transparent-bg -- src/styles src/components desktop-widget && git commit -m "위젯 배경만 투명 되돌리기"` → push(Vercel 재배포). 가장 빠른 대안은 Vercel 대시보드에서 이전 배포를 "Promote/Rollback"(코드 변경 없이 즉시). 테스트 견고화 커밋(`useCalendar.auth.test.tsx`)은 독립이라 남긴다.
  2. 이 PC의 위젯: 위 1번으로 스크립트도 기준 버전으로 돌아온다. `powershell -File desktop-widget\calendar-widget.ps1 -Install -Opacity 85` 로 시작프로그램 바로가기 인자를 85로 갱신한 뒤, 작업 관리자에서 위젯 프로세스(powershell `calendar-widget.ps1` + msedge 위젯 프로필)를 종료하면 10초 안에 자동 재시작된다(21.8).
  3. 배포가 아직 안 끝난 사이(앱은 옛 CSS, 스크립트는 새 색 키 버전) 위젯이 불투명 흰 창으로 보이는 것을 피하려면 `-Opacity 85`로 실행해 옛 모습으로 둔다(현재 그 상태로 실행 중).
- **되돌리기 판단 기준**: 일정 칩·글자가 배포 후 실제 데이터로 봤을 때 읽기 어렵거나(외곽선이 지저분함), 배경 투명 때문에 조작이 불편하면 되돌린다.
- **22.3 실제 위젯(배포본, 실제 일정)에서 발견·수정**: 일정 칩 안 글자가 흰 외곽선 때문에 겹쳐 번져 보였다(칩은 자기 불투명 배경이 있어 외곽선이 필요 없음). `.chip`(월·주/일 그리드)·`.eventBlock`에 `text-shadow: none`. 개발 서버 + 로컬 일정 시드로 칩이 깔끔한 것 확인. 배경 투명·색 키·검은 띠 없음·Win+D 동작은 배포본에서 재확인(colorkey 0xFEFFFF, alpha 255, flags 3, URL은 Vercel).

## 2026-09-21 · 22단계 되돌림 (사용자 요청: "push 하지 말고 원래 상태로")

- **되돌린 것(로컬)**: `git checkout widget-before-transparent-bg -- src/styles src/components desktop-widget` — 22.1·22.2·22.3(칩 외곽선 수정)의 CSS와 스크립트를 창 전체 85% 반투명 방식(21.8 상태)으로 복원. 기준 태그 대비 차이 0, 빌드 성공, 테스트 372개 통과. 테스트 견고화(`useCalendar.auth.test.tsx`)와 노트는 유지.
- **원격/배포 상태(주의)**: 22.1(`cd47e36`)·테스트 견고화(`5ddff30`)·22.2(`3940ed0`)·되돌리기 절차 노트(`8c165f7`)는 이미 push·배포됐고, 22.3(`82ae6a2`, 칩 외곽선 수정)과 이 되돌림 커밋은 **push하지 않았다**(로컬 master가 원격보다 앞섬). 따라서 Vercel에는 22단계 CSS가 그대로 있다: 위젯 모드에서 body 배경 #fffffe, 글자 흰 외곽선(칩·색 배경 위 흰 글자 예외 포함, 칩 수정은 미배포), 회색 글자 진하게, 헤더 불투명, 팝업 그림자 없음. 85% 반투명 스크립트에서는 흰 외곽선이 흰 배경 위라 사실상 안 보이고 나머지는 미세한 차이. 완전히 원복하려면 이 되돌림 커밋을 push(또는 Vercel 대시보드에서 이전 배포 복원)해야 한다.
- **교훈**: 색 키 + 외곽선 방식은 "배경만 투명"을 이뤘지만 사용자가 원하지 않아 되돌림. 재도전한다면 진짜 픽셀별 알파가 필요한 전용 앱(Electron) 방식뿐(구글 로그인은 시스템 브라우저 + 세션 전달 필요).

## 2026-09-23 · 배포본 롤백 (Vercel CLI, git push 없음)

- **문제**: 로컬만 되돌리고 push하지 않아, 위젯이 여는 배포본은 22단계(8c165f7) CSS 그대로였다. 되돌린 스크립트(창 전체 85%)와 섞여 글자 주변에 흰 외곽선이 남아 사용자가 "글자 주변이 이상하다"고 지적. 나는 창 속성(알파·색 키)만 보고 "되돌림 확인됨"이라 잘못 보고했었다 — 배포본까지 확인하지 않은 실수.
- **조치**: 사용자가 `npx vercel@latest login`(계정 newwwwwb, 팀 bobtong). Deployments API로 커밋을 대조해 현재 `calender-fy77ffqnj`=8c165f7, 직전 `calender-6199gl9xp`=8a14adc 확인 → `vercel rollback https://calender-6199gl9xp-bobtong.vercel.app` 성공. CLI는 저장소 밖(scratchpad)에서 실행해 `.vercel/`을 만들지 않았다.
- **확인**: 배포 CSS `index-D6JJqv9i.css`(22단계 이전 번들), 외곽선·#fffffe 0건, 스크롤바 숨김·사이드바 토글 유지. 헤드리스 브라우저로 `?widget=1` 계산값: text-shadow none(본문·날짜 칸), 배경 흰색, --color-secondary #6e6f72, 콘솔 에러 0. 위젯 Edge만 종료 → 스크립트가 자동 재시작(alpha 217, 플래그 2, 틀 숨김). 실제 화면 입력 주입은 하지 않았다.
- **⚠ 이후 배포 주의**: 롤백하면 Vercel이 프로덕션 도메인 자동 할당을 끈다. 다음에 push하면 새 배포가 만들어지지만 **프로덕션에 자동 반영되지 않는다** → `npx vercel@latest promote <새 배포 URL>`(또는 대시보드에서 Promote)로 되살려야 한다.
- **git 상태**: 원격 master=8c165f7(22단계 포함), 로컬 master는 22.3·되돌림·이 기록 커밋으로 앞서 있음(push 안 함). 로컬 파일 내용은 기준 태그와 동일하므로, 나중에 push+promote해도 결과는 지금 배포본과 같다.

## 23단계: README 갱신 + 위젯 한 줄 설치 (2026-09-23)
- **한 줄 설치 가능 확인**: 저장소가 공개라 raw.githubusercontent.com URL이 200. `irm | iex`는 실행 정책과 무관하게 동작한다.
- **로컬 파일로 받는 이유**: `-Install`은 `$PSCommandPath`를 바로가기에 넣는데 `iex`로 실행하면 이 값이 비어 있다. 그래서 install.ps1이 `%LOCALAPPDATA%\CalendarWidget\calendar-widget.ps1`(위젯이 이미 쓰는 폴더)로 받아 그 파일로 `-Install`/`-Setup`을 실행한다.
- **순서**: 기존 위젯(스크립트+위젯 Edge)을 먼저 끈다 — 켜져 있으면 로그인 창이 기존 Edge 프로세스에 붙어 닫힘을 감지할 수 없고, 새 스크립트는 뮤텍스로 조용히 끝난다. 로그인 창이 닫힌 뒤 바로가기를 실행한다 — 위젯 세션은 시작 시 같은 프로필의 Edge를 종료하므로 먼저 띄우면 로그인 창이 닫혀 버린다.
- **push + promote**: raw URL이 되돌린 스크립트를 주도록 로컬 커밋(22.3·되돌림)을 함께 push하고, 롤백으로 꺼진 프로덕션 자동 반영을 `vercel promote`로 되살린다(사용자 결정).- **설치 경쟁 조건(23.5)**: 재설치 시험에서 로그인 창을 닫지 않았는데 설치가 바로 끝나는 경우가 있었다. 재현 시 Edge 강제 종료 직후 위젯 프로필 Edge가 1개 남아 있었다(실측) — 새 로그인 창이 종료 중인 Edge에 붙어 함께 사라진 것으로 판단(확정은 못 함, 가끔만 발생). 대응: 기존 Edge가 완전히 사라질 때까지 대기 후 -Setup, 고정 5초 대신 로그인 창(본 프로세스)이 뜬 것을 확인한 뒤 닫힘을 기다리고 15초 안에 안 뜨면 오류로 멈춘다. 수정본으로 실제 콘솔에서 시험: 로그인 창 동안 대기 유지, 닫은 뒤 위젯 실행 확인.