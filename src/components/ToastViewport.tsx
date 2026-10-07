// 토스트 한 개를 화면 아래에 띄우는 뷰포트: 스프링으로 올라오고, 아래로 쓸어 내리면 닫히고, 스크린리더에 읽힌다
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { exitFast, project, springSnappy } from '../lib/motion'
import { useMediaQuery } from '../state/useMediaQuery'
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

// 마우스 환경(hover: hover + pointer: fine)에서는 토스트 몸통이 pointer-events: none이라(뒤 화면의 칩을 끌 수 있게, 31단계) 몸통 위 호버를
// onPointerEnter로 알 수 없다 — 포인터 좌표가 토스트 사각형 안인지로 판정해 같은 일시정지(WCAG 2.2.1)를 지킨다
const MOUSE_QUERY = '(hover: hover) and (pointer: fine)'

function ToastViewport({ items, onDismiss, onPause, onResume }: ToastViewportProps) {
  const reduceMotion = useReducedMotion()
  const regionRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ items, onPause, onResume })
  useEffect(() => {
    latest.current = { items, onPause, onResume }
  })
  // 입력 방식은 실행 중에도 바뀐다(2-in-1에서 마우스를 꽂고 뗌) — change를 구독해 따라간다
  const isMouse = useMediaQuery(MOUSE_QUERY)
  useEffect(() => {
    if (!isMouse) return
    const over = new Set<number>()
    function onMove(e: PointerEvent) {
      const region = regionRef.current
      if (!region) return
      for (const el of region.querySelectorAll<HTMLElement>('[data-toast-id]')) {
        const id = Number(el.dataset.toastId)
        if (!latest.current.items.some((t) => t.id === id)) continue // 퇴장 중인 토스트는 타이머가 없다
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          over.add(id)
          latest.current.onPause(id) // 이미 멈춰 있어도 다시 불러 무방하다(타이머만 지운다)
        } else if (over.delete(id)) {
          latest.current.onResume(id)
        }
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      // 마우스가 빠져 판정이 끝나면 호버로 멈춰 있던 토스트의 시간이 다시 흐르게 한다
      for (const id of over) if (latest.current.items.some((t) => t.id === id)) latest.current.onResume(id)
    }
  }, [isMouse])
  return createPortal(
    <div className={styles.region} ref={regionRef}>
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            data-toast-id={toast.id}
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
