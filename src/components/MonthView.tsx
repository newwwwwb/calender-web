// 월 보기: 6주 그리드에 공휴일과 반복 일정을 펼친 이벤트 칩을 렌더링한다
import { endOfDay, getDaysInMonth } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canMoveEvent, DRAG_BLOCKED_MESSAGE, shiftByDays } from '../lib/blockDrag'
import { formatDayHeading, formatDayLabel, getMonthGrid, toDateKey } from '../lib/date'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { getHoliday, holidayLabel } from '../lib/holidays'
import { allDaySegmentJoins, allDaySlots, assignAllDayLanes } from '../lib/layout'
import { chipMotion, springSnappy } from '../lib/motion'
import { ownerColorFor } from '../lib/ownerColor'
import { allDayInstanceCoversDay, compareInstancesByTime, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import { useMonthDrag } from '../state/useMonthDrag'
import { useRecurringMoveSheet } from '../state/useRecurringMoveSheet'
import { useTodayKey } from '../state/useTodayKey'
import { useToast } from '../state/useToast'
import type { EventInstance, ID } from '../types'
import JointBadge from './JointBadge'
import RecurrenceScopeDialog from './RecurrenceScopeDialog'
import styles from './MonthView.module.css'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const instanceKey = (i: EventInstance) => `${i.event.id}-${i.instanceDate}`
// 칸 높이를 아직 모를 때(ResizeObserver 없음·첫 렌더) 쓰는 보이는 줄 수 — 예전 고정 값
const DEFAULT_VISIBLE_ROWS = 3
const MAX_VISIBLE_ROWS = 8 // 아주 큰 창에서 칸이 칩으로 도배되지 않게 하는 안전 상한
const GRID_WEEKS = 6
const MIN_CELL_HEIGHT = 100 // .cell의 min-height와 같다 — 칩 3개 + "+N개" 줄이 들어가는 높이
// 칸 안 세로 구성(.cell 실측): 위아래 패딩 8 + 아래 격자선 1, 날짜 줄 22, 칩 line-height 16, 줄 간격 2, "+N개" 줄 13
const CELL_CHROME = 9
const DAY_NUMBER_HEIGHT = 22
const CHIP_HEIGHT = 16
const ROW_GAP = 2
const MORE_HEIGHT = 13
const MAX_DOTS = 3 // 모바일 칸의 색 점 최대 개수

// 종일 일정은 걸치는 모든 날짜에, 시간대 일정은 시작일에만 표시한다 (다른 보기와 동일한 규칙)
function eventsOnDay(instances: EventInstance[], dayKey: string): EventInstance[] {
  return instances.filter((i) => allDayInstanceCoversDay(i, dayKey) || timedInstanceStartsOnDay(i, dayKey))
}

// 칸 높이로 들어가는 칩 줄 수. all은 "+N개" 줄 없이 칩만 둘 때, more는 "+N개" 줄을 함께 둘 때(그 줄만큼 칩이 줄어든다).
// 날짜 줄 아래는 칩마다 (간격 2 + 칩 16)씩 쌓인다(첫 칩 앞의 간격 포함).
function visibleRowLimits(cellHeight: number | null): { all: number; more: number } {
  if (cellHeight === null) return { all: DEFAULT_VISIBLE_ROWS, more: DEFAULT_VISIBLE_ROWS }
  const free = cellHeight - CELL_CHROME - DAY_NUMBER_HEIGHT
  // 하한은 따로 두지 않는다 — cellHeight가 MIN_CELL_HEIGHT 이상이라 항상 3줄 이상이다
  const fit = (height: number) => Math.min(MAX_VISIBLE_ROWS, Math.floor(height / (CHIP_HEIGHT + ROW_GAP)))
  return { all: fit(free), more: fit(free - ROW_GAP - MORE_HEIGHT) }
}

interface MonthViewProps {
  onSelectEvent?: (instance: EventInstance) => void
}

function MonthView({ onSelectEvent = () => {} }: MonthViewProps) {
  const {
    currentDate,
    selectedDate,
    shownEvents,
    categories,
    currentUserId,
    sharedCalendars,
    highlightedEventId,
    setSelectedDate,
    setCurrentDate,
    setView,
    updateEvent,
  } = useCalendar()
  const { showToast } = useToast()

  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  // 드래그로 날짜를 옮긴 일정은 저장·재로드가 끝날 때까지 새 날짜에 머문다(저장 전 옛 자리로 튀었다가 돌아오지 않게). 끝나면(성공·실패) 해제
  const [overrides, setOverrides] = useState<Record<ID, { start: string; end: string }>>({})
  const effectiveEvents = useMemo(
    () => (Object.keys(overrides).length === 0 ? shownEvents : shownEvents.map((e) => (overrides[e.id] ? { ...e, ...overrides[e.id] } : e))),
    [shownEvents, overrides],
  )
  const instances = useMemo(
    // 마지막 칸은 endOfDay로 끝까지 포함해야 한다 — grid[41] 그대로 쓰면 자정이라
    // 그날 시간대 일정이 범위 밖으로 밀려 안 보이는 버그가 있었다(보스 리뷰에서 발견).
    () => expandEventsInRange(effectiveEvents, grid[0], endOfDay(grid[grid.length - 1])),
    [effectiveEvents, grid],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  // 종일 일정은 주(행)마다 줄을 한 번 정해 모든 칸에서 같은 줄에 그린다 — 칸마다 쌓으면 이어진 막대가 다른 높이로 떠 끊겨 보였다(lib/layout.ts)
  const allDayInstances = useMemo(() => instances.filter((i) => i.event.allDay), [instances])
  const laneByWeek = useMemo(
    () =>
      Array.from({ length: grid.length / 7 }, (_, w) =>
        assignAllDayLanes(allDayInstances, instanceKey, toDateKey(grid[w * 7]), toDateKey(grid[w * 7 + 6])),
      ),
    [allDayInstances, grid],
  )
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])

  const isMobile = useMediaQuery(MOBILE_QUERY)
  const todayKey = useTodayKey() // 자정이 지나면 스스로 갱신돼 오늘 표시·지난 일정 흐림이 따라간다

  // 칸 높이(px)로 보일 줄 수를 정한다. 렌더 중에 ref를 읽을 수 없어 state에 담고, 높이는 ResizeObserver 콜백에서 넣는다
  // (SwipeableViewport의 viewportWidth와 같은 패턴).
  // 그리드 자체가 아니라 바깥 컨테이너를 잰다 — 그리드의 행은 콘텐츠가 늘리면 같이 커져서(1fr이 콘텐츠 크기를 따른다) 그 높이로 줄 수를
  // 정하면 줄이 늘수록 칸이 커지고 칸이 커지면 줄이 더 늘어나는 되먹임이 생긴다. 컨테이너는 콘텐츠와 무관하게 창 높이로 정해진다.
  const containerRef = useRef<HTMLDivElement>(null)
  const weekdaysRef = useRef<HTMLDivElement>(null)
  const [cellHeight, setCellHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = containerRef.current // 모바일에서는 이 컨테이너가 없다
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const gridHeight = entry.contentRect.height - (weekdaysRef.current?.offsetHeight ?? 0)
      // 내림: 칸이 실제보다 조금 작다고 보는 쪽이 칩이 넘치지 않는다. 창이 낮아 최소 높이로 내려가면 보기가 스크롤된다.
      setCellHeight(Math.max(MIN_CELL_HEIGHT, Math.floor(gridHeight / GRID_WEEKS)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMobile])
  const limits = visibleRowLimits(cellHeight)

  // 일정 칩을 끌어 다른 날 칸에 놓으면 날짜가 옮겨진다(데스크톱 그리드). 반복 일정은 범위(이 일정만/이후/전체)를 물은 뒤 저장한다.
  const recurringSheet = useRecurringMoveSheet<{ targetKey: string }>({
    instances,
    currentUserId,
    message: (instance) => `'${instance.event.title}' 일정을 옮겼어요.`,
  })
  const pendingMove = recurringSheet.pending
  const openRecurringSheet = recurringSheet.open
  const commitMove = useCallback(
    (draggedInstance: EventInstance, dayDelta: number, targetKey: string) => {
      // 끄는 동안 재로드로 다른 기기의 수정이 들어왔을 수 있어, 눌렀을 때의 스냅숏이 아니라 지금의 최신 일정 위에 날짜만 옮긴다.
      // 그 사이 지워졌거나 옮길 수 없게 됐으면(함께·읽기 전용) 저장하지 않고 이유를 알린다
      const event = shownEvents.find((e) => e.id === draggedInstance.event.id)
      if (!event || !canMoveEvent(event, currentUserId)) {
        showToast({ message: DRAG_BLOCKED_MESSAGE })
        return
      }
      if (event.recurrence) {
        const current = instances.find((i) => instanceKey(i) === instanceKey(draggedInstance)) ?? draggedInstance
        openRecurringSheet({ ...current, event }, shiftByDays(current.start, current.end, dayDelta), { targetKey })
        return
      }
      const next = shiftByDays(event.start, event.end, dayDelta)
      setOverrides((prev) => ({ ...prev, [event.id]: next }))
      void updateEvent({ ...event, ...next }, { message: `'${event.title}' 일정을 옮겼어요.`, previous: event })
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
    [shownEvents, instances, currentUserId, showToast, updateEvent, openRecurringSheet],
  )
  const abandonDrag = useCallback(() => showToast({ message: DRAG_BLOCKED_MESSAGE }), [showToast])
  const ghostRef = useRef<HTMLDivElement>(null)
  const monthDrag = useMonthDrag({ ghostRef, currentUserId, onCommit: commitMove, onAbandon: abandonDrag })
  const dragState = monthDrag.drag
  // 드래그 중이면 그 상태, 아니면(범위 선택·저장 중) 놓은 칸을 같은 모양으로 보여 준다
  const draggedKey = dragState?.instanceKey ?? (pendingMove ? instanceKey(pendingMove.instance) : undefined)
  const dropKey = dragState ? (dragState.dayDelta !== 0 ? dragState.targetKey : undefined) : pendingMove?.meta.targetKey

  const selectedKey = toDateKey(selectedDate)
  const currentMonthKey = toDateKey(currentDate).slice(0, 7)
  // 선택 원의 layoutId — MonthView는 App에 한 곳뿐이라 인스턴스 구분은 필요 없지만, 월 전환 중 겹치는
  // 지난 달 그리드와는 충돌하지 않도록 월 키를 포함한다(MiniCalendar와 달리 useId는 필요 없다).
  // 퇴장 패널은 App의 FreezeCalendarWhenExiting이 context를 고정하므로 지난 달 키를 그대로 유지한다.
  const selectedCircleLayoutId = `month-selected-${currentMonthKey}`

  // 모바일(iOS 캘린더 방식): 칸이 ~50px라 칩에는 글자가 1~2자밖에 안 들어간다 — 칸에는 색 점만 두고
  // 날짜를 누르면 그날 일정을 그리드 아래 목록으로 보여준다. 일 보기로 넘어가지 않고 제자리에서 선택.
  if (isMobile) {
    const selectedInstances = eventsOnDay(instances, selectedKey).sort(compareInstancesByTime)
    // 이 달에 필요한 주만 그린다(그리드는 항상 6주라 9월의 4~10일 같은 통째로 다음 달인 주가 생긴다).
    // 2026-02처럼 일요일에 시작하는 28일짜리 달은 5주째도 통째로 다음 달이라 "마지막 주만 뺀다"로는 부족하다.
    const firstOffset = grid.findIndex((day) => toDateKey(day).slice(0, 7) === currentMonthKey)
    const weeks = Math.ceil((firstOffset + getDaysInMonth(currentDate)) / 7)
    const mobileGrid = grid.slice(0, weeks * 7)
    return (
      <div className={styles.container}>
        <div className={styles.weekdays}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className={styles.weekday}>
              {label}
            </span>
          ))}
        </div>
        <div className={styles.gridMobile} style={{ gridTemplateRows: `repeat(${mobileGrid.length / 7}, 52px)` }}>
          {mobileGrid.map((day) => {
            const dayKey = toDateKey(day)
            const isOutside = dayKey.slice(0, 7) !== currentMonthKey
            const isToday = dayKey === todayKey
            const isSelected = dayKey === selectedKey
            const dayEvents = eventsOnDay(instances, dayKey).sort(compareInstancesByTime)
            // iOS 캘린더 규칙: 오늘은 파란 글자, 선택한 날만 채운 원(오늘을 선택하면 파란 채움).
            // 둘 다 채운 원이면 어느 쪽이 "선택"인지 구분이 안 됐다(보스 리뷰에서 발견).
            // 채운 원은 배경만 따로 두어 layoutId로 미끄러지게 하고, 글자는 그 위에 얹는다.
            // 원 색이 다르므로(오늘=강조색, 그 외=선택색) 그 위 글자색도 나눈다 — 다크에서는 선택 원이 밝아 글자가 어두워야 한다
            const numberTextClass = isSelected
              ? isToday
                ? styles.dayNumberSelectedTodayText
                : styles.dayNumberSelectedText
              : isToday
                ? styles.dayNumberTodayText
                : isOutside
                  ? styles.dayNumberOutside
                  : day.getDay() === 0 || getHoliday(dayKey)
                    ? styles.dayNumberSunday
                    : day.getDay() === 6
                      ? styles.dayNumberSaturday
                      : styles.dayNumber
            return (
              <button
                key={dayKey}
                type="button"
                className={styles.cellMobile}
                aria-label={[
                  formatDayLabel(day),
                  isToday && '오늘',
                  getHoliday(dayKey) && holidayLabel(getHoliday(dayKey)!),
                  dayEvents.length > 0 && `일정 ${dayEvents.length}개`,
                ]
                  .filter(Boolean)
                  .join(', ')}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedDate(day)
                  // 같은 달 안에서 currentDate를 바꾸면 화면이 옆으로 슬라이드하므로, 다른 달 날짜를 눌렀을 때만 이동한다
                  if (isOutside) setCurrentDate(day)
                }}
              >
                <span className={styles.numberWrap}>
                  {isSelected && (
                    <motion.span
                      layoutId={selectedCircleLayoutId}
                      className={isToday ? styles.selectedCircleToday : styles.selectedCircle}
                      transition={springSnappy}
                    />
                  )}
                  <span className={numberTextClass}>{day.getDate()}</span>
                </span>
                <span className={styles.dots}>
                  {dayEvents.slice(0, MAX_DOTS).map((instance) => (
                    <span
                      key={`${instance.event.id}-${instance.instanceDate}`}
                      className={styles.dot}
                      style={{ background: resolveEventColor(instance.event, categoryColor) }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <div className={styles.dayList}>
          <h3 className={styles.dayListTitle}>
            {formatDayHeading(selectedDate)}
            {/* 공휴일 이름이 빨간 숫자로만 암시됐다 — 선택한 날이 공휴일이면 이름을 보여준다 */}
            {getHoliday(selectedKey) && <span className={styles.dayListHoliday}>{holidayLabel(getHoliday(selectedKey)!)}</span>}
          </h3>
          {/* 날짜를 바꿀 때마다 다시 마운트돼 등장만 페이드인한다(퇴장 없음 — 겹치거나 높이가 튀지 않게).
              제목(dayListTitle)은 sticky라 애니메이션 대상 밖에 둬 transform이 sticky를 깨지 않게 한다. */}
          <motion.div key={selectedKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={springSnappy}>
            {selectedInstances.length === 0 ? (
              <p className={styles.dayListEmpty}>일정이 없어요.</p>
            ) : (
              <ul className={styles.dayListItems}>
                {selectedInstances.map((instance) => (
                  <li key={`${instance.event.id}-${instance.instanceDate}`}>
                    <button type="button" className={styles.dayListRow} onClick={() => onSelectEvent(instance)}>
                      <span
                        className={styles.dayListBar}
                        style={{ background: resolveEventColor(instance.event, categoryColor) }}
                      />
                      <span className={styles.dayListTime}>{instance.event.allDay ? '종일' : instance.start.slice(11, 16)}</span>
                      <span className={styles.dayListEventTitle}>{instance.event.title}</span>
                      <JointBadge event={instance.event} currentUserId={currentUserId} sharedOwnerIds={sharedOwnerIds} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  const draggedInstance = draggedKey ? instances.find((i) => instanceKey(i) === draggedKey) : undefined
  const draggedColor = draggedInstance && resolveEventColor(draggedInstance.event, categoryColor)

  return (
    <div ref={containerRef} className={[styles.container, dragState && styles.dragging].filter(Boolean).join(' ')}>
      <div ref={weekdaysRef} className={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {grid.map((day, index) => {
          const dayKey = toDateKey(day)
          const isOutside = dayKey.slice(0, 7) !== currentMonthKey
          const isToday = dayKey === todayKey
          const isSunday = day.getDay() === 0
          const holiday = getHoliday(dayKey)
          // 정렬 없이 자르면 저장소 순서(로컬은 삽입순)에 따라 보이는 3개가 뒤죽박죽이었다(보스 리뷰에서 발견)
          const dayEvents = eventsOnDay(instances, dayKey).sort(compareInstancesByTime)
          // 위쪽은 종일 일정의 고정 줄(비는 줄은 같은 높이의 빈 자리 null), 그 아래에 시간 일정
          const slotted = [
            ...allDaySlots(allDayInstances, instanceKey, laneByWeek[Math.floor(index / 7)], dayKey),
            ...dayEvents.filter((i) => !i.event.allDay),
          ]
          // 칸이 넘치면(보이는 줄 수 초과) 빈 자리를 접는다 — 빈 줄이 보이는 칸을 차지해 일정이 "+N개"로만 밀려나는 것을 막는다
          // (4개 이상 겹친 주에서 앞줄이 모두 끝난 칸이 비어 보이고 +1개만 있던 경우, 25단계 5차 심사 권고). 넘치는 칸은 어차피 +N으로 빽빽함을
          // 알리므로 그 칸에서만 줄 정렬을 포기해도 손해가 작다.
          const rows = slotted.length > limits.all ? slotted.filter((r) => r !== null) : slotted
          // "+N개" 줄이 필요한 칸(칩이 all개를 넘는 칸)에서만 그 줄 높이만큼 칩을 덜 보인다. 접힌 뒤에는 빈 자리가 없어 남는 개수가 곧 +N이다.
          const visibleRows = rows.length > limits.all ? rows.slice(0, limits.more) : rows
          const hiddenCount = rows.length - visibleRows.length

          const numberClass = isOutside
            ? styles.dayNumberOutside
            : isToday
              ? styles.dayNumberToday
              : isSunday || holiday
                ? styles.dayNumberSunday
                : day.getDay() === 6
                  ? styles.dayNumberSaturday
                  : styles.dayNumber

          // 날짜를 클릭하면 그날의 일 보기로 바로 넘어간다
          const openDay = () => {
            setSelectedDate(day)
            setCurrentDate(day)
            setView('day')
          }
          const dayLabel = [
            formatDayLabel(day),
            isToday && '오늘',
            holiday && holidayLabel(holiday),
            dayEvents.length > 0 && `일정 ${dayEvents.length}개`,
          ]
            .filter(Boolean)
            .join(', ')

          // 칸은 마우스용 큰 클릭 영역(div)이고, 키보드·스크린리더의 진입점은 안쪽의 날짜 버튼과 일정 칩 버튼이다 —
          // 버튼 안에 버튼(칩)을 넣을 수 없어서 칸 전체를 버튼으로 두면 칩을 키보드로 열 수 없었다
          return (
            <div
              key={dayKey}
              data-day-key={dayKey}
              className={[dayKey === selectedKey ? styles.cellSelected : styles.cell, dayKey === dropKey && styles.dropTarget].filter(Boolean).join(' ')}
              onClick={openDay}
            >
              <button
                type="button"
                className={styles.dayNumberRow}
                aria-label={dayLabel}
                aria-current={isToday ? 'date' : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  openDay()
                }}
              >
                <span className={numberClass}>{day.getDate()}</span>
                {holiday && (
                  <span className={styles.holidayName} title={holidayLabel(holiday)}>
                    {holidayLabel(holiday)}
                  </span>
                )}
              </button>
              {/* popLayout: 칩이 삭제될 때 숨어 있던 다음 칩이 즉시 자리를 잡고, 퇴장 칩은 absolute로 겹쳐 페이드만
                  한다 — sync 모드였으면 그 사이 칸 안에 칩이 하나 더 많아진 것처럼 커졌다 줄어드는 게 보였다(보스 리뷰) */}
              <AnimatePresence initial={false} mode="popLayout">
                {visibleRows.map((instance, rowIndex) => {
                  // 빈 줄: 같은 높이의 자리만 차지해 아래 칩의 줄을 맞춘다
                  if (instance === null) return <span key={`spacer-${rowIndex}`} className={styles.chipSpacer} aria-hidden="true" />
                  const color = resolveEventColor(instance.event, categoryColor)
                  const ownerId = instance.event.ownerId
                  const isShared = ownerId !== undefined && ownerId !== currentUserId
                  // 함께 일정이고 내가 아직 응답 안 했으면 점선으로 눈에 띄게 한다
                  const isPendingForMe = myJointStatus(instance.event, currentUserId) === 'pending'
                  const { joinLeft, joinRight } = allDaySegmentJoins(instance, dayKey, day.getDay(), 7)
                  const chipClass = [
                    styles.chip,
                    isPendingForMe && styles.chipPending,
                    instance.end.slice(0, 10) < todayKey && styles.chipPast,
                    instance.event.id === highlightedEventId && styles.isNew,
                    joinLeft && styles.joinLeft,
                    joinRight && styles.joinRight,
                    canMoveEvent(instance.event, currentUserId) && styles.draggable,
                    draggedKey === instanceKey(instance) && styles.dragSource,
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
                      onPointerDown={(e) => monthDrag.onPointerDown(e, instance, dayKey)}
                      onPointerMove={monthDrag.onPointerMove}
                      onPointerUp={monthDrag.onPointerUp}
                      onPointerCancel={monthDrag.onPointerCancel}
                      onClickCapture={monthDrag.onClickCapture}
                      onContextMenu={monthDrag.onContextMenu}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(instance)
                      }}
                    >
                      {isShared && (
                        <span className={styles.ownerDot} style={{ background: ownerColorFor(ownerId, sharedOwnerIds) }} />
                      )}
                      <JointBadge
                        event={instance.event}
                        currentUserId={currentUserId}
                        sharedOwnerIds={sharedOwnerIds}
                        className={styles.jointBadge}
                        variant="dots"
                      />
                      {instance.event.title}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={styles.more}
                  aria-label={`${formatDayLabel(day)} 일정 ${hiddenCount}개 더 보기`}
                  onClick={(e) => {
                    e.stopPropagation()
                    openDay()
                  }}
                >
                  +{hiddenCount}개
                </button>
              )}
            </div>
          )
        })}
      </div>
      {/* 끄는 동안 포인터를 따라다니는 고스트 — 위치는 훅이 DOM으로 직접 옮긴다 */}
      {dragState && draggedInstance && draggedColor && (
        <div
          ref={ghostRef}
          className={styles.dragGhost}
          aria-hidden="true"
          style={{ borderLeftColor: draggedColor, backgroundColor: resolveEventTint(draggedColor) }}
        >
          {draggedInstance.event.title}
        </div>
      )}
      <AnimatePresence>
        {pendingMove?.choosing && (
          <RecurrenceScopeDialog onChoose={recurringSheet.apply} disabledScopes={recurringSheet.unsafeScopes} hint={recurringSheet.hint} onCancel={recurringSheet.cancel} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default MonthView
