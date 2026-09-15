// 2026~2027년 한국 법정공휴일 정적 데이터 (대체공휴일 포함)
//
// 설날·추석은 음력 기준이라 매년 계산이 다르고, 대체공휴일 적용 규칙도
// 공휴일 종류마다 달라 정적 테이블로 관리한다 (연도가 늘어나면 이 목록에 추가).
// - 3·1절/광복절/개천절/한글날/어린이날/부처님오신날/설날·추석: 토·일요일과
//   겹치면 대체공휴일 적용 (단, 설날·추석은 일요일과 겹칠 때만 적용).
// - 신정, 현충일, 크리스마스: 대체공휴일 미적용.
export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  isSubstitute?: boolean
}

export const HOLIDAYS: Holiday[] = [
  // 2026
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-03-02', name: '삼일절', isSubstitute: true },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-05-25', name: '부처님오신날', isSubstitute: true },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-07-17', name: '제헌절' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-08-17', name: '광복절', isSubstitute: true },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-05', name: '개천절', isSubstitute: true },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '크리스마스' },

  // 2027
  { date: '2027-01-01', name: '신정' },
  { date: '2027-02-06', name: '설날 연휴' },
  { date: '2027-02-07', name: '설날' },
  { date: '2027-02-08', name: '설날 연휴' },
  { date: '2027-02-09', name: '설날', isSubstitute: true },
  { date: '2027-03-01', name: '삼일절' },
  { date: '2027-05-05', name: '어린이날' },
  { date: '2027-05-13', name: '부처님오신날' },
  { date: '2027-06-06', name: '현충일' },
  { date: '2027-07-17', name: '제헌절' },
  { date: '2027-08-15', name: '광복절' },
  { date: '2027-08-16', name: '광복절', isSubstitute: true },
  { date: '2027-09-14', name: '추석 연휴' },
  { date: '2027-09-15', name: '추석' },
  { date: '2027-09-16', name: '추석 연휴' },
  { date: '2027-10-03', name: '개천절' },
  { date: '2027-10-04', name: '개천절', isSubstitute: true },
  { date: '2027-10-09', name: '한글날' },
  { date: '2027-10-11', name: '한글날', isSubstitute: true },
  { date: '2027-12-25', name: '크리스마스' },
]

const HOLIDAY_MAP: Map<string, Holiday> = new Map(HOLIDAYS.map((h) => [h.date, h]))

// 해당 날짜(YYYY-MM-DD)가 공휴일이면 정보를 반환, 아니면 undefined
export function getHoliday(dateKey: string): Holiday | undefined {
  return HOLIDAY_MAP.get(dateKey)
}
