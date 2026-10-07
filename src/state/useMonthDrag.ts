// 월 보기 일정 칩을 끌어 다른 날 칸에 놓아 날짜를 옮기는 훅 — 포인터 처리는 usePointerDrag 코어가 맡고 여기서는 놓일 칸 판정과 고스트 위치만 한다
import { differenceInCalendarDays } from 'date-fns'
import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useLayoutEffect } from 'react'
import { canMoveEvent } from '../lib/blockDrag'
import { parseDateKey } from '../lib/date'
import { ghostPosition } from '../lib/keyboardMove'
import type { EventInstance, ID } from '../types'
import { type PointerSession, usePointerDrag } from './usePointerDrag'

// 드래그 중 상태: 어느 칸 위에 있는지(강조)와 옮길 일수
export interface MonthDragPreview {
  instanceKey: string // 반복 일정은 같은 eventId의 회차가 여럿이라 회차까지 구분한다 — 다일 종일의 모든 조각이 같은 키라 함께 흐려진다
  targetKey: string // 포인터가 놓인 칸의 날짜 키(칸 밖이면 출발 칸)
  dayDelta: number // 출발 칸 대비 옮길 일수
}

// 시작할 때 세션에 담는 값
interface ChipData {
  instance: EventInstance
  cellKey: string // 칩이 있던 칸의 날짜 키 — 여러 날 일정은 어느 조각을 끌어도 이 칸 기준으로 일수를 잰다
}

interface UseMonthDragOptions {
  ghostRef: RefObject<HTMLElement | null> // 고스트 요소의 ref(뷰가 만든다)
  currentUserId: ID | undefined
  onCommit: (instance: EventInstance, dayDelta: number, targetKey: string) => void
  onAbandon?: () => void
}

// 포인터 아래의 칸 날짜 키. 캡처 때문에 이벤트 대상은 늘 출발 칩이라 좌표로 다시 찾는다(고스트는 pointer-events:none)
function cellKeyAt(x: number, y: number): string | null {
  return document.elementFromPoint?.(x, y)?.closest('[data-day-key]')?.getAttribute('data-day-key') ?? null
}

export function useMonthDrag({ ghostRef, currentUserId, onCommit, onAbandon }: UseMonthDragOptions) {
  const compute = useCallback((s: PointerSession<ChipData>, x: number, y: number): MonthDragPreview => {
    const targetKey = cellKeyAt(x, y) ?? s.cellKey
    return {
      instanceKey: `${s.instance.event.id}-${s.instance.instanceDate}`,
      targetKey,
      dayDelta: differenceInCalendarDays(parseDateKey(targetKey), parseDateKey(s.cellKey)),
    }
  }, [])

  const core = usePointerDrag<ChipData, MonthDragPreview>({
    compute,
    isSame: (a, b) => a.targetKey === b.targetKey,
    hasChange: (_s, next) => next.dayDelta !== 0,
    onCommit: (s, next) => onCommit(s.instance, next.dayDelta, next.targetKey),
    onAbandon,
  })
  const { begin, sessionRef } = core

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, instance: EventInstance, cellKey: string) => {
      begin(e, () => (canMoveEvent(instance.event, currentUserId) ? { instance, cellKey } : null))
    },
    [begin, currentUserId],
  )

  // 포인터를 따라다니는 고스트는 상태가 아니라 DOM으로 직접 옮긴다 — 이동 이벤트마다 월 그리드 전체를 다시 렌더하지 않게.
  // ref는 호출한 뷰가 만들어 고스트 요소에 달고 넘겨 준다(훅이 ref를 만들어 돌려주면 렌더 중 ref 접근으로 분석돼 린트 경고가 난다)
  // 창 가장자리에서는 고스트가 화면 밖으로 나가지 않게 포인터 반대편으로 뒤집는다
  const placeGhost = useCallback(
    (x: number, y: number) => {
      const ghost = ghostRef.current
      if (!ghost) return
      const p = ghostPosition(x, y, ghost.offsetWidth, ghost.offsetHeight, window.innerWidth, window.innerHeight)
      ghost.style.transform = `translate(${p.x}px, ${p.y}px)`
    },
    [ghostRef],
  )
  const isDragging = core.drag !== null
  useLayoutEffect(() => {
    const s = sessionRef.current
    if (isDragging && s) placeGhost(s.lastX, s.lastY) // 처음 나타날 때 마지막 포인터 위치에
  }, [isDragging, sessionRef, placeGhost])
  const coreMove = core.onPointerMove
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      coreMove(e)
      placeGhost(e.clientX, e.clientY)
    },
    [coreMove, placeGhost],
  )

  return {
    drag: core.drag,
    onPointerDown,
    onPointerMove,
    onPointerUp: core.onPointerUp,
    onPointerCancel: core.onPointerCancel,
    onClickCapture: core.onClickCapture,
    onContextMenu: core.onContextMenu,
  }
}
