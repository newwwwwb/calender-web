# 책임과 소통

## RACI (산출물별 책임)
R은 실제로 만드는 사람, A는 최종 책임자로 산출물마다 한 명이다. C는 만들기 전에 의견을 묻는 대상, I는 끝나면 알리는 대상이다.

| 산출물 | R 실행 | A 최종 책임(1명) | C 의견 | I 통보 |
|---|---|---|---|---|
| brief, PRD | Product Owner | Product Owner | Market Researcher, Tech Researcher, Plan Reviewer | Spec Writer, Michael |
| 시장 조사 | Market Researcher | Product Owner | - | Spec Writer, Plan Reviewer |
| 기술 조사 | Tech Researcher | Product Owner | - | Software Architect, Plan Reviewer |
| 상세 명세, 비기능 요구, 용어집, 추적표 | Spec Writer | Product Owner | Plan Reviewer | Software Architect, QA Engineer, Dev 전원 |
| 기획 검토 판정 | Plan Reviewer | Plan Reviewer | - | Product Owner |
| UX 흐름, 화면 구성 | UX Designer | Product Owner | Frontend Developer | UI Designer, Software Architect |
| UI 토큰, 컴포넌트 규격 | UI Designer | Product Owner | Frontend Developer | UX Designer |
| 아키텍처, ADR, 기술 티켓 | Software Architect | Software Architect | Tech Researcher, Product Owner | Dev 전원, Delivery Manager |
| API 계약 | API Designer | Software Architect | Backend Developer, Frontend Developer | QA Engineer, Technical Writer |
| 배정, 계획, 진행 상태 | Delivery Manager | Delivery Manager | Software Architect | Product Owner, Michael |
| 코드 변경 | 담당 Dev | 담당 Dev | Code Reviewer | QA Engineer |
| 코드 리뷰 판정 | Code Reviewer | Code Reviewer | Security, Performance, Accessibility | Release Manager |
| main 병합 | Release Manager | Release Manager | Code Reviewer | QA Engineer, Delivery Manager |
| 수락 검증(done) | QA Engineer | QA Engineer | Spec Writer | Delivery Manager |
| 릴리스 판정 | Reality Checker | Michael | QA Engineer | Release Manager, Delivery Manager |
| 운영 배포 | DevOps Engineer | Michael | Release Manager | Delivery Manager, Product Owner |
| README, CHANGELOG | Technical Writer | Release Manager | API Designer | Product Owner |
| 장애 사후 분석 | Delivery Manager | Delivery Manager | Debugger, Release Manager | Michael |
| 릴리스 회고 | Delivery Manager | Delivery Manager | PO, Architect, Code Reviewer, QA, Release Manager | Michael |

## 소통 표 (누가 누구에게 언제 보내나)
이 표에 없는 경로로는 보내지 않는다. 받은 메시지에 대한 답신은 언제나 가능하다. 받을 역할이 팀에 없으면 Delivery Manager에게 보낸다.

