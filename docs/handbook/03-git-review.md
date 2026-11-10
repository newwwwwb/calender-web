# Git과 코드 리뷰

## 작업 폴더
- 격리된 역할(Backend, Frontend, Database, Mobile, Test Automation, DevOps, Repo Janitor, Debugger)은 자기 worktree에서 일한다. 티켓을 시작할 때마다 `git rebase main`(또는 `git merge main`)으로 최신 main을 반영한다.
- 나머지 역할은 하나의 공유 폴더(main)를 함께 쓴다. 그래서 공유 폴더에서는 다음을 하지 않는다: `git checkout <다른 브랜치>`, `git stash`, `git reset --hard`, `git add -A`.
- 다른 브랜치를 실행해 봐야 하면 저장소 밖 임시 worktree를 만든다: `git worktree add ../tmp-review feat/x` → 확인 → `git worktree remove ../tmp-review`.
- 커밋은 내 파일 경로만 지정한다: `git add docs/qa/report.md`.

## 브랜치
- main은 보호 브랜치다. 직접 커밋과 force push 금지. 예외는 문서 역할의 `docs:` 커밋과 Release Manager의 병합 커밋뿐이다.
- 원격 저장소 push는 Release Manager만 한다.
- 작업 브랜치 이름: feat/짧은-설명, fix/…, chore/…, test/…
- 한 브랜치는 하나의 독립된 변경이다. 리팩터링은 기능 변경과 분리한다.
- 티켓 하나 = 브랜치 하나. 한 티켓을 여러 브랜치로 나누지 않는다 (사용자 결정 2026-11-10, god 8e44ae).

## 커밋 (Conventional Commits)
```
feat(auth): 로그인 폼 서버 검증 추가
fix(board): 빈 목록에서 페이지네이션 오류 수정
test(auth): 잘못된 비밀번호 401 케이스
docs: PRD 변경 기록 추가
```
호환을 깨는 변경은 본문에 `BREAKING CHANGE:`를 쓴다.

## 변경 크기
- 100줄 안팎이 적당하고 400줄을 넘으면 쪼갠다 (1000줄은 너무 크다).
- 쪼개는 법: 계층별(DB → API → 화면), 기능별, 리팩터링 먼저 분리, 테스트 먼저 분리. 쪼개기는 **기술 티켓을 만들 때** Software Architect가 한다. 작업 중인 티켓은 쪼개지 않는다 (사용자 결정 2026-11-10, god 8e44ae).

## 리뷰어 규칙
- 리뷰 요청은 지금 작업 단위가 끝난 직후, 다른 티켓보다 먼저 처리한다.
- 한 번에 빠짐없이 리뷰한다. 같은 변경에 지적을 나눠 보내지 않는다.
- 승인 기준은 완벽함이 아니라 "전체 코드 상태가 나아졌는가"다.
- 취향보다 근거와 데이터가 우선이다. 같은 수준의 방법이 여럿이면 작성자 선택을 존중한다.
- 라벨: Blocker(반드시 고침) / Suggestion(고치는 게 좋음) / Nit:(선택).
- 형식: `파일:줄 | 문제 | 이유 | 수정 제안`
- 400줄이 넘으면 리뷰하지 않고 Delivery Manager에게 알린다(티켓 범위 문제). 브랜치를 쪼개 달라고 하지 않는다.
- 리뷰 지적은 같은 브랜치에서 고친 것을 다시 본다. 리뷰어도 실행하는 테스트는 바뀐 파일 관련 테스트만이다 (사용자 결정 2026-11-10, god 8e44ae).
- 의도가 불분명하면 실수로 단정하지 말고 묻는다.
- 작성자와 2번 넘게 왕복해도 합의가 안 되면 Delivery Manager를 거쳐 Software Architect가 결정한다.

## 병합 규칙 (Release Manager)
- 조건: Code Reviewer 승인 + 대기 점검 모두 통과.
- 병합 전 main 최신 내용을 반영하고, 충돌을 해결했으면 충돌 파일 관련 테스트를 다시 돌린다.
- 방식은 `git merge --no-ff`로 통일한다.
- 병합 후 테스트나 빌드가 깨지면 원인 분석보다 revert가 먼저다.
- 병합한 브랜치는 지운다.

## 버전
- SemVer: 호환 깨짐 MAJOR, 기능 추가 MINOR, 버그 수정 PATCH.
- CHANGELOG는 Added / Changed / Deprecated / Removed / Fixed / Security로 나눈다.
