// 전체화면 검색 다이얼로그: 제목·메모로 일정을 찾고, 클릭하면 그 날짜로 이동한다
import { useMemo, useState } from 'react'
import { formatShortDate, parseDateTimeKey } from '../lib/date'
import { resolveEventColor } from '../lib/eventColor'
import { useCalendar } from '../state/useCalendar'
import styles from './SearchDialog.module.css'

interface SearchDialogProps {
  onClose: () => void
  onNavigate: (date: Date) => void
}

function SearchDialog({ onClose, onNavigate }: SearchDialogProps) {
  const { shownEvents, categories } = useCalendar()
  const [query, setQuery] = useState('')
  const categoryColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return shownEvents
      .filter((e) => e.title.toLowerCase().includes(q) || (e.memo ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [shownEvents, query])

  function handleSelect(startKey: string) {
    onNavigate(parseDateTimeKey(startKey))
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <input
          className={styles.input}
          placeholder="일정 검색 (제목, 메모)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          autoFocus
        />
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="검색 닫기">
          ✕
        </button>
      </div>
      <div className={styles.results}>
        {query.trim() === '' ? (
          <p className={styles.hint}>제목이나 메모로 일정을 찾아보세요.</p>
        ) : results.length === 0 ? (
          <p className={styles.hint}>검색 결과가 없어요.</p>
        ) : (
          results.map((event) => (
            <button key={event.id} type="button" className={styles.resultRow} onClick={() => handleSelect(event.start)}>
              <span className={styles.dot} style={{ background: resolveEventColor(event, categoryColor) }} />
              <span className={styles.resultDate}>{formatShortDate(parseDateTimeKey(event.start))}</span>
              <span className={styles.resultTitle}>{event.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default SearchDialog
