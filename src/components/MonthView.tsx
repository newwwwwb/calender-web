// 월 보기: 6주 그리드에 공휴일과 반복 일정을 펼친 이벤트 칩을 렌더링한다
import { useMemo } from 'react'
import { getMonthGrid, toDateKey } from '../lib/date'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { getHoliday } from '../lib/holidays'
import { ownerColorFor } from '../lib/ownerColor'
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
  const { currentDate, selectedDate, shownEvents, categories, currentUserId, sharedCalendars, setSelectedDate, setCurrentDate, setView } =
    useCalendar()

  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const instances = useMemo(
    () => expandEventsInRange(shownEvents, grid[0], grid[grid.length - 1]),
    [shownEvents, grid],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])

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
              onClick={() => {
                // 날짜를 클릭하면 그날의 일 보기로 바로 넘어간다
                setSelectedDate(day)
                setCurrentDate(day)
                setView('day')
              }}
            >
              <div className={styles.dayNumberRow}>
                <span className={numberClass}>{day.getDate()}</span>
                {holiday && <span className={styles.holidayName}>{holiday.name}</span>}
              </div>
              {visibleEvents.map((instance) => {
                const color = resolveEventColor(instance.event, categoryColor)
                const ownerId = instance.event.ownerId
                const isShared = ownerId !== undefined && ownerId !== currentUserId
                return (
                  <span
                    key={`${instance.event.id}-${instance.instanceDate}`}
                    className={styles.chip}
                    style={{ borderLeftColor: color, backgroundColor: resolveEventTint(color) }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(instance)
                    }}
                  >
                    {isShared && (
                      <span className={styles.ownerDot} style={{ background: ownerColorFor(ownerId, sharedOwnerIds) }} />
                    )}
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
