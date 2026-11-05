# 팀 핸드북

에이전트의 필수 규칙은 각자의 Goal에 있다. 이 폴더는 그 규칙을 지킬 때 쓰는 **양식과 체크리스트**다. 필요한 파일만 읽는다.

| 파일 | 언제 읽나 |
|---|---|
| 01-messages.md | 메시지를 보낼 때 (요청, 질의, 보고 양식) |
| 02-tickets.md | 티켓을 만들거나 시작하거나 넘길 때 (상태, 우선순위, DoR, DoD) |
| 03-git-review.md | 브랜치, 커밋, 리뷰 요청, 리뷰, 병합 |
| 04-docs-decisions.md | PRD, 명세, ADR, 변경 요청서를 쓸 때 |
| 05-quality-release.md | QA, 보안, 성능, 접근성 점검, 릴리스 |
| 06-incidents-retro.md | main 장애, 보안 사고, 회고 |
| 07-raci.md | 누가 무엇을 책임지는지, 누구에게 보내는지 |

## 근거로 삼은 실제 규칙
- 코드 리뷰: Google Engineering Practices (작은 변경, 1영업일 내 응답, 코드 상태 개선 기준, Nit 표기)
- 리뷰 분량: SmartBear 동료 리뷰 모범 사례 (한 번에 200~400줄, 60분 이내)
- 완료 정의: Scrum Guide 2020의 Definition of Done
- 책임 배정: RACI (산출물마다 책임자 A는 한 명)
- 작업 흐름: Kanban의 WIP 제한과 당겨오기
- 브랜치: GitHub 보호 브랜치 (리뷰와 상태 확인 통과 후 병합)
- 커밋과 버전: Conventional Commits, Semantic Versioning, Keep a Changelog
- 결정 기록: Michael Nygard의 ADR
- 장애: Google SRE의 비난 없는 사후 분석
- 보안과 접근성: OWASP ASVS, WCAG 2.2 AA
