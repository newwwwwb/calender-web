# 차계부 데이터베이스 (docs/db.md)

- 날짜: 2026-11-06 · 소유자: Database Engineer · 티켓: MPR-17 (MPR-18이 함수·RESTRICTIVE 정책을 이 문서에 이어서 추가)
- 근거: [02_architecture.md](02_architecture.md) 7장, [api/carbook.md](api/carbook.md) 2·8.1장
- 파일: `supabase/schema_carbook.sql` (schema.sql 실행 뒤 실행. 재실행 안전: `create … if not exists`, `drop policy if exists`)

## 1. 테이블

공통: `id uuid pk default gen_random_uuid()`(클라이언트가 보내면 그 값), `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at timestamptz not null default now()`(클라이언트 값 허용). 딸린 3개는 `vehicle_id uuid not null references vehicles on delete cascade`.

| 테이블 | 열 (제약) |
|---|---|
| `vehicles` | `name` text 1~20자 · `model` text ≤30 · `year` integer · `plate` text ≤15 · `odometer_km` integer 0~9,999,999 |
| `car_records` | `kind` ∈ fuel·maintenance·wash·insurance·tax·parking·other · `date` date ≥1990-01-01 · `amount_won` integer 0~999,999,999 · `odometer_km` integer 0~9,999,999 · `liters` numeric(6,2) ≥0 · `full_tank` boolean default false · `memo` text ≤200 · **check: kind≠fuel이면 liters null, full_tank false (BR-10)** |
| `car_maintenance_items` | `name` text 1~30 · `interval_km` integer 1~999,999 · `interval_months` integer 1~600 · `last_date` date ≥1990-01-01 · `last_odometer_km` integer 0~9,999,999 · `event_id` uuid(FK 없음, ADR-003) · **check: interval_km 또는 interval_months 중 하나 이상** |
| `car_due_dates` | `kind` ∈ insurance·car_tax·inspection · `due_date` date ≥1990-01-01 · `event_id` uuid(FK 없음) · **unique (vehicle_id, kind)** → 충돌은 `23505` |

- "오늘 기준" 상한(기록 날짜 오늘+365일, 연식 올해+1 등)은 DB에 두지 않는다(시간에 따라 변하는 값은 check에 부적합). 화면 검사가 담당한다. `year`는 하한 1950만 DB가 막는다(03_spec 1.3, MSG-08).
- 주행거리 감소 경고(MSG-10), MSG-19(km 주기 항목의 마지막 주행거리 누락)는 BR-06a(추천 항목은 null 허용) 때문에 DB 제약으로 하지 않는다.
- 앞뒤 공백 제거(trim)와 "공백만 있으면 빈 값"은 화면 검사가 한다. DB는 공백만 있는 `memo`·`model`·`plate`를 허용한다(의도). `name`은 공백만 있어도 길이 1 이상이면 통과한다.
- 이 파일은 `create table if not exists`라 이미 만들어진 DB에는 제약 변경이 적용되지 않는다. 운영에는 아직 적용 전이므로 `year` 하한은 처음부터 포함했다. 이미 적용한 DB는 `alter table public.vehicles add constraint vehicles_year_check check (year >= 1950);`가 필요하다.

## 2. 인덱스

| 인덱스 | 용도 |
|---|---|
| `vehicles (user_id, created_at)` | user_id 외래키 + 차량 목록(created_at 오름차순) |
| `car_maintenance_items (user_id, created_at)` | user_id 외래키 + 내 전체 항목 읽기 |
| `car_records (user_id)`, `car_due_dates (user_id)` | user_id 외래키 |
| `car_records (vehicle_id, date desc, created_at desc)` | vehicle_id 외래키 + 기록 목록 정렬(BR-09) |
| `car_maintenance_items (vehicle_id)` | vehicle_id 외래키 |
| `car_due_dates (vehicle_id, kind)` unique | vehicle_id 외래키 겸 BR-16 |
| `car_maintenance_items (event_id)`, `car_due_dates (event_id)` — 부분 인덱스 `where event_id is not null` | 연결 일정 조회(ADR-005, MPR-18에서 사용) |

## 3. RLS (행 단위 접근 정책)

4개 테이블 모두 `enable row level security`. 정책은 `to authenticated`, 기준은 `(select auth.uid()) = user_id`(`user_id`는 서버가 채우는 값이고 `user_metadata` 같은 사용자 수정 값은 쓰지 않음). `USING (true)` 없음. 정책 16개 = 4테이블 × select·insert·update·delete.

