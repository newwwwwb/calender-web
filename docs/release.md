# 릴리스 실행·롤백 (docs/release.md)

- 날짜: 2026-11-21 · 소유자: DevOps Engineer · 근거: god 결정(수동 Promote를 배포 관문으로 유지, conv-vercel-1121)
- 운영: `calender-web-ten.vercel.app` (Vercel 프로젝트 `bobtong/calender-web`, 리포 `newwwwwb/calender-web`)
- 이 문서는 운영 배포를 **하는 법**과 **되돌리는 법**이다. 운영 배포와 운영 설정 변경은 Michael 승인 뒤에만 한다. 비밀값(키·토큰)은 이 문서에도 대화에도 적지 않는다.

## 0. 현재 배포 구조 (2026-11-21 조사, 공개 응답·GitHub API로만 확인)

| 항목 | 내용 |
|---|---|
| Git 연동 | 켜져 있음. 푸시마다 Vercel 봇이 배포를 만든다(연결 브랜치는 `main` 하나) |
| `main` 푸시의 결과 | **Preview** 배포. 2026-11-05 이후 모든 푸시가 그랬고 `d0cadfc`도 Preview 성공 |
| 마지막 Production | `87f6f44` (2026-10-08 00:04Z). 이후 main에 249커밋이 쌓임 |
| 코드의 배포 설정 | 없음. `.github` 워크플로 없음, `vercel.json`은 SPA rewrite 한 줄 |
| DB 변경 | 87f6f44 이후 `supabase/`에서 바뀐 것은 `schema_carbook.sql`(+테스트)뿐이고 **운영에는 2026-11-18에 이미 적용됨**(docs/db.md 변경 기록) |

**운영 방침:** main 푸시는 Preview로 두고, Production은 사람이 'Promote'해야 올라가게 한다. 이 수동 Promote가 승인 관문이다. **설정을 바꾸지 않는다**(Production Branch를 main으로 바꾸거나 자동 배포를 켜지 않는다).

주의 1: **운영은 87f6f44 이후 main 249커밋을 한 번에 받는다.** 차계부뿐 아니라 그 사이 모든 변경이 한꺼번에 나간다. 판정서(docs/release/verdict.md)가 이 범위를 기준으로 READY여야 한다.

주의 2: Promote는 Preview에서 **이미 빌드된 결과를 그대로** 운영 주소에 붙인다(다시 빌드하지 않음). 이 앱은 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`를 **빌드 때** 박아 넣으므로, Preview 빌드에 쓰인 값이 그대로 운영에 나간다. Promote 전에 아래 1단계 4번을 반드시 본다.

## 1. 운영에 올리기 (사용자 대시보드 절차)

전제: 릴리스 후보(RC) 커밋의 전체 `npm test`·`npm run build`·린트 통과, 판정서 READY, Michael 승인이 모두 끝났다. 대시보드 작업은 Vercel `bobtong` 팀 권한이 있는 사용자가 한다(DevOps는 대시보드 로그인이 없다).

1. **RC 커밋 정하기.** Release Manager가 알려 준 커밋 SHA를 적어 둔다(예: `d0cadfc` 이후의 최신 main).
2. **Production Branch 확인(읽기만).** Vercel → 프로젝트 `calender-web` → Settings → Git → *Production Branch*. 값만 확인해 기록하고 **바꾸지 않는다**.
3. **RC의 Preview 배포 찾기.** Deployments 목록에서 *Environment: Preview*, *Source*의 커밋이 RC SHA인 행을 연다. 상태가 *Ready*여야 한다. *Error*·*Building*이면 중단하고 Release Manager에게 알린다.
4. **빌드 환경값 확인.** Settings → Environment Variables에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 **Preview 환경에도** 있고 운영 Supabase 프로젝트를 가리키는지 본다(이름과 '어느 프로젝트인지'만 보고 값은 복사·기록하지 않는다). Preview에 없거나 다른 프로젝트를 가리키면 Promote하지 말고 중단한다. 이 경우 운영에 빈 화면 또는 엉뚱한 DB 연결이 나간다.
5. **(선택) Preview에서 눈으로 확인.** 아래 2장 제약 때문에 **로그인 없이** 보이는 화면까지만 확인한다.
6. **Promote.** 그 Preview 배포 행의 `⋯` 메뉴 → **Promote to Production** → 확인. 완료되면 Production 배포 목록 맨 위에 RC 커밋이 *Current*로 보인다.
7. **운영 확인(5분 안).** `https://calender-web-ten.vercel.app/` 과 `/car`가 열리고, 로그인 후 캘린더와 차계부가 뜨는지, 브라우저 콘솔에 빨간 오류가 없는지 본다. 결과(시각·확인한 것)를 Release Manager에게 알린다.

**롤백 조건(하나라도 해당하면 즉시 3장):** 운영 주소가 5xx이거나 빈 화면 · 로그인 후 캘린더 또는 `/car`가 열리지 않음 · 콘솔에 반복되는 Supabase 오류(401·403·500) · 다른 사용자의 데이터가 보임(이 경우 P0로 god·Security Reviewer에게도 알림).

