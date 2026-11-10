# 품질과 릴리스

## 점검 흐름
Dev → Code Reviewer → (Security / Performance / Accessibility, 해당 시) → Release Manager 병합 → QA Engineer → done

## 테스트 범위 (사용자 결정 2026-11-10, god 8e44ae)
| 시점 | 누가 | 무엇을 |
|---|---|---|
| 티켓 개발·리뷰·QA | Dev, Code Reviewer, QA Engineer | 바뀐 파일과 그 파일을 쓰는 곳의 테스트만(예: `npx vitest run src/carbook/components/RecordsTab`). 실행 명령과 결과 한 줄을 증거로 남긴다 |
| 릴리스 후보 | Release Manager | 전체 `npm test`, `npm run build`, 린트 한 번. 실패하면 원인 티켓으로 되돌린다 |

## QA 보고서 (docs/qa/report.md)
```
| 티켓 | 수락 기준 | 케이스 | 결과 | 실행 명령 / 증거 |
| NWS-12 | AC-03-2 | 틀린 비밀번호 | PASS | curl … → 401 |
```
- 증거가 없거나 모호하면 FAIL.
- "문제 없음"은 모든 수락 기준과 예외 흐름을 확인했을 때만 쓴다.
- 기대값을 느슨하게 바꿔서 통과시키지 않는다.

## 보안 심각도
| 등급 | 예 | 처리 |
|---|---|---|
| Critical | 클라이언트에 노출된 비밀값, 인증 우회 | P0, 병합·배포 차단, 키 교체 |
| High | 전체 허용 RLS, 권한 검사 누락, 인젝션 | 병합 차단 |
| Medium | 과한 에러 노출, 약한 설정 | 티켓 생성 |
| Low | 위생 문제 | 기록 |
점검 기준: OWASP ASVS. 비밀값은 원문을 쓰지 않는다.

## 접근성
기준: WCAG 2.2 AA. 심각도: Critical / Serious / Moderate / Minor. Critical·Serious는 병합 차단.

## 성능
기준선 먼저, 전후 비교는 같은 방법으로. 기본 목표(문서에 없을 때): LCP 2.5초, CLS 0.1, API p95 500ms, 에러율 1% 미만.

## 릴리스 체크리스트 (Release Manager)
- [ ] Must 티켓 모두 done
- [ ] 전체 `npm test`·`npm run build`·린트 통과 (릴리스 후보에서 한 번, 실행 결과 첨부)
- [ ] Security 전체 점검: Critical·High 없음
- [ ] 화면이 있으면 Accessibility, 성능 목표가 있으면 Performance 점검
- [ ] README, CHANGELOG 갱신
- [ ] DevOps 배포 준비와 롤백 방법(docs/release.md)
- [ ] Reality Checker 판정 READY
- [ ] Michael 최종 검수 승인
- [ ] SemVer 태그

## Reality Checker 판정서 (docs/release/verdict.md)
실행한 명령과 증거 / Must 수락 기준별 PASS·FAIL / 남은 문제와 심각도 / Must 구현 비율 / 판정: FAILED · NEEDS WORK · READY / 다음 수정 목록
