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
| `car_maintenance_items` | `name` text 1~30 · `interval_km` integer 1~999,999 · `interval_months` integer 1~600 · `last_date` date ≥1990-01-01(v0.2부터 null 허용, 8장) · `last_odometer_km` integer 0~9,999,999 · `event_id` uuid(FK 없음, ADR-003) · **check: interval_km 또는 interval_months 중 하나 이상** |
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

## 6. 운영 적용 순서와 확인 (DevOps/Release)

운영 적용은 Michael 승인과 백업 뒤에 SQL Editor(슈퍼유저)에서 한다. 아래 순서를 지킨다. 각 단계의 기대 결과가 아니면 다음 단계로 가지 않는다.

1. **백업.** 적용 전 데이터베이스 백업(또는 복원 지점)을 만든다.
2. **기존 테이블·함수 확인.** `schema_carbook.sql`은 기존 SQL이 만든 것에 기대므로 먼저 있는지 본다. 결과는 5개 테이블과 2개 함수가 모두 나와야 한다.
   ```sql
   select (select count(*) from pg_tables where schemaname = 'public'
             and tablename in ('categories', 'events', 'calendar_shares', 'calendar_share_members', 'event_participants')) as tables_5,
          (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('is_share_partner', 'is_event_participant')) as functions_2;
   ```
   기대: `tables_5 = 5`, `functions_2 = 2`.
3. **(선택) 적용 전 선점 점검 — 함수 없이 쓸 수 있는 쿼리.** 고정 id 식을 직접 계산한다. 새 정책(MPR-42)은 새 쓰기만 막으므로, 이미 남이 만들어 둔 행이 있는지 미리 본다. 기대: 0행.
   ```sql
   select c.id, c.user_id
     from public.categories c
    where c.id in (select md5('carbook-category:' || u.id::text)::uuid from auth.users u)
      and c.id <> md5('carbook-category:' || c.user_id::text)::uuid;
   ```
   (모의 환경에서 정상 데이터 0행, 선점 데이터 1행을 확인했다.)
4. **`supabase/schema_carbook.sql` 실행.** 파일 전체를 한 번 실행한다. 재실행해도 안전하다.
5. **적용 직후 선점 점검 — 함수 사용.** 3단계와 같은 뜻이며 4단계가 만든 함수를 쓴다. 기대: 0행. 행이 나오면 수동 정리가 필요하다(Michael 승인 뒤).
   ```sql
   select c.id, c.user_id
     from public.categories c
    where public.is_carbook_category_id(c.id) and c.id <> public.carbook_category_id(c.user_id);
   ```
6. **개수·권한 확인.** 기대: 테이블 4, 차계부 정책 20(테이블 정책 16 + `events_select_hide_carbook`·`categories_select_hide_carbook`·`categories_write_guard_carbook_id`·`categories_update_guard_carbook_id`), 함수 4(`carbook_category_id`·`ensure_carbook_category`·`is_carbook_linked_event`(2인자)·`is_carbook_category_id`), `is_carbook_linked_event`는 1개(옛 1인자 함수 없음), 함수 실행 권한은 `authenticated`만.
   ```sql
   select (select count(*) from pg_tables where schemaname = 'public'
             and tablename in ('vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates')) as tables_4,
          (select count(*) from pg_policies where schemaname = 'public'
             and (tablename in ('vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates')
                  or policyname like '%carbook%')) as policies_20,
          (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in
              ('carbook_category_id', 'ensure_carbook_category', 'is_carbook_linked_event', 'is_carbook_category_id')) as functions_4,
          (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'is_carbook_linked_event') as linked_fn_1,
          (select string_agg(distinct grantee, ',') from information_schema.routine_privileges
            where routine_schema = 'public' and grantee in ('anon', 'PUBLIC')
              and routine_name in ('carbook_category_id', 'ensure_carbook_category', 'is_carbook_linked_event', 'is_carbook_category_id')) as exec_for_anon_public;
   ```
   기대: `tables_4 = 4`, `policies_20 = 20`, `functions_4 = 4`, `linked_fn_1 = 1`, `exec_for_anon_public`은 비어 있음(null).
7. **Redirect URL 확인(DevOps, A-2).** Supabase 인증 허용 Redirect URL에 `/car` 주소가 등록돼 있는지 확인한다.

