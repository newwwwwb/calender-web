# 성능 점검 보고서 — 차계부

- 소유자: Performance Engineer · 판정 표시: MEETS(기준 충족) / FAILS(기준 미달)

## MPR-18 — events RESTRICTIVE 정책의 행별 함수 비용 (2026-11-06)

- 요청: Code Reviewer (conv-98bddc, 메시지 2026-11-06T03-45-19-019Z-823c21)
- 대상: 브랜치 `agent/database-engineer-mw30cm66` 커밋 `b7b60b3`, `supabase/schema_carbook.sql`, `docs/db.md` 7장
- 판정: **MEETS** (조건: 공유 상대에게 보이는 일정이 약 5,000건 이하일 때. 아래 한계 참고)

### 기준

NFR(`docs/04_nfr.md`)에 "일정 조회 DB 시간" 요구가 없다. 역할 기본값인 API p95 500ms 이하를 쓴다. 이 기준은 DB 실행 시간만의 상한으로 읽었다(네트워크 제외).

### 방법

- 도구: PGlite 0.2.17(Postgres를 WASM으로 돌리는 것, 실제 Supabase 아님). 작성자와 같은 방식이라 비교는 되지만, **네이티브 Postgres보다 느려서 절대값은 보수적(큰 쪽)**이다.
- SQL: `b7b60b3`의 `schema.sql`, `schema_share.sql`, `schema_share_mutual.sql`, `schema_together.sql`, `schema_carbook.sql`. 로그인 사용자는 `request.jwt.claim.sub`와 `set role authenticated`로 흉내냈다(RLS 적용).
- 데이터: 소유자 A 일정 N건(5%는 '차계부' 카테고리, 연결 일정 330건 = NFR-10 최대치 항목 300 + 만기일 30, 2%는 참여자 C), 공유 상대 B 본인 일정 200건, A–B 공유 연결 1건.
- 질의: B가 `select count(*), max(title) from events`(앱 `listEvents`는 날짜 조건 없이 전체를 읽는다. `src/storage/supabaseRepository.ts:123`). 값은 `EXPLAIN (ANALYZE, TIMING OFF)`의 Execution Time, 측정마다 20~40회 중앙값(앞 3회 제외).
- 비교: 같은 데이터에서 RESTRICTIVE 정책을 지운 기준선과 비교. 재현: `docs/perf/mpr-18-bench.mjs`(PGlite 설치 후 `sql/` 폴더에 위 SQL 5개를 `git show b7b60b3:supabase/…`로 내려받아 실행).

### 결과 (B가 전체 조회, DB 실행 시간 ms)

| A 일정 수 | 정책 있음 | 기준선(정책 없음) | 증가분 | 비고 |
|---|---|---|---|---|
| 500 | 15.6 | 6.9 | +9 | 1회 측정 |
| 2,004 (작성자 수치와 같은 규모) | 46~62 (3회 더: 57, 90, 97) | 20~69 (3회 더: 44, 39, 31) | 약 +25~+65 | 측정 편차가 큼 |
| 3,000 | 54~67 | 23~46 | 약 +20~+30 | |
| 5,000 | 301 (3회 더: 138, 335, 339) | 118 (3회 더: 106, 150, 137) | 약 +30~+200 | 편차 큼 |
| 10,000 | 608 | 307 | +300 | 1회 측정 |

- 소유자 A 본인 조회는 정책이 있어도 기준선과 같았다(2,004건 72.6 대 79.6ms, 5,000건 214 대 205ms, 10,000건 409 대 473ms). 조건 ①(`auth.uid() = user_id`)에서 끝나 함수를 안 부른다. `docs/db.md`의 설명과 일치.
- 증가분은 일정 수에 거의 비례한다. 공유 상대가 읽는 행당 약 20~35µs(PGlite 기준).
- 작성자 수치(2,004건 107ms)와 같은 자릿수다. 이번 측정은 같은 규모에서 46~97ms.
- 측정 편차: 같은 조건이 실행마다 2~3배 흔들렸다(예: 2,004건 기준선 20~69ms). 한 번 측정에서 정책 있음이 더 빠르게 나온 경우(2,004건 60.9 대 68.7ms)는 이 편차 때문이며, 정책이 비용을 줄였다는 뜻이 아니다. 위 범위는 편차를 포함한 값이다.

### 병목 위치와 원인

- 위치: DB(행 단위 RLS 판정). 앱·네트워크는 이번에 재지 않았다.
- 원인: 공유 상대가 읽는 행마다 조건 ①이 거짓 → `is_event_participant`(②, 정의자 함수, `event_participants` 조회 1회) → ③ `carbook_category_id`(싼 `md5`) + `is_carbook_linked_event`(정의자 함수, 인덱스 2개 조회). 정의자 함수는 SQL 안으로 풀어 넣을 수 없어 행마다 호출된다. 두 `event_id` 인덱스(부분 인덱스)는 있어 조회 자체는 인덱스를 탄다.
- 기존에도 `events_select_shared`(`is_share_partner`)와 `events_select_participant`(`is_event_participant`)가 행마다 돈다. 이번 정책은 거기에 행당 함수 호출 약 2회를 더한다.

