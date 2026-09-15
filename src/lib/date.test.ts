// date.ts 날짜 변환·포맷 유틸 테스트
import { describe, expect, it } from 'vitest'
import {
  formatMonthTitle,
  formatWeekdayShort,
  getMonthGrid,
  parseDateKey,
  parseDateTimeKey,
  toDateKey,
  toDateTimeKey,
} from './date'

describe('toDateKey / parseDateKey', () => {
  it('Date를 YYYY-MM-DD로 변환한다', () => {
    expect(toDateKey(new Date(2026, 8, 15))).toBe('2026-09-15')
  })

  it('YYYY-MM-DD를 왕복 변환해도 같은 날짜를 가리킨다 (타임존 밀림 없음)', () => {
    const key = '2026-01-01'
    expect(toDateKey(parseDateKey(key))).toBe(key)
  })
})

describe('toDateTimeKey / parseDateTimeKey', () => {
  it('Date를 YYYY-MM-DDTHH:mm으로 변환한다', () => {
    expect(toDateTimeKey(new Date(2026, 8, 15, 9, 30))).toBe('2026-09-15T09:30')
  })

  it('시간 포함 문자열을 왕복 변환해도 같은 시각을 가리킨다', () => {
    const key = '2026-09-15T09:30'
    expect(toDateTimeKey(parseDateTimeKey(key))).toBe(key)
  })

  it('날짜만 있는 문자열(종일 일정)도 파싱한다', () => {
    expect(toDateKey(parseDateTimeKey('2026-09-15'))).toBe('2026-09-15')
  })
})

describe('formatMonthTitle', () => {
  it('연-월을 한국어로 포맷한다', () => {
    expect(formatMonthTitle(new Date(2026, 8, 1))).toBe('2026년 9월')
  })
})

describe('formatWeekdayShort', () => {
  it('요일을 한 글자로 포맷한다', () => {
    expect(formatWeekdayShort(new Date(2026, 8, 13))).toBe('일') // 2026-09-13은 일요일
    expect(formatWeekdayShort(new Date(2026, 8, 14))).toBe('월')
  })
})

describe('getMonthGrid', () => {
  it('일요일부터 시작해 42일(6주)을 반환한다', () => {
    const grid = getMonthGrid(new Date(2026, 8, 15)) // 2026년 9월 아무 날
    expect(grid).toHaveLength(42)
    expect(grid[0].getDay()).toBe(0)
    expect(toDateKey(grid[0])).toBe('2026-08-30') // 9월 1일(화)이 속한 주의 일요일
    expect(toDateKey(grid[41])).toBe('2026-10-10')
  })

  it('연속된 날짜로 채워진다', () => {
    const grid = getMonthGrid(new Date(2026, 8, 1))
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].getTime() - grid[i - 1].getTime()).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('달마다 주 수가 달라도 항상 6주를 반환한다 (예: 2월)', () => {
    expect(getMonthGrid(new Date(2026, 1, 10))).toHaveLength(42)
    expect(getMonthGrid(new Date(2027, 9, 10))).toHaveLength(42)
  })
})
