<!-- 릴리스 후보 점검 결과와 알려진 문제를 적은 판정서 (Release Manager) -->
# 릴리스 후보 판정서 (docs/release/verdict.md)

- 작성: Release Manager · 2026-11-21 · 후보 태그: `v0.1.0-rc.1` (SemVer 제안, 최종 태그는 승인 뒤 확정)
- 점검한 코드: main `c7a3494` 기준(그 뒤 커밋은 이 판정서뿐이며 `src`·`package*.json`은 같다)
- 상태: **READY(god 최종 QA 통과), 배포하지 않았다.** 운영 배포(수동 Promote)는 사용자 승인 뒤 사용자가 한다.

## 1. 배포 범위 (DevOps 조사 반영)

- 운영의 마지막 Production은 `87f6f44`(2026-10-08)이다. main 푸시는 2026-11-05부터 Preview로만 배포됐다.
- Promote하면 운영은 `87f6f44` 이후 main 커밋 약 260개를 **한 번에** 받는다(차계부 포함). 판정 범위는 이 전체다. `src`는 92파일 +8,963/-4줄이다.
- 87f6f44 이후 DB 변경은 `supabase/schema_carbook.sql` 하나이고 운영에 2026-11-18 적용됐다(docs/db.md, 운영 RLS 확인은 조건부 PASS).
- Promote는 Preview 빌드를 다시 빌드하지 않고 승격한다. Preview 환경변수 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`가 운영 프로젝트 값인지 사용자가 먼저 확인한다(docs/release.md 1장 4번).
- Preview 주소에서 로그인하면 운영으로 튕길 수 있다(Redirect URLs 미등록). Preview 확인은 로그아웃 화면까지만 한다(docs/release.md 2장).
- 절차와 롤백은 docs/release.md를 따른다.

## 2. 실행한 점검

| 점검 | 명령 | 결과 |
|---|---|---|
| 전체 테스트(깨끗한 복사본, `npm ci` 0) | `vitest run --maxWorkers=2 --testTimeout=60000` | **97 files, 1129 passed, exit 0** (164s) |
| 전체 테스트(공유 폴더) | 같은 명령 | 96 passed, 1 failed 파일: `supabase/schema_carbook.test.ts`가 `@electric-sql/pglite` 미설치로 로드 실패. 나머지 1108개 통과. 공유 폴더의 `node_modules`가 오래돼 생긴 환경 문제이고, 깨끗한 복사본에서는 21개 모두 통과했다 |
| 타입 검사 | `tsc -b` | exit 0 (공유·깨끗한 복사본 모두) |
| 빌드 | `vite build` | exit 0 (12.7s), `dist` 708KB, `dist`에 pglite 0개 |
| 린트 | `oxlint` | exit 0, **오류 0, 경고 63건**. 경고 56건은 `docs/` 아래 QA·성능 스크립트이고 `src` 7건(react 규칙: set-state-in-effect 3, only-export-components 2, immutability 1 외)은 차단 규칙이 아니다 |

## 3. AC-08-11 예외 확인

- 근거 문서: docs/01_prd.md 변경 기록 2026-11-18, docs/02_architecture.md 1·9장(사용자 승인).
- 실행: `git diff 30ad796^ main --stat -- src/state/useCalendar.tsx src/components src/storage src/lib` → `Overlay.tsx` +15줄, `Overlay.stack.test.tsx` +75줄뿐이다. `useCalendar.tsx` 0줄. `App.tsx`는 `App()` 함수와 import만 바뀌었다(`CalendarApp` 본문 0줄).
- 기존 캘린더 테스트는 위 전체 테스트에서 모두 통과했다.

## 4. 병합되지 않은 브랜치 정리

- `agent/devops-engineer-mw30cugs`: `docs/release.md`(2d0e64e)를 `c7a3494`로 병합했다. 그 전 db.md 커밋은 `4f289b6`·`d0cadfc`에 들어 있다.
- 나머지 브랜치는 main보다 앞선 것이 없다. 예외 2개: `agent/backend-developer-mw30cjiw`(d4dda1e, MPR-20)와 `agent/frontend-developer-mw30c11h`(0e1de21, MPR-29)는 쪼개진 티켓으로 나중에 병합된 파일(`validation.ts`, `navigation.ts`)이 main에 따로 있어 원본 커밋은 쓰이지 않는다. 지우지 않았고 병합하지 않는다.
- 작업 폴더가 붙은 브랜치는 지울 수 없어 그대로 둔다.

## 5. 알려진 문제 (차단 아님)

1. AC-04-9 조건부 PASS: 모의 서버 80회 중앙 1.17s, p95 2.22s(7회가 2초 초과, 한 건은 HTML 응답 지연 4.7s). 릴리스 후보를 한가한 머신·실제 지연으로 재측정 권장.
2. P3: 1280px 교체 알림 탭의 '캘린더 반영 실패, 다시 시도' 버튼이 3줄로 접혀 글자 중간에서 끊긴다(375px 정상). 별도 티켓.
3. P3: 만기일 탭 모바일에서 확인창 퇴장 중 약 0.7초 포커스가 body에 있다(최종은 '입력'으로 복구).
4. 운영 RLS 확인(MPR-48)은 조건부 PASS다. 운영 gzip 응답은 배포 시점에 확인한다(Performance 권고).
5. 린트 경고 63건(위 표).

## 6. 배포 후 확인 목록 (사용자)

- [ ] `/car` 로그인 진입(AC-02-1·2 운영): 로그아웃 상태 `/car` → Google 로그인 → `/car` 복귀. **사용자 확인.**
- [ ] 로그인 상태 캘린더 첫 화면과 일정 추가·삭제.
- [ ] 차계부 기록 1건 저장 후 캘린더에 반영되는지.
- [ ] 공유 링크 수락 화면 동작.
- [ ] 문제 시 Vercel Instant Rollback(docs/release.md 3장), DB 되돌림은 db.md 5장 DOWN과 Michael 승인.

## 7. 판정

**READY.** 릴리스 후보 점검은 위 범위에서 모두 통과했고 차단 항목은 없다. god 최종 QA(2026-11-21, conv-e9e3bf)가 5f66e40을 깨끗한 복사본(`npm ci`)에서 독립 예시 6건(AC-6 연비 2, AC-7 개월 주기, AC-10 3건, AC-11 월 합계)과 App.signedOut·navigation·FileTabs·schema_carbook 5 files 43 passed로 통과시켰다. RC 커밋은 5f66e40(태그 `v0.1.0-rc.1`)이고, 운영 Promote는 사용자 승인 뒤 사용자가 docs/release.md 1장대로 한다.
