-- schema_carbook_v02.sql 되돌리기. last_date가 null인 행(미입력 항목)이 있으면 set not null이 실패하고 전체가 취소된다.
-- 실행 전 docs/db.md 8장의 순서(미입력 행 확인 → 사용자에게 알림)를 따른다. 행을 지우거나 채우는 문장은 이 파일에 없다.
begin;
alter table public.car_maintenance_items alter column last_date set not null;
drop table if exists public.car_settings; -- 정책·인덱스도 함께 사라진다
commit;
