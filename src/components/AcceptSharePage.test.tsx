// AcceptSharePage: 로그인 여부, 링크 존재 여부, 수락 흐름을 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('AcceptSharePage - 로그인하지 않은 상태', () => {
  it('로그인 안내와 버튼을 보여주고, 클릭 시 현재 URL로 돌아오도록 로그인한다', async () => {
    const signInWithGoogle = vi.fn()
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    vi.doMock('../state/useAuth', () => ({
      useAuth: () => ({ user: null, loading: false, signInWithGoogle, signOut: vi.fn() }),
    }))

    const { default: AcceptSharePage } = await import('./AcceptSharePage')
    render(<AcceptSharePage shareId="s1" />)

    fireEvent.click(screen.getByText('Google로 로그인'))
    expect(signInWithGoogle).toHaveBeenCalledWith(window.location.href)
  })
})

describe('AcceptSharePage - 로그인한 상태', () => {
  it('공유 소유자 이메일을 보여주고, 수락하기 클릭 시 수락 후 완료 화면을 보여준다', async () => {
    const acceptShareLink = vi.fn().mockResolvedValue(undefined)
    const getShareLink = vi.fn().mockResolvedValue({ id: 's1', ownerId: 'owner-1', ownerEmail: 'owner@example.com', createdAt: '2026-09-15T00:00:00Z' })
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    vi.doMock('../state/useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-1', email: 'me@example.com' }, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))
    vi.doMock('../storage/supabaseShareRepository', () => ({
      SupabaseShareRepository: vi.fn().mockImplementation(function SupabaseShareRepository() {
        return { getShareLink, acceptShareLink }
      }),
    }))

    const { default: AcceptSharePage } = await import('./AcceptSharePage')
    render(<AcceptSharePage shareId="s1" />)

    expect(await screen.findByText('owner@example.com님이 캘린더를 공유했어요.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('수락하기'))

    await waitFor(() => expect(acceptShareLink).toHaveBeenCalledWith('s1'))
    expect(await screen.findByText('공유를 수락했어요.')).toBeInTheDocument()
  })

  it('유효하지 않은 링크면 안내 문구를 보여준다', async () => {
    const getShareLink = vi.fn().mockResolvedValue(null)
    vi.doMock('../lib/supabaseClient', () => ({ supabase: {} }))
    vi.doMock('../state/useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-1', email: 'me@example.com' }, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))
    vi.doMock('../storage/supabaseShareRepository', () => ({
      SupabaseShareRepository: vi.fn().mockImplementation(function SupabaseShareRepository() {
        return { getShareLink, acceptShareLink: vi.fn() }
      }),
    }))

    const { default: AcceptSharePage } = await import('./AcceptSharePage')
    render(<AcceptSharePage shareId="missing" />)

    expect(await screen.findByText('유효하지 않은 공유 링크예요.')).toBeInTheDocument()
  })
})