추가 확인과 참고:

- 실제 프로젝트에서 `anon` 조회 0행·쓰기 거부, 두 계정 RLS 거부 케이스를 한 번 더 실행해 확인한다(검증은 모의 환경에서만 했음).
- 테이블 권한(grant)은 Supabase 기본값(`authenticated`에 public 스키마 DML)에 의존한다. 기본값이 꺼진 프로젝트라면 `grant select, insert, update, delete … to authenticated`가 필요하다.
- PostgREST Max Rows(기본 1,000)는 계약 8장 1에 따라 클라이언트가 `.range()`로 이어 읽는다.

## 7. '차계부' 카테고리 함수와 공유 상대 숨김 (MPR-18, ADR-004·005)

같은 파일 `supabase/schema_carbook.sql` 뒤쪽. **기존 `supabase/*.sql`을 먼저 실행해야 한다**(`events`·`categories`·`is_event_participant`·`is_share_partner` 필요). 기존 파일은 0줄 변경(AC-16-5).

| 이름 | 종류 | 내용 |
|---|---|---|
| `carbook_category_id(p_user uuid)` | `immutable` SQL 함수 | `md5('carbook-category:' \|\| p_user)::uuid` — 사용자별 고정 id |
| `ensure_carbook_category()` | `security invoker` plpgsql, 반환 `uuid` | `auth.uid()`가 null이면 `28000`. 고정 id로 `categories`에 `insert … on conflict (id) do nothing`('차계부', `#0f9d58`) 후 id 반환. 이미 있으면 이름·색을 건드리지 않고, 지웠으면 같은 id로 다시 만든다 |
| `is_carbook_linked_event(p_event_id uuid, p_owner uuid)` | `stable` `security definer`, `search_path = public` (MPR-43에서 2인자로 변경) | `car_maintenance_items` 또는 `car_due_dates`에 `event_id = p_event_id` **and `user_id = p_owner`**인 행이 있으면 참 — 일정 소유자 본인의 차계부 연결만 본다. 공유 상대는 소유자 차계부 테이블을 못 읽어 정의자 권한 필요. 옛 1인자 함수는 `drop function if exists`로 제거 |
| `events_select_hide_carbook` | `RESTRICTIVE` select 정책(`events`) | 통과: ① `auth.uid() = user_id` ② `is_event_participant(id, false)` ③ `coalesce(category_id <> carbook_category_id(user_id), true)` 이면서 `not is_carbook_linked_event(id, user_id)` |
| `categories_select_hide_carbook` | `RESTRICTIVE` select 정책(`categories`) | 통과: `auth.uid() = user_id` 또는 `id <> carbook_category_id(user_id)` |
| `is_carbook_category_id(p_id uuid)` | `stable` `security definer`, `search_path = public` (MPR-42) | `auth.users`의 어느 사용자라도 `carbook_category_id(그 사용자) = p_id`이면 참. `authenticated`만 실행 |
| `categories_write_guard_carbook_id` / `categories_update_guard_carbook_id` | `RESTRICTIVE` insert / update 정책(`categories`, MPR-42) | `with check (id = carbook_category_id(user_id) or not is_carbook_category_id(id))` — 남의 차계부 고정 id를 자기 행으로 넣거나 바꾸지 못함(`42501`). 내 고정 id와 일반 카테고리는 통과. 정책 이름은 insert·update가 같은 테이블에서 겹칠 수 없어 둘로 나눔 |

