# ADR-002 `/car`에서도 `CalendarProvider`를 유지하고 `CalendarApp`만 바꿔 끼움

- 상태: 승인 (2026-11-05, Product Owner 승인 — 메시지 2026-11-05T05-00-31-218Z-51ed15)
- 관련: F-01(BR-34, AC-01-6), F-08(AC-08-12, NFR-04), 원본 AC-2, tech.md T-2

## 배경
- 차계부가 `events`에 쓴 일정이 캘린더로 돌아왔을 때 60초 폴링 없이 3초 안에 보여야 한다(NFR-04).
- `/car`에서는 캘린더 단축키(`n`, `t`, `m`, `/`)가 동작하면 안 된다(BR-34). 단축키는 `CalendarApp` 안의 `useKeyboardShortcuts`가 `window`에 건다.
- 캘린더의 보기·선택일 상태는 `/`로 돌아와도 유지돼야 한다(BR-34). 이 상태는 `CalendarProvider` 안에 있다.
- 캘린더 코드(`useCalendar`, 화면 컴포넌트)는 고치지 않는다(AC-08-11).

## 선택지
| | 방법 | 결과 |
|---|---|---|
| A | `<CalendarProvider>` 안에서 `isCarPath ? <CarbookApp/> : <CalendarApp/>`. 차계부는 일정 쓰기 뒤 `useCalendar().reload()` 호출 | 즉시 반영, 단축키는 `CalendarApp`이 언마운트되어 사라짐, 보기 상태 유지, 캘린더 코드 0줄 |
| B | `/car`에서 Provider까지 언마운트 | 돌아올 때 최초 로드로 반영되나 보기·선택일 초기화(BR-34 위반) |
| C | `/car`에서도 `CalendarApp`을 숨김 처리로 유지 | 단축키 누수(T-2 위험 1) |

## 결정
A. 바꾸는 곳은 `src/App.tsx`의 `App()` 함수뿐이다. `CalendarApp` 함수 본문은 고치지 않는다.
- 트리: `ToastProvider > CalendarProvider > (CalendarApp | CarbookApp) + FileTabs`.
- 차계부는 `useCalendar()`에서 `reload`만 읽는다. 사용자 id는 `useAuth()`로 얻는다(F-02 게이트와 같은 근원). 차계부는 `useCalendar()`의 쓰기 함수(`addEvent` 등)를 쓰지 않는다(그 함수들은 실패 시 캘린더용 토스트를 띄우고 `event_id` 규칙을 모른다).
- `reload()`는 일정 쓰기(생성·수정·삭제·재묶기)가 1건 이상 성공한 동작 끝에 한 번 부른다. 결과를 기다리지 않는다(실패해도 다음 폴링이 보정).

## 결과
- 쉬워지는 것: NFR-04, BR-34를 캘린더 코드 수정 없이 만족. 기존 테스트 영향 없음.
- 어려워지는 것: `/car`에 있어도 Provider의 60초 폴링·포커스 재조회가 계속 돈다(요청 1건/분). 1인 사용 규모라 허용한다. `App.tsx` 수정은 `App()` 함수로 한정한다는 리뷰 규칙이 필요하다(02_architecture 9장).

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | 차계부 설계 | Product Owner(conv-8c399a) | F-01, F-08 |
