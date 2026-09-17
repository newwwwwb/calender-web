-- accept_share의 파라미터명 충돌 수정. schema_share_mutual.sql 실행 후, 이 파일을 이어서 실행하세요.
--
-- 문제: accept_share(share_id uuid)의 파라미터명이 calendar_share_members.share_id 컬럼명과
-- 같다. INSERT ... ON CONFLICT (share_id, viewer_id) 절은 PL/pgSQL 변수와 컬럼명이 겹치면
-- 어느 쪽인지 판단하지 못해 "column reference share_id is ambiguous"(42702) 에러를 낸다.
-- schema_share_fix.sql에서 함수를 처음 만들 때부터 있던 잠재 버그다 — get_share_owner/
-- is_share_member처럼 p_ 접두어로 구분되지 않은 채 남아 있었다.
--
-- 수정: 파라미터명을 p_share_id로 바꾼다. Postgres는 create or replace로 파라미터명을
-- 바꿀 수 없어서(42P13) 먼저 기존 함수를 지워야 한다.

drop function if exists public.accept_share (uuid);

create or replace function public.accept_share (p_share_id uuid) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.calendar_shares where id = p_share_id) then
    raise exception 'share not found';
  end if;

  select email into v_email from auth.users where id = auth.uid ();

  insert into
    public.calendar_share_members (id, share_id, viewer_id, viewer_email)
  values
    (gen_random_uuid (), p_share_id, auth.uid (), coalesce (v_email, '')) on conflict (share_id, viewer_id) do nothing;
end;
$$;

revoke execute on function public.accept_share (uuid)
from
  public;

grant
execute on function public.accept_share (uuid) to authenticated;