- 실행 권한: 함수 3개 모두 `public`·`anon` 회수, `authenticated`만 허용 (모의 환경에서 `information_schema.routine_privileges` 조회 결과 `authenticated` 하나).
- `category_id`가 null이면 `<>`가 null이 되므로 `coalesce(…, true)`로 "숨김 아님" 처리하고, 연결 일정은 id로 따로 걸러낸다(AC-16-6). 정책 이름은 `drop policy if exists` 후 `create`라 재실행해도 안전하다.
- 알려진 한계 1 (**ADR-005 수용**, Software Architect 결정 2026-11-06, Product Owner 확인 요청됨): 직접 만든 일정(연결 안 됨)은 '차계부' **카테고리에 속해 있을 때만** 숨는다. 사용자가 카테고리를 지우면 분류가 풀려(`on delete set null`) 그 일정은 일반 일정과 구별할 수 없어 공유 상대에게 보인다(연결 일정은 계속 숨음, AC-16-6). 다시 만든 카테고리에 사용자가 직접 다시 넣어야 숨는다. ADR-005 설계 그대로이며 새 테이블 없이는 막을 수 없다. 사용자가 모르는 채 개인정보가 보일 수 있는 경로라 Architect가 수용으로 결정했다(요구 해석이라 Product Owner 확인 요청 중).
- 알려진 한계 2 (**MPR-42로 해결**, ADR-004 '보완' 절): 공유 상대 B가 A의 uuid(`events`·`categories`의 `user_id`로 이미 알 수 있음)로 A의 고정 id 카테고리를 먼저 만들던 문제는 위 insert·update 정책으로 막았다. `ensure_carbook_category()`는 그 id 행의 `user_id`가 `auth.uid()`가 아니면(정책 적용 전 데이터 등) `42501`로 실패한다. 남은 비용: 카테고리 insert·update마다 `auth.users` 행 수만큼 md5 계산(소수 사용자 규모라 허용). 이미 선점된 행이 운영에 있다면 정책은 새 쓰기만 막으므로 그 행은 수동 정리가 필요하다(운영 DB는 열람하지 않음).
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

### 7.2 고정 id 선점 방지 검증 (MPR-42, 2026-11-06)

방법은 7.1과 같다(PGlite). 같은 스크립트에 10건을 더해 총 42건 `PASS`, `FAIL` 0건(7.1의 기존 32건 포함, 되돌리기·재적용 기대값은 정책 4·함수 4·테이블 4로 갱신).

| 질의 (A=소유자, B=공유 상대) | 결과 |
|---|---|
| B: `insert into categories(id=A의 고정 id, user_id=B)` | `42501` (정책 `categories_write_guard_carbook_id`) |
| B: 같은 id에 `user_id=A`로 insert | `42501` |
| B: 일반 카테고리 추가, 이름 수정 | 성공 |
| B: 자기 카테고리의 id를 A의 고정 id로 update | `42501` (정책 `categories_update_guard_carbook_id`) |
| B: 자기 고정 id(`carbook_category_id(B)`)로 insert | 성공 |
| A: `ensure_carbook_category()` | 성공, 같은 id, 행 소유자 A |
| 정책 전 데이터로 B가 A의 고정 id를 선점한 상태(슈퍼유저로 삽입)에서 A의 `ensure` | `42501 carbook category id is taken` (조용히 넘기지 않음) |
| `is_carbook_category_id` 실행 권한 | `authenticated`만 |
| `-- DOWN:` 실행 → 정책·함수·테이블 0개, 재적용 → 4/4/4 | OK |

### 7.3 남의 `event_id`로 일정 숨기기 차단 (MPR-43, ADR-005 보완, 2026-11-08)

위험(Security Reviewer Low-1): `event_id`는 FK·소유 확인이 없어, 사용자 B가 자기 교체 항목·만기일의 `event_id`에 A의 일반 일정 id를 넣으면 옛 판정 함수가 참이 되어 그 일정이 A의 다른 공유 상대 C에게 숨었다(읽기 유출은 아니고 가시성 방해). 판정 함수가 일정 소유자의 행만 보게 바꿔 막았다. 클라이언트·쓰기 경로 변경 없음.

방법은 7.1과 같다(PGlite). 같은 스크립트에 7건을 더해 총 49건 `PASS`, `FAIL` 0건(기존 MPR-17·18·42 검사 42건 포함). **대조 실험**: 같은 스크립트를 MPR-43 이전 SQL(커밋 `9e67ede`)로 돌리면 아래 첫 두 검사와 함수 시그니처 검사 3건이 `FAIL`(C가 A의 일정을 못 봄)이라, 검사가 이 결함을 잡는다.

사용자: A=일정 소유자, B·C=A의 공유 상대, B는 자기 차량·항목·만기일의 `event_id`에 A의 일반 일정 id(norm, nocat)를 넣음.

