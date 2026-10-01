// 사이드바 미니 캘린더: 작은 월 그리드로 날짜 탐색, 일정 있는 날짜는 점으로 표시. 월이 바뀌면 제목이 롤되고 그리드가 슬라이드한다.
import { endOfDay } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useMemo } from 'react'
import { formatDayLabel, formatMonthTitle, getMonthGrid, stepDate, toDateKey } from '../lib/date'
import { getHoliday } from '../lib/holidays'
import { type PeriodTransition, rollVariants, slideVariants, springDefault } from '../lib/motion'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import { usePeriodDirection } from '../state/usePeriodDirection'
import styles from './MiniCalendar.module.css'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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

  const todayKey = toDateKey(new Date())
  const selectedKey = toDateKey(selectedDate)
  const currentMonthKey = toDateKey(currentDate).slice(0, 7)
  const monthTitle = formatMonthTitle(currentDate)
  const direction = usePeriodDirection(currentMonthKey)
  const transition: PeriodTransition = { isSlide: true, direction }
  // Sidebar(항상 마운트)와 모바일 날짜 이동 시트가 동시에 각자 MiniCalendar를 띄울 수 있어 인스턴스별로 구분한다.
  // 월 키도 포함해 그리드 전환 중 겹치는 지난 달과 layoutId가 충돌하지 않게 한다.
  const instanceId = useId()
  const selectedCircleLayoutId = `mini-selected-${instanceId}-${currentMonthKey}`

  function selectDay(day: Date) {
    setSelectedDate(day)
    setCurrentDate(day)
    onSelectDay?.()
  }

  return (
    <div className={styles.container}>
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
                  onClick={() => selectDay(day)}
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
                      <motion.span layoutId={selectedCircleLayoutId} className={styles.selectedCircle} transition={springDefault} />
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
