// 데스크탑 사이드바: 미니 캘린더·카테고리 자리 (768px 미만에서 숨김)
import styles from './Sidebar.module.css'

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>미니 캘린더</p>
        <p className={styles.placeholder}>준비 중</p>
      </div>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>카테고리</p>
        <p className={styles.placeholder}>준비 중</p>
      </div>
    </aside>
  )
}

export default Sidebar
