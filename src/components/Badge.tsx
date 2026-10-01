// 숫자 배지: 처음 나타날 때 팝인하고, 숫자가 바뀌면 숫자만 위아래로 굴러 바뀌며, 0이 되면 사라진다(알림 종 등 아이콘 버튼 위에 올려 쓴다)
import { AnimatePresence, motion } from 'motion/react'
import { springSnappy } from '../lib/motion'
import styles from './Badge.module.css'

interface BadgeProps {
  count: number
  className?: string // 아이콘 버튼 크기가 다른 자리(모바일 44px 버튼 등)에서 위치를 보정할 때 넘긴다
}

function Badge({ count, className }: BadgeProps) {
  const label = count > 9 ? '9+' : String(count)
  return (
    <AnimatePresence>
      {count > 0 && (
        // 바깥 알약은 숫자가 바뀌어도 그대로 두고 안의 숫자만 바꾼다 — 예전엔 key={label}이라 알약 전체가 사라졌다 다시 나타나
        // 두 숫자가 같은 자리에서 동시에 크로스페이드됐다(25단계 모션 감사)
        <motion.span
          key="badge"
          className={className ? `${styles.badge} ${className}` : styles.badge}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={springSnappy}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={springSnappy}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export default Badge
