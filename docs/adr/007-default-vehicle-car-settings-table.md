# ADR-007 기본 차량은 새 테이블 car_settings에 저장한다 (v0.2, Q-V3b)

- 상태: 승인 (Product Owner 2026-11-24, conv-carbook-v02)
- 관련: F-19(BR-40~43, AC-19-1~12), PRD R-24 허용 범위, NFR-45, `docs/research/tech.md` VT-3

## 배경
- 기본 차량은 계정에 저장해 기기 간 유지돼야 한다(BR-40, AC-19-2). 차량을 지우면 지정이 풀려야 한다(AC-19-5). 남의 차량 id는 지정할 수 없어야 한다(AC-19-9).
- 제약: 스키마 변경은 새 마이그레이션 파일만, 기존 행 변경 0건, 운영 적용은 사용자가 직접(PRD R-24). 캘린더 코드 불변(AC-2).

## 선택지
| | 방법 | 기기 간 유지 | 차량 삭제 | 남의 차량 거부 | 캘린더 영향 |
|---|---|---|---|---|---|
| A | `localStorage`(사용자 id별 키) | 안 됨 → AC-19-2 실패 | 화면이 거름 | 해당 없음 | 없음 |
| B | `vehicles.is_default` + 부분 유일 인덱스 | 됨 | 자동 | 기존 정책 | 없음. 단 바꿀 때 해제+지정 2요청이라 RPC가 필요(R-24 범위 밖) |
| C | 새 테이블 `car_settings(user_id pk, default_vehicle_id → vehicles on delete set null)` | 됨 | DB가 null로 | insert·update 정책에서 내 차량인지 확인 | 없음 |
| D | `auth.updateUser`의 `user_metadata` | 됨 | 삭제된 id가 남음 | 확인 불가 | `USER_UPDATED`로 `CalendarProvider`가 다시 읽음(캘린더 동작 변경) |

## 결정
C. 한 요청 `upsert(onConflict: user_id)`로 쓰고, 첫 로드의 `Promise.all`에 읽기 1건을 더한다. 읽기만 실패하면 무시하고 가장 먼저 만든 차량을 고른다(BR-43, AC-19-8).
- 파일: `supabase/schema_carbook_v02.sql`(UP)과 `supabase/schema_carbook_v02_down.sql`(DOWN). ADR-009의 `last_date` 제약 해제도 같은 파일에 둔다.
- 정책: `to authenticated`, `(select auth.uid()) = user_id`로 select·insert·update·delete. insert·update `with check`에 `default_vehicle_id is null or exists (select 1 from vehicles v where v.id = default_vehicle_id and v.user_id = (select auth.uid()))`.

## 결과
- 쉬워지는 것: 기기 간 유지, 차량 삭제, 계정 격리를 DB가 맡는다. 화면은 `picked ?? default ?? vehicles[0]` 한 줄이다.
- 어려워지는 것: 테이블 1개와 정책 4개가 늘고 운영 적용이 한 번 더 필요하다. 첫 로드 요청이 1건 늘어 AC-04-9 재측정(F-23)에 포함해야 한다.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-21 | 최초 작성(제안) | v0.2 설계 시작, OQ-4 Q-V3b | Product Owner(conv-carbook-v02) | MPR-62, MPR-65 |
| 2026-11-24 | 상태 승인 | PO 설계 검토 승인 | Product Owner(conv-carbook-v02) | 없음 |
