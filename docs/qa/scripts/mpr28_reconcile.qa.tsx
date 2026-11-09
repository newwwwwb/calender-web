// MPR-28 QA 임시 스크립트: 열 때 점검(지운 일정 재생성·카테고리 재묶기·직접 만든 일정 제외·1회 규칙·실패)을 상태 있는 가짜 백엔드와 진짜 calendarLink 위에서 확인한다(npm test 미포함). MPR-27 스크립트와 같은 틀.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../../../src/carbook/data/request'
import type { CarRecord, DueDate, DueKind, ItemInput, MaintenanceItem, Vehicle } from '../../../src/carbook/domain/types'

interface Row { [k: string]: any }
const db = vi.hoisted(() => {
  const d: any = {
    vehicles: [] as Row[], items: [] as Row[], dues: [] as Row[], records: [] as Row[], events: [] as Row[], categories: [] as Row[],
    cnt: {} as Record<string, number>, fail: {} as Record<string, boolean>, failAt: {} as Record<string, number[]>, rpcCode: '' as string, log: [] as string[], ops: [] as any[], gate: {} as Record<string, Promise<void>>,
    reload: undefined as any, toast: undefined as any, signOut: undefined as any,
  }
  const hit = (key: string) => { const n = (d.cnt[key] = (d.cnt[key] ?? 0) + 1); return d.fail[key] === true || (d.failAt[key] ?? []).includes(n) }
  d.hit = hit
  const exec = (st: any) => {
    const key = `ev.${st.op}`; d.log.push(`${st.table}:${st.op}`); d.ops.push({ table: st.table, op: st.op, row: st.row, ids: st.ids, eq: st.eq })
    if (hit(key)) return { data: null, error: { code: 'XX000', message: 'boom' }, status: 500 }
    const rows = (st.table === 'events' ? d.events : d.categories) as Row[]
    const match = rows.filter((r) => st.f.every((f: any) => f(r)))
    if (st.op === 'select') return { data: match.map((r) => ({ ...r })), error: null, status: 200 }
    if (st.op === 'delete') { for (const r of match) rows.splice(rows.indexOf(r), 1); return { data: match.map((r) => ({ id: r.id })), error: null, status: 200 } }
    if (st.op === 'update') { for (const r of match) Object.assign(r, st.row); return { data: null, error: null, status: 204 } }
    if (st.op === 'upsert') {
      if (!d.categories.some((c: Row) => c.id === st.row.category_id)) return { data: null, error: { code: '23503', message: 'fk' }, status: 409 }
      const at = rows.findIndex((r) => r.id === st.row.id); if (at >= 0) rows[at] = { ...st.row }; else rows.push({ ...st.row })
      return { data: null, error: null, status: 201 }
    }
    return { data: null, error: { code: 'unsupported' }, status: 400 }
  }
  const builder = (table: string) => {
    const st: any = { table, op: 'select', f: [] as any[], row: null, ids: undefined as unknown[] | undefined, eq: {} as Record<string, unknown> }
    const b: any = {
      select: () => b, retry: () => b, abortSignal: () => b,
      eq: (k: string, v: unknown) => { st.eq[k] = v; st.f.push((r: Row) => r[k] === v); return b },
      in: (k: string, vs: unknown[]) => { st.ids = vs; st.f.push((r: Row) => vs.includes(r[k])); return b },
      upsert: (row: Row) => { st.op = 'upsert'; st.row = row; return b },
      delete: () => { st.op = 'delete'; return b },
      update: (row: Row) => { st.op = 'update'; st.row = row; return b },
      then: (res: any, rej: any) => Promise.resolve(d.gate[`ev.${st.op}`]).then(() => exec(st)).then(res, rej),
    }
    return b
  }
  const CAT = 'cat-fixed-user-1'
  d.CAT = CAT
  d.client = {
    from: (t: string) => builder(t),
    auth: { signOut: (...a: unknown[]) => d.signOut(...a) },
    rpc: (name: string) => {
      const res = () => {
        d.log.push(`rpc:${name}`)
        if (hit('rpc')) return { data: null, error: { code: d.rpcCode || 'XX000', message: 'rpc' }, status: d.rpcCode ? 403 : 500 }
        if (!d.categories.some((c: Row) => c.id === CAT)) d.categories.push({ id: CAT, user_id: 'user-1', name: '차계부' })
        return { data: CAT, error: null, status: 200 }
      }
      const b: any = { abortSignal: () => b, then: (r: any, j: any) => Promise.resolve(res()).then(r, j) }
      return b
    },
  }
  return d
})

