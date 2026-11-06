# ADR-006 RLS 회귀 테스트: PGlite를 devDependency로 추가해 vitest에서 실행

- 상태: 제안 (NFR-16 예외 여부는 Product Owner 결정 대기)
- 관련: MPR-17(AC-03-2, AC-03-6), MPR-18(F-16 숨김 정책), NFR-16, `docs/qa/scripts/mpr17_rls.mjs`(커밋 562d4ff), `docs/qa/report.md` MPR-17

## 배경
- QA는 `schema_carbook.sql`의 RLS·제약 24개 케이스를 PGlite(WASM으로 도는 Postgres)로 확인했다(`RESULT pass=24 fail=0`). PGlite를 임시 폴더에 손으로 설치해야 해서 `npm test`에 들어가지 않는다. 스키마가 바뀌어도(MPR-18 등) 자동으로 다시 확인되지 않는다.
- 로컬에 Postgres·Docker·Supabase CLI가 없다(docs/db.md 4장).
- 제약: NFR-16 "새 npm 패키지 0개", 점검 방법 "`package.json` 의존성 변경 0줄"(06_traceability). 문구상 devDependency도 걸린다.

## 선택지
| | 방법 | 자동 회귀 | NFR-16 |
|---|---|---|---|
| A | `@electric-sql/pglite`를 **devDependency**로 고정 버전 추가. vitest 테스트 파일이 스키마 파일을 읽어 24개 케이스 실행 | `npm test`마다 실행 | 문구상 위반 → PO 예외 승인 필요. 앱 번들에는 들어가지 않음(테스트 파일만 import) |
| B | 지금처럼 QA 스크립트를 임시 설치로 손 실행 | 없음. 스키마가 바뀔 때마다 사람이 돌려야 함 | 준수 |
| C | `npx`로 테스트 때마다 받아 실행 | 네트워크 필요, 버전 고정 어려움, `npm test`와 따로 돎 | 준수하나 재현성 낮음 |

## 결정(제안)
A. 단, PO가 NFR-16 예외를 승인할 때만. 승인되지 않으면 B를 유지한다.
- 버전: `0.2.17` **정확히 고정**(`^` 없이). QA가 24개 케이스를 이 버전으로 통과시켰다. 최신 0.5.x로 올리는 것은 별도 티켓.
- 파일: `supabase/schema_carbook.test.ts`(대상 옆). 첫 줄 `// @vitest-environment node`(기본 환경이 jsdom이라 WASM 로딩을 node로 돌린다).
- `src/**`(앱 코드)에서 PGlite를 import하지 않는다. 그래서 `vite build` 결과물은 바뀌지 않는다.
- 한계: PGlite는 실제 Supabase·PostgREST가 아니다. 운영 확인(docs/db.md 6장)을 대신하지 않는다.

## 결과
- 쉬워지는 것: MPR-18 등 스키마 변경 뒤 `npm test` 한 번으로 RLS 회귀를 잡는다. QA가 임시 설치를 반복하지 않는다.
- 어려워지는 것: `node_modules`가 약 수십 MB 늘고 `npm test`가 PGlite 시작 시간(수 초)만큼 느려진다. NFR-16 점검 문구를 "dependencies 변경 0줄, devDependencies는 승인된 것만"으로 고쳐야 한다(Spec Writer).

## 변경 기록
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-06 | 최초 작성(제안) | RLS 회귀 테스트 티켓 요청 | Delivery Manager(conv-c368a6) | NFR-16, MPR-39 |
