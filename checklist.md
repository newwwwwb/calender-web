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
- [x] 5.1 배선: 뷰들이 EventInstance(회차 날짜 포함)를 넘기도록 수정, EventEditor가 클릭한 회차의 실제 날짜·시간으로 폼을 채우도록 수정 (기존 버그: 반복 일정 수정 시 원본 시작일이 뜨던 문제 포함)
- [x] 5.2 EventEditor: 반복 규칙 입력 UI(반복 안 함/매일/매주/매월/매년, 간격, 요일, 종료조건) 추가
- [x] 5.3 lib/recurrence.ts: 반복 일정 분리 로직(이 회차 제외 / 이후 전체 분리) 순수 함수 + 테스트
- [x] 5.4 EventEditor: 반복 일정 수정·삭제 시 범위 선택(이 일정만/이후 전체/전체) UI 및 로직 연결
- [x] 5.5 (사용자 요청) 일정별 색상 지정 필드 추가, 기본값이 항상 미리 선택되도록
- [x] 5.6 (사용자 요청) 월 보기에서 날짜 클릭 시 일 보기로 자동 전환
- [x] 5.7 ponytail 점검

## 6단계: 검색, 키보드 단축키, 모바일 스와이프·바텀시트, JSON 내보내기/가져오기
- [x] 6.1 SearchDialog — 전체화면 검색(제목·메모), 결과 클릭 시 해당 날짜/일정으로 이동
- [x] 6.2 키보드 단축키 — stepDate 공용 유틸 추출, T/월·주·일·목록/←→/N/'/' 전역 단축키 (입력 중엔 무시)
- [x] 6.3 JSON 내보내기/가져오기 — 이벤트·카테고리 백업 다운로드/복원
- [x] 6.4 모바일 대응 — EventEditor 바텀시트(작은 화면), 좌우 스와이프로 기간 이동, 하단 고정 + 버튼
- [x] 6.5 ponytail 점검

## 7단계: 반응형 다듬기 + Vercel 배포
- [x] 7.1 Header 모바일 레이아웃 정리 (알려진 줄바꿈 이슈 해결, FAB와 중복되는 "+ 새 일정" 정리)
- [x] 7.2 반응형 전체 점검 — 여러 폭에서 스크린샷 확인, 여백·폰트 크기 다듬기
- [x] 7.3 Vercel 배포 준비 및 배포 — https://calender-web-ten.vercel.app/
- [x] 7.4 ponytail 점검

## 8단계: Supabase 연동 (마지막, 로그인은 Google OAuth)
- [x] 8.1 Supabase 프로젝트 생성 + Google OAuth 설정 (사용자 액션) — URL/anon key 전달받음, 테이블 5개+OAuth 리다이렉트 확인 완료
- [x] 8.2 DB 스키마 SQL — events/categories 테이블 + RLS 정책 (사용자가 SQL 에디터에서 실행)
- [x] 8.3 @supabase/supabase-js 설치, 클라이언트 설정, useAuth 훅 + Google 로그인 버튼
- [x] 8.4 supabaseRepository.ts — EventRepository 구현체 + 테스트
- [x] 8.5 로그인 상태에 따라 repository 전환 + 로컬 데이터 1회 업로드(마이그레이션)
- [x] 8.6 ponytail 점검 (정적 검토 완료, 실 로그인 검증은 8.1 완료 후)

## 9단계: 캘린더 공유 (초대 링크, 보기 전용, 겹쳐보기+토글)
- [x] 9.1 DB — calendar_shares/calendar_share_members 테이블 + events/categories에 공유 select 정책 추가 (신규 SQL, 사용자가 실행)
- [x] 9.2 types.ts — CalendarEvent/Category에 ownerId 필드, ShareLink/ShareMember/SharedCalendar 타입 추가
- [x] 9.3 storage/shareRepository.ts — 링크 생성/조회/삭제, 멤버 조회/취소, 초대 수락, 나와 공유된 캘린더 목록 + 테스트
- [x] 9.4 supabaseRepository.ts — listEvents/listCategories가 ownerId를 채워 반환하도록 수정 + 테스트
- [x] 9.5 useCalendar — 공유 캘린더 목록/표시 토글 상태, 비로그인 시 공유 기능 비활성
- [x] 9.6 공유 UI — 사이드바 "공유 캘린더" 섹션(링크 생성/복사, 받은 초대, 캘린더별 표시 토글), `/share/:id` 수락 화면
- [x] 9.7 렌더링 — 월/주/일/목록 보기에서 공유자별 색 구분해 겹쳐 표시
- [x] 9.8 ponytail 점검

