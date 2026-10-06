// planRecurringMove: 반복 일정 한 회차를 옮기거나 길이를 바꿀 때 범위(이 일정만/이후/전체)별 저장 계획 검증
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, EventInstance } from '../types'
import { endOfDay } from 'date-fns'
import { expandRecurrence } from './recurrence'
import { parseDateKey } from './date'
import { isScopeSafe, planRecurringMove } from './recurrenceMove'

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

const mustPlan = (...args: Parameters<typeof planRecurringMove>) => {
  const plan = planRecurringMove(...args)
  if (!plan) throw new Error('계획이 없다(안전하지 않은 범위)')
  return plan
}

// 계획으로 만든 시리즈가 놓은 자리(next.start)에 실제 회차를 가지는지 — 옮겼는데 놓은 날에 일정이 없으면 안 된다
function hasOccurrenceAt(event: CalendarEvent, start: string): boolean {
  const day = start.slice(0, 10)
  return expandRecurrence(event, parseDateKey(day), endOfDay(parseDateKey(day))).some((i) => i.start === start)
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
    const plan = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), moved, 'this')
    expect(plan.update.excludedDates).toEqual(['2026-09-14'])
    expect(plan.update.recurrence).toEqual(weeklyMonday.recurrence)
    expect(plan.add).toMatchObject({ title: '요가', memo: '매트', categoryId: 'c1', color: '#ff0000', start: moved.start, end: moved.end })
    expect(plan.add?.recurrence).toBeUndefined()
    expect(plan.add?.id).not.toBe('w')
  })
})

describe('planRecurringMove — 모든 반복 일정', () => {
  it('앵커를 옮긴 일수·분만큼만 움직이고 요일을 같은 만큼 돌린다', () => {
    const plan = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), moved, 'all')
    expect(plan.add).toBeUndefined()
    expect(plan.update).toMatchObject({ start: '2026-09-08T10:00', end: '2026-09-08T11:00' })
    expect(plan.update.recurrence?.byWeekday).toEqual([2])
    // 옮긴 결과로 펼치면 모든 회차가 화요일 10시
    const days = expandRecurrence(plan.update, parseDateKey('2026-09-01'), parseDateKey('2026-09-30')).map((i) => i.start)
    expect(days).toEqual(['2026-09-08T10:00', '2026-09-15T10:00', '2026-09-22T10:00', '2026-09-29T10:00'])
  })

  it('길이만 바꾸면(같은 시작) 앵커 시작은 그대로고 끝만 바뀐다', () => {
    const plan = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-14'), { start: '2026-09-14T09:00', end: '2026-09-14T10:30' }, 'all')
    expect(plan.update).toMatchObject({ start: '2026-09-07T09:00', end: '2026-09-07T10:30' })
    expect(plan.update.recurrence?.byWeekday).toEqual([1])
  })

  it('요일이 여러 개인 반복은 모두 같은 만큼 돌아간다(월·수 → 화·목)', () => {
    const event: CalendarEvent = { ...weeklyMonday, recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3] } }
    const plan = mustPlan(event, instanceOn(event, '2026-09-14'), moved, 'all')
    expect(plan.update.recurrence?.byWeekday).toEqual([2, 4])
  })

  it('일요일 쪽으로 돌아가는 요일은 mod 7로 감싼다(토 → 일, 하루 뒤)', () => {
    const event: CalendarEvent = { ...weeklyMonday, start: '2026-09-05T09:00', end: '2026-09-05T10:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [6] } }
    const plan = mustPlan(event, instanceOn(event, '2026-09-12'), { start: '2026-09-13T09:00', end: '2026-09-13T10:00' }, 'all')
    expect(plan.update.recurrence?.byWeekday).toEqual([0])
  })

  it('제외일과 종료일도 같은 일수만큼 옮긴다', () => {
    const event: CalendarEvent = { ...weeklyMonday, excludedDates: ['2026-09-21'], recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], until: '2026-10-05' } }
    const plan = mustPlan(event, instanceOn(event, '2026-09-14'), moved, 'all')
    expect(plan.update.excludedDates).toEqual(['2026-09-22'])
    expect(plan.update.recurrence?.until).toBe('2026-10-06')
  })

  it('월간 반복은 앵커 날짜가 옮긴 만큼 바뀐다(15일 → 17일)', () => {
    const event: CalendarEvent = { ...weeklyMonday, start: '2026-09-15T09:00', end: '2026-09-15T10:00', recurrence: { freq: 'monthly', interval: 1 } }
    const plan = mustPlan(event, instanceOn(event, '2026-10-15'), { start: '2026-10-17T09:00', end: '2026-10-17T10:00' }, 'all')
    expect(plan.update).toMatchObject({ start: '2026-09-17T09:00', end: '2026-09-17T10:00' })
  })
})

