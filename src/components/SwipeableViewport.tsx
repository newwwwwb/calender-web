// 월/주/일/목록 보기를 감싸는 컨테이너: 날짜가 바뀌면 이전/다음 방향으로 슬라이드하고
// (헤더 화살표·키보드·미니 캘린더·스와이프 모두 currentDate를 바꾸므로 자동으로 방향이 맞는다),
// 보기 자체가 바뀌면 크로스페이드한다. 모바일(터치/펜)에서는 손가락과 1:1로 끌 수 있고,
// 속도를 투사해 절반 이상 넘어가면 다음/이전으로 커밋하고, 아니면 스프링으로 되돌아온다.
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useRef } from 'react'
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

const COMMIT_RATIO = 0.3 // 뷰포트 폭의 이 비율 이상 투사되면 다음/이전으로 커밋한다

function SwipeableViewport({ view, currentDate, onSwipe, children }: SwipeableViewportProps) {
  const dateKey = toDateKey(currentDate)
  const prevRef = useRef({ view, dateKey })
  const dragControls = useDragControls()
  const velocityRef = useRef(0)

  const isSlide = view === prevRef.current.view && dateKey !== prevRef.current.dateKey
  const direction: 1 | -1 = isSlide && dateKey < prevRef.current.dateKey ? -1 : 1
  prevRef.current = { view, dateKey }

  // 드래그가 방금 끝나 커밋/스냅백 애니메이션에 쓴 속도는 그 전환에만 반영하고, 다음
  // 프로그램적 이동(버튼·키보드)은 다시 속도 0(springDefault 상당)으로 돌아가야 한다.
  const velocity = velocityRef.current
  velocityRef.current = 0

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    dragControls.start(e)
  }

  return (
    <div className={styles.viewport} onPointerDown={handlePointerDown}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={`${view}:${dateKey}`}
          className={styles.pane}
          initial={isSlide ? { x: direction > 0 ? '100%' : '-100%', opacity: 1 } : { x: 0, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={isSlide ? { x: direction > 0 ? '-100%' : '100%', opacity: 1 } : { x: 0, opacity: 0 }}
          transition={{
            x: { type: 'spring', bounce: 0, duration: 0.4, velocity },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragSnapToOrigin
          onDragEnd={(_event, info) => {
            velocityRef.current = info.velocity.x
            const width = window.innerWidth
            const projected = info.offset.x + project(info.velocity.x)
            if (projected < -width * COMMIT_RATIO) onSwipe(1)
            else if (projected > width * COMMIT_RATIO) onSwipe(-1)
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default SwipeableViewport
