// carbookApi의 행↔도메인 변환, 쪽 읽기, 선점 순서, 오류 전달을 supabase 모의 객체로 확인하는 테스트
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; ops: [string, unknown[]][] }
const h = vi.hoisted(() => ({ calls: [] as Call[], queue: [] as unknown[], client: true }))

vi.mock('../../lib/supabaseClient', () => ({
  get supabase() {
    if (!h.client) return null
    return {
      from: (table: string) => {
        const call: Call = { table, ops: [] }
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
      },
    }
  },
}))

import * as api from './carbookApi'

const ok = (data: unknown) => ({ data, error: null })
const opNames = (c: Call) => c.ops.map(([n]) => n)
const opArgs = (c: Call, name: string) => c.ops.find(([n]) => n === name)?.[1]
const vRow = (id: string) => ({ id, name: '출퇴근', model: null, year: 2020, plate: null, odometer_km: 100, created_at: '2026-11-05T00:00:00Z' })
const rec = { kind: 'wash', date: '2026-11-05', amountWon: 10000, odometerKm: null, liters: 30, fullTank: true, memo: '' } as const

beforeEach(() => { h.calls.length = 0; h.queue.length = 0; h.client = true; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('읽기', () => {
  it('행을 도메인 모양(camelCase)으로 바꾸고 .retry(false)를 붙인다', async () => {
    h.queue.push(ok([vRow('v1')]))
    expect(await api.listVehicles()).toEqual([{ id: 'v1', name: '출퇴근', model: null, year: 2020, plate: null, odometerKm: 100, createdAt: '2026-11-05T00:00:00Z' }])
    expect(opNames(h.calls[0])).toContain('retry')
    expect(opArgs(h.calls[0], 'retry')).toEqual([false])
  })

  it('1,000행이 꽉 차면 다음 쪽을 이어 읽고 id로 중복을 지운다', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => vRow(`v${i}`))
    h.queue.push(ok(page1), ok([vRow('v999'), vRow('v1000')]))
    const all = await api.listVehicles()
    expect(all).toHaveLength(1001)
    expect(h.calls.map((c) => opArgs(c, 'range'))).toEqual([[0, 999], [1000, 1999]])
  })

  it('기록은 차량으로 거르고 날짜·생성 내림차순에 id를 붙인다', async () => {
    h.queue.push(ok([]))
    await api.listRecords('v1')
    const orders = h.calls[0].ops.filter(([n]) => n === 'order').map(([, a]) => [a[0], (a[1] as { ascending: boolean }).ascending])
    expect(orders).toEqual([['date', false], ['created_at', false], ['id', false]])
    expect(opArgs(h.calls[0], 'eq')).toEqual(['vehicle_id', 'v1'])
  })

  it('네트워크 오류는 network로 던진다(AC-03-4)', async () => {
    h.queue.push({ data: null, error: { code: '' }, status: 0 })
    await expect(api.listItems()).rejects.toMatchObject({ kind: 'network' })
  })

  it('클라이언트가 없으면 no_client', async () => {
    h.client = false
    await expect(api.listVehicles()).rejects.toMatchObject({ kind: 'unknown', code: 'no_client' })
  })
})

describe('기록 쓰기', () => {
  const recRow = { id: 'r1', vehicle_id: 'v1', kind: 'wash', date: '2026-11-05', amount_won: 10000, odometer_km: null, liters: null, full_tank: false, memo: null, created_at: 'c' }

  it('주유가 아니면 liters=null·full_tank=false, 빈 메모는 null로 보낸다(BR-10)', async () => {
    h.queue.push(ok(recRow))
    const saved = await api.createRecord('r1', 'v1', rec)
    const [body, opts] = opArgs(h.calls[0], 'upsert') as [Record<string, unknown>, unknown]
    expect(body).toMatchObject({ id: 'r1', vehicle_id: 'v1', liters: null, full_tank: false, memo: null })
    expect(opts).toEqual({ onConflict: 'id' })
    expect(saved).toMatchObject({ id: 'r1', vehicleId: 'v1', amountWon: 10000, fullTank: false })
  })

  it('수정 결과가 0행이면 not_found', async () => {
    h.queue.push(ok(null))
    await expect(api.updateRecord('r1', rec)).rejects.toMatchObject({ kind: 'unknown', code: 'not_found' })
  })

  it('삭제는 0행이어도 성공이다', async () => {
    await expect(api.deleteRecord('r1')).resolves.toBeUndefined()
    expect(opArgs(h.calls[0], 'eq')).toEqual(['id', 'r1'])
  })
})

describe('교체 항목·만기일', () => {
  const itemRow = { id: 'i1', vehicle_id: 'v1', name: '엔진오일', interval_km: null, interval_months: 12, last_date: '2026-11-05', last_odometer_km: null, event_id: 'e1', created_at: 'c' }
  const input = { name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: null }

  it('선점은 event_id가 빈 행만 채우고, 수정 본문에는 event_id가 없다', async () => {
    h.queue.push(ok(null), ok(itemRow))
    const saved = await api.updateItem('i1', input, 'e-new')
    expect(h.calls).toHaveLength(2)
    expect(opArgs(h.calls[0], 'update')).toEqual([{ event_id: 'e-new' }])
    expect(opArgs(h.calls[0], 'is')).toEqual(['event_id', null])
    expect(Object.keys((opArgs(h.calls[1], 'update') as [object])[0])).not.toContain('event_id')
    expect(saved.eventId).toBe('e1') // 돌려받은 행의 event_id가 정본
  })

  it('claimEventId가 없으면 선점 질의를 보내지 않고, 선점 오류는 수정으로 가지 않는다', async () => {
    h.queue.push(ok(itemRow))
    await api.updateItem('i1', input)
    expect(h.calls).toHaveLength(1)
    h.calls.length = 0
    h.queue.push({ data: null, error: { code: '' }, status: 0 })
    await expect(api.updateItem('i1', input, 'e2')).rejects.toMatchObject({ kind: 'network' })
    expect(h.calls).toHaveLength(1)
  })

  it('createItems는 created_at을 1ms씩 늘려 보낸 순서를 보존한다', async () => {
    h.queue.push(ok([itemRow]))
    await api.createItems('v1', [{ id: 'a', eventId: null, ...input }, { id: 'b', eventId: null, ...input }])
    const [rows] = opArgs(h.calls[0], 'upsert') as [{ created_at: string; event_id: null }[]]
    expect(Date.parse(rows[1].created_at) - Date.parse(rows[0].created_at)).toBe(1)
    expect(rows[0].event_id).toBeNull()
  })

  it('만기일 생성은 insert이고 두 번째 저장은 conflict다', async () => {
    h.queue.push({ data: null, error: { code: '23505' }, status: 409 })
    await expect(api.createDueDate({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'e1' })).rejects.toMatchObject({ kind: 'conflict' })
    expect(opNames(h.calls[0])).toContain('insert')
  })

  it('주행거리 채움은 비어 있는 항목만 바꾸고 바뀐 행을 돌려준다', async () => {
    h.queue.push(ok([{ ...itemRow, last_odometer_km: 500 }]))
    const changed = await api.fillMissingItemOdometer('v1', 500)
    expect(changed).toHaveLength(1)
    expect(opArgs(h.calls[0], 'is')).toEqual(['last_odometer_km', null])
  })

  it('연결 해제는 해당 테이블의 event_id를 null로 만든다', async () => {
    await api.clearEventId('due', 'd1')
    expect(h.calls[0].table).toBe('car_due_dates')
    expect(opArgs(h.calls[0], 'update')).toEqual([{ event_id: null }])
  })
})
