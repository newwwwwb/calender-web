// 캘린더 반영 실패 버튼(MSG-11, F-08): 교체 항목·만기일 행에서 일정 쓰기에 실패했을 때만 붙는다. 진행 중에는 다시 눌러도 요청하지 않는다
import { useEffect, useRef, useState } from 'react'
import { MSG_11_CALENDAR_RETRY } from '../domain/messages'
import styles from './CalendarRetryButton.module.css'
import ui from './ui.module.css'

interface CalendarRetryButtonProps {
  target: string // 화면낭독기용: 어느 행의 버튼인지("교체 항목 엔진오일", "보험 만기")
  onRetry: () => Promise<void> // 성공하면 훅이 calendarFailed를 지워 이 버튼이 사라진다
}

export default function CalendarRetryButton({ target, onRetry }: CalendarRetryButtonProps) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false) // state는 같은 틱의 두 번째 클릭에 아직 반영되지 않아 ref로 막는다
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function retry() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await onRetry()
    } catch (error) {
      console.error('[carbook] 캘린더 재시도 오류:', error) // 계약상 reject하지 않지만, 하더라도 버튼이 영구히 잠기지 않게 푼다
    }
    inFlight.current = false
    if (mounted.current) setBusy(false) // 성공이면 이미 사라졌다
  }

  // disabled 대신 aria-disabled: 진행 중에도 포커스를 잃지 않는다
  return (
    <button
      type="button"
      className={`${ui.btn} ${ui.dangerOutline} ${styles.retry}`}
      aria-disabled={busy || undefined}
      aria-label={`${MSG_11_CALENDAR_RETRY}, ${target}`}
      onClick={retry}
    >
      <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {MSG_11_CALENDAR_RETRY}
    </button>
  )
}
