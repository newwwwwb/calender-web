// 오버레이 4종(EventEditor/SettingsModal/TodoSheet/SearchDialog)이 공유하는 스크림+다이얼로그 애니메이션 셸.
// 데스크톱은 살짝 커지며 페이드인, 모바일은 들어온 길(아래)로 그대로 나가는 바텀시트로 움직이고
// 손잡이를 끌어서 닫을 수 있다(속도를 이어받아 투사한 위치가 절반을 넘으면 닫힘).
import { motion, useDragControls } from 'motion/react'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { project, springDefault, springSheet } from '../lib/motion'
import { useMediaQuery } from '../state/useMediaQuery'
import styles from './Overlay.module.css'

interface OverlayProps {
  onClose: () => void
  variant?: 'sheet' | 'fullscreen'
  children: ReactNode
}

function Overlay({ onClose, variant = 'sheet', children }: OverlayProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const dragControls = useDragControls()
  const dialogRef = useRef<HTMLDivElement>(null)

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
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: springSheet }
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
        {isMobile && (
          <div
            className={styles.grabber}
            aria-hidden="true"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span />
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  )
}

export default Overlay
