// 비로그인 상태로 /car를 열어도 CalendarProvider가 events·categories 요청을 보내지 않는지 확인(02_architecture 8.1, AC-02-1)
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 모듈을 테스트 안에서 처음 동적 import(변환)하므로 CPU가 바쁘면 느리다 — useCalendar.auth.test와 같은 이유로 제한을 늘린다
configure({ asyncUtilTimeout: 5000 })

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('비로그인 /car', { timeout: 30_000 }, () => {
  it('세션이 없으면 Supabase 테이블 요청이 0건이다', async () => {
    const from = vi.fn()
    const client = {
      from,
      rpc: vi.fn(),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    } as unknown as SupabaseClient
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    window.history.pushState({}, '', '/car')

    const { default: App } = await import('../App')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: '차계부' })).toBeInTheDocument()

    await waitFor(() => expect(client.auth.getSession).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50)) // 세션 확인 뒤 effect가 돌 시간
    expect(from).not.toHaveBeenCalled()
  })

  // 실제 data/auth.ts와 App을 거쳐 MSG-29가 보이는지 확인한다(AC-27-1·2). 차계부 데이터 요청은 계속 0건이다
  function signedOutClient(signInWithOAuth = vi.fn()) {
    return {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithOAuth,
      },
    }
  }

  it('AC-27-1: 로그인 복귀 주소에 error가 있으면 MSG-29가 알림으로 보이고 요청은 0건이다', async () => {
    const client = signedOutClient()
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client as unknown as SupabaseClient }))
    window.history.pushState({}, '', '/car?error=access_denied&error_description=User+cancelled')

    const { default: App } = await import('../App')
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인하지 못했습니다. 다시 시도해 주세요')
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(client.from).not.toHaveBeenCalled()
    expect(window.location.search).toContain('error=access_denied') // 주소는 고치지 않는다
  })

  it('AC-27-2: 로그인 시작 요청이 네트워크 오류로 실패하면 MSG-29가 보인다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const signInWithOAuth = vi.fn(() => Promise.resolve({ data: {}, error: { status: 0, name: 'AuthRetryableFetchError' } }))
    vi.doMock('../lib/supabaseClient', () => ({ supabase: signedOutClient(signInWithOAuth) as unknown as SupabaseClient }))
    window.history.pushState({}, '', '/car')

    const { default: App } = await import('../App')
    render(<App />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: '로그인' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인하지 못했습니다')
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.href } })
  })
})
