// 날짜-문자열 변환과 한국어 로케일 포맷을 담당하는 date-fns 래퍼
import { addDays, addMonths, addWeeks, format, parse, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { CalendarView } from '../types'

// 캘린더 주는 일요일부터 시작한다
export const WEEK_STARTS_ON = 0 as const

const DATE_KEY_FORMAT = 'yyyy-MM-dd'
const DATE_TIME_KEY_FORMAT = "yyyy-MM-dd'T'HH:mm"

// Date -> 'YYYY-MM-DD' (도메인 모델의 allDay 일정 날짜 형식)
export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT)
}

// 'YYYY-MM-DD' -> Date (로컬 자정, 타임존 밀림 방지를 위해 parseISO 대신 parse 사용)
export function parseDateKey(key: string): Date {
  return parse(key, DATE_KEY_FORMAT, new Date())
}

// Date -> 'YYYY-MM-DDTHH:mm' (시간이 있는 일정의 start/end 형식)
export function toDateTimeKey(date: Date): string {
  return format(date, DATE_TIME_KEY_FORMAT)
}

// 'YYYY-MM-DDTHH:mm' 또는 'YYYY-MM-DD' -> Date
export function parseDateTimeKey(key: string): Date {
  return key.includes('T')
    ? parse(key, DATE_TIME_KEY_FORMAT, new Date())
    : parseDateKey(key)
}

// 월 보기 헤더용 "2026년 9월" 포맷
export function formatMonthTitle(date: Date): string {
  return format(date, 'yyyy년 M월', { locale: ko })
}

// 요일 헤더용 "일", "월" … 짧은 한 글자 포맷
export function formatWeekdayShort(date: Date): string {
  return format(date, 'EEEEE', { locale: ko })
}

// 월 보기 그리드: date가 속한 달을 포함하는 6주(42일)를 일요일 시작으로 반환.
// 달마다 필요한 주 수가 달라도(5주/6주) 항상 6주로 고정해 월 이동 시 그리드 높이가 흔들리지 않게 한다.
export function getMonthGrid(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// date가 속한 주(일요일 시작)의 7일을 반환 (주/목록 보기용)
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// 주 보기 헤더용 "2026년 9월 13일 - 19일" (달이 걸치면 양쪽에 월을 각각 표기)
export function formatWeekTitle(weekStart: Date, weekEnd: Date): string {
  const sameMonth = weekStart.getFullYear() === weekEnd.getFullYear() && weekStart.getMonth() === weekEnd.getMonth()
  if (sameMonth) {
    return `${formatMonthTitle(weekStart)} ${weekStart.getDate()}일 - ${weekEnd.getDate()}일`
  }
  return `${format(weekStart, 'M월 d일', { locale: ko })} - ${formatMonthTitle(weekEnd)} ${weekEnd.getDate()}일`
}

// 일 보기 헤더용 "2026년 9월 15일 (화)" 포맷
export function formatDayTitle(date: Date): string {
  return format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })
}

// 검색 결과 등 목록에 짧게 쓰는 "9월 15일 (화)" 포맷 (연도 생략)
export function formatShortDate(date: Date): string {
  return format(date, 'M월 d일 (EEE)', { locale: ko })
}

// 보기별 이동 단위: 월 보기/목록 보기는 한 달, 주 보기는 한 주, 일 보기는 하루씩 이동한다.
// amount는 양/음수 모두 가능(뒤로 가려면 음수). Header 버튼·키보드 단축키·스와이프가 공유한다.
export function stepDate(view: CalendarView, date: Date, amount: number): Date {
  switch (view) {
    case 'week':
      return amount > 0 ? addWeeks(date, amount) : subWeeks(date, -amount)
    case 'day':
      return amount > 0 ? addDays(date, amount) : subDays(date, -amount)
    default:
      return amount > 0 ? addMonths(date, amount) : subMonths(date, -amount)
  }
}
