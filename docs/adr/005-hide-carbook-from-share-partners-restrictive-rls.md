# ADR-005 공유 상대 숨김: 새 파일의 RESTRICTIVE select 정책

- 상태: 승인 (2026-11-05, Product Owner 승인 — 메시지 2026-11-05T05-00-31-218Z-51ed15)
- 관련: F-16(BR-32, AC-16-1~7), NFR-27, PRD 8장(R-16과 AC-2 충돌 범위), tech.md T-2-4

## 배경
- `events_select_shared`, `categories_select_shared`(schema_share_mutual.sql)가 `is_share_partner(user_id)`로 공유 상대에게 select를 연다. 정책은 기본이 PERMISSIVE라 여러 개가 OR로 묶인다.
- 숨김 대상: ① 소유자의 '차계부' 카테고리(id 기준, ADR-004)에 속한 일정, ② 소유자의 교체 항목·만기일 `event_id`가 가리키는 일정, 그리고 '차계부' 카테고리 자체.
- 허용 범위: 새 마이그레이션 파일의 DB 정책만. 기존 `supabase/*.sql`, 캘린더 코드 불변. 소유자 본인과 차계부 아닌 일정의 공유 동작 불변.

## 선택지
| | 방법 | 범위 충족 |
|---|---|---|
| A | 새 파일에서 `as restrictive` select 정책 추가. RESTRICTIVE는 기존 PERMISSIVE 정책 결과에 AND로 붙는다 | 기존 정책·파일 불변. 새 파일만 |
| B | 새 파일에서 `drop policy events_select_shared` 후 조건을 더해 다시 만들기 | 새 파일이지만 기존 정책 정의를 바꿔 씀. 이후 기존 파일을 다시 실행하면 숨김이 사라짐 |
| C | 클라이언트(`useCalendar`)에서 걸러 내기 | 캘린더 코드 변경(불허), RLS가 아니라 화면 숨김(BR-33 위반) |

## 결정
A. `supabase/schema_carbook.sql`에 둔다(테이블 정의 다음).
- `public.is_carbook_linked_event(p_event_id uuid) returns boolean`: `security definer`, `stable`, `set search_path = public`. `car_maintenance_items` 또는 `car_due_dates`에 `event_id = p_event_id`인 행이 있으면 참. 공유 상대는 소유자의 차계부 테이블을 읽을 수 없으므로 정의자 권한이 필요하다(기존 `is_share_partner`와 같은 이유).
- events 정책(뜻): 아래 셋 중 하나면 통과.
  1. `auth.uid() = user_id` (소유자 불변, AC-16-2)
  2. `public.is_event_participant(id, false)` (기존 함께 일정 참여자 동작 불변)
  3. 숨김 대상이 아님: `category_id`가 null이거나 `carbook_category_id(user_id)`와 다르고, **그리고** `not is_carbook_linked_event(id)`
  - 주의: `category_id`가 null이면 `<>` 비교가 null이 되어 정책이 거짓이 된다. `coalesce(category_id <> carbook_category_id(user_id), true)`처럼 null을 참으로 처리한다(DB Engineer 구현 메모).
- categories 정책(뜻): `auth.uid() = user_id or id <> public.carbook_category_id(user_id)`.
- 이름: `events_select_hide_carbook`, `categories_select_hide_carbook`. 파일은 `drop policy if exists` 후 `create`로 다시 실행해도 안전하게 쓴다.
- 인덱스: `car_maintenance_items(event_id)`, `car_due_dates(event_id)`.

## 결과
- 쉬워지는 것: 공유 상대의 모든 select 경로(목록, 검색, 범례)가 DB에서 걸러진다(AC-16-1·6·7). 소유자·차계부 아닌 일정은 조건 1·3으로 그대로(AC-16-2·3). 기존 파일 0줄 변경(AC-16-5).
- 어려워지는 것: 공유 상대가 일정을 읽을 때 행마다 판정 함수가 돈다(인덱스 조회 2회). 1인·공유 소수 규모라 허용. 함께 일정 참여자로 초대된 사람은 '차계부' 카테고리 일정이라도 본다(조건 2) — 참여 기능의 기존 동작을 바꾸지 않기 위함이다. 카테고리는 참여자에게도 숨으므로 그 일정은 색 없이 보인다.
- 검증: DB 정책은 vitest로 확인할 수 없다. Database Engineer가 Supabase SQL 편집기에서 두 계정(소유자 A, 공유 상대 B)으로 AC-16-1~3·6·7 질의 결과를 `docs/db.md`에 남긴다.

