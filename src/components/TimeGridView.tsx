// 주/일 보기 공용 시간 그리드: 종일 줄 + 겹침 배치된 시간대 일정
import { endOfDay, startOfDay } from 'date-fns'
import { useMemo } from 'react'
import { toDateKey } from '../lib/date'
import { layoutOverlapping } from '../lib/layout'
import { expandEventsInRange } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, EventInstance } from '../types'
import styles from './TimeGridView.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 48 // px
const MIN_BLOCK_HEIGHT = 16 // px

function minutesOf(dateTimeKey: string): number {
  const [h, m] = dateTimeKey.slice(11, 16).split(':').map(Number)
  return h * 60 + m
}

// 자정을 넘어가는 시간대 일정은 시작한 날의 24시까지만 보여준다 (단순화)
function clampedEndMinutes(instance: EventInstance): number {
  const startDay = instance.start.slice(0, 10)
  const endDay = instance.end.slice(0, 10)
  return endDay !== startDay ? 24 * 60 : minutesOf(instance.end)
}

function allDayEventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter(
    (i) => i.event.allDay && i.start.slice(0, 10) <= dayKey && dayKey <= i.end.slice(0, 10),
  )
}

function timedEventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter((i) => !i.event.allDay && i.start.slice(0, 10) === dayKey)
}

interface TimeGridViewProps {
  days: Date[]
  onSelectEvent?: (event: CalendarEvent) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

function TimeGridView({ days, onSelectEvent = () => {}, onCreateEvent = () => {} }: TimeGridViewProps) {
  const { selectedDate, events, categories, setSelectedDate } = useCalendar()

  const normalizedDays = useMemo(() => days.map((d) => startOfDay(d)), [days])
  const instances = useMemo(
    () =>
      expandEventsInRange(
        events,
        startOfDay(normalizedDays[0]),
        endOfDay(normalizedDays[normalizedDays.length - 1]),
      ),
    [events, normalizedDays],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const todayKey = toDateKey(new Date())
  const selectedKey = toDateKey(selectedDate)

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.gutter} />
        {normalizedDays.map((day) => {
          const dayKey = toDateKey(day)
          return (
            <button
              key={dayKey}
              type="button"
              className={dayKey === selectedKey ? styles.dayHeaderSelected : styles.dayHeader}
              onClick={() => setSelectedDate(day)}
            >
              <span className={styles.dayHeaderLabel}>{['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}</span>
              <span className={dayKey === todayKey ? styles.dayHeaderNumberToday : styles.dayHeaderNumber}>
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      <div className={styles.allDayRow}>
        <div className={styles.gutter}>종일</div>
        {normalizedDays.map((day) => {
          const dayKey = toDateKey(day)
          return (
            <div key={dayKey} className={styles.allDayCell}>
              {allDayEventsOnDay(instances, dayKey).map((instance) => (
                <span
                  key={`${instance.event.id}-${instance.instanceDate}`}
                  className={styles.chip}
                  style={{ borderLeftColor: categoryColor.get(instance.event.categoryId ?? '') ?? 'var(--color-secondary)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectEvent(instance.event)
                  }}
                >
                  {instance.event.title}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.hourLabels}>
          {HOURS.map((h) => (
            <div key={h} className={styles.hourLabel} style={{ height: HOUR_HEIGHT }}>
              {h}시
            </div>
          ))}
        </div>
        <div className={styles.days}>
          {normalizedDays.map((day) => {
            const dayKey = toDateKey(day)
            const dayInstances = timedEventsOnDay(instances, dayKey)
            const positioned = layoutOverlapping(
              dayInstances,
              (i) => minutesOf(i.start),
              (i) => clampedEndMinutes(i),
            )

            return (
              <div key={dayKey} className={styles.dayColumn} style={{ height: 24 * HOUR_HEIGHT }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={styles.hourCell}
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => onCreateEvent(day, h)}
                  />
                ))}
                {positioned.map(({ item, column, columnCount }) => {
                  const startMin = minutesOf(item.start)
                  const endMin = clampedEndMinutes(item)
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(MIN_BLOCK_HEIGHT, ((endMin - startMin) / 60) * HOUR_HEIGHT)
                  const widthPct = 100 / columnCount
                  return (
                    <span
                      key={`${item.event.id}-${item.instanceDate}`}
                      className={styles.eventBlock}
                      style={{
                        top,
                        height,
                        left: `${column * widthPct}%`,
                        width: `${widthPct}%`,
                        borderLeftColor: categoryColor.get(item.event.categoryId ?? '') ?? 'var(--color-secondary)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(item.event)
                      }}
                    >
                      <span className={styles.eventTime}>{item.start.slice(11, 16)}</span> {item.event.title}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default TimeGridView
