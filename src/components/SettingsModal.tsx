// 설정 모달: 데이터 내보내기/가져오기 + 디자인 테마 선택. 데스크탑/모바일 어디서든 Header 버튼으로 연다
import DataBackup from './DataBackup'
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
          <p className={styles.sectionTitle}>데이터</p>
          <DataBackup />
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
