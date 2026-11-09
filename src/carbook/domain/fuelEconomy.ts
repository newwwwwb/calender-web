// 가득 주유 기록 사이의 구간 연비(km/L, BR-11)를 계산하는 순수 함수
import type { CarRecord, EconomySegment } from './types'

type FuelRecord = Pick<CarRecord, 'id' | 'kind' | 'date' | 'odometerKm' | 'liters' | 'fullTank' | 'createdAt'>

// 날짜 오름차순, 같은 날은 주행거리 오름차순(없으면 뒤), 그다음 먼저 만든 순
function compareFuel(a: FuelRecord, b: FuelRecord): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.odometerKm !== b.odometerKm) {
    if (a.odometerKm === null) return 1
    if (b.odometerKm === null) return -1
    return a.odometerKm - b.odometerKm
  }
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
}

// 가득 주유 기록을 이웃끼리 짝지어 (B 주행거리 − A 주행거리) ÷ (A 다음 주유 기록부터 B까지의 주유량 합)을 구한다.
// 주행거리·주유량이 비었거나 주행거리 차이 ≤ 0이거나 주유량 합 ≤ 0인 구간은 뺀다. 결과는 구간 끝 날짜 오름차순
export function economySegments(records: FuelRecord[]): EconomySegment[] {
  const fuel = records.filter((r) => r.kind === 'fuel').sort(compareFuel)
  const fullIdx = fuel.flatMap((r, i) => (r.fullTank ? [i] : []))
  const segments: EconomySegment[] = []
  for (let k = 1; k < fullIdx.length; k++) {
    const a = fuel[fullIdx[k - 1]]
    const b = fuel[fullIdx[k]]
    if (a.odometerKm === null || b.odometerKm === null) continue
    let liters = 0
    let missing = false
    for (let i = fullIdx[k - 1] + 1; i <= fullIdx[k]; i++) {
      const l = fuel[i].liters
      if (l === null) missing = true
      else liters += l
    }
    const km = b.odometerKm - a.odometerKm
    if (missing || km <= 0 || liters <= 0) continue
    segments.push({ endRecordId: b.id, endDate: b.date, kmPerL: km / liters })
  }
  return segments
}
