// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션(보기별 단위로 이동), 보기 전환, 검색 진입, 로그인
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { formatDayTitle, formatMonthTitle, formatWeekTitle, getWeekDays, stepDate } from '../lib/date'
import { springDefault } from '../lib/motion'
import { type CalendarView, useCalendar } from '../state/useCalendar'
import { useMediaQuery } from '../state/useMediaQuery'
import AuthButton from './AuthButton'
import styles from './Header.module.css'
import { BellIcon, SearchIcon, SettingsIcon, SidebarIcon, TodoIcon } from './icons'
import MiniCalendar from './MiniCalendar'
import Overlay from './Overlay'

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
  onOpenNotifications?: () => void
  unreadCount?: number
  onToggleSidebar?: () => void // 넘기면(바탕화면 위젯) 헤더 맨 앞에 사이드바 접기/펼치기 버튼을 보인다
  sidebarCollapsed?: boolean
}

function Header({
  onNewEvent = () => {},
  onSearch = () => {},
  onOpenTodos = () => {},
  onOpenSettings = () => {},
  onOpenNotifications = () => {},
  unreadCount = 0,
  onToggleSidebar,
  sidebarCollapsed = false,
}: HeaderProps) {
  const { currentDate, view, currentUserId, setCurrentDate, setSelectedDate, changeView } = useCalendar()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [pickerOpen, setPickerOpen] = useState(false)

  function goToday() {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  const viewOptions = VIEW_OPTIONS.map((option) => (
    <button
      key={option.value}
      type="button"
      className={option.value === view ? styles.viewButtonActive : styles.viewButton}
      aria-pressed={option.value === view}
      onClick={() => changeView(option.value)}
    >
      {option.value === view && <motion.span layoutId="viewPillIndicator" className={styles.indicator} transition={springDefault} />}
      <span className={styles.viewButtonLabel}>{option.label}</span>
    </button>
  ))

  // 모바일(iOS 캘린더 방식): 1줄 큰 월 제목(탭하면 날짜 이동) + 아이콘, 2줄 전체 폭 보기 전환.
  // 이전/다음 화살표는 스와이프가 대신하고, 로그인/로그아웃은 설정 시트로 옮겼다.
  // 날짜 이동 시트는 헤더(backdrop-filter가 fixed의 기준을 바꿈) 밖에 렌더해야 화면 전체를 덮는다.
  if (isMobile) {
    return (
      <>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileRow}>
            <button type="button" className={styles.largeTitle} onClick={() => setPickerOpen(true)} aria-label="날짜 이동">
              <span className={styles.largeTitleText}>{formatMonthTitle(currentDate)}</span>
              <span className={styles.largeTitleChevron} aria-hidden="true">
                ▾
              </span>
            </button>
            <button type="button" className={styles.todayLink} onClick={goToday}>
              오늘
            </button>
            <button type="button" className={styles.iconButton} aria-label="검색" onClick={onSearch}>
              <SearchIcon />
            </button>
            <button type="button" className={styles.iconButton} aria-label="할 일" onClick={onOpenTodos}>
              <TodoIcon />
            </button>
            {currentUserId && (
              <button type="button" className={styles.iconButton} aria-label="알림" onClick={onOpenNotifications}>
                <BellIcon />
                {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
            )}
            <button type="button" className={styles.iconButton} aria-label="설정" onClick={onOpenSettings}>
              <SettingsIcon />
            </button>
          </div>
          <div className={styles.segmented}>{viewOptions}</div>
        </header>
        <AnimatePresence>
          {pickerOpen && (
            <Overlay
              key="date-picker"
              onClose={() => setPickerOpen(false)}
              header={
                <div className={styles.pickerHeader}>
                  <span className={styles.pickerTitle}>날짜 이동</span>
                  <button type="button" className={styles.pickerClose} onClick={() => setPickerOpen(false)} aria-label="닫기">
                    ✕
                  </button>
                </div>
              }
            >
              <MiniCalendar onSelectDay={() => setPickerOpen(false)} />
            </Overlay>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <header className={styles.header}>
      {onToggleSidebar && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label="사이드바"
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={onToggleSidebar}
        >
          <SidebarIcon />
        </button>
      )}
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
      <div className={styles.viewSwitch}>{viewOptions}</div>
      <button type="button" className={styles.iconButton} aria-label="검색" onClick={onSearch}>
        <SearchIcon />
      </button>
      {currentUserId && (
        <button type="button" className={styles.iconButton} aria-label="알림" onClick={onOpenNotifications}>
          <BellIcon />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
      )}
      <button type="button" className={styles.iconButton} aria-label="설정" onClick={onOpenSettings}>
        <SettingsIcon />
      </button>
      <button type="button" className={styles.newEventButton} onClick={onNewEvent}>
        + 새 일정
      </button>
      <AuthButton />
    </header>
  )
}

export default Header
