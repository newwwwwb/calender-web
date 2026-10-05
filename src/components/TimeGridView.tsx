// 주/일 보기 공용 시간 그리드: 종일 줄 + 겹침 배치된 시간대 일정
import { endOfDay, startOfDay } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDayLabel, toDateKey } from '../lib/date'
import { getHoliday, holidayLabel } from '../lib/holidays'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { allDaySegmentJoins, layoutOverlapping } from '../lib/layout'
import { chipMotion } from '../lib/motion'
import { ownerColorFor } from '../lib/ownerColor'
import { allDayInstanceCoversDay, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import type { EventInstance } from '../types'
import JointBadge from './JointBadge'
import styles from './TimeGridView.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 48 // px
const MIN_BLOCK_HEIGHT = 16 // px
const TALL_BLOCK_HEIGHT = 36 // px 이상이면 "제목 → 시간" 두 줄로 쓴다(미만이면 한 줄)
// 오늘이 없는 기간을 열면 보통 일정이 시작되는 이 시각부터 보여준다
const DEFAULT_SCROLL_HOUR = 8
// 시각 라벨은 눈금선보다 6px 위에 그려져서(translateY -6px) 눈금에 딱 맞춰 스크롤하면 맨 위 라벨이 반쯤 잘린다
const LABEL_PEEK = 8 // px
const CASCADE_STEP_PCT = 22 // 좁은 열에서 겹치는 일정을 계단식으로 밀어내는 폭(%)
const CASCADE_MIN_WIDTH_PCT = 30 // 5개 이상 겹쳐도 폭이 음수가 되지 않게
// 주/일을 넘길 때마다 그리드가 새로 마운트되므로, 마지막으로 보던 세로 위치를 기억해 이어서 연다
// (iOS 캘린더처럼 스와이프해도 보던 시간대가 유지된다). 처음 열 때만 현재 시각 근처로 맞춘다.
let lastScrollTop: number | null = null
// 직전에 보던 기간에 오늘이 있었는지 — "오늘" 버튼/t 키로 오늘이 있는 기간으로 들어올 때는 기억한 위치가
// 아니라 현재 시각으로 열어야 한다(안 그러면 8시를 보다가 오늘로 돌아와도 빨간 선이 화면 밖에 있다)
let lastRangeHadToday = false

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
  const { selectedDate, shownEvents, categories, currentUserId, sharedCalendars, highlightedEventId, setSelectedDate } = useCalendar()

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
  const isMobile = useMediaQuery(MOBILE_QUERY)
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
    const current = new Date()
    const todayKey = toDateKey(current)
    const hasToday = todayKey >= firstKey && todayKey <= lastKey
    const enteringToday = hasToday && !lastRangeHadToday
    lastRangeHadToday = hasToday
    if (lastScrollTop !== null && !enteringToday) {
      el.scrollTop = lastScrollTop
      return
    }
    const hour = hasToday ? Math.max(current.getHours() - 1, 0) : DEFAULT_SCROLL_HOUR
    el.scrollTop = Math.max(hour * HOUR_HEIGHT - LABEL_PEEK, 0)
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
              aria-label={`${formatDayLabel(day)}${dayKey === todayKey ? ', 오늘' : ''}${getHoliday(dayKey) ? `, ${holidayLabel(getHoliday(dayKey)!)}` : ''}`}
              aria-current={dayKey === todayKey ? 'date' : undefined}
              aria-pressed={dayKey === selectedKey}
              onClick={() => setSelectedDate(day)}
            >
              <span className={styles.dayHeaderLabel}>{['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}</span>
              <span className={dayKey === todayKey ? styles.dayHeaderNumberToday : styles.dayHeaderNumber}>
                {day.getDate()}
              </span>
              {getHoliday(dayKey) && <span className={styles.dayHeaderHoliday}>{holidayLabel(getHoliday(dayKey)!)}</span>}
            </button>
          )
        })}
      </div>

      <div className={styles.allDayRow}>
        <div className={styles.gutter}>종일</div>
        {normalizedDays.map((day, column) => {
          const dayKey = toDateKey(day)
          return (
            <div key={dayKey} className={styles.allDayCell}>
              {/* popLayout: MonthView 칩과 같은 이유(보스 리뷰) — sync 모드면 삭제 중 칸이 잠깐 커졌다 줄어든다 */}
              <AnimatePresence initial={false} mode="popLayout">
                {allDayEventsOnDay(instances, dayKey).map((instance) => {
                  const color = resolveEventColor(instance.event, categoryColor)
                  const { joinLeft, joinRight } = allDaySegmentJoins(instance, dayKey, column, normalizedDays.length)
                  const chipClass = [
                    styles.chip,
                    isPendingForMe(instance) && styles.chipPending,
                    instance.end.slice(0, 10) < todayKey && styles.chipPast,
                    instance.event.id === highlightedEventId && styles.isNew,
                    joinLeft && styles.joinLeft,
                    joinRight && styles.joinRight,
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <motion.button
                      type="button"
                      key={`${instance.event.id}-${instance.instanceDate}`}
                      layout="position"
                      {...chipMotion}
                      className={chipClass}
                      style={{ borderLeftColor: color, backgroundColor: resolveEventTint(color) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(instance)
                      }}
                    >
                      {ownerDot(instance)}
                      {jointBadge(instance)}
                      {instance.event.title}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
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
                {dayKey === todayKey && <div className={styles.nowLine} style={{ top: nowTop }} role="img" aria-label="현재 시각" />}
                <AnimatePresence initial={false}>
                  {positioned.map(({ item, column, columnCount }) => {
                    const startMin = minutesOf(item.start)
                    const endMin = clampedEndMinutes(item)
                    const top = (startMin / 60) * HOUR_HEIGHT
                    const height = Math.max(MIN_BLOCK_HEIGHT, ((endMin - startMin) / 60) * HOUR_HEIGHT)
                    const color = resolveEventColor(item.event, categoryColor)
                    const tint = resolveEventTint(color)
                    // 좁은 열(모바일 7일)에서 겹치는 일정을 열 수만큼 쪼개면 24px 폭이 돼 글자가 한 줄에 한
                    // 글자씩 나왔다 — Google 캘린더처럼 뒤에 오는 일정이 앞 일정 위에 계단식으로 겹치게 한다.
                    // (바탕은 tint가 이미 불투명이라 아래 글자가 비치지 않는다)
                    const cascade = narrow && columnCount > 1
                    const widthPct = cascade ? Math.max(100 - column * CASCADE_STEP_PCT, CASCADE_MIN_WIDTH_PCT) : 100 / columnCount
                    const leftPct = cascade ? column * CASCADE_STEP_PCT : column * widthPct
                    return (
                      // top/height/left/width는 절대 위치라 겹침 재배치가 흔하다 — layout 보간 없이 opacity/scale만 준다(chipMotion)
                      <motion.button
                      type="button"
                        key={`${item.event.id}-${item.instanceDate}`}
                        {...chipMotion}
                        className={[
                          styles.eventBlock,
                          isPendingForMe(item) && styles.chipPending,
                          item.end.slice(0, 10) < todayKey && styles.chipPast,
                          item.event.id === highlightedEventId && styles.isNew,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        data-tall={height >= TALL_BLOCK_HEIGHT ? 'true' : undefined}
                        style={{
                          top,
                          height,
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          borderLeftColor: color,
                          backgroundColor: tint,
                          ...(cascade ? { zIndex: column + 1 } : {}),
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectEvent(item)
                        }}
                      >
                        <span className={styles.eventTime}>{item.start.slice(11, 16)}</span> {ownerDot(item)}
                        {jointBadge(item)}
                        {item.event.title}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default TimeGridView
