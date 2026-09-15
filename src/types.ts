// 캘린더 도메인 데이터 모델: 카테고리, 반복 규칙, 일정
export type ID = string

export interface Category {
  id: ID
  name: string
  color: string // hex, 예: '#0066ff'
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  interval: number // N번마다 반복 (기본 1)
  byWeekday?: number[] // freq === 'weekly'일 때만: 0=일 ~ 6=토
  until?: string // YYYY-MM-DD, 이 날짜까지 반복(포함)
  count?: number // 총 반복 횟수 (until과 동시 사용 안 함)
}

export interface CalendarEvent {
  id: ID
  title: string
  memo?: string
  categoryId?: ID
  allDay: boolean
  start: string // allDay: 'YYYY-MM-DD', 아니면 'YYYY-MM-DDTHH:mm'
  end: string // start와 같은 형식
  recurrence?: RecurrenceRule
  // '이 일정만' 수정/삭제로 반복 계열에서 제외된 회차의 원래 시작일(YYYY-MM-DD) 목록
  excludedDates?: string[]
}

// 반복 규칙을 특정 기간에 맞춰 펼친 한 회차 (저장되지 않는 파생 데이터)
export interface EventInstance {
  event: CalendarEvent
  start: string
  end: string
  instanceDate: string // 이 회차의 원래 시작일(YYYY-MM-DD), 반복 편집 범위 지정에 사용
}
