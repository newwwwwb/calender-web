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
