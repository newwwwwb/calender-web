// 추천 항목·다음 교체일·상태·정렬의 AC-06-1~8, 12, 13, 15, 16 숫자 예시 테스트(오늘 2026-11-05)
import { describe, expect, it } from 'vitest'
import type { MaintenanceItem } from './types'
import { buildRecommendedItems, evaluateItem, sortItems } from './maintenance'

const TODAY = '2026-11-05'
type Item = Pick<MaintenanceItem, 'intervalKm' | 'intervalMonths' | 'lastDate' | 'lastOdometerKm'>
const base: Item = { intervalKm: null, intervalMonths: null, lastDate: TODAY, lastOdometerKm: null }
const ev = (item: Partial<Item>, currentKm = 0, avgKmPerDay: number | null = null) =>
  evaluateItem({ ...base, ...item }, { today: TODAY, currentKm, avgKmPerDay })

describe('buildRecommendedItems', () => {
  it('추천 7개를 BR-06 순서·값으로 만든다(AC-06-1)', () => {
    const items = buildRecommendedItems(null, TODAY)
    expect(items.map((i) => [i.name, i.intervalKm, i.intervalMonths])).toEqual([
      ['엔진오일', 10000, 12], ['에어컨 필터', 10000, 6], ['에어 필터', 20000, 12], ['타이어 위치 교환', 10000, null],
      ['브레이크 패드 점검', 20000, null], ['와이퍼', null, 12], ['배터리 점검', null, 36],
    ])
    expect(items.every((i) => i.lastDate === TODAY)).toBe(true)
  })

  it('마지막 교체 주행거리는 차량 주행거리, 없으면 null(AC-06-13)', () => {
    expect(buildRecommendedItems(48000, TODAY).every((i) => i.lastOdometerKm === 48000)).toBe(true)
    expect(buildRecommendedItems(null, TODAY).every((i) => i.lastOdometerKm === null)).toBe(true)
  })
})

describe('evaluateItem 다음 교체일', () => {
  it('개월 주기를 바꾸면 다시 계산한다(AC-06-2)', () => {
    expect(ev({ intervalMonths: 12 }).nextDate).toBe('2027-11-05')
    expect(ev({ intervalMonths: 6 }).nextDate).toBe('2027-05-05')
  })

  it('말일을 보정한다(AC-06-12)', () => {
    expect(ev({ intervalMonths: 1, lastDate: '2026-01-31' }).nextDate).toBe('2026-02-28')
  })

  it('km 주기: 남은 2,000km ÷ (1,000÷30) = 60일 뒤(AC-06-3)', () => {
    const r = ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48000, 1000 / 30)
    expect(r).toMatchObject({ nextDate: '2027-01-04', remainingKm: 2000, status: 'ok' })
  })

  it('둘 다 있으면 이른 날(AC-06-4)', () => {
    const r = ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 3, lastDate: '2026-10-01' }, 48000, 1000 / 30)
    expect(r.nextDate).toBe('2027-01-01')
  })

  it('평균이 없으면 날짜 없이 남은 거리만 있다(AC-06-5)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 42000, null)).toEqual({ nextDate: null, remainingKm: 8000, status: 'ok' })
  })

  it('마지막 교체 주행거리가 비면 km 쪽은 계산하지 않는다(AC-06-13)', () => {
    expect(ev({ intervalKm: 10000 }, 0, 33)).toEqual({ nextDate: null, remainingKm: null, status: 'ok' })
    expect(ev({ intervalKm: 10000, intervalMonths: 12 }, 0, 33).nextDate).toBe('2027-11-05')
  })

  it('첫 기록으로 채워지면 남은 거리 10,000km에 배지가 없다(AC-06-15)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 48000 }, 48000)).toMatchObject({ remainingKm: 10000, status: 'ok' })
  })

  it('남은 거리가 0 이하면 km 날짜는 오늘이다', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50000, 10)).toMatchObject({ nextDate: TODAY, status: 'soon' })
  })
})

describe('evaluateItem 상태', () => {
  it('다음 교체일이 오늘+30일이면 곧 교체, +31일이면 정상(AC-06-6)', () => {
    expect(ev({ intervalMonths: 12, lastDate: '2025-12-05' })).toMatchObject({ nextDate: '2026-12-05', status: 'soon' })
    expect(ev({ intervalMonths: 12, lastDate: '2025-12-06' })).toMatchObject({ nextDate: '2026-12-06', status: 'ok' })
  })

  it('남은 거리 1,000km면 곧 교체, 1,001km면 정상(AC-06-7)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 49000).status).toBe('soon')
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48999).status).toBe('ok')
  })

  it('다음 교체일이 어제거나 남은 거리가 -1이면 지남(AC-06-8)', () => {
    expect(ev({ intervalMonths: 12, lastDate: '2025-11-04' })).toMatchObject({ nextDate: '2026-11-04', status: 'overdue' })
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50001)).toMatchObject({ remainingKm: -1, status: 'overdue' })
  })

  it('다음 교체일이 오늘이면 지남이 아니다', () => {
    expect(ev({ intervalMonths: 12, lastDate: '2025-11-05' }).status).toBe('soon')
  })

  it('날짜도 남은 거리도 없으면 정상이다', () => {
    expect(ev({})).toEqual({ nextDate: null, remainingKm: null, status: 'ok' })
  })
})

describe('sortItems', () => {
  it('지남 → 곧 교체 → 정상, 날짜 오름차순, 날짜 없음 맨 뒤(AC-06-16)', () => {
    const list = [
      { id: 'ok', status: 'ok', nextDate: '2027-03-01' }, { id: 'soon20', status: 'soon', nextDate: '2026-11-20' },
      { id: 'over', status: 'overdue', nextDate: '2026-10-01' }, { id: 'soon10', status: 'soon', nextDate: '2026-11-10' },
      { id: 'none', status: 'ok', nextDate: null },
    ] as const
    const sorted = sortItems([...list])
    expect(sorted.map((i) => i.id)).toEqual(['over', 'soon10', 'soon20', 'ok', 'none'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const list = [{ status: 'ok' as const, nextDate: null }, { status: 'overdue' as const, nextDate: null }]
    sortItems(list)
    expect(list[0].status).toBe('ok')
  })
})
