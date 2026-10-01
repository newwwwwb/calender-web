// 월/주/일/목록 보기를 감싸는 컨테이너: 날짜가 바뀌면 이전/다음 방향으로 슬라이드하고
// (헤더 화살표·키보드·미니 캘린더·스와이프 모두 currentDate를 바꾸므로 자동으로 방향이 맞는다),
// 보기 자체가 바뀌면 fade-through(먼저 사라진 뒤 나타남)한다. 모바일(터치/펜)에서는 손가락과 1:1로 끌 수 있고,
// 속도를 투사해 충분히 넘어가면 다음/이전으로 커밋하고, 아니면 스프링으로 되돌아온다.
// 패널마다 자기 x 모션 값을 가진다 — 손을 놓는 순간의 속도를 그대로 이어받아 복귀하고, 새 패널은 직전 패널의
// "지금 위치와 속도"에서 이어 붙어 연타해도 두 패널이 겹치지 않는다.
import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useDragControls,
  useReducedMotion,
  type MotionValue,
  type Variants,
} from 'motion/react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toDateKey } from '../lib/date'
import { project, springFling, springSnappy } from '../lib/motion'
import type { CalendarView } from '../types'
import styles from './SwipeableViewport.module.css'

interface SwipeableViewportProps {
  view: CalendarView
  currentDate: Date
  onSwipe: (delta: 1 | -1) => void
  children: ReactNode
}

// 손가락이 이만큼 움직이기 전에는 가로/세로 어느 쪽 제스처인지 판단하지 않는다(히스테리시스).
// 브라우저의 터치 슬랍(약 10~15px)과 비슷한 값이라 손가락 떨림이 스와이프로 오인되지 않는다.
const INTENT_THRESHOLD = 10
// 판단은 한 번만 내린다: 가로 이동이 세로의 이 배수 이상이면 스와이프, 아니면 세로 스크롤.
// (예전엔 1.5배를 넘지 못하면 판단을 미뤘다가 세로가 10px을 넘는 순간 포기해서, 엄지로 자연스럽게 긋는
//  약간 비스듬한 스와이프가 아무 일도 안 하는 사각지대가 있었다)
const HORIZONTAL_DOMINANCE = 1.2
// 투사한 위치가 뷰포트 폭의 이 비율을 넘고, 실제로도 최소 거리 이상 끌었을 때만 넘어간다
const COMMIT_RATIO = 0.35
const MIN_COMMIT_OFFSET = 40
// 0.998(일반 스크롤)은 가벼운 플릭도 멀리 던져서 너무 민감했다 — 더 빨리 멈추는 감속을 쓴다
const DECELERATION = 0.99

interface PaneTransition {
  isSlide: boolean
  direction: 1 | -1
  enterX: number // 들어오는 패널의 시작 위치: 직전 패널의 현재 위치에서 한 화면 폭 옆
  velocity: number // 직전 패널이 움직이던 속도(손가락 스와이프 직후든 버튼 연타 중이든)를 이어받는다
}

// 퇴장 방향·속도는 사라지는 패널이 렌더될 당시가 아니라 "지금" 바뀐 값이어야 해서 custom으로 넘긴다.
// transition을 prop으로 두면 퇴장 패널은 들어올 때의 (오래된) 속도를 그대로 써서, 스와이프 뒤 버튼으로
// 이동할 때 반대로 튀며 들어오는 패널과 어긋났다 — variants 안에 넣어 둘 다 최신 값을 쓰게 한다.
// velocity가 0이면 키 자체를 뺀다 — velocity: 0을 명시하면 motion이 "지금 속도 상속"을 덮어써서 날아가던 패널이 그 자리에서 멈췄다.
const paneSpring = (velocity: number) => ({
  type: 'spring' as const,
  bounce: 0,
  duration: 0.8,
  ...(velocity ? { velocity } : {}),
})
// 보기 전환(월↔주 등)은 두 패널이 겹친 채 동시에 반투명해져 격자·요일 머리줄이 이중으로 보였다(실측: "월 월", "목 목").
// 나가는 쪽이 먼저 빠르게 사라지고 나서 들어오는 쪽이 나타난다.
const FADE_OUT = { duration: 0.12, ease: 'easeOut' as const }
const FADE_IN = { duration: 0.2, delay: 0.08 }
const paneVariants: Variants = {
  enter: (t: PaneTransition) => (t.isSlide ? { x: t.enterX, opacity: 1 } : { x: 0, opacity: 0, scale: 0.985 }),
  center: (t: PaneTransition) =>
    t.isSlide
      ? { x: 0, opacity: 1, transition: { x: paneSpring(t.velocity) } }
      : { x: 0, opacity: 1, scale: 1, transition: { opacity: FADE_IN, scale: springSnappy } },
  exit: (t: PaneTransition) =>
    t.isSlide
      ? { x: t.direction > 0 ? '-100%' : '100%', opacity: 1, transition: { x: paneSpring(t.velocity) } }
      : { x: 0, opacity: 0, transition: { opacity: FADE_OUT } },
}

