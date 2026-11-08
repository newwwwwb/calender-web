// 만기일 종류의 화면 이름(F-07 행 이름·양식의 종류 표시·삭제 확인 대상에 같이 쓴다)
import type { DueKind } from '../domain/types'

export const DUE_LABEL: Record<DueKind, string> = { insurance: '보험 만기', car_tax: '자동차세 납부', inspection: '정기검사' }
