// holidays.ts 공휴일 조회 테스트
import { describe, expect, it } from 'vitest'
import { getHoliday, HOLIDAYS } from './holidays'

describe('getHoliday', () => {
  it('공휴일이면 이름을 반환한다', () => {
    expect(getHoliday('2026-01-01')?.name).toBe('신정')
    expect(getHoliday('2027-09-15')?.name).toBe('추석')
  })

  it('공휴일이 아니면 undefined를 반환한다', () => {
    expect(getHoliday('2026-09-01')).toBeUndefined()
  })

  it('대체공휴일을 isSubstitute로 표시한다', () => {
    expect(getHoliday('2026-08-17')).toMatchObject({ name: '광복절', isSubstitute: true })
    expect(getHoliday('2027-02-09')).toMatchObject({ name: '설날', isSubstitute: true })
  })

  it('크리스마스가 토요일과 겹치면 대체공휴일이 적용된다 (2027-12-25 토요일 → 12-27 대체, 보스 리뷰에서 발견)', () => {
    expect(getHoliday('2027-12-27')).toMatchObject({ name: '크리스마스', isSubstitute: true })
  })

  it('대체공휴일이 없는 공휴일에는 대체일이 없다 (2026년 추석: 토요일과 겹쳐도 미적용)', () => {
    expect(getHoliday('2026-09-27')).toBeUndefined()
    expect(getHoliday('2026-09-28')).toBeUndefined()
  })
})

describe('HOLIDAYS 데이터 무결성', () => {
  it('날짜 중복이 없다', () => {
    const dates = HOLIDAYS.map((h) => h.date)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('모든 날짜가 YYYY-MM-DD 형식이다', () => {
    for (const h of HOLIDAYS) {
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
