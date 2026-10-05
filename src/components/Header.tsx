// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션(보기별 단위로 이동), 보기 전환, 검색 진입, 로그인
import { AnimatePresence, motion } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRef, useState } from 'react'
import { formatMonthTitle, formatTitle, stepDate, toDateKey } from '../lib/date'
import { type PeriodTransition, rollVariants, springSnappy } from '../lib/motion'
import { type CalendarView, useCalendar } from '../state/useCalendar'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
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
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [pickerOpen, setPickerOpen] = useState(false)

  // 기간 제목 롤 방향 계산 — isMobile 분기와 무관하게 항상 호출해야 훅 순서가 어긋나지 않는다.
  const dateKey = toDateKey(currentDate)
  const monthKey = dateKey.slice(0, 7)
  const title = formatTitle(view, currentDate)
  const monthTitle = formatMonthTitle(currentDate)
  // 320px 폭에서는 큰 제목이 "2026…"으로 잘려 정작 중요한 월이 사라졌다(실측: 필요 150px, 가능 103px) — 좁으면 연도를 뺀다
  const isNarrow = useMediaQuery('(max-width: 359px)')
  const largeTitle = isNarrow ? monthTitle.replace(/^\d{4}년\s*/, '') : monthTitle
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

  // 오늘이 지금 보는 기간 밖이면 오늘로 돌아가는 방향(과거 ‹ / 미래 ›)을 "오늘" 버튼에 작게 보여준다 — 길을 잃었을 때 어느 쪽인지 알려 준다
  const todayAway = formatTitle(view, new Date()) !== title
  const todayIsInPast = toDateKey(new Date()) < dateKey

  function goToday() {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  // 세그먼트 스크럽(iOS 세그먼트 컨트롤처럼): 누른 채 다른 칸으로 미끄러지면 선택 표시가 따라오고, 손을 떼는 칸으로 바뀐다.
  // 누르기만 하고 떼는 평범한 탭·클릭은 그대로 onClick이 처리한다(키보드도 마찬가지). 손을 뗀 칸이 누른 칸과 다르면 click이 안 생기므로 여기서 바꾼다.
  const [scrubView, setScrubView] = useState<CalendarView | null>(null)
  const pressing = useRef(false)
  const scrubHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button === 0) pressing.current = true
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (!pressing.current) return
      const target = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-view]')
      if (target) setScrubView(target.dataset.view as CalendarView)
    },
    onPointerUp: () => {
      pressing.current = false
      if (scrubView && scrubView !== view) changeView(scrubView)
      setScrubView(null)
    },
    onPointerCancel: () => {
      pressing.current = false
      setScrubView(null)
    },
  }
  const shownView = scrubView ?? view

  const viewOptions = VIEW_OPTIONS.map((option) => (
    <button
      key={option.value}
      type="button"
      data-view={option.value}
      className={option.value === shownView ? styles.viewButtonActive : styles.viewButton}
      aria-pressed={option.value === view}
      onClick={() => changeView(option.value)}
    >
      {option.value === shownView && <motion.span layoutId="viewPillIndicator" className={styles.indicator} transition={springSnappy} />}
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
            <h2 className={styles.mobileHeading}>
            {/* 접근 가능한 이름은 보이는 글자("2026년 10월")를 포함해야 한다 — "날짜 이동"만 있으면 현재 기간을 들을 수 없다(WCAG 2.5.3) */}
            <button type="button" className={styles.largeTitle} onClick={() => setPickerOpen(true)} aria-label={`${monthTitle}, 날짜 이동`}>
              <span className={styles.largeTitleFrame}>
                {/* sync 모드 — 데스크톱 제목과 같은 이유(popLayout은 긴→짧은 제목에서 퇴장 제목이 잘림) */}
                <AnimatePresence initial={false} custom={monthTitleTransition}>
                  <motion.span
                    key={largeTitle}
                    className={styles.largeTitleText}
                    custom={monthTitleTransition}
                    variants={rollVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {largeTitle}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.largeTitleChevron} aria-hidden="true">
                <ChevronDownIcon size={14} />
              </span>
            </button>
            </h2>
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
              <button type="button" className={styles.iconButton} aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}개` : '알림'} onClick={onOpenNotifications}>
                <BellIcon />
                <Badge count={unreadCount} className={styles.mobileBadge} />
              </button>
            )}
            <button type="button" className={styles.iconButton} aria-label="설정" onClick={onOpenSettings}>
              <SettingsIcon />
            </button>
          </div>
          <div className={styles.segmented} {...scrubHandlers}>
            {viewOptions}
          </div>
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
        <h2 className={styles.monthTitleFrame} data-view={view}>
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
        </h2>
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
        {/* 양쪽에 같은 폭의 자리를 잡아 화살표가 나타나도 버튼 폭이 변하지 않는다 */}
        <span className={styles.todaySlot} aria-hidden="true">
          <AnimatePresence initial={false}>
            {todayAway && todayIsInPast && (
              <motion.span key="past" initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 4 }} transition={springSnappy}>
                <ChevronLeftIcon size={12} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        오늘
        <span className={styles.todaySlot} aria-hidden="true">
          <AnimatePresence initial={false}>
            {todayAway && !todayIsInPast && (
              <motion.span key="future" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={springSnappy}>
                <ChevronRightIcon size={12} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>
      <div className={styles.viewSwitch} {...scrubHandlers}>
        {viewOptions}
      </div>
      <button type="button" className={styles.iconButton} aria-label="검색" onClick={onSearch}>
        <SearchIcon />
      </button>
      {currentUserId && (
        <button type="button" className={styles.iconButton} aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}개` : '알림'} onClick={onOpenNotifications}>
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
      <span className={styles.authSlot}>
        <AuthButton />
      </span>
    </header>
  )
}

export default Header
