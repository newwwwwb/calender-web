// 구간 연비 계산(BR-11)의 AC-05-1~5·AC-05-6 테스트
import { describe, expect, it } from 'vitest'
import { economySegments } from './fuelEconomy'

let n = 0
const f = (id: string, date: string, odometerKm: number | null, liters: number | null, fullTank: boolean, kind: 'fuel' | 'wash' = 'fuel') =>
  ({ id, kind, date, odometerKm, liters, fullTank, createdAt: `2026-01-01T00:00:${String(n++).padStart(2, '0')}Z` })

const A = () => f('A', '2026-10-01', 10000, 40, true)
const mid = () => f('M', '2026-10-10', null, 20, false)
const B = () => f('B', '2026-10-20', 10500, 30, true)

describe('economySegments', () => {
  it('중간 비가득 주유량까지 합해 계산한다(AC-05-1: 500 ÷ 50 = 10.0)', () => {
    expect(economySegments([A(), mid(), B()])).toEqual([{ endRecordId: 'B', endDate: '2026-10-20', kmPerL: 10 }])
  })

  it('가득 기록을 추가하면 새 구간만 늘고 이전 구간은 그대로다(AC-05-4)', () => {
    const segs = economySegments([A(), mid(), B(), f('C', '2026-11-01', 11100, 40, true)])
    expect(segs.map((s) => [s.endRecordId, s.kmPerL])).toEqual([['B', 10], ['C', 15]])
  })

  it('입력 순서와 무관하게 날짜 순으로 짝짓는다', () => {
    expect(economySegments([B(), mid(), A()])).toHaveLength(1)
  })

  it('가득 주유 기록이 1건이면 구간이 없다(AC-05-2)', () => {
    expect(economySegments([A(), mid()])).toEqual([])
    expect(economySegments([])).toEqual([])
  })

  it('양 끝 중 하나라도 주행거리가 없으면 그 구간을 뺀다(AC-05-3)', () => {
    expect(economySegments([f('A', '2026-10-01', null, 40, true), B()])).toEqual([])
    expect(economySegments([A(), f('B', '2026-10-20', null, 30, true)])).toEqual([])
  })

  it('주행거리 차이가 0 이하면 오류 없이 뺀다(AC-05-5)', () => {
    expect(economySegments([A(), f('B', '2026-10-20', 10000, 30, true)])).toEqual([])
    expect(economySegments([A(), f('B', '2026-10-20', 9000, 30, true)])).toEqual([])
  })

  it('구간 안에 주유량이 빈 주유 기록이 있으면 뺀다(AC-05-6)', () => {
    expect(economySegments([A(), f('M', '2026-10-10', null, null, false), B()])).toEqual([])
  })

  it('주유량 합이 0이면 0으로 나누지 않고 뺀다', () => {
    expect(economySegments([A(), f('B', '2026-10-20', 10500, 0, true)])).toEqual([])
  })

  it('주유가 아닌 기록은 무시한다', () => {
    expect(economySegments([A(), f('W', '2026-10-05', 10100, null, true, 'wash'), B()])).toHaveLength(1)
  })

  it('같은 날 주행거리 없는 주유 기록은 뒤에 놓고 그 끝의 짝은 뺀다(AC-05-7)', () => {
    const recs = [f('A', '2026-10-20', null, 20, true), f('B', '2026-10-20', 10500, 30, true), f('Z', '2026-10-20', 10000, 40, true)]
    expect(economySegments(recs)).toEqual([{ endRecordId: 'B', endDate: '2026-10-20', kmPerL: 500 / 30 }])
  })

  it('같은 날은 주행거리 오름차순으로 놓는다', () => {
    const segs = economySegments([f('B', '2026-10-01', 10500, 30, true), f('A', '2026-10-01', 10000, 40, true)])
    expect(segs).toEqual([{ endRecordId: 'B', endDate: '2026-10-01', kmPerL: 500 / 30 }])
  })
})
