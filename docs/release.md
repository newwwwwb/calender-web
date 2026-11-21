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

## 1. 운영에 올리기 (사용자 대시보드 절차)

전제: 릴리스 후보(RC) 커밋의 전체 `npm test`·`npm run build`·린트 통과, 판정서 READY, Michael 승인이 모두 끝났다. 대시보드 작업은 Vercel `bobtong` 팀 권한이 있는 사용자가 한다(DevOps는 대시보드 로그인이 없다).

1. **RC 커밋 정하기.** RC는 `origin/main`의 `67def4d`(판정서 READY 확정 커밋. 직전 RC 판정 대상 `5f66e40` 대비 docs만 변경)로 안내받았다. 다른 SHA를 안내받으면 그 값을 적어 둔다.
2. **Production Branch 확인(읽기만).** Vercel → 프로젝트 `calender-web` → Settings → Git → *Production Branch*. 값만 확인해 기록하고 **바꾸지 않는다**.
3. **RC의 Preview 배포 찾기.** Deployments 목록에서 *Environment: Preview*, *Source*의 커밋이 RC SHA인 행을 연다. 상태가 *Ready*여야 한다. *Error*·*Building*이면 중단하고 Release Manager에게 알린다.
4. **Production 환경값 확인.** Preview 배포를 Promote하면 Vercel이 그 커밋을 **완전히 다시 빌드**하고 **Production 환경변수**를 쓴다(Preview 환경변수는 운영에 쓰이지 않는다. 공식 문서 vercel.com/docs/deployments/promoting-a-deployment). 이 앱은 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`를 빌드 때 박아 넣으므로, Settings → Environment Variables에서 두 변수가 **Production 환경에** 있고 **운영 Supabase 프로젝트 값**인지 본다(이름과 '어느 프로젝트인지'만 보고 값은 복사·기록하지 않는다). 없거나 다른 프로젝트를 가리키면 Promote하지 말고 중단한다. 이 경우 운영에 빈 화면 또는 엉뚱한 DB 연결이 나간다.
5. **(선택) Preview에서 눈으로 확인.** 아래 2장 제약 때문에 **로그인 없이** 보이는 화면까지만 확인한다.
6. **Promote.** 그 Preview 배포 행의 `⋯` 메뉴 → **Promote to Production** → 확인. Promote는 재빌드를 시작하므로 몇 분 걸린다. 빌드가 *Ready*가 되고 Production 배포 목록 맨 위에 RC 커밋이 *Current*로 보이면 끝난 것이다. 빌드가 실패하면 운영은 그대로(87f6f44)이므로 Release Manager에게 알리고 멈춘다.
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

1. Vercel → 프로젝트 `calender-web` → **Overview**의 **Production Deployment** 타일 → **Instant Rollback**을 누른다(공식 문서 vercel.com/docs/instant-rollback). 되돌릴 대상으로 이전 Production 배포 `87f6f44`(2026-10-08)를 고른다.
2. 확인한다. 롤백은 재빌드 없이 즉시 운영 주소가 그 배포를 가리킨다.
3. 운영 주소를 새로고침해 이전 화면(차계부 없는 버전)으로 돌아왔는지 확인하고 Release Manager·god에게 시각과 이유를 알린다.

알아 둘 것:
- **DB는 되돌리지 않는다.** 87f6f44 이후 DB 변경은 차계부 테이블 추가뿐이고 옛 화면은 그 테이블을 쓰지 않으므로 롤백해도 문제없다. 차계부 테이블을 지우는 DOWN(docs/db.md 5장)은 데이터가 사라지므로 롤백에 쓰지 않는다(별도 Michael 승인).
- **롤백 뒤에는 운영 도메인 자동 할당이 꺼진다.** 이후 새 배포가 운영 주소에 자동으로 붙지 않는다. 이 프로젝트는 원래 수동 Promote 방식이라 일상 운영에는 영향이 작지만, 다시 올릴 때는 1장 6번처럼 사람이 Promote해야 한다는 점을 기억한다.
- **Hobby 플랜은 바로 이전 Production으로만 되돌릴 수 있다**(공식 문서). 첫 Promote 직후에는 87f6f44가 바로 이전 Production이라 롤백할 수 있다. Promote를 연달아 여러 번 하면 87f6f44를 못 고르게 되므로 Promote 한 번마다 1장 7번 확인을 끝낸 뒤 다음으로 간다. 이 프로젝트의 플랜은 확인하지 못했다(Hobby가 아니면 선택 범위가 더 넓다).
- 롤백이 대시보드에서 막히면: 87f6f44 커밋의 Preview가 아니라 **새 배포**가 필요하다. 이때는 위험하므로 god에게 보고하고 사용자 판단을 받는다.

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-21 | 최초 작성: 수동 Promote 절차, Preview 로그인 제약, Instant Rollback | main 푸시가 Preview로만 배포돼 Production이 87f6f44에 머무름(조사 결과) | God(사용자 결정) | 설정 변경 없음. 문서만 추가 |
| 2026-11-21 | 정정: Preview→Production Promote는 재빌드·Production 환경변수 사용(주의 2 삭제, 1장 4번을 Production 환경값 확인으로 변경), RC를 67def4d로 안내, 3장 롤백 경로(Overview 타일)와 롤백 후 자동 할당 꺼짐·Hobby 제한 반영 | 초안이 '재빌드 없는 승격'으로 잘못 적음(Vercel 공식 문서와 다름) | God | 문서만 변경 |
