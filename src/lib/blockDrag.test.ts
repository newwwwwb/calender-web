// blockDrag: 시간 블록 드래그 편집의 순수 계산(스냅·이동·길이 조절·클램프·드래그 가능 판정) 검증
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import { autoScrollSpeed, canMoveEvent, canResizeBlock, columnAtX, isBlockDraggable, moveBlock, resizeBlock, resizeBlockStart, resizeDays, shiftByDays, snapDelta } from './blockDrag'

const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e',
  title: '회의',
  allDay: false,
  start: '2026-10-06T09:00',
  end: '2026-10-06T10:00',
  ...patch,
})

describe('resizeDays — 종일 기간 조절', () => {
  it('끝 날을 늘이고 줄인다', () => {
    expect(resizeDays('2026-09-14', '2026-09-16', 'end', 2)).toEqual({ start: '2026-09-14', end: '2026-09-18' })
    expect(resizeDays('2026-09-14', '2026-09-16', 'end', -1)).toEqual({ start: '2026-09-14', end: '2026-09-15' })
  })

  it('시작 날을 앞으로 늘이고 뒤로 줄인다', () => {
    expect(resizeDays('2026-09-14', '2026-09-16', 'start', -3)).toEqual({ start: '2026-09-11', end: '2026-09-16' })
    expect(resizeDays('2026-09-14', '2026-09-16', 'start', 1)).toEqual({ start: '2026-09-15', end: '2026-09-16' })
  })

  it('끝을 시작 앞으로, 시작을 끝 뒤로 끌면 한 날로 고정된다(최소 하루)', () => {
    expect(resizeDays('2026-09-14', '2026-09-16', 'end', -9)).toEqual({ start: '2026-09-14', end: '2026-09-14' })
    expect(resizeDays('2026-09-14', '2026-09-16', 'start', 9)).toEqual({ start: '2026-09-16', end: '2026-09-16' })
  })

  it('월·연 경계와 윤일을 넘어도 날짜가 맞다', () => {
    expect(resizeDays('2026-10-30', '2026-10-31', 'end', 2)).toEqual({ start: '2026-10-30', end: '2026-11-02' })
    expect(resizeDays('2026-12-30', '2026-12-31', 'end', 1)).toEqual({ start: '2026-12-30', end: '2027-01-01' })
    expect(resizeDays('2028-02-27', '2028-02-28', 'end', 2)).toEqual({ start: '2028-02-27', end: '2028-03-01' })
    expect(resizeDays('2027-03-01', '2027-03-03', 'start', -2)).toEqual({ start: '2027-02-27', end: '2027-03-03' })
  })

  it('하루 일정은 양쪽으로 늘일 수 있다', () => {
    expect(resizeDays('2026-09-14', '2026-09-14', 'end', 2)).toEqual({ start: '2026-09-14', end: '2026-09-16' })
    expect(resizeDays('2026-09-14', '2026-09-14', 'start', -2)).toEqual({ start: '2026-09-12', end: '2026-09-14' })
  })
})

describe('isBlockDraggable', () => {
  it('내 시간 일정은 반복이어도 끌 수 있다(반복은 놓을 때 범위를 묻는다)', () => {
    expect(isBlockDraggable(event(), 'me')).toBe(true)
    expect(isBlockDraggable(event({ ownerId: 'me' }), 'me')).toBe(true)
    expect(isBlockDraggable(event({ recurrence: { freq: 'weekly', interval: 1 } }), 'me')).toBe(true)
  })

  it('종일·읽기 전용 공유·응답하지 않은 초대는 끌 수 없다', () => {
    expect(isBlockDraggable(event({ allDay: true }), 'me')).toBe(false)
    expect(isBlockDraggable(event({ ownerId: 'other' }), 'me')).toBe(false)
    expect(isBlockDraggable(event({ ownerId: 'other', participants: [{ userId: 'me', email: 'a@b.c', status: 'pending' }] }), 'me')).toBe(false)
  })

  // 29단계: 편집기와 같은 권한(소유자 또는 수락한 참여자) — 서버 정책 events_update_participant와 같다. 시간이 바뀌면 서버가 참여자에게 알린다
  it('함께 일정도 내가 소유자이거나 수락한 참여자면 끌 수 있다', () => {
    expect(isBlockDraggable(event({ ownerId: 'me', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }), 'me')).toBe(true)
    expect(isBlockDraggable(event({ ownerId: 'other', participants: [{ userId: 'me', email: 'a@b.c', status: 'accepted' }] }), 'me')).toBe(true)
  })
})

describe('canMoveEvent (월 보기 칩)', () => {
  it('종일 일정도 내 일정이면 옮길 수 있다(주·일의 시간 블록 규칙과 달리)', () => {
    expect(canMoveEvent(event({ allDay: true }), 'me')).toBe(true)
    expect(canMoveEvent(event({ recurrence: { freq: 'weekly', interval: 1 } }), 'me')).toBe(true)
  })

  it('읽기 전용 공유 일정과 응답하지 않은 초대는 옮길 수 없고, 수락한 함께 일정은 옮길 수 있다', () => {
    expect(canMoveEvent(event({ ownerId: 'other' }), 'me')).toBe(false)
    expect(canMoveEvent(event({ ownerId: 'other', participants: [{ userId: 'me', email: 'a@b.c', status: 'pending' }] }), 'me')).toBe(false)
    expect(canMoveEvent(event({ ownerId: 'me', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }), 'me')).toBe(true)
  })
})

