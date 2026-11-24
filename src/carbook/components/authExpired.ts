// 인증 만료 상태(NTC-01)를 대화상자들이 읽는 컨텍스트와 저장·확정 버튼을 잠그는 props
import { createContext, useContext, type MouseEvent } from 'react'

export type AuthExpiredValue = {
  expired: boolean
  onLogin: () => Promise<void> // 돌아올 주소가 /car인 Google 로그인을 시작한다. 성공하면 페이지가 바뀐다
  onDismiss: () => void
}

export const AuthExpiredContext = createContext<AuthExpiredValue>({ expired: false, onLogin: () => Promise.resolve(), onDismiss: () => {} })

export function useAuthExpired(): boolean {
  return useContext(AuthExpiredContext).expired
}

// 만료 중에는 저장·확정 버튼을 누를 수 없다. disabled 대신 aria-disabled: 눌린 버튼이 disabled가 되면 포커스가 body로 빠진다(Enter 제출도 이 버튼의 클릭이라 막힌다)
export function expiredProps(expired: boolean) {
  if (!expired) return {}
  return {
    'aria-disabled': true as const,
    onClickCapture: (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