## 2. Preview 주소에서 로그인할 때의 문제

Preview 주소는 배포마다 다르다(예: `calender-<해시>-bobtong.vercel.app`). 로그인 흐름을 코드로 확인했다.

| 진입점 | 코드 | Preview에서 일어나는 일 |
|---|---|---|
| 상단 로그인 버튼(`AuthButton`) | `signInWithGoogle()` — `redirectTo` 없음 | 로그인 뒤 Supabase의 **Site URL(운영 주소)** 로 돌아간다 → Preview에서 로그인하면 운영으로 튕김 |
| `/car` 로그인(`CarbookApp`), 공유 수락(`AcceptSharePage`) | `redirectTo = window.location.href`(Preview 주소) | 그 주소가 Supabase **Redirect URLs 허용 목록에 없으면** Supabase가 허용 목록 밖 요청을 Site URL(운영)로 대체해 역시 운영으로 튕김 |

Google 쪽 리디렉션은 Supabase 콜백 주소 하나라서 Preview와 무관하다. 문제는 Supabase의 Site URL·Redirect URLs뿐이다. (Preview에 Vercel 배포 보호(로그인 요구)가 걸려 있는지는 공개 응답으로 확인하지 못했다. 걸려 있으면 Vercel 계정으로 먼저 열어야 한다.)

**대응(권장 순서):**

1. **Preview에서는 로그인하지 않는다.** 로그아웃 상태 화면(로그인 게이트, 정적 화면)까지만 눈으로 확인한다. 로그인 이후 동작은 이미 로컬·QA에서 검증했고, 운영 Promote 뒤 7번에서 한 번 더 확인한다. **설정 변경이 없어 가장 안전하다.**
2. Preview에서 로그인 검증이 꼭 필요하면 Supabase Authentication → URL Configuration → Redirect URLs에 Preview 주소 패턴(예: `https://calender-*-bobtong.vercel.app/**`)을 추가해야 한다. **이것은 운영 인증 설정 변경이라 Michael 승인이 필요**하고, 끝나면 패턴을 지운다. 상단 로그인 버튼(`redirectTo` 없음)은 이 설정과 관계없이 계속 운영으로 간다. `/car` 로그인으로만 검증할 수 있다.
3. 운영(`calender-web-ten.vercel.app`)과 `/car`는 2026-11-18에 Redirect URLs에 등록 완료(docs/db.md 변경 기록)이므로 Promote 뒤 운영에서의 로그인은 영향이 없다.

## 3. 되돌리기 (Instant Rollback)

**언제:** 1장 롤백 조건에 해당할 때. 롤백도 운영 변경이므로 승인이 원칙이다. P0(데이터 노출·전체 장애)는 god에게 즉시 보고해 Michael의 승인을 바로 받는다(이 문서가 승인을 대신하지 않는다).

1. Vercel → 프로젝트 `calender-web` → **Deployments**(또는 Overview의 Production 항목) → 되돌릴 이전 Production 배포 `87f6f44`(2026-10-08) 행을 연다.
2. `⋯` 메뉴 → **Instant Rollback** → 확인. 빌드 없이 즉시 운영 주소가 그 배포를 가리킨다.
3. 운영 주소를 새로고침해 이전 화면(차계부 없는 버전)으로 돌아왔는지 확인하고 Release Manager·god에게 시각과 이유를 알린다.

알아 둘 것:
- **DB는 되돌리지 않는다.** 87f6f44 이후 DB 변경은 차계부 테이블 추가뿐이고 옛 화면은 그 테이블을 쓰지 않으므로 롤백해도 문제없다. 차계부 테이블을 지우는 DOWN(docs/db.md 5장)은 데이터가 사라지므로 롤백에 쓰지 않는다(별도 Michael 승인).
- Instant Rollback 뒤에는 Vercel이 운영 도메인의 자동 연결을 멈춘다. 이 프로젝트는 이미 수동 Promote 방식이라 영향이 없다. 다시 올릴 때는 1장 6번처럼 Promote한다.
- 플랜에 따라 Instant Rollback으로 고를 수 있는 이전 배포가 제한될 수 있다(예: 무료 플랜은 바로 직전 Production만). **플랜은 확인하지 못했다.** Promote 직후 87f6f44가 '직전 Production'이므로 1회 롤백은 가능해야 한다. Promote를 연달아 여러 번 하면 87f6f44를 못 고를 수 있으니 Promote 한 번마다 7번 확인을 끝낸 뒤 다음으로 간다.
- 롤백이 대시보드에서 막히면: 87f6f44 커밋의 Preview가 아니라 **새 배포**가 필요하다. 이때는 위험하므로 god에게 보고하고 사용자 판단을 받는다.

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-21 | 최초 작성: 수동 Promote 절차, Preview 로그인 제약, Instant Rollback | main 푸시가 Preview로만 배포돼 Production이 87f6f44에 머무름(조사 결과) | God(사용자 결정) | 설정 변경 없음. 문서만 추가 |