describe('shiftByDays', () => {
  it('시간 일정은 시각을 유지하고 날짜만 옮긴다(끝이 다음 날인 일정도 함께)', () => {
    expect(shiftByDays('2026-10-06T09:00', '2026-10-06T10:00', 3)).toEqual({ start: '2026-10-09T09:00', end: '2026-10-09T10:00' })
    expect(shiftByDays('2026-10-06T22:00', '2026-10-07T02:00', -2)).toEqual({ start: '2026-10-04T22:00', end: '2026-10-05T02:00' })
  })

  it('종일 일정은 날짜 키 그대로, 여러 날에 걸친 일정은 전체 기간이 같은 일수만큼 옮겨진다', () => {
    expect(shiftByDays('2026-10-06', '2026-10-06', 1)).toEqual({ start: '2026-10-07', end: '2026-10-07' })
    expect(shiftByDays('2026-10-05', '2026-10-08', 5)).toEqual({ start: '2026-10-10', end: '2026-10-13' })
  })

  it('월·연 경계와 윤일을 넘어도 맞다', () => {
    expect(shiftByDays('2026-10-30', '2026-10-31', 2)).toEqual({ start: '2026-11-01', end: '2026-11-02' })
    expect(shiftByDays('2028-02-28T09:00', '2028-02-28T10:00', 1)).toEqual({ start: '2028-02-29T09:00', end: '2028-02-29T10:00' })
    expect(shiftByDays('2026-12-31', '2026-12-31', 1)).toEqual({ start: '2027-01-01', end: '2027-01-01' })
  })

  it('0일이면 그대로다', () => {
    expect(shiftByDays('2026-10-06T09:00', '2026-10-06T10:00', 0)).toEqual({ start: '2026-10-06T09:00', end: '2026-10-06T10:00' })
  })
})

describe('snapDelta', () => {
  it('15분 단위로 반올림한다', () => {
    expect(snapDelta(0)).toBe(0)
    expect(snapDelta(7)).toBe(0)
    expect(snapDelta(8)).toBe(15)
    expect(snapDelta(-8)).toBe(-15)
    expect(Math.abs(snapDelta(-7))).toBe(0)
  })
})

describe('moveBlock', () => {
  it('길이를 유지한 채 시각을 옮긴다', () => {
    expect(moveBlock('2026-10-06T09:00', '2026-10-06T10:30', 60, '2026-10-06')).toEqual({ start: '2026-10-06T10:00', end: '2026-10-06T11:30' })
    expect(moveBlock('2026-10-06T09:00', '2026-10-06T10:30', -45, '2026-10-06')).toEqual({ start: '2026-10-06T08:15', end: '2026-10-06T09:45' })
  })

  it('다른 날 열로 옮기면 날짜가 바뀐다', () => {
    expect(moveBlock('2026-10-06T09:00', '2026-10-06T10:00', 0, '2026-10-08')).toEqual({ start: '2026-10-08T09:00', end: '2026-10-08T10:00' })
  })

  it('정각이 아닌 시작은 어긋남을 유지한다(살짝 끌었다고 05:50이 05:45가 되지 않는다)', () => {
    expect(moveBlock('2026-10-06T05:50', '2026-10-06T06:20', 5, '2026-10-06')).toEqual({ start: '2026-10-06T05:50', end: '2026-10-06T06:20' })
    expect(moveBlock('2026-10-06T05:50', '2026-10-06T06:20', 15, '2026-10-06')).toEqual({ start: '2026-10-06T06:05', end: '2026-10-06T06:35' })
  })

  it('0시 위·24시 아래로 나가지 않게 가둔다(끝이 다음 날로 넘어가지 않는다)', () => {
    expect(moveBlock('2026-10-06T00:30', '2026-10-06T01:30', -600, '2026-10-06').start).toBe('2026-10-06T00:00')
    expect(moveBlock('2026-10-06T22:00', '2026-10-06T23:00', 600, '2026-10-06')).toEqual({ start: '2026-10-06T23:00', end: '2026-10-07T00:00' })
  })

  it('하루를 넘기는 일정도 길이를 유지해 옮기고, 시작은 23:45까지 허용한다', () => {
    expect(moveBlock('2026-10-06T22:00', '2026-10-07T02:00', 60, '2026-10-06')).toEqual({ start: '2026-10-06T23:00', end: '2026-10-07T03:00' })
    expect(moveBlock('2026-10-06T22:00', '2026-10-07T02:00', 600, '2026-10-06').start).toBe('2026-10-06T23:45')
  })
})