const net = () => new CarbookError('network')
const nextId = (() => { let n = 0; return () => `gen-${++n}` })()

vi.mock('../../../src/lib/supabaseClient', () => ({ supabase: db.client }))
vi.mock('../../../src/carbook/data/carbookApi', () => {
  const enter = async (name: string) => { if (db.hit(`api.${name}`)) throw net() }
  const clone = (x: Row) => ({ ...x })
  return {
    listVehicles: async () => { await enter('listVehicles'); return db.vehicles.map(clone) },
    listItems: async () => { await enter('listItems'); return db.items.map(clone) },
    listDueDates: async () => { await enter('listDueDates'); return db.dues.map(clone) },
    listRecords: async (vid: string) => { await enter('listRecords'); return db.records.filter((r: Row) => r.vehicleId === vid).map(clone) },
    createVehicle: async (id: string, i: Row) => { await enter('createVehicle'); const v = { id, ...i, createdAt: `t${db.vehicles.length}` }; db.vehicles.push(v); return clone(v) },
    updateVehicle: async (id: string, i: Row) => { await enter('updateVehicle'); const v = db.vehicles.find((x: Row) => x.id === id); Object.assign(v, i); return clone(v) },
    deleteVehicle: async (id: string) => {
      await enter('deleteVehicle')
      db.vehicles = db.vehicles.filter((x: Row) => x.id !== id); for (const k of ['items', 'dues', 'records']) db[k] = db[k].filter((x: Row) => x.vehicleId !== id)
    },
    createItems: async (vid: string, rows: Row[]) => { await enter('createItems'); const made = rows.map((r) => ({ ...r, vehicleId: vid, createdAt: `t${db.items.length}${r.id}` })); db.items.push(...made); return made.map(clone) },
    createRecord: async (id: string, vid: string, i: Row) => { await enter('createRecord'); const r = { id, vehicleId: vid, ...i, createdAt: `t${db.records.length}z` }; db.records.push(r); return clone(r) },
    updateRecord: async (id: string, i: Row) => { await enter('updateRecord'); const r = db.records.find((x: Row) => x.id === id); Object.assign(r, i); return clone(r) },
    deleteRecord: async (id: string) => { await enter('deleteRecord'); db.records = db.records.filter((x: Row) => x.id !== id) },
    fillMissingItemOdometer: async (vid: string, km: number) => {
      await enter('fillMissingItemOdometer'); const ch = db.items.filter((i: Row) => i.vehicleId === vid && i.intervalKm !== null && i.lastOdometerKm === null); ch.forEach((i: Row) => { i.lastOdometerKm = km }); return ch.map(clone)
    },
    // event_id 선점: 비어 있을 때만 채운다(행 수는 보지 않음). 돌려주는 행의 eventId가 정본. db.claimBlocked면 선점이 막혀 null 그대로(RLS 등)
    updateItem: async (id: string, i: Row, claim?: string) => {
      await enter('updateItem'); const r = db.items.find((x: Row) => x.id === id)
      if (claim && r.eventId === null && !db.claimBlocked) r.eventId = claim
      Object.assign(r, i); return clone(r)
    },
    deleteItem: async (id: string) => { await enter('deleteItem'); db.items = db.items.filter((x: Row) => x.id !== id) },
    createDueDate: async (row: Row) => {
      await enter('createDueDate')
      if (db.dues.some((d: Row) => d.vehicleId === row.vehicleId && d.kind === row.kind)) throw new CarbookError('conflict', '23505')
      const d = { id: row.id, vehicleId: row.vehicleId, kind: row.kind, dueDate: row.dueDate, eventId: row.eventId, createdAt: `t${db.dues.length}d` }; db.dues.push(d); return clone(d)
    },
    updateDueDate: async (id: string, dueDate: string, claim?: string) => {
      await enter('updateDueDate'); const r = db.dues.find((x: Row) => x.id === id)
      if (claim && r.eventId === null && !db.claimBlocked) r.eventId = claim
      r.dueDate = dueDate; return clone(r)
    },
    deleteDueDate: async (id: string) => { await enter('deleteDueDate'); db.dues = db.dues.filter((x: Row) => x.id !== id) },
    clearEventId: async (t: 'item' | 'due', id: string) => { await enter('clearEventId'); const r = (t === 'item' ? db.items : db.dues).find((x: Row) => x.id === id); if (r) r.eventId = null },
  }
})
vi.mock('../../../src/state/useCalendar', () => ({ useCalendar: () => ({ reload: db.reload }) }))
vi.mock('../../../src/state/useToast', () => ({ useToast: () => ({ showToast: db.toast }) }))

