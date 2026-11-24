// 교체 항목의 추천 7개(BR-06), 다음 교체일·남은 거리·상태(BR-13·14), 목록 정렬(AC-06-16)을 계산하는 순수 함수 모음
import { addDays, addMonths } from './dateKey'
import type { DateKey, ItemStatus, MaintenanceItem, RecommendedItem, ResetPlan } from './types'

export const SOON_DAYS = 30
export const SOON_KM = 1000

// BR-06: 새 차량마다 만드는 추천 항목 7개. 이 순서가 목록 순서다
export const RECOMMENDED_ITEMS: ReadonlyArray<Pick<RecommendedItem, 'name' | 'intervalKm' | 'intervalMonths'>> = [
  { name: '엔진오일', intervalKm: 10000, intervalMonths: 12 },
  { name: '에어컨 필터', intervalKm: 10000, intervalMonths: 6 },
  { name: '에어 필터', intervalKm: 20000, intervalMonths: 12 },
  { name: '타이어 위치 교환', intervalKm: 10000, intervalMonths: null },
  { name: '브레이크 패드 점검', intervalKm: 20000, intervalMonths: null },
  { name: '와이퍼', intervalKm: null, intervalMonths: 12 },
  { name: '배터리 점검', intervalKm: null, intervalMonths: 36 },
]

// BR-51: 새 차량의 추천 항목은 마지막 교체일·마지막 교체 주행거리를 미입력(null)으로 둔다
export function buildRecommendedItems(): RecommendedItem[] {
  return RECOMMENDED_ITEMS.map((r) => ({ ...r, lastDate: null, lastOdometerKm: null }))
}

export interface ItemEvaluation { nextDate: DateKey | null; remainingKm: number | null; status: ItemStatus; basis: 'km' | 'months' | null }
type Evaluable = Pick<MaintenanceItem, 'intervalKm' | 'intervalMonths' | 'lastDate' | 'lastOdometerKm'>

// BR-13·14·55. avgKmPerDay는 BR-12 결과(없으면 null). nextDate가 null이면 화면이 MSG-18을 보인다. 마지막 교체일이 없으면(BR-52) 계산하지 않는다
export function evaluateItem(item: Evaluable, ctx: { today: DateKey; currentKm: number; avgKmPerDay: number | null }): ItemEvaluation {
  const { today, currentKm, avgKmPerDay } = ctx
  if (item.lastDate === null) return { nextDate: null, remainingKm: null, status: 'unset', basis: null }
  const monthDate = item.intervalMonths !== null ? addMonths(item.lastDate, item.intervalMonths) : null
  const remainingKm = item.intervalKm !== null && item.lastOdometerKm !== null ? item.lastOdometerKm + item.intervalKm - currentKm : null
  let kmDate: DateKey | null = null
  if (remainingKm !== null && avgKmPerDay !== null) {
    // 부동소수점 오차(60.00000000000001)로 하루가 늘지 않게 아주 작은 값을 뺀다
    kmDate = remainingKm > 0 ? addDays(today, Math.ceil(remainingKm / avgKmPerDay - 1e-9)) : today
  }
  const nextDate = monthDate !== null && kmDate !== null ? (monthDate < kmDate ? monthDate : kmDate) : (monthDate ?? kmDate)
  // BR-55: km 날짜가 개월 날짜보다 이르거나 개월 날짜가 없을 때만 km 기준(같은 날이면 개월)
  const basis = nextDate === null ? null : kmDate !== null && nextDate === kmDate && (monthDate === null || kmDate < monthDate) ? 'km' : 'months'

  let status: ItemStatus = 'ok'
  if ((nextDate !== null && nextDate < today) || (remainingKm !== null && remainingKm < 0)) status = 'overdue'
  else if ((nextDate !== null && nextDate <= addDays(today, SOON_DAYS)) || (remainingKm !== null && remainingKm <= SOON_KM)) status = 'soon'
  return { nextDate, remainingKm, status, basis }
}

const RANK: Record<ItemStatus, number> = { overdue: 0, soon: 1, ok: 2, unset: 3 }

// AC-06-16: 지남 → 곧 교체 → 정상 → 미입력(UA-8), 같은 상태는 다음 교체일 오름차순, 날짜 없음은 맨 뒤. 원본 배열은 바꾸지 않는다
export function sortItems<T extends { status: ItemStatus; nextDate: DateKey | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return RANK[a.status] - RANK[b.status]
    if (a.nextDate === b.nextDate) return 0
    if (a.nextDate === null) return 1
    if (b.nextDate === null) return -1
    return a.nextDate < b.nextDate ? -1 : 1
  })
}

// BR-44~47: 선택 차량에서 이름(앞뒤 공백 제외)이 추천 7개와 같고 주기가 다른 항목을 추천 순서로 모은다. 추천 값에 없는 쪽 주기는 null이다
export function planRecommendedReset(items: MaintenanceItem[], vehicleId: string): ResetPlan {
  const changes: ResetPlan['changes'] = []
  for (const rec of RECOMMENDED_ITEMS) {
    for (const i of items) {
      if (i.vehicleId !== vehicleId || i.name.trim() !== rec.name) continue
      if (i.intervalKm === rec.intervalKm && i.intervalMonths === rec.intervalMonths) continue
      changes.push({
        itemId: i.id, name: i.name,
        from: { intervalKm: i.intervalKm, intervalMonths: i.intervalMonths },
        to: { intervalKm: rec.intervalKm, intervalMonths: rec.intervalMonths },
      })
    }
  }
  return { changes }
}
