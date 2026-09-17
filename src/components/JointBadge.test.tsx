// JointBadge: 함께 일정 여부에 따른 대기/함께 표시를 검증
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import JointBadge from './JointBadge'

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: 'e1', title: '일정', allDay: true, start: '2026-09-18', end: '2026-09-18', ...overrides }
}

describe('JointBadge', () => {
  it('함께 일정이 아니면 아무것도 렌더링하지 않는다', () => {
    render(<JointBadge event={baseEvent()} currentUserId="me" sharedOwnerIds={[]} />)
    expect(screen.queryByText('함께')).not.toBeInTheDocument()
    expect(screen.queryByText('대기')).not.toBeInTheDocument()
  })

  it('내가 참여자로 pending이면 "대기"를 보여준다', () => {
    const event = baseEvent({
      ownerId: 'owner-1',
      participants: [{ userId: 'me', email: 'me@example.com', status: 'pending' }],
    })
    render(<JointBadge event={event} currentUserId="me" sharedOwnerIds={['owner-1']} />)
    expect(screen.getByText('대기')).toBeInTheDocument()
  })

  it('내가 참여자로 accepted면 "함께"를 보여준다', () => {
    const event = baseEvent({
      ownerId: 'owner-1',
      participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
    })
    render(<JointBadge event={event} currentUserId="me" sharedOwnerIds={['owner-1']} />)
    expect(screen.getByText('함께')).toBeInTheDocument()
  })

  it('작성자는 참여자 중 한 명이라도 수락했으면 "함께"를 보여준다', () => {
    const event = baseEvent({
      participants: [
        { userId: 'partner-1', email: 'a@example.com', status: 'pending' },
        { userId: 'partner-2', email: 'b@example.com', status: 'accepted' },
      ],
    })
    render(<JointBadge event={event} currentUserId="me" sharedOwnerIds={['partner-1', 'partner-2']} />)
    expect(screen.getByText('함께')).toBeInTheDocument()
  })

  it('작성자는 참여자 전원이 pending이면 "대기"를 보여준다', () => {
    const event = baseEvent({
      participants: [{ userId: 'partner-1', email: 'a@example.com', status: 'pending' }],
    })
    render(<JointBadge event={event} currentUserId="me" sharedOwnerIds={['partner-1']} />)
    expect(screen.getByText('대기')).toBeInTheDocument()
  })

  it('variant="dots"면 대기/함께 텍스트 없이 참여자 점만 보여준다(좁은 칩에서 제목 공간 확보용)', () => {
    const event = baseEvent({
      ownerId: 'owner-1',
      participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
    })
    render(<JointBadge event={event} currentUserId="me" sharedOwnerIds={['owner-1']} variant="dots" />)
    expect(screen.queryByText('함께')).not.toBeInTheDocument()
    expect(screen.queryByText('대기')).not.toBeInTheDocument()
    expect(screen.getByTitle('함께하는 일정')).toBeInTheDocument()
  })
})
