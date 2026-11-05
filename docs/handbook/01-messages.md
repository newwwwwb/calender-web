# 메시지 양식

PROTOCOL.md의 유형을 그대로 쓴다.

| 유형 | 의미 | 답 필요 |
|---|---|---|
| request | 일을 맡긴다 | 예 (완료 시 done 또는 결과) |
| query | 질문한다 | 예 (다음 응답 안에) |
| propose | 결정을 제안한다 | 예 |
| inform | 알린다 | 아니오 |
| done | 맡은 일을 끝냈다 | 아니오 |

## 기본 형식

```
[request][NWS-12][P1]
요청: (한 문장, 요청은 한 가지만)
완료 조건: (받는 쪽이 무엇을 하면 끝인지)
근거: (파일 경로, 브랜치, 수락 기준 ID)
```

## 자주 쓰는 양식

리뷰 요청 (Dev → Code Reviewer)
```
[request][NWS-12][P1] 리뷰 요청
브랜치: feat/login-form
변경 이유: F-03 로그인 폼 (AC-03-1~3)
변경 요약: (3줄 이내)
테스트: pnpm test auth → 12 passed
예상 크기: +180 −20줄
```

병합 요청 (Code Reviewer → Release Manager)
```
[request][NWS-12][P1] 병합 요청
브랜치: feat/login-form / 리뷰: 승인
대기 점검: Security Reviewer (없으면 '없음')
QA: 필요 (20줄 이하면 'QA 생략 가능')
```

버그 보고 (QA → Debugger)
```
[request][NWS-12][P1] FAIL: AC-03-2
재현 절차: 1) … 2) … 3) …
기대 결과: … / 실제 결과: …
로그: (핵심 줄만) / 환경: main@abc123
```

변경 요청 (누구든 → 산출물 소유자)
```
[request][NWS-12][P2] 변경 요청: (대상 문서나 계약)
현재: … / 제안: …
이유: … / 영향받는 역할: …
```

막힘 보고 (누구든 → Delivery Manager)
```
[request][NWS-12][P1] 막힘
무엇이: … / 시도한 것: 1) … 2) …
필요한 결정: (선택지 A, B와 추천)
```

승인 요청 (→ Michael)
```
[request][-][P1] 승인 요청: 운영 배포 v1.2.0
내용: … / 되돌리는 방법: … / 판정서: docs/release/verdict.md
```

## 원칙
- 메시지 하나에 요청 하나.
- 긴 설명은 문서에 쓰고 경로만 보낸다.
- 받은 메시지에는 반드시 결과(done, 답, 거절 사유)로 닫는다.
