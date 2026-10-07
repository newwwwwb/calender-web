// 일정을 옮긴 뒤 새 위치의 블록·칩에 포커스를 돌려주는 훅 — 옮기면 key가 바뀌어 DOM이 새로 만들어지고 포커스가 BODY로 떨어지기 때문
import { useCallback, useEffect, useRef } from 'react'
import type { EventInstance, ID } from '../types'

export interface FocusTarget {
  id: ID
  start: string // 옮긴 뒤 회차의 시작(블록·칩의 data-event-start와 같은 형식)
  title: string // 반복 '이 일정만'·'이후'는 새 일정(id가 다름)이 만들어져 id로는 못 찾으므로 시작+제목으로도 찾는다
}

// 저장·재로드가 이보다 오래 걸리거나 실패하면 요청을 버린다 — 한참 뒤 엉뚱한 때 포커스를 빼앗지 않게
const REQUEST_TTL_MS = 3000

// 블록·칩은 data-event-id·data-event-start·data-event-title을 단다. instances가 바뀔 때마다(저장 뒤 재로드 포함) 요청이 있으면 찾아서 포커스한다
export function useFocusAfterMove(instances: EventInstance[]) {
  const pending = useRef<{ target: FocusTarget; expires: number } | null>(null)

  const request = useCallback((target: FocusTarget) => {
    pending.current = { target, expires: Date.now() + REQUEST_TTL_MS }
  }, [])

  useEffect(() => {
    const p = pending.current
    if (!p) return
    if (Date.now() > p.expires) {
      pending.current = null
      return
    }
    // 포커스가 다른 곳(입력칸·열려 있는 시트)에 있으면 가져오지 않는다. 일정 블록·칩(방금 옮겨져 사라지는 옛 것 포함)이나 BODY일 때만 되돌린다
    const active = document.activeElement
    // 후보는 최신 회차에 실제로 있는 요소만 — 반복 '이 일정만'·'이후'로 기간만 바꾸면 옛 일정의 id·시작이 그대로인 퇴장 중 요소가 id로 먼저 잡힌다
    const live = (el: HTMLElement) => instances.some((i) => i.event.id === el.dataset.eventId && i.start === el.dataset.eventStart)
    if (active && active !== document.body && !active.closest('[data-event-id]')) return
    // 포커스가 이미 목표 요소에 있으면(기간 조절처럼 요소가 유지될 때, 여러 날 칩의 다른 조각을 잡고 있었으면) 그대로 둔다.
    // 단 그 요소가 최신 회차에 실제로 있어야 한다 — 반복 '이 일정만'·'이후'로 기간만 바꾸면 id·시작이 그대로여도 옛 회차는 제외·잘려 퇴장 중인 요소다
    if (
      active instanceof HTMLElement &&
      active.isConnected &&
      active.dataset.eventStart === p.target.start &&
      (active.dataset.eventId === p.target.id || active.dataset.eventTitle === p.target.title) &&
      live(active)
    ) {
      pending.current = null
      return
    }
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-event-id]')).filter((el) => el.dataset.eventStart === p.target.start && live(el))
    const found = candidates.find((el) => el.dataset.eventId === p.target.id) ?? candidates.find((el) => el.dataset.eventTitle === p.target.title)
    if (!found) return // 아직 안 생겼다(저장·재로드 중) — 다음 갱신에서 다시 찾는다
    pending.current = null
    found.focus({ preventScroll: true })
  }, [instances])

  return { request }
}
