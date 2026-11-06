# ADR-004 '차계부' 카테고리: 사용자별 고정 id + DB 함수 `ensure_carbook_category()`

- 상태: 승인 (2026-11-05, Product Owner 승인 — 메시지 2026-11-05T05-00-31-218Z-51ed15)
- 관련: PRD OQ-2(tech.md Q5), F-08(BR-19, AC-08-4·13·14), F-16(숨김 대상 1번, SQ-9), 원본 6장

## 배경
- 사용자당 '차계부' 카테고리는 1개(BR-19). 두 탭이 동시에 처음 연동해도 1개(AC-08-13).
- `categories`에는 이름 유일 제약이 없다. "이름으로 찾고 없으면 만들기"는 동시 실행에서 2개가 생긴다(T-2 위험 6).
- F-16은 숨김 대상을 이름이 아니라 **그 카테고리의 id**로 판정한다(SQ-9). 공유 상대의 읽기를 막는 DB 정책이 "이 사용자의 차계부 카테고리 id"를 알아야 한다.
- 제약: 새 테이블은 원본 4개뿐, 기존 `supabase/*.sql` 불변(PRD 8장).

## 선택지
| | 방법 | 중복 방지 | 정책이 id를 아는 방법 | 비고 |
|---|---|---|---|---|
| A | id = `md5('carbook-category:' || user_id)::uuid`(사용자별 고정). `ensure_carbook_category()`가 `insert … on conflict (id) do nothing` 후 id 반환 | PK가 보장 | 같은 식을 정책에서 계산(테이블 조회 없음) | 새 테이블 0, 새 함수 2개 |
| B | 이름 부분 유일 인덱스 `(user_id) where name = '차계부'` | DB 보장 | 이름으로 판정 → 사용자가 이름을 바꾸면 노출, SQ-9(id 기준)와 어긋남 | 기존 데이터에 같은 이름이 2개 있으면 마이그레이션 실패 |
| C | 카테고리 id를 담을 5번째 테이블 | 경쟁 처리 별도 필요 | 테이블 조회 | 원본 "새 테이블 4개" 위반 |
| D | 이름으로 찾기 → 없으면 만들기(원본 6장 그대로) | 안 됨(AC-08-13 위반) | 판정 불가 | — |

## 결정
A.
- `public.carbook_category_id(p_user uuid) returns uuid`: `immutable`, 위 식. 클라이언트는 이 식을 직접 계산하지 않는다.
- `public.ensure_carbook_category() returns uuid`: `security invoker`(RLS를 그대로 탐). `auth.uid()`가 null이면 오류. `insert into categories (id, user_id, name, color) values (carbook_category_id(auth.uid()), auth.uid(), '차계부', '#0f9d58') on conflict (id) do nothing` 후 id 반환. 이미 있으면(이름·색을 사용자가 바꿨어도) 손대지 않는다.
- 클라이언트는 연동이 필요한 첫 순간(일정 쓰기 직전, 열 때 재생성·재묶기 직전)에 `supabase.rpc('ensure_carbook_category')`를 한 번 부르고 결과 id를 화면 수명 동안 기억한다.
- 재묶기(AC-08-14): 열 때 조회한 연결 일정 중 `category_id`가 그 id와 다른 것은 `update events set category_id = id where user_id = 나 and id in (…)`. 사용자가 카테고리를 지웠으면 `ensure`가 같은 id로 다시 만든다.

## 결과
- 쉬워지는 것: 동시 실행에서도 1개(PK). 정책이 테이블 조회 없이 id를 판정(F-16). 카테고리를 지웠다 다시 만들어도 같은 id.
- 어려워지는 것: **원본 6장 "이미 있으면 그것을 쓴다(이름으로 찾는다)"와 다르다.** 차계부 도입 전에 사용자가 손으로 만든 '차계부' 이름의 카테고리는 재사용하지 않고, 같은 이름의 카테고리가 하나 더 생긴다. 그 수동 카테고리의 일정은 F-16 숨김 대상이 아니다. → PO 승인 필요(02_architecture 11장 D-2).

## 보완: 고정 id 선점 막기 (2026-11-06)
- 위험(Database Engineer, MPR-18 검토, docs/db.md 7장 한계 1): id는 `user_id`만으로 정해지고 `categories.id`는 클라이언트가 넣는다. 공유 상대 B는 A의 uuid를 알므로 `id = carbook_category_id(A), user_id = B`로 먼저 넣을 수 있다. 그러면 A의 `ensure`는 do nothing이 되고, A의 차계부 일정이 B 소유 카테고리를 가리킨다. B가 그 이름·색을 바꾸거나 지울 수 있다(무결성 문제. A 일정의 숨김은 `carbook_category_id(A)` 비교라 그대로 유지).

| | 방법 | 결과 |
|---|---|---|
| A | 수용(알려진 한계) | 공유 상대가 A의 범례·일정 색을 망칠 수 있음 |
| B | 새 파일에 categories **RESTRICTIVE insert·update 정책**: 남의 고정 id 거부 | 정책만 추가(ADR-005와 같은 허용 범위), 기존 파일 불변. 카테고리 쓰기마다 사용자 수만큼 md5 계산(소수 사용자 규모라 허용) |
| C | 트리거로 거부 | 효과는 B와 같으나 기존 테이블에 트리거를 거는 것은 "새 파일의 정책만" 범위를 넘음 |
| D | 비밀 값을 섞은 id | 비밀 보관 장소(테이블·설정)가 새로 필요, 정책이 조회 없이 계산 불가 → ADR-004 결정 근거가 무너짐 |

결정: **B.**
- `public.is_carbook_category_id(p_id uuid) returns boolean`: `security definer`, `stable`, `set search_path = public`. `exists (select 1 from auth.users u where public.carbook_category_id(u.id) = p_id)`. execute는 `authenticated`만.
- 정책 `categories_write_guard_carbook_id`: `as restrictive for insert` 및 같은 조건의 `for update`. `with check (id = public.carbook_category_id(user_id) or not public.is_carbook_category_id(id))`.
- `ensure_carbook_category()`는 insert 뒤 그 id 행의 `user_id`가 `auth.uid()`가 아니면 오류를 낸다(정책 전 데이터 등 예외 상황을 조용히 넘기지 않기 위함).
- 확인: B가 A의 고정 id로 insert·update → `42501`. A의 `ensure`, 일반 카테고리 추가·수정은 그대로 성공. 후속 티켓 MPR-42.

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | OQ-2 결정 | Product Owner(conv-8c399a) | F-08, F-16, 원본 6장 문구 |
| 2026-11-06 | 보완: 고정 id 선점 막는 RESTRICTIVE insert·update 정책 | MPR-18 검토 위험 1 | Database Engineer(conv-49f5a7) | MPR-42 |
