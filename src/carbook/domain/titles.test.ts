// 연결 일정 제목(BR-20, F-07)과 자동차세 빠른 선택 날짜(AC-15-1·2)를 확인하는 테스트
import { describe, expect, it } from 'vitest'
import { nextCarTaxDate } from './dueDates'
import { dueEventTitle, itemEventTitle } from './titles'

describe('titles', () => {
  it('교체 항목과 만기일 3종의 제목 형식', () => {
    expect(itemEventTitle('내 차', '엔진오일')).toBe('[내 차] 엔진오일 교체 예정')
    expect(dueEventTitle('내 차', 'insurance')).toBe('[내 차] 보험 만기')
    expect(dueEventTitle('내 차', 'car_tax')).toBe('[내 차] 자동차세 납부')
    expect(dueEventTitle('내 차', 'inspection')).toBe('[내 차] 정기검사 만기')
  })
})

describe('nextCarTaxDate', () => {
  it('오늘 2026-11-05: 12월 31일은 올해, 6월 30일은 다음 해(AC-15-1·2)', () => {
    expect(nextCarTaxDate('dec31', '2026-11-05')).toBe('2026-12-31')
    expect(nextCarTaxDate('jun30', '2026-11-05')).toBe('2027-06-30')
  })

  it('오늘이 6월 30일이면 오늘, 12월 31일 다음 날이면 다음 해', () => {
    expect(nextCarTaxDate('jun30', '2026-06-30')).toBe('2026-06-30')
    expect(nextCarTaxDate('jun30', '2026-07-01')).toBe('2027-06-30')
    expect(nextCarTaxDate('dec31', '2026-12-31')).toBe('2026-12-31')
    expect(nextCarTaxDate('dec31', '2027-01-01')).toBe('2027-12-31')
    expect(nextCarTaxDate('jun30', '2027-01-01')).toBe('2027-06-30')
  })
})
