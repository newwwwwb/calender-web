// 캘린더 도메인 데이터 모델: 카테고리, 반복 규칙, 일정
export type ID = string

export interface Category {
  id: ID
  name: string
  color: string // hex, 예: '#0066ff'
  ownerId?: ID // Supabase 모드에서만 채워짐. 없으면(로컬 모드) 내 데이터
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  interval: number // N번마다 반복 (기본 1)
  byWeekday?: number[] // freq === 'weekly'일 때만: 0=일 ~ 6=토
  until?: string // YYYY-MM-DD, 이 날짜까지 반복(포함)
  count?: number // 총 반복 횟수 (until과 동시 사용 안 함)
}

// 19단계(함께 일정): 일정에 초대된 참여자 한 명의 수락 상태
export type ParticipantStatus = 'pending' | 'accepted' | 'declined'

export interface Participant {
  userId: ID
  email: string
  status: ParticipantStatus
}

export interface CalendarEvent {
  id: ID
  title: string
  memo?: string
  categoryId?: ID
  color?: string // hex. 지정하지 않으면 카테고리 색, 그마저 없으면 기본 회색을 쓴다
  allDay: boolean
  start: string // allDay: 'YYYY-MM-DD', 아니면 'YYYY-MM-DDTHH:mm'
  end: string // start와 같은 형식
  recurrence?: RecurrenceRule
  // '이 일정만' 수정/삭제로 반복 계열에서 제외된 회차의 원래 시작일(YYYY-MM-DD) 목록
  excludedDates?: string[]
  ownerId?: ID // Supabase 모드에서만 채워짐. 없으면(로컬 모드) 내 데이터
  participants?: Participant[] // Supabase 모드에서 함께 일정일 때만 채워짐
}

// 공유 링크 자체(누가 만들었는지). 링크 id를 초대 URL의 토큰으로 쓴다.
export interface ShareLink {
  id: ID
  ownerId: ID
  ownerEmail: string
  createdAt: string
}

// 공유 링크를 수락한 사람 (소유자가 멤버 목록/취소를 관리할 때 사용)
export interface ShareMember {
  id: ID
  shareId: ID
  viewerId: ID
  viewerEmail: string
  createdAt: string
}

// 나에게 공유된 캘린더 (누가 나에게 공유했는지, 뷰어 쪽에서 사용)
export interface SharedCalendar {
  ownerId: ID
  ownerEmail: string
}

// 할 일: 시간이 고정된 일정(CalendarEvent)과 달리 날짜 없이도 등록 가능하고 완료 여부만 있다
export interface Todo {
  id: ID
  title: string
  memo?: string
  done: boolean
  dueDate?: string // YYYY-MM-DD
  categoryId?: ID
  ownerId?: ID // Supabase 모드에서만 채워짐. 없으면(로컬 모드) 내 데이터
}

// 반복 규칙을 특정 기간에 맞춰 펼친 한 회차 (저장되지 않는 파생 데이터)
export interface EventInstance {
  event: CalendarEvent
  start: string
  end: string
  instanceDate: string // 이 회차의 원래 시작일(YYYY-MM-DD), 반복 편집 범위 지정에 사용
}

// 캘린더가 보여주는 화면 종류
export type CalendarView = 'month' | 'week' | 'day' | 'agenda'

// 19단계(함께 일정): 앱 내 알림 한 건
export type NotificationKind = 'invited' | 'updated' | 'responded' | 'deleted'

export interface AppNotification {
  id: ID
  actorId: ID | null
  actorEmail: string
  kind: NotificationKind
  status?: ParticipantStatus // invited/responded일 때 참여 상태
  eventId?: ID
  eventTitle: string
  readAt?: string
  createdAt: string
}
