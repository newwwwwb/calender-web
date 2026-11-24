// 추천 항목·다음 교체일·상태·정렬·일정 기준·미입력·추천 되돌리기 계획의 숫자 예시 테스트(AC-06-1~8·12·13·15·16, AC-20-1·3·8, AC-24-1, AC-26-1·2, 오늘 2026-11-05)
import { describe, expect, it } from 'vitest'
import type { MaintenanceItem } from './types'
import { buildRecommendedItems, evaluateItem, planRecommendedReset, sortItems } from './maintenance'

const TODAY = '2026-11-05'
type Item = Pick<MaintenanceItem, 'intervalKm' | 'intervalMonths' | 'lastDate' | 'lastOdometerKm'>
const base: Item = { intervalKm: null, intervalMonths: null, lastDate: TODAY, lastOdometerKm: null }
const ev = (item: Partial<Item>, currentKm = 0, avgKmPerDay: number | null = null, today = TODAY) =>
  evaluateItem({ ...base, ...item }, { today, currentKm, avgKmPerDay })

describe('buildRecommendedItems', () => {
  it('추천 7개를 BR-06 순서·값으로 만든다(AC-06-1)', () => {
    const items = buildRecommendedItems()
    expect(items.map((i) => [i.name, i.intervalKm, i.intervalMonths])).toEqual([
      ['엔진오일', 10000, 12], ['에어컨 필터', 10000, 6], ['에어 필터', 20000, 12], ['타이어 위치 교환', 10000, null],
      ['브레이크 패드 점검', 20000, null], ['와이퍼', null, 12], ['배터리 점검', null, 36],
    ])
  })

  it('마지막 교체일·마지막 교체 주행거리는 모두 미입력 null이다(BR-51, AC-24-1)', () => {
    const items = buildRecommendedItems()
    expect(items).toHaveLength(7)
    expect(items.every((i) => i.lastDate === null && i.lastOdometerKm === null)).toBe(true)
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
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 42000, null)).toEqual({ nextDate: null, remainingKm: 8000, status: 'ok', basis: null })
  })

  it('마지막 교체 주행거리가 비면 km 쪽은 계산하지 않는다(AC-06-13)', () => {
    expect(ev({ intervalKm: 10000 }, 0, 33)).toEqual({ nextDate: null, remainingKm: null, status: 'ok', basis: null })
    expect(ev({ intervalKm: 10000, intervalMonths: 12 }, 0, 33).nextDate).toBe('2027-11-05')
  })

  it('첫 기록으로 채워지면 남은 거리 10,000km에 배지가 없다(AC-06-15)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 48000 }, 48000)).toMatchObject({ remainingKm: 10000, status: 'ok' })
  })

  it('남은 거리가 0 이하면 km 날짜는 오늘이다', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50000, 10)).toMatchObject({ nextDate: TODAY, status: 'soon' })
  })
})

describe('evaluateItem 일정 기준(BR-55)', () => {
  it('km 날짜가 개월 날짜보다 이르거나 개월 날짜가 없으면 km 기준이다(AC-26-1)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48000, 1000 / 30)).toMatchObject({ nextDate: '2027-01-04', basis: 'km' })
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 24 }, 48000, 1000 / 30).basis).toBe('km')
  })

  it('개월 날짜가 더 이르면 개월 기준이다(AC-26-2)', () => {
    const r = ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 3, lastDate: '2026-10-01' }, 48000, 1000 / 30)
    expect(r).toMatchObject({ nextDate: '2027-01-01', basis: 'months' })
  })

  it('두 날짜가 같은 날이면 개월 기준이다', () => {
    const r = ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 3, lastDate: '2026-10-04' }, 48000, 1000 / 30)
    expect(r).toMatchObject({ nextDate: '2027-01-04', basis: 'months' })
  })

  it('개월 주기만 있으면 개월 기준, 날짜가 없으면 기준도 없다', () => {
    expect(ev({ intervalMonths: 12 }).basis).toBe('months')
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 42000, null)).toMatchObject({ nextDate: null, basis: null })
    expect(ev({})).toMatchObject({ nextDate: null, basis: null })
  })

  it('추천으로 되돌린 뒤 다음 교체일이 2027-01-20(km 기준)으로 바뀐다(AC-20-3)', () => {
    const before = ev({ intervalKm: 15000, intervalMonths: 6, lastDate: '2026-05-01', lastOdometerKm: 40000 }, 48000, 1000 / 30, '2026-11-21')
    expect(before).toMatchObject({ nextDate: '2026-11-01', status: 'overdue' })
    const after = ev({ intervalKm: 10000, intervalMonths: 12, lastDate: '2026-05-01', lastOdometerKm: 40000 }, 48000, 1000 / 30, '2026-11-21')
    expect(after).toMatchObject({ nextDate: '2027-01-20', status: 'ok', basis: 'km' })
  })
})

