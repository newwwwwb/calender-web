# QA 보고서

- 소유자: QA Engineer · 기준 문서: [03_spec.md](../03_spec.md) F-08 · 판정 규칙: 증거가 없거나 모호하면 FAIL

## MPR-19 차계부 데이터 계약 문서 (`docs/api/carbook.md`)

- 검증 대상: main 커밋 `1771744`, `618e9ef` (`git branch --contains` → main 포함, 확인함).
- 이 티켓은 문서다. 실행할 코드가 없으므로 "계약이 수락 기준을 충족하는 구조를 명시하는가"를 문서 줄 번호로 확인했다. 동작 검증(AC 실행)은 구현 티켓(MPR-25 등)에서 한다.

| 티켓 | 기준 | 케이스 | 판정 | 근거(명령·위치) |
|---|---|---|---|---|
| MPR-19 | AC-08-3 "캘린더에서 지운 일정은 `/car`를 열면 같은 제목·날짜로 다시 생기고 항목당 1건" | 정상: 일정이 없으면 같은 id로 다시 쓴다 | PASS | `carbook.md` 6.4 3번(`fetchEvents`에 없는 id → `syncEvent(spec, null)`), 4.2 `syncEvent`가 `eventId`로 `upsert onConflict id` |
| MPR-19 | AC-08-3 | 경계: 연결 id 101개 | PASS | 4.2 `fetchEvents` 100개씩 나눠 조회, ADR-003 "열 때 재생성" |
| MPR-19 | AC-08-3 | 예외: 계산 불가면 만들지 않음 | PASS | 6.4 3번 "계산 불가면 건너뜀"(BR-23과 일치) |
| MPR-19 | AC-08-13 "첫 저장을 두 탭이 동시에 해도 카테고리 1개" | 정상: 고정 id RPC, 이름 검색 없음 | PASS | 5장 "멱등 … 두 탭이 동시에 불러도 같은 id, 카테고리 1개", ADR-004 |
| MPR-19 | AC-08-13 "탭 A 엔진오일, 탭 B 보험 만기 → 각 일정 1건" | 정상: 만기일 | PASS | 6.2 만기일 저장 `createDueDate`(insert) → `syncEvent`. `(vehicle_id, kind)` unique라 같은 종류 둘째는 `23505`로 일정 쓰기 전에 실패(1.1 표 2행, 7.3) |
| MPR-19 | AC-08-13 "같은 항목을 두 탭에서 동시에 저장해도 연결 일정 1건" | 실패/경계: `event_id`가 `null`인 기존 항목(추천 항목 등)을 두 탭이 동시에 저장 | **FAIL** | 아래 F-1 |

### F-1 (MPR-19 · AC-08-13 둘째 문장): 같은 항목 동시 첫 저장 시 일정이 2건이 될 수 있다

- 기대: 같은 항목을 두 탭에서 동시에 저장해도 연결 일정 1건(AC-08-13).
- 문서의 흐름: `docs/api/carbook.md` 6.2 "항목 저장·교체 완료" = "`event_id`가 없으면 새 uuid → `updateItem`(그 `eventId` 포함) → `syncEvent`". `updateItem`은 조건 없는 `update … eq('id', id)`이고(3장 질의 대응 표), 돌려받은 행의 `event_id`를 쓰라는 규정이 없다.
- 재현 절차(계약대로 구현했을 때):
  1. 추천 항목(`event_id = null`)이 있는 같은 계정으로 탭 A, B를 연다.
  2. 두 탭에서 같은 항목에 날짜를 넣고 동시에 저장한다.
  3. A는 uuid `U1`, B는 `U2`를 만들어 `updateItem`(마지막 쓰기가 이김, 행에는 `U2`)을 하고 각자 `syncEvent`로 `events`에 `U1`, `U2` 일정을 만든다.
