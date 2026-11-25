<!-- v0.2 릴리스 후보 점검 결과와 알려진 문제를 적은 판정서 (Release Manager) -->
# v0.2 릴리스 후보 판정서 (docs/release/verdict-v0.2.md)

- 작성: Release Manager · 2026-11-25 · 후보 태그: `v0.2.0-rc.1`
- 점검한 코드: main `c7160ba`(MPR-74 병합본). 그 뒤 커밋은 docs뿐이며 `src`·`package*.json`은 같다.
- 상태: **READY.** 차단 항목은 없다. QA 결함 D-1(P2, 로그아웃 실패 시 화면 사라짐)은 사용자가 "알려진 문제로 두고 배포"로 결정했다(god 전달, 2026-11-25). **운영 배포 완료(2026-11-25).** 사용자가 운영 Supabase에 `schema_carbook_v02.sql`을 적용(db.md 8.4 1~4단계)한 뒤 Vercel Promote를 했다(사용자 보고, god 전달). 8.4 5단계(2계정 확인)는 아직 하지 않았다. Promote된 커밋 해시는 보고에 없고, `src`는 c7160ba 이후 바뀐 것이 없다. 배포 태그는 `v0.2.0`이다. 코드 롤백 대상은 v0.1.0(30ad92b)이다.

## 1. 배포 범위

- 운영 기준은 v0.1.0(`30ad92b`). 코드 롤백 대상은 v0.1.0 배포(30ad92b)이며 Vercel Instant Rollback으로 되돌린다(docs/release.md 3장).
- v0.1 이후 변경: MPR-61~71, 73, 74(기본 차량 설정, 추천 교체 주기 되돌리기, 계정 메뉴·로그아웃, 로그인 실패·만료 안내, 교체 알림 탭 개선).
- DB 변경: `supabase/schema_carbook_v02.sql`(`car_settings` 테이블 추가, `last_date` not null 해제). **운영에 아직 적용되지 않았다.** 기존 행은 바뀌지 않는다(PO 조건).

## 2. 배포 순서 (바꾸면 안 된다)

1. 사용자가 Supabase SQL Editor에서 `schema_carbook_v02.sql`을 운영에 적용한다. **실행 직전에 god가 SQL을 재승인한다(R-24).** 팀은 운영 DB에 접근할 수 없고 백업도 없다(무료 요금제).
2. 적용 직후 docs/db.md 8.4의 4·5단계(운영 RLS: anon 접근 차단, 두 계정 간 격리)를 확인한다.
3. 그다음에 Vercel에서 Promote한다(docs/release.md 1장). Preview Promote는 완전 재빌드이며 Production 환경변수를 쓴다.
4. 순서를 거꾸로 하면(Promote 먼저) 새 코드가 차량을 추가할 때 `last_date` not null 때문에 23502 오류가 난다.
5. 되돌림: 코드는 Vercel Instant Rollback. DB는 docs/db.md 5·8장의 DOWN SQL이며 Michael 승인이 필요하다.

## 3. 실행한 점검 (main c7160ba, 깨끗한 복사본 `npm ci`)

| 점검 | 명령 | 결과 |
|---|---|---|
| 전체 테스트 | `vitest run --maxWorkers=2 --testTimeout=60000` | **104 files, 1274 passed, exit 0** (438s). 앞선 a0d6f9d에서는 1273 passed |
| 타입 검사 | `tsc -b` | exit 0 |
| 빌드 | `vite build` | exit 0 |
| 린트 | `oxlint` | exit 0, 오류 0 (경고는 대부분 `docs/` 아래 QA·성능 스크립트) |
| 보안 | Security Reviewer 전체 점검(a0d6f9d) | Critical 0, High 0, Medium 0, Low 4. `npm audit --omit=dev` 취약점 0 |
| 성능 | Performance Engineer(a0d6f9d 대 87f6f44) | **MEETS.** 번들 gzip 235.8→265.3kB(+29.5kB, +12.5%), vendor 증가 0, 첫 로드 FCP·LCP 차이 오차(±30ms) 안, 탭 전환 p95 32.6ms |
| QA(실브라우저) | QA Engineer(a0d6f9d) | **조건부 PASS.** AC-04-9 열기 36회 중앙 1126.5ms·p95 1359ms·2초 초과 0, AC-04-10 저장 p95 375ms, AC-01-7 탭 전환 p95 12ms, AC-18-11 로그아웃 p95 718ms. AC-19·20·21·24·26·27·28 전부 PASS, AC-18은 31건 중 29건 PASS, 2건 FAIL(D-1) |
| 접근성 | Accessibility Auditor(a0d6f9d, 재점검은 MPR-74 브랜치 a14c4de) | 1차에서 K1 Serious·K2 Moderate 차단, MPR-74 수정 뒤 **재점검 통과(차단 없음)**. axe 0건 |

- 병합본 c7160ba에 대한 QA 전체 재실행은 하지 못했다(QA 머신 메모리 부족, A절 45건만 통과 확인). MPR-74는 `src/carbook/components` 17파일 변경이고 접근성 재점검과 위 전체 테스트(1274)가 이를 덮는다. 필요하면 QA가 c7160ba 기준 AC-19·27 화면을 다시 돌린다.
- 모의 서버라 실제 Supabase 지연과 RLS(AC-19-9, AC-27-2)는 보지 못했다.

## 4. 알려진 문제와 결함 목록

