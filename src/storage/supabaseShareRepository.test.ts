// SupabaseShareRepository: 요청 전달(테이블/필터/insert 값)과 row-매핑을 검증
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseShareRepository } from './supabaseShareRepository'

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {
    then(resolve: (value: typeof result) => void) {
      resolve(result)
    },
  }
  for (const method of ['select', 'insert', 'delete', 'eq', 'order']) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method] = args
      return builder
    })
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return { builder, calls }
}

function makeClient(result: { data?: unknown; error?: unknown }) {
  const { builder, calls } = makeQueryBuilder(result)
  const from = vi.fn(() => builder)
  const rpc = vi.fn(() => Promise.resolve(result))
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, calls }
}

const USER_ID = 'user-1'
const USER_EMAIL = 'me@example.com'

describe('SupabaseShareRepository', () => {
  it('createShareLink: 내 id/이메일로 insert하고 생성된 행을 매핑해 반환한다', async () => {
    const row = { id: 's1', owner_id: USER_ID, owner_email: USER_EMAIL, created_at: '2026-09-15T00:00:00Z' }
    const { client, from, calls } = makeClient({ data: row })

    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    const link = await repo.createShareLink()

    expect(from).toHaveBeenCalledWith('calendar_shares')
    expect(calls.insert).toEqual([{ owner_id: USER_ID, owner_email: USER_EMAIL }])
    expect(link).toEqual({ id: 's1', ownerId: USER_ID, ownerEmail: USER_EMAIL, createdAt: row.created_at })
  })

  it('listMyShareLinks: 내가 만든 공유 링크만 조회한다', async () => {
    const row = { id: 's1', owner_id: USER_ID, owner_email: USER_EMAIL, created_at: '2026-09-15T00:00:00Z' }
    const { client, from, calls } = makeClient({ data: [row] })

    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    const links = await repo.listMyShareLinks()

    expect(from).toHaveBeenCalledWith('calendar_shares')
    expect(calls.eq).toEqual(['owner_id', USER_ID])
    expect(links).toHaveLength(1)
  })

  it('deleteShareLink: id로 필터해서 delete한다', async () => {
    const { client, from, calls } = makeClient({ error: null })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    await repo.deleteShareLink('s1')

    expect(from).toHaveBeenCalledWith('calendar_shares')
    expect(calls.eq).toEqual(['id', 's1'])
  })

  it('listMembers: share_id로 필터해서 멤버 목록을 매핑한다', async () => {
    const row = { id: 'm1', share_id: 's1', viewer_id: 'user-2', viewer_email: 'you@example.com', created_at: '2026-09-15T00:00:00Z' }
    const { client, from, calls } = makeClient({ data: [row] })

    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    const members = await repo.listMembers('s1')

    expect(from).toHaveBeenCalledWith('calendar_share_members')
    expect(calls.eq).toEqual(['share_id', 's1'])
    expect(members).toEqual([{ id: 'm1', shareId: 's1', viewerId: 'user-2', viewerEmail: 'you@example.com', createdAt: row.created_at }])
  })

  it('removeMember: id로 필터해서 delete한다', async () => {
    const { client, from, calls } = makeClient({ error: null })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    await repo.removeMember('m1')

    expect(from).toHaveBeenCalledWith('calendar_share_members')
    expect(calls.eq).toEqual(['id', 'm1'])
  })

  it('getShareLink: get_share_owner RPC로 조회해서 매핑한다(전체 테이블 select 안 함)', async () => {
    const { client, rpc } = makeClient({ data: [{ owner_id: USER_ID, owner_email: USER_EMAIL }] })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const link = await repo.getShareLink('s1')
    expect(rpc).toHaveBeenCalledWith('get_share_owner', { p_share_id: 's1' })
    expect(link).toEqual({ id: 's1', ownerId: USER_ID, ownerEmail: USER_EMAIL, createdAt: '' })
  })

  it('getShareLink: 없으면 null을 반환한다', async () => {
    const { client } = makeClient({ data: [] })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const link = await repo.getShareLink('missing')
    expect(link).toBeNull()
  })

  it('acceptShareLink: accept_share RPC를 호출한다(클라이언트가 직접 insert하지 않음)', async () => {
    const { client, rpc } = makeClient({ error: null })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    await repo.acceptShareLink('s1')

    expect(rpc).toHaveBeenCalledWith('accept_share', { share_id: 's1' })
  })

  it('listSharedWithMe: 필터 없이 조회한다(RLS가 이미 내가 관여한 행만 돌려줌)', async () => {
    const { client, from, calls } = makeClient({
      data: [{ viewer_id: USER_ID, viewer_email: USER_EMAIL, calendar_shares: { owner_id: 'owner-1', owner_email: 'owner@example.com' } }],
    })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const shared = await repo.listSharedWithMe()

    expect(from).toHaveBeenCalledWith('calendar_share_members')
    expect(calls.eq).toBeUndefined()
    expect(shared).toEqual<{ ownerId: string; ownerEmail: string }[]>([{ ownerId: 'owner-1', ownerEmail: 'owner@example.com' }])
  })

  it('listSharedWithMe: 내가 수락자인 행에서는 링크 소유자를 상대로 반환한다', async () => {
    const { client } = makeClient({
      data: [{ viewer_id: USER_ID, viewer_email: USER_EMAIL, calendar_shares: { owner_id: 'owner-1', owner_email: 'owner@example.com' } }],
    })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const shared = await repo.listSharedWithMe()
    expect(shared).toEqual([{ ownerId: 'owner-1', ownerEmail: 'owner@example.com' }])
  })

  it('listSharedWithMe: 내가 링크 소유자인 행에서는 수락자를 상대로 반환한다(양방향, 17단계)', async () => {
    const { client } = makeClient({
      data: [{ viewer_id: 'viewer-2', viewer_email: 'viewer2@example.com', calendar_shares: { owner_id: USER_ID, owner_email: USER_EMAIL } }],
    })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const shared = await repo.listSharedWithMe()
    expect(shared).toEqual([{ ownerId: 'viewer-2', ownerEmail: 'viewer2@example.com' }])
  })

  it('listSharedWithMe: 같은 상대와 양방향으로 얽혀 있어도 한 번만 반환한다(중복 제거)', async () => {
    const { client } = makeClient({
      data: [
        { viewer_id: USER_ID, viewer_email: USER_EMAIL, calendar_shares: { owner_id: 'owner-1', owner_email: 'owner@example.com' } },
        { viewer_id: 'owner-1', viewer_email: 'owner@example.com', calendar_shares: { owner_id: USER_ID, owner_email: USER_EMAIL } },
      ],
    })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)

    const shared = await repo.listSharedWithMe()
    expect(shared).toEqual([{ ownerId: 'owner-1', ownerEmail: 'owner@example.com' }])
  })

  it('에러가 오면 던진다', async () => {
    const { client } = makeClient({ error: new Error('boom') })
    const repo = new SupabaseShareRepository(client, USER_ID, USER_EMAIL)
    await expect(repo.listMyShareLinks()).rejects.toThrow('boom')
  })
})
