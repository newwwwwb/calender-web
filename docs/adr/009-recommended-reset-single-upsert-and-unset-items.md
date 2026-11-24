# ADR-009 추천 주기 되돌리기는 한 번의 upsert로 쓰고, 미입력 항목은 last_date null로 둔다 (v0.2)

- 상태: 제안 (PO 설계 검토 대기)
- 관련: F-20(BR-44~47, AC-20-1~10), F-24(BR-51~53, AC-24-1~7), ADR-003 보완 B(`event_id` 불변식), PRD R-24

## 배경
- 되돌리기는 여러 항목을 한 묶음으로 바꿔야 한다(BR-47, AC-20-6). 함수(RPC) 추가는 R-24 허용 범위(제약 해제·설정 테이블)에 없다.
- `event_id`는 insert, 선점(claim), `clearEventId`로만 쓴다(ADR-003 보완 B). 되돌리기가 `event_id`를 다시 쓰면 그사이 선점한 값을 덮을 수 있다.
- 미입력 항목은 마지막 교체일이 없다(BR-52). 지금 `last_date`는 `not null`이다. 마지막 교체 주행거리는 이미 null 허용이다(`schema_carbook.sql` 44행).

## 선택지 (되돌리기 쓰기)
| | 방법 | 한 묶음 | `event_id` 불변식 | R-24 |
|---|---|---|---|---|
| A | 항목마다 `updateItem` 여러 요청 | 안 됨(중간 실패 시 일부만 바뀜) | 지킴 | 지킴 |
| B | 한 요청 `upsert([...], { onConflict: 'id' })`. 행마다 `id, user_id, vehicle_id, name, interval_km, interval_months`만 보낸다 | 됨(한 SQL 문) | 지킴(`event_id`·`last_*`·`created_at`을 보내지 않아 그대로) | 지킴 |
| C | `reset_recommended_cycles(vehicle_id)` RPC | 됨 | 지킴 | 위반(새 함수) |

## 결정
B. 대상은 순수 함수 `planRecommendedReset(items, vehicleId)`가 정한다(이름 앞뒤 공백 제거 후 추천 7개 이름과 같고 주기가 다른 항목, 추천 순서). 쓰기가 성공한 뒤 `syncLinked`로 연결 일정만 맞춘다(BR-46). `event_id`가 없는 항목에는 일정을 만들지 않는다.
- upsert라 다른 탭에서 방금 지운 항목이면 그 행이 이름·주기만 가진 미입력 항목으로 다시 생긴다. 드물고 데이터 손실이 없어 허용한다. PGlite 테스트로 기존 행의 `event_id`·`last_date`·`last_odometer_km`·`created_at`이 그대로인지 확인한다.

## 결정 (미입력 항목)
- 새 마이그레이션에서 `alter table car_maintenance_items alter column last_date drop not null`만 한다. 기존 행 UPDATE 0건. DOWN은 `set not null`(미입력 행이 있으면 실패하므로 DOWN 전에 그 행을 사용자에게 알리는 순서를 `docs/db.md`에 적는다).
- 앱 타입: `MaintenanceItem.lastDate: DateKey | null`. `ItemInput`(양식 저장)은 `DateKey` 그대로라 양식 규칙(MSG-05)이 바뀌지 않는다. `buildRecommendedItems`만 null로 만든다.
- 계산: `evaluateItem`은 `lastDate === null`이면 `{ nextDate: null, remainingKm: null, status: 'unset', basis: null }`. 정렬은 맨 뒤(UA-8). 일정 대상에서 뺀다. BR-06a 채우기에서 뺀다(`fillMissingItemOdometer`의 조건에 `last_date is not null`).

## 결과
- 쉬워지는 것: 새 함수 없이 묶음 쓰기, `event_id` 불변식 유지, 기존 행 무변경.
- 어려워지는 것: `lastDate` null을 다루는 곳(계산, 정렬, 표시, 일정, BR-06a)이 늘어 티켓 하나에 모은다. upsert는 not null 열(`user_id`, `vehicle_id`, `name`)을 같이 보내야 한다.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-21 | 최초 작성(제안) | v0.2 설계 시작 | Product Owner(conv-carbook-v02) | MPR-62, MPR-63, MPR-65 |
