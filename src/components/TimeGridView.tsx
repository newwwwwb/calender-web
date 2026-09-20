// 주/일 보기 공용 시간 그리드: 종일 줄 + 겹침 배치된 시간대 일정
import { endOfDay, startOfDay } from 'date-fns'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toDateKey } from '../lib/date'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { layoutOverlapping } from '../lib/layout'
import { ownerColorFor } from '../lib/ownerColor'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import { useMediaQuery } from '../state/useMediaQuery'
import type { EventInstance } from '../types'
import JointBadge from './JointBadge'
import styles from './TimeGridView.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 48 // px
const MIN_BLOCK_HEIGHT = 16 // px
// 오늘이 없는 기간을 열면 보통 일정이 시작되는 이 시각부터 보여준다
const DEFAULT_SCROLL_HOUR = 8
// 주/일을 넘길 때마다 그리드가 새로 마운트되므로, 마지막으로 보던 세로 위치를 기억해 이어서 연다
// (iOS 캘린더처럼 스와이프해도 보던 시간대가 유지된다). 처음 열 때만 현재 시각 근처로 맞춘다.
let lastScrollTop: number | null = null

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
  return instances.filter((i) => allDayInstanceCoversDay(i, dayKey))
}

function timedEventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter((i) => timedInstanceStartsOnDay(i, dayKey))
}

interface TimeGridViewProps {
  days: Date[]
  onSelectEvent?: (instance: EventInstance) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

function TimeGridView({ days, onSelectEvent = () => {}, onCreateEvent = () => {} }: TimeGridViewProps) {
  const { selectedDate, shownEvents, categories, currentUserId, sharedCalendars, setSelectedDate } = useCalendar()

  const normalizedDays = useMemo(() => days.map((d) => startOfDay(d)), [days])
  const instances = useMemo(
    () =>
      expandEventsInRange(
        shownEvents,
        startOfDay(normalizedDays[0]),
        endOfDay(normalizedDays[normalizedDays.length - 1]),
      ),
    [shownEvents, normalizedDays],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 767px)')
  // 모바일 주 보기는 하루가 ~44px라 제목을 한 줄로 자르면 한두 글자만 남는다 — iOS 캘린더처럼 블록 안에서 줄바꿈한다
  const narrow = isMobile && days.length > 1
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const firstKey = toDateKey(normalizedDays[0])
  const lastKey = toDateKey(normalizedDays[normalizedDays.length - 1])
  // 항상 0시에서 열려서 일정이 하나도 안 보이고, 화면 위쪽(헤더·종일 줄)은 스크롤이 안 되는 영역이라
  // "아래로 안 내려가는" 것처럼 느껴졌다 — 오늘이 있으면 지금 시각 바로 위, 아니면 아침부터 보여준다.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (lastScrollTop !== null) {
      el.scrollTop = lastScrollTop
      return
    }
    const current = new Date()
    const todayKey = toDateKey(current)
    const hour = todayKey >= firstKey && todayKey <= lastKey ? Math.max(current.getHours() - 1, 0) : DEFAULT_SCROLL_HOUR
    el.scrollTop = hour * HOUR_HEIGHT
  }, [firstKey, lastKey])

  function ownerDot(instance: EventInstance) {
    const ownerId = instance.event.ownerId
    if (ownerId === undefined || ownerId === currentUserId) return null
    return <span className={styles.ownerDot} style={{ background: ownerColorFor(ownerId, sharedOwnerIds) }} />
  }

  function jointBadge(instance: EventInstance) {
    return (
      <JointBadge
        event={instance.event}
        currentUserId={currentUserId}
        sharedOwnerIds={sharedOwnerIds}
        className={styles.jointBadge}
      />
    )
  }

  // 함께 일정이고 내가 아직 응답 안 했으면 점선으로 눈에 띄게 한다
  function isPendingForMe(instance: EventInstance): boolean {
    return myJointStatus(instance.event, currentUserId) === 'pending'
  }

  const todayKey = toDateKey(now)
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT
  const selectedKey = toDateKey(selectedDate)

  return (
    <div className={narrow ? `${styles.container} ${styles.narrow}` : styles.container}>
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
              {allDayEventsOnDay(instances, dayKey).map((instance) => {
                const color = resolveEventColor(instance.event, categoryColor)
                return (
                  <span
                    key={`${instance.event.id}-${instance.instanceDate}`}
                    className={isPendingForMe(instance) ? `${styles.chip} ${styles.chipPending}` : styles.chip}
                    style={{ borderLeftColor: color, backgroundColor: resolveEventTint(color) }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(instance)
                    }}
                  >
                    {ownerDot(instance)}
                    {jointBadge(instance)}
                    {instance.event.title}
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>

      <div
        ref={scrollRef}
        className={styles.scrollArea}
        onScroll={(e) => {
          lastScrollTop = e.currentTarget.scrollTop
        }}
      >
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
                {dayKey === todayKey && <div className={styles.nowLine} style={{ top: nowTop }} aria-label="현재 시각" />}
                {positioned.map(({ item, column, columnCount }) => {
                  const startMin = minutesOf(item.start)
                  const endMin = clampedEndMinutes(item)
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(MIN_BLOCK_HEIGHT, ((endMin - startMin) / 60) * HOUR_HEIGHT)
                  const widthPct = 100 / columnCount
                  const color = resolveEventColor(item.event, categoryColor)
                  return (
                    <span
                      key={`${item.event.id}-${item.instanceDate}`}
                      className={
                        isPendingForMe(item) ? `${styles.eventBlock} ${styles.chipPending}` : styles.eventBlock
                      }
                      style={{
                        top,
                        height,
                        left: `${column * widthPct}%`,
                        width: `${widthPct}%`,
                        borderLeftColor: color,
                        backgroundColor: resolveEventTint(color),
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(item)
                      }}
                    >
                      <span className={styles.eventTime}>{item.start.slice(11, 16)}</span> {ownerDot(item)}
                      {jointBadge(item)}
                      {item.event.title}
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