**알려진 결함 (P2, 사용자 결정: 알려진 문제로 두고 배포)**

- **D-1 AC-18-6**: 로그아웃 요청이 500·503·오프라인으로 실패하면 MSG-23은 뜨지만 계정 영역과 차계부 화면이 사라지고 로컬 토큰이 지워진다. 스펙은 화면이 그대로여야 한다. 서버 세션은 남는다(다른 기기는 그대로). 원인 후보는 supabase-js `signOut`이 401·403·404 외 오류에서도 로컬 세션을 지우는 동작이고 `src/carbook/data/auth.ts` 래퍼가 복원하지 않는 점이다. 사용자가 ③ 알려진 문제로 두고 배포를 택했다. 후속 수정(실패 시 세션 복원)은 다음 버전 티켓 후보이고 이번 RC 코드에는 넣지 않는다. QA 관찰: 서버 세션과 서버 데이터는 그대로이고 이 기기의 로컬 토큰만 지워진다(다시 로그인 필요).

**이월 항목 (차단 아님)**

- AC-04-9: v0.1의 조건부가 이번 재측정에서 충족으로 바뀌었다(중앙 1.13s, p95 1.36s). 단 모의 서버·가정 지연값이다.
- 접근성 Minor: N1 중첩 대화상자의 만료 안내가 확인창을 닫으면 양식에서 사라짐, N2 기본 차량 저장 완료 낭독 없음, N3 계정 버튼 긴 이메일 말줄임·이메일 미낭독, N4 MPR-70 Minor(미입력 항목 안내 줄이 마지막 항목 완료 시 조용히 사라짐, describedby를 Overlay 공용 속성으로 두는 편이 안전), N5 높이 640px 미만에서 만료 안내가 본문 끝에 있어 스크롤 전엔 안 보임(낭독은 됨).
- 보안 Low 4: Low-1 UP SQL에 `begin`/`commit` 없음, Low-2 `car_settings`에 `revoke ... from anon` 없음(정책이 `to authenticated`라 악용 불가, 이중 방어), Low-3 `vercel.json`에 보안 헤더·CSP 없음(최소 `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'` 권고), Low-4 계정 사진 URL을 `https:` 접두만 확인.
- 성능 선택(P3): `/car`를 `React.lazy`로 분할하면 캘린더 전용 사용자의 다운로드가 v0.1 수준으로 돌아온다.
- StatsTab '달 이동 범위'는 부하 시 시간 초과로 가끔 실패한다(단독 실행은 통과).
- 린트 경고(위 표).
- 보안 점검이 확인하지 못한 것: Supabase Redirect URLs 와일드카드 여부, SQL Editor가 UP을 한 트랜잭션으로 돌리는지.
- 미확인: 실서버 401 흐름, 실제 NVDA·VoiceOver 낭독, Windows 고대비, 실기기 가상 키보드, 실제 Google 로그인 리디렉션.

## 5. AC 불변 확인

- 캘린더 코드 불변(AC-2): `git diff v0.1.0 c7160ba --name-only -- src ':!src/carbook'` 결과가 0줄이다. v0.1.0 이후 `src` 변경(60파일 +3297/-196)은 전부 `src/carbook` 안에 있고 `useCalendar`·`useAuth`·`AuthButton`·`Overlay.tsx`를 포함한 캘린더 쪽 파일은 바뀌지 않았다.

## 6. 배포 후 확인 목록 (사용자)

- [x] 운영 SQL 적용과 `db.md` 8.4 1~4단계(사용자 보고, 4단계 쿼리 값은 보고에 없음). Promote 완료(사용자 보고).
- [ ] **`db.md` 8.4 5단계 미실시:** 실제 계정 기본 차량 지정·해제, 2계정 남의 차량 id 거부, anon 거부(`car_settings` 포함). 운영 계정은 팀에 넘기지 않으므로 god가 만든 가장(impersonation) SQL을 사용자가 SQL Editor에서 돌려 확인한다(전부 롤백). 결과는 god가 알린다.
- [ ] Promote 후 로그인 상태에서 캘린더 첫 화면과 일정 추가·삭제.
- [x] `/car` 진입(사용자 직접 확인, god 전달 11-25)(로그아웃 상태 → Google 로그인 → `/car` 복귀).
- [x] 차량 추가는 사용자 직접 확인(god 전달 11-25, 오류 보고 없음). 기본 차량 설정·기록 1건 저장은 보고에 없음(이때 23502가 나면 SQL 적용 순서가 틀린 것), 기본 차량 설정, 기록 1건 저장.
- [x] 로그아웃 사용자 직접 확인(god 전달 11-25). 다시 로그인은 보고에 없음.
- [ ] 문제 시 Vercel Instant Rollback, DB 되돌림은 db.md 5장 DOWN과 Michael 승인.

## 7. 판정

**READY.** 전체 테스트·타입·빌드·린트, 보안(Critical·High·Medium 0), 성능(MEETS), 접근성(재점검 통과)이 통과했고 차단 항목은 없다. D-1은 사용자 결정으로 알려진 문제에 둔다. 배포는 2장 순서를 따른다: 운영 DB `schema_carbook_v02.sql`을 사용자가 직접 적용하고(실행 직전 god 재승인), 그 뒤 Promote한다. RC 코드는 c7160ba(태그 `v0.2.0-rc.1`은 이 판정서 커밋)이다. Release Manager는 배포와 운영 SQL을 실행하지 않는다.
