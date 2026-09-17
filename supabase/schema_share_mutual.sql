-- 공유를 양방향으로 만든다: 링크를 수락하면 두 사람이 서로의 캘린더를 볼 수 있게 한다.
-- schema_share_fix3.sql 실행 후, 이 파일을 이어서 실행하세요.
--
-- 기존 events_select_shared/categories_select_shared는 "링크 소유자의 데이터를 수락자가 본다"는
-- 한 방향만 검사했다. 관계를 대칭으로 바꾼다: 나와 상대(p_other) 사이에 calendar_shares/
-- calendar_share_members 행이 하나라도 있으면(내가 소유자든 수락자든) 서로 파트너로 본다.
-- SECURITY DEFINER로 만들어 RLS를 다시 타지 않게 해서, fix3에서 겪은 정책 간 무한 재귀를 피한다.

create or replace function public.is_share_partner (p_other uuid) returns boolean language sql security definer
set
  search_path = public as $$
  select exists (
    select 1
    from public.calendar_share_members m
    join public.calendar_shares s on s.id = m.share_id
    where
      (s.owner_id = p_other and m.viewer_id = auth.uid ())
      or (s.owner_id = auth.uid () and m.viewer_id = p_other)
  );
$$;

revoke execute on function public.is_share_partner (uuid)
from
  public;

grant
execute on function public.is_share_partner (uuid) to authenticated;

drop policy if exists "events_select_shared" on public.events;

create policy "events_select_shared" on public.events for select using (public.is_share_partner (user_id));

drop policy if exists "categories_select_shared" on public.categories;

create policy "categories_select_shared" on public.categories for select using (public.is_share_partner (user_id));
