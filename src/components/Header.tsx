// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션(보기별 단위로 이동), 보기 전환, 검색 진입, 로그인
import { formatDayTitle, formatMonthTitle, formatWeekTitle, getWeekDays, stepDate } from '../lib/date'
import { type CalendarView, useCalendar } from '../state/useCalendar'
import AuthButton from './AuthButton'
import styles from './Header.module.css'
import { SearchIcon, SettingsIcon, TodoIcon } from './icons'

const VIEW_OPTIONS: { label: string; value: CalendarView }[] = [
  { label: '월', value: 'month' },
  { label: '주', value: 'week' },
  { label: '일', value: 'day' },
  { label: '목록', value: 'agenda' },
]

function formatTitle(view: CalendarView, currentDate: Date): string {
  switch (view) {
    case 'week': {
      const days = getWeekDays(currentDate)
      return formatWeekTitle(days[0], days[6])
    }
    case 'day':
      return formatDayTitle(currentDate)
    default:
      return formatMonthTitle(currentDate)
  }
}

interface HeaderProps {
  onNewEvent?: () => void
  onSearch?: () => void
  onOpenTodos?: () => void
  onOpenSettings?: () => void
}

function Header({
  onNewEvent = () => {},
  onSearch = () => {},
  onOpenTodos = () => {},
  onOpenSettings = () => {},
}: HeaderProps) {
  const { currentDate, view, setCurrentDate, setSelectedDate, changeView } = useCalendar()

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
          aria-label="이전"
          onClick={() => setCurrentDate(stepDate(view, currentDate, -1))}
        >
          ‹
        </button>
        <span className={styles.monthTitle}>{formatTitle(view, currentDate)}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음"
          onClick={() => setCurrentDate(stepDate(view, currentDate, 1))}
        >
          ›
        </button>
      </nav>
      <div className={styles.spacer} />
      <button type="button" className={styles.todayButton} onClick={goToday}>
        오늘
      </button>
      <div className={styles.viewSwitch}>
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === view ? styles.viewButtonActive : styles.viewButton}
            onClick={() => changeView(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.iconButton} aria-label="검색" onClick={onSearch}>
        <SearchIcon />
      </button>
      <button type="button" className={styles.iconButton} aria-label="설정" onClick={onOpenSettings}>
        <SettingsIcon />
      </button>
      <button type="button" className={styles.todoButton} aria-label="할 일" onClick={onOpenTodos}>
        <TodoIcon />
      </button>
      <button type="button" className={styles.newEventButton} onClick={onNewEvent}>
        + 새 일정
      </button>
      <AuthButton />
    </header>
  )
}

export default Header
