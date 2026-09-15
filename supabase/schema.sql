-- 캘린더 앱의 Supabase 스키마: categories/events 테이블 + 사용자별 RLS
-- Supabase 대시보드의 SQL Editor에 붙여넣고 실행하세요.

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  memo text,
  category_id uuid references public.categories (id) on delete set null,
  color text,
  all_day boolean not null,
  -- 앱 도메인 모델과 동일하게 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm' 문자열 그대로 저장한다
  -- (timestamptz로 바꾸면 all_day 표현·타임존 처리가 복잡해져서, 클라이언트 로직과 동일한 포맷을 유지)
  start_at text not null,
  end_at text not null,
  recurrence jsonb,
  excluded_dates text[],
  created_at timestamptz not null default now()
);

create index events_user_id_idx on public.events (user_id);
create index events_category_id_idx on public.events (category_id);
create index categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;
alter table public.events enable row level security;

create policy "categories_select_own" on public.categories for select using (auth.uid () = user_id);

create policy "categories_insert_own" on public.categories for insert
with
  check (auth.uid () = user_id);

create policy "categories_update_own" on public.categories
for update
  using (auth.uid () = user_id);

create policy "categories_delete_own" on public.categories for delete using (auth.uid () = user_id);

create policy "events_select_own" on public.events for select using (auth.uid () = user_id);

create policy "events_insert_own" on public.events for insert
with
  check (auth.uid () = user_id);

create policy "events_update_own" on public.events
for update
  using (auth.uid () = user_id);

create policy "events_delete_own" on public.events for delete using (auth.uid () = user_id);
