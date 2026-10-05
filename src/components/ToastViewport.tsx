// 토스트 한 개를 화면 아래에 띄우는 뷰포트: 스프링으로 올라오고, 아래로 쓸어 내리면 닫히고, 스크린리더에 읽힌다
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { exitFast, project, springSnappy } from '../lib/motion'
import type { ToastItem } from '../state/useToast'
import styles from './ToastViewport.module.css'

interface ToastViewportProps {
  items: ToastItem[]
  onDismiss: (id: number) => void
  onPause: (id: number) => void // 마우스를 올리거나 포커스가 안에 있는 동안 사라지지 않게
  onResume: (id: number) => void
}

// 토스트를 body의 "맨 앞"에 둔다. 맨 뒤에 두면 키보드 사용자가 문서 전체를 지나야 "되돌리기"에 닿았다(25단계 최종 심사) —
// 맨 앞이면 삭제 직후(포커스가 문서 처음으로 돌아가므로) 첫 Tab으로 바로 닿는다. data-keep-active는 Overlay의 inert 처리가 건너뛰는 표시다.
// 모듈 하나가 호스트를 한 번만 만든다(싱글턴) — 렌더 중에 매번 만들면 StrictMode의 이중 렌더로 요소가 두 개 생기고, 효과 안에서 만들면
// setState가 필요해 lint 경고가 는다. 이미 붙어 있으면 그대로 돌려주므로 몇 번 불려도 하나뿐이다.
let toastHost: HTMLElement | null = null
function getToastHost(): HTMLElement {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = document.createElement('div')
    toastHost.setAttribute('data-keep-active', '')
    document.body.prepend(toastHost)
  }
  return toastHost
}

function ToastViewport({ items, onDismiss, onPause, onResume }: ToastViewportProps) {
  const reduceMotion = useReducedMotion()
  return createPortal(
    <div className={styles.region}>
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
            onPointerEnter={() => onPause(toast.id)}
            onPointerLeave={() => onResume(toast.id)}
            onFocus={() => onPause(toast.id)}
            onBlur={() => onResume(toast.id)}
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
                // 되돌리기에는 키보드 단축키가 있다는 걸 알린다(useToast의 Ctrl/Cmd+Z)
                title={toast.actionLabel === '되돌리기' ? '되돌리기 (Ctrl+Z)' : undefined}
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
    getToastHost(),
  )
}

export default ToastViewport
