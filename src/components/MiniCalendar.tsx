// 사이드바 미니 캘린더: 작은 월 그리드로 날짜 탐색, 일정 있는 날짜는 점으로 표시. 월이 바뀌면 제목이 롤되고 그리드가 슬라이드한다.
import { endOfDay } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatDayLabel, formatMonthTitle, getMonthGrid, getWeekDays, stepDate, toDateKey } from '../lib/date'
import { getHoliday } from '../lib/holidays'
import { type PeriodTransition, rollVariants, slideVariants, springSnappy } from '../lib/motion'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import { usePeriodDirection } from '../state/usePeriodDirection'
import { useTodayKey } from '../state/useTodayKey'
import styles from './MiniCalendar.module.css'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 격자 키보드 이동(WAI-ARIA 날짜 선택기 관례): 방향키·Home/End·PageUp/Down이 가리키는 날을 돌려주고, 해당 없는 키면 null.
// 월 이동은 stepDate가 말일로 보정한다(3월 31일 → 2월 28일).
function getKeyboardTarget(key: string, day: Date): Date | null {
  switch (key) {
    case 'ArrowLeft':
      return stepDate('day', day, -1)
    case 'ArrowRight':
      return stepDate('day', day, 1)
    case 'ArrowUp':
      return stepDate('week', day, -1)
    case 'ArrowDown':
      return stepDate('week', day, 1)
    case 'Home':
      return getWeekDays(day)[0]
    case 'End':
      return getWeekDays(day)[6]
    case 'PageUp':
      return stepDate('month', day, -1)
    case 'PageDown':
      return stepDate('month', day, 1)
    default:
      return null
  }
}

interface MiniCalendarProps {
  onSelectDay?: () => void // 날짜를 고른 뒤 호출(모바일 날짜 이동 시트를 닫는 용도)
}

