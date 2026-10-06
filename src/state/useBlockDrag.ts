// 주·일 보기 시간 블록을 끌어 옮기거나(이동) 아래 끝을 끌어 길이를 바꾸는 포인터 처리 훅
import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { autoScrollSpeed, canResizeBlock, columnAtX, isBlockDraggable, moveBlock, resizeBlock } from '../lib/blockDrag'
import { toDateKey } from '../lib/date'
import type { CalendarEvent, EventInstance, ID } from '../types'

export type DragMode = 'move' | 'resize'

// 드래그 중 미리보기(고스트)가 그려질 자리
export interface DragPreview {
  eventId: ID
  instanceKey: string // 반복 일정은 같은 eventId의 회차가 여럿이라, 끌고 있는 그 회차만 흐리게 하려면 회차까지 구분해야 한다
  mode: DragMode
  col: number
  start: string
  end: string
}

interface Session {
  pointerId: number
  pointerType: string
  mode: DragMode
  instance: EventInstance
  event: CalendarEvent
  start: string // 시작 시점의 일정 start/end — 이동량은 항상 이 원래 값에서 계산한다
  end: string
  col: number
  cols: { left: number; right: number }[] // 시작할 때 잰 각 열의 가로 범위
  startX: number
  startY: number
  startContentY: number // 스크롤 콘텐츠 기준 시작 y — 자동 스크롤로 스크롤 위치가 변해도 이동량이 어긋나지 않는다
  lastX: number // 가장 최근 포인터 위치 — 자동 스크롤 중 포인터가 가만히 있어도 미리보기를 다시 계산하는 데 쓴다
  lastY: number
  pressTimer?: ReturnType<typeof setTimeout> // 터치: 길게 누르기 판정 타이머
  active: boolean // 임계값을 넘겨 실제 드래그가 시작됐는지
  cancelled: boolean // Esc로 취소됨(손가락·버튼을 뗄 때까지 세션은 남겨 뒤따르는 click을 막는다)
}

// 클릭과 구분하는 이동 거리(px). 이보다 적게 움직이고 놓으면 그냥 클릭(편집기 열기)이다
const DRAG_THRESHOLD = 4
// 터치는 길게 눌러야 드래그가 시작된다 — 그 전에 손가락이 움직이면(TOUCH_SLOP) 스크롤·스와이프로 보고 세션을 버린다
const LONG_PRESS_MS = 400
const TOUCH_SLOP = 8

