// 일정 렌더링에 쓸 색을 우선순위대로 고른다: 이벤트 자체 색 > 카테고리 색 > 기본 회색
import type { CalendarEvent } from '../types'

export const FALLBACK_EVENT_COLOR = 'var(--color-secondary)'

export function resolveEventColor(event: CalendarEvent, categoryColor: Map<string, string>): string {
  return event.color ?? categoryColor.get(event.categoryId ?? '') ?? FALLBACK_EVENT_COLOR
}
