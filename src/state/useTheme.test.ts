// useTheme: localStorage 저장/복원과 <html data-theme> 반영을 검증
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyStoredTheme, useTheme } from './useTheme'

function reset() {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-scheme')
}

beforeEach(reset)
afterEach(reset)

describe('useTheme', () => {
  it('저장된 값이 없으면 기본 테마로 시작하고 data-theme 속성을 붙이지 않는다', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('default')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('zigzag로 바꾸면 data-theme 속성과 localStorage가 갱신된다', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('zigzag'))

    expect(result.current.theme).toBe('zigzag')
    expect(document.documentElement.getAttribute('data-theme')).toBe('zigzag')
    expect(localStorage.getItem('calendar.theme')).toBe('zigzag')
  })

  it('저장된 테마가 있으면 다음 마운트에서 그대로 복원한다', () => {
    localStorage.setItem('calendar.theme', 'zigzag')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('zigzag')
  })
})

describe('applyStoredTheme', () => {
  // 회귀 테스트: useTheme()가 설정 모달을 열 때만 마운트되는 ThemeToggle 안에만 있어서,
  // 저장된 테마가 새로고침 후 모달을 열기 전까지 반영 안 되던 버그(보스 리뷰에서 발견)
  it('React 마운트 없이도 저장된 테마를 <html>에 적용한다', () => {
    localStorage.setItem('calendar.theme', 'zigzag')
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('zigzag')
  })

  it('저장된 값이 없으면 data-theme을 안 붙인다', () => {
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})

describe('모양(시스템/라이트/다크)', () => {
  it('저장된 값이 없으면 "시스템"이고, jsdom처럼 matchMedia가 없으면 라이트로 푼다', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.scheme).toBe('system')
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-scheme')).toBe('light')
  })

  it('다크로 바꾸면 data-scheme과 localStorage가 갱신되고, 테마와 독립적이다', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setScheme('dark'))

    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark')
    expect(localStorage.getItem('calendar.scheme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()

    act(() => result.current.setTheme('zigzag'))
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('zigzag')
  })

  it('저장된 다크를 부팅 시점에 React 없이 적용한다', () => {
    localStorage.setItem('calendar.scheme', 'dark')
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark')
  })

  it('theme-color 메타를 모양·테마에 맞춰 바꾼다', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#ffffff" />')
    const meta = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    localStorage.setItem('calendar.scheme', 'dark')
    applyStoredTheme()
    expect(meta()).toBe('#000000')
    localStorage.setItem('calendar.theme', 'zigzag')
    applyStoredTheme()
    expect(meta()).toBe('#121212')
    document.querySelector('meta[name="theme-color"]')?.remove()
  })
})