function SwipeableViewport({ view, currentDate, onSwipe, children }: SwipeableViewportProps) {
  const dateKey = toDateKey(currentDate)
  const dragControls = useDragControls()
  const viewportRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)

  // 동작 줄이기: 슬라이드는 transform만 꺼져 하드 컷이 됐다(실측) — 슬라이드 대신 fade-through로 바꾼다
  const reduceMotion = useReducedMotion()

  // 패널(키)별 x 모션 값. 나가는 패널은 자기 값을 계속 쥐고 있고, 새 패널은 새 값을 쓴다.
  // ref가 아니라 state에 담는다 — 렌더 중에 읽어야 하는데 ref.current를 렌더에서 읽는 것은 React가 금하는 패턴이다(lint)
  const [paneXs] = useState(() => new Map<string, MotionValue<number>>())
  function paneX(key: string): MotionValue<number> {
    let x = paneXs.get(key)
    if (!x) {
      x = motionValue(0)
      paneXs.set(key, x)
      // 오래된 패널 값 정리(나가는 패널은 최대 몇 개뿐이라 6개면 충분하다)
      if (paneXs.size > 6) paneXs.delete(paneXs.keys().next().value as string)
    }
    return x
  }

  // 패널 폭(= 뷰포트 폭). 새 패널이 직전 패널 옆에 붙을 거리를 렌더 중에 계산해야 해서 state로 들고 있는다
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const el = viewportRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [shown, setShown] = useState({ view, dateKey })
  const [transition, setTransition] = useState<PaneTransition>({ isSlide: false, direction: 1, enterX: 0, velocity: 0 })
  // 스와이프로 커밋할 때만 채워지는 "놓는 순간의 손가락 속도". 모션 값의 getVelocity()는 마지막 갱신 후 ~30ms가 지나면 0을 돌려주는데
  // 놓은 뒤 React가 렌더하기까지 그보다 오래 걸려(실측 ~40ms) 속도가 사라졌다 — 그래서 onDragEnd가 알려 준 값을 따로 들고 간다.
  // 버튼 연타처럼 스프링으로 움직이던 패널은 프레임마다 갱신돼서 getVelocity()가 정확하다.
  const [releaseVelocity, setReleaseVelocity] = useState<number | null>(null)

  // 이전 props와 비교해 렌더 중에 전환 정보를 갱신한다(React의 "props 변화에 맞춰 state 조정" 패턴)
  if (shown.view !== view || shown.dateKey !== dateKey) {
    const isSlide = shown.view === view && !reduceMotion
    const direction: 1 | -1 = dateKey < shown.dateKey ? -1 : 1
    // 직전 패널의 "지금" 위치·속도에서 한 화면 폭 옆으로 이어 붙인다 — 끌던 패널 옆이든(스와이프), 날아가던 패널 옆이든(연타)
    // 두 패널이 같은 거리를 같은 스프링·속도로 움직여 틈도 겹침도 없다(예전엔 항상 화면 밖 '100%'에서 따로 출발해 567px 겹쳤다)
    const previous = paneXs.get(`${shown.view}:${shown.dateKey}`)
    setShown({ view, dateKey })
    setTransition({
      isSlide,
      direction,
      enterX: direction * viewportWidth + (previous?.get() ?? 0),
      velocity: isSlide ? (releaseVelocity ?? previous?.getVelocity() ?? 0) : 0,
    })
    setReleaseVelocity(null)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary) return // 두 번째 손가락이 진행 중인 판정을 덮어쓰지 않게
    draggedRef.current = false
    startRef.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }
  }

  // 손가락을 대자마자 드래그를 시작하면 세로 스크롤 중에도 패널이 옆으로 끌려 스크롤이 막힌 것처럼
  // 느껴졌다 — 가로 의도가 분명해진 순간에만 드래그를 넘겨준다.
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current
    if (!start || !e.isPrimary) return
    const dx = Math.abs(e.clientX - start.x)
    const dy = Math.abs(e.clientY - start.y)
    if (Math.max(dx, dy) <= INTENT_THRESHOLD) return
    startRef.current = null
    if (dx > dy * HORIZONTAL_DOMINANCE) {
      draggedRef.current = true
      dragControls.start(e)
    }
  }

  function clearStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary) return // 둘째 손가락을 떼도 첫 손가락의 진행 중인 판정은 그대로 둔다
    startRef.current = null
  }

  // 스와이프를 끝낸 손가락이 떨어질 때 생기는 click이 시간칸 탭(새 일정)으로 이어지지 않게 막는다
  function handleClickCapture(e: ReactMouseEvent<HTMLDivElement>) {
    if (!draggedRef.current) return
    draggedRef.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearStart}
      onPointerCancel={clearStart}
      onClickCapture={handleClickCapture}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={transition}>
        <motion.div
          key={`${view}:${dateKey}`}
          className={styles.pane}
          custom={transition}
          variants={paneVariants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{ x: paneX(`${view}:${dateKey}`) }}
          drag="x"
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          // dragSnapToOrigin을 쓰면 놓는 순간 반대 방향 복귀가 먼저 시작돼 빠르게 넘겨도 ~50ms 멈칫한 뒤 다시 가속했다
          // (25단계 실측: 1250px/s → 300px/s). 대신 놓는 속도를 직접 이어받아 되돌린다. 커밋하면 아무것도 하지 않는다 —
          // 퇴장 애니메이션이 이 패널의 지금 위치·속도에서 이어받는다.
          onDragEnd={(event, info) => {
            const x = paneX(`${view}:${dateKey}`)
            const snapBack = () => animate(x, 0, { ...springFling, velocity: info.velocity.x })
            // iOS 가장자리 뒤로가기 같은 시스템 제스처가 포인터를 취소한 경우엔 넘기지 않고 제자리로 돌아간다
            if (event.type === 'pointercancel') return snapBack()
            const width = viewportRef.current?.offsetWidth || window.innerWidth
            const projected = info.offset.x + project(info.velocity.x, DECELERATION)
            const farEnough = Math.abs(info.offset.x) > MIN_COMMIT_OFFSET
            if (!farEnough || Math.abs(projected) <= width * COMMIT_RATIO) return snapBack()
            setReleaseVelocity(info.velocity.x)
            onSwipe(projected < 0 ? 1 : -1)
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default SwipeableViewport