- select·delete: `using` 본인 행.
- insert: `with check` 본인 행. 딸린 3개는 추가로 `exists (select 1 from vehicles v where v.id = vehicle_id and v.user_id = auth.uid())` → 남의 차량 id로 행을 끼워 넣을 수 없다.
- update: `using` 본인 행 + `with check`(insert와 같은 조건) → `user_id`나 `vehicle_id`를 남의 것으로 바꿀 수 없다.
- `anon` 역할에는 정책이 없다. 모의 환경에서는 grant도 주지 않아 `42501`이었지만, 실제 Supabase는 기본 grant가 `anon`에도 DML을 줄 수 있고, 그 경우 정책이 없어 조회는 0행·쓰기는 `42501`이다(어느 쪽이든 접근 불가). 실제 프로젝트 확인은 6장 항목.

## 4. 검증 결과 (2026-11-06)

방법: 로컬에 Postgres·Docker·Supabase CLI가 없어 일회성 `npx` 대신 임시 폴더에 `@electric-sql/pglite@0.2.17`(WASM Postgres)을 설치해 실행했다(package.json 변경 없음). `auth.users`, `auth.uid()`(= `request.jwt.claim.sub`), `authenticated`·`anon` 역할은 Supabase와 같은 모양으로 직접 만들었다. **실제 Supabase 프로젝트와 PostgREST 경유 호출은 아니다**(운영 DB에는 접속하지 않음). 스크립트: 세션 임시 폴더 `scratchpad/pg/t.mjs`, 결과: 같은 폴더 `result.txt`. 검사 43건 `PASS`(연식 1949 거부 추가), `FAIL` 0건.

| 구분 | 케이스 (모두 실행, 결과 PASS) |
|---|---|
| 빈 DB 적용 | 파일을 두 번 연속 실행 → 오류 없음(재실행 안전). 정책 16개, 테이블 4개 |
| 두 계정 허용 | A가 자기 차량·기록·교체 항목·만기일 추가(user_id 자동 채움, `created_at` 클라이언트 값 `…00:00:00.123+09` 그대로 저장, `liters` 38.45) / A는 자기 행 1건만 조회 |
| 두 계정 거부 | B가 A의 차량 조회 0행 · A의 기록·항목·만기일 조회 0행 · A 차량 update 0행 · delete 0행 · `user_id`를 A로 지정한 insert → `42501` · A 차량에 기록·항목·만기일 insert → `42501` · A가 자기 기록을 B 차량으로 옮기기 → `42501` · A가 `user_id`를 B로 바꾸기 → `42501` · `anon` 조회 → `42501` |
| 제약 | 잘못된 kind, 주유 아닌 기록의 liters·full_tank, 금액 10억, 1989-12-31, liters 10000(`22003`), 차량 별칭 21자·빈 값, 주행거리 10,000,000, 메모 201자, 주기 없는 항목, 개월 601 → 전부 `23514`(또는 `22003`) / 같은 차량·종류 만기일 2번째 → `23505` / 없는 사용자 → `23503` |
| 연쇄 삭제 | 차량 삭제 → 기록·항목·만기일 0건 |
| 되돌리기 | 파일 끝 `-- DOWN:` 줄 실행 → 공개 테이블 0개, 이어서 다시 적용 → 4개 |

EXPLAIN ANALYZE (기록 2,000행, 사용자 A 역할):

| 질의 | 계획 |
|---|---|
| `select id,kind,date,amount_won from car_records where vehicle_id=… order by date desc, created_at desc limit 50` | Index Scan using `car_records_vehicle_date_idx`, 0.245ms, Sort 없음 |
| `select id,name from vehicles order by created_at` | Index Scan using `vehicles_user_created_idx` (`user_id = $0`), 0.017ms |

주의: 행이 거의 없는 테이블은 Postgres가 Seq Scan을 고를 수 있다(행 수가 적어 더 싸기 때문). 위 계획은 2,000행으로 `analyze`한 뒤 확인했다.

## 5. 되돌리기 (down)

```sql
drop table if exists public.car_due_dates, public.car_maintenance_items, public.car_records, public.vehicles;
```
정책·인덱스·제약은 테이블과 함께 사라진다. 차계부 데이터가 모두 지워지는 되돌릴 수 없는 변경이므로 운영에서는 Michael 승인 뒤에만 실행한다.

## 6. 운영 적용 전 확인 (DevOps/Release)