## 보완: '차계부' 카테고리를 사용자가 지웠을 때 (2026-11-06)
- 위험(Database Engineer, docs/db.md 7장 한계 2): `events.category_id`는 `on delete set null`이다. 사용자가 '차계부' 카테고리를 지우면, 연결되지 않은(직접 만든) 그 카테고리 일정은 카테고리 없음이 되어 공유 상대에게 보인다. 연결 일정은 `is_carbook_linked_event`로 계속 숨는다.

| | 방법 | 결과 |
|---|---|---|
| A | 수용. 숨김 대상 ①은 "지금 '차계부' 카테고리에 속한 일정"으로 정의 | 사용자가 일정을 다른 카테고리로 옮긴 경우와 같은 뜻. 추가 코드 0 |
| B | '차계부' 카테고리 삭제를 RESTRICTIVE delete 정책으로 막기 | 캘린더 화면의 카테고리 삭제가 오류가 되어 캘린더 동작이 바뀜(AC-08-11·원본 범위 위반) |
| C | 삭제 전 트리거로 일정을 다른 표시로 옮기기 | 기존 테이블 트리거, 새 열 필요 → 범위 밖 |

결정: **A, 알려진 한계로 수용.** 사용자가 직접 카테고리를 지운 것은 분류를 푼 행동으로 본다. 다음에 차계부를 열면 `ensure`가 같은 id로 카테고리를 다시 만들고 연결 일정만 다시 묶는다(AC-08-14). 직접 만든 일정은 다시 묶지 않는다. 요구 해석이므로 Product Owner 확인을 요청했고, 2026-11-06 수용됐다(메시지 2026-11-06T03-48-01-609Z-e01b00, 01_prd.md 변경 기록).

## 보완: 남의 일정 id를 `event_id`에 넣어 숨기기 (2026-11-08)
- 위험(Security Reviewer Low-1, MPR-25 점검): `event_id`는 FK·소유 확인이 없다(ADR-003). 사용자 B가 자기 교체 항목·만기일의 `event_id`에 A의 일정 id(공유로 알 수 있음)를 넣으면 `is_carbook_linked_event`가 참이 되어, 그 일정이 A의 다른 공유 상대에게 숨는다(가시성 방해. 읽기 유출은 없음, A 본인은 계속 봄).

| | 방법 | 결과 |
|---|---|---|
| A | 수용 | 공유 상대 누구나 A의 일반 일정을 A의 다른 공유 상대에게서 숨길 수 있음 |
| B | car_* insert·update `with check`에 "그 `event_id`가 이미 남의 일정이면 거부"(definer 함수) | 쓰기마다 events 조회. 일정보다 행이 먼저 저장되는 순서(ADR-003)에서는 아직 일정이 없어 통과 → 나중에 남이 같은 id로 일정을 만들면 못 막음 |
| C | 판정 함수가 **일정 소유자의 행만** 본다: `is_carbook_linked_event(p_event_id, p_owner)` = `exists(... where event_id = p_event_id and user_id = p_owner)`, 정책은 `not is_carbook_linked_event(id, user_id)` | 남이 넣은 `event_id`는 판정에 영향 없음. 쓰기 경로·클라이언트 변경 0. 함수·정책 정의만 바꿈 |

결정: **C.** 숨김의 뜻("소유자 자신의 차계부 연결 일정")과 정확히 같고, 쓰기 순서와 무관하게 막는다. 남의 `event_id`가 든 행은 그 사용자에게 고아 연결일 뿐이고(자기 upsert는 RLS로 남의 일정을 못 바꿈), 열 때 점검에서는 `user_id = 나` 조회라 "없음"으로 보고 같은 id로 upsert → 남의 행과 충돌해 실패(MSG-11)한다. 1인 사용 규모에서 악의적 입력에만 생기는 상태라 수용.
- 후속 티켓 MPR-43(Database Engineer).

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | R-16 숨김 방법 결정 | Product Owner(conv-8c399a) | F-16 |
| 2026-11-06 | 보완: 카테고리 삭제 시 직접 만든 일정 노출을 알려진 한계로 수용 | MPR-18 검토 위험 2 | Database Engineer(conv-49f5a7) | PO 확인 요청 |
| 2026-11-06 | 보완 절 PO 수용 | PO 확인(e01b00) | Product Owner | Spec Writer가 F-16 숨김 대상 ① 문구 수정 |
| 2026-11-08 | 보완: 판정 함수가 일정 소유자의 행만 보게(C) | Security Low-1 | Delivery Manager(conv-bbc106) | MPR-43 |