describe('planRecurringMove — 이 일정과 이후 일정', () => {
  it('원본은 그 회차 전날까지로 자르고, 옮긴 시각부터 새 시리즈를 만든다', () => {
    const plan = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.update.recurrence?.until).toBe('2026-09-20')
    expect(plan.add).toMatchObject({ title: '요가', start: '2026-09-22T10:00', end: '2026-09-22T11:00' })
    expect(plan.add?.recurrence).toMatchObject({ freq: 'weekly', byWeekday: [2], until: undefined, count: undefined })
    const days = expandRecurrence(plan.add!, parseDateKey('2026-09-01'), parseDateKey('2026-10-10')).map((i) => i.start)
    expect(days).toEqual(['2026-09-22T10:00', '2026-09-29T10:00', '2026-10-06T10:00'])
  })

  it('횟수로 끝나는 반복은 새 시리즈의 종료일로 바꾼다(원래 마지막 회차가 같은 만큼 이동)', () => {
    const event: CalendarEvent = { ...weeklyMonday, recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], count: 5 } } // 9/7, 14, 21, 28, 10/5
    const plan = mustPlan(event, instanceOn(event, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.update.recurrence?.until).toBe('2026-09-20')
    expect(plan.add?.recurrence).toMatchObject({ count: undefined, until: '2026-10-06' })
  })

  it('첫 회차에서 고르면 전체와 같다', () => {
    const first = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-07'), { start: '2026-09-08T10:00', end: '2026-09-08T11:00' }, 'following')
    const all = mustPlan(weeklyMonday, instanceOn(weeklyMonday, '2026-09-07'), { start: '2026-09-08T10:00', end: '2026-09-08T11:00' }, 'all')
    expect(first).toEqual(all)
    expect(first.add).toBeUndefined()
  })

  it('이후 제외일만 새 시리즈로 옮긴다', () => {
    const event: CalendarEvent = { ...weeklyMonday, excludedDates: ['2026-09-14', '2026-09-28'] }
    const plan = mustPlan(event, instanceOn(event, '2026-09-21'), { start: '2026-09-22T10:00', end: '2026-09-22T11:00' }, 'following')
    expect(plan.add?.excludedDates).toEqual(['2026-09-29'])
  })
})

