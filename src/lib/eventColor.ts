// 일정 렌더링에 쓸 색을 우선순위대로 고른다: 이벤트 자체 색 > 카테고리 색 > 기본 회색
import type { CalendarEvent } from '../types'

export const FALLBACK_EVENT_COLOR = 'var(--color-secondary)'

export function resolveEventColor(event: CalendarEvent, categoryColor: Map<string, string>): string {
  return event.color ?? categoryColor.get(event.categoryId ?? '') ?? FALLBACK_EVENT_COLOR
}

// 일정 블록 배경에 쓸 옅은 tint. hex 색만 알파를 붙일 수 있어서, hex가 아니면(FALLBACK_EVENT_COLOR 같은
// CSS 변수) 안전하게 --color-subtle로 대체한다.
export function resolveEventTint(color: string): string {
  return color.startsWith('#') ? `${color}26` : 'var(--color-subtle)'
}
