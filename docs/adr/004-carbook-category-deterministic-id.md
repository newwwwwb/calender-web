# ADR-004 '차계부' 카테고리: 사용자별 고정 id + DB 함수 `ensure_carbook_category()`

- 상태: 제안 (2026-11-05, Software Architect)
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

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | OQ-2 결정 | Product Owner(conv-8c399a) | F-08, F-16, 원본 6장 문구 |
