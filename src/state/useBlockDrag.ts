// 주·일 보기 시간 블록을 끌어 옮기거나(이동) 위·아래 끝을 끌어 길이를 바꾸는 훅 — 포인터 처리는 usePointerDrag 코어가 맡고 여기서는 시간 계산·열 측정·자동 스크롤을 한다
import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect } from 'react'
import { autoScrollSpeed, canResizeBlock, columnAtX, isBlockDraggable, moveBlock, resizeBlock, resizeBlockStart } from '../lib/blockDrag'
import { toDateKey } from '../lib/date'
import type { CalendarEvent, EventInstance, ID } from '../types'
import { type PointerSession, usePointerDrag } from './usePointerDrag'

// move=이동, resize=아래 끝(종료 시각), resize-start=위쪽 끝(시작 시각)
export type DragMode = 'move' | 'resize' | 'resize-start'

// 드래그 중 미리보기(고스트)가 그려질 자리
export interface DragPreview {
  eventId: ID
  instanceKey: string // 반복 일정은 같은 eventId의 회차가 여럿이라, 끌고 있는 그 회차만 흐리게 하려면 회차까지 구분해야 한다
  mode: DragMode
  col: number
  start: string
  end: string
}

// 시작할 때 세션에 담는 값 — 이동량은 항상 이 원래 start/end에서 계산한다
interface BlockData {
  mode: DragMode
  instance: EventInstance
  event: CalendarEvent
  start: string
  end: string
  col: number
  cols: { left: number; right: number }[] // 시작할 때 잰 각 열의 가로 범위
  startContentY: number // 스크롤 콘텐츠 기준 시작 y — 자동 스크롤로 스크롤 위치가 변해도 이동량이 어긋나지 않는다
}

interface UseBlockDragOptions {
  scrollRef: RefObject<HTMLDivElement | null>
  days: Date[]
  hourHeight: number
  currentUserId: ID | undefined
  onCommit: (instance: EventInstance, next: { start: string; end: string }, mode: DragMode) => void
  onAbandon?: () => void // 끄는 중에 블록이 사라져(다른 기기의 삭제 재로드 등) 놓기가 블록에 닿지 않아 저장 없이 끝났을 때
}

export function useBlockDrag({ scrollRef, days, hourHeight, currentUserId, onCommit, onAbandon }: UseBlockDragOptions) {
  const compute = useCallback(
    (s: PointerSession<BlockData>, clientX: number, clientY: number): DragPreview => {
      const el = scrollRef.current
      const contentY = el ? clientY - el.getBoundingClientRect().top + el.scrollTop : clientY
      const deltaMin = ((contentY - s.startContentY) / hourHeight) * 60
      const base = { eventId: s.event.id, instanceKey: `${s.event.id}-${s.instance.instanceDate}` }
      if (s.mode === 'resize') return { ...base, mode: 'resize', col: s.col, ...resizeBlock(s.start, s.end, deltaMin) }
      if (s.mode === 'resize-start') return { ...base, mode: 'resize-start', col: s.col, ...resizeBlockStart(s.start, s.end, deltaMin) }
      const col = columnAtX(clientX, s.cols)
      return { ...base, mode: 'move', col, ...moveBlock(s.start, s.end, deltaMin, toDateKey(days[col])) }
    },
    [scrollRef, days, hourHeight],
  )

  const core = usePointerDrag<BlockData, DragPreview>({
    compute,
    isSame: (a, b) => a.col === b.col && a.start === b.start && a.end === b.end,
    hasChange: (s, next) => next.start !== s.start || next.end !== s.end,
    onCommit: (s, next) => onCommit(s.instance, { start: next.start, end: next.end }, s.mode),
    onAbandon,
  })
  const { sessionRef, setDrag, begin } = core
  const isDragging = core.drag !== null

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, instance: EventInstance, col: number, mode: DragMode) => {
      const el = scrollRef.current
      if (!el) return
      begin(e, () => {
        if (!isBlockDraggable(instance.event, currentUserId)) return null
        if (mode !== 'move' && !canResizeBlock(instance.start, instance.end)) return null
        const cols = Array.from(el.querySelectorAll<HTMLElement>('[data-day-column]')).map((c) => {
          const r = c.getBoundingClientRect()
          return { left: r.left, right: r.right }
        })
        return {
          mode,
          instance,
          event: instance.event,
          start: instance.start,
          end: instance.end,
          col,
          cols,
          startContentY: e.clientY - el.getBoundingClientRect().top + el.scrollTop,
        }
      })
    },
    [scrollRef, currentUserId, begin],
  )

  // 포인터가 스크롤 영역 위·아래 가장자리에 있으면 자동으로 스크롤한다(손을 멈춰도 계속). 스크롤이 바뀌면 같은 포인터 위치의 시각도 바뀌므로 미리보기를 다시 계산한다
  useEffect(() => {
    if (!isDragging) return
    let frame = 0
    const tick = () => {
      const s = sessionRef.current
      const el = scrollRef.current
      if (s?.active && !s.cancelled && el) {
        const rect = el.getBoundingClientRect()
        const speed = autoScrollSpeed(s.lastY, rect.top, rect.bottom)
        if (speed !== 0) {
          el.scrollTop += speed
          setDrag(compute(s, s.lastX, s.lastY))
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isDragging, scrollRef, compute, sessionRef, setDrag])

  return {
    drag: core.drag,
    onPointerDown,
    onPointerMove: core.onPointerMove,
    onPointerUp: core.onPointerUp,
    onPointerCancel: core.onPointerCancel,
    onClickCapture: core.onClickCapture,
    onContextMenu: core.onContextMenu,
  }
}
