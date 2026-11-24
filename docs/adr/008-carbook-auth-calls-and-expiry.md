# ADR-008 차계부의 로그인·로그아웃·만료 판정은 차계부 코드에서 supabase.auth를 직접 부른다 (v0.2)

- 상태: 승인 (Product Owner 2026-11-24, conv-carbook-v02)
- 관련: F-18(AC-18-4·6), F-27(BR-56~58, AC-27-1~10), AC-08-11·AC-27-8(`useAuth.ts`·`AuthButton.tsx` 0줄)

## 배경
- `useAuth().signOut`과 `signInWithGoogle`은 `supabase.auth`의 `{ error }` 결과를 버린다. 그래서 로그아웃 실패(AC-18-6, MSG-23)와 로그인 시작 실패(AC-27-2, MSG-29)를 알 수 없다.
- 로그인 공급자의 오류 리다이렉트(`error`, `error_description`)는 `useAuth`가 콘솔에만 남긴다.
- 쓰기 실패는 `request.ts`가 timeout·network·conflict·unknown으로만 나눈다. 401은 unknown이 되어 MSG-01이 뜬다(AC-27-4 실패).
- `useAuth.ts`·`AuthButton.tsx`는 고칠 수 없다(BR-58).

## 선택지
| | 방법 | 실패 감지 | 캘린더 코드 |
|---|---|---|---|
| A | `useAuth.ts`가 오류를 던지게 고친다 | 됨 | 변경 → AC-27-8 실패 |
| B | 차계부 `data/auth.ts`가 `supabase.auth.signOut()`·`signInWithOAuth()`를 직접 부르고 `{ error }`면 던진다. 상태 변화는 그대로 `onAuthStateChange` → `useAuth`가 받는다 | 됨 | 0줄 |
| C | 실패를 감지하지 않는다 | 안 됨 → AC-18-6·27-2 실패 | 0줄 |

## 결정
B.
- `src/carbook/data/auth.ts`: `signOutAll()`(인자 없이 `signOut()` = `global`, AC-18-4), `startGoogleLogin(redirectTo)`, `readLoginRedirectError(location)`(쿼리·해시의 `error`가 있으면 true. 값 문자열은 화면·로그에 쓰지 않는다).
- 로그인 실패 표시: `CarbookApp`이 첫 렌더에 `readLoginRedirectError`를 한 번 읽어 상태로 들고, 로그인 버튼을 다시 누르면 지운다. 주소는 고치지 않는다(`navigation.ts` 경로 판정에 영향 없음).
- 만료 판정: `request.ts`에 kind `auth`를 더한다. `status === 401` 또는 `code`가 `PGRST301`·`PGRST302`·`PGRST303`이면 `auth`. 403(`42501`, 정책 거부)은 `unknown` 그대로다(AC-19-9는 MSG-01).
- 만료 표시: `useCarbook`의 `run`이 `auth`를 받으면 토스트 대신 `authExpired = true`로 두고 `false`를 돌려준다. 양식은 지금처럼 실패 시 닫히지 않아 입력값이 남는다(BR-27). `CarbookApp`이 `role="alert"` 안내(MSG-30, "로그인", 닫기)를 보인다.
- 일정 쓰기(`calendarLink`)의 401은 이번 범위가 아니다. 지금처럼 MSG-11 재시도 버튼이다(스펙 F-27 기본 흐름 2의 쓰기 목록에 없음).

## 결과
- 쉬워지는 것: 캘린더 파일 0줄로 모든 실패를 화면에 알린다. 만료 판정이 한 곳(`classify`)이다.
- 어려워지는 것: 로그인·로그아웃 호출이 `useAuth`와 `data/auth.ts` 두 곳에 있다. 캘린더가 나중에 방식을 바꾸면(예: PKCE 옵션) 차계부도 같이 맞춰야 한다. PostgREST 오류 코드 목록은 공급자 버전에 따라 다를 수 있어 401 상태를 1순위로 본다.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-21 | 최초 작성(제안) | v0.2 설계 시작 | Product Owner(conv-carbook-v02) | MPR-64, MPR-66, MPR-67, MPR-69 |
| 2026-11-24 | 상태 승인 | PO 설계 검토 승인 | Product Owner(conv-carbook-v02) | 없음 |
