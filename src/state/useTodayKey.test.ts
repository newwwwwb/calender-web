// useTodayKey: 자정이 지나면(1분 간격 확인·창 포커스) 오늘 날짜 키가 스스로 바뀌는지 검증
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodayKey } from './useTodayKey'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('useTodayKey', () => {
  it('처음에는 지금 날짜를 돌려준다', () => {
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0))
    const { result } = renderHook(() => useTodayKey())
    expect(result.current).toBe('2026-10-06')
  })

  it('켜 둔 채 자정이 지나면 다음 확인 주기에 다음 날로 바뀐다', () => {
    vi.setSystemTime(new Date(2026, 9, 6, 23, 59, 30))
    const { result } = renderHook(() => useTodayKey())
    expect(result.current).toBe('2026-10-06')

    act(() => void vi.advanceTimersByTime(60_000)) // 00:00:30
    expect(result.current).toBe('2026-10-07')
  })

  it('절전에서 깨어나 창이 포커스를 받으면 주기를 기다리지 않고 바로 갱신한다', () => {
    vi.setSystemTime(new Date(2026, 9, 6, 22, 0))
    const { result } = renderHook(() => useTodayKey())

    vi.setSystemTime(new Date(2026, 9, 8, 9, 0)) // 타이머가 멈춘 채 이틀이 지났다
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(result.current).toBe('2026-10-08')
  })

  it('언마운트하면 타이머와 리스너를 정리한다', () => {
    const { unmount } = renderHook(() => useTodayKey())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
