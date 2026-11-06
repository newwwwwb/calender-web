// 입력 양식 대화상자가 창 밖(스크림) 클릭으로 닫히지 않게 막는 훅(screens.md 공통 규칙, UA-7: 입력값을 실수로 잃지 않게)
import { useEffect, type RefObject } from 'react'

// Overlay는 스크림 클릭을 onClose로 이어 주고 고칠 수 없으므로, 양식 안의 요소(ref)가 속한 스크림에 오는 클릭만 React보다 먼저 삼킨다.
// Esc와 "취소" 버튼은 그대로 닫는다. 다른 대화상자(예: 그 위에 열린 확인창)의 스크림은 건드리지 않는다.
export function useIgnoreScrimClick(inside: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function swallow(event: MouseEvent) {
      const scrim = inside.current?.closest('[role="dialog"]')?.parentElement
      if (scrim && event.target === scrim) event.stopPropagation()
    }
    document.addEventListener('click', swallow, true) // 캡처 단계: React 루트의 onClick보다 먼저
    return () => document.removeEventListener('click', swallow, true)
  }, [inside])
}
