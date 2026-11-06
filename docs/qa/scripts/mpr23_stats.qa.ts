// MPR-23 QA 임시 스크립트: 월별·종류별 합계, 최근 12개월 목록, 2,000건 계산 시간의 AC-09 항목을 정상·경계·실패로 확인한다(npm test 미포함).
import { describe, expect, it } from 'vitest'
import { monthTotals, recentMonthlyTotals } from '../../../src/carbook/domain/stats'
import { economySegments } from '../../../src/carbook/domain/fuelEconomy'
import { RECORD_KINDS, type RecordKind } from '../../../src/carbook/domain/types'

const r = (kind: RecordKind, date: string, amountWon: number) => ({ kind, date, amountWon })

describe('AC-09-1 합계 일치', () => {
  const rows = [r('fuel', '2026-11-03', 50000), r('fuel', '2026-11-10', 40000), r('wash', '2026-11-12', 10000), r('insurance', '2026-11-20', 100000)]
  it('총합 200,000, 종류별 보험 100,000 · 주유 90,000 · 세차 10,000(금액 큰 순), 합이 총합과 같음', () => {
    const t = monthTotals(rows, '2026-11')
    expect(t.totalWon).toBe(200000)
    expect(t.byKind).toEqual([{ kind: 'insurance', amountWon: 100000 }, { kind: 'fuel', amountWon: 90000 }, { kind: 'wash', amountWon: 10000 }])
    expect(t.byKind.reduce((s, k) => s + k.amountWon, 0)).toBe(t.totalWon); expect(t.recordCount).toBe(4)
  })
  it('기록 순서를 바꿔도 같은 결과, 입력 배열은 바뀌지 않음', () => {
    const copy = [...rows].reverse(); const snap = JSON.stringify(copy)
    expect(monthTotals(copy, '2026-11')).toEqual(monthTotals(rows, '2026-11')); expect(JSON.stringify(copy)).toBe(snap)
  })
  it('BR-26 모든 7종류 포함, 금액 0도 기록이면 포함, 기록 없는 종류는 빠짐', () => {
    const all = RECORD_KINDS.map((k, i) => r(k, '2026-11-01', (i + 1) * 1000))
    const t = monthTotals(all, '2026-11'); expect(t.byKind).toHaveLength(7); expect(t.totalWon).toBe(28000)
    const z = monthTotals([r('parking', '2026-11-01', 0), r('fuel', '2026-11-02', 500)], '2026-11')
    expect(z.byKind).toEqual([{ kind: 'fuel', amountWon: 500 }, { kind: 'parking', amountWon: 0 }]); expect(z.recordCount).toBe(2)
  })
  it('경계: 같은 금액이면 종류 정의 순서(주유 먼저)로 안정 정렬', () => {
    const t = monthTotals([r('other', '2026-11-01', 100), r('wash', '2026-11-01', 100), r('fuel', '2026-11-01', 100)], '2026-11')
    expect(t.byKind.map((k) => k.kind)).toEqual(['fuel', 'wash', 'other'])
  })
  it('경계: 같은 종류 여러 건 합산, 큰 금액(2,000건×1억)도 정확', () => {
    const big = Array.from({ length: 2000 }, () => r('maintenance', '2026-11-15', 100_000_000))
    expect(monthTotals(big, '2026-11')).toMatchObject({ totalWon: 200_000_000_000, recordCount: 2000 })
  })
})

