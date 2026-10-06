// planRecurringMove: 반복 일정 한 회차를 옮기거나 길이를 바꿀 때 범위(이 일정만/이후/전체)별 저장 계획 검증
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, EventInstance } from '../types'
import { endOfDay } from 'date-fns'
import { expandRecurrence } from './recurrence'
import { parseDateKey } from './date'
import { planRecurringMove } from './recurrenceMove'

// 매주 월요일 9~10시, 9월 7일 시작
const weeklyMonday: CalendarEvent = {
  id: 'w',
  title: '요가',
  memo: '매트',
  categoryId: 'c1',
  color: '#ff0000',
  allDay: false,
  start: '2026-09-07T09:00',
  end: '2026-09-07T10:00',
  recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] },
}

function instanceOn(event: CalendarEvent, dayKey: string): EventInstance {
  const found = expandRecurrence(event, parseDateKey(dayKey), endOfDay(parseDateKey(dayKey))).find((i) => i.instanceDate === dayKey)
  if (!found) throw new Error(`${dayKey}에 회차가 없다`)
  return found
}

// 9/14(월) 회차를 화요일 10~11시로 옮김(+1일 +1시간)
const moved = { start: '2026-09-15T10:00', end: '2026-09-15T11:00' }

describe('planRecurringMove — 이 일정만', () => {
  it('원본에서 그 회차를 제외하고, 옮긴 시각의 단발 일정을 만든다(제목·메모·카테고리·색 복사)', () => {
    const plan = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), moved, 'this')
    expect(plan.update.excludedDates).toEqual(['2026-09-14'])
    expect(plan.update.recurrence).toEqual(weeklyMonday.recurrence)
    expect(plan.add).toMatchObject({ title: '요가', memo: '매트', categoryId: 'c1', color: '#ff0000', start: moved.start, end: moved.end })
    expect(plan.add?.recurrence).toBeUndefined()
    expect(plan.add?.id).not.toBe('w')
  })
})

describe('planRecurringMove — 모든 반복 일정', () => {
  it('앵커를 옮긴 일수·분만큼만 움직이고 요일을 같은 만큼 돌린다', () => {
    const plan = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), moved, 'all')
    expect(plan.add).toBeUndefined()
    expect(plan.update).toMatchObject({ start: '2026-09-08T10:00', end: '2026-09-08T11:00' })
    expect(plan.update.recurrence?.byWeekday).toEqual([2])
    // 옮긴 결과로 펼치면 모든 회차가 화요일 10시
    const days = expandRecurrence(plan.update, parseDateKey('2026-09-01'), parseDateKey('2026-09-30')).map((i) => i.start)
    expect(days).toEqual(['2026-09-08T10:00', '2026-09-15T10:00', '2026-09-22T10:00', '2026-09-29T10:00'])
  })

  it('길이만 바꾸면(같은 시작) 앵커 시작은 그대로고 끝만 바뀐다', () => {
    const plan = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), { start: '2026-09-14T09:00', end: '2026-09-14T10:30' }, 'all')
    expect(plan.update).toMatchObject({ start: '2026-09-07T09:00', end: '2026-09-07T10:30' })
    expect(plan.update.recurrence?.byWeekday).toEqual([1])
  })

  it('요일이 여러 개인 반복은 모두 같은 만큼 돌아간다(월·수 → 화·목)', () => {
    const event: CalendarEvent = { ...weeklyMonday, recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3] } }
    const plan = planRecurringMove(event, instanceOn(event, '2026-09-14'), moved, 'all')
    expect(plan.update.recurrence?.byWeekday).toEqual([2, 4])
  })

  it('일요일 쪽으로 돌아가는 요일은 mod 7로 감싼다(토 → 일, 하루 뒤)', () => {
    const event: CalendarEvent = { ...weeklyMonday, start: '2026-09-05T09:00', end: '2026-09-05T10:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [6] } }
    const plan = planRecurringMove(event, instanceOn(event, '2026-09-12'), { start: '2026-09-13T09:00', end: '2026-09-13T10:00' }, 'all')
    expect(plan.update.recurrence?.byWeekday).toEqual([0])
  })

  it('제외일과 종료일도 같은 일수만큼 옮긴다', () => {
    const event: CalendarEvent = { ...weeklyMonday, excludedDates: ['2026-09-21'], recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], until: '2026-10-05' } }
    const plan = planRecurringMove(event, instanceOn(event, '2026-09-14'), moved, 'all')
    expect(plan.update.excludedDates).toEqual(['2026-09-22'])
    expect(plan.update.recurrence?.until).toBe('2026-10-06')
  })

  it('월간 반복은 앵커 날짜가 옮긴 만큼 바뀐다(15일 → 17일)', () => {
    const event: CalendarEvent = { ...weeklyMonday, start: '2026-09-15T09:00', end: '2026-09-15T10:00', recurrence: { freq: 'monthly', interval: 1 } }
    const plan = planRecurringMove(event, instanceOn(event, '2026-10-15'), { start: '2026-10-17T09:00', end: '2026-10-17T10:00' }, 'all')
    expect(plan.update).toMatchObject({ start: '2026-09-17T09:00', end: '2026-09-17T10:00' })
  })
})

describe('planRecurringMove — 이 일정과 이후 일정', () => {
  it('원본은 그 회차 전날까지로 자르고, 옮긴 시각부터 새 시리즈를 만든다', () => {
    const plan = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.update.recurrence?.until).toBe('2026-09-20')
    expect(plan.add).toMatchObject({ title: '요가', start: '2026-09-22T10:00', end: '2026-09-22T11:00' })
    expect(plan.add?.recurrence).toMatchObject({ freq: 'weekly', byWeekday: [2], until: undefined, count: undefined })
    const days = expandRecurrence(plan.add!, parseDateKey('2026-09-01'), parseDateKey('2026-10-10')).map((i) => i.start)
    expect(days).toEqual(['2026-09-22T10:00', '2026-09-29T10:00', '2026-10-06T10:00'])
  })

  it('횟수로 끝나는 반복은 새 시리즈의 종료일로 바꾼다(원래 마지막 회차가 같은 만큼 이동)', () => {
    const event: CalendarEvent = { ...weeklyMonday, recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], count: 5 } } // 9/7, 14, 21, 28, 10/5
    const plan = planRecurringMove(event, instanceOn(event, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.update.recurrence?.until).toBe('2026-09-20')
    expect(plan.add?.recurrence).toMatchObject({ count: undefined, until: '2026-10-06' })
  })

  it('첫 회차에서 고르면 전체와 같다', () => {
    const first = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-07'), { start: '2026-09-08T10:00', end: '2026-09-08T11:00' }, 'following')
    const all = planRecurringMove(weeklyMonday, instanceOn(weeklyMonday, '2026-09-07'), { start: '2026-09-08T10:00', end: '2026-09-08T11:00' }, 'all')
    expect(first).toEqual(all)
    expect(first.add).toBeUndefined()
  })

  it('이후 제외일만 새 시리즈로 옮긴다', () => {
    const event: CalendarEvent = { ...weeklyMonday, excludedDates: ['2026-09-14', '2026-09-28'] }
    const plan = planRecurringMove(event, instanceOn(event, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.add?.excludedDates).toEqual(['2026-09-29'])
  })
})
