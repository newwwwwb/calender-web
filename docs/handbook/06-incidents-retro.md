# 장애와 회고

## P0 (장애)로 보는 경우
- main의 테스트나 빌드가 깨졌다
- 보안 Critical (비밀값 노출, 인증 우회)
- 데이터 손실 또는 손상
- 운영 배포 후 핵심 흐름이 동작하지 않는다

## 대응 순서
1. 발견한 사람: Delivery Manager에게 P0 inform (main이면 Release Manager에게도)
2. 복구 먼저: Release Manager가 revert, 노출된 키는 교체가 필요하다고 Michael에게 승인 요청
3. 원인 분석: Debugger
4. 재발 방지: 담당 Dev 수정 + 회귀 테스트
5. 사후 분석: Delivery Manager가 docs/incidents/<날짜>-<제목>.md 작성

## 사후 분석 양식 (사람 탓 금지)
```
제목 / 날짜 / 심각도
영향: 무엇이 얼마나 안 됐나
타임라인: 발견 → 복구 → 해결
근본 원인: (사람이 아니라 절차와 시스템의 빈틈)
잘된 점 / 운이 좋았던 점
재발 방지 작업: 티켓 ID와 담당
```
"누가 실수했나"가 아니라 "왜 그 실수가 가능했나"를 쓴다.

## 릴리스 회고 (docs/retro/<버전>.md)
Delivery Manager가 Product Owner, Software Architect, Code Reviewer, QA Engineer, Release Manager에게 각 3줄을 받아 정리한다.
```
잘된 것 / 문제였던 것 / 다음에 바꿀 것 1개
```
- 바꿀 것이 규칙 변경이면 Michael에게 제안한다 (Goal 수정은 사용자가 한다).
- 각 역할은 자기 교훈을 자기 메모리에 한 줄로 남긴다.