describe('AC-09-2 월 경계', () => {
  const rows = [r('fuel', '2026-10-31', 30000), r('fuel', '2026-11-01', 20000)]
  it('10월 30,000, 11월 20,000', () => { expect(monthTotals(rows, '2026-10').totalWon).toBe(30000); expect(monthTotals(rows, '2026-11').totalWon).toBe(20000) })
  it('경계: 11-30·12-01, 연말 12-31·01-01, 윤일 02-29', () => {
    const x = [r('fuel', '2026-11-30', 1), r('fuel', '2026-12-01', 2), r('fuel', '2026-12-31', 4), r('fuel', '2027-01-01', 8), r('fuel', '2028-02-29', 16), r('fuel', '2028-03-01', 32)]
    expect([monthTotals(x, '2026-11').totalWon, monthTotals(x, '2026-12').totalWon, monthTotals(x, '2027-01').totalWon, monthTotals(x, '2028-02').totalWon, monthTotals(x, '2028-03').totalWon]).toEqual([1, 6, 8, 16, 32])
  })
  it('실패 쪽: 다른 해 같은 달은 섞이지 않음(2025-11 vs 2026-11)', () => {
    expect(monthTotals([r('fuel', '2025-11-05', 999), r('fuel', '2026-11-05', 1)], '2026-11').totalWon).toBe(1)
  })
})

describe('AC-09-3 차량 분리', () => {
  it('함수는 넘겨받은 기록만 합산한다(차량 필터는 호출자 몫). 차량 B 기록만 넘기면 5,000', () => {
    const A = [{ ...r('fuel', '2026-11-05', 100000), vehicleId: 'A' }], B = [{ ...r('fuel', '2026-11-05', 5000), vehicleId: 'B' }]
    expect(monthTotals(B, '2026-11').totalWon).toBe(5000); expect(monthTotals(A, '2026-11').totalWon).toBe(100000)
  })
  it('관찰: 두 차량 기록을 섞어 넘기면 함수가 걸러내지 않는다(vehicleId를 보지 않음) → 선택 차량 필터는 MPR-37에서 확인', () => {
    const mixed = [{ ...r('fuel', '2026-11-05', 100000), vehicleId: 'A' }, { ...r('fuel', '2026-11-05', 5000), vehicleId: 'B' }]
    expect(monthTotals(mixed, '2026-11').totalWon).toBe(105000)
  })
})

describe('AC-09-4 빈 달', () => {
  it('기록 없는 달: 총합 0, 종류 0개, 기록 수 0(화면이 "0원"과 "이 달의 기록이 없습니다"를 그릴 근거), 오류 없음', () => {
    expect(monthTotals([r('fuel', '2026-10-05', 1)], '2026-11')).toEqual({ totalWon: 0, byKind: [], recordCount: 0 })
    expect(monthTotals([], '2026-11')).toEqual({ totalWon: 0, byKind: [], recordCount: 0 })
  })
  it('경계: 금액 0짜리 기록만 있는 달은 빈 달이 아님(recordCount 1)', () => {
    expect(monthTotals([r('fuel', '2026-11-05', 0)], '2026-11')).toEqual({ totalWon: 0, byKind: [{ kind: 'fuel', amountWon: 0 }], recordCount: 1 })
  })
  it('실패 쪽: 형식이 다른 달 문자열(`2026-1`, 빈 문자열)은 아무것도 안 잡고 던지지 않음', () => {
    for (const m of ['2026-1', '', '2026-13', 'abc']) expect(monthTotals([r('fuel', '2026-11-05', 1)], m)).toEqual({ totalWon: 0, byKind: [], recordCount: 0 })
  })
})