| 질의 | 결과 |
|---|---|
| C: `select id from events where id in (norm, nocat)` (AC-16-3) | 2건 모두 보임 (옛 함수에서는 0건) |
| B, A 본인: 같은 질의 | 2건 모두 보임 |
| B·C: A의 진짜 연결 일정(만기일 연결 due, 항목 연결 orphan) (AC-16-1) | 0건 |
| B·C: A의 '차계부' 카테고리에 직접 만든 일정 / A | 0건 / 보임 (AC-16-7) |
| `pg_proc`의 `is_carbook_linked_event` | `(p_event_id uuid, p_owner uuid)` 하나만 존재 |
| 실행 권한 | `authenticated`만 |
| `-- DOWN:` 실행 → 정책 0·함수 0·테이블 0, 재적용 | 정책 4·함수 4·테이블 4 |

남은 상태: B 행의 `event_id`가 남의 일정을 가리키는 고아 연결이 되며, 그 사용자의 열 때 점검에서 같은 id로 upsert하면 남의 행과 충돌해 실패(MSG-11)한다. 악의적 입력에만 생기는 상태로 ADR-005 보완에서 수용했다.

## 8. v0.2 마이그레이션: 기본 차량 `car_settings`와 `last_date` 해제 (MPR-62, ADR-007·009)

파일: `supabase/schema_carbook_v02.sql`(UP), `supabase/schema_carbook_v02_down.sql`(DOWN). `schema_carbook.sql` 실행 뒤에 실행한다. 새 파일만 쓰고 기존 `supabase/*.sql`과 기존 행은 바꾸지 않는다(PRD R-24). 재실행해도 안전하다(`if not exists`, `drop policy if exists`, 이미 해제된 `drop not null`은 오류 없이 지나감).

### 8.1 바뀌는 것

| 대상 | 내용 |
|---|---|
| 새 테이블 `car_settings` | `user_id uuid pk default auth.uid() references auth.users on delete cascade` · `default_vehicle_id uuid references vehicles(id) on delete set null` · `updated_at timestamptz not null default now()`. 사용자당 1행 |
| 인덱스 | `car_settings_default_vehicle_id_idx (default_vehicle_id) where default_vehicle_id is not null` — 차량 삭제 때 `set null` 대상 찾기(외래키 인덱스). `user_id`는 pk가 겸함 |
| RLS 정책 4개 | `car_settings_select_own`·`_insert_own`·`_update_own`·`_delete_own`, 모두 `to authenticated`, `(select auth.uid()) = user_id`. insert·update `with check`에 `default_vehicle_id is null or 본인 차량`(AC-19-9) |
| `car_maintenance_items.last_date` | `not null` 해제. `>= 1990-01-01` check는 그대로(null이면 check는 통과, 값이 있으면 검사). 미입력 항목(ADR-009, AC-24-5) |

- 클라이언트는 `upsert({ default_vehicle_id }, { onConflict: 'user_id' })`로 쓴다. `user_id`를 보내지 않으면 기본값 `auth.uid()`가 채워지며 PGlite로 확인했다.
- `updated_at`은 기본값만 있고 갱신 트리거는 없다(새 함수는 R-24 범위 밖). 최신 시각이 필요하면 클라이언트가 upsert에 `updated_at`을 보낸다. 지금 화면은 이 열을 읽지 않는다.
- 차량 삭제 때 `set null`은 외래키 동작이라 RLS에 막히지 않는다. 설정 행은 남고 `default_vehicle_id`만 null이 된다(AC-19-5).
- 정책은 `vehicles` 행이 보이는지가 아니라 `vehicles.user_id`를 직접 비교한다. 남의 차량 id는 존재 여부와 무관하게 `42501`로 거부된다(존재 여부를 오류로 구분하지 않는다).

### 8.2 검증 결과 (2026-11-24)

방법은 7.1과 같다(PGlite 모의 환경, 실제 Supabase 아님). `supabase/schema_carbook.test.ts`에 16건을 더했다. 명령 `vitest run supabase/schema_carbook.test.ts` 결과 37건 통과, 실패 0건(기존 21건 포함).

