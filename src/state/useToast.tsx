// 앱 전역 토스트 알림: 저장·삭제 실패 안내("다시 시도")와 삭제 뒤 "되돌리기"를 한 곳에서 띄운다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ToastViewport from '../components/ToastViewport'

export interface ToastOptions {
  message: string
  tone?: 'info' | 'error'
  actionLabel?: string // 있으면 버튼이 붙는다(되돌리기·다시 시도)
  onAction?: () => void
}

export interface ToastItem extends ToastOptions {
  id: number
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
}

// Provider 밖(단위 테스트 등)에서는 조용히 삼키지 않고 콘솔에라도 남긴다
const ToastContext = createContext<ToastContextValue>({
  showToast: (options) => {
    if (options.tone === 'error') console.error(options.message)
  },
})

// 되돌리기·다시 시도 버튼이 있으면 누를 시간을 더 준다
const DURATION_MS = 4000
const DURATION_WITH_ACTION_MS = 7000

// 최대 동시 개수: 오류 "다시 시도"가 뒤이은 일반 토스트에 덮여 사라지지 않도록 몇 개는 함께 둔다(가장 오래된 것부터 밀려난다)
const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())
  const durations = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    durations.current.delete(id)
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const start = useCallback(
    (id: number) => {
      window.clearTimeout(timers.current.get(id))
      timers.current.set(id, window.setTimeout(() => dismiss(id), durations.current.get(id) ?? DURATION_MS))
    },
    [dismiss],
  )

  // 마우스를 올리거나 키보드 포커스가 안에 있는 동안은 사라지지 않는다 — 시간 제한이 있는 안내는 사용자가 읽고 조작할 때까지 기다려야 한다(WCAG 2.2.1)
  const pause = useCallback((id: number) => window.clearTimeout(timers.current.get(id)), [])

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      durations.current.set(id, options.actionLabel ? DURATION_WITH_ACTION_MS : DURATION_MS)
      setItems((prev) => {
        const next = [...prev, { ...options, id }]
        // 밀려나는 토스트의 타이머도 정리한다
        for (const old of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
          window.clearTimeout(timers.current.get(old.id))
          timers.current.delete(old.id)
          durations.current.delete(old.id)
        }
        return next.slice(-MAX_TOASTS)
      })
      start(id)
    },
    [start],
  )

  useEffect(() => {
    const t = timers.current
    return () => t.forEach((handle) => window.clearTimeout(handle))
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} onPause={pause} onResume={start} />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