// 28단계 승인 심사: 월간·연간 반복의 '모든 반복 일정'이 분 단위 이동으로 앵커를 밀어, 월말·윤일 근처에서 놓은 자리에 일정이 없고 회차가 사라졌다
describe('planRecurringMove — 매달·매년 반복', () => {
  const monthly30: CalendarEvent = { ...weeklyMonday, start: '2026-09-30T09:00', end: '2026-09-30T10:00', recurrence: { freq: 'monthly', interval: 1 } }
  const monthly1: CalendarEvent = { ...weeklyMonday, start: '2026-08-01T09:00', end: '2026-08-01T10:00', recurrence: { freq: 'monthly', interval: 1 } }
  const yearlyMar1: CalendarEvent = { ...weeklyMonday, start: '2024-03-01T09:00', end: '2024-03-01T10:00', recurrence: { freq: 'yearly', interval: 1 } }

  it('매달: 달마다 없는 날(29~31일)로 날짜를 바꿔 옮길 때 이 일정만 외의 범위는 막는다', () => {
    const instance = instanceOn(monthly30, '2026-10-30')
    const next = { start: '2026-10-31T09:00', end: '2026-10-31T10:00' }
    expect(isScopeSafe(monthly30, instance, next, 'all')).toBe(false)
    expect(isScopeSafe(monthly30, instance, next, 'following')).toBe(false)
    expect(isScopeSafe(monthly30, instance, next, 'this')).toBe(true)
    expect(planRecurringMove(monthly30, instance, next, 'all')).toBeNull()
    expect(planRecurringMove(monthly30, instance, next, 'following')).toBeNull()
    expect(planRecurringMove(monthly30, instance, next, 'this')).not.toBeNull()
  })

  it('매달 1일을 전날로(31일) 옮기는 것도 막는다 — 31일 없는 달 회차가 사라진다', () => {
    const instance = instanceOn(monthly1, '2026-11-01')
    expect(isScopeSafe(monthly1, instance, { start: '2026-10-31T09:00' }, 'all')).toBe(false)
  })

  it('매달: 날짜는 그대로 시간만 바꾸면 말일 시리즈도 안전하고 앵커 날짜가 유지된다', () => {
    const monthly31: CalendarEvent = { ...monthly30, start: '2026-01-31T09:00', end: '2026-01-31T10:00' }
    const instance = instanceOn(monthly31, '2026-03-31')
    const next = { start: '2026-03-31T10:00', end: '2026-03-31T11:00' }
    const plan = mustPlan(monthly31, instance, next, 'all')
    expect(plan.update).toMatchObject({ start: '2026-01-31T10:00', end: '2026-01-31T11:00' })
    expect(hasOccurrenceAt(plan.update, next.start)).toBe(true)
  })

  it('매달: 같은 달 안에서 28일 이하끼리 옮기면 놓은 날에 회차가 있다', () => {
    const monthly15: CalendarEvent = { ...monthly30, start: '2026-09-15T09:00', end: '2026-09-15T10:00' }
    const instance = instanceOn(monthly15, '2026-10-15')
    const next = { start: '2026-10-13T09:00', end: '2026-10-13T10:00' }
    expect(hasOccurrenceAt(mustPlan(monthly15, instance, next, 'all').update, next.start)).toBe(true)
    expect(hasOccurrenceAt(mustPlan(monthly15, instance, next, 'following').add!, next.start)).toBe(true)
  })

  it('매달: 29~31일 시리즈는 건너뛰는 달 패턴이 달라지므로 같은 달 안에서 28일로 옮겨도 이 일정만 외에는 막는다', () => {
    const instance = instanceOn(monthly30, '2026-10-30')
    const next = { start: '2026-10-28T09:00', end: '2026-10-28T10:00' }
    expect(planRecurringMove(monthly30, instance, next, 'all')).toBeNull()
    expect(planRecurringMove(monthly30, instance, next, 'this')).not.toBeNull()
  })

  // 28단계 2차 심사: 월(해) 경계를 넘는 이동은 앵커·종료일·제외일을 일수로 옮길 수 없어 놓은 자리에 회차가 없거나 회차 수가 바뀌고 제외일이 어긋났다
  it('매달·매년: 다른 달(해)로 넘기는 이동은 이 일정만 외에는 막는다', () => {
    const cases: [CalendarEvent, string, string][] = [
      [monthly30, '2026-10-30', '2026-11-01'], // 월 경계(앞으로)
      [{ ...monthly30, start: '2026-10-01T09:00', end: '2026-10-01T10:00' }, '2026-10-01', '2026-09-28'], // 월 경계(뒤로)
      [yearlyMar1, '2025-03-01', '2025-02-26'], // 매년은 같은 해라도 달이 바뀌면 막는다
    ]
    for (const [event, from, to] of cases) {
      const instance = instanceOn(event, from)
      const next = { start: `${to}T09:00`, end: `${to}T10:00` }
      expect(planRecurringMove(event, instance, next, 'all')).toBeNull()
      expect(planRecurringMove(event, instance, next, 'following')).toBeNull()
      expect(planRecurringMove(event, instance, next, 'this')).not.toBeNull()
    }
    const yearEnd: CalendarEvent = { ...yearlyMar1, start: '2024-12-31T09:00', end: '2024-12-31T10:00' }
    expect(planRecurringMove(yearEnd, instanceOn(yearEnd, '2026-12-31'), { start: '2027-01-01T09:00', end: '2027-01-01T10:00' }, 'all')).toBeNull()
  })

  it('매달: 제외일도 새 날짜(같은 달의 새 일)로 옮기고, 그 날이 없는 달은 버린다', () => {
    const event: CalendarEvent = { ...weeklyMonday, start: '2026-09-15T09:00', end: '2026-09-15T10:00', excludedDates: ['2026-10-15', '2026-12-15'], recurrence: { freq: 'monthly', interval: 1 } }
    const plan = mustPlan(event, instanceOn(event, '2026-11-15'), { start: '2026-11-17T09:00', end: '2026-11-17T10:00' }, 'all')
    expect(plan.update.excludedDates).toEqual(['2026-10-17', '2026-12-17'])
  })

  it('매년: 같은 달 안에서만 옮길 수 있다(3/1 → 3/4). 2월 29일·다른 달로 넘기는 이동은 막는다', () => {
    const instance = instanceOn(yearlyMar1, '2029-03-01')
    const next = { start: '2029-03-04T09:00', end: '2029-03-04T10:00' }
    const plan = mustPlan(yearlyMar1, instance, next, 'all')
    expect(plan.update.start).toBe('2024-03-04T09:00') // 앵커의 해는 두고 월·일만 바뀐다
    expect(hasOccurrenceAt(plan.update, next.start)).toBe(true)
    expect(hasOccurrenceAt(plan.update, '2028-03-04T09:00')).toBe(true)
    expect(isScopeSafe(yearlyMar1, instance, { start: '2029-02-29T09:00' }, 'all')).toBe(false)
    expect(isScopeSafe(yearlyMar1, instance, { start: '2029-02-28T09:00' }, 'all')).toBe(false) // 윤년 여부에 따라 일수 차이가 달라 종료일이 어긋난다
  })

  // 28단계 3차 심사: 같은 해 안에서 2월 말 ↔ 3월 초로 옮기면 종료일이 윤년 2월 말에 걸려 마지막 회차가 잘렸다
  it('매년 2/28 → 3/1 이동은 이후·전체를 막고 이 일정만은 허용한다(종료일이 윤년 2월 말인 시리즈)', () => {
    const feb28: CalendarEvent = { ...weeklyMonday, start: '2026-02-28T09:00', end: '2026-02-28T10:00', recurrence: { freq: 'yearly', interval: 1, until: '2032-02-28' } }
    const instance = instanceOn(feb28, '2027-02-28')
    const next = { start: '2027-03-01T09:00', end: '2027-03-01T10:00' }
    expect(planRecurringMove(feb28, instance, next, 'all')).toBeNull()
    expect(planRecurringMove(feb28, instance, next, 'following')).toBeNull()
    expect(planRecurringMove(feb28, instance, next, 'this')).not.toBeNull()
  })
})



