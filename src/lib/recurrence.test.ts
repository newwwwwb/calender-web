// recurrence.ts 반복 일정 전개 로직 테스트
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import { allDayInstanceCoversDay, expandEventsInRange, expandRecurrence, timedInstanceStartsOnDay } from './recurrence'
import { parseDateKey } from './date'

function range(startKey: string, endKey: string) {
  return [parseDateKey(startKey), parseDateKey(endKey)] as const
}

function baseEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'e1',
    title: '테스트 일정',
    allDay: true,
    start: '2026-09-01',
    end: '2026-09-01',
    ...overrides,
  }
}

describe('반복 없는 일정', () => {
  it('범위와 겹치면 단일 회차를 반환한다', () => {
    const event = baseEvent({ start: '2026-09-10', end: '2026-09-10' })
    const [rs, re] = range('2026-09-01', '2026-09-30')
    expect(expandRecurrence(event, rs, re)).toHaveLength(1)
  })

  it('범위와 겹치지 않으면 빈 배열을 반환한다', () => {
    const event = baseEvent({ start: '2026-08-10', end: '2026-08-10' })
    const [rs, re] = range('2026-09-01', '2026-09-30')
    expect(expandRecurrence(event, rs, re)).toHaveLength(0)
  })
})

describe('매일 반복', () => {
  it('interval=2로 격일 반복한다', () => {
    const event = baseEvent({
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'daily', interval: 2 },
    })
    const [rs, re] = range('2026-09-01', '2026-09-07')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07'])
  })
})

describe('매주 반복', () => {
  it('byWeekday 없이 매주 같은 요일에 반복한다', () => {
    const event = baseEvent({
      start: '2026-09-01', // 화요일
      end: '2026-09-01',
      recurrence: { freq: 'weekly', interval: 1 },
    })
    const [rs, re] = range('2026-09-01', '2026-09-22')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'])
  })

  it('byWeekday로 월/수/금에 반복한다', () => {
    const event = baseEvent({
      start: '2026-09-07', // 월요일
      end: '2026-09-07',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
    })
    const [rs, re] = range('2026-09-07', '2026-09-13')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-07', '2026-09-09', '2026-09-11'])
  })
})

describe('매달 반복 (월말 경계)', () => {
  it('31일에 시작하면 31일이 없는 달은 건너뛴다', () => {
    const event = baseEvent({
      start: '2026-01-31',
      end: '2026-01-31',
      recurrence: { freq: 'monthly', interval: 1 },
    })
    const [rs, re] = range('2026-01-01', '2026-05-31')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    // 2월(28일), 4월(30일)은 31일이 없어 건너뛴다
    expect(dates).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })
})

describe('매년 반복 (윤년 경계)', () => {
  it('2월 29일에 시작하면 윤년이 아닌 해는 건너뛴다', () => {
    const event = baseEvent({
      start: '2024-02-29',
      end: '2024-02-29',
      recurrence: { freq: 'yearly', interval: 1 },
    })
    const [rs, re] = range('2024-01-01', '2028-12-31')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    // 2025~2027은 윤년이 아니라 건너뛰고, 2028년(윤년)에 다시 나타난다
    expect(dates).toEqual(['2024-02-29', '2028-02-29'])
  })
})

describe('until', () => {
  it('until 날짜까지 포함해서 반복한다', () => {
    const event = baseEvent({
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'daily', interval: 1, until: '2026-09-03' },
    })
    const [rs, re] = range('2026-09-01', '2026-09-30')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })
})

describe('count', () => {
  it('count번만 반복한다', () => {
    const event = baseEvent({
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'daily', interval: 1, count: 3 },
    })
    const [rs, re] = range('2026-09-01', '2026-09-30')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })
})

