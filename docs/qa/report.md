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

- MPR-19 재검증 기준 커밋 갱신 확인(main `f2a1194`): `git diff 6283458 f2a1194 -- docs/api/carbook.md docs/adr/003-…md` — 질의 순서는 그대로이고 ① 오류 시 ② 생략, ② 결과 `event_id`가 null이면 캘린더 쓰기 생략, 불변식 문구만 추가됐다. 이 추가로 위 "stale eventId" 비차단 관찰이 계약에 반영됐다(구현 확인은 MPR-24·25). 선점 질의는 같아 `mpr19_claim.mjs` 12건 결과가 그대로 유효하다. 판정 유지: **PASS**.

## MPR-42 고정 id 선점 방지 (`supabase/schema_carbook.sql`)

- 검증 대상: main `88d64a1`(병합). 한계: **PGlite 모의 환경이며 실제 Supabase 아님**, 단일 연결이라 AC-08-13의 진짜 동시 실행은 아님(연달아 두 번 호출로 대신).
- 실행(모두 기존 `supabase/*.sql` 선적용 후 `schema_carbook.sql` 2회 적용):
  - `node docs/qa/scripts/mpr42_guard.mjs <pglite index.js>` → `RESULT pass=30 fail=0`
  - 회귀: `mpr18_hide.mjs` → `pass=34 fail=0`(이전 `INFO`가 "허용됨"에서 "거부 42501"로 바뀜), `mpr17_rls.mjs` → `pass=24 fail=0`, `mpr19_claim.mjs` → `pass=12 fail=0`
  - AC-16-5: `git diff --stat 87f6f44 HEAD -- supabase src/components src/state` → `schema_carbook.sql`만 +230, 나머지 0
  - `npm run build` → `built in 738ms`
  - `npm test`: 기본 병렬 실행에서 **서로 다른 테스트가 번갈아 1건씩 실패**했다(1회 `App.signedOut.test.tsx`의 "세션이 없으면 Supabase 테이블 요청이 0건이다", 2회 `TodoList.test.tsx`의 "삭제하면 확인창 없이…" 타임아웃성 `not.toBeInTheDocument`). 각 파일을 단독 실행하면 통과(`1 passed`, `10 passed`)하고 `npx vitest run --maxWorkers=3`에서는 `Test Files 68 passed (68)`, `Tests 779 passed (779)`. main이 `17a573c`(MPR-21 병합)까지 진행해 요청서의 758건이 아니라 779건이다. 이 티켓은 SQL만 바꿨으므로 원인은 MPR-42가 아니라 부하 때 흔들리는 타이밍 의존 테스트로 판단한다(원인 미확정, 미조사).

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-42 | AC-08-4 | 고정 id 행의 소유자 A, ensure 재호출 같은 id·오류 없음·카테고리 1개. 정상 경로(B의 일반 카테고리 추가·수정, B가 자기 고정 id로 insert)는 막히지 않음 | PASS | `node docs/qa/scripts/mpr42_guard.mjs …` |
| MPR-42 | AC-08-13 (DB 부분) | 연달아 ensure 두 번 → 오류 없음, 같은 id, 1개 | PASS(모의 한계). 일정 1건 부분은 MPR-25 검증에서 | 같음 |
| MPR-42 | 선점 차단(실패 케이스) | B가 A의 고정 id로 insert(user_id=B·A 둘 다), 공유 상대 아닌 D의 같은 시도, B가 자기 카테고리 id를 A의 고정 id로 update → 전부 `42501`, 실패한 update 뒤 id 그대로 | PASS | 같음 |
| MPR-42 | 이미 선점된 상태 | 정책 도입 전 데이터(슈퍼유저로 삽입)를 B·D(A가 못 보는 사용자)가 가진 경우 A의 ensure → `42501`(조용히 넘기지 않음), 행을 치우면 ensure 성공 | PASS | 같음 |
| MPR-42 | 권한 | `is_carbook_category_id`: anon `42501`, authenticated 실행 가능(고정 id true, 임의 id false) | PASS | 같음 |
| MPR-42 | AC-08-16 | 일반 id의 이름 "차계부" 수동 카테고리 + 일정이 있어도 고정 id 카테고리가 따로 생기고(이름 "차계부" 2개), 수동 카테고리·일정은 그대로, B에게 수동 일정·카테고리는 보이고 고정 id 카테고리는 안 보임 | PASS | 같음 |
| MPR-42 | AC-16-8 (DB 부분) | 카테고리 삭제 뒤 B: 직접 만든 일정 보임·연결 일정 0건, ensure로 다시 만든 뒤에도 직접 만든 일정은 분류 없음(DB가 다시 묶지 않음)·B에게 계속 보임, 연결 일정만 재묶어도 B에게 연결 0건 | PASS. "직접 만든 일정은 다시 묶지 않음"은 클라이언트(재묶기 대상 선정) 동작이라 MPR-25 검증에서 확인 | 같음 |
| MPR-42 | AC-16-5 | 기존 `supabase/*.sql`·캘린더 컴포넌트·`useCalendar` 변경 0건 | PASS | `git diff --stat 87f6f44 HEAD -- supabase src/components src/state` |

- 비차단 관찰: `is_carbook_category_id`는 insert·update마다 `auth.users` 전체를 훑어 `md5`를 계산한다(사용자 수에 비례). 1인 사용 규모에서는 무시할 수준이고 QA는 성능을 측정하지 않았다. Security Low 3건 중 "ensure의 `42501`을 로그인 만료로 오인하지 않는지"는 구현 쪽(MPR-25) 확인 대상이다(`carbook.md` 5장은 `42501` 선점 오류를 적고 있음).
- 판정: MPR-42 **PASS**.

## MPR-21 주행거리·연비 계산 (`src/carbook/domain/odometer.ts`, `fuelEconomy.ts`)

- 검증 대상: main `17a573c`(병합, 구현 커밋 `80df46c`). 범위: 순수 함수만. 화면의 "연비 10.0km/L" 표시·"가득 주유 기록이 2건 이상 필요합니다" 문구·MSG-10 확인창은 화면 티켓에서 확인한다. AC-04-6은 요청대로 감소 판정 함수(`isOdometerDecrease`)만 확인했다.
- 실행: `npx vitest run --config <vitest.qa.config.mjs> docs/qa/scripts/mpr21_domain.qa.ts` → `Tests 25 passed (25)`. 기대값은 `03_spec.md`의 숫자 예시 그대로(10.0, 15.0, 500÷30 등).
- 병합 커밋 `17a573c` 위에서 `npx vitest run --maxWorkers=3` → `Test Files 68 passed (68)`, `Tests 779 passed (779)`, `npm run build` → 성공.
- 주의(검증 결과가 아니라 환경): 그 뒤 main이 `c5631c8`(MPR-24)까지 진행해 테스트가 804건이 됐고, 같은 시각 다른 에이전트의 node 프로세스가 많아(약 14개) 전체 실행에서 `App.test.tsx`, `MonthView.drag.test.tsx`, `TimeGridView.test.tsx` 등 UI 테스트가 부하로 줄줄이 실패했다(기본 병렬 9건, `--maxWorkers=3` 60건). 이들은 `odometer.ts`·`fuelEconomy.ts`를 쓰지 않는다. `src/carbook/domain` 53건은 같은 부하에서도 통과. 조용한 시간에 다시 확인하지 못했고, 부하 때 UI 테스트가 흔들리는 문제는 MPR-42 보고에서 이미 알렸다(원인 미조사).

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-21 | AC-05-1 | 가득 A(10,000km)·비가득 20L·가득 B(10,500km, 30L) → (10,500−10,000)÷(20+30)=10.0, 구간 1개(끝 B). 입력 순서를 섞어도 같음. A의 주유량 값은 결과에 영향 없음 | PASS | vitest 위 명령 |
| MPR-21 | AC-05-2 | 가득 1건·0건·가득 없음 → 구간 없음 | PASS | 같음 |
| MPR-21 | AC-05-3 | 가득 2건 중 하나(A 또는 B)가 주행거리 없음 → 구간 없음 | PASS | 같음 |
| MPR-21 | AC-05-4 | 가득 C(11-01, 11,100km, 40L) 추가 → 구간 [10.0, 15.0], 마지막 15.0, B 구간 10.0 그대로 | PASS | 같음 |
| MPR-21 | AC-05-5 | 주행거리 차이 0·음수·주유량 합 0 → 오류 없이 구간 없음 | PASS | 같음 |
| MPR-21 | AC-05-6 | 구간 안 비가득 기록의 주유량 빈 값, B의 주유량 빈 값 → 구간 없음 | PASS | 같음 |
| MPR-21 | AC-05-7 (BR-11 정렬, 열린 항목 관련) | 같은 날 주행거리 없는 가득 A2(먼저 만듦)·B2(10,500km), 앞에 Z → (Z,B2)만, (B2,A2) 없음. 같은 날은 주행거리 오름차순, 비주유 기록 무시, 가득 사이 여러 비가득 주유량 합산 | PASS (현행 스펙 문구 기준. Spec Writer 확인 중인 가정이 바뀌면 재확인) | 같음 |
| MPR-21 | AC-04-6 (판정 함수만) | 현재 50,000에 49,000 → 감소, 50,000·50,001·빈 값은 감소 아님. `currentOdometerKm`: max(차량, 기록), 값 없으면 0, 수정 중 기록 제외 | PASS | 같음 |
| MPR-21 | BR-12 하루 평균(F-06이 사용) | 30일 300km → 10km/일, 오늘−90일 포함·−91일 제외, 오늘 이후 제외, 2건 미만·날짜 차이 0·주행거리 차이 0 이하 → null, 중간 기록 무시 | PASS | 같음 |

- 판정: MPR-21 **PASS**(위 범위 한계 포함).

## MPR-24 요청 제한 시간·오류 분류·CRUD (`src/carbook/data/request.ts`, `carbookApi.ts`)

- 검증 대상: main `c5631c8`(병합). 방법: 개발자 테스트의 supabase 모의가 아니라 **실제 `@supabase/supabase-js` 2.116 클라이언트에 가짜 `fetch`를 물려** HTTP 요청 모양(메서드·주소·조건·본문)과 오류 분류, 20초 제한을 확인했다(`docs/qa/scripts/mpr24_http.qa.ts`). 실제 Supabase 서버는 아니다.
- 실행: `npx vitest run --config <vitest.qa.config.mjs> docs/qa/scripts/mpr24_http.qa.ts` → `Tests 27 passed (27)`.
- 전체: main `7bd906b`에서 `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 70 passed (70)`, `Tests 805 passed (805)`; `npm run build` → `built in 468ms`. (요청서의 804건에서 MPR-21 AC-05-7 테스트가 합쳐져 805건. 기본 설정의 전체 병렬 실행은 PC 부하로 흔들려 요청서 권고 옵션을 썼다.)
- 범위: 화면의 "MSG-01 토스트", "양식 유지", "저장 버튼 재활성화"는 `useCarbook`·양식 티켓의 몫이다. 이 티켓에서는 그 근거가 되는 "실패가 `CarbookError`(timeout·network 등)로 20초 안에 던져지고 재시도·상태 변경이 없음"까지 확인했다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-24 | AC-10-9 | 응답이 없으면 19,999ms엔 대기, 20,000ms에 `timeout`, 신호 중단, 이후 60초가 지나도 요청 1건(재시도 없음). 읽기도 같음. timeout 뒤 새 요청은 정상 | PASS | `npx vitest run --config … mpr24_http.qa.ts` |
| MPR-24 | AC-03-4 | 네트워크 끊김(fetch 예외) → `network`, 쓰기 요청 1번만. 서버 500·503 → `network`. 읽기 503도 1번만 요청(`.retry(false)`) | PASS | 같음 |
| MPR-24 | AC-03-4 (분류 표) | 23505·23503 → `conflict`, RLS 403 `42501`·check 400 `23514`·JWT 401 → `unknown`(코드 유지), 수정 0행 → `unknown/not_found`, 삭제 0행 성공(멱등), 클라이언트 없음 → `unknown/no_client` | PASS | 같음 |
| MPR-24 | NFR-31 로그 | 오류 로그에 동작 이름·코드만, 번호판·별칭 없음 | PASS | 같음 |
| MPR-24 | 계약 2·3장 | 생성은 upsert `on_conflict=id`, 만기일은 insert(on_conflict 없음), 열 목록 select(`*` 없음), 빈 model·memo는 null, 주유 아니면 `liters null·full_tank false`, `user_id` 안 보냄, 목록은 정렬 끝에 `id` 포함·1,000행씩 이어 읽고 id 중복 제거, `createItems` 한 번의 upsert·`created_at` 1ms 간격 | PASS | 같음 |
| MPR-24 | 계약 3장 'event_id 선점'(MPR-19 F-1) | ① `event_id is null` 조건 PATCH `{event_id}` → ② `event_id` 없는 PATCH, 돌려받은 행의 `eventId`가 정본(이긴 탭의 uuid). ①이 오류면 ②로 가지 않음. 선점 값이 없으면 요청 1번. 만기일도 같음 | PASS | 같음 |
| MPR-24 | 계약 3장 | `fillMissingItemOdometer`(`last_odometer_km is null` 조건, 바뀐 행만), `clearEventId`(`event_id=null`) | PASS | 같음 |

