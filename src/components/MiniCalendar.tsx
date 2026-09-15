// 사이드바 미니 캘린더: 작은 월 그리드로 날짜 탐색, 일정 있는 날짜는 점으로 표시
import { useMemo } from 'react'
import { formatMonthTitle, getMonthGrid, stepDate, toDateKey } from '../lib/date'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import styles from './MiniCalendar.module.css'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function MiniCalendar() {
  const { currentDate, selectedDate, shownEvents, setCurrentDate, setSelectedDate } = useCalendar()

  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const instances = useMemo(
    () => expandEventsInRange(shownEvents, grid[0], grid[grid.length - 1]),
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
