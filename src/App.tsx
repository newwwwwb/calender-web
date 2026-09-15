// 캘린더 앱의 최상위 컴포넌트: 사이드바 + 헤더 + 메인 영역으로 구성된 앱 셸
import styles from './components/App.module.css'
import Header from './components/Header'
import MonthView from './components/MonthView'
import Sidebar from './components/Sidebar'
import { CalendarProvider } from './state/useCalendar'

function App() {
  return (
    <CalendarProvider>
      <div className={styles.app}>
        <Sidebar />
        <div className={styles.column}>
          <Header />
          <main className={styles.main}>
            <MonthView />
          </main>
        </div>
      </div>
    </CalendarProvider>
  )
}

export default App