import { useCarbook } from '../../../src/carbook/state/useCarbook'

const MSG01 = '저장하지 못했습니다. 다시 시도해 주세요', MSG03 = '삭제하지 못했습니다. 다시 시도해 주세요'
const CAT: string = db.CAT
const veh = (id = 'v1', o: Partial<Vehicle> = {}): Vehicle => ({ id, name: '내 차', model: null, year: null, plate: '12가3456', odometerKm: 48000, createdAt: `c-${id}`, ...o })
const iin = (o: Partial<ItemInput> = {}): ItemInput => ({ name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: null, ...o })
const titleOf = (v: string, n: string) => `[${v}] ${n} 교체 예정`
const addCat = () => { if (!db.categories.some((c: Row) => c.id === CAT)) db.categories.push({ id: CAT, user_id: 'user-1', name: '차계부' }) }
// 연결 일정이 이미 캘린더에 있는 상태를 만든다
const seedEvent = (id: string, title: string, date: string, cat: string | null = CAT) => { addCat(); db.events.push({ id, user_id: 'user-1', title, memo: null, category_id: cat, color: null, all_day: true, start_at: date, end_at: date, recurrence: null, excluded_dates: null }) }
const seedItem = (id: string, o: Partial<MaintenanceItem> = {}, ev?: { date: string }) => {
  const it = { ...iin(), id, vehicleId: 'v1', eventId: `ev-${id}`, createdAt: `s${id}`, ...o } as MaintenanceItem; db.items.push(it)
  if (ev && it.eventId) seedEvent(it.eventId, titleOf('내 차', it.name), ev.date); return it
}
const seedDue = (id: string, kind: DueKind, date: string, eventId: string | null = `ev-${id}`) => { db.dues.push({ id, vehicleId: 'v1', kind, dueDate: date, eventId, createdAt: `d${id}` } as DueDate) }
const seedRec = (id: string, date: string, odometerKm: number | null, vid = 'v1') => { db.records.push({ id, vehicleId: vid, kind: 'other', date, amountWon: 1, odometerKm, liters: null, fullTank: false, memo: null, createdAt: `r${id}` } as CarRecord) }
const toasts = () => db.toast.mock.calls.map((c: any[]) => c[0].message as string)
const logCount = (p: string) => db.log.filter((l: string) => l.startsWith(p)).length

async function mount(userId = 'user-1') {
  const h = renderHook(() => useCarbook(userId))
  await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
  return h
}
const call = async <T,>(f: () => Promise<T>) => { let r!: T; await act(async () => { r = await f() }); return r }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00'))
  Object.assign(db, { vehicles: [veh('v1')], items: [], dues: [], records: [], events: [], categories: [], cnt: {}, fail: {}, failAt: {}, rpcCode: '', log: [], ops: [], gate: {}, claimBlocked: false })
  db.reload = vi.fn(async () => {}); db.toast = vi.fn(); db.signOut = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

import { writeFileSync } from 'node:fs'

const L1 = 'e0000000-0000-4000-8000-000000000001', L2 = 'e0000000-0000-4000-8000-000000000002', DIRECT = 'e0000000-0000-4000-8000-000000000003'
const delCat = () => { db.categories = db.categories.filter((c: Row) => c.id !== CAT); db.events.forEach((e: Row) => { if (e.category_id === CAT) e.category_id = null }) } // 카테고리 삭제 → 일정 분류 풀림(DB의 on delete set null)
const evOf = (id: string) => db.events.find((e: Row) => e.id === id)
const idle = () => new Promise((r) => setTimeout(r, 60)) // 뒤에서 도는 점검이 끝나길 잠시 기다린다(가짜 타이머는 Date만)
const upd = () => db.ops.filter((o: Row) => o.table === 'events' && o.op === 'update')
const writes = () => db.ops.filter((o: Row) => o.table === 'events' && ['update', 'upsert', 'delete'].includes(o.op))