- 비차단: ② 결과의 `eventId`가 null일 때 캘린더 쓰기를 건너뛰는 처리(ADR-003 보완 3항)는 `useCarbook`·`calendarLink` 쪽이라 MPR-25·훅 티켓에서 확인한다. 개발자 쪽 열린 항목(`request.test.ts` 분류 표 테스트)은 위 실제 클라이언트 경유 검사로 같은 표가 확인됐다.
- 판정: MPR-24 **PASS**.

## MPR-40 파일철 탭 토큰을 tokens.css로 이동 (`src/styles/tokens.css`, `src/carbook/FileTabs.module.css`)

- 검증 대상: 병합 `3ff2a31`(구현 `c6f8214`). 비교 기준: 토큰 이동 전 `7bd906b`(탭은 있고 토큰은 컴포넌트 안), 탭이 없던 때 `ec21359`. 세 커밋을 각각 `vite build`로 빌드해 정적 서버로 띄우고 Chrome(Playwright)으로 측정했다(Supabase 환경변수 비움, 실제 백엔드 호출 없음).
- 실행:
  - `git diff --numstat 3ff2a31^1 3ff2a31 -- src/styles/tokens.css` → `21 0`(추가 21줄, 삭제 0줄)
  - `node docs/qa/scripts/mpr40_tokens.mjs <playwright-core> <현재> <이동 전> <탭 없던 때> docs/qa/screens` → `RESULT pass=31 fail=0`
  - `node docs/qa/scripts/mpr29_nav.mjs …`(현재 빌드, 탭 없던 때 기준) → `RESULT pass=46 fail=0`
  - 전체: main `2f7d6d1`(MPR-31 병합까지)에서 `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 71 passed (71)`, `Tests 819 passed (819)`; `npm run build` → `built in 1.41s`
- 스크린샷: `docs/qa/screens/mpr40-{mobile375,tablet899,desktop1280}-{calendar,car}.png`.
- 측정 중 알게 된 점: 첫 두 번의 스크립트 실행은 탭 글자 상자의 너비가 빌드마다 달라 FAIL이었다. 원인은 웹폰트 로딩 시점 차이(측정 도구 쪽)였고, 폰트 로드 완료를 기다리도록 스크립트를 고친 뒤 이동 전·후가 모두 같게 나왔다. 기대값을 느슨하게 바꾸지 않았다(같은 속성 목록 전체 비교 유지).

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-40 | tokens.css는 추가만 | 삭제 0줄·추가 21줄(`--z-tab`, `--tab-*` 규격, `--tab-gutter`(모바일 36·데스크톱 40), `--line-thin·medium·accent`). 기존 토큰 이름과 충돌하는 사용처 없음(`grep`) | PASS | `git diff --numstat …` |
| MPR-40 | 화면 결과 불변 | 375·899·1280px × (`/` 캘린더, `/car`) 에서 탭 nav·링크·라벨 5개 요소의 계산된 스타일 32개 속성(위치·크기·테두리·그림자·윤곽·색·z-index 등)이 토큰 이동 전과 같음, hover 상태 같음, 키보드 포커스 상태 같음 | PASS | `node docs/qa/scripts/mpr40_tokens.mjs …` |
| MPR-40 | 토큰 값 | `:root`에서 z 60, 탭 28×56(모바일)·32×96(데스크톱), 중심 40%·50%, 여백 36px(<900)·40px(≥900), 선 1·2·4px | PASS | 같음 |
| MPR-40 | AC-14-4 | 360px·899px에서 탭이 있는 화면의 캘린더 요소 166개(탭 제외)의 위치·크기가 탭 없던 때와 같음, 가로 스크롤 없음 | PASS | 같음 |
| MPR-40 | AC-01-1 | 차계부 탭 → `/car`, 캘린더 탭 → `/`, 뒤로·앞으로·새로고침 등 이동 46건(375·1280px) | PASS | `node docs/qa/scripts/mpr29_nav.mjs …` |
| MPR-40 | AC-13-2 | 일반 접속에서 탭 2개, 위젯(`?widget=1`)에서는 탭 DOM 없음 | PASS | 같음 |

- 판정: MPR-40 **PASS**.

### 사고 기록 (QA 작업 중 내가 낸 문제, 2026-11-06)

- 비교용 임시 worktree에 `node_modules` 정션(junction)을 걸어 쓰다가, 정리 때 정션을 먼저 풀지 못한 채 `git worktree remove --force`를 실행해 **`calendar/node_modules` 안의 파일 일부가 삭제**됐다(`.bin` 포함). `npm ci`(잠금 파일 기준, `package.json`·`package-lock.json` 변경 없음)로 복구했고 복구 뒤 전체 테스트 819건·빌드를 통과했다. 그 사이 같은 폴더를 쓰는 다른 역할의 테스트·빌드가 잠시 실패했을 수 있다. 교훈: junction이 걸린 worktree는 `rmdir`로 정션을 먼저 풀고 존재 여부를 확인한 뒤에만 제거한다.

## MPR-22 추천 항목·다음 교체일·상태·정렬·일정 제목·빠른 선택 날짜 (`src/carbook/domain/maintenance.ts`, `titles.ts`, `dueDates.ts`)

- 검증 대상: main `1960a1e`(구현 `cdbc02e`). 전체 실행은 그 뒤 main `3571865`(MPR-41 병합 포함)의 작업 폴더에서 했다. 이 티켓의 파일은 그 사이 바뀌지 않았다.
- 실행:
  - `npx vitest run --config <qa 설정> docs/qa/scripts/mpr22_domain.qa.ts` → `Tests 36 passed (36)`
  - 전체: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Tests 845 passed (845)`(MPR-41 포함, 요청서의 839는 MPR-41 전 값), `npx tsc -b` → exit 0, `npm run build` → `built in 601ms`
- 범위 메모: AC-06-15의 "기록 저장 시 빈 마지막 교체 주행거리를 채움"은 `fillMissingItemOdometer`(데이터 계층, MPR-24에서 확인)와 훅(MPR-26)의 일이다. 이 티켓에서는 "채워진 뒤의 계산 결과"(남은 거리 10,000km, 지남 아님)만 확인했다. 채움 호출 자체는 MPR-26에서 확인한다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-22 | AC-06-1 | 추천 7개의 이름·km·개월·순서가 원본 4.1과 같고 마지막 교체일은 오늘. 호출마다 새 배열(한 번 바꿔도 다음 호출에 영향 없음) | PASS | `mpr22_domain.qa.ts` |
| MPR-22 | AC-06-2, AC-06-12 | 12개월→6개월 `2027-11-05`→`2027-05-05`. 말일 보정 `01-31`+1=`02-28`, 윤년 `2028-01-31`+1=`02-29`, `03-31`+1=`04-30` | PASS | 같음 |
| MPR-22 | AC-06-3 | 실제 `dailyAverageKm`(MPR-21) 결과와 연결: 평균 1,000÷30, R=2,000, 다음 교체일 `2027-01-04`. 경계 R=1이면 +1일, R=0이면 오늘, R<0이면 오늘(지남), R÷평균이 소수면 올림 | PASS | 같음 |
| MPR-22 | AC-06-4 | 개월 3(`2026-10-01`)을 더하면 이른 `2027-01-01`. 반대로 km 날짜가 더 이르면 km 날짜 | PASS | 같음 |
| MPR-22 | AC-06-5 | 기록 1건이면 평균 없음 → 다음 교체일 null, 남은 거리 8,000, 상태 정상(배지 없음). 캘린더 일정 비생성은 데이터 흐름이라 MPR-25·26 범위 | PASS | 같음 |
| MPR-22 | AC-06-6 | `2026-12-05`(+30일) 곧 교체, `12-06`(+31일) 배지 없음. 경계 오늘 `11-05` 곧 교체, 어제 `11-04` 지남 | PASS | 같음 |
| MPR-22 | AC-06-7 | 남은 거리 1,000 곧 교체, 1,001 배지 없음, 0도 곧 교체. 날짜 조건이 있으면 1,001km여도 곧 교체(문구 "날짜 조건이 없는 한") | PASS | 같음 |
| MPR-22 | AC-06-8 | `11-04` 또는 −1km는 지남. 곧 교체 조건도 겹칠 때 지남이 우선(상태는 하나). 날짜도 R도 없으면 정상, 날짜를 못 구해도 R만으로 판정(BR-14) | PASS | 같음 |
| MPR-22 | AC-06-13 | 주행거리 빈 차량: 타이어·브레이크는 날짜·남은 거리 null·배지 없음(평균이 있어도), 엔진오일은 `2027-11-05`·배지 없음(평균이 있어도 km 날짜 계산 제외), 7개 모두 정상 | PASS | 같음 |
| MPR-22 | AC-06-15(계산 부분) | 마지막 교체 주행거리 48,000이 채워진 추천 항목: 엔진오일 남은 거리 10,000, 지남 항목 0개. 채움 전(null)에 현재 48,000이어도 지남 없음 | PASS | 같음 |
| MPR-22 | AC-06-16 | 입력 전제(상태·날짜)가 AC와 같음을 확인한 뒤 순서가 지남(`10-01`)·곧(`11-10`)·곧(`11-20`)·정상(`2027-03-01`)·날짜 없음. 입력을 뒤집어도 같고 원본 배열은 불변, 동률은 입력 순서 유지, 빈·1개 배열, 날짜 없는 지남이 정상보다 앞 | PASS | 같음 |
| MPR-22 | AC-08-10 | 제목이 스펙 그대로(`[내 차] 엔진오일 교체 예정`, `보험 만기`, `자동차세 납부`, `정기검사 만기`). 두 함수 모두 인자 2개라 번호판이 들어갈 경로가 없고, 억지로 세 번째 인자로 번호판을 넘겨도 제목에 안 들어감 | PASS | 같음 |
| MPR-22 | AC-15-1, AC-15-2 | 오늘 `2026-11-05`: 12월 31일 → `2026-12-31`, 6월 30일 → `2027-06-30`. 경계: 당일은 올해, 다음 날은 내년(6/30·12/31 모두). 800일 전수: 항상 오늘 이상이고 올해 또는 내년 | PASS | 같음 |
| MPR-22 | 회귀 | 전체 테스트·타입 검사·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 845 passed, `npx tsc -b` → 0, `npm run build` |

- 판정: MPR-22 **PASS**. 비차단: AC-06-5·06-13·06-15의 "캘린더 일정 0건"과 "채움 호출"은 데이터 흐름이라 MPR-25·26 검증 때 확인한다.

## MPR-31 CarbookApp 뼈대·로그인 게이트·하위 탭 (`src/carbook/CarbookApp.tsx`, `components/LoginGate.tsx`)

- 검증 대상: main `1960a1e`(병합 4건 `31a~31d`, 접근성 재점검 B1~B4 반영 `b787391`). 실행은 main `3571865` 작업 폴더에서 했다.
- 방법 2가지. (가) 가짜 Supabase 주소(`https://fake.supabase.test`, Playwright가 모든 요청을 가로챔)로 빌드한 실제 앱을 Chrome에서 375px·1280px로 확인. (나) `useAuth`·`useCarbook`을 모의로 바꿔 jsdom에서 확인(요청서 주의사항대로 임시 `useCarbook` 스텁이 항상 loading이라 하위 탭·불러오기 실패는 실앱에서 볼 수 없다).
- 실행:
  - `npx vitest run --config <qa jsdom 설정> docs/qa/scripts/mpr31_app.qa.tsx` → `Tests 21 passed (21)`
  - `VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fakekey npx vite build --outDir <scratch>` 후 정적 서버, `node docs/qa/scripts/mpr31_gate.mjs <playwright-core> <앱 URL> docs/qa/screens` → `RESULT pass=37 fail=0`
  - 전체 `npx vitest run --maxWorkers=2 --testTimeout=60000` → 845 passed, `npx tsc -b` → 0, `npm run build` 성공
