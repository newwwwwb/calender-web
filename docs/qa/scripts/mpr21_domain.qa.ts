// MPR-21 QA 임시 스크립트: 연비·주행거리 계산 AC를 정상·경계·실패로 확인한다. npm test에는 포함되지 않는다(실행 명령은 docs/qa/report.md).
import { describe, expect, it } from 'vitest'
import { economySegments } from '../../../src/carbook/domain/fuelEconomy'
import { currentOdometerKm, dailyAverageKm, isOdometerDecrease } from '../../../src/carbook/domain/odometer'
import { addDays } from '../../../src/carbook/domain/dateKey'

type F = Parameters<typeof economySegments>[0][number]
let seq = 0
const f = (o: Partial<F> & { id: string; date: string }): F => ({ kind: 'fuel', odometerKm: null, liters: null, fullTank: false, createdAt: `2026-10-01T00:00:${String(seq++).padStart(2, '0')}.000000+00:00`, ...o })
const A = f({ id: 'A', date: '2026-10-01', odometerKm: 10000, fullTank: true })
const MID = f({ id: 'MID', date: '2026-10-10', liters: 20 })
const B = f({ id: 'B', date: '2026-10-20', odometerKm: 10500, liters: 30, fullTank: true })

describe('AC-05 연비 구간 계산(BR-11)', () => {
  it('AC-05-1 (10,500−10,000)÷(20+30)=10.0, 구간 1개, 끝 기록 B', () => {
    const s = economySegments([A, MID, B])
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ endRecordId: 'B', endDate: '2026-10-20' })
    expect(s[0].kmPerL).toBeCloseTo(10.0, 10)
  })
  it('입력 순서가 뒤섞여도 같은 결과', () => expect(economySegments([B, A, MID])).toEqual(economySegments([A, MID, B])))
  it('AC-05-2 가득 1건 → 구간 없음', () => expect(economySegments([A])).toEqual([]))
  it('AC-05-2 경계: 기록 0건·가득 없는 주유만 → 구간 없음', () => { expect(economySegments([])).toEqual([]); expect(economySegments([MID])).toEqual([]) })
  it('AC-05-3 가득 2건 중 하나가 주행거리 없음 → 그 구간 없음(양쪽 경우)', () => {
    expect(economySegments([{ ...A, odometerKm: null }, MID, B])).toEqual([])
    expect(economySegments([A, MID, { ...B, odometerKm: null }])).toEqual([])
  })
  it('AC-05-4 가득 C(11-01, 11,100km, 40L) 추가 → 최근 15.0, B 구간 10.0 그대로', () => {
    const C = f({ id: 'C', date: '2026-11-01', odometerKm: 11100, liters: 40, fullTank: true })
    const s = economySegments([A, MID, B, C])
    expect(s.map((x) => x.endRecordId)).toEqual(['B', 'C'])
    expect(s[0].kmPerL).toBeCloseTo(10.0, 10)
    expect(s[1].kmPerL).toBeCloseTo(15.0, 10)
  })
  it('AC-05-5 주행거리 차이 0 → 오류 없이 구간 없음, 음수도 없음', () => {
    expect(economySegments([A, { ...B, odometerKm: 10000 }])).toEqual([])
    expect(economySegments([A, { ...B, odometerKm: 9000 }])).toEqual([])
  })
  it('AC-05-5 경계: 주유량 합이 0 → 구간 없음(0으로 나누지 않음)', () => expect(economySegments([A, { ...B, liters: 0 }])).toEqual([]))
  it('AC-05-6 구간 안 비가득 기록의 주유량이 비어 있음 → 구간 없음', () => {
    expect(economySegments([A, f({ id: 'X', date: '2026-10-10' }), B])).toEqual([])
  })
  it('AC-05-6 B의 주유량이 비어도 구간 없음, A의 주유량은 구간에 안 들어가 비어도 됨', () => {
    expect(economySegments([A, MID, { ...B, liters: null }])).toEqual([])
    expect(economySegments([{ ...A, liters: null }, MID, B])).toHaveLength(1)
    expect(economySegments([{ ...A, liters: 999 }, MID, B])[0].kmPerL).toBeCloseTo(10.0, 10)
  })
  it('AC-05-7 같은 날 주행거리 없는 가득 A2(먼저 만듦)와 B2(10,500) 앞에 Z → (Z,B2)만, (B2,A2) 없음', () => {
    const Z = f({ id: 'Z', date: '2026-10-01', odometerKm: 10000, liters: 10, fullTank: true })
    const A2 = f({ id: 'A2', date: '2026-10-20', fullTank: true, liters: 5, createdAt: '2026-10-20T08:00:00.000000+00:00' })
    const B2 = f({ id: 'B2', date: '2026-10-20', odometerKm: 10500, liters: 30, fullTank: true, createdAt: '2026-10-20T09:00:00.000000+00:00' })
    const s = economySegments([Z, A2, B2])
    expect(s.map((x) => x.endRecordId)).toEqual(['B2'])
    expect(s[0].kmPerL).toBeCloseTo(500 / 30, 10)
  })
  it('경계: 같은 날은 주행거리 오름차순, 같으면 먼저 만든 순', () => {
    const P = f({ id: 'P', date: '2026-10-05', odometerKm: 10300, liters: 10, fullTank: true })
    const Q = f({ id: 'Q', date: '2026-10-05', odometerKm: 10200, liters: 10, fullTank: true })
    expect(economySegments([A, P, Q]).map((x) => x.endRecordId)).toEqual(['Q', 'P'])
  })
  it('경계: 주유가 아닌 기록은 무시', () => {
    const noise = f({ id: 'N', kind: 'maintenance', date: '2026-10-05', odometerKm: 10100, liters: 99, fullTank: true })
    expect(economySegments([A, noise, MID, B])).toEqual(economySegments([A, MID, B]))
  })
  it('가득 사이 여러 비가득의 주유량을 모두 더함', () => {
    const M2 = f({ id: 'M2', date: '2026-10-15', liters: 10 })
    expect(economySegments([A, MID, M2, B])[0].kmPerL).toBeCloseTo(500 / 60, 10)
  })
})

