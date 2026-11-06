// 현재 주행거리(BR-07), 주행거리 감소 판정(BR-08), 하루 평균 주행거리(BR-12)를 계산하는 순수 함수 모음
import { addDays, diffDays, today } from './dateKey'
import type { CarRecord, DateKey } from './types'

type OdometerRecord = Pick<CarRecord, 'id' | 'date' | 'odometerKm'>

// BR-07: max(차량 주행거리, 기록의 주행거리 최댓값). 값이 없으면 0. excludeRecordId는 수정 중인 기록 자신을 뺄 때 쓴다(BR-08)
export function currentOdometerKm(vehicleKm: number | null, records: OdometerRecord[], excludeRecordId?: string): number {
  let max = vehicleKm ?? 0
  for (const r of records) {
    if (r.id !== excludeRecordId && r.odometerKm !== null && r.odometerKm > max) max = r.odometerKm
  }
  return max
}

// BR-08: 새 주행거리가 현재 주행거리보다 작으면 저장 전에 MSG-10을 보인다(저장을 막지는 않는다). 빈 값은 해당 없음
export function isOdometerDecrease(newKm: number | null, currentKm: number): boolean {
  return newKm !== null && newKm < currentKm
}

// BR-12: 오늘−90일~오늘(양 끝 포함)의 주행거리 기록 중 첫 기록과 마지막 기록의 차이 ÷ 날짜 차이(일).
// 기록 2건 미만, 날짜 차이 0일, 주행거리 차이 0 이하면 null(= 주행거리 기록 부족)
export function dailyAverageKm(records: OdometerRecord[], todayKey: DateKey = today()): number | null {
  const from = addDays(todayKey, -90)
  const inRange = records
    .filter((r): r is OdometerRecord & { odometerKm: number } => r.odometerKm !== null && r.date >= from && r.date <= todayKey)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.odometerKm - b.odometerKm))
  if (inRange.length < 2) return null
  const first = inRange[0]
  const last = inRange[inRange.length - 1]
  const days = diffDays(last.date, first.date)
  const km = last.odometerKm - first.odometerKm
  return days === 0 || km <= 0 ? null : km / days
}
