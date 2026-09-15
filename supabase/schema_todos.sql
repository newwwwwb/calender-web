-- 할 일(Todo) 스키마 추가분. schema.sql 실행 후 이어서 실행하세요.
-- 할 일은 개인 전용 — 공유 select 정책 없음(schema_share.sql의 events/categories와 다름).

create table public.todos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  memo text,
  done boolean not null default false,
  due_date text,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index todos_user_id_idx on public.todos (user_id);

alter table public.todos enable row level security;

create policy "todos_select_own" on public.todos for select using (auth.uid () = user_id);

create policy "todos_insert_own" on public.todos for insert
with
  check (auth.uid () = user_id);

create policy "todos_update_own" on public.todos for update using (auth.uid () = user_id);

create policy "todos_delete_own" on public.todos for delete using (auth.uid () = user_id);