describe('BR-07 현재 주행거리 / AC-04-6 감소 판정', () => {
  const r = (id: string, odometerKm: number | null) => ({ id, date: '2026-10-01', odometerKm })
  it('max(차량, 기록 최댓값)', () => { expect(currentOdometerKm(10000, [r('a', 10500), r('b', 9000)])).toBe(10500); expect(currentOdometerKm(50000, [r('a', 10500)])).toBe(50000) })
  it('값이 없으면 0', () => { expect(currentOdometerKm(null, [])).toBe(0); expect(currentOdometerKm(null, [r('a', null)])).toBe(0) })
  it('수정 중인 기록 자신은 제외', () => expect(currentOdometerKm(null, [r('a', 50000), r('b', 40000)], 'a')).toBe(40000))
  it('AC-04-6 현재 50,000에 49,000 → 감소(MSG-10 대상), 50,000·50,001·빈 값은 아님', () => {
    expect(isOdometerDecrease(49000, 50000)).toBe(true)
    expect(isOdometerDecrease(50000, 50000)).toBe(false)
    expect(isOdometerDecrease(50001, 50000)).toBe(false)
    expect(isOdometerDecrease(null, 50000)).toBe(false)
    expect(isOdometerDecrease(0, 0)).toBe(false)
  })
})

describe('BR-12 하루 평균 주행거리(90일)', () => {
  const T = '2026-11-06'
  const r = (id: string, date: string, odometerKm: number | null) => ({ id, date, odometerKm })
  it('정상: 30일 동안 300km → 10 km/일', () => expect(dailyAverageKm([r('a', addDays(T, -30), 10000), r('b', T, 10300)], T)).toBeCloseTo(10, 10))
  it('경계: 오늘−90일 포함, 오늘−91일 제외', () => {
    expect(dailyAverageKm([r('a', addDays(T, -90), 10000), r('b', T, 10900)], T)).toBeCloseTo(10, 10)
    expect(dailyAverageKm([r('a', addDays(T, -91), 10000), r('b', T, 10900)], T)).toBeNull()
  })
  it('경계: 오늘 이후 날짜 기록은 제외', () => expect(dailyAverageKm([r('a', addDays(T, -10), 100), r('b', addDays(T, 1), 500)], T)).toBeNull())
  it('기록 2건 미만 → null, 0건 → null', () => { expect(dailyAverageKm([r('a', T, 100)], T)).toBeNull(); expect(dailyAverageKm([], T)).toBeNull() })
  it('주행거리 없는 기록은 무시', () => expect(dailyAverageKm([r('a', addDays(T, -10), null), r('b', T, 100)], T)).toBeNull())
  it('날짜 차이 0일 → null, 주행거리 차이 0 이하 → null', () => {
    expect(dailyAverageKm([r('a', T, 100), r('b', T, 200)], T)).toBeNull()
    expect(dailyAverageKm([r('a', addDays(T, -5), 200), r('b', T, 200)], T)).toBeNull()
    expect(dailyAverageKm([r('a', addDays(T, -5), 300), r('b', T, 200)], T)).toBeNull()
  })
  it('같은 날은 주행거리 오름차순으로 놓고 첫·마지막 기록만 사용(중간 기록 무시)', () => {
    const rows = [r('z', T, 1100), r('m', addDays(T, -5), 5000), r('a', addDays(T, -10), 1000), r('y', T, 1050)]
    expect(dailyAverageKm(rows, T)).toBeCloseTo((1100 - 1000) / 10, 10)
  })
})