- 실제(문서 분석 결과): `events`에 일정 2건, 행은 `U2`만 가리킴. `U1` 일정은 아무 행도 가리키지 않아 지워지지 않고 열 때 점검(6.4)도 모른다(NFR-34·35 위반).
- 같은 문제가 없는 경로: 만기일(`insert` + unique), 이미 `event_id`가 있는 항목(같은 id로 수렴), 새 항목 추가(탭마다 행 id가 달라 서로 다른 항목).
- 해결은 계약 쪽 결정이다(예: `updateItem`에 `event_id is null` 조건부 갱신을 두고 0행이면 행을 다시 읽어 그 `event_id`로 `syncEvent`). 방법은 API Designer·Software Architect가 정한다. QA는 코드와 계약을 고치지 않는다.
- 상태: MPR-19 done **보류**. AC-08-3은 문서상 충족.

## MPR-17 차계부 테이블 4개·RLS (`supabase/schema_carbook.sql`)

- 검증 대상: main `51d5c5c`(병합), 이후 `ea330a7`. 한계: **PGlite(WASM Postgres) 모의 환경이며 실제 Supabase·PostgREST가 아니다.** 운영 확인은 `docs/db.md` 6장 항목으로 남아 있다.
- 범위: MPR-17의 파일은 SQL과 `docs/db.md`뿐이다. AC-03-6의 "연결 일정이 캘린더에서 사라짐"은 클라이언트 동작(BR-22)이라 이 티켓에서 판정하지 않고, 구현 티켓에서 확인한다. 여기서는 "차량과 딸린 행 삭제, 다른 차량 그대로"를 확인했다.
- 실행: `node docs/qa/scripts/mpr17_rls.mjs <pglite index.js 경로>` → `RESULT pass=24 fail=0` (PGlite 0.2.17을 임시 폴더에 설치, package.json 변경 없음).
- 병합 후 `npm test` → `Tests 703 passed (703)`, `npm run build` → `built in 490ms`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-17 | AC-03-2 타 계정 격리 | 정상: A는 자기 차량 추가(user_id 자동 채움) | PASS | `node docs/qa/scripts/mpr17_rls.mjs …` |
| MPR-17 | AC-03-2 | B가 4개 테이블 조회 → 0행, A 차량 id 직접 조회 0행 | PASS | 같음 |
| MPR-17 | AC-03-2 | B가 A 차량 수정·삭제 → 0행 바뀜, A 데이터 그대로 | PASS | 같음 |
| MPR-17 | AC-03-2 | 실패: B가 `user_id=A`로 insert, A 차량에 기록·항목·만기일 insert → `42501` | PASS | 같음 |
| MPR-17 | AC-03-2 | 경계: 로그인 없음 조회 0행, `anon` 조회 `42501` | PASS | 같음 |
| MPR-17 | AC-03-2 | 만기일 (차량, 종류) 중복 → `23505` | PASS | 같음 |
| MPR-17 | AC-03-6 (DB 부분) | 차량 삭제 → 기록·항목·만기일 0건, 다른 차량의 3종 1건씩과 차량 행 유지 | PASS | 같음 |
| MPR-17 | AC-03-6 (캘린더 일정 삭제) | 이 티켓 범위 밖 | 해당 없음 | 구현 티켓(차량 삭제 흐름)에서 확인 |

판정: MPR-17 **PASS**. 비차단 메모: 실제 Supabase에서의 `anon` 동작·grant 기본값은 운영 적용 전 확인 필요(`docs/db.md` 6장).

## MPR-20 domain 타입·문구·오늘 날짜·입력 검사 (`src/carbook/domain/`)

