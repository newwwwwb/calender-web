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
- [x] 14.5 헤더 이전/다음 화살표를 월 타이틀 양옆으로 재배치(< 2026년 9월 >)
- [x] 14.6 설정에 "기본 보기"(월/주/일/목록) 선택 추가 — localStorage 저장, 선택 시 지금 화면에도 바로 반영

## 15단계: 서브에이전트 + 보스 리뷰 (사용자 지정 최종 검증)
- [x] 15.1 서브에이전트 3개 병렬 실행(코드 품질, 보안, 배포본 실사용 UX) — 보안 리뷰에서 critical 발견: `calendar_shares` select가 "로그인한 아무나 전체 열람"이라 초대 링크 없이도 남의 캘린더를 구독 가능했음
- [x] 15.2 보안 구멍 즉시 수정 — `calendar_shares` select를 소유자 전용으로 좁히고, 초대 조회/수락을 `get_share_owner`/`accept_share` SECURITY DEFINER 함수로 옮김(`supabase/schema_share_fix.sql`, 사용자가 SQL 에디터에서 실행 필요)
- [x] 15.3 코드 품질/UX 서브에이전트 리뷰 결과 + 4번째(보스 종합) 에이전트가 월 지출 한도로 실패해 내가 직접 보스 역할 수행 — 13건 검토, 11건 채택:
  - 15.3.1 데이터 손실 버그: 반복 일정 "이 일정만" 수정/삭제 시 첫 회차가 아니면 조건이 잘못 걸려 전체가 지워지던 버그 수정(EventEditor)
  - 15.3.2 15.2의 자체 회귀 수정 — 소유자 전용으로 좁히면서 `listSharedWithMe()`의 조인이 깨졌음(RLS가 임베디드 조인에도 적용) → `calendar_shares_select_own_or_member`로 재조정(`supabase/schema_share_fix2.sql`, 사용자가 SQL 에디터에서 실행 필요), `get_share_owner`/`accept_share` 파라미터명 충돌·권한도 같이 강화
  - 15.3.3 삭제 전 확인 다이얼로그 누락(EventEditor), N 단축키로 새 일정 열 때 동시에 "n" 글자가 입력란에 새는 버그(useKeyboardShortcuts)
  - 15.3.4 공유받은(남의) 일정을 EventEditor에서 열면 수정·삭제 가능하게 보이던 버그 → 읽기 전용 렌더링으로 수정
  - 15.3.5 공유받은(남의) 카테고리가 CategoryList/TodoList/EventEditor 선택 목록에 섞여 나와 클릭해도 조용히 실패하던 버그 → `myCategories`(본인 소유만) 파생값 도입해 전부 교체
  - 15.3.6 월 보기/미니 캘린더 그리드 마지막 날짜의 시간대 일정이 누락되던 경계값 버그(`endOfDay` 누락), 목록 정렬 후 자르기 순서 버그(MonthView)
  - 15.3.7 2027-12-25(토) 크리스마스 대체공휴일 누락(holidays.ts) — 제헌절 관련 리뷰 주장은 팩트체크 결과 근거 없어 반영 안 함
  - 15.3.8 카테고리/할 일 이름 입력 후 Enter로 저장 안 되던 사용성 문제(CategoryList/TodoList)
  - 15.3.9 JSON 가져오기 시 항목별 필수 필드 검증 강화, 가져오기 실패 시 조용히 묻히던 에러를 사용자에게 alert로 노출(DataBackup)
  - 15.3.10 로그인 마이그레이션 실패 시 플래그가 안 서서 다음 로그인 때도 계속 재시도되게(방치돼도 안전하도록) `.catch` 추가(useCalendar)
  - 15.3.11 `listSharedWithMe()`가 같은 소유자를 중복으로 반환해 React key 중복을 내던 버그 → owner_id로 중복 제거
  - 15.3.12 (기각) `useAuth()` Context 4곳 중복 호출 통합, `useKeyboardShortcuts` 매 렌더 재구독 최적화, PostgREST 1000행 페이지네이션, DST 테스트 커버리지 — 개인용 단일 사용자 앱 기준으로 우선순위 낮다고 판단해 보류(사용자 확인 필요)
