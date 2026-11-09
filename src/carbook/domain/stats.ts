// 월별·종류별 지출 합계와 최근 12개월 목록(BR-26)을 계산하는 순수 함수 모음
import { addMonths, today } from './dateKey'
import { RECORD_KINDS, type CarRecord, type DateKey, type RecordKind } from './types'

type StatRecord = Pick<CarRecord, 'kind' | 'date' | 'amountWon'>

export interface MonthTotals { totalWon: number; byKind: { kind: RecordKind; amountWon: number }[]; recordCount: number }

// 'YYYY-MM-DD' -> 'YYYY-MM'
const monthOf = (date: DateKey) => date.slice(0, 7)

// 선택한 달('YYYY-MM')의 총합과 종류별 합계. 기록이 있는 종류만(금액 0도 기록이면 포함), 금액 큰 순
// 기록은 선택 차량의 것만 넘겨야 한다
export function monthTotals(records: StatRecord[], month: string): MonthTotals {
  const sums = new Map<RecordKind, number>()
  let recordCount = 0
  for (const r of records) {
    if (monthOf(r.date) !== month) continue
    sums.set(r.kind, (sums.get(r.kind) ?? 0) + r.amountWon)
    recordCount++
  }
  const byKind = RECORD_KINDS.filter((k) => sums.has(k))
    .map((kind) => ({ kind, amountWon: sums.get(kind) as number }))
    .sort((a, b) => b.amountWon - a.amountWon) // 같은 금액이면 RECORD_KINDS 순서 유지(안정 정렬)
  return { totalWon: byKind.reduce((s, k) => s + k.amountWon, 0), byKind, recordCount }
}

// 오늘이 속한 달부터 거슬러 올라간 months개 달의 합계. 최근 달이 앞, 기록이 없는 달은 0원
export function recentMonthlyTotals(records: StatRecord[], todayKey: DateKey = today(), months = 12): { month: string; amountWon: number }[] {
  const sums = new Map<string, number>()
  for (const r of records) {
    const m = monthOf(r.date)
    sums.set(m, (sums.get(m) ?? 0) + r.amountWon)
  }
  const first = `${monthOf(todayKey)}-01`
  return Array.from({ length: months }, (_, i) => {
    const month = monthOf(addMonths(first, -i))
    return { month, amountWon: sums.get(month) ?? 0 }
  })
}
