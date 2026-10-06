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

const monthOf = (key: string) => Number(key.slice(5, 7))
const dayOf = (key: string) => Number(key.slice(8, 10))

// 매달·매년 규칙은 "며칠(몇 월 며칠)"로 회차를 펼치고 그 날이 없는 달·해는 건너뛴다(recurrence.ts addMonthsExact). 그래서 31일·2월 29일처럼
// 없는 달·해가 있는 날로 시리즈를 통째로 옮기면 회차가 조용히 사라진다 — 일(日)이 바뀌는데 그 날이 28일을 넘거나(매달), 2월 29일이면(매년)
// '이 일정만' 말고는 안전하지 않다. 날짜가 그대로(시간만 바꿈)면 규칙이 달라지지 않아 안전하다.
export function isScopeSafe(event: CalendarEvent, instance: EventInstance, next: { start: string }, scope: RecurrenceScope): boolean {
  const freq = event.recurrence?.freq
  if (scope === 'this' || !freq) return true
  const day0 = dayOf(instance.start)
  const day1 = dayOf(next.start)
  if (freq === 'monthly') return day1 === day0 || day1 <= 28
  if (freq === 'yearly') return (monthOf(next.start) === monthOf(instance.start) && day1 === day0) || !(monthOf(next.start) === 2 && day1 === 29)
  return true
}

// instance(옮기기 전 회차)를 next(옮긴 뒤 시작·끝)로 바꿀 때 scope별 저장 계획. 안전하지 않은 범위면(isScopeSafe) null.
// '이후'가 첫 회차부터면 '전체'와 같다(편집기 commitSave와 같은 규칙).
export function planRecurringMove(
  event: CalendarEvent,
  instance: EventInstance,
  next: { start: string; end: string },
  scope: RecurrenceScope,
): RecurringMovePlan | null {
  if (!isScopeSafe(event, instance, next, scope)) return null
  const occurrenceDate = instance.instanceDate
  const effective: RecurrenceScope = scope === 'following' && isFirstOccurrence(event, occurrenceDate) ? 'all' : scope
  const rule = event.recurrence
  const dayDelta = differenceInCalendarDays(parseDateKey(next.start.slice(0, 10)), parseDateKey(instance.start.slice(0, 10)))
  const minuteDelta = differenceInMinutes(parseDateTimeKey(next.start), parseDateTimeKey(instance.start))
  const duration = differenceInMinutes(parseDateTimeKey(next.end), parseDateTimeKey(next.start))
  const common = { title: event.title, memo: event.memo, categoryId: event.categoryId, color: event.color, allDay: event.allDay }

  // 제외일(회차 날짜)을 옮긴 규칙에 맞춰 바꾼다. 일·주 반복은 같은 일수만큼, 매달은 같은 달의 새 '일', 매년은 같은 해의 새 '월·일'(그 날이 없으면 버린다)
  const remapExcluded = (key: string): string | null => {
    if (rule?.freq !== 'monthly' && rule?.freq !== 'yearly') return shiftDateKey(key, dayDelta)
    const month = rule.freq === 'yearly' ? monthOf(next.start) : monthOf(key)
    const candidate = new Date(Number(key.slice(0, 4)), month - 1, dayOf(next.start))
    return candidate.getMonth() === month - 1 ? toDateKey(candidate) : null
  }
  const remapAll = (keys: string[] | undefined) => keys?.map(remapExcluded).filter((k): k is string => k !== null)

  if (effective === 'all' || !rule) {
    // 앵커(event.start)를 옮긴 만큼만 움직이고 길이는 새 값. 앵커 자체를 이 회차 날짜로 바꾸면 시리즈 전체가 그 날로 튄다.
    // 매달·매년은 분 단위 이동이 아니라 앵커의 달(·해)은 두고 일(·월)만 놓은 날의 것으로 바꾼다 — 일수만큼 밀면 월말에서 그 날이 없는 앵커가 된다
    const anchor = parseDateTimeKey(event.start)
    const placed = parseDateTimeKey(next.start)
    const anchorStart =
      rule?.freq === 'monthly'
        ? new Date(anchor.getFullYear(), anchor.getMonth(), placed.getDate(), placed.getHours(), placed.getMinutes())
        : rule?.freq === 'yearly'
          ? new Date(anchor.getFullYear(), placed.getMonth(), placed.getDate(), placed.getHours(), placed.getMinutes())
          : addMinutes(anchor, minuteDelta)
    return {
      update: {
        ...event,
        start: toDateTimeKey(anchorStart),
        end: toDateTimeKey(addMinutes(anchorStart, duration)),
        recurrence: rule && { ...shiftWeekdays(rule, dayDelta), until: rule.until && shiftDateKey(rule.until, dayDelta) },
        excludedDates: remapAll(event.excludedDates),
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
      excludedDates: remapAll(event.excludedDates?.filter((d) => d >= occurrenceDate)),
    },
  }
}