## 10단계: 디자인 테마 토글 (ZIGZAG 참고 디자인 시스템)
- [x] 10.1 tokens.css — `[data-theme="zigzag"]`로 대체 토큰 세트 추가(중립색 #121212/#292b2b/#878f91/#ecedee 계열, 카드 0px 라운드, 기존 액센트 파랑 유지 — 참고 문서에 액센트·버튼 근거가 없어 기능색은 그대로 둠)
- [x] 10.2 테마 선택 UI — 사이드바 토글/셀렉트, localStorage 저장, `useTheme` 훅으로 `data-theme` 반영
- [x] 10.3 전체 화면 점검(두 테마 모두, playwright-cli)
- [x] 10.4 ponytail 점검

## 11단계: 할 일(Todo) 목록
- [x] 11.1 types.ts에 Todo 타입 추가
- [x] 11.2 storage/repository.ts·localRepository.ts에 Todo CRUD 추가 + 테스트
- [x] 11.3 storage/supabaseRepository.ts에 Todo CRUD 추가 + supabase/schema_todos.sql + 테스트
- [x] 11.4 useCalendar.tsx — todos 상태/액션 추가, reload·마이그레이션에 포함 + 기존 테스트 회귀 확인 + 신규 테스트
- [x] 11.5 components/TodoList.tsx(+css) — CRUD UI
- [x] 11.6 Sidebar에 "할 일" 섹션 연결(데스크탑)
- [x] 11.7 components/TodoSheet.tsx + Header 모바일 진입 버튼 연결
- [x] 11.8 ponytail 점검

## 12단계: 로그인 진단 로깅 + ZIGZAG 테마 강화 + 설정 패널 (실사용 피드백)
- [x] 12.1 useAuth.ts — getSession 에러, onAuthStateChange 이벤트, 리다이렉트 에러를 콘솔에 로깅
- [x] 12.2 tokens.css zigzag 테마 — radius-overlay:0px, shadow-overlay:none 추가(모달 차이를 눈에 띄게)
- [x] 12.3 SettingsModal(데이터+디자인) 신설, Header에 항상 보이는 ⚙ 버튼, Sidebar에서 두 섹션 제거
- [x] 12.4 .env.local이 vitest(mode=test)에도 로드되어 테스트가 실제 Supabase에 접근하던 문제 발견·수정(.env.test.local)

## 13단계: ZIGZAG 테마 액센트 색 추가 (실사용 피드백)
- [x] 13.1 tokens.css zigzag 테마에 --color-primary 추가(#c2185b — 문서의 레거시 핑크 계열이되, 접근성 대비 기준을 만족하도록 톤 조정), playwright-cli로 실제 반영 확인

## 14단계: 구글 캘린더풍 화면 구성 (미니 캘린더 + 헤더 + 일정 블록)
- [x] 14.1 MiniCalendar 컴포넌트 신규 — 월 그리드, 오늘/선택일/다른 달 표시, 날짜 클릭 시 이동(뷰 유지), 일정 있는 날짜 점 표시 + 테스트
- [x] 14.2 헤더 재배치(오늘→보기전환→검색→설정→할일→+새일정→로그인) + 보기 전환을 알약(pill) 형태로
- [x] 14.3 일정 블록(월/주/일 보기)에 옅은 배경 tint(resolveEventTint) + 모서리·보더 확대로 더 진하고 둥글게
- [x] 14.4 playwright-cli로 데스크탑/모바일, 기본/ZIGZAG 테마 전부 확인, ponytail 점검
