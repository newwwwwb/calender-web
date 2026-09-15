// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 보기 전환 + 일정 에디터 모달
import { useState } from 'react'
import AgendaView from './components/AgendaView'
import styles from './components/App.module.css'
import DayView from './components/DayView'
import EventEditor from './components/EventEditor'
import Header from './components/Header'
import MonthView from './components/MonthView'
import SearchDialog from './components/SearchDialog'
import Sidebar from './components/Sidebar'
import WeekView from './components/WeekView'
import { stepDate, toDateKey } from './lib/date'
import { CalendarProvider, useCalendar } from './state/useCalendar'
import { useKeyboardShortcuts } from './state/useKeyboardShortcuts'
import { useSwipeNavigation } from './state/useSwipeNavigation'
import type { EventInstance } from './types'

interface EditorTarget {
  instance: EventInstance | null // null이면 새 일정 생성
  date: string
  hour?: number // 주/일 보기에서 시간칸을 클릭해 생성할 때만 사용
}

function CalendarApp() {
  const { view, currentDate, selectedDate, setCurrentDate, setSelectedDate, changeView } = useCalendar()
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  function navigateToDate(date: Date) {
    setCurrentDate(date)
    setSelectedDate(date)
  }

  function openForInstance(instance: EventInstance) {
    setEditorTarget({ instance, date: toDateKey(selectedDate) })
  }

  function openForNewEvent() {
    setEditorTarget({ instance: null, date: toDateKey(selectedDate) })
  }

  function openForSlot(date: Date, hour: number) {
    setEditorTarget({ instance: null, date: toDateKey(date), hour })
  }

  useKeyboardShortcuts({
    view,
    currentDate,
    setCurrentDate,
    setSelectedDate,
    changeView,
    onNewEvent: openForNewEvent,
    onSearch: () => setSearchOpen(true),
    onEscape: () => {
      setEditorTarget(null)
      setSearchOpen(false)
    },
    disabled: editorTarget !== null || searchOpen,
  })

  const swipe = useSwipeNavigation({
    onSwipeLeft: () => setCurrentDate(stepDate(view, currentDate, 1)),
    onSwipeRight: () => setCurrentDate(stepDate(view, currentDate, -1)),
  })

  return (
    <div className={styles.app}>
      <Sidebar />
      <div className={styles.column}>
        <Header onNewEvent={openForNewEvent} onSearch={() => setSearchOpen(true)} />
        <main className={styles.main} onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
          {view === 'month' && <MonthView onSelectEvent={openForInstance} />}
          {view === 'week' && <WeekView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
          {view === 'day' && <DayView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
          {view === 'agenda' && <AgendaView onSelectEvent={openForInstance} />}
        </main>
        <button type="button" className={styles.fab} aria-label="새 일정" onClick={openForNewEvent}>
          +
        </button>
      </div>
      {editorTarget && (
        <EventEditor
          instance={editorTarget.instance}
          defaultDate={editorTarget.date}
          defaultHour={editorTarget.hour}
          onClose={() => setEditorTarget(null)}
        />
      )}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} onNavigate={navigateToDate} />}
    </div>
  )
}

function App() {
  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  )
}

export default App