describe('evaluateItem 미입력(BR-52, AC-24-1)', () => {
  it('마지막 교체일이 없으면 주기와 주행거리가 있어도 계산·배지가 없다', () => {
    const unset = { intervalKm: 10000, intervalMonths: 12, lastDate: null, lastOdometerKm: 40000 }
    expect(ev(unset, 48000, 1000 / 30)).toEqual({ nextDate: null, remainingKm: null, status: 'unset', basis: null })
  })

  it('날짜를 입력하면 바로 일반 항목이다', () => {
    expect(ev({ intervalMonths: 12, lastDate: TODAY }).status).toBe('ok')
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
    expect(ev({})).toEqual({ nextDate: null, remainingKm: null, status: 'ok', basis: null })
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

  it('미입력은 날짜 없는 정상 항목보다도 뒤로 간다', () => {
    const list = [{ id: 'unset', status: 'unset', nextDate: null }, { id: 'none', status: 'ok', nextDate: null }, { id: 'ok', status: 'ok', nextDate: '2027-03-01' }] as const
    expect(sortItems([...list]).map((i) => i.id)).toEqual(['ok', 'none', 'unset'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const list = [{ status: 'ok' as const, nextDate: null }, { status: 'overdue' as const, nextDate: null }]
    sortItems(list)
    expect(list[0].status).toBe('ok')
  })
})

describe('planRecommendedReset', () => {
  let n = 0
  const mk = (name: string, intervalKm: number | null, intervalMonths: number | null, vehicleId = 'v1'): MaintenanceItem =>
    ({ id: `i${++n}`, vehicleId, name, intervalKm, intervalMonths, lastDate: '2026-08-01', lastOdometerKm: 44000, eventId: null, createdAt: 'a' })

  it('AC-20-1: 바뀌는 3개를 추천 순서로, 같은 주기·직접 추가 항목은 뺀다', () => {
    const items = [
      mk('겨울 타이어', 5000, null), mk('타이어 위치 교환', 10000, 6), mk('배터리 점검', null, 36), mk('에어컨 필터', 5000, null),
      mk('브레이크 패드 점검', 20000, null), mk('엔진오일', 15000, 6), mk('에어 필터', 20000, 12),
    ]
    const plan = planRecommendedReset(items, 'v1')
    expect(plan.changes.map((c) => [c.name, c.from, c.to])).toEqual([
      ['엔진오일', { intervalKm: 15000, intervalMonths: 6 }, { intervalKm: 10000, intervalMonths: 12 }],
      ['에어컨 필터', { intervalKm: 5000, intervalMonths: null }, { intervalKm: 10000, intervalMonths: 6 }],
      ['타이어 위치 교환', { intervalKm: 10000, intervalMonths: 6 }, { intervalKm: 10000, intervalMonths: null }],
    ])
    expect(plan.changes.map((c) => c.itemId)).toEqual([items[5].id, items[3].id, items[1].id])
  })

  it('AC-20-8: 이름이 같은 항목은 모두 대상이고 이름을 바꾼 항목은 아니다', () => {
    const a = mk('엔진오일', 15000, 6), b = mk('엔진오일', 20000, null), c = mk('오일 교환', 15000, 6)
    const plan = planRecommendedReset([a, b, c], 'v1')
    expect(plan.changes.map((x) => x.itemId)).toEqual([a.id, b.id])
    expect(plan.changes.every((x) => x.to.intervalKm === 10000 && x.to.intervalMonths === 12)).toBe(true)
  })

  it('이름 앞뒤 공백은 무시하고 대상이 되지만 저장된 이름은 그대로 돌려준다', () => {
    const plan = planRecommendedReset([mk(' 엔진오일 ', 5000, null)], 'v1')
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0].name).toBe(' 엔진오일 ')
  })

  it('다른 차량의 항목과 이미 추천 주기인 항목만 있으면 변경이 없다(MSG-24)', () => {
    expect(planRecommendedReset([mk('엔진오일', 15000, 6, 'v2'), mk('엔진오일', 10000, 12)], 'v1').changes).toEqual([])
    expect(planRecommendedReset([], 'v1').changes).toEqual([])
  })

  it('원본 항목을 바꾸지 않는다', () => {
    const items = [mk('엔진오일', 15000, 6)]
    planRecommendedReset(items, 'v1')
    expect(items[0]).toMatchObject({ intervalKm: 15000, intervalMonths: 6 })
  })
})
