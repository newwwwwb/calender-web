# 캘린더

React + Vite + TypeScript로 만든 개인 캘린더 웹앱. 구글 로그인으로 기기 간 동기화되고, Windows 바탕화면 위젯으로도 띄울 수 있습니다.

배포: https://calender-web-ten.vercel.app/

## 기능

- 월/주/일/목록 보기, 미니 캘린더, 날짜 클릭 시 일 보기로 이동
- 일정 생성·수정·삭제, 종일/시간대 일정, 카테고리·색상 지정
- 반복 일정(매일/매주/매월/매년) 및 "이 일정만 / 이후 전체 / 전체" 수정·삭제
- 할 일(Todo) 목록
- 구글 로그인 + Supabase 저장으로 기기 간 동기화
- 캘린더 공유: 초대 링크로 서로의 캘린더를 보기 전용으로 공유, 겹쳐 보기·토글
- 함께 일정: 공유 중인 상대를 참여자로 초대(수락 요청 또는 바로 등록), 앱 내 알림
- 테마 전환(기본 / ZIGZAG 스타일, 액센트 색)
- 전체화면 검색, 키보드 단축키(T/M/W/D/A/←→/N/`/`/Esc)
- 모바일 대응(바텀시트, 스와이프 이동, 하단 고정 + 버튼)
- 한국 공휴일 표시(2026~2027), JSON 백업 내보내기/가져오기
- Windows 바탕화면 위젯

## 바탕화면 위젯 (Windows)

웹 캘린더를 창 틀 없는 반투명 창으로 바탕화면 맨 아래에 띄웁니다. 웹과 같은 데이터를 쓰며 60초마다, 그리고 창을 누를 때 자동으로 갱신됩니다. Microsoft Edge가 필요합니다.

PowerShell에서 한 줄로 설치합니다.

```powershell
irm https://raw.githubusercontent.com/newwwwwb/calender-web/master/desktop-widget/install.ps1 | iex
```

1. 스크립트가 `%LOCALAPPDATA%\CalendarWidget`에 저장되고 시작프로그램에 등록됩니다.
2. 로그인 창이 열리면 구글 로그인을 마치고 창을 닫습니다. 그러면 위젯이 뜹니다.
3. 이후에는 Windows에 로그인할 때 자동으로 켜집니다. 같은 명령을 다시 실행하면 최신 버전으로 업데이트됩니다.

사용 팁.

- 이동·크기 조절: 마우스를 위젯 맨 위에 올리면 창 틀이 나타납니다. 위치와 크기는 기억됩니다.
- Win+D(바탕화면 보기)를 누르면 위젯이 위로 올라옵니다.
- 로그인이 풀렸을 때: `powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\CalendarWidget\calendar-widget.ps1" -Setup`
- 투명도 변경(기본 85%): 위 파일을 `-Opacity 70 -Install`로 실행해 다시 등록합니다.
- 끄기/제거: 시작프로그램 폴더(`shell:startup`)의 `CalendarWidget.lnk`를 지우고, 작업 관리자에서 위젯 PowerShell과 Edge를 종료합니다. 창을 닫기만 하면 10초 뒤 다시 뜹니다.

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm test         # vitest
npm run build    # 타입체크 + 빌드
npm run lint     # oxlint
```

## 데이터 저장

Supabase(Postgres + Google OAuth)에 저장합니다.

1. `.env.local.example`을 `.env.local`로 복사하고 Supabase 프로젝트 URL과 anon 키를 넣습니다.
2. Supabase SQL 에디터에서 `supabase/schema.sql`을 먼저 실행하고, 나머지 `supabase/*.sql`을 이어서 실행합니다.

저장소 구현은 `src/storage/repository.ts`의 `EventRepository` 인터페이스 뒤에 분리되어 있습니다.

## 기술 스택

React 19, TypeScript, Vite, date-fns, Motion, CSS Modules, Supabase, Vitest + Testing Library
