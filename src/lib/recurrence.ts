// 반복 일정을 주어진 기간에 맞춰 개별 회차(EventInstance)로 펼치는 로직
import { addDays, addWeeks, startOfWeek } from 'date-fns'
import type { CalendarEvent, EventInstance, RecurrenceRule } from '../types'
import { parseDateTimeKey, toDateKey, toDateTimeKey, WEEK_STARTS_ON } from './date'

// ponytail: interval이 0/음수로 잘못 들어와도 무한 루프에 빠지지 않도록 막는 안전 상한.
// 개인 캘린더 용도라 매일 반복 10년치(3650회)면 충분하고, 넘으면 규칙이 잘못된 것으로 본다.
const MAX_OCCURRENCES = 3650

function toKey(event: CalendarEvent, date: Date): string {
  return event.allDay ? toDateKey(date) : toDateTimeKey(date)
}

function makeInstance(event: CalendarEvent, occurrenceStart: Date, durationMs: number): EventInstance {
  const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs)
  return {
    event,
    start: toKey(event, occurrenceStart),
    end: toKey(event, occurrenceEnd),
    instanceDate: toDateKey(occurrenceStart),
  }
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start <= rangeEnd && end >= rangeStart
}

// 매달/매년 규칙의 다음 후보 날짜를 계산한다 (매년은 monthsToAdd를 12배해서 호출).
// 원래 일(day-of-month)이 없는 달(예: 31일이 없는 2월, 윤년이 아닌 해의 2월 29일)은
// 다음 달로 밀지 않고 건너뛴다.
function addMonthsExact(origin: Date, monthsToAdd: number): Date | null {
  const candidate = new Date(origin)
  candidate.setMonth(origin.getMonth() + monthsToAdd)
  if (candidate.getDate() !== origin.getDate()) return null
  return candidate
}

// origin부터 시작해 규칙에 맞는 후보 날짜를 오름차순으로 생성한다 (until/count 적용 전 원시 목록)
function* occurrenceDates(rule: RecurrenceRule, origin: Date): Generator<Date> {
  const interval = Math.max(1, rule.interval || 1)

  if (rule.freq === 'weekly' && rule.byWeekday && rule.byWeekday.length > 0) {
    const days = [...rule.byWeekday].sort((a, b) => a - b)
    let weekStart = startOfWeek(origin, { weekStartsOn: WEEK_STARTS_ON })
    for (let produced = 0; produced < MAX_OCCURRENCES; weekStart = addWeeks(weekStart, interval)) {
      for (const day of days) {
        const candidate = addDays(weekStart, day)
        candidate.setHours(origin.getHours(), origin.getMinutes(), 0, 0)
        if (candidate < origin) continue
        yield candidate
        produced += 1
        if (produced >= MAX_OCCURRENCES) return
      }
    }
    return
  }

  for (let step = 0; step < MAX_OCCURRENCES; step++) {
    const candidate =
      rule.freq === 'daily'
        ? addDays(origin, step * interval)
        : rule.freq === 'weekly'
          ? addWeeks(origin, step * interval)
          : addMonthsExact(origin, step * interval * (rule.freq === 'yearly' ? 12 : 1))
    if (candidate) yield candidate
  }
}

// event를 [rangeStart, rangeEnd] 구간에 맞춰 실제 회차들로 펼친다.
export function expandRecurrence(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): EventInstance[] {
  const originalStart = parseDateTimeKey(event.start)
  const originalEnd = parseDateTimeKey(event.end)
  const durationMs = originalEnd.getTime() - originalStart.getTime()

  if (!event.recurrence) {
    return overlaps(originalStart, originalEnd, rangeStart, rangeEnd)
      ? [makeInstance(event, originalStart, durationMs)]
      : []
  }

  const { until, count } = event.recurrence
  const excluded = new Set(event.excludedDates ?? [])
  const instances: EventInstance[] = []
  let occurrenceCount = 0

  for (const candidateStart of occurrenceDates(event.recurrence, originalStart)) {
    // 날짜는 항상 오름차순으로 나오므로 range를 넘으면 더 볼 필요가 없다
    if (candidateStart > rangeEnd) break
    if (until && toDateKey(candidateStart) > until) break
    if (count && occurrenceCount >= count) break
    occurrenceCount += 1

    const dateKey = toDateKey(candidateStart)
    if (excluded.has(dateKey)) continue

    const candidateEnd = new Date(candidateStart.getTime() + durationMs)
    if (overlaps(candidateStart, candidateEnd, rangeStart, rangeEnd)) {
      instances.push(makeInstance(event, candidateStart, durationMs))
    }
  }

  return instances
}

// 여러 일정을 한 번에 [rangeStart, rangeEnd] 구간의 회차들로 펼친다 (월/주/일 보기에서 사용)
export function expandEventsInRange(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): EventInstance[] {
  return events.flatMap((event) => expandRecurrence(event, rangeStart, rangeEnd))
}