describe('AC-09-7 최근 12개월 목록', () => {
  const rows = [r('fuel', '2026-11-02', 70000), r('wash', '2026-11-04', 3000), r('fuel', '2026-03-10', 20000)]
  it('오늘 2026-11-05: 2026-11부터 2025-12까지 12개, 기록 있는 달만 값, 나머지 0원', () => {
    const l = recentMonthlyTotals(rows, '2026-11-05')
    expect(l.map((x) => x.month)).toEqual(['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12'])
    expect(l.map((x) => x.amountWon)).toEqual([73000, 0, 0, 0, 0, 0, 0, 0, 20000, 0, 0, 0])
  })
  it('선택한 달과 무관: 함수에 선택한 달이 입력으로 없고, 같은 호출은 항상 같은 결과', () => {
    expect(recentMonthlyTotals.length).toBeLessThanOrEqual(3); expect(recentMonthlyTotals(rows, '2026-11-05')).toEqual(recentMonthlyTotals(rows, '2026-11-05'))
  })
  it('경계: 기록이 하나도 없어도 12개, 모두 0원', () => {
    const l = recentMonthlyTotals([], '2026-11-05'); expect(l).toHaveLength(12); expect(l.every((x) => x.amountWon === 0)).toBe(true)
  })
  it('경계: 12개월 밖 기록(2025-11, 미래 2026-12)은 목록에 안 들어감', () => {
    const l = recentMonthlyTotals([r('fuel', '2025-11-30', 9), r('fuel', '2026-12-01', 9), r('fuel', '2025-12-01', 1)], '2026-11-05')
    expect(l.map((x) => x.month)).not.toContain('2025-11'); expect(l.map((x) => x.month)).not.toContain('2026-12'); expect(l[11]).toEqual({ month: '2025-12', amountWon: 1 })
  })
  it('경계: 말일 오늘(01-31·03-31·05-31·12-31)에도 달이 건너뛰어지지 않음(12개 연속, 중복 없음)', () => {
    for (const today of ['2026-01-31', '2026-03-31', '2026-05-31', '2026-12-31', '2028-03-31', '2026-01-01']) {
      const ms = recentMonthlyTotals([], today).map((x) => x.month)
      expect(new Set(ms).size).toBe(12); expect(ms[0]).toBe(today.slice(0, 7))
      for (let i = 1; i < 12; i++) { const [y, m] = ms[i - 1].split('-').map(Number); expect(ms[i]).toBe(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`) }
    }
  })
  it('months 인자로 개수 조절(기본 12), 0이면 빈 목록', () => {
    expect(recentMonthlyTotals([], '2026-11-05', 3).map((x) => x.month)).toEqual(['2026-11', '2026-10', '2026-09']); expect(recentMonthlyTotals([], '2026-11-05', 0)).toEqual([])
  })
})

describe('AC-09-8 계산 시간 (기록 2,000건, 10회 p95 ≤ 100ms)', () => {
  const kinds = RECORD_KINDS
  const rows = Array.from({ length: 2000 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 1) + (i % 700) * 86400000).toISOString().slice(0, 10)
    const kind = kinds[i % 7]
    return { id: `id${i}`, kind, date: d, amountWon: 1000 + i, odometerKm: 10000 + i * 20, liters: kind === 'fuel' ? 30 : null, fullTank: kind === 'fuel' && i % 3 === 0, createdAt: `2026-01-01T00:00:00.${String(i).padStart(6, '0')}+00:00` }
  })
  it('합계(선택 달) + 최근 12개월 + 연비 구간을 한 번에 계산하는 시간', () => {
    const times: number[] = []
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now()
      monthTotals(rows, '2025-06'); recentMonthlyTotals(rows, '2026-11-05'); economySegments(rows)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    console.log('AC-09-8 ms(정렬):', times.map((x) => x.toFixed(2)).join(', '), '| p95≈max =', times[9].toFixed(2))
    expect(times[9]).toBeLessThanOrEqual(100)
  })
  it('합계 두 함수만 따로 잰 시간도 100ms 이하(10회 최댓값)', () => {
    let max = 0
    for (let i = 0; i < 10; i++) { const t0 = performance.now(); monthTotals(rows, '2025-06'); recentMonthlyTotals(rows, '2026-11-05'); max = Math.max(max, performance.now() - t0) }
    console.log('AC-09-8 합계만 max ms =', max.toFixed(2)); expect(max).toBeLessThanOrEqual(100)
  })
  it('결과가 맞음: 2,000건 합계가 직접 계산과 일치', () => {
    const t = monthTotals(rows, '2025-06'); const expected = rows.filter((x) => x.date.startsWith('2025-06')).reduce((s, x) => s + x.amountWon, 0)
    expect(t.totalWon).toBe(expected)
  })
})
