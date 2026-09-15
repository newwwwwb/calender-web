// 데스크탑 사이드바: 미니 캘린더 자리(준비 중) + 할 일 + 카테고리 관리 + 공유 캘린더 (768px 미만에서 숨김)
// 데이터 백업/디자인 테마는 Header의 설정(⚙) 버튼 → SettingsModal로 옮김
import CategoryList from './CategoryList'
import ShareSection from './ShareSection'
import styles from './Sidebar.module.css'
import TodoList from './TodoList'

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>미니 캘린더</p>
        <p className={styles.placeholder}>준비 중</p>
      </div>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>할 일</p>
        <TodoList />
      </div>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>카테고리</p>
        <CategoryList />
      </div>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>공유 캘린더</p>
        <ShareSection />
      </div>
    </aside>
  )
}

export default Sidebar
