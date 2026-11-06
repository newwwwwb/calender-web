// dateKey 순수 함수(오늘·검증·더하기·차이)의 정상·경계·실패 경로 테스트
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, addMonths, diffDays, isValidDateKey, today } from './dateKey'

describe('dateKey', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 5, 23, 59)) })
  afterEach(() => { vi.useRealTimers() })

  it('today는 지역 날짜를 돌려준다(자정 직전에도 같은 날)', () => {
    expect(today()).toBe('2026-11-05')
  })

  it('isValidDateKey는 없는 날짜와 잘못된 형식을 거른다', () => {
    expect(isValidDateKey('2027-02-28')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true)
    expect(isValidDateKey('2027-02-30')).toBe(false)
    expect(isValidDateKey('2027-2-3')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
  })

  it('addMonths는 말일을 보정한다(AC-06-12)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-05', 6)).toBe('2027-05-05')
  })

  it('addDays·diffDays는 일 단위로 계산한다', () => {
    expect(addDays('2026-11-05', 60)).toBe('2027-01-04')
    expect(diffDays('2026-11-05', '2026-10-06')).toBe(30)
    expect(diffDays('2026-11-04', '2026-11-05')).toBe(-1)
  })

  it('잘못된 DateKey를 더하면 던진다', () => {
    expect(() => addDays('2027-02-30', 1)).toThrow()
  })
})
