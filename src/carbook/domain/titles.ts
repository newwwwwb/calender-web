// 캘린더 연결 일정 제목(BR-20, F-07)을 만드는 순수 함수. 번호판은 받지도 쓰지도 않는다(AC-08-10)
import type { DueKind } from './types'

const DUE_SUFFIX: Record<DueKind, string> = { insurance: '보험 만기', car_tax: '자동차세 납부', inspection: '정기검사 만기' }

export const itemEventTitle = (vehicleName: string, itemName: string) => `[${vehicleName}] ${itemName} 교체 예정`
export const dueEventTitle = (vehicleName: string, kind: DueKind) => `[${vehicleName}] ${DUE_SUFFIX[kind]}`