- 검증 대상: main `5ae74e1`(A `0f94514` → B `c791eae` 병합). 범위: 순수 함수(`validation.ts`, `messages.ts`, `dateKey.ts`)가 돌려주는 오류 문구와 "값 없음". "칸 아래에 보임", "저장 요청 0건"은 화면·훅 동작이라 이 티켓에서는 "오류가 있으면 저장값을 돌려주지 않는다"까지만 확인했고, 화면 쪽 확인은 양식 구현 티켓에서 한다.
- 실행: `npx vitest run --config <vitest.qa.config.mjs>` (include `docs/qa/scripts/*.qa.ts`, 설정 파일은 임시 폴더) → `Tests 32 passed (32)`. 스크립트 `docs/qa/scripts/mpr20_domain.qa.ts`는 기대 문구를 `03_spec.md` 1.2·입력 표에서 가져온 글자 그대로(또는 `messages.ts` 상수와 대조, AC-04-4·AC-04-5의 두 문구는 리터럴로 직접 비교)로 비교한다.
- 병합 후 전체: `npm test` → `Test Files 63 passed (63)`, `Tests 735 passed (735)`. `npm run build` → `built in 509ms`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-20 | AC-03-3 | 별칭 비움·공백 → MSG-05, 연식 1949·올해+2 → MSG-08 | PASS | 위 vitest 명령 |
| MPR-20 | AC-03-3 | 경계: 연식 1950·올해+1 통과, 별칭 20자 통과·21자 MSG-16 | PASS | 같음 |
| MPR-20 | AC-04-4 | 금액 비움 → "금액을(를) 입력해 주세요", 날짜·종류 비움도 MSG-05 | PASS | 같음 |
| MPR-20 | AC-04-5 | 금액 `-100`·`12.5` → MSG-06, 주유량 `abc` → MSG-07, `10000` → "주유량은(는) 9,999.99 이하로 입력해 주세요" | PASS | 같음 |
| MPR-20 | AC-04-5 | 경계: 주유량 9999.99·0 통과, 38.456·-1 MSG-07, 금액 999,999,999 통과·10억 MSG-17 | PASS | 같음 |
| MPR-20 | AC-06-9 | km·개월 모두 비움 → MSG-09, km 주기 있고 마지막 교체 주행거리 비면 MSG-19, 개월만 있으면 통과 | PASS | 같음 |
| MPR-20 | AC-06-14 | 마지막 교체일 내일 → MSG-20, 오늘 통과, 비움 MSG-05, 없는 날짜 MSG-15 | PASS | 같음 |
| MPR-20 | AC-07-4 | 만기일 비움 → MSG-05, `2027-02-30`·`2027/03/10` → MSG-15, 오늘+3650 통과·+3651 MSG-15 | PASS | 같음 |
| MPR-20 | AC-10-3 | 음수·문자 → MSG-06, 빈칸(필수) → MSG-05, 주유량 문자 → MSG-07, 오류 시 값 없음, 여러 칸 오류 동시 반환 | PASS | 같음 |
| MPR-20 | AC-10-4 | 연식 1949·올해+2 → MSG-08(문구에 올해+1 포함), 1950·올해+1 통과 | PASS | 같음 |
| MPR-20 | AC-10-5 | km·개월 비움 → MSG-09, 주기 `0`·`1.5`·`abc`·`-3` → MSG-21, 개월 601 → MSG-17, 600·999999 통과 | PASS | 같음 |
| MPR-20 | BR-10 (참고) | 주유 아님 + 주유량 `abc` → 오류 없이 `liters: null, fullTank: false` | PASS | 같음 |

판정: MPR-20 **PASS**. 비차단 메모(Security Low 2건과 같음): 보이지 않는 문자는 trim되지 않음, 일부 제약은 클라이언트에만 있음. 화면 단 "저장 요청 0건"은 양식 티켓에서 확인.

## MPR-29 주소 훅·파일철 탭 (`src/carbook/navigation.ts`, `FileTabs.tsx`, `src/App.tsx`)

