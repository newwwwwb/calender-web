# 체크리스트

각 단계는 하위 작업(N.1, N.2 …)으로 나누고, 단계가 끝나면 ponytail로 점검한다.

## 1단계: 프로젝트 셋업
- [x] 1.1 Vite React-TS 스캐폴드, 데모 코드 제거, git init
- [x] 1.2 checklist.md / context-notes.md 작성
- [ ] 1.3 vitest + Testing Library 설정, 스모크 테스트
- [ ] 1.4 디자인 토큰(tokens.css), global.css, Pretendard 폰트, lang="ko"
- [ ] 1.5 앱 셸 레이아웃(Header, Sidebar, 메인 자리표시)
- [ ] 1.6 ponytail 점검 및 반영

## 2단계: 도메인 (시작 시 세분화)
- [ ] types / date / recurrence / holidays / localRepository + 단위 테스트
- [ ] ponytail 점검

## 3단계: 월 보기 + 일정 에디터(CRUD) + 카테고리
- [ ] ponytail 점검

## 4단계: 주/일 보기(시간 그리드, 겹침 배치) + 목록 보기
- [ ] ponytail 점검

## 5단계: 반복 일정 편집 흐름(이 일정만/이후/전체)
- [ ] ponytail 점검

## 6단계: 검색, 키보드 단축키, 모바일 스와이프·바텀시트, JSON 내보내기/가져오기
- [ ] ponytail 점검

## 7단계: 반응형 다듬기 + Vercel 배포
- [ ] ponytail 점검

## 8단계: Supabase 연동 (마지막)
- [ ] 로그인, events/categories 테이블 + RLS, supabaseRepository, 로컬 데이터 1회 업로드
- [ ] ponytail 점검
