// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 보기 전환 + 일정 에디터 모달
import { useState } from 'react'
import AgendaView from './components/AgendaView'
import styles from './components/App.module.css'
import DayView from './components/DayView'
import EventEditor from './components/EventEditor'
import Header from './components/Header'
import MonthView from './components/MonthView'
import Sidebar from './components/Sidebar'
import WeekView from './components/WeekView'
import { toDateKey } from './lib/date'
import { CalendarProvider, useCalendar } from './state/useCalendar'
import type { CalendarEvent } from './types'

interface EditorTarget {
  event: CalendarEvent | null // null이면 새 일정 생성
  date: string
  hour?: number // 주/일 보기에서 시간칸을 클릭해 생성할 때만 사용
}

function CalendarApp() {
  const { view, selectedDate } = useCalendar()
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)

  function openForEvent(event: CalendarEvent) {
    setEditorTarget({ event, date: toDateKey(selectedDate) })
  }

  function openForNewEvent() {
    setEditorTarget({ event: null, date: toDateKey(selectedDate) })
  }

  function openForSlot(date: Date, hour: number) {
    setEditorTarget({ event: null, date: toDateKey(date), hour })
  }

  return (
    <div className={styles.app}>
      <Sidebar />
      <div className={styles.column}>
        <Header onNewEvent={openForNewEvent} />
        <main className={styles.main}>
          {view === 'month' && <MonthView onSelectEvent={openForEvent} />}
          {view === 'week' && <WeekView onSelectEvent={openForEvent} onCreateEvent={openForSlot} />}
          {view === 'day' && <DayView onSelectEvent={openForEvent} onCreateEvent={openForSlot} />}
          {view === 'agenda' && <AgendaView onSelectEvent={openForEvent} />}
        </main>
      </div>
      {editorTarget && (
        <EventEditor
          event={editorTarget.event}
          defaultDate={editorTarget.date}
          defaultHour={editorTarget.hour}
          onClose={() => setEditorTarget(null)}
        />
      )}
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
