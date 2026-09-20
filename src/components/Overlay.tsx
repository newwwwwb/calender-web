// 오버레이 4종(EventEditor/SettingsModal/TodoSheet/SearchDialog)이 공유하는 스크림+다이얼로그 애니메이션 셸.
// 데스크톱은 살짝 커지며 페이드인, 모바일은 들어온 길(아래)로 그대로 나가는 바텀시트로 움직이고
// 손잡이·고정 헤더를 끌어서 닫을 수 있다(속도를 이어받아 투사한 위치가 절반을 넘으면 닫힘).
// 손잡이와 헤더는 고정하고 본문만 스크롤하며, 열려 있는 동안 뒤 페이지 스크롤을 잠근다.
import { motion, useDragControls } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { project, springDefault } from '../lib/motion'
import { useMediaQuery } from '../state/useMediaQuery'
import styles from './Overlay.module.css'

interface OverlayProps {
  onClose: () => void
  variant?: 'sheet' | 'fullscreen'
  header?: ReactNode // 스크롤되지 않고 위에 고정되는 영역(제목 줄·상단 바)
  children: ReactNode
}

// 시트가 여러 개 겹쳐도 마지막 하나가 닫힐 때만 스크롤 잠금을 푼다
let scrollLocks = 0

function Overlay({ onClose, variant = 'sheet', header, children }: OverlayProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const dragControls = useDragControls()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = ''
    }
  }, [])

  if (variant === 'fullscreen') {
    return (
      <motion.div
        className={styles.fullscreen}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={springDefault}
      >
        {children}
      </motion.div>
    )
  }

  const dialogMotion = isMobile
    ? // 들어올 때는 손가락 모멘텀이 없으므로 튕기지 않는다(바운스는 던진 뒤에만)
      { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: springDefault }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: springDefault,
      }

  return (
    <motion.div
      className={styles.scrim}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.15 }}
        dragSnapToOrigin
        onDragEnd={(_event, info) => {
          const height = dialogRef.current?.getBoundingClientRect().height ?? 0
          const projected = info.offset.y + project(info.velocity.y)
          if (height > 0 && projected > height / 2) onClose()
        }}
        {...dialogMotion}
      >
        {(isMobile || header) && (
          <div className={styles.top} onPointerDown={isMobile ? (e) => dragControls.start(e) : undefined}>
            {isMobile && (
              <div className={styles.grabber} aria-hidden="true">
                <span />
              </div>
            )}
            {header && <div className={styles.header}>{header}</div>}
          </div>
        )}
        <div className={header ? styles.bodyWithHeader : styles.body}>{children}</div>
      </motion.div>
    </motion.div>
  )
}

export default Overlay
