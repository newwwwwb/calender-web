// 주·일 보기 시간 블록을 끌어 옮기거나(이동) 아래 끝을 끌어 길이를 바꾸는 포인터 처리 훅
import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { canResizeBlock, columnAtX, isBlockDraggable, moveBlock, resizeBlock } from '../lib/blockDrag'
import { toDateKey } from '../lib/date'
import type { CalendarEvent, EventInstance, ID } from '../types'

export type DragMode = 'move' | 'resize'

// 드래그 중 미리보기(고스트)가 그려질 자리
export interface DragPreview {
  eventId: ID
  mode: DragMode
  col: number
  start: string
  end: string
}

interface Session {
  pointerId: number
  pointerType: string
  mode: DragMode
  event: CalendarEvent
  start: string // 시작 시점의 일정 start/end — 이동량은 항상 이 원래 값에서 계산한다
  end: string
  col: number
  cols: { left: number; right: number }[] // 시작할 때 잰 각 열의 가로 범위
  startX: number
  startY: number
  startContentY: number // 스크롤 콘텐츠 기준 시작 y — 자동 스크롤로 스크롤 위치가 변해도 이동량이 어긋나지 않는다
  active: boolean // 임계값을 넘겨 실제 드래그가 시작됐는지
  cancelled: boolean // Esc로 취소됨(손가락·버튼을 뗄 때까지 세션은 남겨 뒤따르는 click을 막는다)
}

// 클릭과 구분하는 이동 거리(px). 이보다 적게 움직이고 놓으면 그냥 클릭(편집기 열기)이다
const DRAG_THRESHOLD = 4

interface UseBlockDragOptions {
  scrollRef: RefObject<HTMLDivElement | null>
  days: Date[]
  hourHeight: number
  currentUserId: ID | undefined
  onCommit: (event: CalendarEvent, next: { start: string; end: string }, mode: DragMode) => void
}

export function useBlockDrag({ scrollRef, days, hourHeight, currentUserId, onCommit }: UseBlockDragOptions) {
  const [drag, setDrag] = useState<DragPreview | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const suppressClickRef = useRef(false)

  const preview = useCallback(
    (s: Session, clientX: number, clientY: number): DragPreview => {
      const el = scrollRef.current
      const contentY = el ? clientY - el.getBoundingClientRect().top + el.scrollTop : clientY
      const deltaMin = ((contentY - s.startContentY) / hourHeight) * 60
      if (s.mode === 'resize') return { eventId: s.event.id, mode: 'resize', col: s.col, ...resizeBlock(s.start, s.end, deltaMin) }
      const col = columnAtX(clientX, s.cols)
      return { eventId: s.event.id, mode: 'move', col, ...moveBlock(s.start, s.end, deltaMin, toDateKey(days[col])) }
    },
    [scrollRef, days, hourHeight],
  )

  // 드래그를 끝낸 뒤 이어지는 click이 편집기를 열지 않게 막는다. click은 pointerup 직후 같은 턴에 오므로 다음 턴에 풀어 둔다
  const finish = useCallback((s: Session) => {
    sessionRef.current = null
    setDrag(null)
    if (s.active || s.cancelled) {
      suppressClickRef.current = true
      setTimeout(() => (suppressClickRef.current = false), 0)
    }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, instance: EventInstance, col: number, mode: DragMode) => {
      const el = scrollRef.current
      if (!el || sessionRef.current || !e.isPrimary || e.button !== 0) return
      if (e.pointerType === 'touch') return // 터치는 길게 눌러서 시작한다(27.3)
      if (!isBlockDraggable(instance.event, currentUserId)) return
      if (mode === 'resize' && !canResizeBlock(instance.start, instance.end)) return
      const columns = Array.from(el.querySelectorAll<HTMLElement>('[data-day-column]')).map((c) => {
        const r = c.getBoundingClientRect()
        return { left: r.left, right: r.right }
      })
      sessionRef.current = {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        mode,
        event: instance.event,
        start: instance.start,
        end: instance.end,
        col,
        cols: columns,
        startX: e.clientX,
        startY: e.clientY,
        startContentY: e.clientY - el.getBoundingClientRect().top + el.scrollTop,
        active: false,
        cancelled: false,
      }
      // 블록 밖으로 포인터가 나가도 이동·놓기를 계속 이 블록이 받는다(없는 환경은 건너뛴다)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [scrollRef, currentUserId],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId || s.cancelled) return
      if (!s.active) {
        if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) <= DRAG_THRESHOLD) return
        s.active = true
      }
      e.stopPropagation() // 드래그 중에는 바깥 SwipeableViewport의 스와이프 판정이 끼어들지 않게
      setDrag(preview(s, e.clientX, e.clientY))
    },
    [preview],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      if (s.active && !s.cancelled) {
        e.stopPropagation()
        const next = preview(s, e.clientX, e.clientY)
        if (next.start !== s.start || next.end !== s.end) onCommit(s.event, { start: next.start, end: next.end }, s.mode)
      }
      finish(s)
    },
    [preview, onCommit, finish],
  )

  const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = sessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    s.cancelled = true
    finish(s)
  }, [finish])

  // 드래그 중 Esc: 원래 자리로 돌린다(포인터를 뗄 때까지 세션은 남겨 click을 막는다)
  useEffect(() => {
    if (!drag) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !sessionRef.current) return
      e.stopPropagation()
      sessionRef.current.cancelled = true
      setDrag(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [drag])

  // 드래그를 끝낸 직후의 click(편집기 열기)을 막는다 — 블록의 onClickCapture에 연결
  const onClickCapture = useCallback((e: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    e.stopPropagation()
    e.preventDefault()
  }, [])

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
}
