// 모바일 전용 "할 일" 바텀시트: Sidebar가 숨는 768px 미만에서 Header 버튼으로 연다
import TodoList from './TodoList'
import styles from './TodoSheet.module.css'

interface TodoSheetProps {
  onClose: () => void
}

function TodoSheet({ onClose }: TodoSheetProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.heading}>할 일</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <TodoList />
      </div>
    </div>
  )
}

export default TodoSheet
