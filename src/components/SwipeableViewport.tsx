// 월/주/일/목록 보기를 감싸는 컨테이너: 날짜가 바뀌면 이전/다음 방향으로 슬라이드하고
// (헤더 화살표·키보드·미니 캘린더·스와이프 모두 currentDate를 바꾸므로 자동으로 방향이 맞는다),
// 보기 자체가 바뀌면 크로스페이드한다. 모바일(터치/펜)에서는 손가락과 1:1로 끌 수 있고,
// 속도를 투사해 충분히 넘어가면 다음/이전으로 커밋하고, 아니면 스프링으로 되돌아온다.
import { AnimatePresence, motion, useDragControls, type Variants } from 'motion/react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { toDateKey } from '../lib/date'
import { project } from '../lib/motion'
import type { CalendarView } from '../types'
import styles from './SwipeableViewport.module.css'

interface SwipeableViewportProps {
  view: CalendarView
  currentDate: Date
  onSwipe: (delta: 1 | -1) => void
  children: ReactNode
}

// 손가락이 이만큼 움직이기 전에는 가로/세로 어느 쪽 제스처인지 판단하지 않는다(히스테리시스)
const INTENT_THRESHOLD = 10
// 가로 이동이 세로 이동보다 이 배수 이상 커야 스와이프로 본다 — 대각선 스크롤은 세로 스크롤로 둔다
const HORIZONTAL_DOMINANCE = 1.5
// 투사한 위치가 뷰포트 폭의 이 비율을 넘고, 실제로도 최소 거리 이상 끌었을 때만 넘어간다
const COMMIT_RATIO = 0.35
const MIN_COMMIT_OFFSET = 40
// 0.998(일반 스크롤)은 가벼운 플릭도 멀리 던져서 너무 민감했다 — 더 빨리 멈추는 감속을 쓴다
const DECELERATION = 0.99

interface PaneTransition {
  isSlide: boolean
  direction: 1 | -1
  enterX: number | string // 들어오는 패널의 시작 위치
  velocity: number // 스와이프로 넘어온 경우 손가락 속도를 이어받는다
}

// 퇴장 방향은 사라지는 패널이 렌더될 당시가 아니라 "지금" 바뀐 방향이어야 해서 custom으로 넘긴다
const paneVariants: Variants = {
  enter: (t: PaneTransition) => (t.isSlide ? { x: t.enterX, opacity: 1 } : { x: 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (t: PaneTransition) =>
    t.isSlide ? { x: t.direction > 0 ? '-100%' : '100%', opacity: 1 } : { x: 0, opacity: 0 },
}

function SwipeableViewport({ view, currentDate, onSwipe, children }: SwipeableViewportProps) {
  const dateKey = toDateKey(currentDate)
  const dragControls = useDragControls()
  const viewportRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)

  const [shown, setShown] = useState({ view, dateKey })
  const [transition, setTransition] = useState<PaneTransition>({ isSlide: false, direction: 1, enterX: '100%', velocity: 0 })
  // 스와이프로 커밋할 때만 채워져, 바로 다음 전환 한 번에만 쓰인다
  const [handoff, setHandoff] = useState<{ offset: number; width: number; velocity: number } | null>(null)

  // 이전 props와 비교해 렌더 중에 전환 정보를 갱신한다(React의 "props 변화에 맞춰 state 조정" 패턴)
  if (shown.view !== view || shown.dateKey !== dateKey) {
    const isSlide = shown.view === view
    const direction: 1 | -1 = dateKey < shown.dateKey ? -1 : 1
    // 끌던 패널 바로 옆에서 이어 들어오게 해서 드래그와 전환 사이에 틈·점프가 없게 한다
    const enterX = isSlide && handoff ? direction * handoff.width + handoff.offset : direction > 0 ? '100%' : '-100%'
    setShown({ view, dateKey })
    setTransition({ isSlide, direction, enterX, velocity: isSlide && handoff ? handoff.velocity : 0 })
    setHandoff(null)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggedRef.current = false
    startRef.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }
  }

  // 손가락을 대자마자 드래그를 시작하면 세로 스크롤 중에도 패널이 옆으로 끌려 스크롤이 막힌 것처럼
  // 느껴졌다 — 가로 의도가 분명해진 순간에만 드래그를 넘겨준다.
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > INTENT_THRESHOLD && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE) {
      startRef.current = null
      draggedRef.current = true
      dragControls.start(e)
    } else if (Math.abs(dy) > INTENT_THRESHOLD) {
      startRef.current = null
    }
  }

  function clearStart() {
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
          transition={{
            x: { type: 'spring', bounce: 0, duration: 0.4, velocity: transition.velocity },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragSnapToOrigin
          onDragEnd={(_event, info) => {
            const width = viewportRef.current?.offsetWidth || window.innerWidth
            const projected = info.offset.x + project(info.velocity.x, DECELERATION)
            const farEnough = Math.abs(info.offset.x) > MIN_COMMIT_OFFSET
            if (!farEnough || Math.abs(projected) <= width * COMMIT_RATIO) return
            setHandoff({ offset: info.offset.x, width, velocity: info.velocity.x })
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
