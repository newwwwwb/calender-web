// 앱 전역 토스트 알림: 저장·삭제 실패 안내("다시 시도")와 삭제 뒤 "되돌리기"를 한 곳에서 띄운다
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), [])

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      // 한 번에 하나만 — 연달아 실패해도 화면이 토스트로 쌓이지 않게 직전 것을 대체한다
      setItems([{ ...options, id }])
      window.setTimeout(() => dismiss(id), options.actionLabel ? DURATION_WITH_ACTION_MS : DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
