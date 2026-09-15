-- 15단계 보스 리뷰(코드 품질 서브에이전트)가 발견: 방금 전 schema_share_fix.sql이 만든 부작용.
-- schema_share_fix.sql 실행 후, 이 파일을 이어서 실행하세요.
--
-- 문제 1: calendar_shares select를 owner 전용으로 좁혔더니, listSharedWithMe()의 임베디드 조인
-- (calendar_share_members → calendar_shares)에도 RLS가 그대로 걸려 뷰어 쪽엔 owner_id/owner_email이
-- 항상 null로 옴 — "나에게 공유된 캘린더" 목록이 전부 비어버리는 회귀. owner 또는 "이미 수락한
-- 멤버"까지 select를 넓혀서 고친다(여전히 초대 안 받은 사람의 목록 열거는 불가능).
--
-- 문제 2: get_share_owner의 반환 컬럼명(owner_id, owner_email)이 calendar_shares 테이블 컬럼명과
-- 같아 PostgreSQL이 모호하다고 볼 수 있다 — 테이블 별칭으로 확실히 구분한다.
--
-- 문제 3: 새 함수 두 개가 기본적으로 PUBLIC(비로그인 anon 포함)에도 실행 권한이 열려 있었다 —
-- authenticated로만 좁힌다.

drop policy if exists "calendar_shares_select_own" on public.calendar_shares;

create policy "calendar_shares_select_own_or_member" on public.calendar_shares for select using (
  auth.uid () = owner_id
  or exists (
    select 1
    from public.calendar_share_members m
    where
      m.share_id = id
      and m.viewer_id = auth.uid ()
  )
);

create or replace function public.get_share_owner (p_share_id uuid) returns table (owner_id uuid, owner_email text) language sql security definer
set
  search_path = public as $$
  select s.owner_id, s.owner_email from public.calendar_shares s where s.id = p_share_id;
$$;

revoke execute on function public.get_share_owner (uuid)
from
  public;

grant
execute on function public.get_share_owner (uuid) to authenticated;

revoke execute on function public.accept_share (uuid)
from
  public;

grant
execute on function public.accept_share (uuid) to authenticated;
