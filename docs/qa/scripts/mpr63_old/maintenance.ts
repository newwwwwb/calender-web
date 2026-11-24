// 교체 항목의 추천 7개(BR-06), 다음 교체일·남은 거리·상태(BR-13·14), 목록 정렬(AC-06-16)을 계산하는 순수 함수 모음
import { addDays, addMonths, today as todayKey } from './dateKey'
import type { DateKey, ItemInput, ItemStatus, MaintenanceItem } from './types'

export const SOON_DAYS = 30
export const SOON_KM = 1000

// BR-06: 새 차량마다 만드는 추천 항목 7개. 이 순서가 목록 순서다
export const RECOMMENDED_ITEMS: ReadonlyArray<Pick<ItemInput, 'name' | 'intervalKm' | 'intervalMonths'>> = [
  { name: '엔진오일', intervalKm: 10000, intervalMonths: 12 },
  { name: '에어컨 필터', intervalKm: 10000, intervalMonths: 6 },
  { name: '에어 필터', intervalKm: 20000, intervalMonths: 12 },
  { name: '타이어 위치 교환', intervalKm: 10000, intervalMonths: null },
  { name: '브레이크 패드 점검', intervalKm: 20000, intervalMonths: null },
  { name: '와이퍼', intervalKm: null, intervalMonths: 12 },
  { name: '배터리 점검', intervalKm: null, intervalMonths: 36 },
]

// 마지막 교체일은 등록일(오늘), 마지막 교체 주행거리는 차량 주행거리(없으면 null, BR-06·BR-06a)
export function buildRecommendedItems(vehicleOdometerKm: number | null, today: DateKey = todayKey()): ItemInput[] {
  return RECOMMENDED_ITEMS.map((r) => ({ ...r, lastDate: today, lastOdometerKm: vehicleOdometerKm }))
}

export interface ItemEvaluation { nextDate: DateKey | null; remainingKm: number | null; status: ItemStatus }
type Evaluable = Pick<MaintenanceItem, 'intervalKm' | 'intervalMonths' | 'lastDate' | 'lastOdometerKm'>

// BR-13·14. avgKmPerDay는 BR-12 결과(없으면 null). nextDate가 null이면 화면이 MSG-18을 보인다
export function evaluateItem(item: Evaluable, ctx: { today: DateKey; currentKm: number; avgKmPerDay: number | null }): ItemEvaluation {
  const { today, currentKm, avgKmPerDay } = ctx
  const monthDate = item.intervalMonths !== null ? addMonths(item.lastDate, item.intervalMonths) : null
  const remainingKm = item.intervalKm !== null && item.lastOdometerKm !== null ? item.lastOdometerKm + item.intervalKm - currentKm : null
  let kmDate: DateKey | null = null
  if (remainingKm !== null && avgKmPerDay !== null) {
    // 부동소수점 오차(60.00000000000001)로 하루가 늘지 않게 아주 작은 값을 뺀다
    kmDate = remainingKm > 0 ? addDays(today, Math.ceil(remainingKm / avgKmPerDay - 1e-9)) : today
  }
  const nextDate = monthDate !== null && kmDate !== null ? (monthDate < kmDate ? monthDate : kmDate) : (monthDate ?? kmDate)

  let status: ItemStatus = 'ok'
  if ((nextDate !== null && nextDate < today) || (remainingKm !== null && remainingKm < 0)) status = 'overdue'
  else if ((nextDate !== null && nextDate <= addDays(today, SOON_DAYS)) || (remainingKm !== null && remainingKm <= SOON_KM)) status = 'soon'
  return { nextDate, remainingKm, status }
}

const RANK: Record<ItemStatus, number> = { overdue: 0, soon: 1, ok: 2 }

// AC-06-16: 지남 → 곧 교체 → 정상, 같은 상태는 다음 교체일 오름차순, 날짜 없음은 맨 뒤. 원본 배열은 바꾸지 않는다
export function sortItems<T extends { status: ItemStatus; nextDate: DateKey | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return RANK[a.status] - RANK[b.status]
    if (a.nextDate === b.nextDate) return 0
    if (a.nextDate === null) return 1
    if (b.nextDate === null) return -1
    return a.nextDate < b.nextDate ? -1 : 1
  })
}
