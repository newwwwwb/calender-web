// date.ts 날짜 변환·포맷 유틸 테스트
import { describe, expect, it } from 'vitest'
import {
  formatMonthTitle,
  formatWeekdayShort,
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
