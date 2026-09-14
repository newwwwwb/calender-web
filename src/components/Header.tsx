// 캘린더 상단 헤더: 앱 이름, 날짜 네비게이션, 보기 전환 (정적 셸, 동작 없음)
import styles from './Header.module.css'

const VIEWS = ['월', '주', '일', '목록'] as const

function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.title}>캘린더</span>
      <nav className={styles.nav}>
        <button type="button" className={styles.iconButton} aria-label="이전">
          ‹
        </button>
        <button type="button" className={styles.iconButton} aria-label="다음">
          ›
        </button>
        <button type="button" className={styles.todayButton}>
          오늘
        </button>
      </nav>
      <div className={styles.spacer} />
      <div className={styles.viewSwitch}>
        {VIEWS.map((view, index) => (
          <button
            key={view}
            type="button"
            className={index === 0 ? styles.viewButtonActive : styles.viewButton}
          >
            {view}
          </button>
        ))}
      </div>
    </header>
  )
}

export default Header