- 이 SQL은 Supabase SQL Editor에서 실행한다(기존 `supabase/*.sql`과 같은 방식). 운영 적용은 이 티켓 범위가 아니다.
- 실제 프로젝트에서 `anon` 조회 0행·쓰기 거부, 두 계정 RLS 거부 케이스를 한 번 더 실행해 확인한다(검증은 모의 환경에서만 했음).
- 테이블 권한(grant)은 Supabase 기본값(`authenticated`에 public 스키마 DML)에 의존한다. 기본값이 꺼진 프로젝트라면 `grant select, insert, update, delete … to authenticated`가 필요하다.
- PostgREST Max Rows(기본 1,000)는 계약 8장 1에 따라 클라이언트가 `.range()`로 이어 읽는다.

## 7. '차계부' 카테고리 함수와 공유 상대 숨김 (MPR-18, ADR-004·005)

같은 파일 `supabase/schema_carbook.sql` 뒤쪽. **기존 `supabase/*.sql`을 먼저 실행해야 한다**(`events`·`categories`·`is_event_participant`·`is_share_partner` 필요). 기존 파일은 0줄 변경(AC-16-5).

| 이름 | 종류 | 내용 |
|---|---|---|
| `carbook_category_id(p_user uuid)` | `immutable` SQL 함수 | `md5('carbook-category:' \|\| p_user)::uuid` — 사용자별 고정 id |
| `ensure_carbook_category()` | `security invoker` plpgsql, 반환 `uuid` | `auth.uid()`가 null이면 `28000`. 고정 id로 `categories`에 `insert … on conflict (id) do nothing`('차계부', `#0f9d58`) 후 id 반환. 이미 있으면 이름·색을 건드리지 않고, 지웠으면 같은 id로 다시 만든다 |
| `is_carbook_linked_event(p_event_id uuid)` | `stable` `security definer`, `search_path = public` | `car_maintenance_items` 또는 `car_due_dates`가 그 `event_id`를 가리키면 참 (공유 상대는 소유자 차계부 테이블을 못 읽어 정의자 권한 필요) |
| `events_select_hide_carbook` | `RESTRICTIVE` select 정책(`events`) | 통과: ① `auth.uid() = user_id` ② `is_event_participant(id, false)` ③ `coalesce(category_id <> carbook_category_id(user_id), true)` 이면서 `not is_carbook_linked_event(id)` |
| `categories_select_hide_carbook` | `RESTRICTIVE` select 정책(`categories`) | 통과: `auth.uid() = user_id` 또는 `id <> carbook_category_id(user_id)` |

- 실행 권한: 함수 3개 모두 `public`·`anon` 회수, `authenticated`만 허용 (모의 환경에서 `information_schema.routine_privileges` 조회 결과 `authenticated` 하나).
- `category_id`가 null이면 `<>`가 null이 되므로 `coalesce(…, true)`로 "숨김 아님" 처리하고, 연결 일정은 id로 따로 걸러낸다(AC-16-6). 정책 이름은 `drop policy if exists` 후 `create`라 재실행해도 안전하다.
- 알려진 한계 1: 직접 만든 일정(연결 안 됨)은 '차계부' **카테고리에 속해 있을 때만** 숨는다. 사용자가 카테고리를 지우면 분류가 풀려(`on delete set null`) 그 일정은 일반 일정과 구별할 수 없어 공유 상대에게 보인다(연결 일정은 계속 숨음, AC-16-6). 다시 만든 카테고리에 사용자가 직접 다시 넣어야 숨는다. ADR-005 설계 그대로이며 새 테이블 없이는 막을 수 없다. 사용자가 모르는 채 개인정보가 보일 수 있는 경로라 수용 여부 확인과 ADR-005 기록을 Software Architect에게 요청했다(Product Owner 확인은 Architect 경유).
- 알려진 한계 2: 카테고리 id는 `user_id`로만 정해지고 `categories.id`는 클라이언트가 정하므로, 공유 상대 B는 A의 `events`·`categories`를 읽으므로 `user_id` 열로 A의 uuid를 이미 안다(비공개 값이 아님). B가 그 id로 자기 카테고리를 먼저 만들면 A의 `ensure`가 `do nothing`으로 끝나 A는 카테고리 행을 갖지 못하고, B가 그 행을 지우면 A의 직접 만든 일정 분류가 풀려 한계 1로 이어진다. 연결 일정·카테고리 비노출은 id 비교 정책이라 유지되므로 기밀성 유출은 아니다. 설계 변경이 필요한 사안이라(예: `categories` insert 전 트리거로 남의 고정 id 거부, 또는 비밀 값을 섞은 id) Software Architect에게 수용 여부를 질의했다(ADR-004 수용 위험 후보).
- 비용: 공유 상대가 `events`를 읽을 때 행마다 판정 함수가 돈다. 모의 환경(일정 2,004건, 소유자 A의 행 전부를 B가 조회)에서 `EXPLAIN ANALYZE`는 `events_user_id_idx` Index Scan, 107ms. 소유자 본인 조회는 조건 ①로 함수를 부르지 않는다(ADR-005가 받아들인 비용).