| 보내는 쪽 | 받는 쪽 | 유형 | 언제 |
|---|---|---|---|
| Michael | Product Owner | request | 사용자 요청을 원문 그대로 전달할 때 |
| Michael | Delivery Manager | request | 반려 사유(티켓 단위), 세 번 막힌 건의 결정, 정기 점검 전달 |
| Michael | DevOps Engineer | request | 운영 배포를 승인했을 때 배포 실행 |
| Product Owner | Michael | inform | 설계 승인 한 줄 |
| Product Owner | Michael | query | 사용자에게 물어야 할 질문(최대 5개) |
| Product Owner | Market Researcher | request | brief와 조사 질문이 준비됐을 때(동시에) |
| Product Owner | Tech Researcher | request | brief와 조사 질문이 준비됐을 때(동시에) |
| Product Owner | Spec Writer | request | PRD를 끝냈을 때 |
| Product Owner | Delivery Manager | request | 설계를 승인했을 때 구현 시작, 범위 변경 결정을 내렸을 때 |
| Product Owner | UX Designer | request | Plan Reviewer 통과 후 스토리 티켓을 만들었을 때 설계 시작 |
| Product Owner | Software Architect | request | Plan Reviewer 통과 후 스토리 티켓을 만들었을 때 설계 시작 |
| Market Researcher | Product Owner | done | 시장 조사를 끝냈을 때 |
| Market Researcher | Plan Reviewer | request | 보완 지적을 고쳤을 때 재검토 |
| Tech Researcher | Product Owner | done | 착수 기술 조사를 끝냈을 때 |
| Tech Researcher | Plan Reviewer | request | 보완 지적을 고쳤을 때 재검토 |
| Spec Writer | Product Owner | query | PRD로 정할 수 없는 열린 질문 |
| Spec Writer | Plan Reviewer | request | 명세, 비기능 요구, 용어집, 추적표를 끝냈거나 보완했을 때 |
| Plan Reviewer | Product Owner | request | 통과 판정, 또는 PO 담당 보완 지적 |
| Plan Reviewer | Market Researcher | request | 담당별 보완 지적 |
| Plan Reviewer | Tech Researcher | request | 담당별 보완 지적 |
| Plan Reviewer | Spec Writer | request | 담당별 보완 지적 |
| Delivery Manager | Michael | request | 세 번째로 막힌 건(선택지 2개와 추천), 역할 추가 고용이 필요할 때 |
| Delivery Manager | Michael | inform | 릴리스 회고 결과와 규칙 변경 제안, P0 사후 분석 요약 |
| Delivery Manager | Product Owner | request | 요구사항 막힘, 명세에 없는 기능 요청 |
| Delivery Manager | Product Owner | request | 릴리스 후 회고 항목(잘된 것, 문제, 개선 1개) 요청 |
| Delivery Manager | Tech Researcher | request | 개발 중 기술 조사가 필요할 때 |
| Delivery Manager | Software Architect | request | 구조·계약 막힘, DoR이 부족한 기술 티켓 보완 |
| Delivery Manager | Software Architect | request | 릴리스 후 회고 항목(잘된 것, 문제, 개선 1개) 요청 |
| Delivery Manager | API Designer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Backend Developer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Frontend Developer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Database Engineer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Mobile Developer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Code Reviewer | request | 릴리스 후 회고 항목(잘된 것, 문제, 개선 1개) 요청 |
| Delivery Manager | QA Engineer | request | 릴리스 후 회고 항목(잘된 것, 문제, 개선 1개) 요청 |
| Delivery Manager | Test Automation Engineer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Debugger | request | 버그로 분류된 막힘 |
| Delivery Manager | Release Manager | request | Must 티켓이 모두 done일 때 릴리스 준비 |
| Delivery Manager | Release Manager | request | 릴리스 후 회고 항목(잘된 것, 문제, 개선 1개) 요청 |
| Delivery Manager | DevOps Engineer | request | DoR을 통과한 티켓을 배정할 때 |
| Delivery Manager | Repo Janitor | request | DoR을 통과한 티켓을 배정할 때 |
| UX Designer | UI Designer | request | 흐름과 화면 구성을 끝냈을 때 |
| UI Designer | Product Owner | request | 토큰과 컴포넌트 규격을 끝냈을 때 설계 검토 |
| Software Architect | Product Owner | request | 아키텍처, ADR, 기술 티켓, 계약 검토를 끝냈을 때 설계 검토 |
| Software Architect | Tech Researcher | query | 결정에 추가 조사가 필요할 때 |
| Software Architect | API Designer | request | API 계약이 필요할 때 |
| API Designer | Software Architect | request | 계약 초안이나 변경안을 끝냈을 때 검토 |
| API Designer | Backend Developer | inform | 계약이 바뀌었을 때(영향 범위 포함) |
| API Designer | Frontend Developer | inform | 계약이 바뀌었을 때(영향 범위 포함) |
| API Designer | Mobile Developer | inform | 계약이 바뀌었을 때(영향 범위 포함) |
| Backend Developer | Spec Writer | query | 기능 규칙·예외 흐름 질문 |
| Backend Developer | Delivery Manager | request | 2번 넘게 막혔을 때 |
| Backend Developer | Software Architect | query | 구조·폴더 경계 질문 |
| Backend Developer | API Designer | request | 계약 변경이 필요할 때(변경 요청서) |
| Backend Developer | Code Reviewer | request | 티켓을 끝냈을 때 리뷰(티켓 ID, 브랜치, 변경 요약, 테스트 증거) |
| Frontend Developer | Spec Writer | query | 기능 규칙·예외 흐름 질문 |
| Frontend Developer | Delivery Manager | request | 2번 넘게 막혔을 때 |
| Frontend Developer | UX Designer | query | 화면 흐름·규격 질문 |
| Frontend Developer | UI Designer | query | 화면 흐름·규격 질문 |
| Frontend Developer | Software Architect | query | 구조·폴더 경계 질문 |
| Frontend Developer | API Designer | request | 계약 변경이 필요할 때(변경 요청서) |
| Frontend Developer | Code Reviewer | request | 티켓을 끝냈을 때 리뷰(티켓 ID, 브랜치, 변경 요약, 테스트 증거) |
| Database Engineer | Michael | request | 데이터·컬럼 삭제처럼 되돌릴 수 없는 변경 승인 |
| Database Engineer | Spec Writer | query | 기능 규칙·예외 흐름 질문 |
| Database Engineer | Delivery Manager | request | 2번 넘게 막혔을 때 |
| Database Engineer | Software Architect | query | 구조·폴더 경계 질문 |
| Database Engineer | API Designer | request | 계약 변경이 필요할 때(변경 요청서) |
| Database Engineer | Code Reviewer | request | 티켓을 끝냈을 때 리뷰(티켓 ID, 브랜치, 변경 요약, 테스트 증거) |
| Mobile Developer | Spec Writer | query | 기능 규칙·예외 흐름 질문 |
| Mobile Developer | Delivery Manager | request | 2번 넘게 막혔을 때 |
| Mobile Developer | UX Designer | query | 화면 흐름·규격 질문 |
| Mobile Developer | UI Designer | query | 화면 흐름·규격 질문 |
| Mobile Developer | Software Architect | query | 구조·폴더 경계 질문 |
| Mobile Developer | API Designer | request | 계약 변경이 필요할 때(변경 요청서) |
| Mobile Developer | Code Reviewer | request | 티켓을 끝냈을 때 리뷰(티켓 ID, 브랜치, 변경 요약, 테스트 증거) |
| Code Reviewer | Backend Developer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Frontend Developer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Database Engineer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Mobile Developer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Security Reviewer | request | 승인했고 인증·권한·입력·비밀값·업로드를 건드렸을 때 |
| Code Reviewer | Test Automation Engineer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Debugger | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Performance Engineer | request | 승인했고 성능 영향이 클 때(쿼리, 목록 렌더링, 번들 크기) |
| Code Reviewer | Accessibility Auditor | request | 승인했고 새 화면이나 커스텀 컴포넌트가 생겼을 때 |
| Code Reviewer | Release Manager | request | 승인했을 때 병합 요청. 추가 점검을 보냈으면 대기 점검 목록을 적고, 20줄 이하면 'QA 생략 가능'을 적는다 |
| Code Reviewer | DevOps Engineer | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Code Reviewer | Repo Janitor | request | '수정 요청' 판정일 때 지적 목록 그대로(작성자에게) |
| Security Reviewer | Delivery Manager | inform | Critical·High가 나왔을 때 |
| Security Reviewer | Backend Developer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Frontend Developer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Database Engineer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Mobile Developer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Test Automation Engineer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Debugger | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Release Manager | inform | 점검 결과(통과 또는 차단), 릴리스 전체 점검 결과 |
| Security Reviewer | DevOps Engineer | request | Critical·High 지적일 때 수정(작성자에게) |
| Security Reviewer | Repo Janitor | request | Critical·High 지적일 때 수정(작성자에게) |
| QA Engineer | Spec Writer | query | 수락 기준 해석이 갈릴 때 |
| QA Engineer | Delivery Manager | done | 받은 티켓 검증이 모두 끝났을 때 요약 |
| QA Engineer | Test Automation Engineer | request | PASS 케이스 중 회귀로 남길 것 |
| QA Engineer | Debugger | request | FAIL일 때(재현 절차, 기대, 실제, 로그) |
| Test Automation Engineer | Code Reviewer | request | 회귀 테스트를 끝냈을 때 리뷰 |
| Debugger | Backend Developer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | Frontend Developer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | Database Engineer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | Mobile Developer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | Code Reviewer | request | 5줄 이하로 직접 고쳤을 때 리뷰 |
| Debugger | Test Automation Engineer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | DevOps Engineer | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Debugger | Repo Janitor | request | 원인을 찾았을 때 원인과 수정안(작성자에게) |
| Performance Engineer | Backend Developer | request | FAILS일 때 병목과 개선안(작성자에게) |
| Performance Engineer | Frontend Developer | request | FAILS일 때 병목과 개선안(작성자에게) |
| Performance Engineer | Database Engineer | request | FAILS일 때 병목과 개선안(작성자에게) |
| Performance Engineer | Mobile Developer | request | FAILS일 때 병목과 개선안(작성자에게) |
| Performance Engineer | Release Manager | inform | 점검 결과(MEETS 또는 FAILS), 릴리스 점검 결과 |
| Accessibility Auditor | Frontend Developer | request | Critical·Serious 지적 수정 |
| Accessibility Auditor | Mobile Developer | request | Critical·Serious 지적 수정 |
| Accessibility Auditor | Release Manager | inform | 점검 결과(통과 또는 차단), 릴리스 점검 결과 |
| Reality Checker | Product Owner | query | Must 기준 해석이 필요할 때 |
| Reality Checker | Delivery Manager | request | FAILED·NEEDS WORK일 때 수정 목록 |
| Reality Checker | Release Manager | done | READY 판정일 때 판정서 위치 |
| Release Manager | Michael | request | READY를 받았을 때 최종 검수와 운영 배포 승인 |
| Release Manager | Delivery Manager | inform | main 장애(P0)가 났을 때, 릴리스가 끝났을 때 회고 요청 |
| Release Manager | Backend Developer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Frontend Developer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Database Engineer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Mobile Developer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Security Reviewer | request | 릴리스 준비를 받았을 때 각자 릴리스 점검·문서·배포 준비 |
| Release Manager | QA Engineer | request | 병합 후 테스트·빌드가 통과했을 때 검증(티켓 ID) |
| Release Manager | Test Automation Engineer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Performance Engineer | request | 릴리스 준비를 받았을 때 각자 릴리스 점검·문서·배포 준비 |
| Release Manager | Accessibility Auditor | request | 릴리스 준비를 받았을 때 각자 릴리스 점검·문서·배포 준비 |
| Release Manager | Reality Checker | request | 릴리스 점검이 모두 끝났을 때 최종 검증 |
| Release Manager | DevOps Engineer | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | DevOps Engineer | request | 릴리스 준비를 받았을 때 각자 릴리스 점검·문서·배포 준비 |
| Release Manager | Repo Janitor | request | 로직 충돌이나 병합 후 실패로 revert했을 때(작성자에게) |
| Release Manager | Technical Writer | request | 릴리스 준비를 받았을 때 각자 릴리스 점검·문서·배포 준비 |
| DevOps Engineer | Code Reviewer | request | CI·스크립트를 바꿨을 때 리뷰 |
| DevOps Engineer | Release Manager | done | 배포 준비를 끝냈을 때, 배포를 실행했을 때 |
| Repo Janitor | Delivery Manager | request | 삭제 대상 목록 승인 |
| Repo Janitor | Code Reviewer | request | 정리를 끝냈을 때 리뷰 |
| Technical Writer | API Designer | inform | 계약과 코드가 다를 때 |
| Technical Writer | Release Manager | done | 문서를 끝냈을 때 바꾼 문서 목록 |
