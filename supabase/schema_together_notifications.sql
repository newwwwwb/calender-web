-- 19.6 "함께 일정" 알림. schema_together.sql 실행 후, 이 파일을 이어서 실행하세요.
--
-- notifications는 트리거로만 채워진다(insert 정책 없음) — 클라이언트가 남의 알림을 대신
-- 만들 수 없게 하기 위해서다. actor_email은 클라이언트를 믿지 않고 auth.users에서 채운다.

create table public.notifications (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade, -- 수신자
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text not null default '',
  kind text not null check (kind in ('invited', 'updated', 'responded', 'deleted')),
  status text check (status in ('pending', 'accepted', 'declined')),
  event_id uuid references public.events (id) on delete set null,
  event_title text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications for select using (auth.uid () = user_id);

create policy "notifications_update_own" on public.notifications
for update
  using (auth.uid () = user_id)
with
  check (auth.uid () = user_id);

-- === 초대: event_participants에 새 참여자가 생기면 그 사람에게 알린다 ===

create or replace function public.event_participants_notify_invited () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_actor_id uuid := auth.uid ();
  v_actor_email text;
  v_event_title text;
begin
  select email into v_actor_email from auth.users where id = v_actor_id;
  select title into v_event_title from public.events where id = new.event_id;

  insert into
    public.notifications (id, user_id, actor_id, actor_email, kind, status, event_id, event_title)
  values
    (
      gen_random_uuid (),
      new.user_id,
      v_actor_id,
      coalesce(v_actor_email, ''),
      'invited',
      new.status,
      new.event_id,
      coalesce(v_event_title, '')
    );

  return new;
end;
$$;

drop trigger if exists event_participants_notify_invited_trigger on public.event_participants;

create trigger event_participants_notify_invited_trigger after insert on public.event_participants for each row
execute function public.event_participants_notify_invited ();

-- === 수정: 함께 일정이 바뀌면 소유자+거절하지 않은 참여자(수정한 사람 본인 제외)에게 알린다.
--        같은 수신자·일정의 읽지 않은 updated 알림이 있으면 새로 쌓지 않고 갱신만 한다 ===

create or replace function public.events_notify_updated () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_actor_id uuid := auth.uid ();
  v_actor_email text;
  v_recipient uuid;
begin
  select email into v_actor_email from auth.users where id = v_actor_id;

  for v_recipient in
    select user_id
    from public.event_participants
    where event_id = new.id
      and status <> 'declined'
      and user_id <> v_actor_id
    union
    select new.user_id
    where new.user_id <> v_actor_id
  loop
    update public.notifications
    set
      actor_id = v_actor_id,
      actor_email = coalesce(v_actor_email, ''),
      event_title = new.title,
      created_at = now(),
      read_at = null
    where
      user_id = v_recipient
      and event_id = new.id
      and kind = 'updated'
      and read_at is null;

    if not found then
      insert into
        public.notifications (id, user_id, actor_id, actor_email, kind, event_id, event_title)
      values
        (gen_random_uuid (), v_recipient, v_actor_id, coalesce(v_actor_email, ''), 'updated', new.id, new.title);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists events_notify_updated_trigger on public.events;

create trigger events_notify_updated_trigger
after update on public.events for each row when (old.* is distinct from new.*)
execute function public.events_notify_updated ();

-- === 삭제: 참여자에게 알린다. events 행이 지워지기 전이라 event_id를 직접 null로 남긴다 ===

create or replace function public.events_notify_deleted () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_actor_id uuid := auth.uid ();
  v_actor_email text;
  v_recipient uuid;
begin
  select email into v_actor_email from auth.users where id = v_actor_id;

  for v_recipient in
    select user_id
    from public.event_participants
    where event_id = old.id
      and user_id <> v_actor_id
  loop
    insert into
      public.notifications (id, user_id, actor_id, actor_email, kind, event_id, event_title)
    values
      (gen_random_uuid (), v_recipient, v_actor_id, coalesce(v_actor_email, ''), 'deleted', null, old.title);
  end loop;

  return old;
end;
$$;

drop trigger if exists events_notify_deleted_trigger on public.events;

create trigger events_notify_deleted_trigger before delete on public.events for each row
execute function public.events_notify_deleted ();

-- === 응답: respond_to_event가 상태를 바꾼 뒤 소유자에게 알린다 (schema_together.sql의
--        respond_to_event를 같은 파라미터로 create or replace — 권한(grant)은 그대로 유지된다) ===

create or replace function public.respond_to_event (p_event_id uuid, p_status text) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  v_owner_id uuid;
  v_event_title text;
  v_actor_email text;
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

  select user_id, title into v_owner_id, v_event_title
  from public.events
  where id = p_event_id;

  select email into v_actor_email from auth.users where id = auth.uid ();

  insert into
    public.notifications (id, user_id, actor_id, actor_email, kind, status, event_id, event_title)
  values
    (
      gen_random_uuid (),
      v_owner_id,
      auth.uid (),
      coalesce(v_actor_email, ''),
      'responded',
      p_status,
      p_event_id,
      coalesce(v_event_title, '')
    );
end;
$$;
