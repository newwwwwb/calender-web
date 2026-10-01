// 화면 설정 상태: 디자인 테마(기본/ZIGZAG)와 모양(시스템/라이트/다크)을 별개 축으로 두고, 둘 다 localStorage에 저장해 <html>에 반영한다.
import { useState } from 'react'

export type Theme = 'default' | 'zigzag'
export type SchemePref = 'system' | 'light' | 'dark'
export type Scheme = 'light' | 'dark'

const THEME_KEY = 'calendar.theme'
const SCHEME_KEY = 'calendar.scheme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// 브라우저 주소창·상태 바 색(<meta name="theme-color">). 각 모양의 --color-canvas와 같게 둔다
const CHROME_COLOR: Record<Theme, Record<Scheme, string>> = {
  default: { light: '#ffffff', dark: '#000000' },
  zigzag: { light: '#ffffff', dark: '#121212' },
}

function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'zigzag' ? 'zigzag' : 'default'
}

function readScheme(): SchemePref {
  const v = localStorage.getItem(SCHEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

// jsdom엔 matchMedia가 없다 — 없으면 라이트로 본다
function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

export function resolveScheme(pref: SchemePref): Scheme {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref
}

// "시스템"이든 직접 고른 값이든 항상 data-scheme을 light/dark로 풀어서 붙인다 — CSS가 미디어쿼리를 중복하지 않아도 된다
function applyAppearance(theme: Theme, pref: SchemePref): void {
  const root = document.documentElement
  if (theme === 'zigzag') root.setAttribute('data-theme', 'zigzag')
  else root.removeAttribute('data-theme')
  const scheme = resolveScheme(pref)
  root.setAttribute('data-scheme', scheme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME_COLOR[theme][scheme])
}

// 라이트↔다크처럼 화면 전체 색이 바뀔 때는 크로스페이드로 부드럽게 넘긴다. 지원하지 않거나 동작 줄이기 상태면 즉시 바꾼다
function withTransition(change: () => void): void {
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || typeof document.startViewTransition !== 'function') change()
  else document.startViewTransition(change)
}

// main.tsx가 React 마운트 전에 호출한다 — useTheme()는 설정 모달이 열릴 때만 마운트되는
// ThemeToggle 안에서만 쓰이므로, 모달을 한 번도 안 열면 저장된 설정이 새로고침 후 복원되지
// 않는 버그(보스 리뷰에서 발견)가 있었다. 부팅 시점에 한 번 직접 적용해서 그 문제를 피한다.
// (index.html의 인라인 스크립트가 첫 페인트 전에 같은 일을 먼저 한다 — 다크에서 흰 화면이 번쩍이지 않게)
export function applyStoredTheme(): void {
  applyAppearance(readTheme(), readScheme())
  // 모양이 "시스템"이면 OS 설정이 바뀔 때 따라간다
  if (typeof window.matchMedia === 'function') {
    window.matchMedia(DARK_QUERY).addEventListener('change', () => {
      if (readScheme() === 'system') applyAppearance(readTheme(), 'system')
    })
  }
}

interface ThemeState {
  theme: Theme
  scheme: SchemePref
  setTheme: (theme: Theme) => void
  setScheme: (scheme: SchemePref) => void
}

export function useTheme(): ThemeState {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [scheme, setSchemeState] = useState<SchemePref>(readScheme)

  function setTheme(next: Theme) {
    localStorage.setItem(THEME_KEY, next)
    withTransition(() => applyAppearance(next, readScheme()))
    setThemeState(next)
  }

  function setScheme(next: SchemePref) {
    localStorage.setItem(SCHEME_KEY, next)
    withTransition(() => applyAppearance(readTheme(), next))
    setSchemeState(next)
  }

  return { theme, scheme, setTheme, setScheme }
}
