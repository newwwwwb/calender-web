// useAuth: supabase 클라이언트 유무에 따른 동작, 세션 로드, 로그인/로그아웃 호출을 검증
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('useAuth - supabase 클라이언트가 없을 때 (환경변수 미설정)', () => {
  it('항상 로그아웃 상태이고 loading도 false다', async () => {
    vi.resetModules()
    vi.doMock('../lib/supabaseClient', () => ({ supabase: null }))
    const { useAuth } = await import('./useAuth')

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)

    // 클라이언트가 없어도 호출 자체는 에러 없이 무시된다
    await act(async () => {
      await result.current.signInWithGoogle()
      await result.current.signOut()
    })
  })
})

describe('useAuth - supabase 클라이언트가 있을 때', () => {
  it('세션을 불러와 user를 채우고, 로그인/로그아웃을 호출한다', async () => {
    const fakeUser = { id: 'u1' }
    const unsubscribe = vi.fn()
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: fakeUser } } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
        signInWithOAuth: vi.fn().mockResolvedValue({}),
        signOut: vi.fn().mockResolvedValue({}),
      },
    }

    vi.resetModules()
    vi.doMock('../lib/supabaseClient', () => ({ supabase: mockSupabase }))
    const { useAuth } = await import('./useAuth')

    const { result, unmount } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)

    await act(async () => {
      await result.current.signInWithGoogle()
    })
    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' })

    await act(async () => {
      await result.current.signOut()
    })
    expect(mockSupabase.auth.signOut).toHaveBeenCalled()

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
