# QA 보고서

- 소유자: QA Engineer · 기준 문서: [03_spec.md](../03_spec.md) F-08 · 판정 규칙: 증거가 없거나 모호하면 FAIL

## MPR-19 차계부 데이터 계약 문서 (`docs/api/carbook.md`)

- 검증 대상: main 커밋 `1771744`, `618e9ef` (`git branch --contains` → main 포함, 확인함).
- 이 티켓은 문서다. 실행할 코드가 없으므로 "계약이 수락 기준을 충족하는 구조를 명시하는가"를 문서 줄 번호로 확인했다. 동작 검증(AC 실행)은 구현 티켓(MPR-25 등)에서 한다.

| 티켓 | 기준 | 케이스 | 판정 | 근거(명령·위치) |
|---|---|---|---|---|
| MPR-19 | AC-08-3 "캘린더에서 지운 일정은 `/car`를 열면 같은 제목·날짜로 다시 생기고 항목당 1건" | 정상: 일정이 없으면 같은 id로 다시 쓴다 | PASS | `carbook.md` 6.4 3번(`fetchEvents`에 없는 id → `syncEvent(spec, null)`), 4.2 `syncEvent`가 `eventId`로 `upsert onConflict id` |
| MPR-19 | AC-08-3 | 경계: 연결 id 101개 | PASS | 4.2 `fetchEvents` 100개씩 나눠 조회, ADR-003 "열 때 재생성" |
| MPR-19 | AC-08-3 | 예외: 계산 불가면 만들지 않음 | PASS | 6.4 3번 "계산 불가면 건너뜀"(BR-23과 일치) |
| MPR-19 | AC-08-13 "첫 저장을 두 탭이 동시에 해도 카테고리 1개" | 정상: 고정 id RPC, 이름 검색 없음 | PASS | 5장 "멱등 … 두 탭이 동시에 불러도 같은 id, 카테고리 1개", ADR-004 |
| MPR-19 | AC-08-13 "탭 A 엔진오일, 탭 B 보험 만기 → 각 일정 1건" | 정상: 만기일 | PASS | 6.2 만기일 저장 `createDueDate`(insert) → `syncEvent`. `(vehicle_id, kind)` unique라 같은 종류 둘째는 `23505`로 일정 쓰기 전에 실패(1.1 표 2행, 7.3) |
| MPR-19 | AC-08-13 "같은 항목을 두 탭에서 동시에 저장해도 연결 일정 1건" | 실패/경계: `event_id`가 `null`인 기존 항목(추천 항목 등)을 두 탭이 동시에 저장 | **FAIL** | 아래 F-1 |

### F-1 (MPR-19 · AC-08-13 둘째 문장): 같은 항목 동시 첫 저장 시 일정이 2건이 될 수 있다

- 기대: 같은 항목을 두 탭에서 동시에 저장해도 연결 일정 1건(AC-08-13).
- 문서의 흐름: `docs/api/carbook.md` 6.2 "항목 저장·교체 완료" = "`event_id`가 없으면 새 uuid → `updateItem`(그 `eventId` 포함) → `syncEvent`". `updateItem`은 조건 없는 `update … eq('id', id)`이고(3장 질의 대응 표), 돌려받은 행의 `event_id`를 쓰라는 규정이 없다.
- 재현 절차(계약대로 구현했을 때):
  1. 추천 항목(`event_id = null`)이 있는 같은 계정으로 탭 A, B를 연다.
  2. 두 탭에서 같은 항목에 날짜를 넣고 동시에 저장한다.
  3. A는 uuid `U1`, B는 `U2`를 만들어 `updateItem`(마지막 쓰기가 이김, 행에는 `U2`)을 하고 각자 `syncEvent`로 `events`에 `U1`, `U2` 일정을 만든다.
- 실제(문서 분석 결과): `events`에 일정 2건, 행은 `U2`만 가리킴. `U1` 일정은 아무 행도 가리키지 않아 지워지지 않고 열 때 점검(6.4)도 모른다(NFR-34·35 위반).
- 같은 문제가 없는 경로: 만기일(`insert` + unique), 이미 `event_id`가 있는 항목(같은 id로 수렴), 새 항목 추가(탭마다 행 id가 달라 서로 다른 항목).
- 해결은 계약 쪽 결정이다(예: `updateItem`에 `event_id is null` 조건부 갱신을 두고 0행이면 행을 다시 읽어 그 `event_id`로 `syncEvent`). 방법은 API Designer·Software Architect가 정한다. QA는 코드와 계약을 고치지 않는다.
- 상태: MPR-19 done **보류**. AC-08-3은 문서상 충족.

## MPR-17 차계부 테이블 4개·RLS (`supabase/schema_carbook.sql`)

- 검증 대상: main `51d5c5c`(병합), 이후 `ea330a7`. 한계: **PGlite(WASM Postgres) 모의 환경이며 실제 Supabase·PostgREST가 아니다.** 운영 확인은 `docs/db.md` 6장 항목으로 남아 있다.
- 범위: MPR-17의 파일은 SQL과 `docs/db.md`뿐이다. AC-03-6의 "연결 일정이 캘린더에서 사라짐"은 클라이언트 동작(BR-22)이라 이 티켓에서 판정하지 않고, 구현 티켓에서 확인한다. 여기서는 "차량과 딸린 행 삭제, 다른 차량 그대로"를 확인했다.
- 실행: `node docs/qa/scripts/mpr17_rls.mjs <pglite index.js 경로>` → `RESULT pass=24 fail=0` (PGlite 0.2.17을 임시 폴더에 설치, package.json 변경 없음).
- 병합 후 `npm test` → `Tests 703 passed (703)`, `npm run build` → `built in 490ms`.

| 티켓 | 기준 | 케이스 | 판정 | 실행 명령 |
|---|---|---|---|---|
| MPR-17 | AC-03-2 타 계정 격리 | 정상: A는 자기 차량 추가(user_id 자동 채움) | PASS | `node docs/qa/scripts/mpr17_rls.mjs …` |
| MPR-17 | AC-03-2 | B가 4개 테이블 조회 → 0행, A 차량 id 직접 조회 0행 | PASS | 같음 |
| MPR-17 | AC-03-2 | B가 A 차량 수정·삭제 → 0행 바뀜, A 데이터 그대로 | PASS | 같음 |
| MPR-17 | AC-03-2 | 실패: B가 `user_id=A`로 insert, A 차량에 기록·항목·만기일 insert → `42501` | PASS | 같음 |
| MPR-17 | AC-03-2 | 경계: 로그인 없음 조회 0행, `anon` 조회 `42501` | PASS | 같음 |
| MPR-17 | AC-03-2 | 만기일 (차량, 종류) 중복 → `23505` | PASS | 같음 |
| MPR-17 | AC-03-6 (DB 부분) | 차량 삭제 → 기록·항목·만기일 0건, 다른 차량의 3종 1건씩과 차량 행 유지 | PASS | 같음 |
| MPR-17 | AC-03-6 (캘린더 일정 삭제) | 이 티켓 범위 밖 | 해당 없음 | 구현 티켓(차량 삭제 흐름)에서 확인 |

판정: MPR-17 **PASS**. 비차단 메모: 실제 Supabase에서의 `anon` 동작·grant 기본값은 운영 적용 전 확인 필요(`docs/db.md` 6장).
