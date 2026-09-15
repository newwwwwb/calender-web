// 일정 생성/수정/삭제 모달
import { useState } from 'react'
import { excludeOccurrence, isFirstOccurrence, resolveRecurrenceUntil, truncateRecurrenceBefore } from '../lib/recurrence'
import { useCalendar } from '../state/useCalendar'
import type { EventInstance, RecurrenceFreq, RecurrenceRule } from '../types'
import styles from './EventEditor.module.css'
import RecurrenceFields, { type EndCondition } from './RecurrenceFields'

// 카테고리를 안 골라도 일정이 배경과 구분되도록, 새 일정은 항상 이 색으로 시작한다
// (액션·선택에 쓰는 #0066ff와 겹치지 않게 고름)
const DEFAULT_EVENT_COLOR = '#6366f1'

interface EventEditorProps {
  instance: EventInstance | null // null이면 새 일정 생성. 있으면 클릭한 회차(실제 날짜·시간)를 수정
  defaultDate: string // 새 일정 생성 시 기본 날짜(YYYY-MM-DD)
  defaultHour?: number // 주/일 보기에서 특정 시간칸을 클릭해 생성할 때의 시작 시각
  onClose: () => void
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function splitDate(value: string): string {
  return value.slice(0, 10)
}

function splitTime(value: string): string {
  return value.includes('T') ? value.slice(11, 16) : '09:00'
}

function EventEditor({ instance, defaultDate, defaultHour, onClose }: EventEditorProps) {
  const { categories, addEvent, updateEvent, deleteEvent } = useCalendar()
  const event = instance?.event ?? null

  const [title, setTitle] = useState(event?.title ?? '')
  const [memo, setMemo] = useState(event?.memo ?? '')
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '')
  const [color, setColor] = useState(event?.color ?? DEFAULT_EVENT_COLOR)
  const [allDay, setAllDay] = useState(event?.allDay ?? defaultHour === undefined)
  // 수정 모드에서는 시리즈 템플릿(event)이 아니라 실제로 클릭한 회차(instance)의 날짜·시간을 보여준다
  const [startDate, setStartDate] = useState(instance ? splitDate(instance.start) : defaultDate)
  const [startTime, setStartTime] = useState(
    instance ? splitTime(instance.start) : defaultHour !== undefined ? `${pad2(defaultHour)}:00` : '09:00',
  )
  const [endDate, setEndDate] = useState(instance ? splitDate(instance.end) : defaultDate)
  const [endTime, setEndTime] = useState(
    instance
      ? splitTime(instance.end)
      : defaultHour !== undefined
        ? defaultHour + 1 >= 24
          ? '23:59' // 23시칸 클릭 시 자정을 넘기지 않도록 그날 안에서 마무리
          : `${pad2(defaultHour + 1)}:00`
        : '10:00',
  )
  const [freq, setFreq] = useState<RecurrenceFreq | 'none'>(event?.recurrence?.freq ?? 'none')
  const [interval, setInterval] = useState(event?.recurrence?.interval ?? 1)
  const [byWeekday, setByWeekday] = useState<number[]>(event?.recurrence?.byWeekday ?? [])
  const [endCondition, setEndCondition] = useState<EndCondition>(
    event?.recurrence?.until ? 'until' : event?.recurrence?.count ? 'count' : 'never',
  )
  const [until, setUntil] = useState(event?.recurrence?.until ?? startDate)
  const [count, setCount] = useState(event?.recurrence?.count ?? 5)
  const [error, setError] = useState('')
  // 반복 일정을 수정/삭제할 때만 "이 일정만/이후 전체/전체" 범위를 묻는다
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null)

  function buildKey(date: string, time: string): string {
    return allDay ? date : `${date}T${time}`
  }

  function buildRecurrence(): RecurrenceRule | undefined {
    if (freq === 'none') return undefined
    return {
      freq,
      interval: Math.max(1, interval),
      byWeekday: freq === 'weekly' && byWeekday.length > 0 ? byWeekday : undefined,
      until: endCondition === 'until' ? until : undefined,
      count: endCondition === 'count' ? Math.max(1, count) : undefined,
    }
  }

  function toggleWeekday(day: number) {
    setByWeekday((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  // 카테고리를 고르면 그 카테고리 색으로 맞춰준다. 색상 칸은 그 뒤에도 직접 바꿀 수 있다.
  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    const category = categories.find((c) => c.id === nextCategoryId)
    if (category) setColor(category.color)
  }

  function handleSaveClick() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (buildKey(endDate, endTime) < buildKey(startDate, startTime)) {
      setError('종료 일시는 시작 일시보다 빠를 수 없어요.')
      return
    }
    setError('')
    if (event?.recurrence) {
      setPendingAction('save')
    } else {
      commitSave('all')
    }
  }

  function handleDeleteClick() {
    if (!event) return
    if (event.recurrence) {
      setPendingAction('delete')
    } else {
      commitDelete('all')
    }
  }

  // scope: 'this'=이 회차만, 'following'=이 회차부터 이후 전체, 'all'=시리즈 전체(또는 반복 없음/신규)
  function commitSave(scope: 'this' | 'following' | 'all') {
    const common = {
      title: title.trim(),
      memo: memo.trim() || undefined,
      categoryId: categoryId || undefined,
      color,
      allDay,
      start: buildKey(startDate, startTime),
      end: buildKey(endDate, endTime),
    }

    if (!event) {
      addEvent({ id: crypto.randomUUID(), ...common, recurrence: buildRecurrence() })
      onClose()
      return
    }

    const occurrenceDate = instance?.instanceDate ?? ''
    // "이후 전체"가 첫 회차부터 시작하면 "전체"와 같다 — 그 경우에만 all 분기로 합친다.
    // scope 체크 없이 isFirstOccurrence만 보면 "이 일정만"도 여기로 떨어져 시리즈 전체가 바뀌는 버그였음.
    if (scope === 'all' || !event.recurrence || (scope === 'following' && isFirstOccurrence(event, occurrenceDate))) {
      // 반복 규칙 변경은 '전체 일정' 범위에서만 반영된다 (이 일정만/이후 전체는 원래 패턴을 유지)
      updateEvent({ ...event, ...common, recurrence: buildRecurrence() })
    } else if (scope === 'this') {
      updateEvent(excludeOccurrence(event, occurrenceDate))
      addEvent({ id: crypto.randomUUID(), ...common, recurrence: undefined })
    } else {
      const effectiveUntil = resolveRecurrenceUntil(event)
      updateEvent(truncateRecurrenceBefore(event, occurrenceDate))
      addEvent({
        id: crypto.randomUUID(),
        ...common,
        recurrence: { ...event.recurrence, until: effectiveUntil, count: undefined },
      })
    }
    setPendingAction(null)
    onClose()
  }

  function commitDelete(scope: 'this' | 'following' | 'all') {
    if (!event) return
    const occurrenceDate = instance?.instanceDate ?? ''
    // commitSave와 동일한 이유로 scope === 'following'일 때만 all과 합친다.
    if (scope === 'all' || !event.recurrence || (scope === 'following' && isFirstOccurrence(event, occurrenceDate))) {
      deleteEvent(event.id)
    } else if (scope === 'this') {
      updateEvent(excludeOccurrence(event, occurrenceDate))
    } else {
      updateEvent(truncateRecurrenceBefore(event, occurrenceDate))
    }
    setPendingAction(null)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={styles.heading}>{event ? '일정 수정' : '새 일정'}</span>

        {pendingAction ? (
          <div className={styles.scopePicker}>
            <p className={styles.scopeQuestion}>
              반복 일정이에요. {pendingAction === 'delete' ? '삭제' : '저장'} 범위를 선택해 주세요.
            </p>
            <button
              type="button"
              className={styles.scopeButton}
              onClick={() => (pendingAction === 'delete' ? commitDelete('this') : commitSave('this'))}
            >
              이 일정만
            </button>
            <button
              type="button"
              className={styles.scopeButton}
              onClick={() => (pendingAction === 'delete' ? commitDelete('following') : commitSave('following'))}
            >
              이후 전체
            </button>
            <button
              type="button"
              className={styles.scopeButton}
              onClick={() => (pendingAction === 'delete' ? commitDelete('all') : commitSave('all'))}
            >
              전체 일정
            </button>
            <button type="button" className={styles.buttonSecondary} onClick={() => setPendingAction(null)}>
              취소
            </button>
          </div>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.label}>제목</span>
              {/* 모달을 열자마자 바로 입력할 수 있게 자동 포커스 */}
              <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </label>

            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              종일
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>시작</span>
                <input
                  type="date"
                  className={styles.input}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              {!allDay && (
                <label className={styles.field}>
                  <span className={styles.label}>시작 시간</span>
                  <input
                    type="time"
                    className={styles.input}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>종료</span>
                <input
                  type="date"
                  className={styles.input}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
              {!allDay && (
                <label className={styles.field}>
                  <span className={styles.label}>종료 시간</span>
                  <input
                    type="time"
                    className={styles.input}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </label>
              )}
            </div>

            <RecurrenceFields
              freq={freq}
              onFreqChange={setFreq}
              interval={interval}
              onIntervalChange={setInterval}
              byWeekday={byWeekday}
              onToggleWeekday={toggleWeekday}
              endCondition={endCondition}
              onEndConditionChange={setEndCondition}
              until={until}
              onUntilChange={setUntil}
              count={count}
              onCountChange={setCount}
              showChangeHint={Boolean(event?.recurrence)}
            />

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>카테고리</span>
                <select
                  className={styles.select}
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">없음</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>색상</span>
                <input type="color" className={styles.input} value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>메모</span>
              <textarea className={styles.textarea} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>

            {error && <span className={styles.error}>{error}</span>}

            <div className={styles.actions}>
              {event && (
                <button type="button" className={styles.buttonDanger} onClick={handleDeleteClick}>
                  삭제
                </button>
              )}
              <button type="button" className={styles.buttonSecondary} onClick={onClose}>
                취소
              </button>
              <button type="button" className={styles.buttonPrimary} onClick={handleSaveClick}>
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EventEditor
