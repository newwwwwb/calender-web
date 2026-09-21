// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 보기 전환 + 일정 에디터 모달
import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import AcceptSharePage from './components/AcceptSharePage'
import AgendaView from './components/AgendaView'
import styles from './components/App.module.css'
import DayView from './components/DayView'
import EventEditor from './components/EventEditor'
import Header from './components/Header'
import { PlusIcon } from './components/icons'
import MonthView from './components/MonthView'
import NotificationPanel from './components/NotificationPanel'
import SearchDialog from './components/SearchDialog'
import SettingsModal from './components/SettingsModal'
import Sidebar from './components/Sidebar'
import SwipeableViewport from './components/SwipeableViewport'
import TodoSheet from './components/TodoSheet'
import WeekView from './components/WeekView'
import { stepDate, toDateKey } from './lib/date'
import { CalendarProvider, useCalendar } from './state/useCalendar'
import { useKeyboardShortcuts } from './state/useKeyboardShortcuts'
import { useNotifications } from './state/useNotifications'
import { useSidebarCollapsed } from './state/useSidebarCollapsed'
import { isWidgetMode } from './state/widgetMode'
import type { EventInstance } from './types'

// 라우터 없이 "/share/:id" 한 경로만 처리한다
function matchShareId(pathname: string): string | null {
  const match = pathname.match(/^\/share\/([^/]+)$/)
  return match ? match[1] : null
}

interface EditorTarget {
  instance: EventInstance | null // null이면 새 일정 생성
  date: string
  hour?: number // 주/일 보기에서 시간칸을 클릭해 생성할 때만 사용
}

function CalendarApp() {
  const { view, currentDate, selectedDate, currentUserId, reload, respondToEvent, setCurrentDate, setSelectedDate, changeView } =
    useCalendar()
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [todoSheetOpen, setTodoSheetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { notifications, unreadCount, markAllRead } = useNotifications({ userId: currentUserId, onChanged: reload })
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapsed()
  const widget = isWidgetMode() // 사이드바 접기는 바탕화면 위젯에서만 쓴다(웹은 항상 펼침)

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
      setTodoSheetOpen(false)
      setSettingsOpen(false)
      setNotificationsOpen(false)
    },
    disabled: editorTarget !== null || searchOpen || todoSheetOpen || settingsOpen || notificationsOpen,
  })

  function openNotifications() {
    setNotificationsOpen(true)
    markAllRead()
  }

  return (
    <div className={styles.app}>
      {!(widget && sidebarCollapsed) && <Sidebar />}
      <div className={styles.column}>
        <Header
          onNewEvent={openForNewEvent}
          onSearch={() => setSearchOpen(true)}
          onOpenTodos={() => setTodoSheetOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenNotifications={openNotifications}
          unreadCount={unreadCount}
          onToggleSidebar={widget ? toggleSidebar : undefined}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className={styles.main}>
          <SwipeableViewport
            view={view}
            currentDate={currentDate}
            onSwipe={(delta) => setCurrentDate(stepDate(view, currentDate, delta))}
          >
            {view === 'month' && <MonthView onSelectEvent={openForInstance} />}
            {view === 'week' && <WeekView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
            {view === 'day' && <DayView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
            {view === 'agenda' && <AgendaView onSelectEvent={openForInstance} />}
          </SwipeableViewport>
        </main>
        <button type="button" className={styles.fab} aria-label="새 일정" onClick={openForNewEvent}>
          <PlusIcon />
        </button>
      </div>
      <AnimatePresence>
        {editorTarget && (
          <EventEditor
            key="event-editor"
            instance={editorTarget.instance}
            defaultDate={editorTarget.date}
            defaultHour={editorTarget.hour}
            onClose={() => setEditorTarget(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {searchOpen && <SearchDialog key="search" onClose={() => setSearchOpen(false)} onNavigate={navigateToDate} />}
      </AnimatePresence>
      <AnimatePresence>
        {todoSheetOpen && <TodoSheet key="todo-sheet" onClose={() => setTodoSheetOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && <SettingsModal key="settings" onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {notificationsOpen && (
          <NotificationPanel
            key="notifications"
            notifications={notifications}
            onClose={() => setNotificationsOpen(false)}
            onRespond={respondToEvent}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function App() {
  const shareId = matchShareId(window.location.pathname)
  if (shareId) return <AcceptSharePage shareId={shareId} />

  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  )
}

export default App
