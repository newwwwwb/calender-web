# 문서와 결정

## 문서 위치와 소유자
| 문서 | 소유자 |
|---|---|
| docs/00_brief.md, docs/01_prd.md | Product Owner |
| docs/research/market.md | Market Researcher |
| docs/research/tech.md, docs/research/<주제>.md | Tech Researcher |
| docs/03_spec.md, 04_nfr.md, 05_glossary.md, 06_traceability.md | Spec Writer |
| docs/review/plan-review.md | Plan Reviewer |
| docs/plan.md, docs/retro/, docs/incidents/ | Delivery Manager |
| docs/design/ | UX Designer(flows, screens), UI Designer(tokens, components, mockups) |
| docs/02_architecture.md, docs/adr/ | Software Architect |
| docs/api/ | API Designer |
| docs/db.md | Database Engineer |
| docs/qa/ | QA Engineer |
| docs/perf/ | Performance Engineer |
| docs/release/ | Reality Checker(verdict), DevOps Engineer(release.md) |
| README, CHANGELOG | Technical Writer |

소유자가 아닌 사람은 변경 요청을 보낸다.

## ID 체계
- 요구: R-01 (PRD) → 기능: F-01 (명세) → 수락 기준: AC-01-1 → 티켓: NWS-12
- 비즈니스 규칙: BR-01 / ADR: ADR-001
- 06_traceability.md에서 R → F → AC → 티켓이 끊기지 않아야 한다.

## 수락 기준 양식
```
AC-03-2 잘못된 비밀번호
Given 가입된 이메일과 틀린 비밀번호
When 로그인을 요청하면
Then 401과 "이메일 또는 비밀번호가 올바르지 않습니다"를 받고, 남은 시도 횟수는 노출하지 않는다
```

## ADR 양식
```
# ADR-003 인증에 Supabase Auth 사용
상태: 제안 | 승인 | 폐기 | ADR-00X로 대체
배경: (왜 결정이 필요했나, 제약)
선택지: A … / B … (최소 2개)
결정: …
결과: 쉬워지는 것 … / 어려워지는 것 …
```

## 변경 기록
모든 소유 문서 맨 아래에 둔다.
```
| 날짜 | 변경 | 이유 | 요청자 | 영향 |
```

## 금지 표현
적절히, 빠르게, 등, 필요 시, 가능하면, 최적화된 → 숫자나 목록으로 바꾼다.
