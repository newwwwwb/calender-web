-- schema_share_fix2.sql이 만든 무한 재귀 버그 수정. schema_share_fix2.sql 실행 후, 이 파일을 이어서 실행하세요.
--
-- 문제: calendar_shares_select_own_or_member 정책이 calendar_share_members를 EXISTS 서브쿼리로
-- 직접 조회하는데, calendar_share_members_select 정책(schema_share.sql)이 반대로 calendar_shares를
-- 서브쿼리로 조회한다. 두 정책이 서로를 참조해 Postgres가 RLS를 평가할 때 무한 재귀에 빠진다
-- (42P17 infinite recursion detected in policy for relation "calendar_shares").
--
-- 수정: calendar_shares 쪽 멤버십 확인을 SECURITY DEFINER 함수로 옮긴다. 이 함수는 함수 소유자
-- 권한으로 실행되어 calendar_share_members의 RLS를 다시 타지 않으므로, 순환 참조가 끊긴다.

create or replace function public.is_share_member (p_share_id uuid) returns boolean language sql security definer
set
  search_path = public as $$
  select exists (
    select 1
    from public.calendar_share_members m
    where
      m.share_id = p_share_id
      and m.viewer_id = auth.uid ()
  );
$$;

revoke execute on function public.is_share_member (uuid)
from
  public;

grant
execute on function public.is_share_member (uuid) to authenticated;

drop policy if exists "calendar_shares_select_own_or_member" on public.calendar_shares;

create policy "calendar_shares_select_own_or_member" on public.calendar_shares for select using (
  auth.uid () = owner_id
  or public.is_share_member (id)
);
