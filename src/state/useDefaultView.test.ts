// useDefaultView: localStorage 저장/복원을 검증
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDefaultView } from './useDefaultView'

beforeEach(() => {
  localStorage.clear()
})

describe('useDefaultView', () => {
  it('저장된 값이 없으면 월(month)로 시작한다', () => {
    const { result } = renderHook(() => useDefaultView())
    expect(result.current.defaultView).toBe('month')
  })

  it('바꾸면 상태와 localStorage가 갱신된다', () => {
    const { result } = renderHook(() => useDefaultView())
    act(() => result.current.setDefaultView('week'))

    expect(result.current.defaultView).toBe('week')
    expect(localStorage.getItem('calendar.defaultView')).toBe('week')
  })

  it('저장된 값이 있으면 다음 마운트에서 그대로 복원한다', () => {
    localStorage.setItem('calendar.defaultView', 'agenda')
    const { result } = renderHook(() => useDefaultView())
    expect(result.current.defaultView).toBe('agenda')
  })

  it('저장된 값이 유효한 보기 종류가 아니면 월(month)로 대체한다', () => {
    localStorage.setItem('calendar.defaultView', 'invalid')
    const { result } = renderHook(() => useDefaultView())
    expect(result.current.defaultView).toBe('month')
  })
})
