// 주·일 시간 블록과 월 보기 칩의 드래그가 함께 쓰는 포인터 처리 코어: 세션 수명, 임계값·터치 길게 누르기, 캡처, 놓기·취소, click 억제
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react'

// 클릭과 구분하는 이동 거리(px). 이보다 적게 움직이고 놓으면 그냥 클릭(편집기 열기)이다
const DRAG_THRESHOLD = 4
// 터치는 길게 눌러야 드래그가 시작된다 — 그 전에 손가락이 움직이면(TOUCH_SLOP) 스크롤·스와이프로 보고 세션을 버린다
const LONG_PRESS_MS = 400
const TOUCH_SLOP = 8

interface SessionBase {
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  lastX: number // 가장 최근 포인터 위치 — 자동 스크롤 중 포인터가 가만히 있어도 미리보기를 다시 계산하는 데 쓴다
  lastY: number
  pressTimer?: ReturnType<typeof setTimeout> // 터치: 길게 누르기 판정 타이머
  active: boolean // 임계값을 넘겨(터치는 길게 눌러) 실제 드래그가 시작됐는지
  cancelled: boolean // Esc로 취소됨(손가락·버튼을 뗄 때까지 세션은 남겨 뒤따르는 click을 막는다)
}

// 세션 = 코어가 관리하는 값 + 래퍼가 시작할 때 넣는 값(S)
export type PointerSession<S> = SessionBase & S

interface UsePointerDragOptions<S, P> {
  // 포인터 위치 → 미리보기. 래퍼가 세션에 담아 둔 값으로 계산한다
  compute: (session: PointerSession<S>, clientX: number, clientY: number) => P
  // 이동 이벤트마다 같은 미리보기면 같은 객체를 유지해 불필요한 재렌더를 막는다
  isSame: (a: P, b: P) => boolean
  // 놓았을 때 저장할 변화가 있는지(같은 자리에 놓으면 저장하지 않는다)
  hasChange: (session: PointerSession<S>, preview: P) => boolean
  onCommit: (session: PointerSession<S>, preview: P) => void
  onAbandon?: () => void // 끄는 중에 대상이 사라져(다른 기기의 삭제 재로드 등) 놓기가 닿지 않아 저장 없이 끝났을 때
}

export function usePointerDrag<S, P>({ compute, isSame, hasChange, onCommit, onAbandon }: UsePointerDragOptions<S, P>) {
  const [drag, setDrag] = useState<P | null>(null)
  const sessionRef = useRef<PointerSession<S> | null>(null)
  const suppressClickRef = useRef(false)

  // 드래그를 끝낸 뒤 이어지는 click이 편집기를 열지 않게 막는다. click은 pointerup 직후 같은 턴에 오므로 다음 턴에 풀어 둔다
  const finish = useCallback((s: PointerSession<S>) => {
    clearTimeout(s.pressTimer)
    sessionRef.current = null
    setDrag(null)
    if (s.active || s.cancelled) {
      suppressClickRef.current = true
      setTimeout(() => (suppressClickRef.current = false), 0)
    }
  }, [])

  // 래퍼가 대상에 건 onPointerDown에서 부른다. 실제 포인터가 아니거나 이미 진행 중이면 false. makeData가 null을 돌려주면(드래그 불가 대상) 세션을 만들지 않는다
  const begin = useCallback(
    (e: ReactPointerEvent<HTMLElement>, makeData: () => S | null): boolean => {
      if (sessionRef.current || !e.isPrimary || e.button !== 0) return false
      // motion의 whileTap이 Enter·Space 키보드 누름에 지어내 보내는 pointerdown(pointerType '', pointerId 0)은 실제 포인터가 아니다
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen' && e.pointerType !== 'touch') return false
      const data = makeData()
      if (!data) return false
      const s: PointerSession<S> = {
        ...data,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        active: false,
        cancelled: false,
      }
      sessionRef.current = s
      if (e.pointerType === 'touch') {
        s.pressTimer = setTimeout(() => {
          if (sessionRef.current !== s) return
          s.active = true
          setDrag(compute(s, s.lastX, s.lastY))
        }, LONG_PRESS_MS)
      }
      // 대상 밖으로 포인터가 나가도 이동·놓기를 계속 이 대상이 받는다(없는 환경은 건너뛴다)
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        // 이미 끝난 포인터면 던진다 — 캡처 없이도 window 예비 리스너가 놓기를 받는다
      }
      return true
    },
    [compute],
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
      const next = compute(s, e.clientX, e.clientY)
      setDrag((prev) => (prev && isSame(prev, next) ? prev : next))
    },
    [compute, isSame],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      if (s.active && !s.cancelled) {
        e.stopPropagation()
        const next = compute(s, e.clientX, e.clientY)
        if (hasChange(s, next)) onCommit(s, next)
      }
      finish(s)
    },
    [compute, hasChange, onCommit, finish],
  )

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      s.cancelled = true
      finish(s)
    },
    [finish],
  )

  const isDragging = drag !== null

  // 놓기·취소를 대상이 못 받을 때(드래그 중 다른 기기의 변경이 재로드돼 그 대상이 사라지면 포인터 캡처가 같이 사라진다)의 예비 정리.
  // 정상이면 대상의 핸들러가 먼저 처리해 세션이 이미 없다(React 핸들러는 window 리스너보다 앞선다). 남은 세션은 저장 없이 끝낸다.
  useEffect(() => {
    const end = (e: PointerEvent) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      // 실제로 끌고 있었고(Esc 취소가 아니고) 사용자가 놓았는데 저장 없이 끝난 것 — 말없이 원위치로 돌아가면 이유를 알 수 없다
      if (e.type === 'pointerup' && s.active && !s.cancelled) onAbandon?.()
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
  }, [finish, onAbandon])

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

  // 길게 누르는 동안 안드로이드 컨텍스트 메뉴가 뜨면 포인터가 취소되므로 막는다
  const onContextMenu = useCallback((e: { preventDefault: () => void }) => {
    if (sessionRef.current?.pointerType === 'touch') e.preventDefault()
  }, [])

  // 드래그를 끝낸 직후의 click(편집기 열기)을 막는다 — 대상의 onClickCapture에 연결
  const onClickCapture = useCallback((e: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    e.stopPropagation()
    e.preventDefault()
  }, [])

  return { drag, setDrag, sessionRef, begin, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, onContextMenu }
}
