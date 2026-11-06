# ADR-003 연결 일정: `event_id`는 FK 없이, 행에 먼저 저장하고 같은 id로 upsert

- 상태: 승인 (2026-11-05, Product Owner 승인 — 메시지 2026-11-05T05-00-31-218Z-51ed15)
- 관련: PRD OQ-2(tech.md Q3·Q4), F-08(BR-21~25, AC-08-3·5·6·7·13), F-03(BR-22, AC-03-8), NFR-34·35, tech.md T-3

## 배경
- 교체 항목·만기일 하나에 일정 1건(NFR-34). 재시도·두 탭에서도 1건.
- 캘린더에서 지운 일정은 차계부를 열 때 다시 만든다(AC-08-3). 반면 `event_id`가 없는 항목(추천 항목 등)은 기록·주행거리 변경으로 일정을 만들지 않는다(BR-21).
- 즉 `event_id`는 "이 항목은 캘린더와 연동 중"이라는 표시 역할을 한다.
- 결정할 것: (Q4) `event_id`에 `references events(id) on delete set null` FK를 걸지, (Q3) 계산 불가가 된 항목의 기존 일정을 지울지, 그리고 쓰기 순서.

## 선택지
### Q4 FK
| | 방법 | 결과 |
|---|---|---|
| A | FK 없음. 존재는 `id in (…)` 조회로 확인 | 캘린더에서 지워도 `event_id`가 남아 "연동 중" 표시가 유지 → AC-08-3 재생성 가능 |
| B | FK `on delete set null` | 캘린더에서 지우면 `event_id`가 null이 되어 "원래 일정 없던 항목"과 구분 불가 → BR-21에 따라 재생성하지 않게 되어 **AC-08-3 위반** |

### 쓰기 순서
| | 순서 | 실패 시 |
|---|---|---|
| A | ① 클라이언트가 `event_id`(uuid)를 정함 → ② 항목 행 저장(그 `event_id` 포함) → ③ 같은 id로 `events` upsert | ②가 실패하면 일정이 아예 안 생김(고아 0). ③이 실패하면 행에 `event_id`가 있고 일정이 없음 = MSG-11 상태. 재시도·다음 열기 재생성이 같은 id로 upsert |
| B | tech.md T-3 권장: 일정 upsert → 성공하면 행에 `event_id` 저장 | 일정 성공 후 행 저장이 실패하면 아무 행도 가리키지 않는 일정이 캘린더에 영구히 남음(고아, NFR-35 위반 가능) |

### Q3 계산 불가가 된 연결 일정
| | 방법 | 결과 |
|---|---|---|
| A | 일정을 지우고 `event_id`는 그대로 둔다 | 틀린 날짜가 캘린더에 남지 않음. 다시 계산 가능해지면(BR-21 ③) 같은 id로 다시 생김 |
| B | 일정을 지우고 `event_id`도 비운다 | 다시 계산 가능해져도 BR-21 때문에 일정이 안 생김. 사용자가 항목을 다시 저장해야 함 |
| C | 일정을 남긴다 | 근거 없는 날짜가 캘린더에 남음 |

## 결정
- Q4: **A, FK 없음.** `car_maintenance_items.event_id`, `car_due_dates.event_id`는 `uuid null`, 인덱스만 건다.
- 쓰기 순서: **A.** 일정 id는 행이 처음 연동될 때(항목 저장 ①·만기일 저장 ②·MSG-11 재시도) 클라이언트가 `crypto.randomUUID()`로 만들고 행 저장과 같은 요청에 넣는다. 이후 일정 쓰기는 항상 그 id로 `upsert`한다. 행 id와 일정 id는 다르다.
- Q3: **A.** 계산 불가가 되면 연결 일정을 지우고 `event_id`는 남긴다. 상태는 "미연결"로 보이지 않고 다음 교체일 칸에 MSG-18만 보인다. MSG-11은 띄우지 않는다(실패가 아니다).
- 열 때 재생성(AC-08-3): `event_id`가 있고 `events`에 없으며 날짜를 계산할 수 있는 행만 같은 id로 upsert한다. 조회는 `select id, title, start_at, category_id from events where user_id = 나 and id in (…)`를 100개씩 나눠 한다(NFR-11).
- 삭제: 항목·만기일은 일정 삭제(`delete … where id = event_id and user_id = 나`, 이미 없으면 0행이고 성공으로 본다) → 성공하면 행 삭제. 차량은 연결 일정을 하나씩 지우고 지울 때마다 그 행의 `event_id`를 null로 바꾼다. 하나라도 실패하면 거기서 멈추고 MSG-03, 차량 행은 남긴다(BR-22, AC-03-8). 모두 성공하면 차량 행을 지운다(딸린 행은 `on delete cascade`).
- 동기화 비교(BR-21): 위 조회로 읽은 `title`·`start_at`·`category_id`가 계산값과 모두 같으면 쓰지 않는다. 하나라도 다르면 행 전체를 upsert한다(BR-25 덮어쓰기).
- 일정 행 모양: `{ id, user_id, title, memo: null, category_id: '차계부' 카테고리 id, color: null, all_day: true, start_at: 날짜, end_at: 같은 날짜, recurrence: null, excluded_dates: null }`(기존 `eventToRow`와 같은 열).