- [x] 15.4 모바일 반응형 공백 — Sidebar가 768px 미만에서 통째로 숨어서(`display:none`) 카테고리 관리 + 공유 캘린더(링크 생성/수락/멤버 관리)가 모바일에서 접근 불가였음(할 일은 이미 TodoSheet로 모바일 대응돼 있었음) → SettingsModal에 "카테고리"·"공유 캘린더" 섹션 추가(Header ⚙은 모바일에서도 항상 보임), playwright-cli 모바일(iPhone 15) 뷰포트로 실제 접근 확인
- [x] 15.5 전체 회귀(223/223) + build + lint 통과 확인, ponytail 점검
- [x] 15.6 시작일이 종료일보다 늦어지면 종료일을 시작일에 맞춰 자동으로 올리도록 수정(사용자 요청) + 테스트 + playwright-cli 확인
- [x] 15.7 사용자 제보: 공유 링크 만들기 실패(`42P17 infinite recursion detected in policy for relation "calendar_shares"`) — fix2.sql의 `calendar_shares_select_own_or_member` 정책과 `calendar_share_members_select` 정책이 서로를 참조해 무한 재귀. `is_share_member()` SECURITY DEFINER 함수로 순환을 끊음(`supabase/schema_share_fix3.sql`, 사용자가 SQL 에디터에서 실행 필요)
- [x] 15.8 사용자 제보: 로그인할 때마다 마이그레이션이 재시도돼 Supabase insert 409(duplicate key) — 15.3.10에서 플래그 키를 전역→사용자별로 바꾸면서 옛 전역 키로 이미 마이그레이션한 사용자를 인식 못 하던 버그. 옛 키(`LEGACY_MIGRATED_KEY`)도 같이 확인하도록 수정 + 회귀 테스트

## 16단계: 애플 디자인 원칙 적용 (apple-design 스킬 검토 결과)
- [x] 16.1 Craft 버그 — 월 보기 셀 버튼 기본 테두리 제거, 헤더 이모지 아이콘 → SVG
- [x] 16.2 motion 설치, lib/motion.ts(스프링 프리셋·투사·러버밴드), MotionConfig reducedMotion, 테스트에서 애니메이션 스킵
- [x] 16.3 공용 Overlay 컴포넌트 + 4개 오버레이(EventEditor/SettingsModal/TodoSheet/SearchDialog) 등장·퇴장 모션
- [x] 16.4 모바일 바텀시트 끌어서 닫기(grabber, 속도 투사 판정)
- [x] 16.5 스와이프 기간 이동 실시간 추종(Pointer Events) + 이동 방향 슬라이드
- [x] 16.6 누름 반응(:active), hover transition, 보기 전환 pill 슬라이드
- [x] 16.7 반투명 sticky 헤더(재질 토큰, zigzag는 불투명)
- [x] 16.8 자간 토큰
- [x] 16.9 prefers-reduced-motion / reduced-transparency / contrast 대응
- [x] 16.10 test·build·lint + playwright-cli 확인 + ponytail 점검

## 17단계: 공유 링크 양방향(서로의 캘린더 보기)
- [x] 17.1 체크리스트·결정 기록
- [x] 17.2 supabase/schema_share_mutual.sql — is_share_partner() + events/categories 공유 select 정책 대칭화 (사용자가 SQL 에디터에서 실행)
- [x] 17.3 listSharedWithMe() 양방향(수락한 상대 + 내 링크를 수락한 상대) + 테스트
- [x] 17.4 ShareSection 안내 문구
- [x] 17.5 test·build·lint + ponytail 점검

## 17.6: accept_share 파라미터명 충돌 버그 수정 (실사용 제보)
- [x] 17.6 accept_share(share_id) → accept_share(p_share_id), 42702 ambiguous column 에러 수정 (schema_share_fix4.sql, 사용자가 SQL 에디터에서 실행 필요)

## 18단계: 반복 일정 검증 + 버그 수정 + 편의성 개선
- [x] 18.1 버그 A — "전체 일정" 편집 시 반복 앵커 재설정 방지
- [x] 18.2 버그 B — "날짜까지" until 기본값 제거 + 검증
- [x] 18.3 종일 다일치 반복 경고
- [x] 18.4 반복 요약 문구(summarizeRecurrence) + count 힌트
- [x] 18.5 테스트 커버리지 보강(interval+byWeekday, Supabase recurrence 왕복)
- [x] 18.6 test·build·lint + playwright-cli 확인 + ponytail 점검

## 19단계: 함께 일정 (공동 일정 + 수락 + 앱 내 알림)
- [x] 19.1 schema_together.sql — event_participants 테이블·함수·RLS·트리거·respond_to_event RPC (사용자가 SQL 에디터에서 실행 필요)
- [x] 19.2 supabaseRepository update 시 user_id 제외 + 남의 일정 category/color 제외
- [x] 19.3 타입(Participant/participants/AppNotification) + 참여자 매핑 + PGRST200 재시도
- [x] 19.4 lib/together.ts (isJoint/myJointStatus/canEdit/isVisibleTo) + 테스트
- [x] 19.5 useCalendar 연결 — shownEvents에 isVisibleTo 반영, reload 노출 (respondToEvent/setParticipants는 togetherRepository가 생기는 19.6에서 함께 연결)
- [x] 19.6 togetherRepository.ts + notifications 테이블·트리거(schema_together_notifications.sql, 사용자가 SQL 에디터에서 실행 필요) + useCalendar에 respondToEvent/setEventParticipants 연결
- [x] 19.7 EventEditor — 참여자 선택/방식(TogetherFields.tsx로 분리), 대기·수락 화면 분기, 참여 취소, 반복 범위 제한
- [x] 19.8 JointBadge + MonthView/TimeGridView/AgendaView 반영
- [x] 19.9 알림 — useNotifications, NotificationPanel, Header 종+배지, App 연결
- [x] 19.10 DataBackup 정리 + playwright-cli 확인(로그아웃 회귀 없음, 콘솔 에러 0) + ponytail 점검(디버그 로그·TODO·미사용 CSS 없음)

