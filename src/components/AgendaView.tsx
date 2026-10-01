// 목록 보기: 현재 달의 일정을 날짜별로 묶어 시간순으로 나열한다
import { addDays, endOfMonth, startOfMonth } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { formatDayTitle, parseDateKey, toDateKey } from '../lib/date'
import { resolveEventColor } from '../lib/eventColor'
import { getHoliday, holidayLabel, holidaysInMonth } from '../lib/holidays'
import { listItemMotion } from '../lib/motion'
import { ownerColorFor } from '../lib/ownerColor'
import { compareInstancesByTime, expandEventsInRange } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import type { EventInstance } from '../types'
import JointBadge from './JointBadge'
import styles from './AgendaView.module.css'

// 종일 일정은 걸치는 모든 날짜에, 시간대 일정은 시작일에만 넣는다 (다른 보기와 동일한 규칙)
function bucketByDay(
  instances: EventInstance[],
  monthStartKey: string,
  monthEndKey: string,
): Map<string, EventInstance[]> {
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

// 시간 열에 쓸 윗줄·아랫줄 문구. 종일은 여러 날에 걸치면 "1/3일"처럼 며칠째인지, 시간대 일정은 끝나는 시각
// (다른 날에 끝나면 날짜도)을 아랫줄에 붙인다 — 지금까지는 매일 똑같이 "종일"/시작 시각만 보여 구분이 안 됐다.
function timeLabels(instance: EventInstance, dayKey: string): { main: string; sub?: string } {
  const startKey = instance.start.slice(0, 10)
  const endKey = instance.end.slice(0, 10)
  if (instance.event.allDay) {
    if (startKey === endKey) return { main: '종일' }
    const total = Math.round((parseDateKey(endKey).getTime() - parseDateKey(startKey).getTime()) / 86_400_000) + 1
    const index = Math.round((parseDateKey(dayKey).getTime() - parseDateKey(startKey).getTime()) / 86_400_000) + 1
    return { main: '종일', sub: `${index}/${total}일` }
  }
  const endTime = instance.end.slice(11, 16)
  const endLabel =
    endKey === startKey ? endTime : `${Number(endKey.slice(5, 7))}/${Number(endKey.slice(8, 10))} ${endTime}`
  return {
    main: instance.start.slice(11, 16),
    sub: instance.end === instance.start ? undefined : endLabel,
  }
}

interface AgendaViewProps {
  onSelectEvent?: (instance: EventInstance) => void
  onNewEvent?: () => void
}

function AgendaView({ onSelectEvent = () => {}, onNewEvent }: AgendaViewProps) {
  const {
    currentDate,
    shownEvents,
    categories,
    currentUserId,
    sharedCalendars,
    loading,
    highlightedEventId,
    setSelectedDate,
    setCurrentDate,
    setView,
  } = useCalendar()
  const containerRef = useRef<HTMLDivElement>(null)
  const scrolledMonth = useRef<string | null>(null)

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const instances = useMemo(
    () => expandEventsInRange(shownEvents, monthStart, monthEnd),
    [shownEvents, monthStart, monthEnd],
  )
  const grouped = useMemo(
    () => bucketByDay(instances, toDateKey(monthStart), toDateKey(monthEnd)),
    [instances, monthStart, monthEnd],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])
  const sharedOwnerEmail = useMemo(
    () => new Map(sharedCalendars.map((s) => [s.ownerId, s.ownerEmail])),
    [sharedCalendars],
  )

  // 일정이 없는 공휴일도 날짜로 보여준다(월 보기에는 보이는데 목록에서만 빠져 있었다)
  const monthKey = toDateKey(monthStart).slice(0, 7)
  const dayKeys = [...new Set([...grouped.keys(), ...holidaysInMonth(monthKey).map((h) => h.date)])].sort()
  const todayKey = toDateKey(new Date())
  // 이번 달이면 오늘(일정 없는 날이면 그 다음 날짜)이 보이도록 처음 한 번 스크롤한다
  const scrollTargetKey = todayKey.startsWith(monthKey) ? dayKeys.find((k) => k >= todayKey) : undefined

  // scrollIntoView는 상위(슬라이드 중인 패널)까지 밀 수 있어 컨테이너 scrollTop만 직접 맞춘다
  useEffect(() => {
    const container = containerRef.current
    if (loading || !container || scrolledMonth.current === monthKey) return
    scrolledMonth.current = monthKey
    const target = scrollTargetKey && container.querySelector<HTMLElement>(`[data-day="${scrollTargetKey}"]`)
    if (target) container.scrollTop = target.offsetTop - container.offsetTop
  }, [loading, monthKey, scrollTargetKey])

  // 첫 로딩 중에는 비어 보이는 문구 대신 아무것도 그리지 않는다(일정이 있는 달도 "없어요"가 먼저 깜빡였다)
  if (loading) return null

  if (dayKeys.length === 0) {
    return (
      <div className={styles.emptyBox}>
        <p className={styles.empty}>이 달에는 일정이 없어요.</p>
        {onNewEvent && (
          <button type="button" className={styles.emptyAdd} onClick={onNewEvent}>
            일정 추가
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <AnimatePresence initial={false}>
        {dayKeys.map((dayKey) => {
          const holiday = getHoliday(dayKey)
          const dayInstances = [...(grouped.get(dayKey) ?? [])].sort(compareInstancesByTime)
          const isToday = dayKey === todayKey
          return (
            <motion.section
              key={dayKey}
              data-day={dayKey}
              className={dayKey < todayKey ? `${styles.daySection} ${styles.daySectionPast}` : styles.daySection}
              {...listItemMotion}
            >
              <h3 className={styles.dayHeading}>
                <button
                  type="button"
                  className={styles.dayHeadingButton}
                  onClick={() => {
                    // 월 보기 칸을 누를 때와 같이 그날의 일 보기로 넘어간다
                    const day = parseDateKey(dayKey)
                    setSelectedDate(day)
                    setCurrentDate(day)
                    setView('day')
                  }}
                >
                  {formatDayTitle(parseDateKey(dayKey))}
                  {isToday && <span className={styles.todayChip}>오늘</span>}
                  {holiday && <span className={styles.holidayName}>{holidayLabel(holiday)}</span>}
                </button>
              </h3>
              <ul className={styles.eventList}>
                <AnimatePresence initial={false}>
                  {dayInstances.map((instance) => {
                    const ownerId = instance.event.ownerId
                    const isShared = ownerId !== undefined && ownerId !== currentUserId
                    const isPendingForMe = myJointStatus(instance.event, currentUserId) === 'pending'
                    const time = timeLabels(instance, dayKey)
                    return (
                      <motion.li key={`${instance.event.id}-${instance.instanceDate}`} {...listItemMotion}>
                        <button
                          type="button"
                          className={[
                            styles.eventRow,
                            isPendingForMe && styles.eventRowPending,
                            instance.event.id === highlightedEventId && styles.isNew,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => onSelectEvent(instance)}
                        >
                          <span
                            className={styles.dot}
                            style={{
                              background: resolveEventColor(instance.event, categoryColor),
                            }}
                          />
                          <span className={styles.eventTime}>
                            {time.main}
                            {time.sub && <span className={styles.eventTimeSub}>{time.sub}</span>}
                          </span>
                          <span className={styles.eventTitle}>{instance.event.title}</span>
                          <JointBadge
                            event={instance.event}
                            currentUserId={currentUserId}
                            sharedOwnerIds={sharedOwnerIds}
                          />
                          {isShared && (
                            <span
                              className={styles.ownerTag}
                              style={{
                                color: ownerColorFor(ownerId, sharedOwnerIds),
                              }}
                            >
                              {sharedOwnerEmail.get(ownerId) ?? ownerId}
                            </span>
                          )}
                        </button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </motion.section>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default AgendaView
