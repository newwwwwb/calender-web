// useNotifications: 최초 로드, 60초 폴링, 포커스 시 새로고침, 변경 감지(onChanged), markAllRead를 검증
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppNotification } from '../types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

function makeNotification(id: string): AppNotification {
  return {
    id,
    actorId: 'partner-1',
    actorEmail: 'partner@example.com',
    kind: 'invited',
    status: 'pending',
    eventId: 'e1',
    eventTitle: '저녁 약속',
    createdAt: `2026-09-18T10:0${id}:00Z`,
  }
}

describe('useNotifications', () => {
  it('userId가 없으면(로그아웃) 아무것도 불러오지 않는다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn()
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const { useNotifications } = await import('./useNotifications')

    const { result } = renderHook(() => useNotifications({ userId: undefined }))
    await flush()

    expect(result.current.notifications).toEqual([])
    expect(listNotifications).not.toHaveBeenCalled()
  })

  it('마운트 시 알림을 불러오지만, 최초 로드에서는 onChanged를 부르지 않는다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValue([makeNotification('1')])
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const onChanged = vi.fn()
    const { useNotifications } = await import('./useNotifications')

    const { result } = renderHook(() => useNotifications({ userId: 'me', onChanged }))
    await flush()

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unreadCount).toBe(1)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('60초마다 다시 불러온다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValue([])
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const { useNotifications } = await import('./useNotifications')

    renderHook(() => useNotifications({ userId: 'me' }))
    await flush()
    expect(listNotifications).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })

  it('안 읽은 알림이 새로 생기면(변화 있음) onChanged를 부른다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([makeNotification('1')])
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const onChanged = vi.fn()
    const { useNotifications } = await import('./useNotifications')

    renderHook(() => useNotifications({ userId: 'me', onChanged }))
    await flush()
    expect(onChanged).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('알림이 그대로면 onChanged를 다시 부르지 않는다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValue([makeNotification('1')])
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const onChanged = vi.fn()
    const { useNotifications } = await import('./useNotifications')

    renderHook(() => useNotifications({ userId: 'me', onChanged }))
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('창에 포커스가 돌아오면 다시 불러온다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValue([])
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead: vi.fn() }))
    const { useNotifications } = await import('./useNotifications')

    renderHook(() => useNotifications({ userId: 'me' }))
    await flush()
    expect(listNotifications).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })

  it('markAllRead는 모두 읽음 처리를 요청한 뒤 다시 불러온다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    const listNotifications = vi.fn().mockResolvedValue([])
    const markAllRead = vi.fn().mockResolvedValue(undefined)
    vi.doMock('../storage/togetherRepository', () => ({ listNotifications, markAllRead }))
    const { useNotifications } = await import('./useNotifications')

    const { result } = renderHook(() => useNotifications({ userId: 'me' }))
    await flush()

    await act(async () => {
      await result.current.markAllRead()
    })
    expect(markAllRead).toHaveBeenCalled()
    expect(listNotifications).toHaveBeenCalledTimes(2)
  })
})
