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
