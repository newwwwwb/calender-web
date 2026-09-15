// useTheme: localStorage 저장/복원과 <html data-theme> 반영을 검증
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

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
