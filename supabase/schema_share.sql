-- 캘린더 공유(초대 링크) 스키마 추가분. schema.sql 실행 후 이어서 실행하세요.
-- calendar_shares: 공유 링크 자체(id가 곧 초대 링크 토큰). calendar_share_members: 링크를 수락한 사람.

create table public.calendar_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table public.calendar_share_members (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.calendar_shares (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  viewer_email text not null,
  created_at timestamptz not null default now(),
  unique (share_id, viewer_id)
);

create index calendar_shares_owner_id_idx on public.calendar_shares (owner_id);
create index calendar_share_members_viewer_id_idx on public.calendar_share_members (viewer_id);
create index calendar_share_members_share_id_idx on public.calendar_share_members (share_id);

alter table public.calendar_shares enable row level security;
alter table public.calendar_share_members enable row level security;

-- 초대 링크를 수락하려면 상대가 id(추측 불가능한 uuid)로 이 행을 조회할 수 있어야 한다.
-- 링크 URL 자체가 비밀이라는 전제(구글 문서 공유 링크와 같은 패턴)로 로그인한 사용자에게는 select를 허용한다.
create policy "calendar_shares_select_authenticated" on public.calendar_shares for select using (auth.uid () is not null);

create policy "calendar_shares_insert_own" on public.calendar_shares for insert
with
  check (auth.uid () = owner_id);

create policy "calendar_shares_delete_own" on public.calendar_shares for delete using (auth.uid () = owner_id);

-- 멤버 목록은 그 공유의 owner(수락자 관리용)와 본인(내가 수락한 목록 조회용)만 볼 수 있다.
create policy "calendar_share_members_select" on public.calendar_share_members for select using (
  auth.uid () = viewer_id
  or auth.uid () = (
    select owner_id
    from public.calendar_shares
    where id = share_id
  )
);

-- 초대 수락: 본인 명의로만 자신을 멤버로 등록할 수 있다.
create policy "calendar_share_members_insert_self" on public.calendar_share_members for insert
with
  check (auth.uid () = viewer_id);

-- 소유자는 멤버를 내보낼 수 있고(공유 취소), 멤버 본인도 나갈 수 있다.
create policy "calendar_share_members_delete" on public.calendar_share_members for delete using (
  auth.uid () = viewer_id
  or auth.uid () = (
    select owner_id
    from public.calendar_shares
    where id = share_id
  )
);

-- events/categories: 기존 "select own" 정책은 그대로 두고, 공유받은 소유자의 데이터도 보이도록 정책을 추가한다.
-- (Postgres RLS는 같은 커맨드의 permissive 정책을 OR로 합치므로 기존 정책을 건드릴 필요가 없다)
create policy "events_select_shared" on public.events for select using (
  exists (
    select 1
    from public.calendar_share_members m
    join public.calendar_shares s on s.id = m.share_id
    where
      s.owner_id = events.user_id
      and m.viewer_id = auth.uid ()
  )
);

create policy "categories_select_shared" on public.categories for select using (
  exists (
    select 1
    from public.calendar_share_members m
    join public.calendar_shares s on s.id = m.share_id
    where
      s.owner_id = categories.user_id
      and m.viewer_id = auth.uid ()
  )
);
