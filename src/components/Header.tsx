// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션(보기별 단위로 이동), 보기 전환, 검색 진입, 로그인
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { formatDayTitle, formatMonthTitle, formatWeekTitle, getWeekDays, stepDate, toDateKey } from '../lib/date'
import { type PeriodTransition, rollVariants, springDefault } from '../lib/motion'
import { type CalendarView, useCalendar } from '../state/useCalendar'
import { useMediaQuery } from '../state/useMediaQuery'
import { usePeriodDirection } from '../state/usePeriodDirection'
import AuthButton from './AuthButton'
import Badge from './Badge'
import styles from './Header.module.css'
import { BellIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon, SettingsIcon, SidebarIcon, TodoIcon } from './icons'
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

  // 기간 제목 롤 방향 계산 — isMobile 분기와 무관하게 항상 호출해야 훅 순서가 어긋나지 않는다.
  const dateKey = toDateKey(currentDate)
  const monthKey = dateKey.slice(0, 7)
  const title = formatTitle(view, currentDate)
  const monthTitle = formatMonthTitle(currentDate)
  const dateDirection = usePeriodDirection(dateKey)
  const monthDirection = usePeriodDirection(monthKey)
  // 데스크톱 제목은 날짜 이동이면 롤, 보기 자체가 바뀌면(월→주 등) 크로스페이드
  // (SwipeableViewport와 같은 "렌더 중 state 조정" 패턴: 이전 view와 비교해 같은 렌더에서 바로 반영한다)
  // title만 보고 갱신하면 월↔목록처럼 같은 제목 문구를 쓰는 view끼리 전환할 때 titleSlide.view가 낡은 채로
  // 남아 다음 실제 제목 변화 때 크로스페이드/롤 판정이 틀렸다(보스 리뷰에서 발견) — view도 함께 비교한다.
  const [titleSlide, setTitleSlide] = useState({ view, title, isSlide: true })
  let isSlide = titleSlide.isSlide
  if (titleSlide.title !== title || titleSlide.view !== view) {
    isSlide = titleSlide.view === view
    setTitleSlide({ view, title, isSlide })
  }
  const titleTransition: PeriodTransition = { isSlide, direction: dateDirection }
  const monthTitleTransition: PeriodTransition = { isSlide: true, direction: monthDirection }

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
              <span className={styles.largeTitleFrame}>
                {/* sync 모드 — 데스크톱 제목과 같은 이유(popLayout은 긴→짧은 제목에서 퇴장 제목이 잘림) */}
                <AnimatePresence initial={false} custom={monthTitleTransition}>
                  <motion.span
                    key={monthTitle}
                    className={styles.largeTitleText}
                    custom={monthTitleTransition}
                    variants={rollVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {monthTitle}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.largeTitleChevron} aria-hidden="true">
                <ChevronDownIcon size={14} />
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
                <Badge count={unreadCount} className={styles.mobileBadge} />
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
              label="날짜 이동"
              onClose={() => setPickerOpen(false)}
              header={
                <div className={styles.pickerHeader}>
                  <h2 className={styles.pickerTitle}>날짜 이동</h2>
                  <button type="button" className={styles.pickerClose} onClick={() => setPickerOpen(false)} aria-label="닫기">
                    <CloseIcon />
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
      {/* ‹ 제목 › 순서(미니 캘린더와 같다). 제목 폭이 바뀔 때(주 보기 최대 26px) 다음 화살표가 커서 밑에서 옮겨가
          연속 클릭이 빗나갔던 문제(2차 보스 리뷰)는 제목 프레임을 보기별 고정 폭으로 두어 막는다(24.11) */}
      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="이전"
          onClick={() => setCurrentDate(stepDate(view, currentDate, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <span className={styles.monthTitleFrame} data-view={view}>
          {/* sync 모드: 두 제목이 같은 grid 칸에 겹쳐 있어 전환 중 프레임이 더 넓은 쪽 폭을 유지한다.
              popLayout은 퇴장 제목을 absolute로 빼면서 프레임이 새 제목 폭으로 줄어 긴 제목이 잘렸다 */}
          <AnimatePresence initial={false} custom={titleTransition}>
            <motion.span
              key={title}
              className={styles.monthTitle}
              custom={titleTransition}
              variants={rollVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {title}
            </motion.span>
          </AnimatePresence>
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음"
          onClick={() => setCurrentDate(stepDate(view, currentDate, 1))}
        >
          <ChevronRightIcon />
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
          <Badge count={unreadCount} />
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