- 스크린샷: `docs/qa/screens/mpr31-{mobile375,desktop1280}-gate.png`, `-signedin.png`, `mpr31-mobile375-restoring.png`, `mpr31-mobile375-timeout-gate.png`.
- 측정 중 알게 된 점: 첫 실행에서 AC-02-3의 "로그인 중단" 2건이 FAIL이었다. 승인 요청을 네트워크 오류로 끊으면 Chrome이 오류 페이지(`chrome-error://`)로 가는데, 이건 브라우저 동작이지 앱 문제가 아니다. 실제 취소 흐름(Google이 `/car?error=access_denied…`로 돌려보냄)을 승인 요청에 302로 응답하는 방식으로 바꿔 다시 실행했고, 기대값은 그대로(안내 유지·요청 0건)다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-31 | AC-02-1 | 비로그인 `/car`(실앱 375·1280px): MSG-02 문구 "로그인하면 사용할 수 있습니다"와 "로그인" 버튼, 하위 탭 없음, 가로 스크롤 없음. 1.5초 동안 Supabase로 나간 요청 0건(`/rest/v1/*`, events·categories·4개 테이블 포함). 모의: 데이터 훅 호출 0회 | PASS | `mpr31_gate.mjs`, `mpr31_app.qa.tsx` |
| MPR-31 | AC-02-2 | 로그인 버튼 → `/auth/v1/authorize?provider=google`의 `redirect_to`가 현재 주소(`/car?x=1` 그대로). 로그인을 마친 상태(세션 있음)로 `/car`를 열면 주소 `/car` 유지, 안내 없음, 차계부 화면 | PASS | 같음 |
| MPR-31 | AC-02-3 | 취소(`/car?error=access_denied`로 복귀) 후 `/car`의 안내 화면 유지, 데이터 요청 0건, 오류는 콘솔 `[auth] OAuth 리다이렉트 에러`에만. 모의: 로그인 호출이 reject돼도 안내 유지 | PASS | 같음 |
| MPR-31 | AC-02-5 | 만료 세션의 토큰 갱신 응답을 7초 지연: 1초·4.4초에 로딩 표시(안내 없음), 5.7초에 로그인 안내(복원 응답 전), 그 상태에서도 데이터 요청 0건. 경계(모의 가짜 타이머): 4,999ms는 로딩, 5,000ms에 안내. 2초 만에 복원되면 안내가 한 번도 안 보임(실앱 100ms 간격 관찰). 늦게 복원되면 안내가 남지 않고 차계부로 전환 | PASS | 같음 |
| MPR-31 | AC-10-7 | 모의: 읽기 실패 → MSG-04 "차계부 데이터를 불러오지 못했습니다"와 "다시 시도"(role=alert), 누르면 `retryLoad` 1회, 다시 읽는 동안 로딩, 성공하면 하위 탭, 또 실패하면 다시 MSG-04. 누른 뒤 포커스는 main으로 이동 | PASS | `mpr31_app.qa.tsx` |
| MPR-31 | AC-03-9 | 모의: 탭 4개(기록·교체 알림·만기일·통계), 기본 "기록". "통계" 선택 뒤 선택 차량이 바뀌거나 차량 목록이 1→2대로 바뀌어도 "통계" 유지, 재마운트(새로고침)하면 "기록", 계정이 바뀌면 "기록"으로 초기화. 차량 0대면 하위 탭 없음(빈 상태는 MPR-32). 탭-패널 aria 연결, 선택된 패널만 보임, 키보드 ←/→/Home/End·순환, Alt·Shift 조합 무시 | PASS | 같음 |
| MPR-31 | AC-02-4 재확인(MPR-29 때 이월) | 비로그인 `/`에서 탭 2개(캘린더·차계부), "차계부" 탭 → `/car` 안내 화면, 요청 0건 | PASS | `mpr31_gate.mjs` |
| MPR-31 | AC-01-1 재확인(이월) | "기록 탭"은 실앱에서는 `useCarbook` 스텁 때문에 볼 수 없다. 모의로 하위 탭이 있을 때 기본 선택이 "기록"임을 확인. 실앱 확인은 MPR-26 이후 | PASS(모의) | `mpr31_app.qa.tsx` |

- 한계(요청서 분리 지시대로): 로그인 사용자의 실앱 `/car`는 스텁 때문에 불러오는 중에 머문다(스크린샷 `mpr31-*-signedin.png`에서 로딩 표시). 하위 탭·MSG-04의 실앱 확인은 MPR-26 이후 다시 한다. 접근성 항목(B1~B4)은 Accessibility Auditor 재점검 몫이라 판정하지 않았다.
- 판정: MPR-31 **PASS**(스텁/모의 범위).

## MPR-41 현재 탭 포커스 막대·강제색 표시, navigate 중복 기록 방지 (`navigation.ts`, `FileTabs.module.css`)

- 검증 대상: main `c4259ec`(구현 `cf361d2`+`ac9afa2`+`d6a74bc`). 빌드 2개(현재, 탭 없던 때 `ec21359`)를 정적 서버로 띄워 Chrome(Playwright)으로 측정했다(Supabase 환경변수 비움). 강제색은 Chrome의 `forcedColors: active` 에뮬레이션을 밝은·어두운 두 팔레트로 켜서 확인했다. 실제 Windows 고대비 테마는 확인하지 못했다(요청서에도 미확인으로 적혀 있음).
- 실행:
  - `node docs/qa/scripts/mpr41_tabs.mjs <playwright-core> <현재> <탭 없던 때> docs/qa/screens` → `RESULT pass=126 fail=0`
  - `node docs/qa/scripts/mpr29_nav.mjs …`(현재 빌드, 탭 없던 때 기준) → `RESULT pass=46 fail=0`
  - 전체 `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 74 passed (74)`, `Tests 845 passed (845)`; `npx tsc -b` → 0; `npm run build` → `built in 492ms`