describe('excludedDates', () => {
  it('제외된 회차는 결과에서 빠진다 ("이 일정만 삭제")', () => {
    const event = baseEvent({
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'daily', interval: 1, count: 4 },
      excludedDates: ['2026-09-02'],
    })
    const [rs, re] = range('2026-09-01', '2026-09-30')
    const dates = expandRecurrence(event, rs, re).map((i) => i.start)
    expect(dates).toEqual(['2026-09-01', '2026-09-03', '2026-09-04'])
  })
})

describe('여러 날에 걸친 반복 일정', () => {
  it('start~end 간격을 유지한 채 매주 이동한다', () => {
    const event = baseEvent({
      start: '2026-09-01',
      end: '2026-09-03', // 3일짜리 일정
      recurrence: { freq: 'weekly', interval: 1 },
    })
    const [rs, re] = range('2026-09-01', '2026-09-15')
    const instances = expandRecurrence(event, rs, re)
    expect(instances.map((i) => [i.start, i.end])).toEqual([
      ['2026-09-01', '2026-09-03'],
      ['2026-09-08', '2026-09-10'],
      ['2026-09-15', '2026-09-17'],
    ])
  })
})

describe('expandEventsInRange', () => {
  it('여러 일정을 한 번에 펼쳐서 합친다', () => {
    const events = [
      baseEvent({ id: 'a', start: '2026-09-01', end: '2026-09-01' }),
      baseEvent({ id: 'b', start: '2026-09-10', end: '2026-09-10' }),
      baseEvent({ id: 'c', start: '2026-08-01', end: '2026-08-01' }), // 범위 밖
    ]
    const [rs, re] = range('2026-09-01', '2026-09-30')
    const ids = expandEventsInRange(events, rs, re).map((i) => i.event.id)
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('allDayInstanceCoversDay / timedInstanceStartsOnDay', () => {
  it('종일 일정은 걸치는 모든 날짜를 커버한다', () => {
    const instance = {
      event: baseEvent({ allDay: true, start: '2026-09-01', end: '2026-09-03' }),
      start: '2026-09-01',
      end: '2026-09-03',
      instanceDate: '2026-09-01',
    }
    expect(allDayInstanceCoversDay(instance, '2026-08-31')).toBe(false)
    expect(allDayInstanceCoversDay(instance, '2026-09-01')).toBe(true)
    expect(allDayInstanceCoversDay(instance, '2026-09-02')).toBe(true)
    expect(allDayInstanceCoversDay(instance, '2026-09-03')).toBe(true)
    expect(allDayInstanceCoversDay(instance, '2026-09-04')).toBe(false)
  })

  it('시간대 일정은 시작일에만 표시된다 (여러 날에 걸쳐도)', () => {
    const instance = {
      event: baseEvent({ allDay: false, start: '2026-09-01T22:00', end: '2026-09-02T02:00' }),
      start: '2026-09-01T22:00',
      end: '2026-09-02T02:00',
      instanceDate: '2026-09-01',
    }
    expect(timedInstanceStartsOnDay(instance, '2026-09-01')).toBe(true)
    expect(timedInstanceStartsOnDay(instance, '2026-09-02')).toBe(false)
  })

  it('종일 일정에는 timedInstanceStartsOnDay가, 시간대 일정에는 allDayInstanceCoversDay가 적용되지 않는다', () => {
    const allDayInstance = {
      event: baseEvent({ allDay: true, start: '2026-09-01', end: '2026-09-01' }),
      start: '2026-09-01',
      end: '2026-09-01',
      instanceDate: '2026-09-01',
    }
    const timedInstance = {
      event: baseEvent({ allDay: false, start: '2026-09-01T09:00', end: '2026-09-01T10:00' }),
      start: '2026-09-01T09:00',
      end: '2026-09-01T10:00',
      instanceDate: '2026-09-01',
    }
    expect(timedInstanceStartsOnDay(allDayInstance, '2026-09-01')).toBe(false)
    expect(allDayInstanceCoversDay(timedInstance, '2026-09-01')).toBe(false)
  })
})
