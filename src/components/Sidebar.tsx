// 데스크탑 사이드바: 미니 캘린더 자리(준비 중) + 카테고리 관리 + 데이터 백업 (768px 미만에서 숨김)
import CategoryList from './CategoryList'
import DataBackup from './DataBackup'
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
        <CategoryList />
      </div>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>데이터</p>
        <DataBackup />
      </div>
    </aside>
  )
}

export default Sidebar
