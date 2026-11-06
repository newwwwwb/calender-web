// 비로그인 상태로 /car를 열어도 CalendarProvider가 events·categories 요청을 보내지 않는지 확인(02_architecture 8.1, AC-02-1)
import { configure, render, screen, waitFor } from '@testing-library/react'
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
})
