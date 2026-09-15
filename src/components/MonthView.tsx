// 월 보기: 6주 그리드에 공휴일과 반복 일정을 펼친 이벤트 칩을 렌더링한다
import { useMemo } from 'react'
import { getMonthGrid, toDateKey } from '../lib/date'
import { resolveEventColor } from '../lib/eventColor'
import { getHoliday } from '../lib/holidays'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import type { EventInstance } from '../types'
import styles from './MonthView.module.css'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_VISIBLE_EVENTS = 3

// 종일 일정은 걸치는 모든 날짜에, 시간대 일정은 시작일에만 표시한다 (다른 보기와 동일한 규칙)
function eventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter((i) => allDayInstanceCoversDay(i, dayKey) || timedInstanceStartsOnDay(i, dayKey))
}

interface MonthViewProps {
  onSelectEvent?: (instance: EventInstance) => void
}

function MonthView({ onSelectEvent = () => {} }: MonthViewProps) {
  const { currentDate, selectedDate, events, categories, setSelectedDate } = useCalendar()

  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const instances = useMemo(
    () => expandEventsInRange(events, grid[0], grid[grid.length - 1]),
    [events, grid],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const todayKey = toDateKey(new Date())
  const selectedKey = toDateKey(selectedDate)
  const currentMonthKey = toDateKey(currentDate).slice(0, 7)

  return (
    <div className={styles.container}>
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
          const holiday = getHoliday(dayKey)
          const dayEvents = eventsOnDay(instances, dayKey)
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
          const hiddenCount = dayEvents.length - visibleEvents.length

          const numberClass = isOutside
            ? styles.dayNumberOutside
            : isToday
              ? styles.dayNumberToday
              : isSunday || holiday
                ? styles.dayNumberSunday
                : styles.dayNumber

          return (
            <button
              key={dayKey}
              type="button"
              className={dayKey === selectedKey ? styles.cellSelected : styles.cell}
              onClick={() => setSelectedDate(day)}
            >
              <div className={styles.dayNumberRow}>
                <span className={numberClass}>{day.getDate()}</span>
                {holiday && <span className={styles.holidayName}>{holiday.name}</span>}
              </div>
              {visibleEvents.map((instance) => {
                const color = resolveEventColor(instance.event, categoryColor)
                return (
                  <span
                    key={`${instance.event.id}-${instance.instanceDate}`}
                    className={styles.chip}
                    style={{ borderLeftColor: color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(instance)
                    }}
                  >
                    {instance.event.title}
                  </span>
                )
              })}
              {hiddenCount > 0 && <span className={styles.more}>+{hiddenCount}개</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MonthView