### 개선안 (필수 아님)

| 안 | 효과 | 비용 |
|---|---|---|
| 조건 순서를 ③ → ②로 바꾸기(`or`는 앞에서부터 평가) | 일반 일정은 ③이 참이라 ②를 건너뜀. 함수 호출 행당 2회 → 1회. 측정에서 2,004건 57/90/97 → 31/61/76ms, 5,000건 138/335/339 → 363/209/251ms로 **2,004건은 3회 모두 줄었으나 5,000건은 엇갈려(첫 회 늘고 나머지 줄어듦) 효과를 확정하지 못함** | SQL 한 줄 순서 변경, 의미 변화 없음(OR 항 순서만). Database Engineer 소관 |
| 앱이 날짜 범위로 조회 | 읽는 행 수 자체가 줄어 함수 호출도 비례 감소 | 앱 변경(`listEvents`), 이번 티켓 범위 밖 |
| 숨김 판정을 `events` 열로 저장(비정규화) | 함수 호출 0 | 스키마·ADR-005 변경, 과함 |

지금 규모에서는 개선이 꼭 필요하지 않다. 위 첫 안은 값싸니 Database Engineer가 원하면 적용을 검토할 만하다(적용 시 `docs/db.md` 7장 검증을 다시 돌려야 한다).

### 한계 (이 판정이 보장하지 않는 것)

- PGlite 한 프로세스 안의 측정이다. 실제 Supabase(PostgREST + 네트워크 + 동시 접속)의 시간은 재지 않았다.
- 일정 수 기준 NFR이 없어 "몇 건까지"의 합격선은 이 보고서의 가정(공유 상대에게 보이는 일정 약 5,000건 이하)이다. NFR-10은 차계부 데이터량만 정한다. 일정이 10,000건 이상이면 기준선만으로도 300ms, 정책 포함 600ms로 500ms를 넘는다(PGlite 기준, 네이티브는 더 빠를 것).
- PostgREST Max Rows(기본 1,000)와 `event_participants` 임베드 조인 비용은 재지 않았다.
- 공유 상대가 여럿(A 외 파트너가 더 있는 경우)인 상황은 측정하지 않았다.

### 후속: MPR-43 이후 SQL로 재측정 (2026-11-08)

- 요청: Delivery Manager (conv-df6c67). `mpr-18-bench.mjs`의 재배열 정책 식을 `is_carbook_linked_event(id, user_id)` 2인자 형태로 갱신했다. 대상 SQL은 커밋 `439ef6c`의 `schema_carbook.sql`(나머지 4개 SQL은 `b7b60b3`과 동일).
- 실행: `node mpr-18-bench.mjs 2004,5000` → 오류 없이 끝남. B 전체 조회 DB 시간(ms, 3라운드):

| A 일정 수 | 현재 정책 | 재배열 | 기준선 |
|---|---|---|---|
| 2,004 | 189, 235, 213 | 136, 196, 191 | 83, 76, 77 |
| 5,000 | 370, 364, 210 | 506, 181, 145 | 64, 92, 62 |

- 해석: 이번 실행은 PC가 느린 상태였고(기준선 자체가 전보다 큼) 편차도 크다. 정책 포함 값은 2,004건 약 190~235ms, 5,000건 약 210~370ms로 500ms 아래라 MEETS 판정은 유지한다. 정책 포함/기준선 비율은 약 2.5~3배로 이전(약 2배)보다 높아 보이나, 편차 안이라 MPR-43이 비용을 키웠다고 단정하지 못한다. 재배열 효과는 이번에도 확정하지 못했다(5,000건 첫 라운드는 오히려 느림).
- 참고: 스크립트는 `sql/` 폴더에 SQL이 있어야 돈다(`git show 439ef6c:supabase/…`로 내려받기).

## MPR-28 — 열 때 점검(reconcile)·저장 후 syncLinked의 조회 왕복 (2026-11-08)

- 요청: Code Reviewer (conv-6f4c01). 대상: `feat/mpr-28` 커밋 `1f411e2`, `src/carbook/state/useCarbook.ts`, `src/carbook/data/calendarLink.ts`.
- 판정: **MEETS** (병합을 막는 문제 없음). 선택 개선 1건을 아래에 제안한다.
- 기준: NFR-02(`/car` 열기→기록 목록 2초 p95), NFR-03(저장→목록 반영 1초 p95), NFR-10(차량 10대·항목 30·만기일 3 → 연결 행 최대 330), NFR-11(조회 묶음 100개), 기본값 에러율 1% 미만.

### 방법 (코드로 요청 수를 세고, DB 시간만 측정)

