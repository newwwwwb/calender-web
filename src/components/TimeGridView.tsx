// 주/일 보기 공용 시간 그리드: 종일 줄 + 겹침 배치된 시간대 일정
import { endOfDay, startOfDay } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { canResizeBlock, DRAG_BLOCKED_MESSAGE, isBlockDraggable } from '../lib/blockDrag'
import { formatDayLabel, toDateKey } from '../lib/date'
import { getHoliday, holidayLabel } from '../lib/holidays'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { allDaySegmentJoins, allDaySlots, assignAllDayLanes, layoutOverlapping } from '../lib/layout'
import { chipMotion } from '../lib/motion'
import { ownerColorFor } from '../lib/ownerColor'
import { expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { type DragMode, type DragPreview, useBlockDrag } from '../state/useBlockDrag'
import { useCalendar } from '../state/useCalendar'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import { useRecurringMoveSheet } from '../state/useRecurringMoveSheet'
import { useToast } from '../state/useToast'
import type { EventInstance, ID } from '../types'
import JointBadge from './JointBadge'
import RecurrenceScopeDialog from './RecurrenceScopeDialog'
import styles from './TimeGridView.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 48 // px
const MIN_BLOCK_HEIGHT = 16 // px
const TALL_BLOCK_HEIGHT = 36 // px 이상이면 "제목 → 시간" 두 줄로 쓴다(미만이면 한 줄)
// 오늘이 없는 기간을 열면 보통 일정이 시작되는 이 시각부터 보여준다
const DEFAULT_SCROLL_HOUR = 8
// 시각 라벨은 눈금선보다 6px 위에 그려져서(translateY -6px) 눈금에 딱 맞춰 스크롤하면 맨 위 라벨이 반쯤 잘린다
const LABEL_PEEK = 8 // px
// 키보드로 시간칸에 처음 들어올 때(오늘이 아닌 날) 탭 정지를 두는 시각 — 기본 스크롤 위치(8시) 바로 아래라 화면 안에 있다
const DEFAULT_ACTIVE_HOUR = 9
// 위쪽 끝 손잡이는 블록이 이 높이(px) 이상일 때만 둔다 — 짧은 블록은 위·아래 손잡이가 겹쳐 이동으로 잡을 자리가 없어진다
const MIN_TOP_HANDLE_HEIGHT = 24
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

// 시간 블록의 세로 위치·높이(px) — 렌더와 "위로 가려진 일정" 계산이 같은 값을 쓴다
function blockSpan(instance: EventInstance): { top: number; height: number } {
  const startMin = minutesOf(instance.start)
  const endMin = clampedEndMinutes(instance)
  return { top: (startMin / 60) * HOUR_HEIGHT, height: Math.max(MIN_BLOCK_HEIGHT, ((endMin - startMin) / 60) * HOUR_HEIGHT) }
}

// 스크롤 위쪽에 완전히 가려진(아래 끝이 scrollTop 이하인) 블록 — 일부라도 보이면 가려진 것이 아니다
function hiddenAbove<T extends { top: number; height: number }>(blocks: T[], scrollTop: number): T[] {
  return blocks.filter((b) => b.top + b.height <= scrollTop)
}

// 스크린 리더가 읽는 시각: 0 → "오전 12시", 15 → "오후 3시"
function hourLabelKo(hour: number): string {
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시`
}

const instanceKey = (i: EventInstance) => `${i.event.id}-${i.instanceDate}`

function timedEventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter((i) => timedInstanceStartsOnDay(i, dayKey))
}

interface TimeGridViewProps {
  days: Date[]
  onSelectEvent?: (instance: EventInstance) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

function TimeGridView({ days, onSelectEvent = () => {}, onCreateEvent = () => {} }: TimeGridViewProps) {
  const { selectedDate, shownEvents, categories, currentUserId, sharedCalendars, highlightedEventId, setSelectedDate, updateEvent } = useCalendar()
  const { showToast } = useToast()

  const normalizedDays = useMemo(() => days.map((d) => startOfDay(d)), [days])
  // 드래그로 놓은 일정은 저장·재로드가 끝날 때까지 새 위치에 머문다(저장 전 옛 위치로 튀었다가 돌아오지 않게). 끝나면(성공·실패) 해제
  const [overrides, setOverrides] = useState<Record<ID, { start: string; end: string }>>({})
  const effectiveEvents = useMemo(
    () => (Object.keys(overrides).length === 0 ? shownEvents : shownEvents.map((e) => (overrides[e.id] ? { ...e, ...overrides[e.id] } : e))),
    [shownEvents, overrides],
  )
  const instances = useMemo(
    () =>
      expandEventsInRange(
        effectiveEvents,
        startOfDay(normalizedDays[0]),
        endOfDay(normalizedDays[normalizedDays.length - 1]),
      ),
    [effectiveEvents, normalizedDays],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  // 종일 일정은 보이는 기간 전체에서 줄을 한 번 정해 모든 칸에서 같은 줄에 그린다(MonthView와 같은 이유 — lib/layout.ts)
  const allDayInstances = useMemo(() => instances.filter((i) => i.event.allDay), [instances])
  const allDayLanes = useMemo(
    () => assignAllDayLanes(allDayInstances, instanceKey, toDateKey(normalizedDays[0]), toDateKey(normalizedDays[normalizedDays.length - 1])),
    [allDayInstances, normalizedDays],
  )
  // 보이는 기간의 모든 시간 블록 위치(열 번호 포함) — 스크롤 위쪽에 가려진 일정을 세고, 그 일정으로 포커스를 옮기는 데 쓴다(종일 줄은 늘 보이므로 제외)
  const timedBlocks = useMemo(
    () => normalizedDays.flatMap((d, col) => timedEventsOnDay(instances, toDateKey(d)).map((i) => ({ ...blockSpan(i), col }))),
    [instances, normalizedDays],
  )
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  // 모바일 주 보기는 하루가 ~44px라 제목을 한 줄로 자르면 한두 글자만 남는다 — iOS 캘린더처럼 블록 안에서 줄바꿈한다
  const narrow = isMobile && days.length > 1
  const [now, setNow] = useState(() => new Date())
  // 시간칸 roving tabindex: 탭 정지는 활성 칸 하나뿐이고 나머지는 화살표로 옮긴다(칸이 주 보기 168개라 전부 탭 정지로 두면 해롭다).
  // 처음엔 선택한 날(보이는 기간 밖이면 첫 날)의 현재 시각 근처 — 오늘이 아니면 9시
  const [active, setActive] = useState(() => {
    const col = Math.max(normalizedDays.findIndex((d) => toDateKey(d) === toDateKey(selectedDate)), 0)
    return { col, hour: toDateKey(normalizedDays[col]) === toDateKey(now) ? now.getHours() : DEFAULT_ACTIVE_HOUR }
  })
  const activeCol = Math.min(active.col, normalizedDays.length - 1)
  // 스크롤 위쪽에 가려진 일정 수 — 숫자 상태라 스크롤 이벤트마다 호출해도 값이 같으면 렌더되지 않는다
  const [hiddenAboveCount, setHiddenAboveCount] = useState(0)

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

  // 위 효과가 스크롤 위치를 정한 직후, 그리고 일정이 바뀔 때 가려진 개수를 다시 센다
  useLayoutEffect(() => {
    if (scrollRef.current) setHiddenAboveCount(hiddenAbove(timedBlocks, scrollRef.current.scrollTop).length)
  }, [timedBlocks, firstKey, lastKey])

  // 반복 일정을 놓은 뒤의 범위 선택·저장 흐름(월 보기와 공통). 범위를 고르는 동안과 저장이 끝날 때까지 새 위치에 고스트를 유지한다
  const recurringSheet = useRecurringMoveSheet<DragMode>({
    instances,
    currentUserId,
    message: (instance, mode) => (mode === 'move' ? `'${instance.event.title}' 일정을 옮겼어요.` : `'${instance.event.title}' 일정 시간을 바꿨어요.`),
  })
  const pendingMove = recurringSheet.pending
  const openRecurringSheet = recurringSheet.open

  const commitDrag = useCallback(
    (draggedInstance: EventInstance, next: { start: string; end: string }, mode: DragMode) => {
      const dragged = draggedInstance.event
      // 끄는 동안 재로드로 다른 기기의 수정이 들어왔을 수 있어, 눌렀을 때의 스냅숏이 아니라 지금의 최신 일정 위에 시간만 덮는다.
      // 그 사이 지워졌거나 함께 일정으로 바뀌었거나 권한이 회수됐으면 드래그 규칙을 다시 적용해 저장하지 않는다
      const event = shownEvents.find((e) => e.id === dragged.id)
      if (!event || !isBlockDraggable(event, currentUserId)) {
        showToast({ message: DRAG_BLOCKED_MESSAGE })
        return
      }
      if (event.recurrence) {
        // 반복 일정은 범위(이 일정만/이후/전체)를 물은 뒤 저장한다
        openRecurringSheet({ ...draggedInstance, event }, next, mode)
        return
      }
      setOverrides((prev) => ({ ...prev, [event.id]: next }))
      const message = mode === 'move' ? `'${event.title}' 일정을 옮겼어요.` : `'${event.title}' 일정 시간을 바꿨어요.`
      void updateEvent({ ...event, ...next }, { message, previous: event })
        .catch(() => {}) // 저장 뒤 재로드 실패는 저장 실패가 아니다(write가 저장 실패는 이미 토스트로 알린다)
        .finally(() =>
          setOverrides((prev) => {
            if (prev[event.id] !== next) return prev // 그 사이 같은 일정을 다시 끌었으면 새 값을 지우지 않는다
            const rest = { ...prev }
            delete rest[event.id]
            return rest
          }),
        )
    },
    [updateEvent, shownEvents, currentUserId, showToast, openRecurringSheet],
  )
  const abandonDrag = useCallback(() => showToast({ message: DRAG_BLOCKED_MESSAGE }), [showToast])
  const blockDrag = useBlockDrag({ scrollRef, days: normalizedDays, hourHeight: HOUR_HEIGHT, currentUserId, onCommit: commitDrag, onAbandon: abandonDrag })
  const dragging = blockDrag.drag
  // 드래그 중이면 그 미리보기, 아니면(범위 선택·저장 중) 놓은 자리를 같은 모양의 미리보기로 보여 준다
  const pendingGhost: DragPreview | null = pendingMove && {
    eventId: pendingMove.instance.event.id,
    instanceKey: `${pendingMove.instance.event.id}-${pendingMove.instance.instanceDate}`,
    mode: pendingMove.meta,
    col: normalizedDays.findIndex((d) => toDateKey(d) === pendingMove.next.start.slice(0, 10)),
    start: pendingMove.next.start,
    end: pendingMove.next.end,
  }
  const shownDrag = dragging ?? pendingGhost

  function scrollToEarliest() {
    const el = scrollRef.current
    if (!el) return
    const hidden = hiddenAbove(timedBlocks, el.scrollTop)
    if (hidden.length === 0) return
    const earliest = hidden.reduce((a, b) => (b.top < a.top ? b : a))
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 일정 시작이 아니라 그 시각의 정각 칸에 맞춘다 — 05:50 일정이면 5시 칸 전체와 그 아래 블록이 함께 보인다
    // (일정 시작에 맞추면 칸이 1/3만 보이고 포커스 링은 블록에 가려졌다)
    const hour = Math.floor(earliest.top / HOUR_HEIGHT)
    el.scrollTo({ top: Math.max(hour * HOUR_HEIGHT - LABEL_PEEK, 0), behavior: reduce ? 'auto' : 'smooth' })
    // 눌린 버튼은 곧 사라진다 — 키보드 사용자가 자리를 잃지 않게 포커스를 그 시각의 시간칸으로 옮긴다.
    // 예전엔 화면 밖에 있던 활성 칸으로 돌려 보내, 포커스가 안 보이고 다음 방향키가 스크롤을 되돌렸다. 목표 칸은 스크롤 도착 지점이라
    // 보이는 범위 안이므로 스크롤은 따라가지 않는다(부드러운 스크롤을 끊지 않게).
    focusCell(earliest.col, hour, true)
  }

  function focusCell(col: number, hour: number, preventScroll = false) {
    scrollRef.current?.querySelector<HTMLElement>(`[data-col="${col}"][data-hour="${hour}"]`)?.focus({ preventScroll })
  }

  function onCellKeyDown(e: KeyboardEvent<HTMLDivElement>, col: number, hour: number) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const lastCol = normalizedDays.length - 1
    switch (e.key) {
      case 'ArrowLeft': focusCell(Math.max(col - 1, 0), hour); break
      case 'ArrowRight': focusCell(Math.min(col + 1, lastCol), hour); break
      case 'ArrowUp': focusCell(col, Math.max(hour - 1, 0)); break
      case 'ArrowDown': focusCell(col, Math.min(hour + 1, 23)); break
      case 'Home': focusCell(col, 0); break // 그 날의 0시
      case 'End': focusCell(col, 23); break // 그 날의 23시
      case 'Enter':
      case ' ':
        onCreateEvent(normalizedDays[col], hour)
        break
      default:
        return // Tab 등은 브라우저에 맡긴다
    }
    e.preventDefault() // 화살표·Space가 페이지를 스크롤하지 않게
    e.stopPropagation() // window의 전역 단축키(←/→ 기간 이동)가 같은 키로 함께 동작하지 않게
  }

  // 드래그 중 미리보기: 같은 색·제목에 옮겨질 시각을 보여 주는 비대화형 블록
  function ghost(d: DragPreview) {
    const source = instances.find((i) => i.event.id === d.eventId)
    if (!source) return null
    const { top, height } = blockSpan({ ...source, start: d.start, end: d.end })
    const color = resolveEventColor(source.event, categoryColor)
    const endLabel = d.end.slice(0, 10) !== d.start.slice(0, 10) && d.end.slice(11, 16) === '00:00' ? '24:00' : d.end.slice(11, 16)
    return (
      <div
        className={styles.dragGhost}
        aria-hidden="true"
        style={{ top, height, borderLeftColor: color, backgroundColor: resolveEventTint(color) }}
      >
        {/* 한 줄에 "시작–끝"을 두고 좁은 열(모바일 7일, ~44px)에서만 <wbr> 자리에서 줄바꿈한다 — 넓은 열의 짧은 일정에서도 끝 시각이 보이게 */}
        <span className={styles.ghostTime}>
          {d.start.slice(11, 16)}
          <wbr />
          <span className={styles.noWrap}>–{endLabel}</span>
        </span>
        {source.event.title}
      </div>
    )
  }

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
                {allDaySlots(allDayInstances, instanceKey, allDayLanes, dayKey).map((instance, slot) => {
                  if (instance === null) return <span key={`spacer-${slot}`} className={styles.chipSpacer} aria-hidden="true" />
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

      <div className={styles.scrollWrap}>
        {hiddenAboveCount > 0 && (
          <button
            type="button"
            className={styles.earlierButton}
            aria-label={`위로 가려진 이른 일정 ${hiddenAboveCount}개 보기`}
            onClick={scrollToEarliest}
          >
            ↑ 이른 일정 {hiddenAboveCount}개
          </button>
        )}
        <div
          ref={scrollRef}
          className={[styles.scrollArea, dragging && styles.dragging].filter(Boolean).join(' ')}
          onScroll={(e) => {
            lastScrollTop = e.currentTarget.scrollTop
            setHiddenAboveCount(hiddenAbove(timedBlocks, lastScrollTop).length)
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
            {normalizedDays.map((day, col) => {
              const dayKey = toDateKey(day)
              const dayLabel = formatDayLabel(day)
              const dayInstances = timedEventsOnDay(instances, dayKey)
              const positioned = layoutOverlapping(
                dayInstances,
                (i) => minutesOf(i.start),
                (i) => clampedEndMinutes(i),
              )

              return (
                <div key={dayKey} className={styles.dayColumn} data-day-column style={{ height: 24 * HOUR_HEIGHT }}>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className={styles.hourCell}
                      style={{ height: HOUR_HEIGHT }}
                      role="button"
                      aria-label={`${dayLabel} ${hourLabelKo(h)}, 새 일정`}
                      tabIndex={col === activeCol && h === active.hour ? 0 : -1}
                      data-col={col}
                      data-hour={h}
                      onFocus={() => setActive((prev) => (prev.col === col && prev.hour === h ? prev : { col, hour: h }))}
                      onKeyDown={(e) => onCellKeyDown(e, col, h)}
                      onClick={() => onCreateEvent(day, h)}
                    />
                  ))}
                  {dayKey === todayKey && <div className={styles.nowLine} style={{ top: nowTop }} role="img" aria-label="현재 시각" />}
                  <AnimatePresence initial={false}>
                    {positioned.map(({ item, column, columnCount }) => {
                      const { top, height } = blockSpan(item)
                      const color = resolveEventColor(item.event, categoryColor)
                      const tint = resolveEventTint(color)
                      const draggable = isBlockDraggable(item.event, currentUserId)
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
                            draggable && styles.draggable,
                            shownDrag?.instanceKey === instanceKey(item) && styles.dragSource,
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
                          onPointerDown={(e) => blockDrag.onPointerDown(e, item, col, 'move')}
                          onPointerMove={blockDrag.onPointerMove}
                          onPointerUp={blockDrag.onPointerUp}
                          onPointerCancel={blockDrag.onPointerCancel}
                          onClickCapture={blockDrag.onClickCapture}
                          onContextMenu={blockDrag.onContextMenu}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent(item)
                          }}
                        >
                          <span className={styles.eventTime}>{item.start.slice(11, 16)}</span> {ownerDot(item)}
                          {jointBadge(item)}
                          {item.event.title}
                          {draggable && canResizeBlock(item.start, item.end) && (
                            <span
                              className={styles.resizeHandle}
                              aria-hidden="true"
                              onPointerDown={(e) => {
                                e.stopPropagation() // 블록 전체의 '이동' 시작과 겹치지 않게
                                blockDrag.onPointerDown(e, item, col, 'resize')
                              }}
                            />
                          )}
                          {draggable && canResizeBlock(item.start, item.end) && height >= MIN_TOP_HANDLE_HEIGHT && (
                            <span
                              className={styles.resizeTopHandle}
                              aria-hidden="true"
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                blockDrag.onPointerDown(e, item, col, 'resize-start')
                              }}
                            />
                          )}
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                  {shownDrag?.col === col && ghost(shownDrag)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {pendingMove?.choosing && (
          <RecurrenceScopeDialog onChoose={recurringSheet.apply} disabledScopes={recurringSheet.unsafeScopes} hint={recurringSheet.hint} onCancel={recurringSheet.cancel} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default TimeGridView