describe('resizeBlock', () => {
  it('종료 시각만 15분 단위로 바꾼다', () => {
    expect(resizeBlock('2026-10-06T09:00', '2026-10-06T10:00', 30)).toEqual({ start: '2026-10-06T09:00', end: '2026-10-06T10:30' })
    expect(resizeBlock('2026-10-06T09:00', '2026-10-06T10:00', -15)).toEqual({ start: '2026-10-06T09:00', end: '2026-10-06T09:45' })
  })

  it('최소 15분 아래로 줄지 않는다', () => {
    expect(resizeBlock('2026-10-06T09:00', '2026-10-06T10:00', -600)).toEqual({ start: '2026-10-06T09:00', end: '2026-10-06T09:15' })
  })

  it('그 날 24시를 넘어 늘어나지 않는다', () => {
    expect(resizeBlock('2026-10-06T22:00', '2026-10-06T23:00', 600)).toEqual({ start: '2026-10-06T22:00', end: '2026-10-07T00:00' })
  })

  // 27단계 승인 심사: 24시에 끝나는 일정(다음 날 00:00)을 "하루를 넘기는 일정"으로 봐서, 24시까지 늘린 뒤 손잡이가 사라지고
  // 옮기면 자정을 넘겼다 — 드래그로 만든 상태를 드래그로 되돌릴 수 없었다
  it('24시에 끝나는 일정도 같은 날 일정이라 다시 줄일 수 있고, 옮겨도 24시를 넘지 않는다', () => {
    expect(canResizeBlock('2026-10-06T22:00', '2026-10-07T00:00')).toBe(true)
    expect(resizeBlock('2026-10-06T22:00', '2026-10-07T00:00', -60)).toEqual({ start: '2026-10-06T22:00', end: '2026-10-06T23:00' })
    expect(resizeBlock('2026-10-06T22:00', '2026-10-07T00:00', 600)).toEqual({ start: '2026-10-06T22:00', end: '2026-10-07T00:00' })
    expect(moveBlock('2026-10-06T23:00', '2026-10-07T00:00', 600, '2026-10-06')).toEqual({ start: '2026-10-06T23:00', end: '2026-10-07T00:00' })
  })

  it('하루를 넘기는 일정은 길이를 바꾸지 않는다', () => {
    expect(canResizeBlock('2026-10-06T22:00', '2026-10-07T02:00')).toBe(false)
    expect(resizeBlock('2026-10-06T22:00', '2026-10-07T02:00', 60)).toEqual({ start: '2026-10-06T22:00', end: '2026-10-07T02:00' })
  })
})

describe('resizeBlockStart', () => {
  it('시작 시각만 15분 단위로 바꾸고 종료는 그대로다', () => {
    expect(resizeBlockStart('2026-10-06T09:00', '2026-10-06T10:00', -30)).toEqual({ start: '2026-10-06T08:30', end: '2026-10-06T10:00' })
    expect(resizeBlockStart('2026-10-06T09:00', '2026-10-06T10:00', 15)).toEqual({ start: '2026-10-06T09:15', end: '2026-10-06T10:00' })
  })

  it('종료 15분 전까지만 줄이고, 0시 위로는 늘어나지 않는다', () => {
    expect(resizeBlockStart('2026-10-06T09:00', '2026-10-06T10:00', 600).start).toBe('2026-10-06T09:45')
    expect(resizeBlockStart('2026-10-06T00:30', '2026-10-06T01:00', -600).start).toBe('2026-10-06T00:00')
  })

  it('24시에 끝나는 일정도 줄일 수 있고, 하루를 넘기는 일정은 그대로다', () => {
    expect(resizeBlockStart('2026-10-06T22:00', '2026-10-07T00:00', 30)).toEqual({ start: '2026-10-06T22:30', end: '2026-10-07T00:00' })
    expect(resizeBlockStart('2026-10-06T22:00', '2026-10-07T02:00', -60)).toEqual({ start: '2026-10-06T22:00', end: '2026-10-07T02:00' })
  })
})

describe('columnAtX', () => {
  const columns = [
    { left: 100, right: 200 },
    { left: 200, right: 300 },
    { left: 300, right: 400 },
  ]
  it('x가 속한 열 번호를 돌려준다', () => {
    expect(columnAtX(150, columns)).toBe(0)
    expect(columnAtX(200, columns)).toBe(1)
    expect(columnAtX(399, columns)).toBe(2)
  })
  it('영역 밖이면 가장 가까운 끝 열이다', () => {
    expect(columnAtX(10, columns)).toBe(0)
    expect(columnAtX(900, columns)).toBe(2)
  })
})

describe('autoScrollSpeed', () => {
  it('가장자리에서 멀면 멈추고, 가까울수록 빠르게 스크롤한다', () => {
    expect(autoScrollSpeed(300, 100, 500)).toBe(0)
    expect(autoScrollSpeed(130, 100, 500)).toBeLessThan(0)
    expect(autoScrollSpeed(110, 100, 500)).toBeLessThan(autoScrollSpeed(130, 100, 500))
    expect(autoScrollSpeed(480, 100, 500)).toBeGreaterThan(0)
  })
  it('가장자리 밖으로 나가도 최대 속도를 넘지 않는다', () => {
    expect(autoScrollSpeed(-500, 100, 500)).toBe(-14)
    expect(autoScrollSpeed(9000, 100, 500)).toBe(14)
  })
})
