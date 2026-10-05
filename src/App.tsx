// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 보기 전환 + 일정 에디터 모달
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
import { formatTitle, stepDate, toDateKey } from './lib/date'
import { springDefault } from './lib/motion'
import { CalendarProvider, FreezeCalendarWhenExiting, useCalendar } from './state/useCalendar'
import { ToastProvider } from './state/useToast'
import { useKeyboardShortcuts } from './state/useKeyboardShortcuts'
import { MOBILE_QUERY, useMediaQuery } from './state/useMediaQuery'
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
  // 위젯 창도 767px 이하로 줄일 수 있다(스크립트 최소 400) — 그 폭에선 Sidebar가 CSS로 숨고 헤더에 접기 버튼도
  // 없으므로 폭 애니메이션 래퍼를 쓰지 않는다(래퍼의 256px 인라인 폭만 남아 빈 칸이 생겼다, 2차 보스 리뷰)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  // MotionConfig reducedMotion은 transform만 끄고 width 애니메이션은 그대로라 직접 끈다
  const reduceMotion = useReducedMotion()

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
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      {/* 문서의 유일한 h1을 DOM 맨 앞에 둔다 — 사이드바 h2가 h1보다 먼저 나오지 않게. 화면에는 헤더의 기간 제목이 있어 숨긴다 */}
      <h1 className="sr-only">캘린더 앱</h1>
      {/* 기간이 바뀌면(←/→·‹›·T·스와이프·보기 전환) 스크린리더에 알린다 — 라이브 영역이 하나도 없어서 화면이 바뀐 줄 몰랐다(25단계 접근성 감사) */}
      <div className="sr-only" role="status" aria-live="polite">
        {formatTitle(view, currentDate)}
      </div>
      {/* 사이드바 접기는 위젯 모드에서만 쓴다 — 웹은 폭 애니메이션 래퍼 없이 그대로 렌더한다
          (래퍼를 웹에서도 씌우면 모바일에서 Sidebar 자체는 CSS로 숨어도 래퍼의 256px 폭은 남아 빈 칸이 생긴다) */}
      {widget && !isMobile ? (
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              key="sidebar"
              // display:flex — 래퍼 안에서도 aside가 창 높이까지 늘어나 오른쪽 구분선이 바닥까지 이어지게
              style={{ overflow: 'hidden', flexShrink: 0, display: 'flex' }}
              initial={{ width: 0 }}
              animate={{ width: 256 }}
              exit={{ width: 0 }}
              transition={reduceMotion ? { duration: 0 } : springDefault}
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <Sidebar />
      )}
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
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <SwipeableViewport
            view={view}
            currentDate={currentDate}
            onSwipe={(delta) => setCurrentDate(stepDate(view, currentDate, delta))}
          >
            <FreezeCalendarWhenExiting>
              {view === 'month' && <MonthView onSelectEvent={openForInstance} />}
              {view === 'week' && <WeekView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
              {view === 'day' && <DayView onSelectEvent={openForInstance} onCreateEvent={openForSlot} />}
              {view === 'agenda' && <AgendaView onSelectEvent={openForInstance} onNewEvent={openForNewEvent} />}
            </FreezeCalendarWhenExiting>
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
        {searchOpen && (
          <SearchDialog key="search" onClose={() => setSearchOpen(false)} onNavigate={navigateToDate} onOpenEvent={openForInstance} />
        )}
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
    <ToastProvider>
      <CalendarProvider>
        <CalendarApp />
      </CalendarProvider>
    </ToastProvider>
  )
}

export default App