function MiniCalendar({ onSelectDay }: MiniCalendarProps) {
  const { currentDate, selectedDate, shownEvents, setCurrentDate, setSelectedDate } = useCalendar()

  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const instances = useMemo(
    // MonthView와 같은 이유로 endOfDay 필요 — 그렇지 않으면 마지막 칸의 시간대 일정이
    // 점 표시에서 빠진다.
    () => expandEventsInRange(shownEvents, grid[0], endOfDay(grid[grid.length - 1])),
    [shownEvents, grid],
  )
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>()
    for (const day of grid) {
      const dayKey = toDateKey(day)
      if (instances.some((i) => allDayInstanceCoversDay(i, dayKey) || timedInstanceStartsOnDay(i, dayKey))) {
        set.add(dayKey)
      }
    }
    return set
  }, [grid, instances])

  const todayKey = useTodayKey() // 자정이 지나면 오늘 표시가 저절로 넘어가도록 훅으로 읽는다
  const selectedKey = toDateKey(selectedDate)
  const currentMonthKey = toDateKey(currentDate).slice(0, 7)
  const monthTitle = formatMonthTitle(currentDate)
  const direction = usePeriodDirection(currentMonthKey)
  const transition: PeriodTransition = { isSlide: true, direction }
  // Sidebar(항상 마운트)와 모바일 날짜 이동 시트가 동시에 각자 MiniCalendar를 띄울 수 있어 인스턴스별로 구분한다.
  // 월 키도 포함해 그리드 전환 중 겹치는 지난 달과 layoutId가 충돌하지 않게 한다.
  const instanceId = useId()
  const selectedCircleLayoutId = `mini-selected-${instanceId}-${currentMonthKey}`

  // roving tabindex: 격자 전체의 탭 정지는 1개 — 격자 안에 포커스가 있으면 포커스된 날(방향키로 옮긴 칸이 Shift+Tab·Tab의 기준이 되어야
  // 하고, Overlay 트랩도 실제 탭 정지로 끝을 판단한다), 없으면 선택일, 선택일이 이 격자에 없으면 이 달 1일.
  // (다른 달 날짜로 넘어간 선택일이 격자에 없을 때도 Tab으로 들어올 곳이 있어야 한다)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const inGrid = (key: string | null) => key !== null && grid.some((day) => toDateKey(day) === key)
  const activeKey = inGrid(focusedKey) ? focusedKey : inGrid(selectedKey) ? selectedKey : `${currentMonthKey}-01`
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingFocusKey = useRef<string | null>(null) // 달이 바뀐 뒤 새 격자가 그려지면 포커스를 줄 날짜

  // 슬라이드 중에는 지난 달 격자가 퇴장하며 같은 날짜 버튼(다른 달 칸)을 아직 들고 있으므로 data-month로 새 격자 안에서만 찾는다.
  // preventScroll: 입장 중인 격자는 옆으로 밀려 있어, 기본 focus()가 overflow:hidden 프레임을 스크롤해 버린다.
  function focusDayButton(dayKey: string): boolean {
    const button = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-month="${currentMonthKey}"] [data-day="${dayKey}"]`,
    )
    button?.focus({ preventScroll: true })
    return Boolean(button)
  }

  useEffect(() => {
    const key = pendingFocusKey.current
    // 월 이동이 반영된 렌더에서만 처리한다(그 전 렌더에서 지워 버리면 포커스가 사라진다)
    if (key && key.slice(0, 7) === currentMonthKey && focusDayButton(key)) pendingFocusKey.current = null
  })

  function handleCellKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: Date) {
    if (e.altKey || e.ctrlKey || e.metaKey) return // Alt+←(뒤로 가기) 같은 브라우저 단축키는 건드리지 않는다
    const target = getKeyboardTarget(e.key, day)
    if (!target) return
    e.preventDefault() // 방향키·PageUp/Down·Home/End의 페이지 스크롤 방지
    // window의 전역 단축키(←/→ = 본 보기 기간 이동)까지 같이 발동해 미니 캘린더 이동과 겹치므로 여기서 끊는다
    e.stopPropagation()
    const targetKey = toDateKey(target)
    if (targetKey.slice(0, 7) === currentMonthKey) {
      focusDayButton(targetKey)
    } else {
      pendingFocusKey.current = targetKey
      setCurrentDate(target) // 이전/다음 달 버튼과 같은 경로
    }
  }

  function selectDay(day: Date) {
    setSelectedDate(day)
    setCurrentDate(day)
    onSelectDay?.()
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          aria-label="이전 달"
          onClick={() => setCurrentDate(stepDate('month', currentDate, -1))}
        >
          <ChevronLeftIcon size={14} />
        </button>
        <span className={styles.titleFrame}>
          {/* sync 모드 — popLayout은 긴→짧은 제목(10월→9월)에서 퇴장 제목을 잘랐다(Header와 같은 이유) */}
          <AnimatePresence initial={false} custom={transition}>
            <motion.span
              key={monthTitle}
              className={styles.title}
              custom={transition}
              variants={rollVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {monthTitle}
            </motion.span>
          </AnimatePresence>
        </span>
        <button
          type="button"
          className={styles.navButton}
          aria-label="다음 달"
          onClick={() => setCurrentDate(stepDate('month', currentDate, 1))}
        >
          <ChevronRightIcon size={14} />
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.gridFrame}>
        <AnimatePresence mode="popLayout" initial={false} custom={transition}>
          <motion.div
            key={currentMonthKey}
            className={styles.grid}
            data-month={currentMonthKey}
            custom={transition}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {grid.map((day) => {
              const dayKey = toDateKey(day)
              const isOutside = dayKey.slice(0, 7) !== currentMonthKey
              const isToday = dayKey === todayKey
              const isSunday = day.getDay() === 0 || Boolean(getHoliday(dayKey)) // 공휴일도 일요일처럼 빨갛게(월 보기와 같은 규칙)
              const isSaturday = day.getDay() === 6

              const numberClass = isOutside
                ? styles.dayOutside
                : isToday
                  ? styles.dayToday
                  : isSunday
                    ? styles.daySunday
                    : isSaturday
                      ? styles.daySaturday
                      : styles.day

              const isSelected = dayKey === selectedKey
              return (
                <button
                  key={dayKey}
                  type="button"
                  className={styles.cell}
                  data-day={dayKey}
                  tabIndex={dayKey === activeKey ? 0 : -1}
                  onFocus={() => setFocusedKey(dayKey)}
                  onBlur={(e) => {
                    // 격자 안에서 칸끼리 옮길 때는 유지하고, 격자 밖으로 나가면 다시 선택일을 탭 정지로
                    if (!e.currentTarget.closest('[data-month]')?.contains(e.relatedTarget as Node | null)) setFocusedKey(null)
                  }}
                  onClick={() => selectDay(day)}
                  onKeyDown={(e) => handleCellKeyDown(e, day)}
                  aria-label={[
                    formatDayLabel(day),
                    dayKey === todayKey && '오늘',
                    daysWithEvents.has(dayKey) && '일정 있음',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  aria-current={dayKey === todayKey ? 'date' : undefined}
                  aria-pressed={isSelected}
                >
                  <span className={styles.numberWrap}>
                    {isSelected && (
                      <motion.span layoutId={selectedCircleLayoutId} className={styles.selectedCircle} transition={springSnappy} />
                    )}
                    <span className={isSelected ? styles.daySelectedText : numberClass}>{day.getDate()}</span>
                  </span>
                  <span className={daysWithEvents.has(dayKey) ? styles.dot : styles.dotEmpty} />
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default MiniCalendar
