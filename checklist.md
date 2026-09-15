# 체크리스트

각 단계는 하위 작업(N.1, N.2 …)으로 나누고, 단계가 끝나면 ponytail로 점검한다.

## 1단계: 프로젝트 셋업
- [x] 1.1 Vite React-TS 스캐폴드, 데모 코드 제거, git init
- [x] 1.2 checklist.md / context-notes.md 작성
- [x] 1.3 vitest + Testing Library 설정, 스모크 테스트
- [x] 1.4 디자인 토큰(tokens.css), global.css, Pretendard 폰트, lang="ko"
- [x] 1.5 앱 셸 레이아웃(Header, Sidebar, 메인 자리표시)
- [x] 1.6 ponytail 점검 및 반영

## 2단계: 도메인
- [x] 2.1 types.ts — Category, RecurrenceRule, CalendarEvent 데이터 모델
- [x] 2.2 date-fns 설치, lib/date.ts — 날짜 유틸(주 시작 일요일, ko 포맷) + 테스트
- [x] 2.3 lib/holidays.ts — 2026~2027 한국 공휴일(대체공휴일 포함) 정적 데이터 + 테스트
- [x] 2.4 lib/recurrence.ts — 반복 일정 전개 로직 + 경계 테스트(월말/윤년/until/count/제외일)
- [x] 2.5 storage/repository.ts, storage/localRepository.ts — 인터페이스 + localStorage 구현 + 테스트
- [x] 2.6 ponytail 점검

## 3단계: 월 보기 + 일정 에디터(CRUD) + 카테고리
- [x] 3.1 state/useCalendar.ts — 현재 날짜/선택일 상태 + repository에서 이벤트·카테고리 로드 (Context)
- [x] 3.2 lib/date.ts — 월 그리드(6x7) 생성 유틸 + 테스트
- [x] 3.3 MonthView — 그리드, 공휴일 표시, expandRecurrence로 이벤트 칩 렌더, 날짜 선택
- [x] 3.4 Header 동적화 — 이전/다음/오늘 버튼, "YYYY년 M월" 타이틀 연동
- [x] 3.5 EventEditor — 생성/수정/삭제 모달(CRUD), 카테고리 선택
- [x] 3.6 카테고리 CRUD — 사이드바에서 추가/수정/삭제, 색상 선택
- [x] 3.7 ponytail 점검

## 4단계: 주/일 보기(시간 그리드, 겹침 배치) + 목록 보기
- [x] 4.1 useCalendar에 view 상태 추가, Header 월/주/일/목록 전환 + 보기별 이전/다음 이동 단위·타이틀
- [x] 4.2 lib/layout.ts — 겹치는 시간대 이벤트 컬럼 배치 알고리즘 + 테스트
- [x] 4.3 TimeGridView(공용) + WeekView/DayView — 시간 그리드, 종일 줄, 겹침 배치, 빈 시간 클릭 생성/이벤트 클릭 수정
- [x] 4.4 AgendaView(목록 보기) — 현재 달 일정을 날짜별로 묶어 시간순 표시
- [x] 4.5 App.tsx에서 view별 화면 전환 연결
- [x] 4.6 ponytail 점검

## 5단계: 반복 일정 편집 흐름(이 일정만/이후/전체)
- [ ] 5.1 배선: 뷰들이 EventInstance(회차 날짜 포함)를 넘기도록 수정, EventEditor가 클릭한 회차의 실제 날짜·시간으로 폼을 채우도록 수정 (기존 버그: 반복 일정 수정 시 원본 시작일이 뜨던 문제 포함)
- [ ] 5.2 EventEditor: 반복 규칙 입력 UI(반복 안 함/매일/매주/매월/매년, 간격, 요일, 종료조건) 추가
- [ ] 5.3 lib/recurrence.ts: 반복 일정 분리 로직(이 회차 제외 / 이후 전체 분리) 순수 함수 + 테스트
- [ ] 5.4 EventEditor: 반복 일정 수정·삭제 시 범위 선택(이 일정만/이후 전체/전체) UI 및 로직 연결
- [ ] 5.5 ponytail 점검

## 6단계: 검색, 키보드 단축키, 모바일 스와이프·바텀시트, JSON 내보내기/가져오기
- [ ] ponytail 점검

## 7단계: 반응형 다듬기 + Vercel 배포
- [ ] ponytail 점검

## 8단계: Supabase 연동 (마지막)
- [ ] 로그인, events/categories 테이블 + RLS, supabaseRepository, 로컬 데이터 1회 업로드
- [ ] ponytail 점검
