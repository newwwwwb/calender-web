// 토스트 한 개를 화면 아래에 띄우는 뷰포트: 스프링으로 올라오고, 아래로 쓸어 내리면 닫히고, 스크린리더에 읽힌다
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { exitFast, project, springSnappy } from '../lib/motion'
import type { ToastItem } from '../state/useToast'
import styles from './ToastViewport.module.css'

interface ToastViewportProps {
  items: ToastItem[]
  onDismiss: (id: number) => void
}

function ToastViewport({ items, onDismiss }: ToastViewportProps) {
  const reduceMotion = useReducedMotion()

  // body에 직접 붙인다 — 오버레이가 열린 동안 #root 쪽 형제를 inert로 막는데, 그때도 토스트(특히 오류)는 눌리고 읽혀야 한다.
  // data-keep-active는 Overlay의 inert 처리가 건너뛰는 표시다.
  return createPortal(
    <div className={styles.region} data-keep-active>
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            className={toast.tone === 'error' ? styles.toastError : styles.toast}
            // 오류는 즉시 읽히게 alert, 일반 안내는 정중하게 status
            role={toast.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: exitFast }}
            transition={springSnappy}
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_event, info) => {
              if (info.offset.y + project(info.velocity.y) > 60) onDismiss(toast.id)
            }}
          >
            <span className={styles.message}>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.onAction?.()
                  onDismiss(toast.id)
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

export default ToastViewport