- 검증 대상: main `52b652e`(1/3 `40a392f`, 2/3 `dc086e6`, 3/3 병합). 환경: Vite 개발 서버를 Supabase 환경변수를 비워 띄움(로그인 전 상태, 실제 백엔드 호출 없음), Chrome(Playwright).
- 실행: `node docs/qa/scripts/mpr29_nav.mjs <playwright-core index.mjs> <현재 앱 URL> <탭 도입 전(`ec21359`) 앱 URL> docs/qa/screens` → `RESULT pass=46 fail=0`. 375px와 1280px 두 폭에서 같은 케이스를 실행.
- 병합 후 전체: `npm test` → `Test Files 66 passed (66)`, `Tests 758 passed (758)`. `npm run build` → `built in 452ms`.
- 스크린샷: `docs/qa/screens/mpr29-{mobile375,desktop1280}-{calendar,car,widget}.png` (탭이 오른쪽 가장자리에 붙고 현재 탭이 검은색으로 표시됨을 눈으로 확인).
- 범위 한계(FAIL 아님): 차계부 화면은 아직 임시 화면(`<h1>차계부</h1>`)이라 AC-01-1의 "기록 탭이 보임", AC-02-4의 "안내 화면"은 MPR-31 구현 뒤에 다시 확인한다. 이 티켓에서는 "주소가 `/car`이고 차계부 화면(h1)이 열림"까지 확인했다. Meta(Cmd)+클릭의 실제 새 탭 열기는 Mac 브라우저 동작이라 Windows에서는 "앱이 기본 동작을 막지 않음"으로 대신 확인했다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-29 | AC-01-1 | "차계부" 탭 → 주소 `/car`, 차계부 화면, 현재 탭 `aria-current`, 문서 제목 "차계부"; "캘린더" 탭 → `/`와 캘린더 | PASS(기록 탭 부분은 MPR-31에서) | `node docs/qa/scripts/mpr29_nav.mjs …` |
| MPR-29 | AC-01-2 | 뒤로 → `/` 캘린더, 앞으로 → `/car`, `/car` 새로고침 후 `/car` 유지, 같은 탭 재클릭은 기록을 쌓지 않음 | PASS | 같음 |
| MPR-29 | AC-01-3 | `/abc` → 캘린더, `/car/` → 차계부(현재 탭 표시 포함) | PASS | 같음 |
| MPR-29 | AC-01-4 | Ctrl+클릭: 새 탭이 `/car`를 열고 현재 탭 주소·화면 그대로. Meta·Shift·Alt·가운데 버튼: 앱이 기본 동작을 막지 않음 | PASS | 같음 |
| MPR-29 | AC-01-6 | 대조: 캘린더에서 `n` → 편집창 열림. `/car`에서 탭 링크에 포커스하고 `n` → 편집창 없음(직접 진입·탭 이동 후 둘 다) | PASS | 같음 |
| MPR-29 | AC-02-4 | 로그인 전 `/`에서 탭 2개(캘린더·차계부), 차계부 탭 → `/car` | PASS(안내 화면은 MPR-31에서) | 같음 |
| MPR-29 | AC-13-1 | `/?widget=1` 에서 파일철 탭 DOM 없음 | PASS | 같음 |
| MPR-29 | AC-13-2 | 일반 접속에서 탭 2개 | PASS | 같음 |
| MPR-29 | AC-13-3 | 위젯 화면의 모든 보이는 요소(375px 166개, 1280px 393개) 위치·크기가 탭 도입 전(`ec21359`)과 같음(CSS 모듈 해시는 비교에서 제외) | PASS | 같음 |
| MPR-29 | AC-13-4 | `/car?widget=1`: 차계부 열림, 탭 DOM 없음 | PASS | 같음 |

판정: MPR-29 **PASS**(위 범위 한계 포함). 열린 비차단 항목: A11Y-2(강제색 현재 탭 표시), A11Y-3(모바일 토요일 시간칸 가림)은 Software Architect 결정 대기, QA 판정 대상 아님. MPR-31 검증 때 AC-01-1·AC-02-4의 남은 부분을 확인한다.

## MPR-18 '차계부' 카테고리 함수·공유 상대 숨김 정책 (`supabase/schema_carbook.sql`)