- 스크린샷: `docs/qa/screens/mpr41-{mobile375,desktop1280}-{calendar,car}-focus-current.png`, `mpr41-{mobile375,desktop1280}-forced-{light,dark}-{calendar,car}.png`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-41 | ② navigate 중복 방지 / AC-01-1 | 375·1280px에서 `/car/`→차계부 탭, `/car`→차계부 탭, `/`→캘린더 탭은 `pushState` 0회·주소 그대로·`history.length` 증가 0. 다른 화면으로 가는 `/car/`→캘린더, `/car`→캘린더, `/`→차계부는 각각 1회·1건 증가. `/car/`에서 차계부 탭 3번 연속 클릭도 기록 0건. 캘린더→차계부 뒤 뒤로 가기는 `/`, 한 번 더 뒤로 가면 시작 주소 | PASS | `mpr41_tabs.mjs` |
| MPR-41 | ① 현재 탭 포커스 막대 | `/`·`/car` 두 화면 × 375·1280px에서 현재 탭을 키보드 포커스(`:focus-visible`)하면 왼쪽 막대 `4px solid`가 평상시와 똑같이 남고(색 `rgb(0, 102, 255)`), 외곽선 2px solid가 함께 보이며, 면 색·굵기·탭 상자 크기(28×56 모바일)가 그대로. 비선택 탭 포커스는 외곽선 2px, 테두리 1px(막대 없음) | PASS | 같음 |
| MPR-41 | ① 구분 | 현재 탭과 비선택 탭이 면 색·굵기·막대 폭 모두 다르고 탭 상자 크기는 같음(막대를 테두리로 바꿔도 상자가 안 커짐) | PASS | 같음 |
| MPR-41 | ⑤ 강제색 | 밝은·어두운 두 팔레트 × `/`·`/car` × 375·1280px: 현재 탭 면(Highlight)과 비선택 탭 면(Canvas)이 다르고, 두 탭 모두 글자색이 면과 다르며 라벨 글자색이 탭 글자색과 같음(Chrome의 글자 뒤 판 문제 회피 확인). 현재 탭 왼쪽 막대 4px·비선택 1px. 현재 탭 포커스 링 2px solid가 면 색과 다르고(밝은 팔레트 흰 링/남보라 면, 어두운 팔레트 검정 링/청록 면), 링이 면 안쪽(오프셋 −6px)이며 포커스 때도 막대 유지. 비선택 탭 포커스 링도 면과 다름 | PASS | 같음 |
| MPR-41 | AC-14-4 | 360px·899px에서 캘린더 요소 166개(탭 제외)의 위치·크기가 탭 없던 때와 같음, 가로 스크롤 없음 | PASS | 같음 |
| MPR-41 | AC-01-1, AC-13-2 회귀 | 탭 이동·뒤로·앞으로·새로고침·위젯 모드 탭 없음 46건(375·1280px) | PASS | `mpr29_nav.mjs` |
| MPR-41 | ④ 전체 테스트 | 845 passed(74 files), tsc 0, build 성공 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` |

- 관찰(비차단): 스펙 BR-01은 알 수 없는 경로(예 `/zzz`)를 캘린더 화면으로 본다. 그 화면에서 "캘린더" 탭을 누르면 이미 캘린더가 보이는데도 `pushState`가 1회 일어나 `/`로 바뀐다(`navigate`가 non-car 경로는 문자열 같음으로 비교). 티켓 완료 조건 ②의 예시(`/car/`→`/car` 0건, `/car`↔`/` 1건)에는 걸리지 않고 AC에도 없어 판정에 넣지 않았다. 주소 정리로 볼 수도 있어 Spec Writer·Frontend 판단 사항이다.
- 한계: 실제 Windows 고대비 테마·실기기는 미확인(에뮬레이션만). 후속 Suggestion(현재 탭 라벨 약 1.5px 치우침)은 판정 대상이 아니다.
- 판정: MPR-41 **PASS**.

## MPR-23 월별·종류별 지출 합계와 최근 12개월 계산 (`src/carbook/domain/stats.ts`)

- 검증 대상: main `a98292c`(구현 `a7920c8`). 인용한 기준은 `docs/03_spec.md` AC-09-1·2·3·4·7·8, BR-26.
- 실행:
  - `npx vitest run --config <qa 설정> docs/qa/scripts/mpr23_stats.qa.ts` → `Tests 22 passed (22)`
  - AC-09-8 시간(같은 파일, `-t AC-09-8`): 기록 2,000건에서 합계(선택 달)+최근 12개월+연비 구간을 한 번에 계산 10회 → 0.38~2.85ms(정렬 뒤 최댓값 2.85ms, p95≈최댓값). 합계 두 함수만은 최댓값 0.73ms
  - 전체 `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 75 passed (75)`, `Tests 853 passed (853)`; `npx tsc -b` → 0; `npm run build` → `built in 3.33s`

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-23 | AC-09-1 | 11월 주유 50,000·40,000, 세차 10,000, 보험 100,000 → 총합 200,000, 종류별 보험 100,000·주유 90,000·세차 10,000(큰 순), 종류별 합=총합. 순서를 뒤집어도 같고 입력 배열 불변. BR-26: 7종류 모두 포함, 금액 0도 기록이면 포함, 기록 없는 종류는 빠짐. 같은 금액은 종류 정의 순서(안정). 2,000건×1억 합산 정확 | PASS | `mpr23_stats.qa.ts` |
| MPR-23 | AC-09-2 | 10-31 30,000은 10월, 11-01 20,000은 11월. 경계 11-30/12-01, 12-31/2027-01-01, 윤일 2028-02-29/03-01. 다른 해 같은 달(2025-11 vs 2026-11) 안 섞임 | PASS | 같음 |
| MPR-23 | AC-09-3 | 함수는 넘겨받은 기록만 합산: 차량 B 기록만 넘기면 5,000, A만 넘기면 100,000. 관찰: 두 차량 기록을 섞어 넘기면 걸러내지 않음(함수가 `vehicleId`를 보지 않는 설계, 코드 주석 "선택 차량의 것만 넘겨야 한다"). 선택 차량 필터링은 호출 쪽(MPR-37)이라 거기서 확인 | PASS(함수 범위) | 같음 |
| MPR-23 | AC-09-4 | 기록 없는 달·빈 배열 → `{totalWon 0, byKind [], recordCount 0}`, 던지지 않음(화면이 "0원"과 "이 달의 기록이 없습니다"를 그릴 근거). 금액 0 기록만 있는 달은 빈 달이 아님(recordCount 1). 잘못된 달 문자열(`2026-1`, 빈 값, `2026-13`, `abc`)도 던지지 않고 빈 결과. 문구 표시 자체는 UI(MPR-37) 몫 | PASS(함수 범위) | 같음 |
| MPR-23 | AC-09-7 | 오늘 2026-11-05: `2026-11`~`2025-12` 12개, 11월 73,000·3월 20,000, 나머지 0원, 최근 달이 앞. 기록 없어도 12개 모두 0원. 12개월 밖(2025-11, 미래 2026-12) 제외. 오늘이 말일·연초(01-31, 03-31, 05-31, 12-31, 2028-03-31, 01-01)여도 달 건너뜀·중복 없이 12개 연속. 선택한 달은 입력이 아님(무관). `months`로 개수 조절, 0이면 빈 목록 | PASS | 같음 |
| MPR-23 | AC-09-8 | 기록 2,000건에서 10회 최댓값 2.85ms ≤ 100ms(연비 구간 포함). 합계 결과가 직접 계산과 일치 | PASS | `-t AC-09-8` |
| MPR-23 | 회귀 | 전체 테스트·타입 검사·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 853 passed |

- 판정: MPR-23 **PASS**. 이월: AC-09-3의 선택 차량 필터와 AC-09-4의 문구 표시는 MPR-37(통계 탭) 검증 때 화면에서 확인한다.

## MPR-25 캘린더 연동 함수 (`src/carbook/data/calendarLink.ts`)

- 검증 대상: 병합 `42e083a`(구현 `3775a60`). 전체 실행은 main `64d06e3`(MPR-32 병합 포함) 작업 폴더에서 했고 이 티켓의 파일은 그 사이 바뀌지 않았다.
- 방법: 실제 supabase-js(2.116)의 `fetch`를 가로채 calendarLink가 쓰는 PostgREST 요청 5가지(`rpc/ensure_carbook_category`, `events` GET·POST upsert·DELETE·PATCH)를 PGlite(0.2.17) SQL로 번역해 실행했다. 질의는 사용자 역할로 돌려 RLS·RESTRICTIVE 정책·FK를 실제로 탄다(`docs/qa/scripts/pg_env.mjs`로 `schema*.sql`과 `schema_carbook.sql` 적용). 실제 Supabase·실제 PostgREST가 아니다. PGlite는 한 연결이라 요청들이 직렬 처리되므로, 두 탭의 경쟁은 "요청 단위 끼어들기"까지 재현하고 진짜 트랜잭션 경합은 재현하지 않는다(DB 쪽 멱등성은 MPR-17·19에서 확인).
- 실행:
  - `QA_PGLITE=<pglite dist/index.js> npx vitest run --config <qa 설정> docs/qa/scripts/mpr25_link.qa.ts` → `Tests 29 passed (29)`
  - 전체 `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 80 passed (80)`, `Tests 922 passed (922)`(요청서의 867은 그 뒤 병합분이 더해지기 전 값); `npx tsc -b` → 0; `npm run build` → `built in 880ms`

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-25 | AC-08-1 | 다음 교체일 `2027-11-05`, 별칭 "내 차" → events에 `[내 차] 엔진오일 교체 예정`, 종일(`all_day` true), `start_at`=`end_at`=`2027-11-05`, `memo` null, `category_id`=고정 id, 1건. 같은 내용 재동기화는 `unchanged`(쓰기 요청 0). 날짜·제목이 바뀌면 같은 id 행을 덮어씀(1건 유지). `known`을 넘기면 읽기 없이 판정. AC-08-3 사용자가 지운 일정은 다시 만들어지고 1건 | PASS | `mpr25_link.qa.ts` |
| MPR-25 | AC-08-4 | 고정 id 카테고리가 이미 있으면(다른 link 수명 포함) 하나 더 만들지 않고 그 id 사용. 한 link 안에서 동시 5번 호출해도 RPC 1번. AC-08-16 이름만 같은 수동 카테고리는 그대로(이름·색·일정 불변), 연결 일정은 고정 id 카테고리 | PASS | 같음 |
| MPR-25 | AC-08-6 | 같은 일정을 연속 2번, 동시 2번(둘 다 "없음"을 읽음) → 1건. 쓰기는 `on_conflict=id` + `resolution=merge-duplicates` upsert | PASS | 같음 |
| MPR-25 | AC-08-10 | 번호판 있는 차량 기준으로 연결 일정 제목·메모에 번호판 없음(메모 null), 요청 본문에도 없음 | PASS | 같음 |
| MPR-25 | AC-08-13 | 카테고리가 없는 상태에서 탭 A는 항목, 탭 B는 만기일을 동시에 첫 저장 → '차계부' 카테고리 1개, 일정 각 1건, 둘 다 같은 카테고리. 같은 항목(같은 eventId)을 두 탭에서 동시 저장 → 1건. 서로 다른 날짜로 동시에 쓰면 마지막 쓰기가 남고 1건. 두 탭에서 20건 번갈아 동시 저장 → 카테고리 1, 일정 20건 | PASS | 같음 |
| MPR-25 | AC-08-14 지원 동작 | 카테고리를 지운 뒤 `rebindCategory`로 연결 일정 2건이 새 카테고리 1개에 속함, 넘기지 않은 직접 만든 일정은 그대로. 분류가 null인 일정은 같은 날짜·제목이어도 `syncEvent`가 카테고리를 다시 붙임(`written`). 재묶기 230개는 3번(100개씩), 빈 목록은 요청 0 | PASS | 같음 |
| MPR-25 | 조회·삭제 | `fetchEvents` 250개는 3번 조회(각 100개 이하, `select=id,title,start_at,category_id`, `user_id=eq.<나>`), 없는 id는 Map에 없음, 빈 목록 요청 0. `deleteEvent` 지웠으면 true, 없었으면 false. 남의 일정 id는 조회에 안 잡히고 삭제 false·행 유지·재묶기 불변(`user_id` 필터 + RLS) | PASS | 같음 |
| MPR-25 | 예외(계약 4.2) | 카테고리가 그새 지워져 FK 23503 → 기억을 버리고 RPC 다시 호출해 한 번만 다시 씀(`written`, RPC 2번, 카테고리 1개). 23503이 또 나면 `conflict/23503`을 던지고 쓰기는 정확히 2번. 500은 재시도 없이 `network`(쓰기 1번) | PASS | 같음 |
| MPR-25 | 예외(계약 5장) | 고정 id 선점(RPC 42501) → `unknown/42501`로 던지고 일정 쓰기 0번, 실패는 기억되지 않아 선점이 풀리면 다음 호출 성공. 로그인 없음(28000, 401) → `unknown/28000`, 쓰기 없음. RPC가 문자열이 아니면 `bad_response`이고 기억 안 함. 클라이언트 없음 → `unknown/no_client`(ensure·fetch·delete). 실패 로그에 일정 제목 없음(NFR-31) | PASS | 같음 |
| MPR-25 | 회귀 | 전체 테스트·타입 검사·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 922 passed |

- 범위 메모(MPR-19 F-1 이월분의 나머지): 이 티켓은 일정 쓰기 함수까지다. ① `event_id` 선점 순서(claim→update→돌려받은 `event_id` 사용)는 `carbookApi`(MPR-24에서 확인), ② 선점 결과가 null일 때 캘린더 쓰기 생략, ③ ensure의 42501을 로그인 만료로 오인하지 않는 처리(함수는 다른 `unknown`과 같이 코드를 유지해 던짐), ④ 직접 만든 일정을 재묶기 목록에서 제외, ⑤ 쓰기·삭제가 있었을 때 `reload()` 한 번은 모두 호출하는 쪽(`useCarbook`, MPR-26)의 일이라 MPR-26 검증 때 확인한다. AC-08-13 둘째 문장(같은 항목 두 탭)의 "일정 1건"은 이 함수 쪽(id 기준 upsert)에서 확인됐다.
- 비차단(요청서 Security Low): 남의 일정 id를 자기 `event_id`에 넣어 그 일정을 공유 상대에게서 숨기는 가시성 방해는 DB 후속 티켓 사안으로 판정에 넣지 않았다.
- 판정: MPR-25 **PASS**.

## MPR-26 useCarbook 실제 구현 (`src/carbook/state/useCarbook.ts`)

- 검증 대상: 병합 `5c0073c`(구현 `3336c7d`, 리뷰 수정 `ed7dcea`). 전체 테스트·타입·빌드는 **main `8fdcc12`**(MPR-37 병합 포함, `src/carbook/state`·`data`는 `c70cefe` 이후 변경 없음)에서 실행했다.
- 방법: 훅을 상태를 가진 가짜 백엔드(`data/carbookApi` 대체, 실패·지연을 조절)에 물려 jsdom에서 확인했다. 데이터 계층의 HTTP·DB 동작은 MPR-24·25에서 확인했다. 실제 Supabase·실앱 화면 확인은 하지 않았다.
- 실행:
  - `npx vitest run --config <qa jsdom 설정> docs/qa/scripts/mpr26_hook.qa.tsx` → `Tests 36 passed (36)`
  - `main 8fdcc12`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 81 passed (81)`, `Tests 934 passed (934)`; `npx tsc -b` → 0; `npm run build` → `built in 601ms`
