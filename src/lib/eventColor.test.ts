// eventColor.ts 색 우선순위 테스트
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import { FALLBACK_EVENT_COLOR, resolveEventColor, resolveEventTint } from './eventColor'

// 막대 색은 흰색을 --event-bar-lift만큼 섞은 color-mix 문자열이다
const lifted = (base: string) => `color-mix(in oklab, ${base}, white var(--event-bar-lift))`

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: 'e1', title: '일정', allDay: true, start: '2026-09-01', end: '2026-09-01', ...overrides }
}

describe('resolveEventColor', () => {
  it('이벤트 자체 색이 있으면 그걸 쓴다', () => {
    const categoryColor = new Map([['c1', '#0066ff']])
    const event = baseEvent({ color: '#ff0000', categoryId: 'c1' })
    expect(resolveEventColor(event, categoryColor)).toBe(lifted('#ff0000'))
  })

  it('이벤트 색이 없으면 카테고리 색을 쓴다', () => {
    const categoryColor = new Map([['c1', '#0066ff']])
    const event = baseEvent({ categoryId: 'c1' })
    expect(resolveEventColor(event, categoryColor)).toBe(lifted('#0066ff'))
  })

  it('이벤트 색도 카테고리도 없으면 기본 회색을 쓴다', () => {
    expect(resolveEventColor(baseEvent(), new Map())).toBe(lifted(FALLBACK_EVENT_COLOR))
  })
})

describe('resolveEventTint', () => {
  it('일정 색을 캔버스에 불투명하게 섞은 배경을 반환한다(알파가 아니라 격자선이 안 비친다)', () => {
    expect(resolveEventTint('#ff0000')).toBe('color-mix(in srgb, #ff0000 var(--event-tint), var(--color-canvas))')
  })

  it('3자리 hex·CSS 변수 색도 같은 방식으로 처리한다', () => {
    expect(resolveEventTint('#abc')).toContain('#abc var(--event-tint)')
    expect(resolveEventTint(FALLBACK_EVENT_COLOR)).toContain(`${FALLBACK_EVENT_COLOR} var(--event-tint)`)
  })
})
