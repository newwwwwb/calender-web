// 설정 모달: 카테고리 + 공유 캘린더 + 데이터 내보내기/가져오기 + 기본 보기 + 디자인 테마 선택. 데스크탑/모바일 어디서든 Header 버튼으로 연다
// 카테고리·공유 캘린더는 Sidebar에도 있지만, Sidebar가 768px 미만에서 숨어서 모바일은 여기가 유일한 접근 경로다(보스 리뷰에서 발견).
import CategoryList from './CategoryList'
import DataBackup from './DataBackup'
import DefaultViewSelect from './DefaultViewSelect'
import ShareSection from './ShareSection'
import styles from './SettingsModal.module.css'
import ThemeToggle from './ThemeToggle'

interface SettingsModalProps {
  onClose: () => void
}

function SettingsModal({ onClose }: SettingsModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.heading}>설정</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>카테고리</p>
          <CategoryList />
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>공유 캘린더</p>
          <ShareSection />
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>데이터</p>
          <DataBackup />
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>기본 보기</p>
          <DefaultViewSelect />
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>디자인</p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