| 구분 | 확인 | 결과 |
|---|---|---|
| 적용 | v0.2 적용 전부터 있던 정비 항목 행의 `xmin`과 전체 열이 적용 뒤에도 같음(UPDATE 0건), UP 두 번 적용 | 통과 |
| 설정 쓰기 | A가 `user_id` 없이 upsert → `user_id`=A. 같은 upsert 반복 시 행 1개 유지, null 해제 | 통과 |
| 거부 | 남의 차량 id 지정(upsert=update 경로, 새 행 insert 경로, 직접 update) `42501`, B가 `user_id`=A로 insert `42501` | 통과 |
| 격리 | B가 A 설정 읽기 0행·수정 0행·삭제 0행, 로그인 없음 0행, anon `42501` | 통과 |
| 삭제 | 기본 차량 삭제 → 설정 행 유지, `default_vehicle_id` null(AC-19-5) | 통과 |
| `last_date` | null로 insert 허용(AC-24-5), 1990 이전 날짜는 `23514` | 통과 |
| 되돌리기 upsert | 이름·주기만 보내도 기존 행의 `event_id`·`last_date`·`last_odometer_km`·`created_at` 그대로, 이미 미입력인 행도 `23502` 없이 갱신(ADR-009) | 통과 |
| DOWN | 미입력 행이 있으면 `23502`로 전체 취소(`car_settings`도 남음), 행을 채운 뒤 DOWN → 테이블 없음·`last_date` not null, UP 재적용 시 정책 4개 | 통과 |

**대조 실험.** 검사가 결함을 잡는지 확인하려고 UP을 일부러 고쳐 돌렸다. `drop not null` 줄을 빼면 4건이 실패하고(`last_date` null insert, 되돌리기 upsert 2건, DOWN 취소 확인), 정책의 본인 차량 확인을 빼면 남의 차량 지정 거부 1건이 실패한다. 원래 파일로 되돌린 뒤 전체 통과를 다시 확인했다.

**EXPLAIN ANALYZE** (사용자 2,001명·차량 4,002대·설정 2,000행, `analyze` 뒤, RLS 적용 역할):

| 질의 | 계획 | 실행 시간 |
|---|---|---|
| `select default_vehicle_id from car_settings`(첫 로드 읽기) | `Index Scan using car_settings_pkey` | 0.17ms |
| `insert … on conflict (user_id) do update`(기본 차량 쓰기) | pk로 충돌 판정, 정책의 차량 확인은 `vehicles_pkey` Index Scan | 0.72ms |
| 차량 삭제 때 `set null` 대상 찾기 | `Index Scan using car_settings_default_vehicle_id_idx` | — |

Seq Scan 없음.

### 8.3 되돌리기 (DOWN) 순서

DOWN은 `begin … commit` 한 묶음이다. `last_date set not null`이 실패하면 `car_settings` 삭제도 함께 취소된다. 이 파일은 행을 지우거나 채우지 않는다.

1. 미입력 행이 있는지 센다. `select count(*) from public.car_maintenance_items where last_date is null;`
2. 0이 아니면 **DOWN을 실행하지 않는다.** 그 행(추천 항목 중 마지막 교체일이 없는 것)을 사용자에게 알리고, 사용자가 날짜를 채우거나 항목을 지우기로 정한 뒤에만 진행한다(데이터 삭제·변경은 Michael 승인).
3. 0이면 `schema_carbook_v02_down.sql`을 실행한다. `car_settings`의 기본 차량 지정이 사라진다(첫 차량이 대신 기본이 된다, BR-43).

### 8.4 운영 적용 순서 (사용자가 직접, 실행 직전 god 재승인)

이 티켓은 파일 작성과 모의 환경 검증까지다. 운영에는 접속하지 않았다.

1. **사전 확인.** 6장 2단계 쿼리와 `select to_regclass('public.vehicles'), to_regclass('public.car_maintenance_items');`가 둘 다 값을 돌려준다(차계부 v0.1이 적용돼 있다).
2. **백업.** 운영은 무료 플랜이라 자동 백업이 없다(2026-11-18 기록). 이 마이그레이션은 제약 해제와 새 테이블 추가뿐이고 데이터를 바꾸지 않아 위험이 낮지만, 필요하면 `car_maintenance_items`를 먼저 내보낸다.
3. **`schema_carbook_v02.sql` 전체를 SQL Editor에서 한 번 실행한다.**
4. **확인.** 기대: `car_settings` 1개, 정책 4개, `last_date` 허용.
   ```sql
   select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'car_settings') as settings_1,
          (select count(*) from pg_policies where schemaname = 'public' and tablename = 'car_settings') as policies_4,
          (select is_nullable from information_schema.columns
            where table_schema = 'public' and table_name = 'car_maintenance_items' and column_name = 'last_date') as last_date_nullable;
   ```
   기대: `settings_1 = 1`, `policies_4 = 4`, `last_date_nullable = 'YES'`.
