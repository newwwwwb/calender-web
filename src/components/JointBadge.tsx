// 함께 일정 배지: 참여자를 색 점으로 표시하고 대기/함께 상태를 알려준다 (월/주/일/목록 보기 공용)
import { ownerColorFor } from '../lib/ownerColor'
import { isJoint, myJointStatus } from '../lib/together'
import type { CalendarEvent, ID } from '../types'
import styles from './JointBadge.module.css'

interface JointBadgeProps {
  event: CalendarEvent
  currentUserId: ID | undefined
  sharedOwnerIds: ID[]
  className?: string
  // 'dots': 월 보기처럼 칩 폭이 아주 좁은 곳에서는 텍스트("대기"/"함께")를 빼고 점만 보여준다 —
  // 배지 전체를 넣으면 일정 제목이 들어갈 자리가 아예 없어지는 문제가 있었다(모바일 UX 감사에서 발견).
  // 대기 상태는 배지 대신 칩 자체의 점선 테두리(chipPending)로 이미 표시되므로 점에서는 생략해도 된다.
  variant?: 'full' | 'dots'
}

function JointBadge({ event, currentUserId, sharedOwnerIds, className, variant = 'full' }: JointBadgeProps) {
  if (!isJoint(event)) return null
  const participants = event.participants ?? []
  const isOwner = !event.ownerId || event.ownerId === currentUserId
  const myStatus = myJointStatus(event, currentUserId)
  // 작성자는 한 명이라도 수락했으면 "함께"로 본다. 참여자는 자기 상태를 그대로 본다.
  const confirmed = isOwner ? participants.some((p) => p.status === 'accepted') : myStatus === 'accepted'
  const otherIds = (isOwner ? participants.map((p) => p.userId) : [event.ownerId, ...participants.map((p) => p.userId)]).filter(
    (id): id is ID => id !== undefined && id !== currentUserId,
  )
  const title = confirmed ? '함께하는 일정' : '함께하는 일정 · 응답 대기'
  const dots = (
    <span className={styles.dots}>
      {otherIds.slice(0, 3).map((id) => (
        <span key={id} className={styles.dot} style={{ background: ownerColorFor(id, sharedOwnerIds) }} />
      ))}
    </span>
  )

  if (variant === 'dots') {
    return (
      <span className={className} title={title}>
        {dots}
      </span>
    )
  }

  const badgeClass = confirmed ? styles.confirmed : styles.pending

  return (
    <span className={className ? `${badgeClass} ${className}` : badgeClass} title={title}>
      {dots}
      {confirmed ? '함께' : '대기'}
    </span>
  )
}

export default JointBadge
