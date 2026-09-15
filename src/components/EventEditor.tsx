// 일정 생성/수정/삭제 모달
import { useState } from 'react'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, EventInstance } from '../types'
import styles from './EventEditor.module.css'

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
  const [error, setError] = useState('')

  function buildKey(date: string, time: string): string {
    return allDay ? date : `${date}T${time}`
  }

  function handleSave() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('제목을 입력해 주세요.')
      return
    }
    const start = buildKey(startDate, startTime)
    const end = buildKey(endDate, endTime)
    if (end < start) {
      setError('종료 일시는 시작 일시보다 빠를 수 없어요.')
      return
    }

    const draft: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(),
      title: trimmedTitle,
      memo: memo.trim() || undefined,
      categoryId: categoryId || undefined,
      allDay,
      start,
      end,
      recurrence: event?.recurrence,
      excludedDates: event?.excludedDates,
    }

    if (event) {
      updateEvent(draft)
    } else {
      addEvent(draft)
    }
    onClose()
  }

  function handleDelete() {
    if (event) deleteEvent(event.id)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={styles.heading}>{event ? '일정 수정' : '새 일정'}</span>

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
            <input type="date" className={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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

        <label className={styles.field}>
          <span className={styles.label}>카테고리</span>
          <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>메모</span>
          <textarea className={styles.textarea} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>

        {error && <span className={styles.error}>{error}</span>}

        <div className={styles.actions}>
          {event && (
            <button type="button" className={styles.buttonDanger} onClick={handleDelete}>
              삭제
            </button>
          )}
          <button type="button" className={styles.buttonSecondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={styles.buttonPrimary} onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

export default EventEditor