- 측정 중 알게 된 점: 첫 실행에서 "추천 7개 순서" 1건이 FAIL이었다. 화면 목록은 AC-06-16 정렬(상태 → 다음 교체일 오름차순)이라 생성 순서와 다르다(에어컨 필터가 엔진오일보다 앞). 02_architecture 6장 주석과 일치하는 동작이므로 테스트의 가정이 틀린 것이었고, 기대값을 정렬 규칙대로 고쳤다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-26 | AC-10-7 | 목록 읽기 실패 → `error`, "다시 시도"(`retryLoad`)로 `loading`을 거쳐 다시 읽고 `ready`(세 목록 모두 재요청). 세 목록 중 하나만 실패해도 `error`, 실패 반복 시 계속 `error`. 기록 읽기 실패 → `recordsState error`(목록은 ready), `retryRecords`는 기록만 다시 읽음. 세 목록은 병렬 요청 | PASS | `mpr26_hook.qa.tsx` |
| MPR-26 | AC-03-1 | "출퇴근"·"가족" 추가(추가한 차량이 선택됨) → "가족" 선택 시 가족의 기록·교체 항목(7개)만 보이고 다시 출퇴근을 고르면 출퇴근 기록. 차량을 바꾸면 새 기록이 오기 전 이전 차량 기록이 안 보이고 `loading`. 느린 응답이 나중에 와도 현재 차량 화면을 덮지 않음. 기본 선택은 가장 먼저 만든 차량, 없는 id는 무시 | PASS | 같음 |
| MPR-26 | AC-03-4, AC-10-1(차량) | 차량 저장 실패 → `false`, MSG-01 토스트 1번, 목록 그대로, 교체 항목 요청 없음. 추천 7행 저장 실패 → 방금 만든 차량 보상 삭제·`false`·MSG-01만. 보상 삭제까지 실패해도 MSG-01 하나(서버에 항목 없는 차량이 남는 한계는 carbook.md 8.2에 문서화). 수정 실패 시 값 그대로 | PASS | 같음 |
| MPR-26 | AC-03-7, AC-10-8 | 첫째 선택 중 삭제 → 둘째 선택, 둘째도 삭제 → 차량 0개·선택 `null`("차량을 추가해 주세요" 화면은 MPR-32·38 범위). 선택 안 한 차량 삭제는 선택 유지. 삭제 실패 → MSG-03, 차량·기록이 목록에 남음 | PASS | 같음 |
| MPR-26 | AC-04-1, AC-04-2 | 7종(주유·정비·세차·보험·세금·주차·기타)을 날짜·금액만으로 저장 → 7건, 종류 맞음, 최신 날짜가 위, 다시 읽기 없음. 같은 날짜는 나중에 만든 기록이 위(BR-09). 금액 수정 → 1건 유지·금액 변경, 날짜를 바꾸면 순서 재정렬, 삭제 → 사라짐. 차량 없으면 요청 없이 `false` | PASS | 같음 |
| MPR-26 | AC-04-7, AC-10-1 | 기록 저장 실패 → `false`, MSG-01 1번, 새 기록 없음, 다시 읽기 없음, 이후 재시도 성공. timeout·unknown·conflict 모두 같은 MSG-01, 수정 실패는 기존 값 유지. 차량이 다른 탭에서 지워져 FK 23503이면 MSG-01 뒤 목록을 다시 읽음 | PASS | 같음 |
| MPR-26 | AC-10-2 | 저장 진행 중 같은 새 기록을 다시 저장 → 요청 1개, 둘째는 `false`·토스트 없음. 같은 기록 수정 중복도 1요청, 다른 기록·다른 종류는 막지 않음, 끝나면 다시 저장 가능. 차량 추가도 같고 실패하면 잠금이 풀려 재시도 가능 | PASS | 같음 |
| MPR-26 | AC-04-10 | 저장 호출부터 목록에 보일 때까지 10회(가짜 백엔드 지연 50ms 포함): 52~98ms, p95≈최댓값 98.2ms ≤ 1초, 다시 읽기 0회. 실제 네트워크 지연은 포함되지 않음 | PASS(훅 범위) | 같음 |
| MPR-26 | AC-06-15 (BR-06a) | 주행거리 빈 차량 새로 만들면 km 항목 마지막 교체 주행거리 비어 있고 지남·배지 없음. 48,000km 기록 저장 → `fillMissingItemOdometer(차량, 48000)` 1번, 항목이 48,000으로 채워지고 엔진오일 남은 거리 10,000, 지남 없음, 캘린더 연동 호출 0. 이미 채워진 뒤·주행거리 없는 기록은 다시 채우지 않음. 차량에 주행거리가 있으면 주행거리 없는 기록으로도 그 값으로 채움, 차량 주행거리를 처음 입력(수정)해도 채움. 채우기가 실패해도 저장은 `true`·토스트 없음, 다음 저장 때 다시 채움 | PASS | 같음 |
| MPR-26 | 회귀 | main `8fdcc12`에서 전체 테스트·타입 검사·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 934 passed |

- 이월 확인(요청서)과 판정 범위: `useCarbook`은 아직 `calendarLink`를 호출하지 않는다(위 케이스에서 연동 호출 0 확인). 따라서 **event_id 선점 결과 null이면 캘린더 쓰기 생략, ensure의 42501을 로그인 만료로 오인하지 않는 처리, 직접 만든 일정 재묶기 제외, 쓰기 뒤 `reload()` 1회**는 이 티켓에서 확인할 코드가 없고 교체 항목·만기일 저장과 열 때 점검을 넣는 MPR-27 검증으로 옮긴다. 실앱에서 로그인 사용자의 하위 탭·MSG-04 확인도 `CarbookApp`↔차량 영역 연결(MPR-38) 뒤에 한다(이번 판정에는 넣지 않았다).
- 비차단 관찰: `docs/api/carbook.md` 6장 인터페이스 주석의 `items … created_at 오름차순`은 02_architecture 6장·AC-06-16(상태·날짜 정렬)과 다르다. 구현은 후자를 따르므로 문서 주석을 고치면 된다(API Designer 소관).
- 판정: MPR-26 **PASS**(훅 범위, 가짜 백엔드 기준).

## MPR-32 차량 바·차량 양식·삭제 확인창 (`src/carbook/components/VehicleBar.tsx`, `VehicleForm.tsx`, `ConfirmDialog.tsx`)

- 검증 대상: 병합 `c70cefe`(32a~32c)와 그 뒤 병합된 후속 `edfcf3e`(리뷰 Blocker·접근성 C1·C2 수정), `515acc8`(포커스 복구 범위 한정). 요청서의 기준 `c70cefe`에는 Blocker 수정이 들어 있지 않아 **전체 테스트·타입·빌드와 모든 확인을 main `f781d42`에서** 했다.
- 방법: (가) 실제 컴포넌트를 jsdom에서 확인(훅 대신 상태를 가진 껍데기와 가짜 저장·삭제 콜백). (나) `CarbookApp`에 아직 연결되지 않아(MPR-38) 실앱에서는 볼 수 없으므로, 실제 컴포넌트와 전역 스타일로 띄우는 임시 화면(`docs/qa/scripts/mpr32_harness/`, 앱 코드 수정 없음)을 빌드해 Chrome에서 375px·1280px로 확인했다.
- 실행:
  - `npx vitest run --config <qa jsdom 설정> docs/qa/scripts/mpr32_comp.qa.tsx` → `Tests 21 passed (21)`
  - `npx vite build docs/qa/scripts/mpr32_harness --config vite.config.ts --outDir <scratch> --base ./` 후 `node docs/qa/scripts/mpr32_shots.mjs <playwright-core> <빌드 폴더> docs/qa/screens` → `RESULT pass=24 fail=0`
  - main `f781d42`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 81 passed (81)`, `Tests 942 passed (942)`; `npx tsc -b` → 0; `npm run build` → `built in 406ms`. (`f781d42` 뒤 `aa4b661`은 `StatsTab.module.css` 한 파일만 바꿨고 이 티켓의 파일은 그대로다.)
- 스크린샷: `docs/qa/screens/mpr32-{mobile375,desktop1280}-{card,empty,form-errors,confirm}.png`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-32 | AC-03-1 (화면) | 선택 상자에서 "가족"을 고르면 카드가 가족 정보(차종·연식·번호판·주행거리)로 바뀜, 이전 차량 값은 사라짐. 빈 값은 "-". 추가하면 새 차량이 선택되어 카드에 보임. 375·1280px 모두 카드·선택 상자 표시, 가로 스크롤 없음. 기록·교체 알림 등이 선택 차량만 보이는 것은 MPR-26(훅)과 MPR-38(연결)에서 확인 | PASS(컴포넌트 범위) | `mpr32_comp.qa.tsx`, `mpr32_shots.mjs` |
| MPR-32 | AC-03-3 | 별칭 비움 → 칸 아래 MSG-05, 연식 1949·올해+2 → MSG-08, 저장 요청 0건, 포커스가 첫 오류 칸으로, `aria-invalid`·`aria-describedby`. 경계: 연식 1950·올해+1은 통과. 375·1280px에서 오류 문구가 칸 아래에 보임 | PASS | 같음 |
| MPR-32 | AC-03-4 | 저장 실패(`false`) → 양식이 열린 채 별칭·차종·연식·번호판·주행거리 입력값 그대로, 저장 버튼 다시 활성, 다시 눌러 성공하면 닫힘. `reject`해도 영구히 잠기지 않음. 실앱 브라우저에서도 같음. 토스트(MSG-01)는 훅이 띄움(MPR-26에서 확인) | PASS | 같음 |
| MPR-32 | AC-03-5 (화면 부분) | 수정 양식이 기존 값으로 채워지고, 별칭을 "출근차"로 저장하면 `onSave(…, id)` 호출과 카드가 "출근차"로 바뀜. 연결 일정 제목 `[출퇴근]`→`[출근차]` 변경은 캘린더 연동(MPR-27) 범위 | PASS(화면 부분) | 같음 |
| MPR-32 | AC-03-6 (화면 부분) | 삭제 확인창에서 "삭제" → 차량이 사라지고 다른 차량은 그대로. 딸린 행·연결 일정 삭제와 "다른 차량 데이터 그대로"는 훅·DB(MPR-26·27·17)에서 확인 | PASS(화면 부분) | 같음 |
| MPR-32 | AC-03-7 | 첫째 삭제 → 둘째 선택, 둘째까지 삭제 → "차량을 추가해 주세요"와 "차량 추가" 버튼(375·1280px 스크린샷) | PASS | 같음 |
| MPR-32 | AC-11-1 | "취소" → 창이 닫히고 차량이 남고 삭제 요청 0건. 창 밖(스크림) 클릭도 취소. 처음 포커스는 "취소" | PASS | 같음 |
| MPR-32 | AC-11-2 | "삭제" → 삭제 요청 1건(`onDelete('a')`) 뒤 차량 사라짐. 실패(`false`)면 창이 열린 채 차량이 남고 다시 눌러 성공 가능. 연속 클릭은 요청 1건(AC-10-2) | PASS | 같음 |
| MPR-32 | AC-11-3 | 차량: "차량 출퇴근을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다"와 MSG-14. 교체 항목·만기일: 대상 이름 문구, 경고 없음(375·1280px에서 확인창이 화면 안에 있음) | PASS | 같음 |
| MPR-32 | AC-11-4 | Esc → 창 닫힘, 삭제 요청 0건(컴포넌트·브라우저 모두). 닫힌 뒤 포커스가 "차량 추가" 버튼으로 복귀 | PASS | 같음 |
| MPR-32 | 후속 수정 확인 | 삭제 요청 중에도 창을 닫을 수 있고 완료 뒤 `onClose`를 또 부르지 않음(Blocker 수정). 확인창·양식의 `reject`로 잠기지 않음 | PASS | `mpr32_comp.qa.tsx` |
| MPR-32 | 회귀 | main `f781d42`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 942 passed |

- 관찰(비차단, 확인 불가): 375×760에서 오류 두 줄이 있는 추가 양식은 아래쪽 "취소" 버튼이 화면 아래 끝에 걸려 일부 잘려 보인다(`mpr32-mobile375-form-errors.png`). 시트가 안쪽에서 스크롤되는지는 이번에 확인하지 않았다. MPR-38 연결 뒤 실앱에서 한 번 더 본다.
- 이월: `CarbookApp` 연결 상태의 실앱 화면(차량 영역↔하위 탭, 토스트 표시)과 AC-03-1의 "기록·교체 알림·만기일·통계가 선택 차량만"은 MPR-38 검증으로 넘긴다. 접근성 C1·C2 재점검은 Auditor 몫(MPR-38 연결 뒤)이라 판정하지 않았다.
- 판정: MPR-32 **PASS**(컴포넌트 단독 범위).

## MPR-30 모바일 파일철 탭 배치 (`src/carbook/FileTabs.module.css`)

- 검증 대상: 병합 `a087054`(구현 `ce0352c`). 전체 테스트·타입·빌드는 **main `234d1d0`**에서 실행했다(`src/`는 이후 병합 `19c4f1b`(MPR-43, DB만)에서도 같고, 이 티켓 파일은 `a087054` 이후 변경 없음).
- 방법: 현재 빌드와 탭 없던 때(`ec21359`) 빌드를 Playwright `route`로 내려받아 Chrome에서 360×640·899×700(터치, 모바일 에뮬레이션)과 데스크톱 1280×800으로 측정했다(Supabase 환경변수 비움). Frontend의 측정 스크립트는 쓰지 않고 새로 작성했다.
- 실행:
  - `node docs/qa/scripts/mpr30_mobile.mjs <playwright-core> <현재 빌드> <탭 없던 때 빌드> docs/qa/screens` → `RESULT pass=17 fail=0`
  - main `234d1d0`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 81 passed (81)`, `Tests 942 passed (942)`; `npx tsc -b` → 0; `npm run build` → `built in 1.17s`
