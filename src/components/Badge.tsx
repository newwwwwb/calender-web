// 숫자 배지: 값이 바뀌면 팝인하고, 0이 되면 사라진다(알림 종 등 아이콘 버튼 위에 올려 쓴다)
import { AnimatePresence, motion } from 'motion/react'
import { springDefault } from '../lib/motion'
import styles from './Badge.module.css'

interface BadgeProps {
  count: number
  max?: number
  className?: string // 아이콘 버튼 크기가 다른 자리(모바일 44px 버튼 등)에서 위치를 보정할 때 넘긴다
}

function Badge({ count, max = 9, className }: BadgeProps) {
  const label = count > max ? `${max}+` : String(count)
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={label}
          className={className ? `${styles.badge} ${className}` : styles.badge}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={springDefault}
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export default Badge
