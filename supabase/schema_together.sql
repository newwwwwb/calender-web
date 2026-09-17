-- 19단계 "함께 일정": 일정에 참여자를 초대해 수락/거절로 확정하는 기능.
-- schema_share_mutual.sql, schema_share_fix4.sql 실행 후, 이 파일을 이어서 실행하세요.
-- (참여자는 이미 공유 링크로 연결된 상대 중에서만 초대하므로 is_share_partner()에 의존한다.)
--
-- 이 파일의 두 번째 섹션(알림)은 19.6에서 이어서 추가된다 — 그때 새로 추가된 부분만 실행하면 된다.

-- === 1. event_participants 테이블 ===

create table public.event_participants (
  id uuid primary key default gen_random_uuid (),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index event_participants_event_id_idx on public.event_participants (event_id);
create index event_participants_user_id_idx on public.event_participants (user_id);

alter table public.event_participants enable row level security;

-- email은 클라이언트 입력을 믿지 않고 삽입 시점에 auth.users에서 다시 채운다.
create or replace function public.event_participants_fill_email () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.user_id;
  new.email := coalesce(v_email, '');
  return new;
end;
$$;

drop trigger if exists event_participants_fill_email_trigger on public.event_participants;

create trigger event_participants_fill_email_trigger before insert on public.event_participants for each row
execute function public.event_participants_fill_email ();

-- === 2. 소유자/참여자 판정 헬퍼 (RLS 정책 간 상호 참조로 인한 42P17 무한 재귀를 피하기 위해
--        SECURITY DEFINER로 만든다 — schema_share_fix2/fix3.sql과 같은 이유) ===

create or replace function public.is_event_owner (p_event_id uuid) returns boolean language sql security definer
set
  search_path = public as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and user_id = auth.uid ()
  );
$$;

revoke execute on function public.is_event_owner (uuid)
from
  public;

grant
execute on function public.is_event_owner (uuid) to authenticated;

create or replace function public.is_event_participant (p_event_id uuid, p_accepted_only boolean) returns boolean language sql security definer
set
  search_path = public as $$
  select exists (
    select 1
    from public.event_participants
    where event_id = p_event_id
      and user_id = auth.uid ()
      and (not p_accepted_only or status = 'accepted')
  );
$$;

revoke execute on function public.is_event_participant (uuid, boolean)
from
  public;

grant
execute on function public.is_event_participant (uuid, boolean) to authenticated;

-- === 3. events: 참여자 select/update 정책 + user_id/id 고정 트리거 ===
-- 참여자가 자기 참여작을 수락한 일정을 update할 수 있게 하지만, 소유권(user_id)과 id는
-- 누가 update하든(소유자 포함) 절대 바뀌지 않도록 트리거로 강제한다 — 클라이언트의
-- eventToRow가 update에도 user_id를 실어 보내는 실수를 서버에서 무력화한다.

create policy "events_select_participant" on public.events for select using (public.is_event_participant (id, false));

create policy "events_update_participant" on public.events
for update
  using (public.is_event_participant (id, true))
with
  check (public.is_event_participant (id, true));

create or replace function public.events_lock_identity () returns trigger language plpgsql as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists events_lock_identity_trigger on public.events;

create trigger events_lock_identity_trigger before update on public.events for each row
execute function public.events_lock_identity ();

-- === 4. event_participants 정책 ===
-- update 정책은 없다 — 참여자는 respond_to_event() RPC로만 자기 상태를 바꿀 수 있다.

create policy "event_participants_select" on public.event_participants for select using (
  auth.uid () = user_id
  or public.is_event_owner (event_id)
  or public.is_event_participant (event_id, false)
);

create policy "event_participants_insert" on public.event_participants for insert
with
  check (
    public.is_event_owner (event_id)
    and public.is_share_partner (user_id)
    and status in ('pending', 'accepted')
  );

create policy "event_participants_delete" on public.event_participants for delete using (public.is_event_owner (event_id));

-- === 5. 참여자가 자기 상태를 바꾸는 RPC ===

create or replace function public.respond_to_event (p_event_id uuid, p_status text) returns void language plpgsql security definer
set
  search_path = public as $$
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'invalid status';
  end if;

  update public.event_participants
  set
    status = p_status
  where
    event_id = p_event_id
    and user_id = auth.uid ();

  if not found then
    raise exception 'participant not found';
  end if;
end;
$$;

revoke execute on function public.respond_to_event (uuid, text)
from
  public;

grant
execute on function public.respond_to_event (uuid, text) to authenticated;
