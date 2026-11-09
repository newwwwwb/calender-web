// calendarLink 테스트: 카테고리 보장(AC-08-4·13), 일정 쓰기(AC-08-1·10), 재시도 중복 없음(AC-08-6), 100개 조회, user_id 필터
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { target: string; ops: [string, unknown[]][] }
const h = vi.hoisted(() => ({ calls: [] as Call[], queue: [] as unknown[] }))

vi.mock('../../lib/supabaseClient', () => {
  const make = (target: string) => {
    const call: Call = { target, ops: [] }
    h.calls.push(call)
    const p: object = new Proxy({}, {
      get: (_t, name: string) => {
        if (name === 'then') {
          const res = h.queue.shift() ?? { data: null, error: null }
          return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko)
        }
        return (...args: unknown[]) => { call.ops.push([name, args]); return p }
      },
    })
    return p
  }
  return { supabase: { from: (t: string) => make(t), rpc: (n: string) => make(`rpc:${n}`) } }
})

import { createCalendarLink } from './calendarLink'

const ok = (data: unknown) => ({ data, error: null })
const CAT = 'cat-1'
const args = (c: Call, name: string) => c.ops.find(([n]) => n === name)?.[1]
const spec = { eventId: 'e1', title: '[내 차] 엔진오일 교체 예정', date: '2027-11-05' }
const rpcCalls = () => h.calls.filter((c) => c.target === 'rpc:ensure_carbook_category')

beforeEach(() => { h.calls.length = 0; h.queue.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('ensureCategoryId', () => {
  it('RPC를 한 번만 부르고 이후엔 기억한 값을 쓴다(AC-08-4)', async () => {
    h.queue.push(ok(CAT))
    const link = createCalendarLink('u1')
    expect(await link.ensureCategoryId()).toBe(CAT)
    expect(await link.ensureCategoryId()).toBe(CAT)
    expect(rpcCalls()).toHaveLength(1)
  })

  it('동시에 불려도 진행 중인 약속을 공유해 RPC는 1번이다(AC-08-13)', async () => {
    h.queue.push(ok(CAT))
    const link = createCalendarLink('u1')
    expect(await Promise.all([link.ensureCategoryId(), link.ensureCategoryId(), link.ensureCategoryId()])).toEqual([CAT, CAT, CAT])
    expect(rpcCalls()).toHaveLength(1)
  })

  it('응답이 문자열이 아니면 bad_response, 실패는 기억하지 않아 다음에 다시 부른다', async () => {
    const link = createCalendarLink('u1')
    h.queue.push(ok({ not: 'a string' }))
    await expect(link.ensureCategoryId()).rejects.toMatchObject({ kind: 'unknown', code: 'bad_response' })
    h.queue.push({ data: null, error: { code: '42501' }, status: 403 })
    await expect(link.ensureCategoryId()).rejects.toMatchObject({ kind: 'unknown', code: '42501' })
    h.queue.push(ok(CAT))
    expect(await link.ensureCategoryId()).toBe(CAT)
    expect(rpcCalls()).toHaveLength(3)
  })
})

describe('fetchEvents', () => {
  it('100개씩 나눠 user_id 조건과 함께 조회하고 Map으로 돌려준다', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `e${i}`)
    h.queue.push(ok([{ id: 'e0', title: 't', start_at: '2027-01-01', category_id: CAT }]), ok([]), ok([]))
    const found = await createCalendarLink('u1').fetchEvents(ids)
    const events = h.calls.filter((c) => c.target === 'events')
    expect(events).toHaveLength(3)
    expect(events.map((c) => (args(c, 'in') as [string, string[]])[1].length)).toEqual([100, 100, 50])
    expect(events.every((c) => JSON.stringify(args(c, 'eq')) === JSON.stringify(['user_id', 'u1']))).toBe(true)
    expect(found.get('e0')?.title).toBe('t')
    expect(found.has('e1')).toBe(false)
  })
})

