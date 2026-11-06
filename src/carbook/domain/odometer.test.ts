// 현재 주행거리·감소 판정·하루 평균 주행거리의 정상·경계·실패 경로 테스트(AC-04-6, AC-06-3, AC-06-5)
import { describe, expect, it } from 'vitest'
import { currentOdometerKm, dailyAverageKm, isOdometerDecrease } from './odometer'

const r = (id: string, date: string, odometerKm: number | null) => ({ id, date, odometerKm })
const TODAY = '2026-11-05'

describe('currentOdometerKm', () => {
  it('차량 주행거리와 기록 중 가장 큰 값이다', () => {
    expect(currentOdometerKm(48000, [r('a', '2026-10-01', 47000), r('b', '2026-11-01', 50000)])).toBe(50000)
    expect(currentOdometerKm(51000, [r('a', '2026-10-01', 47000)])).toBe(51000)
  })

  it('값이 하나도 없으면 0이다', () => {
    expect(currentOdometerKm(null, [])).toBe(0)
    expect(currentOdometerKm(null, [r('a', '2026-10-01', null)])).toBe(0)
  })

  it('수정 중인 기록 자신은 제외한다(BR-08)', () => {
    const recs = [r('a', '2026-10-01', 47000), r('b', '2026-11-01', 50000)]
    expect(currentOdometerKm(null, recs, 'b')).toBe(47000)
  })
})

describe('isOdometerDecrease', () => {
  it('현재 50,000km에서 49,000은 감소다(AC-04-6)', () => {
    expect(isOdometerDecrease(49000, 50000)).toBe(true)
  })

  it('같거나 크거나 비어 있으면 감소가 아니다', () => {
    expect(isOdometerDecrease(50000, 50000)).toBe(false)
    expect(isOdometerDecrease(50001, 50000)).toBe(false)
    expect(isOdometerDecrease(null, 50000)).toBe(false)
  })
})

describe('dailyAverageKm', () => {
  it('최근 90일 안 첫·마지막 기록으로 계산한다(AC-06-3: 1,000 ÷ 30일)', () => {
    const recs = [r('a', '2026-10-06', 47000), r('b', '2026-11-05', 48000)]
    expect(dailyAverageKm(recs, TODAY)).toBeCloseTo(1000 / 30)
  })

  it('기록 순서와 무관하고, 같은 날은 주행거리 오름차순으로 본다', () => {
    const recs = [r('c', '2026-11-05', 48000), r('a', '2026-10-06', 47000), r('b', '2026-10-06', 46900)]
    expect(dailyAverageKm(recs, TODAY)).toBeCloseTo(1100 / 30)
  })

  it('기록이 1건뿐이면 null(AC-06-5)', () => {
    expect(dailyAverageKm([r('a', '2026-11-05', 42000)], TODAY)).toBeNull()
  })

  it('주행거리가 없는 기록은 세지 않는다', () => {
    expect(dailyAverageKm([r('a', '2026-10-06', null), r('b', '2026-11-05', 48000)], TODAY)).toBeNull()
  })

  it('90일 경계: 오늘−90일은 포함, −91일과 미래는 제외', () => {
    expect(dailyAverageKm([r('a', '2026-08-07', 1000), r('b', TODAY, 1900)], TODAY)).toBeCloseTo(10)
    expect(dailyAverageKm([r('a', '2026-08-06', 1000), r('b', TODAY, 1900)], TODAY)).toBeNull()
    expect(dailyAverageKm([r('a', '2026-10-06', 1000), r('b', '2026-11-06', 1900)], TODAY)).toBeNull()
  })

  it('날짜 차이 0일이거나 주행거리 차이가 0 이하면 null', () => {
    expect(dailyAverageKm([r('a', TODAY, 1000), r('b', TODAY, 1500)], TODAY)).toBeNull()
    expect(dailyAverageKm([r('a', '2026-10-06', 1000), r('b', TODAY, 1000)], TODAY)).toBeNull()
    expect(dailyAverageKm([r('a', '2026-10-06', 1500), r('b', TODAY, 1000)], TODAY)).toBeNull()
  })
})