- 검증 대상: main `c967ee9`(병합). **한계: PGlite(WASM Postgres) 모의 환경이며 실제 Supabase·PostgREST가 아니다.** 단일 연결이라 AC-08-13의 "진짜 동시 실행"은 만들 수 없다(연달아 두 번 호출로 대신).
- 스크립트 갱신(Delivery Manager 요청): `docs/qa/scripts/pg_env.mjs`가 Supabase 모양 환경을 만든 뒤 기존 `schema.sql`, `schema_share.sql`, `schema_share_mutual.sql`, `schema_together.sql`을 먼저 적용하고 `schema_carbook.sql`을 두 번 적용한다(`schema_share_fix*.sql`은 PGlite에서 인자명 오류로 제외, db.md 7.1과 같음). `mpr17_rls.mjs`는 이 환경을 쓰도록 바꿨다.
- 실행:
  - `node docs/qa/scripts/mpr18_hide.mjs <pglite index.js>` → `RESULT pass=34 fail=0`
  - `node docs/qa/scripts/mpr17_rls.mjs <pglite index.js>` (갱신 후 재실행) → `RESULT pass=24 fail=0`
  - `npm test` → `Test Files 66 passed (66)`, `Tests 758 passed (758)`; `npm run build` → `built in 454ms`
- 사용자: A 소유자, B 공유 상대, C 참여자로 초대됨(공유 상대 아님), D 무관. A의 일정 6건: 일반(norm), 만기일 연결(due), 직접 만든 차계부 카테고리(direct), 항목 연결+분류 없음(orphan), 분류 없는 일반(nocat), 차계부+C 참여(part).

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-18 | AC-08-4 | ensure 결과가 `md5('carbook-category:'‖사용자)` 고정 id, 두 번째 호출도 같은 id, 카테고리 행 1개, 이름·색을 바꿔도 안 건드림, 사용자마다 id 다름 | PASS | `node docs/qa/scripts/mpr18_hide.mjs …` |
| MPR-18 | AC-08-13 (DB 부분: 카테고리 1개) | 카테고리를 지운 뒤 `Promise.all`로 ensure 두 번 → 1개, 같은 id | PASS(모의 한계 있음). 일정 1건 부분은 MPR-19 F-1이 열려 있어 MPR-25 검증에서 확인 | 같음 |
| MPR-18 | AC-08-14 | 카테고리 삭제 → 두 연결 일정 분류 풀림 → ensure가 같은 id로 1개 재생성 → 일정 2건 재묶기 → 모두 새 카테고리 소속 | PASS (재묶기 update는 클라이언트 몫이라 SQL로 직접 실행) | 같음 |
| MPR-18 | AC-16-1 | B: 일정 6건 중 norm·nocat 2건만, 연결 일정은 id 직접 조회도 0건, A의 차계부 카테고리 없음(업무만) | PASS | 같음 |
| MPR-18 | AC-16-2 | A: 일정 6건 전부, 카테고리 2개 | PASS | 같음 |
| MPR-18 | AC-16-3 | B: 일반 일정과 `category_id` null 일반 일정 보임 | PASS | 같음 |
| MPR-18 | AC-16-5 | 기존 `supabase/*.sql` 변경 0건(`git diff --stat 87f6f44 HEAD -- supabase`: `schema_carbook.sql` +206만), `src/components`·`src/state` 변경 0건, `src/App.tsx`는 `CalendarApp` 본문 밖(import와 `App()`·임시 화면)만 변경 | PASS | `git diff --stat 87f6f44 HEAD -- supabase src/components src/state src/App.tsx` |
| MPR-18 | AC-16-6 | 카테고리 삭제로 분류가 풀린 연결 일정(due·orphan) B에게 0건, ensure·재묶기 뒤에도 0건, 다시 만든 카테고리도 B에게 안 보임 | PASS | 같음 |
| MPR-18 | AC-16-7 | 직접 만든 차계부 카테고리 일정: B에게 0건, A에게 보임 | PASS | 같음 |
| MPR-18 | AC-16-4 (요청에 따라 확인 대상에 추가) | 기존 캘린더·공유 앱 테스트 전체 | PASS (`npm test` 758 passed) | `npm test` |
| MPR-18 | 경계·실패(추가) | 대칭(A도 B의 차계부 일정 못 봄), 참여자 C는 초대된 일정만·카테고리 0개, 무관 D 0건, 로그인 없이 ensure → `28000`, `anon`의 함수 3개 실행 → `42501`, B가 A의 일정 수정·카테고리 삭제 → 0행, 파일 2회 적용 오류 없음 | PASS | 같음 |

