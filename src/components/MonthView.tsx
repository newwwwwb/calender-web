// 월 보기: 6주 그리드에 공휴일과 반복 일정을 펼친 이벤트 칩을 렌더링한다
import { endOfDay, getDaysInMonth } from 'date-fns'
import { useMemo } from 'react'
import { formatDayTitle, getMonthGrid, toDateKey } from '../lib/date'
import { resolveEventColor, resolveEventTint } from '../lib/eventColor'
import { getHoliday } from '../lib/holidays'
import { ownerColorFor } from '../lib/ownerColor'
import { allDayInstanceCoversDay, compareInstancesByTime, expandEventsInRange, timedInstanceStartsOnDay } from '../lib/recurrence'
import { myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import { useMediaQuery } from '../state/useMediaQuery'
import type { EventInstance } from '../types'
import JointBadge from './JointBadge'
import styles from './MonthView.module.css'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_VISIBLE_EVENTS = 3
const MAX_DOTS = 3 // 모바일 칸의 색 점 최대 개수

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
    // 마지막 칸은 endOfDay로 끝까지 포함해야 한다 — grid[41] 그대로 쓰면 자정이라
    // 그날 시간대 일정이 범위 밖으로 밀려 안 보이는 버그가 있었다(보스 리뷰에서 발견).
    () => expandEventsInRange(shownEvents, grid[0], endOfDay(grid[grid.length - 1])),
    [shownEvents, grid],
  )
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  const sharedOwnerIds = useMemo(() => sharedCalendars.map((s) => s.ownerId), [sharedCalendars])

  const isMobile = useMediaQuery('(max-width: 767px)')
  const todayKey = toDateKey(new Date())
  const selectedKey = toDateKey(selectedDate)
  const currentMonthKey = toDateKey(currentDate).slice(0, 7)

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
            const numberClass =
              isToday && isSelected
                ? styles.dayNumberToday
                : isSelected
                  ? styles.dayNumberSelected
                  : isToday
                    ? styles.dayNumberTodayText
                    : isOutside
                  ? styles.dayNumberOutside
                  : day.getDay() === 0 || getHoliday(dayKey)
                    ? styles.dayNumberSunday
                    : styles.dayNumber
            return (
              <button
                key={dayKey}
                type="button"
                className={styles.cellMobile}
                aria-label={dayKey}
                aria-current={isSelected ? 'date' : undefined}
                onClick={() => {
                  setSelectedDate(day)
                  // 같은 달 안에서 currentDate를 바꾸면 화면이 옆으로 슬라이드하므로, 다른 달 날짜를 눌렀을 때만 이동한다
                  if (isOutside) setCurrentDate(day)
                }}
              >
                <span className={numberClass}>{day.getDate()}</span>
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
          <h3 className={styles.dayListTitle}>{formatDayTitle(selectedDate)}</h3>
          {selectedInstances.length === 0 ? (
            <p className={styles.dayListEmpty}>일정 없음</p>
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
        </div>
      </div>
    )
  }

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
          // 정렬 없이 자르면 저장소 순서(로컬은 삽입순)에 따라 보이는 3개가 뒤죽박죽이었다(보스 리뷰에서 발견)
          const dayEvents = eventsOnDay(instances, dayKey).sort(compareInstancesByTime)
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
                // 함께 일정이고 내가 아직 응답 안 했으면 점선으로 눈에 띄게 한다
                const isPendingForMe = myJointStatus(instance.event, currentUserId) === 'pending'
                return (
                  <span
                    key={`${instance.event.id}-${instance.instanceDate}`}
                    className={isPendingForMe ? `${styles.chip} ${styles.chipPending}` : styles.chip}
                    style={{ borderLeftColor: color, backgroundColor: resolveEventTint(color) }}
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
