// CalendarProvider: 로그인 상태에 따른 repository 전환과 로컬 데이터 1회 마이그레이션을 검증
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// 이 파일은 vi.doMock 뒤 테스트 안에서 모듈을 처음 동적 import(변환)하므로 CPU가 바쁠 때(전체 테스트 병렬 실행, 다른 프로세스 동시 실행)
// 10초 넘게 걸려 기본 제한(테스트 5초, waitFor 1초)에서 간헐적으로 실패했다. 이 파일만 제한을 늘린다.
configure({ asyncUtilTimeout: 5000 })

function makeSupabaseClient() {
  const inserts: { table: string; payload: unknown }[] = []
  let eventRows: unknown[] = []
  let sharedRows: unknown[] = []
  let failInsertTable: string | null = null

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: vi.fn(() => b),
      order: vi.fn(() => Promise.resolve({ data: table === 'events' ? eventRows : [], error: null })),
      insert: vi.fn((payload: unknown) => {
        if (table === failInsertTable) return Promise.resolve({ error: new Error('boom') })
        inserts.push({ table, payload })
        return Promise.resolve({ error: null })
      }),
      update: vi.fn(() => b),
      delete: vi.fn(() => b),
      eq: vi.fn(() => Promise.resolve({ data: table === 'calendar_share_members' ? sharedRows : [], error: null })),
      // 17단계(양방향 공유)부터 listSharedWithMe가 .eq() 없이 select() 결과를 바로 await한다 —
      // 그 경로를 흉내내려면 b 자신도 thenable이어야 한다.
      then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: table === 'calendar_share_members' ? sharedRows : [], error: null }),
    }
    return b
  }

  const from = vi.fn((table: string) => builder(table))
  const rpc = vi.fn(() => Promise.resolve({ error: null }))
  return {
    client: { from, rpc } as unknown as SupabaseClient,
    inserts,
    from,
    rpc,
    setEventRows: (rows: unknown[]) => {
      eventRows = rows
    },
    setSharedRows: (rows: unknown[]) => {
      sharedRows = rows
    },
    failInsertsFor: (table: string) => {
      failInsertTable = table
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

describe('CalendarProvider - Supabase 전환/마이그레이션', { timeout: 30_000 }, () => {
  it('로그인하면 로컬 데이터를 Supabase로 1회 업로드하고 Supabase repository로 전환한다', async () => {
    localStorage.setItem(
      'calendar.events',
      JSON.stringify([{ id: 'e1', title: '로컬 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' }]),
    )
    localStorage.setItem('calendar.categories', JSON.stringify([{ id: 'c1', name: '업무', color: '#0066ff' }]))
    localStorage.setItem('calendar.todos', JSON.stringify([{ id: 'td1', title: '로컬 할 일', done: false }]))

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

    await waitFor(() => expect(localStorage.getItem('calendar.migratedToSupabase.user-1')).toBe('true'))

    const eventInsert = inserts.find((i) => i.table === 'events')
    const categoryInsert = inserts.find((i) => i.table === 'categories')
    const todoInsert = inserts.find((i) => i.table === 'todos')
    expect(eventInsert?.payload).toMatchObject({ id: 'e1', title: '로컬 일정' })
    expect(categoryInsert?.payload).toMatchObject({ id: 'c1', name: '업무' })
    expect(todoInsert?.payload).toMatchObject({ id: 'td1', title: '로컬 할 일' })
  })

  it('마이그레이션이 실패하면 플래그를 세우지 않고 로컬 저장소에 그대로 머문다', async () => {
    // 회귀 테스트: 예전엔 .catch가 없어서 실패해도 조용히 아무 일도 안 일어났다(보스 리뷰에서 발견)
    localStorage.setItem(
      'calendar.events',
      JSON.stringify([{ id: 'e1', title: '로컬 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' }]),
    )
    const { client, failInsertsFor } = makeSupabaseClient()
    failInsertsFor('events')
    const mockUser = { id: 'user-1' }
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

    // 실패했으니 로컬에 있던 일정("로컬 일정")이 그대로 화면에 보여야 한다(Supabase로 안 바뀜)
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))
    expect(localStorage.getItem('calendar.migratedToSupabase.user-1')).toBeNull()
  })

  it('옛 전역 키(calendar.migratedToSupabase)로 이미 마이그레이션했다면 다시 업로드하지 않는다', async () => {
    // 회귀 테스트: 마이그레이션 완료 플래그를 전역 키에서 사용자별 키로 바꾸면서, 옛 키로 이미
    // 마이그레이션을 마친 사용자가 새 키가 없다는 이유로 재시도해 Supabase에 이미 있는 이벤트를
    // 또 insert하려다 unique 제약 위반(23505)으로 실패하던 버그(사용자 제보)
    localStorage.setItem('calendar.migratedToSupabase', 'true')
    localStorage.setItem(
      'calendar.events',
      JSON.stringify([{ id: 'e1', title: '로컬에 남은 옛 데이터', allDay: true, start: '2026-09-10', end: '2026-09-10' }]),
    )
    const { client, inserts } = makeSupabaseClient()
    const mockUser = { id: 'user-1' }
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

    await waitFor(() => expect(localStorage.getItem('calendar.migratedToSupabase.user-1')).toBe('true'))
    expect(inserts).toHaveLength(0)
  })

  it('이미 마이그레이션했다면 다시 업로드하지 않고 Supabase 데이터를 사용한다', async () => {
    localStorage.setItem('calendar.migratedToSupabase.user-1', 'true')
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

  it('로그인 상태면 나에게 공유된 캘린더 목록을 불러오고, 토글로 숨김 상태를 뒤집을 수 있다', async () => {
    const { client, setSharedRows } = makeSupabaseClient()
    setSharedRows([
      { viewer_id: 'user-1', viewer_email: 'me@example.com', calendar_shares: { owner_id: 'owner-1', owner_email: 'owner@example.com' } },
    ])
    const mockUser = { id: 'user-1', email: 'me@example.com' }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return (
        <div>
          <span data-testid="shared-count">{cal.sharedCalendars.length}</span>
          <span data-testid="hidden-count">{cal.hiddenOwnerIds.size}</span>
          <button onClick={() => cal.toggleOwnerVisible('owner-1')}>토글</button>
        </div>
      )
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('shared-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('hidden-count')).toHaveTextContent('0')

    fireEvent.click(screen.getByText('토글'))
    expect(screen.getByTestId('hidden-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByText('토글'))
    expect(screen.getByTestId('hidden-count')).toHaveTextContent('0')
  })

  it('19단계: 내가 거절한 함께 일정은 shownEvents에서 숨긴다', async () => {
    const { client, setEventRows } = makeSupabaseClient()
    setEventRows([
      {
        id: 'e1',
        user_id: 'owner-1',
        title: '저녁 약속',
        memo: null,
        category_id: null,
        color: null,
        all_day: false,
        start_at: '2026-09-18T19:00',
        end_at: '2026-09-18T21:00',
        recurrence: null,
        excluded_dates: null,
        event_participants: [{ user_id: 'user-1', email: 'me@example.com', status: 'declined' }],
      },
    ])
    const mockUser = { id: 'user-1', email: 'me@example.com' }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return (
        <div>
          <span data-testid="event-count">{cal.events.length}</span>
          <span data-testid="shown-count">{cal.shownEvents.length}</span>
        </div>
      )
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('shown-count')).toHaveTextContent('0')
  })

  it('19단계: 참여 중인(대기/확정) 함께 일정은 소유자를 숨겨도 shownEvents에 남는다', async () => {
    const { client, setEventRows, setSharedRows } = makeSupabaseClient()
    setSharedRows([
      { viewer_id: 'user-1', viewer_email: 'me@example.com', calendar_shares: { owner_id: 'owner-1', owner_email: 'owner@example.com' } },
    ])
    setEventRows([
      {
        id: 'e1',
        user_id: 'owner-1',
        title: '저녁 약속',
        memo: null,
        category_id: null,
        color: null,
        all_day: false,
        start_at: '2026-09-18T19:00',
        end_at: '2026-09-18T21:00',
        recurrence: null,
        excluded_dates: null,
        event_participants: [{ user_id: 'user-1', email: 'me@example.com', status: 'accepted' }],
      },
      {
        id: 'e2',
        user_id: 'owner-1',
        title: '오너의 다른 일정',
        memo: null,
        category_id: null,
        color: null,
        all_day: true,
        start_at: '2026-09-19',
        end_at: '2026-09-19',
        recurrence: null,
        excluded_dates: null,
        event_participants: [],
      },
    ])
    const mockUser = { id: 'user-1', email: 'me@example.com' }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return (
        <div>
          <span data-testid="shown-count">{cal.shownEvents.length}</span>
          <button onClick={() => cal.toggleOwnerVisible('owner-1')}>토글</button>
        </div>
      )
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('shown-count')).toHaveTextContent('2'))

    fireEvent.click(screen.getByText('토글'))
    // 오너의 다른 일정(e2)은 숨겨지고, 내가 참여 중인 함께 일정(e1)은 그대로 남는다
    expect(screen.getByTestId('shown-count')).toHaveTextContent('1')
  })

  it('19.6: respondToEvent는 respond_to_event RPC를 호출하고 다시 불러온다', async () => {
    const { client, rpc } = makeSupabaseClient()
    const mockUser = { id: 'user-1', email: 'me@example.com' }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return <button onClick={() => cal.respondToEvent('e1', 'accepted')}>수락</button>
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByText('수락')).toBeEnabled())

    fireEvent.click(screen.getByText('수락'))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_to_event', { p_event_id: 'e1', p_status: 'accepted' }))
  })

  it('19.6: setEventParticipants는 참여자를 갱신하고 다시 불러온다', async () => {
    const { client, from } = makeSupabaseClient()
    const mockUser = { id: 'user-1', email: 'me@example.com' }
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client }))
    vi.doMock('./useAuth', () => ({
      useAuth: () => ({ user: mockUser, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
    }))

    const { CalendarProvider, useCalendar } = await import('./useCalendar')
    function Inner() {
      const cal = useCalendar()
      return (
        <button onClick={() => cal.setEventParticipants('e1', [], [{ userId: 'user-2', status: 'pending' }])}>초대</button>
      )
    }
    render(
      <CalendarProvider>
        <Inner />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByText('초대')).toBeEnabled())

    fireEvent.click(screen.getByText('초대'))

    await waitFor(() => expect(from).toHaveBeenCalledWith('event_participants'))
  })
})
