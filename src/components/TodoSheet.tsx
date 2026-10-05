// 모바일 전용 "할 일" 바텀시트: Sidebar가 숨는 900px 미만에서 Header 버튼으로 연다
import Overlay from './Overlay'
import styles from './TodoSheet.module.css'
import TodoList from './TodoList'
import { CloseIcon } from './icons'

interface TodoSheetProps {
  onClose: () => void
}

function TodoSheet({ onClose }: TodoSheetProps) {
  return (
    <Overlay
      onClose={onClose}
      label="할 일"
      header={
        <div className={styles.header}>
          <h2 className={styles.heading}>할 일</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
      }
    >
      <TodoList />
    </Overlay>
  )
}

export default TodoSheet
