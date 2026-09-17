// together.ts: 함께 일정의 참여 상태·권한·표시 규칙 테스트
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Participant } from '../types'
import { canEdit, isJoint, isVisibleTo, myJointStatus } from './together'

const ME = 'me'
const OWNER = 'owner'
const PARTNER = 'partner'

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: 'e1', title: '일정', allDay: true, start: '2026-09-18', end: '2026-09-18', ...overrides }
}

function participant(status: Participant['status'], userId = ME): Participant {
  return { userId, email: `${userId}@example.com`, status }
}

describe('isJoint', () => {
  it('participants가 있으면 함께 일정이다', () => {
    expect(isJoint(baseEvent({ participants: [participant('accepted')] }))).toBe(true)
  })

  it('participants가 없거나 비어 있으면 함께 일정이 아니다', () => {
    expect(isJoint(baseEvent())).toBe(false)
    expect(isJoint(baseEvent({ participants: [] }))).toBe(false)
  })
})

describe('myJointStatus', () => {
  it('내 참여 상태를 찾는다', () => {
    const event = baseEvent({ participants: [participant('pending')] })
    expect(myJointStatus(event, ME)).toBe('pending')
  })

  it('내가 참여자가 아니면 undefined다', () => {
    const event = baseEvent({ participants: [participant('accepted', PARTNER)] })
    expect(myJointStatus(event, ME)).toBeUndefined()
  })

  it('uid가 없으면(로그아웃) undefined다', () => {
    const event = baseEvent({ participants: [participant('accepted', ME)] })
    expect(myJointStatus(event, undefined)).toBeUndefined()
  })
})

describe('canEdit', () => {
  it('ownerId가 없으면(로컬 모드/테스트) 항상 수정 가능하다', () => {
    expect(canEdit(baseEvent(), ME)).toBe(true)
    expect(canEdit(baseEvent(), undefined)).toBe(true)
  })

  it('내가 작성자면 수정 가능하다', () => {
    expect(canEdit(baseEvent({ ownerId: ME }), ME)).toBe(true)
  })

  it('참여자로 accepted면 수정 가능하다', () => {
    const event = baseEvent({ ownerId: OWNER, participants: [participant('accepted')] })
    expect(canEdit(event, ME)).toBe(true)
  })

  it('참여자로 pending/declined이거나 참여자가 아니면 수정 불가하다', () => {
    expect(canEdit(baseEvent({ ownerId: OWNER, participants: [participant('pending')] }), ME)).toBe(false)
    expect(canEdit(baseEvent({ ownerId: OWNER, participants: [participant('declined')] }), ME)).toBe(false)
    expect(canEdit(baseEvent({ ownerId: OWNER }), ME)).toBe(false)
  })
})

describe('isVisibleTo', () => {
  it('내가 거절한 일정은 숨긴다', () => {
    const event = baseEvent({ ownerId: OWNER, participants: [participant('declined')] })
    expect(isVisibleTo(event, ME, new Set())).toBe(false)
  })

  it('내가 참여 중(대기/확정)이면 소유자를 숨겨도 항상 보인다', () => {
    const pending = baseEvent({ ownerId: OWNER, participants: [participant('pending')] })
    const accepted = baseEvent({ ownerId: OWNER, participants: [participant('accepted')] })
    expect(isVisibleTo(pending, ME, new Set([OWNER]))).toBe(true)
    expect(isVisibleTo(accepted, ME, new Set([OWNER]))).toBe(true)
  })

  it('함께 일정이 아니면 기존 소유자 토글 규칙을 따른다', () => {
    const event = baseEvent({ ownerId: OWNER })
    expect(isVisibleTo(event, ME, new Set())).toBe(true)
    expect(isVisibleTo(event, ME, new Set([OWNER]))).toBe(false)
  })

  it('로컬 모드(ownerId/uid 없음)는 항상 보인다', () => {
    expect(isVisibleTo(baseEvent(), undefined, new Set())).toBe(true)
  })
})
