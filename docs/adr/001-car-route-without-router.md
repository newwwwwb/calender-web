# ADR-001 `/car` 주소를 라우터 없이 History API 훅으로 처리

- 상태: 제안 (2026-11-05, Software Architect)
- 관련: F-01, F-13, BR-01, BR-02, NFR-16, tech.md T-1

## 배경
- `/car` 화면과 뒤로·앞으로 가기, 새로고침이 필요하다(AC-01-1~3).
- 제약: 라우터 라이브러리와 새 npm 패키지를 쓰지 않는다(원본 3.2, NFR-16). 지금 `App()`은 렌더 때 `window.location.pathname`을 한 번 읽고 `matchShareId`로 `/share/:id`만 나눈다. `popstate` 처리가 없다(T-1).
- 배포(Vercel)는 `/car`, `/car/` 새로고침에 200 `index.html`을 준다(T-1 실측).

## 선택지
| | 방법 | 장점 | 단점 |
|---|---|---|---|
| A | 경로를 React 상태로 드는 훅(`usePathname`) + `navigate()`(`pushState` 후 상태 갱신) + `popstate` 구독 | 패키지 0개, 30줄 안팎, 기존 `matchShareId` 방식과 같은 결 | 직접 만든 코드라 테스트를 우리가 써야 함 |
| B | 해시 주소(`/#/car`) | 서버 폴백 불필요 | 원본이 `/car`를 요구. 로그인 복귀 주소에 해시가 섞여 Supabase OAuth 해시 토큰과 충돌 위험 |
| C | 라우터 라이브러리 | 기능 많음 | 제약 위반(NFR-16) |

## 결정
A. `src/carbook/navigation.ts`에 `usePathname()`, `navigate(path)`, `isCarPath(path)`를 둔다.
- `isCarPath`: `/car`와 `/car/`만 참(BR-01).
- `navigate`: 현재 경로와 같으면 아무것도 하지 않는다(같은 탭 재클릭 시 기록을 쌓지 않음, F-01 예외 흐름). `history.pushState` 뒤 구독자에게 알린다.
- 탭 링크는 `<a href>`. 클릭 처리에서 `button !== 0`이거나 Ctrl·Meta·Shift·Alt가 눌렸으면 가로채지 않는다(AC-01-4).
- 분기 순서: `/share/:id`(기존 그대로) → `isCarPath` → 나머지는 캘린더(AC-01-3).
- 차계부는 `React.lazy`로 나누지 않고 같은 번들에 넣는다(T-1-7: 배포가 없는 청크에도 200 HTML을 줘서 오래 켜 둔 탭의 동적 import가 깨진다).

## 결과
- 쉬워지는 것: 의존성 없음. 테스트는 기존 방식(`history.pushState` 후 렌더, `App.test.tsx`)으로 된다.
- 어려워지는 것: 경로가 더 늘면(3개 이상) 직접 만든 분기가 커진다. 그때 라우터 도입을 다시 검토한다.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | 차계부 설계 | Product Owner(conv-8c399a) | F-01 |
