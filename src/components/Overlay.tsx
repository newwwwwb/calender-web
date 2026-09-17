// 오버레이 4종(EventEditor/SettingsModal/TodoSheet/SearchDialog)이 공유하는 스크림+다이얼로그 애니메이션 셸.
// 데스크톱은 살짝 커지며 페이드인, 모바일은 들어온 길(아래)로 그대로 나가는 바텀시트로 움직인다.
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { springDefault, springSheet } from '../lib/motion'
import { useMediaQuery } from '../state/useMediaQuery'
import styles from './Overlay.module.css'

interface OverlayProps {
  onClose: () => void
  variant?: 'sheet' | 'fullscreen'
  children: ReactNode
}

function Overlay({ onClose, variant = 'sheet', children }: OverlayProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')

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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        {...dialogMotion}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export default Overlay
