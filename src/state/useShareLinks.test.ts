// useShareLinks: 로그인 상태에 따른 동작과 생성/삭제/멤버 제거 후 재조회를 검증
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('useShareLinks - 로그아웃 상태', () => {
  it('링크 목록이 비어있고 로딩이 끝난다', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: null }))
    vi.doMock('./useAuth', () => ({ useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }) }))

    const { useShareLinks } = await import('./useShareLinks')
    const { result } = renderHook(() => useShareLinks())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links).toEqual([])
  })
})

describe('useShareLinks - 로그인 상태', () => {
  function setupMocks() {
    const link = { id: 's1', ownerId: 'user-1', ownerEmail: 'me@example.com', createdAt: '2026-09-15T00:00:00Z' }
    const member = { id: 'm1', shareId: 's1', viewerId: 'user-2', viewerEmail: 'you@example.com', createdAt: '2026-09-15T00:00:00Z' }
    const repoInstance = {
      listMyShareLinks: vi.fn().mockResolvedValue([link]),
      listMembers: vi.fn().mockResolvedValue([member]),
      createShareLink: vi.fn().mockResolvedValue(link),
      deleteShareLink: vi.fn().mockResolvedValue(undefined),
      removeMember: vi.fn().mockResolvedValue(undefined),
    }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-1', email: 'me@example.com' }, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))
    vi.doMock('../storage/supabaseShareRepository', () => ({
      SupabaseShareRepository: vi.fn().mockImplementation(function SupabaseShareRepository() {
        return repoInstance
      }),
    }))
    return { link, member, repoInstance }
  }

  it('내 링크와 링크별 멤버 목록을 불러온다', async () => {
    const { link, member } = setupMocks()
    const { useShareLinks } = await import('./useShareLinks')
    const { result } = renderHook(() => useShareLinks())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links).toEqual([link])
    expect(result.current.membersByShare['s1']).toEqual([member])
  })

  it('createLink/deleteLink/removeMember 호출 후 재조회한다', async () => {
    const { repoInstance } = setupMocks()
    const { useShareLinks } = await import('./useShareLinks')
    const { result } = renderHook(() => useShareLinks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createLink()
    })
    expect(repoInstance.createShareLink).toHaveBeenCalled()
    expect(repoInstance.listMyShareLinks).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.deleteLink('s1')
    })
    expect(repoInstance.deleteShareLink).toHaveBeenCalledWith('s1')

    await act(async () => {
      await result.current.removeMember('m1')
    })
    expect(repoInstance.removeMember).toHaveBeenCalledWith('m1')
  })
})