- 스크린샷: `docs/qa/screens/mpr30-mobile360-{calendar,fab-dialog}.png`, `mpr30-{mobile360,desktop1280}-car-tabs.png`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-30 | AC-14-1 | 360×640: 탭 2개(각 28×56)와 FAB(52×52)의 터치 영역 교집합 없음 | PASS | `mpr30_mobile.mjs` |
| MPR-30 | AC-14-2 | 시작점(250,300)이 탭 영역 밖임을 확인하고 월 그리드를 가로 스와이프(실제 터치 이벤트) → 기간이 `2026년 11월`→`2026년 12월`로 넘어감. "기존 스와이프 테스트 통과"는 전체 테스트 942 passed에 포함 | PASS | 같음, 전체 테스트 |
| MPR-30 | AC-14-3 | FAB 중심 점의 최상위 요소가 FAB(탭이 안 가림), 탭하면 새 일정 편집창이 열림 | PASS | 같음 |
| MPR-30 | AC-14-4, AC-01-5 | 360×640·899×700에서 캘린더 요소 166개(헤더·월 그리드·사이드바·버튼, 탭 제외)의 위치·크기가 탭 없던 때와 같음, 가로 스크롤 없음. 기존 캘린더 테스트는 전체 테스트에 포함 | PASS | 같음, 전체 테스트 |
| MPR-30 | AC-14-5 | 360 터치: 탭 각각 너비 28px(≥24), 높이 56px(≥44) | PASS | 같음 |
| MPR-30 | AC-01-7 | 데스크톱 "차계부"·"캘린더" 탭을 10회 번갈아 클릭해 클릭부터 두 프레임 뒤까지: 7.6~39.1ms, p95≈최댓값 39.1ms ≤ 100ms, 마지막 주소 `/`. 데이터 로딩은 제외 | PASS | 같음 |
| MPR-30 | 글자 정렬 보정 | 현재 탭·비선택 탭 라벨 중심 x 차이 1px 이하(360px·1280px, `/`와 `/car` 모두) | PASS | 같음 |
| MPR-30 | 회귀 | main `234d1d0`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 942 passed |

- 판정: MPR-30 **PASS**.

## MPR-37 통계 탭 (`src/carbook/components/StatsTab.tsx`)

- 검증 대상: 본체와 후속 37b·37c·37d(최종 병합 `aa4b661`). 전체 테스트·타입·빌드는 **main `234d1d0`**(`StatsTab`은 `aa4b661` 이후 변경 없음).
- 방법: 실제 컴포넌트를 jsdom에서 오늘 `2026-11-05`로 고정(`Date`만 가짜 타이머)하고 `records`·`economy`를 직접 넘겨 확인했다. `CarbookApp`에 아직 연결되지 않아(MPR-38) 연동 화면과 스크린샷은 MPR-38 검증으로 넘긴다. 합계 계산 자체는 MPR-23에서 확인했다.
- 실행: `npx vitest run --config <qa jsdom 설정> docs/qa/scripts/mpr37_stats.qa.tsx` → `Tests 16 passed (16)`. 전체는 위 `234d1d0` 결과(942 passed).
- 측정 중 알게 된 점: 첫 실행의 5건 FAIL은 월 표시 글자(`2026-11`)가 월 선택 영역과 "월별 합계" 목록에 둘 다 있어 내 선택자가 여러 요소를 잡은 것이었다. 월 선택 영역 안에서 찾도록 고쳤고 기대값은 그대로다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-37 | AC-09-1 | 기본은 이번 달(2026-11). 총 지출 200,000원, 종류별 보험 100,000 · 주유 90,000 · 세차 10,000(큰 순), 기록 있는 종류만, 금액 0 기록도 표시 | PASS | `mpr37_stats.qa.tsx` |
| MPR-37 | AC-09-2 | 11월 20,000 → 이전 달 10월 30,000 → 다음 달 11월. 연도 경계 2026-01 → 2025-12. 이동 범위 끝(이번 달+12개월)은 `aria-disabled`(스펙에 없는 안전장치) | PASS | 같음 |
| MPR-37 | AC-09-3 | 화면은 받은 `records`만 합산(차량 B 기록만 넘기면 5,000원). 선택 차량 필터링은 호출 쪽이라 MPR-38 검증으로 이월 | PASS(컴포넌트 범위) | 같음 |
| MPR-37 | AC-09-4 | 기록 없는 달: "0원"과 "이 달의 기록이 없습니다", 종류별 구역 없음, 오류 없음. 기록이 하나도 없어도 같음, 금액 0 기록만 있는 달에는 문구 없음. 낭독용 status가 "2026년 11월 총 지출 0원, 이 달의 기록이 없습니다" | PASS | 같음 |
| MPR-37 | AC-09-5 | `2026-10-20 — 10.0km/L`, `2026-11-01 — 15.0km/L` 순서. 소수 첫째 자리(12.34→12.3, 9.96→10.0). 구간 없으면 "가득 주유 기록이 2건 이상 필요합니다" | PASS | 같음 |
| MPR-37 | AC-09-6 | 기록 삭제(props 갱신) → 다시 불러오기 없이 합계가 삭제된 금액만큼 줄고 종류별에서 사라짐. 달을 옮긴 뒤 기록이 바뀌어도 선택한 달 유지. 기록 삭제 후 실제 갱신 흐름은 훅(MPR-26)·연결(MPR-38) | PASS(컴포넌트 범위) | 같음 |
| MPR-37 | AC-09-7 | `2026-11`~`2025-12` 12개, 11월 73,000·3월 20,000·나머지 0원. 2026-03을 선택해도 목록이 그대로 | PASS | 같음 |
| MPR-37 | 불러오기 상태 | `loading`은 status "불러오는 중", `error`는 MSG-04와 "다시 시도"(누르면 `onRetry` 1회, 포커스가 main으로) | PASS | 같음 |
| MPR-37 | 회귀 | main `234d1d0`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 942 passed |

- 이월(MPR-38): 연결된 실앱 화면(375px·데스크톱 스크린샷), AC-09-3의 선택 차량 필터, AC-09-6의 기록 탭 삭제 후 통계 갱신. 접근성 D1·D2·E1은 Auditor 재점검 통과로 받았고 이번에 판정하지 않았다.
- 판정: MPR-37 **PASS**(컴포넌트 범위).

## MPR-43 `is_carbook_linked_event` 일정 소유자 한정 (`supabase/schema_carbook.sql`)

