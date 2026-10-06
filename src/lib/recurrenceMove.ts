// 반복 일정의 한 회차를 드래그로 옮기거나 길이를 바꿨을 때, 범위(이 일정만/이후/전체)별로 저장할 일정들을 계산하는 순수 함수
import { addDays, addMinutes, differenceInCalendarDays, differenceInMinutes } from 'date-fns'
import type { CalendarEvent, EventInstance, RecurrenceRule } from '../types'
import { parseDateKey, parseDateTimeKey, toDateKey, toDateTimeKey } from './date'
import { excludeOccurrence, isFirstOccurrence, resolveRecurrenceUntil, truncateRecurrenceBefore } from './recurrence'

export type RecurrenceScope = 'this' | 'following' | 'all'

export interface RecurringMovePlan {
  update: CalendarEvent // 기존 일정을 이렇게 바꾼다
  add?: CalendarEvent // 새로 만들 일정('이 일정만' 단발, '이후' 새 시리즈)
}

// 요일 반복의 요일을 같은 일수만큼 돌린다(월→화로 하루 옮기면 [1]→[2]). 일수는 음수도 가능
function shiftWeekdays(rule: RecurrenceRule, dayDelta: number): RecurrenceRule {
  if (rule.freq !== 'weekly' || !rule.byWeekday?.length) return rule
  const byWeekday = rule.byWeekday.map((d) => (((d + dayDelta) % 7) + 7) % 7).sort((a, b) => a - b)
  return { ...rule, byWeekday }
}

const shiftDateKey = (key: string, dayDelta: number) => toDateKey(addDays(parseDateKey(key), dayDelta))

// instance(옮기기 전 회차)를 next(옮긴 뒤 시작·끝)로 바꿀 때 scope별 저장 계획.
// '이후'가 첫 회차부터면 '전체'와 같다(편집기 commitSave와 같은 규칙).
export function planRecurringMove(
  event: CalendarEvent,
  instance: EventInstance,
  next: { start: string; end: string },
  scope: RecurrenceScope,
): RecurringMovePlan {
  const occurrenceDate = instance.instanceDate
  const effective: RecurrenceScope = scope === 'following' && isFirstOccurrence(event, occurrenceDate) ? 'all' : scope
  const rule = event.recurrence
  const dayDelta = differenceInCalendarDays(parseDateKey(next.start.slice(0, 10)), parseDateKey(instance.start.slice(0, 10)))
  const minuteDelta = differenceInMinutes(parseDateTimeKey(next.start), parseDateTimeKey(instance.start))
  const duration = differenceInMinutes(parseDateTimeKey(next.end), parseDateTimeKey(next.start))
  const common = { title: event.title, memo: event.memo, categoryId: event.categoryId, color: event.color, allDay: event.allDay }

  if (effective === 'all' || !rule) {
    // 앵커(event.start)를 옮긴 만큼만 움직이고 길이는 새 값. 앵커 자체를 이 회차 날짜로 바꾸면 시리즈 전체가 그 날로 튄다
    const anchorStart = addMinutes(parseDateTimeKey(event.start), minuteDelta)
    return {
      update: {
        ...event,
        start: toDateTimeKey(anchorStart),
        end: toDateTimeKey(addMinutes(anchorStart, duration)),
        recurrence: rule && { ...shiftWeekdays(rule, dayDelta), until: rule.until && shiftDateKey(rule.until, dayDelta) },
        excludedDates: event.excludedDates?.map((d) => shiftDateKey(d, dayDelta)),
      },
    }
  }

  if (effective === 'this') {
    return {
      update: excludeOccurrence(event, occurrenceDate),
      add: { id: crypto.randomUUID(), ...common, start: next.start, end: next.end },
    }
  }

  // following: 원본은 그 회차 전날까지로 자르고, 옮긴 시각부터 같은 규칙의 새 시리즈를 만든다(요일·제외일·종료일도 같은 만큼 이동)
  const originalUntil = resolveRecurrenceUntil(event)
  return {
    update: truncateRecurrenceBefore(event, occurrenceDate),
    add: {
      id: crypto.randomUUID(),
      ...common,
      start: next.start,
      end: next.end,
      recurrence: { ...shiftWeekdays(rule, dayDelta), until: originalUntil && shiftDateKey(originalUntil, dayDelta), count: undefined },
      excludedDates: event.excludedDates?.filter((d) => d >= occurrenceDate).map((d) => shiftDateKey(d, dayDelta)),
    },
  }
}
