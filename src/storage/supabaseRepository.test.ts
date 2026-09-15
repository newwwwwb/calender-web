// SupabaseEventRepository: 요청 전달(테이블/필터)과 camelCase<->snake_case 매핑을 검증
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, Category } from '../types'
import { SupabaseEventRepository } from './supabaseRepository'

// Supabase의 체이닝 쿼리 빌더를 흉내 낸다. thenable이라 await 하면 result가 나온다.
function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {
    then(resolve: (value: typeof result) => void) {
      resolve(result)
    },
  }
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method] = args
      return builder
    })
  }
  return { builder, calls }
}

function makeClient(result: { data?: unknown; error?: unknown }) {
  const { builder, calls } = makeQueryBuilder(result)
  const from = vi.fn(() => builder)
  return { client: { from } as unknown as SupabaseClient, from, calls }
}

const USER_ID = 'user-1'

describe('SupabaseEventRepository', () => {
  it('listEvents: events 테이블에서 start_at 순으로 읽고 도메인 모델로 매핑한다', async () => {
    const row = {
      id: 'e1',
      title: '회의',
      memo: null,
      category_id: 'c1',
      color: '#123456',
      all_day: true,
      start_at: '2026-09-15',
      end_at: '2026-09-15',
      recurrence: null,
      excluded_dates: null,
    }
    const { client, from, calls } = makeClient({ data: [row] })
    const repo = new SupabaseEventRepository(client, USER_ID)

    const events = await repo.listEvents()

    expect(from).toHaveBeenCalledWith('events')
    expect(calls.order).toEqual(['start_at'])
    expect(events).toEqual([
      { id: 'e1', title: '회의', memo: undefined, categoryId: 'c1', color: '#123456', allDay: true, start: '2026-09-15', end: '2026-09-15', recurrence: undefined, excludedDates: undefined },
    ])
  })

  it('addEvent: user_id를 채워서 insert하고, camelCase 필드를 snake_case로 바꾼다', async () => {
    const { client, calls } = makeClient({ error: null })
    const repo = new SupabaseEventRepository(client, USER_ID)
    const event: CalendarEvent = {
      id: 'e1',
      title: '회의',
      categoryId: 'c1',
      allDay: false,
      start: '2026-09-15T09:00',
      end: '2026-09-15T10:00',
    }

    await repo.addEvent(event)

    expect(calls.insert).toEqual([
      {
        id: 'e1',
        user_id: USER_ID,
        title: '회의',
        memo: null,
        category_id: 'c1',
        color: null,
        all_day: false,
        start_at: '2026-09-15T09:00',
        end_at: '2026-09-15T10:00',
        recurrence: null,
        excluded_dates: null,
      },
    ])
  })

  it('updateEvent: id로 필터해서 update한다', async () => {
    const { client, calls } = makeClient({ error: null })
    const repo = new SupabaseEventRepository(client, USER_ID)
    await repo.updateEvent({ id: 'e1', title: '수정됨', allDay: true, start: '2026-09-15', end: '2026-09-15' })

    expect(calls.eq).toEqual(['id', 'e1'])
  })

  it('deleteEvent: id로 필터해서 delete한다', async () => {
    const { client, from, calls } = makeClient({ error: null })
    const repo = new SupabaseEventRepository(client, USER_ID)
    await repo.deleteEvent('e1')

    expect(from).toHaveBeenCalledWith('events')
    expect(calls.eq).toEqual(['id', 'e1'])
  })

  it('에러가 오면 던진다', async () => {
    const { client } = makeClient({ error: new Error('boom') })
    const repo = new SupabaseEventRepository(client, USER_ID)
    await expect(repo.listEvents()).rejects.toThrow('boom')
  })

  it('listCategories/addCategory: categories 테이블을 쓰고 매핑한다', async () => {
    const { client, from, calls } = makeClient({ data: [{ id: 'c1', name: '업무', color: '#0066ff' }] })
    const repo = new SupabaseEventRepository(client, USER_ID)

    const categories = await repo.listCategories()
    expect(from).toHaveBeenCalledWith('categories')
    expect(categories).toEqual<Category[]>([{ id: 'c1', name: '업무', color: '#0066ff' }])

    await repo.addCategory({ id: 'c2', name: '개인', color: '#00aa00' })
    expect(calls.insert).toEqual([{ id: 'c2', user_id: USER_ID, name: '개인', color: '#00aa00' }])
  })
})