- 검증 대상: 병합 `19c4f1b`. 전체 테스트·타입·빌드는 **main `9e228ce`**에서 실행했다(MPR-27 병합 포함, 이 티켓은 `src/` 0줄).
- 방법: PGlite 0.2.17로 Supabase 모양(auth.uid, authenticated 역할, RLS)을 흉내 냈다. **실제 Supabase가 아니며 운영 DB에는 아직 적용되지 않았다(Michael 승인 필요).** 사용자 A(일정 소유자), B·C(A의 공유 상대), D(무관). B가 자기 항목·만기일의 `event_id`에 A의 일반 일정 id를 넣는 공격을 직접 실행했다.
- 대조 실험: 같은 새 스크립트를 MPR-43 이전 SQL(`9e67ede`)로 돌리면 AC-16-3·AC-16-6 포함 8건이 FAIL이라, 검사가 결함을 잡는다.
- 실행:
  - `node docs/qa/scripts/mpr43_owner.mjs <pglite>` → `RESULT pass=20 fail=0`
  - `node docs/qa/scripts/mpr18_hide.mjs <pglite>` → `RESULT pass=34 fail=0`(기존 MPR-18 회귀)
  - main `9e228ce`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 82 passed (82)`, `Tests 963 passed (963)`; `npx tsc -b` → 0; `npm run build` → `built in 442ms`
  - `git diff 19c4f1b^1 19c4f1b --stat` → `docs/db.md`, `supabase/schema_carbook.sql` 2개뿐. `src/`와 기존 `supabase/schema*.sql` 변경 0건

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-43 | AC-16-3 | B가 자기 항목·만기일의 `event_id`에 A의 일반 일정(norm, 분류 없음 nocat)을 넣은 뒤에도 C에게 두 일정이 모두 보임(옛 함수에서는 0건). B 본인·A 본인에게도 보임 | PASS | `mpr43_owner.mjs` |
| MPR-43 | AC-16-1 | A의 진짜 연결 일정(만기일 연결, 항목 연결 분류 없음)은 B·C에게 0건. B가 항목으로 같은 id를 가리켜도 변함없음. 대칭으로 B의 연결 일정은 A에게 0건, B에게는 보임 | PASS | 같음 |
| MPR-43 | AC-16-2 | A 본인에게 연결 일정이 계속 보임 | PASS | 같음 |
| MPR-43 | AC-16-6 | A가 '차계부' 카테고리를 지운 뒤에도 연결 일정은 B·C에게 0건, 일반 일정은 보임 | PASS | 같음 |
| MPR-43 | AC-16-7 | A가 차계부 카테고리에 직접 만든 일정은 B·C에게 0건, A에게는 보임 | PASS | 같음, `mpr18_hide.mjs` |
| MPR-43 | 함수·권한 | `is_carbook_linked_event`는 `(p_event_id uuid, p_owner uuid)` 하나만 존재, `(due,A)`·`(orphan,A)` 참, `(norm,A)` 거짓, anon 실행 거부(42501), authenticated만 실행 가능, SQL 파일 `-- DOWN:`에 2인자 함수 포함, 무관 사용자 D는 0건 | PASS | 같음 |
| MPR-43 | AC-16-4·5 | 기존 캘린더·공유 테스트 전부 통과, 변경 파일에 캘린더 컴포넌트·`useCalendar`·기존 SQL 0건 | PASS | `npx vitest run …` 963 passed, `git diff --stat` |

- 한계: PGlite 모의라 실제 Supabase(PostgREST·정책 평가 순서)와 다를 수 있다. 운영 적용 뒤 같은 스크립트의 질의를 실제 DB에서 한 번 확인할 것을 권한다. 남은 상태(공격으로 생긴 B 쪽 고아 연결의 upsert 충돌)는 docs/db.md 7.3에서 수용된 사항이며 내가 따로 검증하지 않았다.
- 판정: MPR-43 **PASS**(PGlite 범위).

## MPR-27 useCarbook 교체 항목·만기일 쓰기와 캘린더 연동 (`src/carbook/state/useCarbook.ts`)

- 검증 대상: 병합 `9e228ce`(구현 `45f42ad`, 리뷰 수정 `23975f3`). 전체 테스트·타입·빌드는 **main `9e228ce`**에서 실행했다(이후 `src/` 변경 없음).
- 방법: `useCarbook`을 **상태를 가진 가짜 백엔드**(`carbookApi` 대체: 선점 규칙 `event_id is null`, 만기일 종류당 1개 23505, 차량 삭제 연쇄, 호출별 실패 주입)와 **진짜 `calendarLink.ts`**(가짜 supabase 클라이언트 위의 `events`·`categories` 표, 없는 카테고리 upsert는 23503, `ensure_carbook_category` 모사)에 물렸다. 결과는 호출 횟수가 아니라 저장된 events·items·dues 표와 훅 상태로 판정한다. 개발자의 `useCarbook.link.test.tsx`(연동 모듈 전체 모의)는 쓰지 않고 새로 작성했다. **실제 Supabase·브라우저 화면은 아니다.**
- 실행:
  - `npx vitest run --config <scratch>/vitest.qa.dom.config.mjs docs/qa/scripts/mpr27_link.qa.tsx` → `Tests 39 passed (39)`
  - main `9e228ce`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 82 passed (82)`, `Tests 963 passed (963)`; `npx tsc -b` → 0; `npm run build` → `built in 442ms`

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-27 | AC-08-1·10 | 엔진오일 12개월(2026-11-05) 저장 → 종일 일정 `[내 차] 엔진오일 교체 예정` 2027-11-05 1건, 고정 id 카테고리, 항목 `event_id`와 일치, reload 1회, 토스트 없음. 번호판 `12가3456`은 항목 2·만기일 3 일정(5건) 제목·메모에 없음 | PASS | `mpr27_link.qa.tsx` |
| MPR-27 | AC-07-1·2·6, AC-08-2 | 보험 2027-03-10 저장 → 화면 값·일정 `[내 차] 보험 만기`; 2027-04-01 수정 → 일정 날짜만 바뀌고 1건; 삭제 → 행·일정 모두 사라짐. 같은 종류 재저장은 생성 1번·수정 1번. 자동차세 납부·정기검사 만기 제목 | PASS | 같음 |
| MPR-27 | AC-07-5 | 생성·수정 저장 실패 → MSG-01, 기존 값·일정 그대로, 일정 쓰기·reload 없음 | PASS | 같음 |
| MPR-27 | AC-06-2·10·11 | 12→6개월 → 다음 교체일 2027-05-05·일정 이동. 지남 항목 교체 완료(2026-11-05, 48,000km) → 갱신·`ok`·2027-11-05. 타이어 48개월 추가(일정 2030-11-05) → 삭제 시 목록·일정 사라짐 | PASS | 같음 |
| MPR-27 | AC-08-4·16 | 고정 id 카테고리가 이미 있으면 저장 3번 뒤에도 1개, ensure RPC 1번. 수동 '차계부' 카테고리·일정은 변경 0, 연결 일정은 고정 id, 카테고리 2개. 카테고리가 그새 지워지면 23503 후 한 번 다시 만들어 성공 | PASS | 같음 |
| MPR-27 | AC-08-5·6 | 일정 쓰기만 실패 → 항목 저장 성공, 그 행만 `calendarFailed`, 토스트·reload 없음 → 재시도 성공 시 표시 사라지고 1건. 재시도 동시 2번 → 1건, 성공 뒤 또 눌러도 1건. 만기일 동일. 다시 저장해 성공해도 표시 사라짐 | PASS | 같음 |
| MPR-27 | AC-08-7 | 일정 삭제 실패 → 항목·만기일·일정 모두 남고 MSG-03, 재시도 성공 시 모두 사라짐 | PASS | 같음 |
| MPR-27 | AC-03-6 | 연결 일정 있는 차량 삭제 → 차량·딸린 행·일정 삭제, 다른 차량의 행·기록·일정 그대로, reload 1회 | PASS | 같음 |
| MPR-27 | AC-03-8 | 일정 3건 중 두 번째 삭제 실패 → MSG-03, 차량 남음, 첫 항목 `event_id` null(표·훅 상태), 나머지 둘의 연결 유지. 훅을 다시 올려 차량을 수정·동기화해도 첫 일정 재생성 없음. 마지막 행 삭제 단계 실패에서도 비워진 연결 유지 | PASS | 같음 |
| MPR-27 | AC-08-8, AC-06-5·13·15 | km만 있고 기록 부족 → 일정 0건·다음 교체일 없음·reload 없음. 남은 거리 8,000km. 새 차량 7행: 엔진오일 2027-11-05 `ok`, 타이어 위치·브레이크 패드 "기록 부족"(날짜·남은 거리 없음, 배지 없음), 일정·reload 0. 첫 기록 48,000 → km 항목 마지막 교체 주행거리 48,000, 엔진오일 남은 거리 10,000, 지남 없음, 일정 0 | PASS | 같음 |
| MPR-27 | AC-08-9 | 일정 2027-01-04의 km 항목에 최근 기록 추가 → 다음 교체일·일정 2026-12-20, reload 1회 | PASS | 같음 |
| MPR-27 | AC-08-15 | 기록 삭제로 90일 안 기록 2건 미만 → 일정 삭제, `event_id` 유지, `calendarFailed`·토스트 없음, 다음 교체일 없음. 기록이 다시 늘면 같은 id 일정이 2026-12-20으로 재생성 | PASS | 같음 |
| MPR-27 | 이월: event_id 선점 | 돌려받은 `eventId`가 null이면 캘린더 요청 0번·저장 성공·표시 없음. 선점 성공 시 일정 생성. 같은 항목을 두 탭이 동시에 저장하면 이긴 id로 일정 1건. 항목·만기일을 두 탭이 동시에 첫 저장하면 카테고리 1개·일정 각 1건 | PASS | 같음 |
| MPR-27 | 이월: ensure 42501 | RPC 42501 → 로그아웃 호출 0번, 토스트 0, 항목 저장·그 행만 MSG-11, 다시 시도하면 성공. 실패한 ensure는 기억하지 않고 다시 시도(RPC 2번) | PASS | 같음 |
| MPR-27 | 이월: reload 1회 | 연결 3건이 바뀌는 차량 수정 → 1회, 같은 값 재저장 → 증가 없음(쓰기 0). reload 실패해도 저장 성공 | PASS | 같음 |
| MPR-27 | 기타 | 일정 삭제 질의가 `user_id` 조건을 가져 남의 같은 id 일정은 안 지워짐. 기록 읽기 실패 상태에서 km 항목 일정은 쓰지도 지우지도 않음(리뷰 수정 `23975f3`). 훅 흐름 전체에서 `events` update(재묶기) 질의 0번 | PASS | 같음 |
| MPR-27 | 회귀 | main `9e228ce`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run --maxWorkers=2 --testTimeout=60000` → 963 passed |

- 범위 밖(이월): AC-08-3(`/car`를 열 때 지운 일정 재생성)·AC-08-14·재묶기에서 직접 만든 일정 제외는 열 때 점검(MPR-28), AC-08-12(저장 뒤 3초 안 캘린더 반영 p95)와 일정 왕복 성능도 MPR-28. 훅은 이 티켓에서 `rebindCategory`를 부르지 않는다(질의 0번 확인). 화면에서의 MSG-11 문구·"수정만 보임"(AC-07-6 화면)·삭제 확인창 흐름과 실앱 375px·데스크톱 화면은 MPR-38.
- 한계: 가짜 백엔드는 RLS·실제 PostgREST를 거치지 않는다. 선점·카테고리 함수의 DB 쪽 동작은 MPR-17·18·42·43의 PGlite 검증에서 확인했다. 정상 실행 시 `console.error`는 요청 실패 로그를 막기 위해 가렸다.
- 판정: MPR-27 **PASS**(훅·연동 모듈 범위).

## MPR-28 useCarbook 열 때 점검 (`src/carbook/state/useCarbook.ts`)

- 검증 대상: 병합 `31b0c4d`(구현 `1f411e2`). 전체 테스트·타입·빌드는 **main `4b9ad0d`**에서 실행했다(`31b0c4d` 이후 `src/` 변경은 테스트 파일 `useCarbook.reconcile.test.tsx` 12줄뿐, `useCarbook.ts`는 같다).
- 방법: MPR-27과 같은 틀. 상태 있는 가짜 백엔드 + 진짜 `calendarLink.ts` + 가짜 supabase 표(카테고리 삭제 시 일정 분류가 풀리는 DB 동작 모사). 결과는 표의 최종 상태와 훅이 실제로 보낸 질의(`update` 대상 id, `user_id` 조건)로 판정한다. 공유 상대 B의 시야(AC-16-6·16-8)는 훅이 보낸 재묶기 질의를 JSON으로 남겨 **PGlite에서 같은 모양으로 재생**해 확인했다(실제 Supabase 아님). 개발자의 `useCarbook.reconcile.test.tsx`(연동 모듈 모의)는 쓰지 않았다.
- 실행:
  - `QA_OPS_OUT=<scratch>/mpr28_ops.json npx vitest run --config <scratch>/vitest.qa.dom.config.mjs docs/qa/scripts/mpr28_reconcile.qa.tsx` → `Tests 19 passed (19)`
  - `node docs/qa/scripts/mpr28_visibility.mjs <pglite> <scratch>/mpr28_ops.json` → `RESULT pass=12 fail=0`
  - main `4b9ad0d`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 83 passed (83)`, `Tests 976 passed (976)`; `npx tsc -b` → 0; `npm run build` → `built in 1.70s`. 요청서가 알린 `TimeGridView.drag` 불안정은 이 실행에서 나타나지 않았다.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-28 | AC-08-3 | 연결 일정이 지워진 채 열면 같은 id·제목·날짜·고정 카테고리로 다시 생김(항목+만기일), reload 1회, 토스트·표시 없음. 다시 열면 쓰기 0·reload 0·항목당 1건. 연결 id 없는 행은 만들지 않음. 같은 화면 수명에서 차량을 바꿨다 돌아와도 조회·쓰기 반복 없음 | PASS | `mpr28_reconcile.qa.tsx` |
