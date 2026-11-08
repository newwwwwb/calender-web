// 기록 종류 7가지의 화면 이름(기록 탭·기록 양식·통계 탭이 함께 쓴다)
import type { RecordKind } from '../domain/types'

export const KIND_LABEL: Record<RecordKind, string> = { fuel: '주유', maintenance: '정비', wash: '세차', insurance: '보험', tax: '세금', parking: '주차', other: '기타' }
