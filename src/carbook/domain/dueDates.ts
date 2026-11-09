// 자동차세 빠른 선택(F-15)의 "오늘 또는 그 이후에 처음 오는 6월 30일·12월 31일" 날짜를 계산하는 순수 함수
import { today as todayKey } from './dateKey'
import type { DateKey } from './types'

export type CarTaxQuickPick = 'jun30' | 'dec31'
const MONTH_DAY: Record<CarTaxQuickPick, string> = { jun30: '06-30', dec31: '12-31' }

export function nextCarTaxDate(pick: CarTaxQuickPick, today: DateKey = todayKey()): DateKey {
  const year = Number(today.slice(0, 4))
  const thisYear = `${year}-${MONTH_DAY[pick]}`
  return thisYear >= today ? thisYear : `${year + 1}-${MONTH_DAY[pick]}`
}
