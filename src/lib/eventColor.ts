// 일정 렌더링에 쓸 색을 우선순위대로 고른다: 이벤트 자체 색 > 카테고리 색 > 기본 회색
import type { CalendarEvent } from '../types'

export const FALLBACK_EVENT_COLOR = 'var(--color-secondary)'

// 막대·점은 다크에서 어두운 사용자 색(#333 등)이 배경에 묻히므로 흰색을 --event-bar-lift만큼 섞는다(라이트 0%).
// color-mix는 hex·3자리 hex·CSS 변수 어느 것이든 받는다
export function resolveEventColor(event: CalendarEvent, categoryColor: Map<string, string>): string {
  const base = event.color ?? categoryColor.get(event.categoryId ?? '') ?? FALLBACK_EVENT_COLOR
  return `color-mix(in oklab, ${base}, white var(--event-bar-lift))`
}

// 일정 칩·블록 배경: 일정 색을 캔버스에 불투명하게 섞는다. 예전엔 hex에 알파(26)를 붙였는데, 그러면 격자선이 비쳐
// 시간 블록 한가운데를 지나고, 선택한 날(회색 배경) 위에서 색이 탁해지고, 다크에서는 검게 죽었다.
export function resolveEventTint(color: string): string {
  return `color-mix(in srgb, ${color} var(--event-tint), var(--color-canvas))`
}
