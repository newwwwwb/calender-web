// 디자인 테마(기본/ZIGZAG 참고) 선택 상태. localStorage에 저장하고 <html data-theme>에 반영한다.
import { useEffect, useState } from 'react'

export type Theme = 'default' | 'zigzag'
const THEME_KEY = 'calendar.theme'

function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'zigzag' ? 'zigzag' : 'default'
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