## 20단계: 모바일 UX/UI 개선 (apple-design + 혹독한 보스)
- [x] 20.1 스와이프·스크롤 충돌 — 가로 의도 판정 후에만 드래그, 커밋 기준 강화, 스와이프 후 탭 차단, 스크롤 컨테이너 pan-y
- [x] 20.2 시간 그리드 현재 시각 근처에서 시작 + 현재 시각 선 + 하단 여백
- [x] 20.3 viewport-fit=cover·theme-color, 100dvh, 세이프 에어리어
- [x] 20.4 전역 터치 위생 — 탭 하이라이트, 입력 16px, hover:hover, :active, 11px 이상 글자
- [x] 20.5 터치 영역 44px + 터치에서 보이는 삭제 버튼 + 할 일 추가 폼
- [x] 20.6 시트 구조 — 고정 헤더 + 스크롤 본문, 스크롤 잠금, 바운스 없는 진입
- [x] 20.7 편집 시트 상단 바 [취소] 제목 [저장]
- [x] 20.8 모바일 헤더 2줄(큰 월 제목 → 날짜 선택, 세그먼트) + 설정에 계정
- [x] 20.9 모바일 월 보기 — 점 + 선택일 일정 목록
- [x] 20.10 모바일 주 블록 iOS식(제목 줄바꿈)
- [x] 20.11 FAB SVG 아이콘
- [x] 20.12 혹독한 보스 검증 루프(서브에이전트 6개, 모바일 집중)

## 21단계: 바탕화면 위젯 (Edge 앱 창 + PowerShell, 웹과 양방향 자동 갱신)
- [x] 21.1 useCalendar 주기 갱신 — 60초 + 포커스/탭 복귀 시 reload (웹·위젯 공통, 뒤늦은 응답이 최신 데이터를 덮지 않게 방지) + 테스트
- [x] 21.2 위젯 모드 — `?widget=1`일 때만 배경 토큰을 키 색으로 덮어써 배경만 투명 (웹 디자인 불변, 팝업은 불투명)
- [x] 21.3 desktop-widget/calendar-widget.ps1 — Edge --app 전용 프로필 실행, 위치/크기, 맨 아래 고정, 색 키 투명, 부팅 직후 재시도 + 시작프로그램 등록 (시작프로그램 등록은 사용자 확인 후 -Install)
- [x] 21.4 스파이크 검증 — Win+D 후 표시(OK), 색 키 투명(GPU 끄면 OK), 로그인 유지(OK), 위치·크기 저장·복원(OK). 양방향 반영·재부팅 자동 실행은 사용자 사용 중 확인
- [x] 21.5 ponytail 점검 + 결과 기록
- [x] 21.6 사용자 피드백 반영 — 창 틀(제목 표시줄·닫기·스크롤바) 숨김, 데스크탑 크기 기본값, 색 키 → 창 전체 반투명(85%), Win+D에서 위젯 표시
- [x] 21.7 위젯 사이드바 접기/펼치기 — 위젯 모드에서만 헤더 맨 앞 토글 버튼, 접힘 상태 localStorage 저장, 접으면 격자가 전체 폭 (웹은 변경 없음)
- [x] 21.8 위젯 혹독한 보스 리뷰(서브에이전트 4개: 스크립트 정적, 앱 코드·웹 회귀, 장기 운영 시나리오, 실기 측정) + 직접 검증·수정·재측정

## 22단계: 위젯 배경만 투명 (색 키 + 글자 흰 외곽선, 나머지는 또렷하게)
- [x] 22.1 앱 CSS — 위젯 모드에서 body 배경만 키 색 #FFFFFE(`--color-page`), 글자 흰 외곽선(text-shadow), 팝업 그림자 제거, 헤더 불투명 (웹 불변)
- [ ] 22.2 스크립트 — GPU 끔 + 색 키(0xFEFFFF) 적용, -Opacity 기본 100, -Install 재실행
- [ ] 22.3 실측·회귀 — playwright(웹 불변), 배포 후 실제 위젯 Win+D 캡처(또렷함·외곽선·클릭), 21.8 회귀 항목, CPU 재측정, 기록