### 7.1 검증 결과 (2026-11-06)

방법은 4장과 같다(PGlite, 실제 Supabase 아님). 기존 SQL은 `schema.sql`, `schema_share.sql`, `schema_share_mutual.sql`, `schema_together.sql` 순서로 적용했다(`schema_share_fix*.sql`은 PGlite에서 함수 인자명 오류로 제외, 공유 판정 함수 `is_share_partner`는 `schema_share_mutual.sql`이 정의). 스크립트 `scratchpad/pg/t2.mjs`, 결과 `result2.txt`: 검사 32건 `PASS`, `FAIL` 0건. 파일 2회 연속 적용 OK.

사용자: A=소유자, B=공유 상대(`calendar_share_members` 연결), C=A의 차계부 일정에 참여자로 초대됨(공유 상대 아님), D=무관. A의 일정 6건: 일반 카테고리(norm), 만기일 연결+차계부 카테고리(due), 직접 만든 차계부 카테고리(direct), 항목 연결+분류 없음(orphan), 분류 없는 일반(nocat), 차계부 카테고리+C 참여(part).

| AC | 질의 | 결과 |
|---|---|---|
| AC-16-2 | A: `select id from events` / `from categories` | 일정 6건 전부, 카테고리 2개(차계부·업무) |
| AC-16-1 | B: `select id from events` / `from categories` | 일정 2건(norm, nocat), 카테고리 1개(업무). due·차계부 카테고리 없음 |
| AC-16-3 | B: norm | 보임 |
| AC-16-7 | B: direct | 0건 (A는 보임) |
| AC-16-6 | A가 차계부 카테고리 삭제(due·orphan 분류 풀림) → B: due·orphan | 0건. A는 두 일정 모두 보임 |
| AC-16-6 | A가 `ensure_carbook_category()` → 같은 id, 두 일정을 다시 묶음 → B | 0건 유지 |
| AC-08-4 | `ensure_carbook_category()` 결과 = `md5('carbook-category:'‖A)::uuid`, 두 번째 호출도 같은 id | 카테고리 행 1개, 이름·색을 바꿔도 `ensure`가 건드리지 않음 |
| AC-08-13 | 연속 두 번 호출 | 카테고리 1개 (단일 연결 모의 환경이라 진짜 동시 실행은 아님. 같은 PK 충돌은 `on conflict do nothing`이 처리) |
| AC-08-14 | 카테고리 삭제 후 `ensure` | 같은 id로 1개 다시 생성 |
| 참여자 | C: 일정 / 카테고리 | 초대된 일정(part) 1건만 보임(기존 참여 동작 유지), 카테고리 0개 |
| 격리 | D: 일정 / 카테고리 | 0건 / 0건 |
| 권한 | 로그인 안 한 호출 → `28000`, `anon` 실행 → `42501`, 기존 B의 A 일정 update → 0행 | 모두 기대대로 |
| 되돌리기 | `-- DOWN:` 줄 실행 → 정책·함수·테이블 0개, B의 events 조회에서 숨김 해제 → 다시 적용 → 정책 2·함수 3·테이블 4 | OK |

AC-16-4(기존 캘린더·공유 테스트 통과)는 앱 테스트라 이 티켓의 SQL로는 확인하지 않았다. AC-16-5(기존 `supabase/*.sql` 0줄 변경): `git diff main -- supabase/` 에서 `schema_carbook.sql`만 변경됨.

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-06 | 최초 작성: 테이블 4개·RLS·제약·인덱스 | MPR-17 | Delivery Manager | Backend(MPR-24), MPR-18이 같은 파일에 이어서 추가 |
| 2026-11-06 | `vehicles.year` 하한 1950, anon·공백 문구 정정 | MPR-17 리뷰(Code Reviewer) | Code Reviewer | 없음 |
| 2026-11-06 | 7장 추가: 카테고리 함수 3개·RESTRICTIVE 정책 2개와 A·B 질의 결과 | MPR-18 | Delivery Manager | Backend(MPR-25 `ensure_carbook_category` 호출), 공유 상대 화면 |
