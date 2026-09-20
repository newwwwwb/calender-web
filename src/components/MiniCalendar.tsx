// 사이드바 미니 캘린더: 작은 월 그리드로 날짜 탐색, 일정 있는 날짜는 점으로 표시
import { endOfDay } from 'date-fns'
import { useMemo } from 'react'
import { formatMonthTitle, getMonthGrid, stepDate, toDateKey } from '../lib/date'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import styles from './MiniCalendar.module.css'

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
          ‹
        </button>
        <span className={styles.title}>{formatMonthTitle(currentDate)}</span>
        <button
          type="button"
          className={styles.navButton}
          aria-label="다음 달"
          onClick={() => setCurrentDate(stepDate('month', currentDate, 1))}
        >
          ›
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {grid.map((day) => {
          const dayKey = toDateKey(day)
          const isOutside = dayKey.slice(0, 7) !== currentMonthKey
          const isToday = dayKey === todayKey
          const isSunday = day.getDay() === 0

          const numberClass = isOutside
            ? styles.dayOutside
            : isToday
              ? styles.dayToday
              : isSunday
                ? styles.daySunday
                : styles.day

          return (
            <button
              key={dayKey}
              type="button"
              className={styles.cell}
              onClick={() => selectDay(day)}
              aria-label={dayKey}
              aria-current={dayKey === selectedKey ? 'date' : undefined}
            >
              <span className={dayKey === selectedKey ? styles.daySelected : numberClass}>{day.getDate()}</span>
              <span className={daysWithEvents.has(dayKey) ? styles.dot : styles.dotEmpty} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MiniCalendar
