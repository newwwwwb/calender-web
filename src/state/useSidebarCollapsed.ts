// 사이드바 접힘 상태(바탕화면 위젯에서 펼치고 접기). localStorage에 저장한다.
import { useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'calendar.sidebarCollapsed'

interface SidebarCollapsedState {
  collapsed: boolean
  toggle: () => void
}

export function useSidebarCollapsed(): SidebarCollapsedState {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
  }

  return { collapsed, toggle }
}
