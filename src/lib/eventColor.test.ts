// eventColor.ts 색 우선순위 테스트
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import { FALLBACK_EVENT_COLOR, resolveEventColor } from './eventColor'

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: 'e1', title: '일정', allDay: true, start: '2026-09-01', end: '2026-09-01', ...overrides }
}

describe('resolveEventColor', () => {
  it('이벤트 자체 색이 있으면 그걸 쓴다', () => {
    const categoryColor = new Map([['c1', '#0066ff']])
    const event = baseEvent({ color: '#ff0000', categoryId: 'c1' })
    expect(resolveEventColor(event, categoryColor)).toBe('#ff0000')
  })

  it('이벤트 색이 없으면 카테고리 색을 쓴다', () => {
    const categoryColor = new Map([['c1', '#0066ff']])
    const event = baseEvent({ categoryId: 'c1' })
    expect(resolveEventColor(event, categoryColor)).toBe('#0066ff')
  })

  it('이벤트 색도 카테고리도 없으면 기본 회색을 쓴다', () => {
    expect(resolveEventColor(baseEvent(), new Map())).toBe(FALLBACK_EVENT_COLOR)
  })
})