describe('syncEvent', () => {
  it('일정이 없으면 종일 일정 행 전체를 upsert한다(AC-08-1, 메모 null·번호판 없음 AC-08-10)', async () => {
    h.queue.push(ok(CAT), ok([]), ok(null))
    expect(await createCalendarLink('u1').syncEvent(spec)).toBe('written')
    const upsert = h.calls.at(-1)!
    expect(args(upsert, 'upsert')).toEqual([
      { id: 'e1', user_id: 'u1', title: spec.title, memo: null, category_id: CAT, color: null, all_day: true, start_at: '2027-11-05', end_at: '2027-11-05', recurrence: null, excluded_dates: null },
      { onConflict: 'id' },
    ])
  })

  it('제목·날짜·카테고리가 모두 같으면 쓰지 않는다', async () => {
    h.queue.push(ok(CAT))
    const known = { id: 'e1', title: spec.title, start_at: spec.date, category_id: CAT }
    expect(await createCalendarLink('u1').syncEvent(spec, known)).toBe('unchanged')
    expect(h.calls.filter((c) => c.target === 'events')).toHaveLength(0)
  })

  it('하나라도 다르면 덮어쓰고, 재시도해도 같은 id의 upsert라 일정은 1건이다(AC-08-6)', async () => {
    const link = createCalendarLink('u1')
    h.queue.push(ok(CAT), ok(null), ok(null))
    const stale = { id: 'e1', title: '[옛 이름] 엔진오일 교체 예정', start_at: spec.date, category_id: CAT }
    expect(await link.syncEvent(spec, stale)).toBe('written')
    expect(await link.syncEvent(spec, null)).toBe('written')
    const ids = h.calls.filter((c) => c.target === 'events').map((c) => (args(c, 'upsert') as [{ id: string }])[0].id)
    expect(ids).toEqual(['e1', 'e1'])
  })

  it('known이 null이면 조회 없이 쓰고, 생략하면 먼저 조회한다', async () => {
    h.queue.push(ok(CAT), ok(null))
    await createCalendarLink('u1').syncEvent(spec, null)
    expect(h.calls.filter((c) => args(c, 'select'))).toHaveLength(0)
  })

  it('카테고리가 그새 지워져 23503이면 id를 다시 받아 한 번만 다시 쓴다', async () => {
    h.queue.push(ok('cat-old'), ok([]), { data: null, error: { code: '23503' }, status: 409 }, ok('cat-new'), ok(null))
    expect(await createCalendarLink('u1').syncEvent(spec)).toBe('written')
    const upserts = h.calls.filter((c) => c.ops.some(([n]) => n === 'upsert'))
    expect(upserts.map((c) => (args(c, 'upsert') as [{ category_id: string }])[0].category_id)).toEqual(['cat-old', 'cat-new'])
  })

  it('다시 써도 23503이면 그 오류를 던진다', async () => {
    h.queue.push(ok('cat-old'), ok([]), { data: null, error: { code: '23503' }, status: 409 }, ok('cat-new'), { data: null, error: { code: '23503' }, status: 409 })
    await expect(createCalendarLink('u1').syncEvent(spec)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('RPC가 실패하면 일정 쓰기까지 가지 않는다', async () => {
    h.queue.push({ data: null, error: { code: '42501' }, status: 403 })
    await expect(createCalendarLink('u1').syncEvent(spec)).rejects.toMatchObject({ code: '42501' })
    expect(h.calls.filter((c) => c.target === 'events')).toHaveLength(0)
  })
})

describe('deleteEvent·rebindCategory', () => {
  it('지웠으면 true, 원래 없었으면 false이고 user_id 조건을 붙인다', async () => {
    const link = createCalendarLink('u1')
    h.queue.push(ok([{ id: 'e1' }]), ok([]))
    expect(await link.deleteEvent('e1')).toBe(true)
    expect(await link.deleteEvent('e1')).toBe(false)
    expect(h.calls.map((c) => c.ops.filter(([n]) => n === 'eq').map(([, a]) => a))).toEqual([[['id', 'e1'], ['user_id', 'u1']], [['id', 'e1'], ['user_id', 'u1']]])
  })

  it('삭제 실패는 오류로 던진다(차량 삭제·항목 삭제가 멈추는 근거)', async () => {
    h.queue.push({ data: null, error: { code: '' }, status: 0 })
    await expect(createCalendarLink('u1').deleteEvent('e1')).rejects.toMatchObject({ kind: 'network' })
  })

  it('재묶기는 100개씩 category_id를 갱신하고 빈 목록이면 아무것도 하지 않는다', async () => {
    const link = createCalendarLink('u1')
    await link.rebindCategory([])
    expect(h.calls).toHaveLength(0)
    h.queue.push(ok(CAT))
    await link.rebindCategory(Array.from({ length: 101 }, (_, i) => `e${i}`))
    const updates = h.calls.filter((c) => c.target === 'events')
    expect(updates).toHaveLength(2)
    expect(args(updates[0], 'update')).toEqual([{ category_id: CAT }])
    expect(JSON.stringify(args(updates[0], 'eq'))).toBe(JSON.stringify(['user_id', 'u1']))
  })
})
