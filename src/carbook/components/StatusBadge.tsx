// 교체 항목 상태 배지(components.md 7장): "곧 교체"·"교체 시기 지남". 글자 + 아이콘 모양(시계/느낌표) + 테두리로 구분하고 색은 보조다. 정상은 배지가 없다
import type { ItemStatus } from '../domain/types'
import styles from './StatusBadge.module.css'

export const BADGE_LABEL: Record<Exclude<ItemStatus, 'ok'>, string> = { soon: '곧 교체', overdue: '교체 시기 지남' }

export default function StatusBadge({ status }: { status: Exclude<ItemStatus, 'ok'> }) {
  return (
    <span className={`${styles.badge} ${status === 'overdue' ? styles.overdue : styles.soon}`}>
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {status === 'overdue' ? (
          <>
            <rect x="7.2" y="3.8" width="1.6" height="5" fill="currentColor" />
            <circle cx="8" cy="11.3" r="1" fill="currentColor" />
          </>
        ) : (
          <path d="M8 4v4.4l3 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
      {BADGE_LABEL[status]}
    </span>
  )
}
