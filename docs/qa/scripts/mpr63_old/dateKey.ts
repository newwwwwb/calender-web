// 오늘(지역 날짜)과 YYYY-MM-DD 문자열의 검증·더하기·차이 계산을 담당하는 순수 함수 모음
import { addDays as addDaysFns, addMonths as addMonthsFns, differenceInCalendarDays, format, parse } from 'date-fns'
import type { DateKey } from './types'

const FORMAT = 'yyyy-MM-dd'
const PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 'YYYY-MM-DD'를 지역 자정 Date로. 형식이 틀리거나 없는 날짜(2027-02-30)면 null
function toDate(key: DateKey): Date | null {
  if (!PATTERN.test(key)) return null
  const d = parse(key, FORMAT, new Date(0))
  return Number.isNaN(d.getTime()) || format(d, FORMAT) !== key ? null : d
}

// 오늘의 지역 날짜. 테스트는 가짜 타이머로 고정한다
export function today(): DateKey {
  return format(new Date(), FORMAT)
}

export function isValidDateKey(key: string): boolean {
  return toDate(key) !== null
}

export function addDays(key: DateKey, days: number): DateKey {
  return format(addDaysFns(mustDate(key), days), FORMAT)
}

// 달력 기준 개월 더하기. 말일을 넘으면 그 달 말일로 맞춘다(01-31 + 1 = 02-28)
export function addMonths(key: DateKey, months: number): DateKey {
  return format(addMonthsFns(mustDate(key), months), FORMAT)
}

// to - from 을 일 단위로. to가 뒤면 양수
export function diffDays(to: DateKey, from: DateKey): number {
  return differenceInCalendarDays(mustDate(to), mustDate(from))
}

function mustDate(key: DateKey): Date {
  const d = toDate(key)
  if (!d) throw new Error(`invalid DateKey: ${key}`)
  return d
}
