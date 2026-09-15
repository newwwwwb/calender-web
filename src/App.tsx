// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 메인 영역 + 일정 에디터 모달
import { useState } from 'react'
import styles from './components/App.module.css'
import EventEditor from './components/EventEditor'
import Header from './components/Header'
import MonthView from './components/MonthView'
import Sidebar from './components/Sidebar'
import { toDateKey } from './lib/date'
import { CalendarProvider, useCalendar } from './state/useCalendar'
import type { CalendarEvent } from './types'

interface EditorTarget {
  event: CalendarEvent | null // null이면 새 일정 생성
  date: string
}

function CalendarApp() {
  const { selectedDate } = useCalendar()
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)

  return (
    <div className={styles.app}>
      <Sidebar />
      <div className={styles.column}>
        <Header onNewEvent={() => setEditorTarget({ event: null, date: toDateKey(selectedDate) })} />
        <main className={styles.main}>
          <MonthView onSelectEvent={(event) => setEditorTarget({ event, date: toDateKey(selectedDate) })} />
        </main>
      </div>
      {editorTarget && (
        <EventEditor
          event={editorTarget.event}
          defaultDate={editorTarget.date}
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
