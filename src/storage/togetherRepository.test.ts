// togetherRepository: 참여자 diff, RPC 인자, 알림 쿼리 형태를 검증
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Participant } from '../types'
import { listNotifications, markAllRead, respondToEvent, setParticipants } from './togetherRepository'

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {
    then(resolve: (value: typeof result) => void) {
      resolve(result)
    },
  }
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'is']) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method] = args
      return builder
    })
  }
  return { builder, calls }
}

function makeClient(result: { data?: unknown; error?: unknown } = { error: null }) {
  const { builder, calls } = makeQueryBuilder(result)
  const from = vi.fn(() => builder)
  const rpc = vi.fn(() => Promise.resolve(result))
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, calls }
}

describe('setParticipants', () => {
  it('새 참여자만 insert한다', async () => {
    const { client, from, calls } = makeClient()
    const current: Participant[] = []
    await setParticipants(client, 'e1', current, [{ userId: 'u2', status: 'pending' }])

    expect(from).toHaveBeenCalledWith('event_participants')
    expect(calls.insert).toEqual([[{ event_id: 'e1', user_id: 'u2', status: 'pending' }]])
    expect(calls.delete).toBeUndefined()
  })

  it('빠진 참여자만 delete한다', async () => {
    const { client, calls } = makeClient()
    const current: Participant[] = [{ userId: 'u2', email: 'b@example.com', status: 'accepted' }]
    await setParticipants(client, 'e1', current, [])

    expect(calls.eq).toEqual(['event_id', 'e1'])
    expect(calls.in).toEqual(['user_id', ['u2']])
    expect(calls.insert).toBeUndefined()
  })

  it('거절한 참여자를 다시 선택하면 삭제 후 재삽입한다(update 정책이 없어 재초대는 이 방법뿐)', async () => {
    const { client, calls } = makeClient()
    const current: Participant[] = [{ userId: 'u2', email: 'b@example.com', status: 'declined' }]
    await setParticipants(client, 'e1', current, [{ userId: 'u2', status: 'pending' }])

    expect(calls.in).toEqual(['user_id', ['u2']])
    expect(calls.insert).toEqual([[{ event_id: 'e1', user_id: 'u2', status: 'pending' }]])
  })

  it('그대로인 참여자는 손대지 않는다', async () => {
    const { client, calls } = makeClient()
    const current: Participant[] = [{ userId: 'u2', email: 'b@example.com', status: 'accepted' }]
    await setParticipants(client, 'e1', current, [{ userId: 'u2', status: 'accepted' }])

    expect(calls.insert).toBeUndefined()
    expect(calls.delete).toBeUndefined()
  })
})

describe('respondToEvent', () => {
  it('respond_to_event RPC를 호출한다', async () => {
    const { client, rpc } = makeClient()
    await respondToEvent(client, 'e1', 'accepted')
    expect(rpc).toHaveBeenCalledWith('respond_to_event', { p_event_id: 'e1', p_status: 'accepted' })
  })
})

describe('listNotifications', () => {
  it('최근 30개를 최신순으로 조회해서 매핑한다', async () => {
    const row = {
      id: 'n1',
      actor_id: 'u2',
      actor_email: 'b@example.com',
      kind: 'invited',
      status: 'pending',
      event_id: 'e1',
      event_title: '저녁 약속',
      read_at: null,
      created_at: '2026-09-18T10:00:00Z',
    }
    const { client, from, calls } = makeClient({ data: [row] })

    const notifications = await listNotifications(client)

    expect(from).toHaveBeenCalledWith('notifications')
    expect(calls.order).toEqual(['created_at', { ascending: false }])
    expect(calls.limit).toEqual([30])
    expect(notifications).toEqual([
      {
        id: 'n1',
        actorId: 'u2',
        actorEmail: 'b@example.com',
        kind: 'invited',
        status: 'pending',
        eventId: 'e1',
        eventTitle: '저녁 약속',
        readAt: undefined,
        createdAt: '2026-09-18T10:00:00Z',
      },
    ])
  })
})

describe('markAllRead', () => {
  it('안 읽은 알림만 read_at을 채운다', async () => {
    const { client, from, calls } = makeClient()
    await markAllRead(client)

    expect(from).toHaveBeenCalledWith('notifications')
    expect(calls.is).toEqual(['read_at', null])
    expect((calls.update as [Record<string, unknown>])[0]).toHaveProperty('read_at')
  })
})