interface UseBlockDragOptions {
  scrollRef: RefObject<HTMLDivElement | null>
  days: Date[]
  hourHeight: number
  currentUserId: ID | undefined
  onCommit: (instance: EventInstance, next: { start: string; end: string }, mode: DragMode) => void
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
      const base = { eventId: s.event.id, instanceKey: `${s.event.id}-${s.instance.instanceDate}` }
      if (s.mode === 'resize') return { ...base, mode: 'resize', col: s.col, ...resizeBlock(s.start, s.end, deltaMin) }
      const col = columnAtX(clientX, s.cols)
      return { ...base, mode: 'move', col, ...moveBlock(s.start, s.end, deltaMin, toDateKey(days[col])) }
    },
    [scrollRef, days, hourHeight],
  )

  // 드래그를 끝낸 뒤 이어지는 click이 편집기를 열지 않게 막는다. click은 pointerup 직후 같은 턴에 오므로 다음 턴에 풀어 둔다
  const finish = useCallback((s: Session) => {
    clearTimeout(s.pressTimer)
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
      // motion의 whileTap이 Enter·Space 키보드 누름에 지어내 보내는 pointerdown(pointerType '', pointerId 0)은 실제 포인터가 아니다
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen' && e.pointerType !== 'touch') return
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
        instance,
        event: instance.event,
        start: instance.start,
        end: instance.end,
        col,
        cols: columns,
        startX: e.clientX,
        startY: e.clientY,
        startContentY: e.clientY - el.getBoundingClientRect().top + el.scrollTop,
        lastX: e.clientX,
        lastY: e.clientY,
        active: false,
        cancelled: false,
      }
      const s = sessionRef.current
      if (e.pointerType === 'touch') {
        s.pressTimer = setTimeout(() => {
          if (sessionRef.current !== s) return
          s.active = true
          setDrag(preview(s, s.lastX, s.lastY))
        }, LONG_PRESS_MS)
      }
      // 블록 밖으로 포인터가 나가도 이동·놓기를 계속 이 블록이 받는다(없는 환경은 건너뛴다)
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        // 이미 끝난 포인터면 던진다 — 캡처 없이도 window 예비 리스너가 놓기를 받는다
      }
    },
    [scrollRef, currentUserId, preview],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId || s.cancelled) return
      s.lastX = e.clientX
      s.lastY = e.clientY
      if (!s.active) {
        const moved = Math.hypot(e.clientX - s.startX, e.clientY - s.startY)
        if (s.pointerType === 'touch') {
          // 길게 누르기 전에 움직였다 = 스크롤·스와이프 — 세션을 버리고 브라우저·SwipeableViewport에 맡긴다
          if (moved > TOUCH_SLOP) {
            clearTimeout(s.pressTimer)
            sessionRef.current = null
          }
          return
        }
        if (moved <= DRAG_THRESHOLD) return
        s.active = true
      }
      e.stopPropagation() // 드래그 중에는 바깥 SwipeableViewport의 스와이프 판정이 끼어들지 않게
      // 스냅 결과가 그대로면 같은 값을 유지해 이동 이벤트마다 그리드 전체가 다시 렌더되지 않게 한다
      const next = preview(s, e.clientX, e.clientY)
      setDrag((prev) => (prev && prev.col === next.col && prev.start === next.start && prev.end === next.end ? prev : next))
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
        if (next.start !== s.start || next.end !== s.end) onCommit(s.instance, { start: next.start, end: next.end }, s.mode)
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

  const isDragging = drag !== null

  // 놓기·취소를 블록이 못 받을 때(드래그 중 다른 기기의 변경이 재로드돼 그 블록이 사라지면 포인터 캡처가 같이 사라진다)의 예비 정리.
  // 정상이면 블록의 핸들러가 먼저 처리해 세션이 이미 없다(React 핸들러는 window 리스너보다 앞선다). 남은 세션은 저장 없이 끝낸다.
  useEffect(() => {
    const end = (e: PointerEvent) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      s.cancelled = true
      finish(s)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      clearTimeout(sessionRef.current?.pressTimer)
    }
  }, [finish])

  // 드래그 중 Esc: 원래 자리로 돌린다(포인터를 뗄 때까지 세션은 남겨 click을 막는다)
  useEffect(() => {
    if (!isDragging) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !sessionRef.current) return
      e.stopPropagation()
      sessionRef.current.cancelled = true
      setDrag(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isDragging])

  // 터치 드래그 중에는 손가락을 따라 화면이 스크롤되지 않게 막는다. 길게 눌러 활성화한 시점에는 아직 스크롤이 시작되지 않아
  // touchmove를 취소할 수 있다(passive: false여야 preventDefault가 먹는다)
  useEffect(() => {
    if (!isDragging || sessionRef.current?.pointerType !== 'touch') return
    const stopScroll = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', stopScroll, { passive: false })
    return () => document.removeEventListener('touchmove', stopScroll)
  }, [isDragging])

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
          setDrag(preview(s, s.lastX, s.lastY))
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isDragging, scrollRef, preview])

  // 길게 누르는 동안 안드로이드 컨텍스트 메뉴가 뜨면 포인터가 취소되므로 막는다
  const onContextMenu = useCallback((e: { preventDefault: () => void }) => {
    if (sessionRef.current?.pointerType === 'touch') e.preventDefault()
  }, [])

  // 드래그를 끝낸 직후의 click(편집기 열기)을 막는다 — 블록의 onClickCapture에 연결
  const onClickCapture = useCallback((e: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    e.stopPropagation()
    e.preventDefault()
  }, [])

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, onContextMenu }
}
