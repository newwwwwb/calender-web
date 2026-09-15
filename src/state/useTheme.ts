// 디자인 테마(기본/ZIGZAG 참고) 선택 상태. localStorage에 저장하고 <html data-theme>에 반영한다.
import { useEffect, useState } from 'react'

export type Theme = 'default' | 'zigzag'
const THEME_KEY = 'calendar.theme'

function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'zigzag' ? 'zigzag' : 'default'
}

// main.tsx가 React 마운트 전에 호출한다 — useTheme()는 설정 모달이 열릴 때만 마운트되는
// ThemeToggle 안에서만 쓰이므로, 모달을 한 번도 안 열면 저장된 테마가 새로고침 후 복원되지
// 않는 버그(보스 리뷰에서 발견)가 있었다. 부팅 시점에 한 번 직접 적용해서 그 문제를 피한다.
export function applyStoredTheme(): void {
  if (readTheme() === 'zigzag') document.documentElement.setAttribute('data-theme', 'zigzag')
  else document.documentElement.removeAttribute('data-theme')
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    if (theme === 'zigzag') document.documentElement.setAttribute('data-theme', 'zigzag')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return { theme, setTheme }
}
