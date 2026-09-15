-- 보안 리뷰로 발견된 구멍 수정 (schema_share.sql 실행 후, 이 파일을 이어서 실행하세요).
--
-- 문제: calendar_shares를 "로그인한 아무나 전체 조회 가능"하게 열어뒀던 select 정책과,
-- calendar_share_members의 insert 정책(auth.uid() = viewer_id만 확인)이 합쳐지면, 초대 링크를
-- 한 번도 받은 적 없는 로그인 사용자도 `select * from calendar_shares`로 모든 공유 링크 id를
-- 열람한 뒤 아무 id로나 스스로를 멤버로 등록해 남의 캘린더(일정·카테고리)를 구독할 수 있었다.
-- "초대 링크를 받은 사람만" 이라는 접근 제어 자체가 무력화되는 치명적 구멍.
--
-- 수정: calendar_shares의 select를 소유자 전용으로 좁히고, 초대 조회/수락은 SECURITY DEFINER
-- 함수로만 허용한다 — 정확한 id(추측 불가능한 uuid)를 아는 사람만 그 한 건에 접근할 수 있고,
-- 목록 열람은 불가능하다.

drop policy if exists "calendar_shares_select_authenticated" on public.calendar_shares;

create policy "calendar_shares_select_own" on public.calendar_shares for select using (auth.uid () = owner_id);

drop policy if exists "calendar_share_members_insert_self" on public.calendar_share_members;

-- 초대 수락 화면이 소유자 이메일을 보여줄 때 쓴다. id 하나만 조회 가능(목록 조회 불가).
create or replace function public.get_share_owner (share_id uuid) returns table (owner_id uuid, owner_email text) language sql security definer
set
  search_path = public as $$
  select owner_id, owner_email from public.calendar_shares where id = share_id;
$$;

grant
execute on function public.get_share_owner (uuid) to authenticated;

-- 초대 수락: share_id가 실제로 존재할 때만 본인을 멤버로 등록한다(이미 수락했으면 조용히 무시).
create or replace function public.accept_share (share_id uuid) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.calendar_shares where id = share_id) then
    raise exception 'share not found';
  end if;

  select email into v_email from auth.users where id = auth.uid ();

  insert into
    public.calendar_share_members (id, share_id, viewer_id, viewer_email)
  values
    (gen_random_uuid (), share_id, auth.uid (), coalesce (v_email, '')) on conflict (share_id, viewer_id) do nothing;
end;
$$;

grant
execute on function public.accept_share (uuid) to authenticated;
