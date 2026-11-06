// 통계 합계(BR-26)의 AC-09-1~4·AC-09-7·AC-09-8 테스트
import { describe, expect, it } from 'vitest'
import { monthTotals, recentMonthlyTotals } from './stats'
import type { RecordKind } from './types'

const r = (kind: RecordKind, date: string, amountWon: number) => ({ kind, date, amountWon })

describe('monthTotals', () => {
  it('총합과 종류별 합계를 큰 순으로 돌려준다(AC-09-1)', () => {
    const recs = [r('fuel', '2026-11-01', 50000), r('fuel', '2026-11-03', 40000), r('wash', '2026-11-05', 10000), r('insurance', '2026-11-10', 100000)]
    const t = monthTotals(recs, '2026-11')
    expect(t.totalWon).toBe(200000)
    expect(t.byKind).toEqual([
      { kind: 'insurance', amountWon: 100000 },
      { kind: 'fuel', amountWon: 90000 },
      { kind: 'wash', amountWon: 10000 },
    ])
    expect(t.byKind.reduce((s, k) => s + k.amountWon, 0)).toBe(t.totalWon)
  })

  it('월 경계: 10월 31일은 10월, 11월 1일은 11월(AC-09-2)', () => {
    const recs = [r('other', '2026-10-31', 30000), r('other', '2026-11-01', 20000)]
    expect(monthTotals(recs, '2026-10').totalWon).toBe(30000)
    expect(monthTotals(recs, '2026-11').totalWon).toBe(20000)
  })

  it('기록이 없는 달은 0원과 기록 0건이다(AC-09-4)', () => {
    expect(monthTotals([r('fuel', '2026-11-01', 1000)], '2026-09')).toEqual({ totalWon: 0, byKind: [], recordCount: 0 })
    expect(monthTotals([], '2026-11').recordCount).toBe(0)
  })

  it('금액 0원 기록도 그 종류를 보이고 건수에 센다', () => {
    const t = monthTotals([r('parking', '2026-11-01', 0)], '2026-11')
    expect(t).toEqual({ totalWon: 0, byKind: [{ kind: 'parking', amountWon: 0 }], recordCount: 1 })
  })
})

describe('recentMonthlyTotals', () => {
  it('오늘이 속한 달부터 12개 달, 기록 없는 달은 0원(AC-09-7)', () => {
    const list = recentMonthlyTotals([r('fuel', '2026-11-02', 5000), r('fuel', '2026-03-09', 7000)], '2026-11-05')
    expect(list).toHaveLength(12)
    expect(list[0]).toEqual({ month: '2026-11', amountWon: 5000 })
    expect(list[11].month).toBe('2025-12')
    expect(list.find((m) => m.month === '2026-03')?.amountWon).toBe(7000)
    expect(list.find((m) => m.month === '2026-04')?.amountWon).toBe(0)
  })

  it('12개월보다 오래된 기록과 미래 달 기록은 목록에 들어가지 않는다', () => {
    const list = recentMonthlyTotals([r('fuel', '2025-11-30', 1), r('fuel', '2026-12-01', 2)], '2026-11-05')
    expect(list.every((m) => m.amountWon === 0)).toBe(true)
  })

  it('1월에서도 연도를 넘겨 거슬러 올라간다', () => {
    const list = recentMonthlyTotals([], '2026-01-31')
    expect([list[0].month, list[1].month, list[11].month]).toEqual(['2026-01', '2025-12', '2025-02'])
  })
})

describe('성능', () => {
  it('2,000건 계산이 100ms 이하다(AC-09-8)', () => {
    const kinds: RecordKind[] = ['fuel', 'maintenance', 'wash', 'insurance', 'tax', 'parking', 'other']
    const recs = Array.from({ length: 2000 }, (_, i) => r(kinds[i % 7], `2026-${String((i % 12) + 1).padStart(2, '0')}-15`, 1000 + i))
    const start = performance.now()
    monthTotals(recs, '2026-11')
    recentMonthlyTotals(recs, '2026-11-05')
    expect(performance.now() - start).toBeLessThan(100)
  })
})
