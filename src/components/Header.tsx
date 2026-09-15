// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션(월 이동), 보기 전환(월 보기만 동작)
import { addMonths, subMonths } from 'date-fns'
import { formatMonthTitle } from '../lib/date'
import { useCalendar } from '../state/useCalendar'
import styles from './Header.module.css'

const VIEWS = ['월', '주', '일', '목록'] as const

interface HeaderProps {
  onNewEvent?: () => void
}

function Header({ onNewEvent = () => {} }: HeaderProps) {
  const { currentDate, setCurrentDate, setSelectedDate } = useCalendar()

  function goToday() {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  return (
    <header className={styles.header}>
      <span className={styles.title}>캘린더</span>
      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="이전 달"
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
        >
          ‹
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음 달"
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
        >
          ›
        </button>
        <button type="button" className={styles.todayButton} onClick={goToday}>
          오늘
        </button>
        <span className={styles.monthTitle}>{formatMonthTitle(currentDate)}</span>
      </nav>
      <div className={styles.spacer} />
      <button type="button" className={styles.newEventButton} onClick={onNewEvent}>
        + 새 일정
      </button>
      <div className={styles.viewSwitch}>
        {VIEWS.map((view, index) => (
          <button
            key={view}
            type="button"
            className={index === 0 ? styles.viewButtonActive : styles.viewButton}
          >
            {view}
          </button>
        ))}
      </div>
    </header>
  )
}

export default Header