| MPR-28 | AC-08-3(km 항목) | 기록이 읽혀 날짜를 구하면(2026-12-20) 다시 만들고, 기록 1건뿐이면 만들지 않고 표시도 없음. 다른 차량의 km 항목은 선택해 기록을 읽은 뒤에야 판단해 다시 만듦 | PASS | 같음 |
| MPR-28 | AC-08-14 | 카테고리를 지운 뒤 열면 카테고리 1개(고정 id)가 새로 생기고 연결 일정 2건이 모두 속함. 재묶기는 `update` 1번에 `user_id=나`와 대상 id 2개, 값은 `{category_id: 고정 id}`. 다른 카테고리로 옮겨진 연결 일정은 되돌림 | PASS | 같음 |
| MPR-28 | AC-16-8 | 직접 만든 일정은 카테고리 재생성 뒤에도 분류 없음 그대로, 재묶기 대상 id에 없음, 이후 항목·만기일 저장에도 그대로. 평상시 열기에서 직접 일정·같은 이름 수동 카테고리 일정은 쓰기 0 | PASS | 같음 |
| MPR-28 | AC-16-6·16-8 (B의 시야) | PGlite 재생: 카테고리 삭제 뒤 B에게 연결 일정 0건·직접 일정 보임, 점검이 보낸 재묶기 질의 실행 뒤에도 연결 일정 0건·직접 일정 계속 보임(분류 없음 유지), A에게는 둘 다 보임 | PASS | `mpr28_visibility.mjs` |
| MPR-28 | 규모·1회 규칙 | 연결 행 330(NFR-10 최대): 조회 100개씩 4번, 재묶기 `update` 100·100·100·30개 4번. 재묶기와 재생성이 함께 필요해도 reload 1번 | PASS | `mpr28_reconcile.qa.tsx` |
| MPR-28 | 실패·비차단 | 일정 조회가 지연돼도 화면(`loadState`·`recordsState` ready, 항목 표시)이 먼저 그려짐. 조회 실패 → 연결 행 전부 MSG-11, 토스트 없음, 화면 데이터 그대로, 재시도로 생성·해제. 재묶기 실패 → 해당 행만 표시, 재시도로 정정. ensure 42501 → 표시만, 토스트·로그아웃 없음. 재생성 쓰기 1건 실패 → 그 행만 표시 | PASS | 같음 |
| MPR-28 | 회귀 | main `4b9ad0d`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run …` → 976 passed |
| MPR-28 | AC-08-12 (MPR-27 이월) | **판정 보류(이월 MPR-38)**. 훅이 reload 호출 직전까지 보내는 순차 요청 수만 측정: 새 만기일 첫 저장 4(생성·ensure RPC·조회·upsert), 만기일 수정 3, 새 항목 저장 2. 여기에 캘린더 reload의 조회 ≥1이 더해져 첫 저장은 순차 5왕복 이상 | 보류 | `mpr28_reconcile.qa.tsx`(`.reqs` 출력) |

- AC-08-12 소견: "Fast 4G" 프리셋의 왕복 지연 약 562ms를 적용하면 첫 저장은 5왕복만으로 약 2.8초라 3초(p95)에 가깝다(전송 시간 제외, 값은 추정이며 측정이 아니다). 연결된 실앱이 없어(MPR-38) 브라우저 실측은 하지 못했다. `syncEvent`가 `ensureCategoryId`를 기다린 뒤에야 `fetchEvents`를 부르므로 두 요청을 동시에 보내면 첫 저장이 4왕복이 되는 개선 여지가 있다(선택).
- 한계: 가짜 백엔드·PGlite 모의이며 실제 Supabase(PostgREST·CORS 사전 요청)는 거치지 않았다.
- 판정: MPR-28 **PASS**(AC-08-3·14, AC-16-6·16-8, 규모·실패 케이스). AC-08-12는 이월.

## MPR-33 기록 탭·기록 양식·연비 표시 (`src/carbook/components/RecordsTab.tsx`, `RecordForm.tsx`, `ConfirmDialog.tsx`, `src/components/Overlay.tsx`)

- 검증 대상: 병합 `7514a71`~`ea4fa89`(33a~33h, origin/main `55f6fbb`). 전체 테스트·타입·빌드는 **main `f3ab747`**에서 실행했다(33 관련 파일은 `55f6fbb` 이후 변경 없음, 이후 병합은 MPR-34 교체 알림 탭).
- 방법:
  - **화면 동작**: 진짜 `useCarbook` 훅(상태 있는 가짜 백엔드)에 진짜 `RecordsTab`·`RecordForm`·`ConfirmDialog`를 물려 jsdom에서 확인(MPR-27 틀). 개발자의 `Record*.test.tsx`는 쓰지 않았다.
  - **브라우저**: 기록 탭 harness(아직 `CarbookApp`에 안 연결돼 별도 화면)와 실제 캘린더 앱(`vite build`, Supabase 환경변수 비움, 시드 일정은 localStorage)을 Chrome 375×760(터치)·1280×800으로 Playwright `route` 서빙해 확인했다.
- 실행:
  - `npx vitest run --config <scratch>/vitest.qa.dom.config.mjs docs/qa/scripts/mpr33_records.qa.tsx` → `Tests 18 passed (18)`(3회 연속)
  - `node docs/qa/scripts/mpr33_browser.mjs <playwright-core> <harness 빌드> <앱 빌드> docs/qa/screens` → `RESULT pass=56 fail=1`(실패 1건은 아래 결함)
  - main `f3ab747`: `npx vitest run --maxWorkers=2 --testTimeout=60000` → `Test Files 92 passed (92)`, `Tests 1069 passed (1069)`; `npx tsc -b` → 0; `npm run build` → `built in 584ms`
- 스크린샷: `docs/qa/screens/mpr33-{mobile375,desktop1280}-records.png`, `mpr33-{mobile375,desktop1280}-confirm-over-form.png`, `mpr33-desktop1280-odometer-confirm.png`, `mpr33-mobile375-empty.png`, `mpr33-app-desktop1280-scope-dialog.png`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-33 | AC-04-1 | 주유·정비·세차·보험·세금·주차·기타를 날짜·금액만으로 저장 → 7건이 목록에 있고 종류 이름이 맞음 | PASS | `mpr33_records.qa.tsx` |
| MPR-33 | AC-04-2 | 금액 수정 → 목록 금액 변경. 삭제 확인에서 "취소"하면 기록·수정 양식 그대로, "삭제"하면 목록에서 사라져 "기록이 없습니다". 확인창 문구는 `기록(2026-11-05·주유)을(를) 삭제할까요` | PASS | 같음 |
| MPR-33 | AC-04-3 | 11-01·11-05·11-03 + 같은 11-05에 UI로 나중에 추가 → 11-05(나중), 11-05(먼저), 11-03, 11-01 | PASS | 같음 |
| MPR-33 | AC-04-4 | 종류·날짜·금액 비우고 저장 → "금액을(를) 입력해 주세요" 등이 칸에 `aria-describedby`로 연결, `aria-invalid`, 저장 요청 0건, 양식 유지 | PASS | 같음 |
| MPR-33 | AC-04-5 | 금액 `-100`·`12.5` → MSG-06, 주유량 `abc` → MSG-07, `10000` → "주유량은(는) 9,999.99 이하로 입력해 주세요", 요청 0건 | PASS | 같음 |
| MPR-33 | AC-04-6, AC-10-6 | 현재 50,000km에서 49,000 저장 → MSG-10("50,000km"). "취소": 저장 안 됨·양식과 입력값 유지. "저장": 저장되고 목록에 49,000km. 감소가 아니면 확인창 없이 저장 | PASS | 같음, `mpr33_browser.mjs` |
| MPR-33 | AC-04-7, AC-10-1 | 저장 요청 실패 → MSG-01 토스트, 양식이 열린 채 종류·날짜·금액·주행거리·주유량·메모·가득 체크 모두 유지, 목록에 새 기록 없음, 저장 버튼 다시 활성. 수정 저장 실패·삭제 실패(MSG-03, 확인창 유지)도 같음 | PASS | `mpr33_records.qa.tsx` |
| MPR-33 | AC-04-8 | 주유(30L·가득) 입력 후 세차로 바꿔 저장 → 저장된 기록의 주유량 null·가득 false(주유 전용 칸은 화면에서도 사라짐) | PASS | 같음 |
| MPR-33 | AC-05-1·05-4 | 가득 A·중간 20L·가득 B → "연비 10.0km/L"(B 행에도 10.0). C(2026-11-01, 11,100km, 40L, 가득) 추가 → 15.0, B 행의 10.0 그대로. AC-05-3(주행거리 없는 가득 기록)도 연비 없음 | PASS | 같음 |
| MPR-33 | AC-05-2 | 가득 1건뿐 → 숫자 없음, "가득 주유 기록이 2건 이상 필요합니다" | PASS | 같음 |
| MPR-33 | AC-10-2 | 요청 진행 중 저장 버튼 3번·폼 제출을 더 해도 요청 1번 | PASS | 같음 |
| MPR-33 | 불러오기 실패 | 기록 읽기 실패 → MSG-04와 "다시 시도", 누르면 다시 읽어 목록 표시 | PASS | 같음 |
| MPR-33 | 겹친 창(요청 중점) | 기록 양식 위 "삭제 확인"(375·1280): 확인창 첫 포커스 "취소", Tab 8번·Shift+Tab 모두 확인창 안(아래 양식으로 새지 않음), Esc 1번은 확인창만 닫고 포커스는 양식 안, Esc 2번째에 양식 닫힘(DOM 제거)·포커스가 눌렀던 행으로. 양식에서도 Tab 14번 창 안 | PASS | `mpr33_browser.mjs` |
| MPR-33 | 겹친 창: MSG-10 | 양식 위 "주행거리 확인"(48,000km 문구): Esc → 확인창만 닫히고 입력값(100) 유지·저장 안 됨. "저장" → 확인창과 양식이 모두 DOM에서 제거(244ms)되고 새 기록이 목록에 보임 | PASS | 같음 |
| MPR-33 | 캘린더 공용 Overlay(요청 중점) | 실제 앱: 새 일정 편집창(375·1280) Tab 16번·Shift+Tab 창 안, Esc로 닫히고 포커스가 "새 일정" 버튼으로 복귀. 반복 일정을 끌어 옮기면 "반복 일정 적용 범위" 창이 열리고 Tab 8번 창 안, Esc로 닫히며 일정(저장소)은 변하지 않음 | PASS | 같음 |
| MPR-33 | 1280px 열 위치(요청 중점) | 5개 행에서 날짜·종류(왼쪽 x), 금액(왼쪽·오른쪽 x), 주행거리·주유량·연비(왼쪽 x)가 모두 같음. 열 간격 main→금액 220px, 금액 폭 120px(±16). 메모는 상세 열과 같은 x에서 아래 줄. 내용 넘침·가로 스크롤 없음. 경계 1023px(2열)·1024px(3열)도 넘침 없음. 375px: 금액이 오른쪽 끝, 넘침 없음 | PASS | 같음 |
| MPR-33 | 회귀 | main `f3ab747`에서 전체 테스트·타입·빌드 | PASS | `npx vitest run …` → 1069 passed |
| MPR-33 | NFR-18 포커스(결함) | 375px에서 수정 양식의 "삭제"로 기록을 지우면 확인창·양식이 사라진 뒤 포커스가 `body`로 떨어져 1.5초 뒤에도 그대로. 1280px에서는 "기록 추가" 버튼으로 복구됨 | **FAIL** | `mpr33_browser.mjs`, 재현 스크립트(scratch) |

- 결함 재현·원인: 375×760 터치에서 행 클릭 → "삭제" → 확인창 "삭제". 모바일 시트의 퇴장 애니메이션(스프링, 약 0.6~0.7초)이 `RecordsTab.tsx`의 포커스 복구 타이머 `OVERLAY_EXIT_MS`(350ms)보다 길어, 타이머가 돌 때는 아직 퇴장 중인 시트가 포커스를 쥐고 있어(`activeElement !== body`) 복구가 건너뛰어진다. 시트가 사라진 뒤에는 복구 시도가 없다. 데스크톱은 퇴장이 350ms보다 짧아 복구된다. 제안: 타이머 대신 `AnimatePresence`의 `onExitComplete`에서 복구. 기준: NFR-18, WCAG 2.4.3. AC-04-2의 삭제 동작 자체는 정상이다.
- 한계: 기록 탭은 `CarbookApp`에 연결 전이라 harness(실제 컴포넌트·전역 스타일, 가짜 저장소)로 봤다. 연결된 실앱 화면은 MPR-38. 캘린더에서 `EventEditor` 위에 `RecurrenceScopeDialog`가 겹쳐 열리는 흐름은 앱에서 찾지 못했다(범위 창은 월 보기 드래그에서만 열리고 그때 편집창은 닫혀 있다). 그래서 두 창을 각각 열어 공용 Overlay 변경에 회귀가 없는지만 확인했다. 실제 겹침은 차계부 양식·확인창 조합에서 확인했다. 정상 실행 시 jsdom에서는 중첩 확인창이 있는 양식의 퇴장 제거가 가끔 늦어 jsdom 검사는 "안 보임(opacity 0·pointer-events none)"을 닫힘으로 보고, DOM 제거는 브라우저 검사가 따로 확인했다.
- 판정: MPR-33 수락 기준 AC-04-1~8, AC-05-1·2·4, AC-10-1·2·6 **PASS**. NFR-18 포커스 결함 1건(모바일 삭제 후)은 별도 수정 요청.
