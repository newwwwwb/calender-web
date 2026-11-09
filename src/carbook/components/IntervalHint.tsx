// 추천 주기 안내 상자(MSG-12, F-12): 닫을 수 없고 항상 보이는 읽기 전용 문구. 교체 알림 탭 목록 위와 교체 항목 양식의 주기 칸 위에 쓴다
import { MSG_12_INTERVAL_HINT } from '../domain/messages'
import styles from './IntervalHint.module.css'

export default function IntervalHint() {
  return (
    <p className={styles.hint}>
      <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="9" y="8.5" width="2" height="6" fill="currentColor" />
        <circle cx="10" cy="5.8" r="1.2" fill="currentColor" />
      </svg>
      <span>{MSG_12_INTERVAL_HINT}</span>
    </p>
  )
}
