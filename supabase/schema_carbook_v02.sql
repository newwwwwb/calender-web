-- 차계부 v0.2 마이그레이션: 기본 차량 설정 테이블 car_settings(ADR-007)와 정비 항목 last_date not null 해제(ADR-009). 재실행해도 안전하다.
-- schema_carbook.sql 실행 뒤 이어서 실행한다. 기존 행 UPDATE 0건, 기존 supabase/*.sql 불변. 되돌리기는 schema_carbook_v02_down.sql.

-- ───────── car_settings: 사용자당 1행, 기본 차량 ─────────
create table if not exists public.car_settings (
  user_id uuid primary key default auth.uid () references auth.users (id) on delete cascade, -- upsert(onConflict: user_id)가 user_id를 생략해도 채워진다
  default_vehicle_id uuid references public.vehicles (id) on delete set null, -- 차량을 지우면 DB가 null로(AC-19-5)
  updated_at timestamptz not null default now()
);

-- 외래키 인덱스: 차량 삭제 때 set null 대상을 찾는다. null 행은 제외
create index if not exists car_settings_default_vehicle_id_idx on public.car_settings (default_vehicle_id) where default_vehicle_id is not null;

alter table public.car_settings enable row level security;

-- 본인 행만. insert·update는 default_vehicle_id가 null이거나 본인 차량이어야 한다(AC-19-9, 남의 차량 id 지정 방지)
drop policy if exists "car_settings_select_own" on public.car_settings;
create policy "car_settings_select_own" on public.car_settings for select to authenticated
  using ((select auth.uid ()) = user_id);
drop policy if exists "car_settings_insert_own" on public.car_settings;
create policy "car_settings_insert_own" on public.car_settings for insert to authenticated
  with check (
    (select auth.uid ()) = user_id
    and (default_vehicle_id is null or exists (select 1 from public.vehicles v where v.id = default_vehicle_id and v.user_id = (select auth.uid ())))
  );
drop policy if exists "car_settings_update_own" on public.car_settings;
create policy "car_settings_update_own" on public.car_settings for update to authenticated
  using ((select auth.uid ()) = user_id)
  with check (
    (select auth.uid ()) = user_id
    and (default_vehicle_id is null or exists (select 1 from public.vehicles v where v.id = default_vehicle_id and v.user_id = (select auth.uid ())))
  );
drop policy if exists "car_settings_delete_own" on public.car_settings;
create policy "car_settings_delete_own" on public.car_settings for delete to authenticated
  using ((select auth.uid ()) = user_id);

-- ───────── 미입력 정비 항목: last_date를 비울 수 있게(ADR-009, AC-24-5) ─────────
-- 제약을 푸는 것뿐이라 기존 행은 바뀌지 않는다. 이미 풀려 있어도 오류 없이 지나간다
alter table public.car_maintenance_items alter column last_date drop not null;
