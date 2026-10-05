// 검색 다이얼로그: 제목·메모로 일정을 찾고, 클릭하면 그 날짜로 이동하며 일정을 바로 연다.
// 데스크톱에서는 위쪽에 뜨는 팝오버(전체 화면을 덮는 흰 페이지가 미완성처럼 보였다), 모바일에서는 전체 화면이다.
import { useMemo, useState } from 'react'
import { formatDayHeading, parseDateTimeKey, toDateKey } from '../lib/date'
import { resolveEventColor } from '../lib/eventColor'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, EventInstance } from '../types'
import Overlay from './Overlay'
import styles from './SearchDialog.module.css'
import { CloseIcon, SearchIcon } from './icons'

interface SearchDialogProps {
  onClose: () => void
  onNavigate: (date: Date) => void
  /** 넘기면 결과를 눌렀을 때 그 일정의 편집기를 바로 연다(날짜로 이동만 하고 한 번 더 눌러야 했다) */
  onOpenEvent?: (instance: EventInstance) => void
}

// "10월 1일 (목) 10:00" / 종일은 "10월 1일 (목) 종일". 올해가 아니면 연도가 붙는다 — 연도가 없어 작년·올해 같은 날짜가 구분되지 않았다
function resultLabel(event: CalendarEvent): string {
  const date = formatDayHeading(parseDateTimeKey(event.start))
  return `${date} ${event.allDay ? '종일' : event.start.slice(11, 16)}`
}

function SearchDialog({ onClose, onNavigate, onOpenEvent }: SearchDialogProps) {
  const { shownEvents, categories } = useCalendar()
  const [query, setQuery] = useState('')
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])
  const todayKey = toDateKey(new Date())

  // 다가오는 일정은 가까운 순, 지난 일정은 최근 순으로 나눠 보여 준다
  const { upcoming, past } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { upcoming: [], past: [] }
    const matched = shownEvents.filter((e) => e.title.toLowerCase().includes(q) || (e.memo ?? '').toLowerCase().includes(q))
    const key = (e: CalendarEvent) => e.end.slice(0, 10)
    return {
      upcoming: matched.filter((e) => key(e) >= todayKey).sort((a, b) => a.start.localeCompare(b.start)),
      past: matched.filter((e) => key(e) < todayKey).sort((a, b) => b.start.localeCompare(a.start)),
    }
  }, [shownEvents, query, todayKey])
  const total = upcoming.length + past.length

  function handleSelect(event: CalendarEvent) {
    onNavigate(parseDateTimeKey(event.start))
    onOpenEvent?.({ event, start: event.start, end: event.end, instanceDate: event.start.slice(0, 10) })
    onClose()
  }

  function renderGroup(title: string, events: CalendarEvent[]) {
    if (events.length === 0) return null
    return (
      <section className={styles.group}>
        <h2 className={styles.groupTitle}>{title}</h2>
        {events.map((event) => (
          <button key={event.id} type="button" className={styles.resultRow} onClick={() => handleSelect(event)}>
            <span className={styles.dot} style={{ background: resolveEventColor(event, categoryColor) }} />
            <span className={styles.resultDate}>{resultLabel(event)}</span>
            <span className={styles.resultTitle}>
              {event.title}
              {event.recurrence && <span className={styles.repeatTag}> · 반복</span>}
            </span>
          </button>
        ))}
      </section>
    )
  }

  return (
    <Overlay onClose={onClose} variant="fullscreen" label="일정 검색">
      <div className={styles.header}>
        <span className={styles.searchIcon} aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          className={styles.input}
          placeholder="일정 검색 (제목, 메모)"
          aria-label="일정 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          autoFocus
        />
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="검색 닫기">
          <CloseIcon />
        </button>
      </div>
      {/* 결과 개수를 스크린리더에 알린다. 결과 없음은 아래 보이는 안내 문구 자체가 status라 여기서 또 읽지 않는다 */}
      <div className="sr-only" role="status" aria-live="polite">
        {total > 0 ? `검색 결과 ${total}건` : ''}
      </div>
      <div className={styles.results}>
        {query.trim() === '' ? (
          <p className={styles.hint}>제목이나 메모로 일정을 찾아보세요.</p>
        ) : total === 0 ? (
          <p className={styles.hint} role="status">
            검색 결과가 없어요.
          </p>
        ) : (
          <>
            {renderGroup('다가오는 일정', upcoming)}
            {renderGroup('지난 일정', past)}
          </>
        )}
      </div>
    </Overlay>
  )
}

export default SearchDialog
