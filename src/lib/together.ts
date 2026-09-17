// 19단계(함께 일정): 참여자 상태를 다루는 순수 함수. RLS·트리거가 서버에서 강제하는 규칙을
// 화면에서 미리 판단하는 용도이므로, 여기서 canEdit이 true라고 해도 서버가 최종 결정한다.
import type { CalendarEvent, ID, ParticipantStatus } from '../types'

export function isJoint(event: CalendarEvent): boolean {
  return Boolean(event.participants && event.participants.length > 0)
}

export function myJointStatus(event: CalendarEvent, uid: ID | undefined): ParticipantStatus | undefined {
  if (!uid || !event.participants) return undefined
  return event.participants.find((p) => p.userId === uid)?.status
}

// ownerId가 없으면 로컬 모드(로그아웃)이거나 repository를 직접 주입한 테스트라 항상 내 것으로 본다
export function canEdit(event: CalendarEvent, uid: ID | undefined): boolean {
  if (!event.ownerId) return true
  if (event.ownerId === uid) return true
  return myJointStatus(event, uid) === 'accepted'
}

// 겹쳐보기 토글(hiddenOwnerIds)로 캘린더 단위 표시를 켜고 끄지만, 함께 일정은 그 토글과
// 별개로 다룬다: 내가 거절한 일정은 숨기고, 참여 중인(대기/확정) 일정은 상대 캘린더를
// 숨겨도 항상 보이게 한다.
export function isVisibleTo(event: CalendarEvent, uid: ID | undefined, hiddenOwnerIds: Set<ID>): boolean {
  const status = myJointStatus(event, uid)
  if (status === 'declined') return false
  if (status === 'pending' || status === 'accepted') return true
  return !hiddenOwnerIds.has(event.ownerId ?? uid ?? '')
}