- 알려진 한계(판정에 넣지 않음, 이미 문서화): ① 직접 만든 일정은 카테고리에 속해 있을 때만 숨는다(ADR-005 수용). ② B가 A의 고정 id로 자기 카테고리를 먼저 만드는 것이 지금은 **허용된다**(`INFO` 출력으로 확인) — `docs/db.md` 7장 한계 2와 일치, 설계 보완 MPR-42에서 막을 예정. ③ 성능은 `docs/perf/report.md`(MEETS, 공유 상대에게 보이는 일정 약 5,000건 이하 조건)를 따르며 QA가 다시 측정하지는 않았다.
- 판정: MPR-18 **PASS**.

### MPR-19 재검증 (F-1 보완, main `6283458`, 2026-11-06)

- 변경 확인: `git diff 618e9ef 6283458 -- docs/api/carbook.md` — 2장 수정은 `event_id`를 보내지 않음, 3장 `updateItem`·`updateDueDate`에 `claimEventId`와 'event_id 선점' 규칙, 6.2 항목·만기일 행, 8장 9번, 변경 기록(호환 깨짐 명시).
- 문서 대조: 계약 3장의 질의 순서(① `event_id is null`일 때만 선점 → ② `event_id` 없이 나머지 열 갱신 후 돌려받은 행의 `event_id`를 정본으로 `syncEvent`)를 두 탭 경쟁에 적용하면 먼저 선점한 탭의 uuid 하나만 쓰인다. 진 탭의 uuid는 어디에도 쓰이지 않아 고아 일정이 없다.
- 실행: `node docs/qa/scripts/mpr19_claim.mjs <pglite index.js>` → `RESULT pass=12 fail=0`(PGlite, 실제 Supabase 아님; 계약의 두 질의를 SQL로 옮겨 교체 항목·만기일 각각 확인: 선점 1행/0행, 둘 다 같은 `event_id` 수신, 기존 값 불덮어씀, 비운 뒤 재선점, ②가 `event_id`를 안 건드림).

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-19 | AC-08-13 둘째 문장 | `event_id` null 항목·만기일을 두 탭이 동시 저장 → 한 uuid로 수렴, 일정 1건, 고아 0 | PASS(문서 + 질의 순서 확인. 구현 동작은 MPR-24·25 검증에서) | `node docs/qa/scripts/mpr19_claim.mjs …` |
| MPR-19 | AC-08-13 첫 문장 | 카테고리 1개, 만기일 각 1건 | PASS (앞선 판정 유지) | 위 표 |
| MPR-19 | AC-08-3 | 열 때 점검에서 지운 일정 재생성 | PASS (앞선 판정 유지, 6.4 변경 없음) | 위 표 |

- 비차단 관찰(구현 티켓에서 확인): 화면 상태의 `eventId`가 non-null인데 DB 행의 `event_id`가 그새 null이 된 경우(다른 탭의 `clearEventId` 등)는 `claimEventId`를 넘기지 않아 ②가 돌려주는 `eventId`가 null일 수 있다. 계약은 이때 `syncEvent`를 어떻게 하는지 적지 않았다. 드문 경로라 MPR-24·25 구현·검증에서 "null이면 새로 선점하거나 일정 쓰기를 건너뛰고 오류 없이 처리"되는지 확인한다.
- 판정: MPR-19 **PASS** → done.