// 속성 검사: 안전하다고 판정돼 계획이 만들어진 모든 이동은 ① 놓은 자리에 회차가 있고 ② 유한 시리즈의 총 회차 수가 보존된다.
// 28단계 심사의 오라클을 단위 테스트로 옮긴 것 — 월·연 경계 넘김, 말일·윤일 앵커, 제외일·종료일·횟수 제한을 모두 훑는다
describe('planRecurringMove — 속성 검사(매달·매년)', () => {
  const WIDE_START = parseDateKey('2024-01-01')
  const WIDE_END = endOfDay(parseDateKey('2031-12-31'))
  const count = (event: CalendarEvent) => expandRecurrence(event, WIDE_START, WIDE_END).length
  const occurrences = (event: CalendarEvent) => expandRecurrence(event, WIDE_START, WIDE_END)

  const base: CalendarEvent = { id: 'p', title: '속성', allDay: false, start: '2026-01-01T09:00', end: '2026-01-01T10:00' }
  const series: CalendarEvent[] = []
  for (const day of [1, 15, 28, 29, 30, 31]) {
    const start = `2026-01-${String(day).padStart(2, '0')}T09:00`
    const end = `2026-01-${String(day).padStart(2, '0')}T10:00`
    const rule = { freq: 'monthly', interval: 1 } as const
    series.push({ ...base, start, end, recurrence: { ...rule, count: 8 } })
    series.push({ ...base, start, end, recurrence: { ...rule, until: '2026-12-31' } })
    series.push({ ...base, start, end, recurrence: rule, excludedDates: [`2026-03-${String(Math.min(day, 28)).padStart(2, '0')}`] })
  }
  for (const [m, d] of [[2, 28], [3, 1], [12, 31], [1, 1], [2, 29]] as const) {
    const year = d === 29 ? 2024 : 2025
    const start = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T09:00`
    const end = start.replace('T09:00', 'T10:00')
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, count: 5 } })
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, until: '2029-12-31' } })
    // 종료일이 윤년 2월 말·평년 2월 말에 걸리는 경우(3차 심사)
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, until: '2028-02-29' } })
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, until: '2029-02-28' } })
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, count: 7 } })
  }
  for (const [m, d] of [[2, 27], [2, 26], [3, 2], [3, 4]] as const) {
    const start = `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T09:00`
    const end = start.replace('T09:00', 'T10:00')
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, until: '2032-02-28' } })
    series.push({ ...base, start, end, recurrence: { freq: 'yearly', interval: 1, count: 7 } })
  }

  it('안전한 이동은 모든 범위에서 놓은 자리에 회차가 있고, 유한 시리즈의 회차 수가 보존된다', () => {
    let planned = 0
    for (const event of series) {
      const all = occurrences(event)
      const picks = [all[0], all[Math.floor(all.length / 2)], all[all.length - 1]].filter(Boolean)
      for (const instance of picks) {
        for (let dayDelta = -6; dayDelta <= 6; dayDelta++) {
          for (const hourDelta of [0, 1]) {
            const startDate = new Date(parseDateKey(instance.start.slice(0, 10)).getTime())
            startDate.setDate(startDate.getDate() + dayDelta)
            const key = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
            const hh = String(9 + hourDelta).padStart(2, '0')
            const next = { start: `${key}T${hh}:00`, end: `${key}T${String(10 + hourDelta).padStart(2, '0')}:00` }
            for (const scope of ['this', 'following', 'all'] as const) {
              const plan = planRecurringMove(event, instance, next, scope)
              if (!plan) continue
              planned += 1
              const label = `${event.recurrence?.freq} ${event.start} ${scope} ${instance.start} → ${next.start}`
              const finite = Boolean(event.recurrence?.count || event.recurrence?.until)
              if (scope === 'all') {
                expect(hasOccurrenceAt(plan.update, next.start), `놓은 자리 누락: ${label}`).toBe(true)
                if (finite) expect(count(plan.update), `회차 수 변화: ${label}`).toBe(count(event))
              } else if (scope === 'following') {
                const target = plan.add ?? plan.update // 첫 회차면 전체와 같아 add가 없다
                expect(hasOccurrenceAt(target, next.start), `놓은 자리 누락: ${label}`).toBe(true)
                if (finite) expect(count(plan.update) + (plan.add ? count(plan.add) : 0), `회차 수 변화: ${label}`).toBe(count(event))
              }
            }
          }
        }
      }
    }
    expect(planned).toBeGreaterThan(1000) // 검사가 실제로 많은 사례를 훑었다
  })
})
