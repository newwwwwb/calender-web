// useSidebarCollapsed: 사이드바 접힘 상태의 저장/복원을 검증
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSidebarCollapsed } from './useSidebarCollapsed'

beforeEach(() => {
  localStorage.clear()
})

describe('useSidebarCollapsed', () => {
  it('저장된 값이 없으면 펼쳐진 상태로 시작한다', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(false)
  })

  it('toggle하면 상태가 바뀌고 다음에 열 때도 유지된다', () => {
    const first = renderHook(() => useSidebarCollapsed())
    act(() => first.result.current.toggle())
    expect(first.result.current.collapsed).toBe(true)

    const second = renderHook(() => useSidebarCollapsed())
    expect(second.result.current.collapsed).toBe(true)

    act(() => second.result.current.toggle())
    expect(second.result.current.collapsed).toBe(false)
    expect(renderHook(() => useSidebarCollapsed()).result.current.collapsed).toBe(false)
  })
})
