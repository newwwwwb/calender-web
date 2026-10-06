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

// 매달·매년 규칙은 "며칠(몇 월 며칠)"로 회차를 펼치고 그 날이 없는 달·해는 건너뛴다(recurrence.ts addMonthsExact). 그래서 시리즈를 통째로 옮길 때
// ① 달(매년은 해)을 넘기면 앵커·종료일·제외일을 일수로 옮길 수 없어(달마다 길이가 다르다) 놓은 자리에 회차가 없거나 회차 수가 바뀌고,
// ② 원래 날짜나 옮길 날짜가 29~31일(2월 29일)이면 건너뛰는 달의 패턴이 달라져 회차가 사라지거나 생긴다 — 이 둘은 '이 일정만' 말고는 안전하지 않다
// (28단계 심사: 월 경계를 넘는 이동 14,210건 중 2,468건이 어긋났고, 속성 검사가 29일 시리즈를 23일로 옮길 때의 누락도 잡았다).
// 매년은 같은 해 안이라도 달을 바꾸면 윤년 여부에 따라 일수 차이가 해마다 달라(2/28→3/1은 평년 +1일, 윤년 +2일) 종료일·제외일을 일수로 옮길 수 없다
// (3차 심사: 종료일이 윤년 2월 말에 걸리면 마지막 회차가 잘렸다). 그래서 매달·매년 모두 같은 달 안에서 옮기거나 날짜는 그대로 시간만 바꾸는 것만 안전하다.
export function isScopeSafe(event: CalendarEvent, instance: EventInstance, next: { start: string }, scope: RecurrenceScope): boolean {
  const freq = event.recurrence?.freq
  if (scope === 'this' || !freq || (freq !== 'monthly' && freq !== 'yearly')) return true
  if (next.start.slice(0, 10) === instance.start.slice(0, 10)) return true // 시간만 바꿈 — 규칙이 달라지지 않는다
  if (freq === 'monthly') return next.start.slice(0, 7) === instance.start.slice(0, 7) && dayOf(instance.start) <= 28 && dayOf(next.start) <= 28
  const feb29 = (key: string) => monthOf(key) === 2 && dayOf(key) === 29
  return next.start.slice(0, 7) === instance.start.slice(0, 7) && !feb29(instance.start) && !feb29(next.start)
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