5. 실제 계정으로 기본 차량 지정·해제, 남의 차량 id 거부(2계정)를 한 번 확인한다(검증은 모의 환경에서만 했음). `anon`은 모의 환경에서 `42501`이었지만, 실제 Supabase는 기본 권한 때문에 `anon`이 0행(RLS)으로 나올 수 있다. 거부 또는 0행이면 정상이다(읽기 불가).

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-06 | 최초 작성: 테이블 4개·RLS·제약·인덱스 | MPR-17 | Delivery Manager | Backend(MPR-24), MPR-18이 같은 파일에 이어서 추가 |
| 2026-11-06 | `vehicles.year` 하한 1950, anon·공백 문구 정정 | MPR-17 리뷰(Code Reviewer) | Code Reviewer | 없음 |
| 2026-11-06 | 7장 추가: 카테고리 함수 3개·RESTRICTIVE 정책 2개와 A·B 질의 결과 | MPR-18 | Delivery Manager | Backend(MPR-25 `ensure_carbook_category` 호출), 공유 상대 화면 |
| 2026-11-06 | 7장: 고정 id 선점 방지(함수 1·정책 2)와 ensure 소유자 확인, 7.2 검증 | MPR-42(ADR-004 보완) | Delivery Manager | Backend(MPR-25 ensure 오류 `42501` 처리 가능) |
| 2026-11-08 | 7장: `is_carbook_linked_event`를 일정 소유자 행만 보는 2인자로 변경, 7.3 검증 | MPR-43(ADR-005 보완, Security Low-1) | Delivery Manager | 클라이언트 변경 없음 |
| 2026-11-18 | 6장을 운영 적용 순서(백업 → 기존 테이블 확인 → 적용 → 선점 점검 → 개수·권한 확인 → Redirect URL)로 재정리, 함수 없이 쓰는 사전 점검 쿼리 추가 | MPR-48 DevOps 요청(적용 전에는 `is_carbook_category_id`가 없어 점검 쿼리가 실패) | DevOps Engineer | 운영 적용 절차만, SQL 변경 없음 |
| 2026-11-18 | **운영 Supabase에 `schema_carbook.sql` 적용**(사용자가 대시보드 SQL Editor에서 직접 실행, 6장 순서), Auth Redirect URL에 `/car` 추가. **백업 없음(무료 플랜)이라 되돌리기는 5장 DOWN**(차계부 4개 테이블만 삭제, 기존 테이블은 건드리지 않음, Michael 승인 필요). 점검(사용자 보고): 2단계 기존 테이블·함수 확인 통과, **4단계 tables 4 · policies 20, 5단계 선점 점검 0행**, 6단계 Redirect URL 완료. **운영 anon 거부·두 계정 RLS 거부는 미확인**(QA가 운영 앱에서 두 계정으로 확인 예정). DevOps는 운영 DB에 접속하지 않았고 위 결과는 사용자 보고 기준 | MPR-48(Michael 승인 2026-11-18, 조건 '백업 먼저'는 무료 플랜이라 백업 없이 진행됨) | God(사용자 승인) | 운영에 차계부 테이블 4개·정책 20개 확인(함수 개수는 미확인). 운영 앱의 차계부 화면(`/car`) 사용 가능 |
| 2026-11-24 | 8장 추가: v0.2 마이그레이션(`car_settings` 테이블·정책 4개·인덱스 1개, `car_maintenance_items.last_date` not null 해제), 검증·EXPLAIN·DOWN 순서·운영 적용 순서. 1장 `last_date` 열은 8장 참조 | MPR-62(F-19·F-24, ADR-007·009) | Delivery Manager | Backend(MPR-63~65 `getSettings`·`setDefaultVehicle`·`resetItemCycles`), 운영 적용은 사용자가 직접(god 재승인) |