describe('AC-08-3 지운 일정 재생성', () => {
  it('항목·만기일의 연결 일정이 캘린더에서 지워진 채 열면 같은 id·제목·날짜로 다시 생기고 항목당 1건, reload 1회, 토스트 없음', async () => {
    seedItem('i1', { eventId: L1 }); seedDue('d1', 'insurance', '2027-03-10', L2); addCat(); const h = await mount()
    await waitFor(() => expect(db.events).toHaveLength(2))
    expect(db.events.map((e: Row) => [e.id, e.title, e.start_at, e.category_id, e.all_day]).sort()).toEqual([[L1, titleOf('내 차', '엔진오일'), '2027-11-05', CAT, true], [L2, '[내 차] 보험 만기', '2027-03-10', CAT, true]].sort())
    await idle(); expect([db.reload.mock.calls.length, toasts().length, h.result.current.items[0].calendarFailed, h.result.current.dueDates[0].calendarFailed]).toEqual([1, 0, false, false])
  })
  it('다시 열면(새 화면 수명) 이미 있으니 쓰기 0번·reload 0번, 일정은 여전히 항목당 1건', async () => {
    seedItem('i1', { eventId: L1 }); await mount(); await waitFor(() => expect(db.events).toHaveLength(1)); await idle()
    db.reload.mockClear(); db.ops.length = 0; await mount(); await idle()
    expect([db.events.length, writes().length, db.reload.mock.calls.length]).toEqual([1, 0, 0])
  })
  it('연결 id가 없는 항목·만기일은 열 때 일정을 만들지 않음', async () => {
    seedItem('i1', { eventId: null }); seedDue('d1', 'insurance', '2027-03-10', null); await mount(); await idle()
    expect([db.events.length, db.ops.filter((o: Row) => o.table === 'events').length, db.reload.mock.calls.length]).toEqual([0, 0, 0])
  })
  it('같은 화면 수명에서 행마다 한 번: 차량을 바꿨다 돌아와도 조회·쓰기 반복 없음', async () => {
    db.vehicles.push(veh('v2', { name: '가족' })); seedItem('i1', { eventId: L1 }); const h = await mount(); await waitFor(() => expect(db.events).toHaveLength(1)); await idle()
    const before = db.ops.length; act(() => h.result.current.selectVehicle('v2')); await waitFor(() => expect(h.result.current.selectedVehicleId).toBe('v2')); await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
    act(() => h.result.current.selectVehicle('v1')); await waitFor(() => expect(h.result.current.selectedVehicleId).toBe('v1')); await idle()
    expect(db.ops.length).toBe(before); expect(db.events).toHaveLength(1)
  })
  it('km 항목: 기록이 읽혀 날짜를 구할 수 있으면 같은 id로 다시 만든다', async () => {
    seedRec('r0', '2026-10-26', 48900); seedRec('r1', '2026-11-05', 49100); seedItem('k', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000, eventId: L1 }); addCat(); await mount()
    await waitFor(() => expect(evOf(L1)).toBeTruthy()); expect(evOf(L1).start_at).toBe('2026-12-20')
  })
  it('km 항목 기록 부족(1건뿐)이면 일정 안 만들고 MSG-11도 없음', async () => {
    seedRec('r0', '2026-10-26', 48900); seedItem('no', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000, eventId: L2 }); addCat(); const h = await mount(); await idle()
    expect([db.events.length, h.result.current.items[0].calendarFailed, h.result.current.items[0].nextDate, db.reload.mock.calls.length]).toEqual([0, false, null, 0])
  })
  it('다른 차량의 km 항목은 그 차량의 기록을 읽은 뒤에야 판단(미룸)하고, 선택하면 그때 다시 만든다', async () => {
    db.vehicles.push(veh('v2', { name: '가족' })); seedRec('r0', '2026-10-26', 48900, 'v2'); seedRec('r1', '2026-11-05', 49100, 'v2'); addCat()
    db.items.push({ ...iin(), id: 'k2', vehicleId: 'v2', name: '엔진오일', intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000, eventId: L1, createdAt: 'k' } as any)
    const h = await mount(); await idle(); expect(db.events).toHaveLength(0)
    act(() => h.result.current.selectVehicle('v2')); await waitFor(() => expect(evOf(L1)).toBeTruthy()); expect(evOf(L1).title).toBe(titleOf('가족', '엔진오일'))
  })
})

