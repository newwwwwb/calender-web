-- 차계부 테이블 4개(vehicles·car_records·car_maintenance_items·car_due_dates)와 RLS·제약·인덱스. 재실행해도 안전하다.
-- schema.sql 실행 뒤 이어서 실행하세요. 기존 supabase/*.sql은 건드리지 않는다.
-- 앞은 테이블(MPR-17), 뒤는 카테고리 함수·공유 상대 숨김 정책(MPR-18). 기존 supabase/*.sql 실행 뒤에 실행해야 한다(events·categories·is_event_participant 필요).
-- 되돌리기(down)는 파일 맨 끝 "-- DOWN:" 줄 참고.

-- ───────── vehicles ─────────
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  model text check (char_length(model) <= 30),
  year integer check (year >= 1950), -- 상한(올해+1)은 시간에 따라 변해 화면이 검사
  plate text check (char_length(plate) <= 15),
  odometer_km integer check (odometer_km between 0 and 9999999),
  created_at timestamptz not null default now()
);

-- ───────── car_records ─────────
create table if not exists public.car_records (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null check (kind in ('fuel', 'maintenance', 'wash', 'insurance', 'tax', 'parking', 'other')),
  date date not null check (date >= date '1990-01-01'),
  amount_won integer not null check (amount_won between 0 and 999999999),
  odometer_km integer check (odometer_km between 0 and 9999999),
  liters numeric(6, 2) check (liters >= 0),
  full_tank boolean not null default false,
  memo text check (char_length(memo) <= 200),
  created_at timestamptz not null default now(),
  -- BR-10: 주유가 아니면 주유량 없음, 가득 주유 아님
  check (kind = 'fuel' or (liters is null and full_tank = false))
);

-- ───────── car_maintenance_items ─────────
create table if not exists public.car_maintenance_items (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  interval_km integer check (interval_km between 1 and 999999),
  interval_months integer check (interval_months between 1 and 600),
  last_date date not null check (last_date >= date '1990-01-01'),
  last_odometer_km integer check (last_odometer_km between 0 and 9999999),
  event_id uuid, -- events.id 연결, FK 없음(ADR-003)
  created_at timestamptz not null default now(),
  check (interval_km is not null or interval_months is not null)
);

-- ───────── car_due_dates ─────────
create table if not exists public.car_due_dates (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null check (kind in ('insurance', 'car_tax', 'inspection')),
  due_date date not null check (due_date >= date '1990-01-01'),
  event_id uuid, -- events.id 연결, FK 없음(ADR-003)
  created_at timestamptz not null default now(),
  constraint car_due_dates_vehicle_kind_key unique (vehicle_id, kind) -- BR-16, 충돌은 23505
);

-- ───────── 인덱스 ─────────
-- user_id: 외래키 + "내 전체 행" 읽기(vehicles·items·due_dates는 created_at 오름차순)
create index if not exists vehicles_user_created_idx on public.vehicles (user_id, created_at);
create index if not exists car_records_user_id_idx on public.car_records (user_id);
create index if not exists car_maintenance_items_user_created_idx on public.car_maintenance_items (user_id, created_at);
create index if not exists car_due_dates_user_id_idx on public.car_due_dates (user_id);
-- vehicle_id: 외래키(due_dates는 unique 인덱스가 겸함). records는 BR-09 정렬(날짜·created_at 내림차순)을 겸한다
create index if not exists car_records_vehicle_date_idx on public.car_records (vehicle_id, date desc, created_at desc);
create index if not exists car_maintenance_items_vehicle_id_idx on public.car_maintenance_items (vehicle_id);
-- event_id: 연결된 행만(ADR-005 숨김 판정 조회용)
create index if not exists car_maintenance_items_event_id_idx on public.car_maintenance_items (event_id) where event_id is not null;
create index if not exists car_due_dates_event_id_idx on public.car_due_dates (event_id) where event_id is not null;

-- ───────── RLS ─────────
alter table public.vehicles enable row level security;
alter table public.car_records enable row level security;
alter table public.car_maintenance_items enable row level security;
alter table public.car_due_dates enable row level security;

-- vehicles: 본인 행만
drop policy if exists "vehicles_select_own" on public.vehicles;
create policy "vehicles_select_own" on public.vehicles for select to authenticated
  using ((select auth.uid ()) = user_id);
drop policy if exists "vehicles_insert_own" on public.vehicles;
create policy "vehicles_insert_own" on public.vehicles for insert to authenticated
  with check ((select auth.uid ()) = user_id);
drop policy if exists "vehicles_update_own" on public.vehicles;
create policy "vehicles_update_own" on public.vehicles for update to authenticated
  using ((select auth.uid ()) = user_id) with check ((select auth.uid ()) = user_id);
drop policy if exists "vehicles_delete_own" on public.vehicles;
create policy "vehicles_delete_own" on public.vehicles for delete to authenticated
  using ((select auth.uid ()) = user_id);

-- 딸린 3개: 본인 행만 + insert·update는 vehicle_id가 본인 차량이어야 함(남의 차량 id로 끼워 넣기 방지)
drop policy if exists "car_records_select_own" on public.car_records;
create policy "car_records_select_own" on public.car_records for select to authenticated
  using ((select auth.uid ()) = user_id);
drop policy if exists "car_records_insert_own" on public.car_records;
create policy "car_records_insert_own" on public.car_records for insert to authenticated
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_records_update_own" on public.car_records;
create policy "car_records_update_own" on public.car_records for update to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_records_delete_own" on public.car_records;
create policy "car_records_delete_own" on public.car_records for delete to authenticated
  using ((select auth.uid ()) = user_id);

drop policy if exists "car_maintenance_items_select_own" on public.car_maintenance_items;
create policy "car_maintenance_items_select_own" on public.car_maintenance_items for select to authenticated
  using ((select auth.uid ()) = user_id);
drop policy if exists "car_maintenance_items_insert_own" on public.car_maintenance_items;
create policy "car_maintenance_items_insert_own" on public.car_maintenance_items for insert to authenticated
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_maintenance_items_update_own" on public.car_maintenance_items;
create policy "car_maintenance_items_update_own" on public.car_maintenance_items for update to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_maintenance_items_delete_own" on public.car_maintenance_items;
create policy "car_maintenance_items_delete_own" on public.car_maintenance_items for delete to authenticated
  using ((select auth.uid ()) = user_id);

drop policy if exists "car_due_dates_select_own" on public.car_due_dates;
create policy "car_due_dates_select_own" on public.car_due_dates for select to authenticated
  using ((select auth.uid ()) = user_id);
drop policy if exists "car_due_dates_insert_own" on public.car_due_dates;
create policy "car_due_dates_insert_own" on public.car_due_dates for insert to authenticated
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_due_dates_update_own" on public.car_due_dates;
create policy "car_due_dates_update_own" on public.car_due_dates for update to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = (select auth.uid ())));
drop policy if exists "car_due_dates_delete_own" on public.car_due_dates;
create policy "car_due_dates_delete_own" on public.car_due_dates for delete to authenticated
  using ((select auth.uid ()) = user_id);

-- ───────── '차계부' 카테고리 id·보장 함수 (ADR-004) ─────────
-- 사용자별 고정 id: 두 탭이 동시에 만들어도 PK가 1개만 허용한다. 정책도 같은 식으로 "이 사용자의 차계부 카테고리"를 판정한다.
create or replace function public.carbook_category_id (p_user uuid) returns uuid language sql immutable
set
  search_path = '' as $$
  select md5('carbook-category:' || p_user::text)::uuid;
$$;

-- 호출자 권한(RLS를 그대로 탐). 이미 있으면 이름·색을 바꿨어도 건드리지 않고, 지웠으면 같은 id로 다시 만든다.
create or replace function public.ensure_carbook_category () returns uuid language plpgsql security invoker
set
  search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid () is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_id := public.carbook_category_id (auth.uid ());
  insert into public.categories (id, user_id, name, color)
  values (v_id, auth.uid (), '차계부', '#0f9d58')
  on conflict (id) do nothing;
  return v_id;
end;
$$;

-- 공유 상대는 소유자의 차계부 테이블을 읽을 수 없으므로 정의자 권한이 필요하다(is_share_partner와 같은 이유).
create or replace function public.is_carbook_linked_event (p_event_id uuid) returns boolean language sql stable security definer
set
  search_path = public as $$
  select exists (select 1 from public.car_maintenance_items where event_id = p_event_id)
    or exists (select 1 from public.car_due_dates where event_id = p_event_id);
$$;

-- 실행 권한: authenticated만(Supabase 기본 권한이 anon에도 주므로 anon도 회수)
revoke execute on function public.carbook_category_id (uuid) from public, anon;
revoke execute on function public.ensure_carbook_category () from public, anon;
revoke execute on function public.is_carbook_linked_event (uuid) from public, anon;
grant execute on function public.carbook_category_id (uuid) to authenticated;
grant execute on function public.ensure_carbook_category () to authenticated;
grant execute on function public.is_carbook_linked_event (uuid) to authenticated;

-- ───────── 공유 상대에게 숨김: RESTRICTIVE select 정책 (ADR-005) ─────────
-- RESTRICTIVE는 기존 PERMISSIVE 정책들(events_select_shared 등) 결과에 AND로 붙는다. 기존 SQL 파일은 바꾸지 않는다.
-- 통과 조건: ① 소유자 본인 ② 함께 일정 참여자(기존 동작 유지) ③ 숨김 대상이 아님.
-- category_id가 null이면 <> 비교가 null이 되므로 coalesce로 "숨김 아님(참)"으로 처리하고, 연결 일정 여부는 id로 따로 판정한다(AC-16-6).
drop policy if exists "events_select_hide_carbook" on public.events;
create policy "events_select_hide_carbook" on public.events as restrictive for select
  using (
    (select auth.uid ()) = user_id
    or public.is_event_participant (id, false)
    or (
      coalesce(category_id <> public.carbook_category_id (user_id), true)
      and not public.is_carbook_linked_event (id)
    )
  );

drop policy if exists "categories_select_hide_carbook" on public.categories;
create policy "categories_select_hide_carbook" on public.categories as restrictive for select
  using ((select auth.uid ()) = user_id or id <> public.carbook_category_id (user_id));

-- DOWN: drop policy if exists "events_select_hide_carbook" on public.events; drop policy if exists "categories_select_hide_carbook" on public.categories; drop function if exists public.ensure_carbook_category (), public.is_carbook_linked_event (uuid), public.carbook_category_id (uuid); drop table if exists public.car_due_dates, public.car_maintenance_items, public.car_records, public.vehicles;
-- (테이블 정책·인덱스·제약은 테이블과 함께 삭제된다. 차계부 데이터가 모두 사라지므로 운영에서는 Michael 승인 뒤에만 실행. 함수가 만든 '차계부' 카테고리 행은 남는다.)