실제 Supabase·브라우저 네트워크는 재지 않았다. 요청 수는 코드에서 센 값이고, DB 시간은 PGlite에서 2,004건 데이터로 `fetchEvents`와 같은 모양(`select id,title,start_at,category_id … where user_id=… and id in (100개)`)을 소유자 본인으로 40회 실행한 `EXPLAIN ANALYZE`다(`docs/perf/mpr-28-fetch-bench.mjs`). 왕복 시간(RTT)은 측정하지 않았고 "Fast 4G에서 대략 100~200ms"는 가정이다.

### 요청 수

| 상황 | 요청 | 화면을 막는가 |
|---|---|---|
| `/car` 열 때(`reconcile`) | `fetchEvents` 100개씩 분할 순차 → 묶음 수 = ceil(행수/100): 수십 건이면 **1건**, 최대 330행이면 4건. `ensureCategoryId` RPC는 앱 수명 1회 캐시. 카테고리가 다른 행이 있을 때만 `rebindCategory`, 일정이 지워진 행만 upsert, 뭔가 썼을 때만 캘린더 `reload` 1회 | 아니오. `loadState`·`recordsState`가 끝난 뒤 `void`로 뒤에서 실행(`useCarbook.ts` 마지막 `useEffect`) |
| 기록 저장·삭제 후 `syncLinked` | 그 차량의 연결 행(최대 33) `fetchEvents` **1건** + (주행거리 빈 항목이 있을 때) `fillItems` RPC 1건 + **바뀐 행만** upsert/delete + 쓴 게 있을 때 `reload` 1회. 이미 가져온 일정을 `applyEvent`에 넘기므로 행마다 재조회는 없다 | 부분적. 목록은 `setRecs`로 서버 응답 직후 먼저 갱신되지만, `saveRecord`가 돌려주는 약속은 `syncLinked`까지 끝나야 풀린다(`run` 안에서 `await`) |

### 숫자

- `fetchEvents` 100개 조회의 DB 실행 시간: 중앙값 **4.6ms**, p95 30.9ms (PGlite, Bitmap Heap Scan으로 기본키 사용). DB는 병목이 아니고, 비용은 왕복 횟수 × RTT다.
- 추정(가정 RTT 100~200ms): 열 때 점검은 수십 건 규모에서 요청 1건 ≈ 0.1~0.2초(뒤에서). 저장 후 점검은 저장 요청에 요청 1건이 더해져 약 0.1~0.2초(+주행거리 보정 RPC가 있으면 한 번 더).

### 발견

1. **문제 없음(수십 건 규모)**: 열 때 점검은 화면을 막지 않고 요청 1건이다. 저장 후 요청 1건 추가는 NFR-03(1초)에 들어간다. 단, NFR-03 측정은 목록 반영이 기준이면 `setRecs` 시점이라 영향이 없고, 저장 버튼이 풀리는 시점이 기준이면 이 1건(+선택적 RPC·`reload`)이 더해진다. 후자는 이번에 재지 않았다.
2. **재조회 반복(최악 규모에서만 의미)**: `checked`에 담기는 행은 `spec !== undefined`인 행뿐이다. 선택하지 않은 차량의 "주행거리 기반 항목"은 기록을 못 읽어 `spec`이 `undefined`라 점검 완료로 치지 않는다. 그 행들은 `selectedId`가 바뀔 때마다 `entries`에 다시 들어가 같은 `fetchEvents`가 반복된다(`useCarbook.ts:311-321`). 규모가 최대(차량 10대, 항목 330행)면 차량을 바꿀 때마다 최대 4건 순차 ≈ 0.4~0.8초(가정 RTT), 뒤에서 도는 비차단이다. 수십 건이면 1건이라 의미가 작다.

### 개선안 (필수 아님, 효과와 비용)

| 안 | 효과 | 비용 |
|---|---|---|
| A. 카테고리 재묶기 확인(`found`→`stray`)은 행마다 한 번만 하도록 따로 `checked`에 기록하고, `spec`이 `undefined`인 행은 그 차량의 기록이 읽힌 뒤에만 다시 조회 | 차량 전환마다 반복되는 `fetchEvents` 제거(최대 4건→0~1건) | `useCarbook.ts` 약 10줄. 재묶기 판단을 늦추면 안 되므로 테스트 추가 필요 |
| B. `saveRecord` 반환을 `syncLinked` 앞에서 풀기(점검은 뒤에서) | 저장 버튼 해제가 요청 1건만큼 빨라짐 | 실패 표시 타이밍 변화, 테스트(`useCarbook.link.test.tsx`) 영향 |

제안: 지금 규모에서는 개선 티켓이 필요 없다. 연결 행이 100개를 넘는 사용자가 생기면 A를 P3 티켓으로 올린다.

### 한계

- RTT·실제 Supabase(PostgREST)·브라우저 시간을 재지 않았다. 위 초 단위 값은 가정 RTT를 곱한 추정이다.
- 발견 2는 코드 읽기로 확인했고 실행으로 재현하지 않았다.
- 캘린더 `reload`(`listEvents` 전체 조회와 임베드 조인)의 비용은 MPR-18 절의 DB 시간만 있고 화면 반영 시간은 재지 않았다.