## 결과
- 쉬워지는 것: 재시도·두 탭이 같은 id로 수렴(NFR-34). 행 저장 실패 시 고아 0. `event_id`가 연동 표시로 남아 AC-08-3과 BR-21이 함께 성립.
- 어려워지는 것: 캘린더에서 지운 일정은 DB가 알려주지 않으므로 열 때마다 조회 1~N회(연결 행 100개당 1회)가 든다. `event_id`가 가리키는 일정이 없을 수 있다는 점을 모든 코드가 감안해야 한다.
- 명세 영향(PO 확인 요청): BR-24 "일정 쓰기에 성공하면 연결 id를 행에 저장한다"를 "연결 id를 행 저장 때 함께 저장하고, 일정은 그 id로 쓴다"로, BR-23 잠정값을 "일정 삭제, 연결 id 유지"로 바꿔야 한다. 수락 기준 결과는 같다.

## 보완: `event_id`가 null인 기존 항목의 동시 첫 저장 (2026-11-06)
- 위험(QA, docs/qa/report.md F-1, AC-08-13): 추천 항목처럼 `event_id = null`인 행을 두 탭이 동시에 저장하면 탭마다 새 uuid(U1, U2)를 만들고 조건 없는 `update`는 마지막 쓰기가 이긴다(행 = U2). 두 탭 모두 `syncEvent`를 하므로 U1 일정이 아무 행도 가리키지 않는 고아로 남는다(NFR-34·35 위반). 만기일(insert + unique)·새 항목(행 id가 다름)·이미 `event_id`가 있는 항목은 문제없다.

| | 방법 | 결과 |
|---|---|---|
| A | 조건부 갱신: `event_id`를 정하는 저장은 `.is('event_id', null)` 조건을 붙인다. 0행이면 행을 다시 읽어 그 `event_id`를 쓴다 | 정상 경로 요청 1회 그대로. 경쟁 때만 읽기 1회 + 갱신 1회 추가. 진 탭은 이긴 탭의 id로 upsert하므로 일정 1건 |
| B | 먼저 `claimEventId`(조건부로 `event_id`만 갱신) → 항목 갱신 → `syncEvent` | 항상 요청 1회 추가 |
| C | DB 함수(RPC)에서 `coalesce(event_id, 새 id)` | 함수 1개 추가, 원자적. 차계부 쓰기는 지금 모두 PostgREST 직접 호출이라 규칙이 갈라짐 |

결정: **A.**
1. 화면 상태의 `event_id`가 null인 항목 저장: 새 uuid U → `update {입력 필드, event_id: U} where id = 항목 and user_id = 나 and event_id is null` + `.select()`.
2. 1행이면 U를 쓴다.
3. 0행이면 `select … where id = 항목`으로 다시 읽는다. 행이 없으면 기존 not-found 처리. `event_id`가 있으면 그 값을 E로 두고 `update {입력 필드}`(event_id 제외) 후 `syncEvent(E)`. 다시 읽은 `event_id`도 null이면(차량 삭제 도중 등) 1번을 한 번만 다시 하고, 또 0행이면 쓰기 실패(MSG-01)로 끝낸다.
4. 불변식: 이미 있는 `event_id`는 바꾸지 않는다. `event_id`를 쓰는 곳은 ① insert(`createItems`·`createDueDate`), ② 위 조건부 갱신, ③ 차량 삭제의 `clearEventId`(null로)뿐이다. 그 밖의 `updateItem`·`updateDueDate` 입력에는 `event_id`를 넣지 않는다.
- 쉬워지는 것: 두 탭이 같은 id로 수렴(AC-08-13 둘째 문장), 계약에 함수 하나 추가 없이 조건만 더함.
- 어려워지는 것: `updateItem`에 "null일 때만" 분기가 생긴다. 테스트는 0행 응답을 모의해 다시 읽기·이긴 id 사용을 확인해야 한다.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | OQ-2 결정 | Product Owner(conv-8c399a) | F-03, F-06, F-07, F-08, BR-23·24 문구 |
| 2026-11-06 | 보완: null `event_id` 동시 첫 저장은 조건부 갱신 + 0행이면 다시 읽기 | QA F-1(MPR-19) | Delivery Manager(conv-af3a17) | carbook.md 3장·6.2, MPR-19·24 |