describe('AC-08-14·AC-16-6·AC-16-8 카테고리 재묶기', () => {
  it('카테고리를 지운 뒤 열면 카테고리 1개가 새로 생기고 연결 일정 2건이 모두 그 카테고리에 속함, 재묶기는 한 번에(update 1번)', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); seedDue('d1', 'insurance', '2027-03-10', L2); seedEvent(L2, '[내 차] 보험 만기', '2027-03-10'); delCat()
    expect(db.categories).toHaveLength(0); expect([evOf(L1).category_id, evOf(L2).category_id]).toEqual([null, null]); await mount()
    await waitFor(() => expect([evOf(L1).category_id, evOf(L2).category_id]).toEqual([CAT, CAT])); await idle()
    expect(db.categories.map((c: Row) => [c.id, c.name])).toEqual([[CAT, '차계부']]); expect(upd()).toHaveLength(1); expect([...upd()[0].ids].sort()).toEqual([L1, L2]); expect(upd()[0].eq.user_id).toBe('user-1'); expect(upd()[0].row).toEqual({ category_id: CAT })
    expect(db.reload.mock.calls.length).toBe(1); expect(toasts()).toEqual([])
  })
  it('AC-16-8 직접 만든 일정은 카테고리 재생성 뒤에도 다시 묶이지 않음(분류 없음 그대로), 재묶기 대상 id에도 없음, 이후 저장에도 그대로', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); seedEvent(DIRECT, '내가 직접 만든 일정', '2027-02-02'); delCat()
    const h = await mount(); await waitFor(() => expect(evOf(L1).category_id).toBe(CAT)); await idle()
    expect(evOf(DIRECT).category_id).toBeNull(); expect(upd().every((o: Row) => !o.ids.includes(DIRECT))).toBe(true); expect(db.categories).toHaveLength(1)
    await call(() => h.result.current.saveItem(iin({ intervalMonths: 6 }), 'i1')); await call(() => h.result.current.saveDueDate('insurance', '2027-03-10')); expect(evOf(DIRECT).category_id).toBeNull(); expect(upd().every((o: Row) => !o.ids.includes(DIRECT))).toBe(true)
    if (process.env.QA_OPS_OUT) writeFileSync(process.env.QA_OPS_OUT, JSON.stringify({ L1, DIRECT, rebinds: upd().map((o: Row) => ({ ids: o.ids, user: o.eq.user_id })) }))
  })
  it('평상시 열기: 차계부 카테고리의 직접 만든 일정도, 같은 이름 수동 카테고리 일정도 쓰기 0번', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); seedEvent(DIRECT, '직접', '2027-02-02'); db.categories.push({ id: 'manual', user_id: 'user-1', name: '차계부' }); seedEvent('e0000000-0000-4000-8000-000000000009', '수동', '2027-02-03', 'manual')
    await mount(); await idle(); expect(writes()).toEqual([]); expect(db.reload).not.toHaveBeenCalled()
  })
  it('연결 일정이 다른 카테고리로 옮겨져 있으면 연결 일정만 고정 id 카테고리로 되돌리고, 같은 카테고리의 직접 일정은 그대로', async () => {
    db.categories.push({ id: 'work', user_id: 'user-1', name: '업무' }); seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); evOf(L1).category_id = 'work'; seedEvent(DIRECT, '직접', '2027-02-02', 'work')
    await mount(); await waitFor(() => expect(evOf(L1).category_id).toBe(CAT)); expect(evOf(DIRECT).category_id).toBe('work')
  })
  it('재묶기와 재생성이 함께 필요해도 reload는 1번', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); seedDue('d1', 'insurance', '2027-03-10', L2); delCat(); await mount()
    await waitFor(() => expect(db.events).toHaveLength(2)); await waitFor(() => expect(evOf(L1).category_id).toBe(CAT)); await idle(); expect(db.reload.mock.calls.length).toBe(1)
  })
  it('최대 규모(연결 행 330): 조회 100개씩 4번, 재묶기 100개씩 4번, 모두 고정 카테고리', async () => {
    addCat()
    for (let i = 0; i < 330; i++) {
      const id = `e1000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      if (i < 300) db.items.push({ ...iin(), id: `m${i}`, vehicleId: 'v1', name: `항목${i}`, eventId: id, createdAt: `m${String(i).padStart(4, '0')}` } as any)
      else db.dues.push({ id: `dd${i}`, vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: id, createdAt: 'x' } as any)
      seedEvent(id, `t${i}`, '2027-01-01', null)
    }
    await mount(); await waitFor(() => expect(db.events.every((e: Row) => e.category_id === CAT)).toBe(true)); await idle()
    expect([db.ops.filter((o: Row) => o.op === 'select').length, upd().length, upd().map((o: Row) => o.ids.length)]).toEqual([4, 4, [100, 100, 100, 30]]); expect(db.reload.mock.calls.length).toBe(1)
  })
})

describe('실패와 화면 비차단', () => {
  it('점검의 일정 조회가 오래 걸려도 화면은 먼저 그려짐 → 조회가 끝나면 재생성', async () => {
    let open!: () => void; db.gate['ev.select'] = new Promise<void>((r) => { open = r }); seedItem('i1', { eventId: L1 }); addCat(); const h = await mount()
    expect([h.result.current.loadState, h.result.current.recordsState, h.result.current.items.length, db.events.length]).toEqual(['ready', 'ready', 1, 0]); open(); await waitFor(() => expect(db.events).toHaveLength(1))
  })
  it('일정 조회 실패 → 연결 행 전부 calendarFailed, 토스트 없음, 화면 데이터 그대로, 재시도하면 일정 생성·표시 해제', async () => {
    seedItem('i1', { eventId: L1 }); seedDue('d1', 'insurance', '2027-03-10', L2); addCat(); db.failAt['ev.select'] = [1]; const h = await mount()
    await waitFor(() => expect(h.result.current.items[0].calendarFailed).toBe(true)); expect([h.result.current.dueDates[0].calendarFailed, toasts().length, h.result.current.items.length, db.events.length]).toEqual([true, 0, 1, 0])
    await call(() => h.result.current.retryCalendar({ type: 'item', id: 'i1' })); await call(() => h.result.current.retryCalendar({ type: 'due', id: 'd1' })); expect([h.result.current.items[0].calendarFailed, h.result.current.dueDates[0].calendarFailed, db.events.length]).toEqual([false, false, 2])
  })
  it('재묶기 실패(update) → 그 일정 행 calendarFailed, 토스트 없음 → 재시도하면 고정 카테고리로 정정·표시 해제', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); delCat(); db.failAt['ev.update'] = [1]; const h = await mount()
    await waitFor(() => expect(h.result.current.items[0].calendarFailed).toBe(true)); expect([toasts().length, evOf(L1).category_id]).toEqual([0, null])
    await call(() => h.result.current.retryCalendar({ type: 'item', id: 'i1' })); expect([h.result.current.items[0].calendarFailed, evOf(L1).category_id, db.events.length]).toEqual([false, CAT, 1])
  })
  it('ensure(RPC) 42501 실패 → 일정 있는 행 calendarFailed, 토스트·로그아웃 없음', async () => {
    seedItem('i1', { eventId: L1 }, { date: '2027-11-05' }); delCat(); db.rpcCode = '42501'; db.fail.rpc = true; const h = await mount()
    await waitFor(() => expect(h.result.current.items[0].calendarFailed).toBe(true)); expect([toasts().length, db.signOut.mock.calls.length]).toEqual([0, 0])
  })
  it('재생성 쓰기 실패 → 그 행만 표시, 나머지 행은 정상 재생성', async () => {
    seedItem('i1', { eventId: L1 }); seedDue('d1', 'insurance', '2027-03-10', L2); addCat(); db.failAt['ev.upsert'] = [1]; const h = await mount()
    await waitFor(() => expect(db.events).toHaveLength(1)); await idle(); expect([h.result.current.items[0].calendarFailed, h.result.current.dueDates[0].calendarFailed].filter(Boolean)).toHaveLength(1)
  })
})

describe('AC-08-12 저장 → 캘린더 반영: 순차 요청 수(실측은 MPR-38)', () => {
  it('만기일·항목 저장에서 reload 호출 직전까지의 순차 요청 수를 센다', async () => {
    const out: Record<string, number> = {}
    const total = () => db.log.length + Object.entries(db.cnt as Record<string, number>).filter(([k]) => k.startsWith('api.')).reduce((a, [, v]) => a + v, 0)
    let at = 0; db.reload = vi.fn(async () => { at = total() }) // 훅을 올리기 전에 바꿔야 훅이 이 함수를 쓴다
    const h = await mount(); await idle()
    let t0 = total(); await call(() => h.result.current.saveDueDate('insurance', '2027-03-10')); out['새 만기일 첫 저장(카테고리 RPC 포함)'] = at - t0
    t0 = total(); await call(() => h.result.current.saveDueDate('insurance', '2027-04-01')); out['만기일 수정'] = at - t0
    t0 = total(); await call(() => h.result.current.saveItem(iin())); out['새 항목 저장'] = at - t0
    console.log('REQS(reload 호출 직전까지)', JSON.stringify(out)); if (process.env.QA_OPS_OUT) writeFileSync(process.env.QA_OPS_OUT + '.reqs', JSON.stringify(out))
    expect(Object.values(out).every((n) => n > 0)).toBe(true)
  })
})
