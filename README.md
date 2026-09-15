# 캘린더

React + Vite + TypeScript로 만든 개인 캘린더 웹앱. 원티드(Montage) 디자인 시스템을 참고했습니다.

## 기능

- 월/주/일/목록 보기, 날짜 클릭 시 일 보기로 이동
- 일정 생성·수정·삭제, 종일/시간대 일정, 카테고리·색상 지정
- 반복 일정(매일/매주/매월/매년) 및 "이 일정만 / 이후 전체 / 전체" 수정·삭제
- 전체화면 검색, 키보드 단축키(T/M/W/D/A/←→/N/`/`/Esc)
- 모바일 대응(바텀시트, 스와이프 이동, 하단 고정 + 버튼)
- 한국 공휴일 표시(2026~2027), JSON 백업 내보내기/가져오기

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm test         # vitest
npm run build    # 타입체크 + 빌드
npm run lint     # oxlint
```

## 데이터 저장

현재는 브라우저 localStorage에 저장됩니다. 추후 Supabase 연동으로 기기 간 동기화를 지원할 예정입니다.
`src/storage/repository.ts`의 `EventRepository` 인터페이스 뒤에 저장소 구현이 분리되어 있어 교체가 쉽습니다.

## 기술 스택

React 19, TypeScript, Vite, date-fns, CSS Modules, Vitest + Testing Library
