// CalendarProvider: 로그인 상태에 따른 repository 전환과 로컬 데이터 1회 마이그레이션을 검증
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSupabaseClient() {
  const inserts: { table: string; payload: unknown }[] = []
  let eventRows: unknown[] = []

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: vi.fn(() => b),
      order: vi.fn(() => Promise.resolve({ data: table === 'events' ? eventRows : [], error: null })),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload })
        return Promise.resolve({ error: null })
      }),
      update: vi.fn(() => b),
      delete: vi.fn(() => b),
      eq: vi.fn(() => Promise.resolve({ error: null })),
    }
    return b
  }

  const from = vi.fn((table: string) => builder(table))
  return {
    client: { from } as unknown as SupabaseClient,
    inserts,
    setEventRows: (rows: unknown[]) => {
      eventRows = rows
    },
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('CalendarProvider - Supabase 전환/마이그레이션', () => {
  it('로그인하면 로컬 데이터를 Supabase로 1회 업로드하고 Supabase repository로 전환한다', async () => {
    localStorage.setItem(
      'calendar.events',
      JSON.stringify([{ id: 'e1', title: '로컬 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' }]),
    )
    localStorage.setItem('calendar.categories', JSON.stringify([{ id: 'c1', name: '업무', color: '#0066ff' }]))

    const { client, inserts } = makeSupabaseClient()
    const mockUser = { id: 'user-1' } // 렌더마다 새 객체를 반환하면 effect가 매번 재실행되므로 참조를 고정한다
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return <span data-testid="event-count">{cal.events.length}</span>
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )

    await waitFor(() => expect(localStorage.getItem('calendar.migratedToSupabase')).toBe('true'))

    const eventInsert = inserts.find((i) => i.table === 'events')
    const categoryInsert = inserts.find((i) => i.table === 'categories')
    expect(eventInsert?.payload).toMatchObject({ id: 'e1', title: '로컬 일정' })
    expect(categoryInsert?.payload).toMatchObject({ id: 'c1', name: '업무' })
  })

  it('이미 마이그레이션했다면 다시 업로드하지 않고 Supabase 데이터를 사용한다', async () => {
    localStorage.setItem('calendar.migratedToSupabase', 'true')
    localStorage.setItem(
      'calendar.events',
      JSON.stringify([{ id: 'local-only', title: '로컬에만 남은 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' }]),
    )

    const { client, inserts, setEventRows } = makeSupabaseClient()
    setEventRows([
      {
        id: 's1',
        title: 'Supabase 일정',
        memo: null,
        category_id: null,
        color: null,
        all_day: true,
        start_at: '2026-09-20',
        end_at: '2026-09-20',
        recurrence: null,
        excluded_dates: null,
      },
    ])
    const mockUser = { id: 'user-1' } // 렌더마다 새 객체를 반환하면 effect가 매번 재실행되므로 참조를 고정한다
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return <span data-testid="event-count">{cal.events.length}</span>
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))
    expect(inserts).toHaveLength(0)
  })
})
