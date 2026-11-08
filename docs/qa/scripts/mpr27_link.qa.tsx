// MPR-27 QA 임시 스크립트: useCarbook을 상태를 가진 가짜 백엔드(carbookApi 대체)와 진짜 calendarLink(가짜 supabase 클라이언트 위 events·categories 표)에 물려 캘린더 연동 AC를 확인한다(npm test 미포함).
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../../../src/carbook/data/request'
import type { CarRecord, DueDate, DueKind, ItemInput, MaintenanceItem, Vehicle } from '../../../src/carbook/domain/types'

interface Row { [k: string]: any }
const db = vi.hoisted(() => {
  const d: any = {
    vehicles: [] as Row[], items: [] as Row[], dues: [] as Row[], records: [] as Row[], events: [] as Row[], categories: [] as Row[],
    cnt: {} as Record<string, number>, fail: {} as Record<string, boolean>, failAt: {} as Record<string, number[]>, rpcCode: '' as string, log: [] as string[],
    reload: undefined as any, toast: undefined as any, signOut: undefined as any,
  }
  const hit = (key: string) => { const n = (d.cnt[key] = (d.cnt[key] ?? 0) + 1); return d.fail[key] === true || (d.failAt[key] ?? []).includes(n) }
  d.hit = hit
  const exec = (st: any) => {
    const key = `ev.${st.op}`; d.log.push(`${st.table}:${st.op}`)
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
    const st: any = { table, op: 'select', f: [] as any[], row: null }
    const b: any = {
      select: () => b, retry: () => b, abortSignal: () => b,
      eq: (k: string, v: unknown) => { st.f.push((r: Row) => r[k] === v); return b },
      in: (k: string, vs: unknown[]) => { st.f.push((r: Row) => vs.includes(r[k])); return b },
      upsert: (row: Row) => { st.op = 'upsert'; st.row = row; return b },
      delete: () => { st.op = 'delete'; return b },
      update: (row: Row) => { st.op = 'update'; st.row = row; return b },
      then: (res: any, rej: any) => Promise.resolve(exec(st)).then(res, rej),
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
  Object.assign(db, { vehicles: [veh('v1')], items: [], dues: [], records: [], events: [], categories: [], cnt: {}, fail: {}, failAt: {}, rpcCode: '', log: [], claimBlocked: false })
  db.reload = vi.fn(async () => {}); db.toast = vi.fn(); db.signOut = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('AC-08-1·10 교체 항목 일정 생성', () => {
  it('엔진오일 12개월 저장 → 종일 일정 "[내 차] 엔진오일 교체 예정"이 2027-11-05에 1건, 고정 id 카테고리, 항목 event_id와 일치, 캘린더 reload 1회', async () => {
    const h = await mount(); expect(await call(() => h.result.current.saveItem(iin()))).toBe(true)
    expect(db.events).toHaveLength(1); const e = db.events[0]; const it = db.items[0]
    expect([e.title, e.start_at, e.end_at, e.all_day, e.category_id, e.user_id, e.memo]).toEqual(['[내 차] 엔진오일 교체 예정', '2027-11-05', '2027-11-05', true, CAT, 'user-1', null])
    expect(e.id).toBe(it.eventId); expect(db.reload).toHaveBeenCalledTimes(1); expect(toasts()).toEqual([])
    expect(h.result.current.items[0].nextDate).toBe('2027-11-05')
  })
  it('번호판 12가3456은 일정 제목·메모 어디에도 없음(항목·만기일 모두)', async () => {
    const h = await mount(); await call(() => h.result.current.saveItem(iin())); await call(() => h.result.current.saveItem(iin({ name: '타이어', intervalMonths: 48 })))
    for (const k of ['insurance', 'car_tax', 'inspection'] as DueKind[]) await call(() => h.result.current.saveDueDate(k, '2027-03-10'))
    expect(db.events).toHaveLength(5); expect(JSON.stringify(db.events)).not.toContain('12가3456'); expect(JSON.stringify(db.events)).not.toContain('3456')
  })
})

describe('AC-07-1·2·5·6 / AC-08-2 만기일', () => {
  it('보험 2027-03-10 저장 → 화면 값과 일정 "[내 차] 보험 만기"; 2027-04-01로 수정 → 일정 날짜 변경(1건 유지); 삭제 → 일정도 행도 사라지고 "날짜 없음"', async () => {
    const h = await mount(); expect(await call(() => h.result.current.saveDueDate('insurance', '2027-03-10'))).toBe(true)
    expect(h.result.current.dueDates.map((d) => [d.kind, d.dueDate])).toEqual([['insurance', '2027-03-10']]); expect([db.events[0].title, db.events[0].start_at]).toEqual(['[내 차] 보험 만기', '2027-03-10'])
    expect(await call(() => h.result.current.saveDueDate('insurance', '2027-04-01'))).toBe(true)
    expect(h.result.current.dueDates).toHaveLength(1); expect(h.result.current.dueDates[0].dueDate).toBe('2027-04-01'); expect(db.dues).toHaveLength(1); expect(db.events).toHaveLength(1); expect(db.events[0].start_at).toBe('2027-04-01')
    expect(logCount('events:upsert')).toBe(2) // 수정 때 새 일정을 또 만들지 않음(같은 id로 덮어씀)
    expect(await call(() => h.result.current.deleteDueDate('insurance'))).toBe(true)
    expect(h.result.current.dueDates).toHaveLength(0); expect(db.events).toHaveLength(0); expect(db.dues).toHaveLength(0)
  })
  it('AC-07-6 종류당 1개: 같은 종류를 다시 저장해도 만기일 행 생성 요청은 1번뿐(두 번째는 수정)', async () => {
    const h = await mount(); await call(() => h.result.current.saveDueDate('car_tax', '2027-06-01')); await call(() => h.result.current.saveDueDate('car_tax', '2027-07-01'))
    expect(db.cnt['api.createDueDate']).toBe(1); expect(db.cnt['api.updateDueDate']).toBe(1); expect(h.result.current.dueDates).toHaveLength(1)
  })
  it('세 종류 제목: 자동차세 납부·정기검사 만기', async () => {
    const h = await mount(); await call(() => h.result.current.saveDueDate('car_tax', '2027-06-01')); await call(() => h.result.current.saveDueDate('inspection', '2027-08-01'))
    expect(db.events.map((e: Row) => e.title).sort()).toEqual(['[내 차] 자동차세 납부', '[내 차] 정기검사 만기'])
  })
  it('AC-07-5 저장 실패(네트워크 끊김): MSG-01 토스트, 만기일 값 그대로(없음), 일정 없음', async () => {
    const h = await mount(); db.fail['api.createDueDate'] = true
    expect(await call(() => h.result.current.saveDueDate('insurance', '2027-03-10'))).toBe(false)
    expect(toasts()).toEqual([MSG01]); expect(h.result.current.dueDates).toHaveLength(0); expect(db.events).toHaveLength(0); expect(db.reload).not.toHaveBeenCalled()
  })
  it('AC-07-5 수정 저장 실패: 기존 값과 일정이 그대로', async () => {
    seedDue('d1', 'insurance', '2027-03-10'); seedEvent('ev-d1', '[내 차] 보험 만기', '2027-03-10'); const h = await mount(); db.fail['api.updateDueDate'] = true
    expect(await call(() => h.result.current.saveDueDate('insurance', '2027-04-01'))).toBe(false)
    expect(toasts()).toEqual([MSG01]); expect(h.result.current.dueDates[0].dueDate).toBe('2027-03-10'); expect(db.events[0].start_at).toBe('2027-03-10')
  })
})

describe('AC-06-2·10·11 교체 항목 수정·완료·추가·삭제', () => {
  it('AC-06-2 주기 12→6개월(마지막 교체일 2026-11-05) → 다음 교체일 2027-05-05, 일정도 같은 날로 이동', async () => {
    seedItem('i1', {}, { date: '2027-11-05' }); const h = await mount(); expect(h.result.current.items[0].nextDate).toBe('2027-11-05')
    await call(() => h.result.current.saveItem(iin({ intervalMonths: 6 }), 'i1')); expect(h.result.current.items[0].nextDate).toBe('2027-05-05'); expect(db.events).toHaveLength(1); expect(db.events[0].start_at).toBe('2027-05-05')
  })
  it('AC-06-10 지남 상태 엔진오일 교체 완료(2026-11-05, 48,000km) → 갱신·배지 사라짐·다음 교체일 재계산·일정 이동', async () => {
    seedItem('i1', { lastDate: '2025-01-05', lastOdometerKm: 30000, intervalKm: null, intervalMonths: 12 }, { date: '2026-01-05' }); const h = await mount(); expect(h.result.current.items[0].status).toBe('overdue')
    expect(await call(() => h.result.current.completeItem('i1', { date: '2026-11-05', odometerKm: 48000 }))).toBe(true)
    const v = h.result.current.items[0]; expect([v.lastDate, v.lastOdometerKm, v.status, v.nextDate]).toEqual(['2026-11-05', 48000, 'ok', '2027-11-05']); expect(db.events[0].start_at).toBe('2027-11-05')
  })
  it('AC-06-11 "타이어" 48개월 추가 → 목록에 나타나고 일정 생김; 삭제 → 목록·일정 모두 사라짐', async () => {
    const h = await mount(); await call(() => h.result.current.saveItem(iin({ name: '타이어', intervalMonths: 48 })))
    expect(h.result.current.items.map((i) => i.name)).toEqual(['타이어']); expect(db.events).toHaveLength(1); expect(db.events[0].start_at).toBe('2030-11-05')
    expect(await call(() => h.result.current.deleteItem(h.result.current.items[0].id))).toBe(true); expect(h.result.current.items).toHaveLength(0); expect(db.events).toHaveLength(0)
  })
})

describe('AC-08-4·16 카테고리', () => {
  it('AC-08-4 고정 id 카테고리가 이미 있으면 새로 만들지 않고 그걸 씀: 여러 저장 뒤에도 카테고리 1개, ensure RPC는 훅 수명 동안 1번', async () => {
    addCat(); const h = await mount(); await call(() => h.result.current.saveItem(iin())); await call(() => h.result.current.saveDueDate('insurance', '2027-03-10')); await call(() => h.result.current.saveItem(iin({ name: '타이어' })))
    expect(db.categories).toHaveLength(1); expect(db.events.every((e: Row) => e.category_id === CAT)).toBe(true); expect(logCount('rpc:')).toBe(1)
  })
  it('AC-08-16 수동으로 만든 같은 이름 "차계부" 카테고리와 그 일정: 연동 첫 저장 뒤에도 그대로, 연결 일정은 고정 id 카테고리, 카테고리 2개', async () => {
    db.categories.push({ id: 'manual-cat', user_id: 'user-1', name: '차계부' }); const manual = { id: 'm-ev', user_id: 'user-1', title: '내가 쓴 일정', memo: null, category_id: 'manual-cat', color: null, all_day: true, start_at: '2027-02-01', end_at: '2027-02-01', recurrence: null, excluded_dates: null }
    db.events.push({ ...manual }); const h = await mount(); await call(() => h.result.current.saveItem(iin()))
    expect(db.categories.map((c: Row) => c.id).sort()).toEqual([CAT, 'manual-cat'].sort()); expect(db.events.find((e: Row) => e.id === 'm-ev')).toEqual(manual)
    const linked = db.events.find((e: Row) => e.id === db.items[0].eventId); expect(linked.category_id).toBe(CAT); expect(db.events).toHaveLength(2)
    expect(db.log.filter((l: string) => l === 'events:update' || l === 'events:delete')).toEqual([]) // 수동 일정은 읽기·쓰기 모두 일정 id 지정 조회뿐
  })
  it('카테고리가 그새 지워진 상태(기억한 id): 23503이면 한 번 다시 만들어 쓴다', async () => {
    const h = await mount(); await call(() => h.result.current.saveItem(iin())); db.categories.length = 0 // 사용자가 카테고리를 지움
    expect(await call(() => h.result.current.saveItem(iin({ name: '타이어' })))).toBe(true); expect(db.categories.map((c: Row) => c.id)).toEqual([CAT]); expect(h.result.current.items.every((i) => !i.calendarFailed)).toBe(true)
    expect(db.events.find((e: Row) => e.title === titleOf('내 차', '타이어'))?.category_id).toBe(CAT)
  })
})

describe('AC-08-5·6 반영 실패와 재시도 (MSG-11)', () => {
  it('항목 저장은 성공하고 일정 쓰기만 실패: 항목은 남고 calendarFailed, 토스트 없음, 일정 0건, reload 안 함 → 재시도 성공하면 표시 사라지고 일정 1건', async () => {
    const h = await mount(); db.failAt['ev.upsert'] = [1]
    expect(await call(() => h.result.current.saveItem(iin()))).toBe(true); const v = h.result.current.items[0]
    expect([h.result.current.items.length, v.calendarFailed, toasts().length, db.events.length, db.reload.mock.calls.length]).toEqual([1, true, 0, 0, 0])
    await call(() => h.result.current.retryCalendar({ type: 'item', id: v.id })); expect(h.result.current.items[0].calendarFailed).toBe(false); expect(db.events).toHaveLength(1); expect(db.events[0].id).toBe(db.items[0].eventId); expect(db.reload).toHaveBeenCalledTimes(1)
  })
  it('AC-08-6 같은 실패 상태에서 재시도 버튼을 연달아 두 번(동시) → 일정 1건', async () => {
    const h = await mount(); db.failAt['ev.upsert'] = [1]; await call(() => h.result.current.saveItem(iin())); const id = h.result.current.items[0].id
    await act(async () => { await Promise.all([h.result.current.retryCalendar({ type: 'item', id }), h.result.current.retryCalendar({ type: 'item', id })]) })
    expect(db.events).toHaveLength(1); expect(h.result.current.items[0].calendarFailed).toBe(false)
    await call(() => h.result.current.retryCalendar({ type: 'item', id })); expect(db.events).toHaveLength(1) // 성공 뒤 한 번 더 눌러도 1건
  })
  it('만기일도 같음: 일정 실패 → 표시 → 재시도 1건', async () => {
    const h = await mount(); db.failAt['ev.upsert'] = [1]; await call(() => h.result.current.saveDueDate('insurance', '2027-03-10'))
    expect([h.result.current.dueDates[0].calendarFailed, db.events.length]).toEqual([true, 0]); await call(() => h.result.current.retryCalendar({ type: 'due', id: h.result.current.dueDates[0].id }))
    expect([h.result.current.dueDates[0].calendarFailed, db.events.length]).toEqual([false, 1])
  })
  it('실패한 채 같은 항목을 다시 저장해 성공하면 표시가 사라짐', async () => {
    const h = await mount(); db.failAt['ev.upsert'] = [1]; await call(() => h.result.current.saveItem(iin())); await call(() => h.result.current.saveItem(iin({ intervalMonths: 6 }), h.result.current.items[0].id))
    expect(h.result.current.items[0].calendarFailed).toBe(false); expect(db.events).toHaveLength(1)
  })
})

describe('AC-08-7 / AC-03-6·8 삭제 순서', () => {
  it('AC-08-7 일정 삭제 실패 → 항목 남고 MSG-03, 일정도 남음. 성공하면 일정·항목 모두 사라짐', async () => {
    seedItem('i1', {}, { date: '2027-11-05' }); const h = await mount(); db.failAt['ev.delete'] = [1]
    expect(await call(() => h.result.current.deleteItem('i1'))).toBe(false); expect(toasts()).toEqual([MSG03]); expect(h.result.current.items).toHaveLength(1); expect(db.items).toHaveLength(1); expect(db.events).toHaveLength(1)
    expect(await call(() => h.result.current.deleteItem('i1'))).toBe(true); expect(h.result.current.items).toHaveLength(0); expect(db.events).toHaveLength(0)
  })
  it('AC-08-7 만기일도 같음: 일정 삭제 실패 → 만기일 남고 MSG-03', async () => {
    seedDue('d1', 'insurance', '2027-03-10'); seedEvent('ev-d1', '[내 차] 보험 만기', '2027-03-10'); const h = await mount(); db.failAt['ev.delete'] = [1]
    expect(await call(() => h.result.current.deleteDueDate('insurance'))).toBe(false); expect(toasts()).toEqual([MSG03]); expect(h.result.current.dueDates).toHaveLength(1); expect(db.events).toHaveLength(1)
  })
  it('AC-03-6 연결 일정 있는 차량 삭제: 차량·딸린 행·연결 일정이 사라지고 다른 차량 데이터는 그대로', async () => {
    db.vehicles.push(veh('v2', { name: '가족' })); seedItem('i1', {}, { date: '2027-11-05' }); seedDue('d1', 'insurance', '2027-03-10'); seedEvent('ev-d1', '[내 차] 보험 만기', '2027-03-10'); seedRec('r1', '2026-11-01', 48100)
    db.items.push({ ...iin(), id: 'i2', vehicleId: 'v2', eventId: 'ev-i2', createdAt: 'x' }); seedEvent('ev-i2', titleOf('가족', '엔진오일'), '2027-11-05'); seedRec('r2', '2026-11-01', 100, 'v2')
    const h = await mount(); expect(await call(() => h.result.current.deleteVehicle('v1'))).toBe(true)
    expect(db.vehicles.map((v: Row) => v.id)).toEqual(['v2']); expect([db.items, db.dues, db.records].map((t: Row[]) => t.map((r) => r.id))).toEqual([['i2'], [], ['r2']]); expect(db.events.map((e: Row) => e.id)).toEqual(['ev-i2'])
    expect(db.reload).toHaveBeenCalledTimes(1)
  })
  it('AC-03-8 연결 일정 3건, 두 번째 일정 삭제 실패 → MSG-03, 차량 행 남음, 첫 항목의 event_id는 비워짐, 다시 열어 동기화해도 첫 일정이 재생성되지 않음', async () => {
    seedItem('i1', { name: 'A' }, { date: '2027-01-01' }); seedItem('i2', { name: 'B' }, { date: '2027-02-01' }); seedItem('i3', { name: 'C' }, { date: '2027-03-01' })
    const h = await mount(); db.failAt['ev.delete'] = [2]
    expect(await call(() => h.result.current.deleteVehicle('v1'))).toBe(false); expect(toasts()).toEqual([MSG03])
    expect(db.vehicles.map((v: Row) => v.id)).toEqual(['v1']); expect(db.items.map((i: Row) => [i.id, i.eventId])).toEqual([['i1', null], ['i2', 'ev-i2'], ['i3', 'ev-i3']]); expect(db.events.map((e: Row) => e.id).sort()).toEqual(['ev-i2', 'ev-i3'])
    expect(h.result.current.items.find((i) => i.id === 'i1')?.eventId).toBeNull(); expect(db.reload).toHaveBeenCalledTimes(1) // 지운 1건이 있었으니 캘린더는 1번 다시 불러옴
    h.unmount(); const h2 = await mount(); expect(h2.result.current.items.find((i) => i.id === 'i1')?.eventId).toBeNull()
    await call(() => h2.result.current.saveVehicle({ name: '내 차2', model: null, year: null, plate: null, odometerKm: 48000 }, 'v1')) // 차량 수정 → 연결 일정 동기화
    expect(db.events.some((e: Row) => e.title.includes('A 교체 예정'))).toBe(false); expect(db.events.map((e: Row) => e.title).sort()).toEqual([titleOf('내 차2', 'B'), titleOf('내 차2', 'C')])
  })
  it('차량 삭제에서 행 삭제(마지막 단계)가 실패해도 이미 지운 일정의 연결은 비워진 채 MSG-03', async () => {
    seedItem('i1', {}, { date: '2027-01-01' }); const h = await mount(); db.fail['api.deleteVehicle'] = true
    expect(await call(() => h.result.current.deleteVehicle('v1'))).toBe(false); expect(toasts()).toEqual([MSG03]); expect([db.items[0].eventId, db.events.length, db.vehicles.length]).toEqual([null, 0, 1])
  })
})

describe('AC-08-8·9·15 / AC-06-5·13·15 계산 불가·기록 변화', () => {
  it('AC-08-8 km 주기만 있고 기록 부족 → 저장해도 일정 만들어지지 않음, 다음 교체일 없음', async () => {
    const h = await mount(); expect(await call(() => h.result.current.saveItem(iin({ intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000 })))).toBe(true)
    expect(db.events).toHaveLength(0); expect(h.result.current.items[0].nextDate).toBeNull(); expect(db.reload).not.toHaveBeenCalled(); expect(h.result.current.items[0].calendarFailed).toBe(false)
  })
  it('AC-06-5 남은 거리 8,000km, 다음 교체일 없음, 일정 없음 (마지막 40,000, 현재 42,000, 90일 안 기록 1건)', async () => {
    db.vehicles[0].odometerKm = 42000; seedRec('r1', '2026-10-20', 42000); seedItem('i1', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000, eventId: null })
    const h = await mount(); const v = h.result.current.items[0]; expect([v.nextDate, v.remainingKm, db.events.length]).toEqual([null, 8000, 0])
  })
  it('AC-08-9 km 항목 일정이 2027-01-04 → 최근 기록 추가로 다음 교체일 2026-12-20이 되면 일정이 그 날짜로 바뀜', async () => {
    seedRec('r0', '2026-10-26', 48900); seedItem('i1', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000 }, { date: '2027-01-04' }); const h = await mount()
    expect(await call(() => h.result.current.saveRecord({ kind: 'other', date: '2026-11-05', amountWon: 1, odometerKm: 49100, liters: null, fullTank: false, memo: null }))).toBe(true)
    expect(h.result.current.items[0].nextDate).toBe('2026-12-20'); expect(db.events).toHaveLength(1); expect(db.events[0].start_at).toBe('2026-12-20'); expect(db.reload).toHaveBeenCalledTimes(1)
  })
  it('AC-08-15 기록이 2건 미만이 되면 연결 일정 삭제, event_id 유지, MSG-11·토스트 없음, 다음 교체일 없음 → 기록이 다시 늘면 같은 id의 일정이 다시 생김', async () => {
    seedRec('r0', '2026-10-26', 48900); seedRec('r1', '2026-11-05', 49100); seedItem('i1', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000 }, { date: '2026-12-20' }); const h = await mount()
    expect(h.result.current.items[0].nextDate).toBe('2026-12-20')
    expect(await call(() => h.result.current.deleteRecord('r1'))).toBe(true)
    const v = h.result.current.items[0]; expect([db.events.length, db.items[0].eventId, v.calendarFailed, v.nextDate, toasts().length]).toEqual([0, 'ev-i1', false, null, 0])
    expect(await call(() => h.result.current.saveRecord({ kind: 'other', date: '2026-11-05', amountWon: 1, odometerKm: 49100, liters: null, fullTank: false, memo: null }))).toBe(true)
    expect(db.events.map((e: Row) => [e.id, e.start_at])).toEqual([['ev-i1', '2026-12-20']])
  })
  it('AC-06-13 주행거리 비운 새 차량 등록 → 추천 항목 일정 0건(엔진오일 다음 교체일은 있어도 연결 id 없음)', async () => {
    db.vehicles.length = 0; const h = renderHook(() => useCarbook('user-1')); await waitFor(() => expect(h.result.current.loadState).toBe('ready'))
    expect(await call(() => h.result.current.saveVehicle({ name: '새 차', model: null, year: null, plate: null, odometerKm: null }))).toBe(true)
    await waitFor(() => expect(h.result.current.recordsState).toBe('ready')); const its = h.result.current.items
    expect(its).toHaveLength(7); const oil = its.find((i) => i.name.includes('엔진오일'))!; expect([oil.nextDate, oil.status]).toEqual(['2027-11-05', 'ok'])
    const tire = its.find((i) => i.name.includes('타이어 위치'))!, pad = its.find((i) => i.name.includes('브레이크 패드'))!; expect([tire.nextDate, tire.remainingKm, tire.status, pad.nextDate, pad.remainingKm, pad.status]).toEqual([null, null, 'ok', null, null, 'ok'])
    expect([db.events.length, db.log.filter((l: string) => l.startsWith('events:')).length, db.reload.mock.calls.length, its.every((i) => i.eventId === null)]).toEqual([0, 0, 0, true])
  })
  it('AC-06-15 첫 기록(48,000km) 저장 → km 주기 항목 마지막 교체 주행거리 48,000, 엔진오일 남은 거리 10,000, 지남 배지 없음, 일정 만들어지지 않음', async () => {
    db.vehicles.length = 0; const h = renderHook(() => useCarbook('user-1')); await waitFor(() => expect(h.result.current.loadState).toBe('ready'))
    await call(() => h.result.current.saveVehicle({ name: '새 차', model: null, year: null, plate: null, odometerKm: null })); await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
    expect(await call(() => h.result.current.saveRecord({ kind: 'other', date: '2026-11-05', amountWon: 1, odometerKm: 48000, liters: null, fullTank: false, memo: null }))).toBe(true)
    const its = h.result.current.items; const kmItems = its.filter((i) => i.intervalKm !== null); expect(kmItems.length).toBeGreaterThan(0); expect(kmItems.every((i) => i.lastOdometerKm === 48000)).toBe(true)
    expect(its.find((i) => i.name.includes('엔진오일'))!.remainingKm).toBe(10000); expect(its.some((i) => i.status === 'overdue')).toBe(false); expect([db.events.length, db.reload.mock.calls.length]).toEqual([0, 0])
  })
})

describe('MPR-26 이월', () => {
  it('event_id 선점이 막혀 돌려받은 행의 eventId가 null → 캘린더 요청 0번, 저장 자체는 성공, 표시 없음', async () => {
    seedItem('i1', { eventId: null }); db.claimBlocked = true; const h = await mount()
    expect(await call(() => h.result.current.saveItem(iin({ intervalMonths: 6 }), 'i1'))).toBe(true)
    expect([db.log.length, db.events.length, db.reload.mock.calls.length, h.result.current.items[0].calendarFailed, h.result.current.items[0].nextDate, toasts().length]).toEqual([0, 0, 0, false, '2027-05-05', 0])
  })
  it('연결 id가 없는 기존 항목을 저장하면 id를 선점해 일정을 만듦(선점 성공)', async () => {
    seedItem('i1', { eventId: null }); const h = await mount(); await call(() => h.result.current.saveItem(iin(), 'i1'))
    expect(db.items[0].eventId).toBeTruthy(); expect(db.events.map((e: Row) => e.id)).toEqual([db.items[0].eventId])
  })
  it('두 탭이 같은 항목을 동시에 첫 저장: 선점에서 진 탭도 이긴 탭의 id를 써서 일정 1건(카테고리 1개)', async () => {
    seedItem('i1', { eventId: null }); const a = await mount(), b = await mount()
    await act(async () => { await Promise.all([a.result.current.saveItem(iin(), 'i1'), b.result.current.saveItem(iin(), 'i1')]) })
    expect(db.events).toHaveLength(1); expect(db.events[0].id).toBe(db.items[0].eventId); expect(db.categories).toHaveLength(1)
  })
  it('두 탭 동시에 항목 1개와 만기일 1개를 처음 저장: 카테고리 1개, 일정 각 1건', async () => {
    const a = await mount(), b = await mount()
    await act(async () => { await Promise.all([a.result.current.saveItem(iin()), b.result.current.saveDueDate('insurance', '2027-03-10')]) })
    expect(db.categories).toHaveLength(1); expect(db.events.map((e: Row) => e.title).sort()).toEqual(['[내 차] 보험 만기', titleOf('내 차', '엔진오일')].sort())
  })
  it('ensure가 42501(로그인 만료와 구분)로 실패: 로그아웃 호출 없음, 토스트 없음, 항목은 저장되고 그 행만 MSG-11, 다음에 성공하면 회복', async () => {
    const h = await mount(); db.rpcCode = '42501'; db.fail.rpc = true
    expect(await call(() => h.result.current.saveItem(iin()))).toBe(true)
    expect([db.signOut.mock.calls.length, toasts().length, h.result.current.items[0].calendarFailed, db.items.length, db.events.length]).toEqual([0, 0, true, 1, 0])
    db.fail.rpc = false; await call(() => h.result.current.retryCalendar({ type: 'item', id: h.result.current.items[0].id })); expect([h.result.current.items[0].calendarFailed, db.events.length]).toEqual([false, 1])
  })
  it('ensure 실패는 기억하지 않음: 첫 호출 실패 뒤 다음 호출이 RPC를 다시 시도', async () => {
    const h = await mount(); db.failAt.rpc = [1]; await call(() => h.result.current.saveItem(iin())); await call(() => h.result.current.retryCalendar({ type: 'item', id: h.result.current.items[0].id })); expect(logCount('rpc:')).toBe(2)
  })
  it('reload는 쓰기 묶음당 1번: 연결 3건이 바뀌는 차량 수정 → 1번, 바뀐 게 없으면 0번, 항목 저장 1번', async () => {
    seedItem('i1', { name: 'A' }, { date: '2027-11-05' }); seedItem('i2', { name: 'B' }, { date: '2027-11-05' }); seedDue('d1', 'insurance', '2027-03-10'); seedEvent('ev-d1', '[내 차] 보험 만기', '2027-03-10')
    const h = await mount(); await call(() => h.result.current.saveVehicle({ name: '새이름', model: null, year: null, plate: null, odometerKm: 48000 }, 'v1'))
    expect(db.events.every((e: Row) => e.title.startsWith('[새이름]'))).toBe(true); expect(db.reload).toHaveBeenCalledTimes(1)
    await call(() => h.result.current.saveVehicle({ name: '새이름', model: null, year: null, plate: null, odometerKm: 48000 }, 'v1')); expect(db.reload).toHaveBeenCalledTimes(1) // 같은 값 → 쓰기 0, reload 증가 없음
    const before = logCount('events:upsert'); expect(before).toBe(3)
  })
  it('reload가 실패해도 저장은 성공(60초 폴링이 보정)', async () => {
    db.reload = vi.fn(async () => { throw new Error('x') }); const h = await mount(); expect(await call(() => h.result.current.saveItem(iin()))).toBe(true); expect(toasts()).toEqual([]); expect(db.events).toHaveLength(1)
  })
  it('내 일정만 지움: 일정 삭제 질의에 user_id 조건(다른 사용자의 같은 id 일정은 안 지워짐)', async () => {
    seedItem('i1', {}, { date: '2027-11-05' }); db.events.push({ id: 'ev-i1', user_id: 'other', title: '남의 일정', category_id: null }); const h = await mount(); await call(() => h.result.current.deleteItem('i1'))
    expect(db.events.map((e: Row) => e.user_id)).toEqual(['other'])
  })
  it('재묶기(rebindCategory)는 이 티켓에서 훅이 부르지 않음 → 열 때 점검(MPR-28) 몫. 훅 전체 흐름에서 events update 질의 0번', async () => {
    seedItem('i1', {}, { date: '2027-11-05' }); const h = await mount(); await call(() => h.result.current.saveItem(iin({ intervalMonths: 6 }), 'i1')); await call(() => h.result.current.deleteItem('i1'))
    expect(db.log.filter((l: string) => l === 'events:update')).toEqual([])
  })
})

describe('기록 미로딩 보호 (리뷰 수정 23975f3)', () => {
  it('기록 읽기 실패 상태에서 km 항목 일정은 지우지도 쓰지도 않음(다음 교체일을 알 수 없으므로)', async () => {
    seedRec('r0', '2026-10-26', 48900); seedRec('r1', '2026-11-05', 49100); seedItem('i1', { intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000 }, { date: '2026-12-20' })
    db.fail['api.listRecords'] = true; const h = renderHook(() => useCarbook('user-1')); await waitFor(() => expect(h.result.current.recordsState).toBe('error'))
    await call(() => h.result.current.saveVehicle({ name: '내 차2', model: null, year: null, plate: null, odometerKm: 48000 }, 'v1'))
    expect(db.events).toHaveLength(1); expect(db.events[0].start_at).toBe('2026-12-20'); expect(h.result.current.items[0].calendarFailed).toBe(false)
  })
})
