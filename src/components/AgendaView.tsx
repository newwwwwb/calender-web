// 목록 보기: 현재 달의 일정을 날짜별로 묶어 시간순으로 나열한다
import { addDays, endOfMonth, startOfMonth } from 'date-fns'
import { useMemo } from 'react'
import { formatDayTitle, parseDateKey, toDateKey } from '../lib/date'
import { getHoliday } from '../lib/holidays'
import { expandEventsInRange } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, EventInstance } from '../types'
import styles from './AgendaView.module.css'

// 종일 일정은 걸치는 모든 날짜에, 시간대 일정은 시작일에만 넣는다 (다른 보기와 동일한 규칙)
function bucketByDay(instances: EventInstance[], monthStartKey: string, monthEndKey: string): Map<string, EventInstance[]> {
  const map = new Map<string, EventInstance[]>()
  function add(dayKey: string, instance: EventInstance) {
    if (dayKey < monthStartKey || dayKey > monthEndKey) return
    const list = map.get(dayKey)
    if (list) list.push(instance)
    else map.set(dayKey, [instance])
  }

  for (const instance of instances) {
    if (!instance.event.allDay) {
      add(instance.start.slice(0, 10), instance)
      continue
    }
    let cursor = instance.start.slice(0, 10)
    const endKey = instance.end.slice(0, 10)
    while (cursor <= endKey) {
      add(cursor, instance)
      cursor = toDateKey(addDays(parseDateKey(cursor), 1))
    }
  }
  return map
}

function compareInDay(a: EventInstance, b: EventInstance): number {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
  return a.start.localeCompare(b.start)
}

interface AgendaViewProps {
  onSelectEvent?: (event: CalendarEvent) => void
}

function AgendaView({ onSelectEvent = () => {} }: AgendaViewProps) {
  const { currentDate, events, categories } = useCalendar()

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const instances = useMemo(() => expandEventsInRange(events, monthStart, monthEnd), [events, monthStart, monthEnd])
  const grouped = useMemo(
    () => bucketByDay(instances, toDateKey(monthStart), toDateKey(monthEnd)),
    [instances, monthStart, monthEnd],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const dayKeys = [...grouped.keys()].sort()

  if (dayKeys.length === 0) {
    return <p className={styles.empty}>이 달에는 일정이 없어요.</p>
  }

  return (
    <div className={styles.container}>
      {dayKeys.map((dayKey) => {
        const holiday = getHoliday(dayKey)
        const dayInstances = [...(grouped.get(dayKey) ?? [])].sort(compareInDay)
        return (
          <section key={dayKey} className={styles.daySection}>
            <h3 className={styles.dayHeading}>
              {formatDayTitle(parseDateKey(dayKey))}
              {holiday && <span className={styles.holidayName}>{holiday.name}</span>}
            </h3>
            <ul className={styles.eventList}>
              {dayInstances.map((instance) => (
                <li key={`${instance.event.id}-${instance.instanceDate}`}>
                  <button
                    type="button"
                    className={styles.eventRow}
                    onClick={() => onSelectEvent(instance.event)}
                  >
                    <span
                      className={styles.dot}
                      style={{ background: categoryColor.get(instance.event.categoryId ?? '') ?? 'var(--color-secondary)' }}
                    />
                    <span className={styles.eventTime}>
                      {instance.event.allDay ? '종일' : instance.start.slice(11, 16)}
                    </span>
                    <span className={styles.eventTitle}>{instance.event.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default AgendaView
